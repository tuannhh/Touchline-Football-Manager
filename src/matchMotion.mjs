import {phaseSlot, normalizeTactics} from './tactics.mjs';

// Presentation only: no match RNG, statistics or player records are changed here.
// Pitch coordinates are percentages; home attacks right, away attacks left.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const lerp=(a,b,t)=>a+(b-a)*t;
// Scene records are flat. Deep structured clones on every keyframe/sample
// created avoidable garbage on the same thread that paints the match.
const copy=value=>Array.isArray(value)?value.map(item=>({...item})):{...value};
const copyFrame=frame=>({...frame,players:copy(frame.players),ball:{...frame.ball},action:{...frame.action},score:[...frame.score]});
const direction=side=>side===0?1:-1;
const localX=(side,x)=>side===0?x:100-x;
const worldX=localX;
const feet=p=>({x:clamp(p.x+direction(p.side)*.65,0,100),y:clamp(p.y+.35,0,100)});
const finite=(v,fallback)=>Number.isFinite(v)?v:fallback;
function hash(value){let n=2166136261;for(const c of String(value)){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return n>>>0;}
const noise=(key)=>hash(key)/4294967296;
const skill=(g,p,key)=>clamp(finite(g.players?.[p.id]?.attributes?.[key],10),1,20);
const speed=(g,p)=>3.5+skill(g,p,'pace')*.16+skill(g,p,'stamina')*.035;
function actors(g,m){
 const banned=new Set([...(m.red||[]),...(m.injured||[]),...(m.off||[])]),out=[];
 for(const side of [0,1])for(const [seat,id]of(m.lineups?.[side]||[]).entries()){
  if(!id||banned.has(id)||!g.players?.[id])continue;
  const role=slot(m,side,seat,m.attack===side)[0];out.push({id,side,seat,role});
 }
 return out;
}
function slot(m,side,seat,attack){
 try{return phaseSlot(m.phaseTactics?.[side],attack?'inPossession':'outOfPossession',seat,m.formation?.[side]||'4-3-3')||['CM',50,50];}
 catch{return ['CM',50,50];}
}
function anchor(m,p,attacking,ball={x:50,y:50}){
 const t=normalizeTactics(m.tactics?.[p.side]),[role,y,x]=slot(m,p.side,p.seat,attacking),progress=localX(p.side,ball.x);
 if(role==='GK')return {x:worldX(p.side,clamp(5+(attacking?progress*.05:Math.max(0,progress-35)*.035)+(t.line-3)*.6,3,12)),y:clamp(50+(ball.y-50)*.20,40,60),role};
 const line=(t.line-3)*2.2,advance=attacking?8:0;
 const home=9+(100-x)*.72+line+advance;
 return {x:worldX(p.side,clamp(home,12,91)),y:clamp(50+(y-50)*(.72+t.width*.10),5,95),role};
}
export function restingMatchFrame(g,m){
 const ball={x:clamp(finite(m.ball?.x,50),0,100),y:clamp(finite(m.ball?.y,50),0,100),z:0};
 const players=actors(g,m).map(p=>({...p,...anchor(m,p,m.attack===p.side,ball),task:p.role==='GK'?'keeper':'shape'}));
 return {at:0,players,ball,action:{type:m.completed?'fulltime':m.minute===0?'kickoff':'hold',label:m.completed?'Trận đấu đã kết thúc':m.minute===0?'Sẵn sàng giao bóng':'Giữ vị trí',side:m.attack??0},score:[...(m.score||[0,0])],eventIndex:m.events?.length||0};
}

export function buildMatchScene(g,beforeMatch,afterMatch,previousFrame=null){
 const before=beforeMatch||afterMatch,after=afterMatch||beforeMatch;
 const seed=`${before.fixtureId||'match'}:${before.minute||0}:${after.minute||0}:${before.rng||0}`;
 const all=actors(g,before),initial=restingMatchFrame(g,before),previous=previousFrame||initial;
 const previousById=new Map((previous.players||[]).map(p=>[p.id,p]));
 let players=all.map(p=>({...p,...anchor(before,p,before.attack===p.side,previous.ball||initial.ball),...(previousById.has(p.id)?{x:previousById.get(p.id).x,y:previousById.get(p.id).y}:{}),task:'shape'}));
 let ball={...initial.ball,...previous.ball,z:finite(previous.ball?.z,0)};
 if(!players.some(p=>p.id===ball.ownerId))delete ball.ownerId;
 let at=0,score=[...(before.score||[0,0])],revealed=before.events?.length||0,action={type:'hold',label:'Tổ chức đội hình',side:before.attack??0};
 const frames=[],newEvents=(after.events||[]).slice(before.events?.length||0);
 let currentSide=players.find(p=>p.id===ball.ownerId)?.side??before.attack??0,stepSerial=0;
 const lastGoal=(before.events||[]).filter(e=>e.type==='goal').at(-1);
 let restartSide=previousFrame?(previousFrame.restartSide??null):(before.phase==='goal'&&lastGoal?1-lastGoal.side:null);
 if(before.minute===0&&!previousFrame?.ball?.ownerId)restartSide=before.attack??0;
 const lastAttempt=(before.events||[]).filter(e=>e.type==='shot'||e.type==='goal').at(-1);
 let goalKickSide=previousFrame?(previousFrame.goalKickSide??null):(before.phase==='shot'&&lastAttempt?.type==='shot'&&(lastAttempt.outcome==='wide'||lastAttempt.text?.includes('chệch'))?1-lastAttempt.side:null);
 const byId=id=>players.find(p=>p.id===id);
 const team=(side,outfield=false)=>players.filter(p=>p.side===side&&(!outfield||p.role!=='GK'));
 const nearest=(side,point,{exclude=[],outfield=false}={})=>team(side,outfield).filter(p=>!exclude.includes(p.id)).sort((a,b)=>distance(a,point)-distance(b,point))[0];
 const push=()=>frames.push({at,players:copy(players),ball:copy(ball),action:copy(action),score:[...score],eventIndex:revealed,restartSide,goalKickSide});
 push();
 const startAction=next=>{action={...next};frames.at(-1).action=copy(action);};
 // Each actor has a separate objective: carrier, runner, support, pressing,
 // marking, cover or goalkeeper. Shape anchors are a base, never a shared delta.
 function targets(side,ownerId,overrides={}){
  const settings=normalizeTactics(before.tactics?.[side]),owner=byId(ownerId),point=owner?feet(owner):ball;
  const defending=team(1-side,true).sort((a,b)=>distance(a,point)-distance(b,point));
  const opp=normalizeTactics(before.tactics?.[1-side]),pressCount=opp.pressing>=4?2:1;
  const result=new Map();
  for(const p of players){
   const attack=p.side===side,base=anchor(before,p,attack,point),t=normalizeTactics(before.tactics?.[p.side]);
   let target={x:base.x,y:base.y,role:base.role,task:'shape'};
   const role=base.role,ownProgress=localX(p.side,point.x),jitter=(noise(`${seed}:${stepSerial}:${p.id}`)-.5);
   if(role==='GK')target.task='keeper';
   else if(attack){
    const axial=localX(side,base.x),progress=localX(side,point.x),lane=base.y;
    if(p.id===ownerId){target={...target,x:p.x,y:p.y,task:'dribble'};}
    else if(['ST','AM','LW','RW'].includes(role)){
     const run=role==='ST'||(role==='LW'&&point.y<55)||(role==='RW'&&point.y>45);
     target.x=worldX(side,clamp(Math.max(axial,progress+(run?13:5))+jitter*3,20,94));
     target.y=clamp(lane+(50-lane)*(progress>68?.27:.04)+jitter*4,5,95);target.task=run?'run':'support';
    }else if(['LB','RB','LWB','RWB','LM','RM'].includes(role)){
     const nearFlank=Math.abs(lane-point.y)<30,overlap=nearFlank&&progress>43&&settings.width>=3;
     target.x=worldX(side,clamp(overlap?Math.max(axial,progress+9):axial+Math.max(0,progress-50)*.13,12,91));
     target.y=clamp(lane+(lane<50?-1:1)*settings.width+jitter*2,5,95);target.task=overlap?'overlap':'support';
    }else if(role==='CB'){
     target.x=worldX(side,clamp(axial+(progress-50)*.10,14,58));target.y=lane+(point.y-50)*.08;target.task='cover';
    }else{
     target.x=worldX(side,clamp(progress-(role==='DM'?19:8)+jitter*6,axial-11,Math.min(82,axial+17)));
     const laneSide=lane<50?-1:lane>50?1:p.seat%2?1:-1;
     target.y=clamp(point.y+laneSide*(12+skill(g,p,'decisions')*.22)+jitter*3,10,90);target.task='support';
    }
   }else{
    const pressRank=defending.findIndex(x=>x.id===p.id),regroup=t.transition==='regroup';
    if(pressRank<pressCount&&!regroup&&(distance(p,point)<20+t.pressing*4||t.transition==='counterpress')){
     target.x=point.x+direction(p.side)*(pressRank?5:1.8);target.y=point.y+(pressRank?(p.y<point.y?-5:5):.5);target.task=pressRank?'screen':'press';
    }else if(['CB','LB','RB','LWB','RWB','DM'].includes(role)){
     const threats=team(side,true).filter(a=>['ST','LW','RW','AM','CM'].includes(slot(before,a.side,a.seat,true)[0]));
     const mark=threats.sort((a,b)=>(Math.abs(a.y-base.y)+distance(p,a)*.35)-(Math.abs(b.y-base.y)+distance(p,b)*.35))[0];
     if(mark){const goalSide=mark.x+direction(side)*(2.5+(20-skill(g,p,'positioning'))*.08);target.x=lerp(base.x,goalSide,.67);target.y=lerp(base.y,mark.y,.70);target.task='mark';}
    }else{target.x=base.x+(point.x-base.x)*.15;target.y=base.y+(point.y-base.y)*.20;target.task='screen';}
    if(regroup){target.x=lerp(target.x,base.x,.55);target.task='cover';}
   }
   if(overrides[p.id])target={...target,...overrides[p.id]};
   result.set(p.id,{...target,x:clamp(target.x,2,98),y:clamp(target.y,3,97)});
  }
  return result;
 }
 function advance(duration,{side=currentSide,ownerId=ball.ownerId,overrides={},flight=null,action:nextAction}={}){
  if(nextAction)startAction(nextAction);
  currentSide=side;stepSerial++;const from={...ball},steps=Math.max(1,Math.ceil(duration/.16)),dt=duration/steps;
  for(let i=1;i<=steps;i++){
   const desired=targets(side,ownerId,overrides),old=players;
   players=old.map(p=>{
    const target=desired.get(p.id);let tx=target.x,ty=target.y;
    // Light separation avoids piles at a passing lane without scattering the shape.
    if(!overrides[p.id]&&p.id!==ownerId)for(const other of old){if(other.id===p.id)continue;const d=distance(p,other);if(d>0&&d<2.2){tx+=(p.x-other.x)/d*(2.2-d)*.45;ty+=(p.y-other.y)/d*(2.2-d)*.45;}}
    const dx=tx-p.x,dy=ty-p.y,d=Math.hypot(dx,dy),rate=speed(g,p)*(target.task==='dribble'?.83:target.task==='shape'?.65:1);
    const fraction=d>0?Math.min(1,rate*dt/d):0;
    return {...p,role:target.role,task:target.task,x:clamp(p.x+dx*fraction,2,98),y:clamp(p.y+dy*fraction,3,97)};
   });
   at+=dt;
   if(flight){const t=i/steps;ball={x:lerp(from.x,flight.x,t),y:lerp(from.y,flight.y,t),z:Math.sin(Math.PI*t)*clamp((flight.height||0)/8,0,1)};}
   else if(ownerId&&byId(ownerId)){ball={...feet(byId(ownerId)),z:0,ownerId};}
   else ball={...ball,z:Math.max(0,ball.z-dt*5)};
   push();
  }
 }
 function kickoff(side){
  const centre={x:50,y:50},outfield=team(side,true),striker=outfield.find(p=>p.role==='ST');
  const taker=striker&&distance(striker,centre)<35?striker:nearest(side,centre,{outfield:true})||nearest(side,centre);
  if(!taker){restartSide=null;return;}
  const overrides={};let duration=2.2;
  for(const p of players){
   const [role,fy,fx]=slot(before,p.side,p.seat,p.side===side),local=role==='GK'?5:7+(100-fx)*.44;
   const point=p.id===taker.id?{x:50-direction(side)*.65,y:49.65}:{x:worldX(p.side,local),y:clamp(fy,6,94)};
   overrides[p.id]={...point,task:'restart'};duration=Math.max(duration,distance(p,point)/speed(g,p));
  }
  // The referee's stoppage gives both teams time to jog back; the ball visibly
  // returns to the centre, never becomes a goalkeeper possession after a goal.
  duration=Math.min(8,duration+.12);
  advance(duration,{side,ownerId:null,overrides,flight:{...centre,height:.35},action:{type:before.minute===0&&at===0?'kickoff':'restart',label:before.minute===0&&at===0?'Hai đội vào vị trí giao bóng':'Đưa bóng về giữa sân · giao bóng lại',side,playerId:taker.id}});
  const takerPoint=byId(taker.id),remaining=distance(takerPoint,overrides[taker.id]);
  if(remaining>.01)advance(remaining/speed(g,takerPoint)+.03,{side,ownerId:null,overrides,action:{type:'kickoff',label:'Chuẩn bị giao bóng lại',side,playerId:taker.id}});
  ball={...feet(byId(taker.id)),z:0,ownerId:taker.id};restartSide=null;
  frames.at(-1).ball=copy(ball);frames.at(-1).restartSide=null;
  advance(.3,{side,ownerId:taker.id,overrides:{[taker.id]:{x:byId(taker.id).x,y:byId(taker.id).y,task:'receive'}},action:{type:'kickoff',label:before.minute===0?'Giao bóng bắt đầu trận đấu':'Giao bóng lại sau bàn thắng',side,playerId:taker.id}});
  const recipient=nearest(side,ball,{exclude:[taker.id],outfield:true});
  if(recipient)pass(recipient.id,{side,type:'kickoff',label:'Giao bóng · chuyền cho đồng đội'});
 }
 function goalKick(side){
  const keeper=team(side).find(p=>p.role==='GK')||nearest(side,{x:worldX(side,6),y:50});
  if(!keeper){goalKickSide=null;return;}
  const point={x:worldX(side,6)-direction(side)*.65,y:ball.y<50?44.65:54.65};
  const duration=Math.max(1.1,distance(keeper,point)/speed(g,keeper)+.1);
  advance(duration,{side,ownerId:null,overrides:{[keeper.id]:{...point,task:'restart'}},flight:{...feet({...keeper,...point}),height:.15},action:{type:'goalkick',label:'Bóng hết đường biên · phát bóng lên',side,playerId:keeper.id}});
  ball={...feet(byId(keeper.id)),z:0,ownerId:keeper.id};goalKickSide=null;
  frames.at(-1).ball=copy(ball);frames.at(-1).goalKickSide=null;
  const receiver=nearest(side,{x:worldX(side,30),y:ball.y},{exclude:[keeper.id],outfield:true});
  if(receiver)pass(receiver.id,{side,type:'goalkick',label:'Thủ môn phát bóng · triển khai lại',height:3});
 }
 function possession(side){
  if(restartSide!=null)kickoff(restartSide);
  else if(goalKickSide!=null)goalKick(goalKickSide);
  let owner=byId(ball.ownerId);
  if(owner?.side===side)return owner;
  const receiver=nearest(side,ball,{outfield:localX(side,ball.x)>23})||nearest(side,ball);
  if(!receiver)return null;
  if(owner){
   // A turnover is a visible intercepted pass; the ball traverses the distance.
   pass(receiver.id,{type:'interception',label:'Đọc đường chuyền · đoạt bóng',side,forced:true});
  }else{
   const destination={x:clamp(ball.x-direction(side)*.65,2,98),y:clamp(ball.y-.35,3,97)};
   const d=distance(receiver,destination);
   if(d<16){
    advance(Math.max(.25,d/speed(g,receiver)+.08),{side,ownerId:null,overrides:{[receiver.id]:{...destination,task:'receive'}},action:{type:before.minute===0&&at<.01?'kickoff':'restart',label:before.minute===0&&at<.01?'Giao bóng':'Thu hồi bóng',side,playerId:receiver.id}});
    const collect=feet(byId(receiver.id)),gap=distance(ball,collect);
    if(gap>.001)advance(Math.max(.18,gap/16),{side,ownerId:null,overrides:{[receiver.id]:{x:byId(receiver.id).x,y:byId(receiver.id).y,task:'receive'}},flight:{...collect,height:0}});
    ball={...collect,z:0,ownerId:receiver.id};frames.at(-1).ball=copy(ball);
   }else pass(receiver.id,{type:'restart',label:'Đưa bóng trở lại cuộc chơi',side,forced:true});
  }
  return byId(receiver.id);
 }
 function pass(receiverId,{type='pass',label='Chuyền bóng',side=currentSide,target=null,height=null,forced=false,eventPlayerId=null}={}){
  const receiver=byId(receiverId);if(!receiver)return null;
  const passer=byId(ball.ownerId),from={...ball};
  if(passer?.id===receiverId)return receiver;
  const desired=target||{x:receiver.x+direction(side)*(type==='throughball'?12:type==='cross'?4:2),y:receiver.y};
  const tempo=normalizeTactics(before.tactics?.[side]).tempo;
  const ballSpeed=(type==='cross'?23:type==='throughball'?29:27)*(.82+tempo*.06);
  let time=Math.max(.38,distance(from,receiver)/ballSpeed);
  let point;
  for(let k=0;k<3;k++){
   const d=distance(receiver,desired),lead=Math.min(d,speed(g,receiver)*time*.76);
   point={x:clamp(receiver.x+(desired.x-receiver.x)*(d?lead/d:0),2,98),y:clamp(receiver.y+(desired.y-receiver.y)*(d?lead/d:0),3,97)};
   time=Math.max(.38,distance(from,feet({...receiver,...point}))/ballSpeed);
  }
  const endpoint=feet({...receiver,...point}),flightHeight=height??(type==='cross'?7:type==='throughball'?.8:type==='restart'?3:type==='interception'?.7:distance(from,endpoint)>32?3.5:.45);
  advance(time,{side,ownerId:null,overrides:{[receiver.id]:{...point,task:'receive'}},flight:{...endpoint,height:flightHeight},action:{type,label,side,playerId:eventPlayerId||passer?.id,receiverId}});
  ball={...feet(byId(receiver.id)),z:0,ownerId:receiver.id};frames.at(-1).ball=copy(ball);
  return byId(receiver.id);
 }
 function dribble(id,target,duration,label='Dẫn bóng tìm khoảng trống'){
  const p=byId(id);if(!p)return;
  if(ball.ownerId!==id)pass(id,{side:p.side});
  advance(duration,{side:p.side,ownerId:id,overrides:{[id]:{...target,task:'dribble'}},action:{type:'dribble',label,side:p.side,playerId:id}});
 }
 function supportPlay(side){
  const settings=normalizeTactics(before.tactics?.[side]);let owner=possession(side);if(!owner)return;
  dribble(owner.id,{x:clamp(owner.x+direction(side)*7,5,95),y:clamp(owner.y+(owner.y<50?2:-2),5,95)},1.25*(1.18-settings.tempo*.06));
  owner=byId(owner.id);
  const choices=team(side,true).filter(p=>p.id!==owner.id).sort((a,b)=>{
   const targetDistance=settings.passing==='short'?17:settings.passing==='direct'?39:26;
   const value=p=>Math.abs(distance(owner,p)-targetDistance)-localX(side,p.x)*.07-skill(g,p,'teamwork')*.08;
   return value(a)-value(b);
  });
  if(!choices.length)return;
  const receiver=choices[0],type=settings.passing==='direct'||settings.transition==='counter'?'throughball':'pass';
  pass(receiver.id,{type,side,label:type==='throughball'?'Chọc khe · bứt tốc':'Phối hợp mở góc chuyền'});
  if(settings.passing==='short'){
   const runner=byId(owner.id),lead={x:clamp(runner.x+direction(side)*9,4,96),y:runner.y+(runner.y<50?3:-3)};
   advance(.55,{side,ownerId:receiver.id,overrides:{[runner.id]:{...lead,task:'run'}},action:{type:'one-two',label:'Bật nhả một–hai',side,playerId:receiver.id,receiverId:runner.id}});
   pass(runner.id,{type:'one-two',side,label:'Bật nhả · chạy vượt tuyến',target:lead});owner=byId(runner.id);
  }else owner=byId(receiver.id);
  const wide=settings.width>=4&&team(side,true).find(p=>['LW','RW','LWB','RWB'].includes(p.role)&&p.id!==owner.id);
  if(wide){
   pass(wide.id,{side,label:'Mở bóng ra biên'});
   const p=byId(wide.id),target={x:worldX(side,Math.min(91,localX(side,p.x)+10)),y:clamp(p.y,8,92)};
   dribble(p.id,target,.95,'Bám biên · chờ người chồng cánh');owner=byId(p.id);
  }
  advance(Math.max(.8,4.9-at),{side,ownerId:owner.id,action:{type:'hold',label:'Giữ bóng · di chuyển hỗ trợ',side,playerId:owner.id}});
 }
 function shotEvent(event,index){
  const side=event.side===1?1:0;let shooter=byId(event.playerId);
  // Normal ticks always have their shooter in the pre-tick XI. The fallback
  // supports imported old saves that only retained the post-tick lineups.
  if(!shooter){const p=actors(g,after).find(p=>p.id===event.playerId);if(p){shooter={...p,...anchor(before,p,true,ball),task:'run'};players.push(shooter);}}
  if(!shooter){revealed=index+1;return;}
  const settings=normalizeTactics(before.tactics?.[side]);let owner=possession(side);if(!owner)return;
  const assistId=event.assistId||Object.keys(after.assists||{}).find(id=>(after.assists[id]||0)>(before.assists?.[id]||0)&&byId(id)?.side===side&&id!==shooter.id);
  const helper=byId(assistId)||team(side,true).filter(p=>p.id!==shooter.id).sort((a,b)=>distance(a,shooter)-distance(b,shooter))[0];
  const variant=settings.passing==='direct'||settings.transition==='counter'?'throughball':settings.width>=4?'cross':settings.passing==='short'?'one-two':noise(`${seed}:${index}:pattern`)>.45?'cross':'throughball';
  const shotLane=clamp(50+(noise(`${seed}:${index}:lane`)-.5)*20,37,63),shotPoint={x:worldX(side,82+noise(`${seed}:${index}:depth`)*7),y:shotLane};
  const runnerOverride={...shotPoint,task:'run'};
  if(helper){
   if(owner.id!==helper.id)pass(helper.id,{side,type:variant==='throughball'?'throughball':'pass',label:variant==='throughball'?'Chuyền nhanh lên phía trước':'Phối hợp tạo khoảng trống'});
   const carrier=byId(helper.id),local=localX(side,carrier.x);
   let target=variant==='cross'?{x:worldX(side,Math.max(local,76)),y:carrier.y<50?13:87}:{x:worldX(side,Math.max(local,69)),y:carrier.y};
   advance(1.25*(1.18-settings.tempo*.06),{side,ownerId:helper.id,overrides:{[helper.id]:{...target,task:variant==='cross'?'overlap':'dribble'},[shooter.id]:runnerOverride},action:{type:'dribble',label:variant==='cross'?'Khoét biên · tiền đạo chạy cắt mặt':'Kéo hậu vệ · chạy chỗ đón bóng',side,playerId:helper.id,receiverId:shooter.id}});
   if(variant==='one-two'&&ball.ownerId!==shooter.id){
    pass(shooter.id,{side,type:'pass',label:'Chuyền vào chân tiền đạo',target:shotPoint});
    pass(helper.id,{side,type:'one-two',label:'Nhả bóng · chạy sau lưng hậu vệ',target:{x:byId(helper.id).x+direction(side)*4,y:byId(helper.id).y}});
   }
   pass(shooter.id,{side,type:variant,label:variant==='cross'?'Tạt bóng · băng vào dứt điểm':variant==='one-two'?'Bật nhả một–hai · xâm nhập':'Chọc khe · phá bẫy việt vị',target:shotPoint});
  }else if(owner.id!==shooter.id)pass(shooter.id,{side,type:'throughball',label:'Chọc khe cho tiền đạo',target:shotPoint});
  shooter=byId(shooter.id);
  const approach=distance(shooter,shotPoint);
  // The actual shooter runs to the shooting position; no relocation for highlights.
  if(approach>2)dribble(shooter.id,shotPoint,Math.min(3.6,approach/(speed(g,shooter)*.83)),'Chỉnh bóng · tìm góc dứt điểm');
  shooter=byId(shooter.id);const goalkeeper=team(1-side).find(p=>p.role==='GK');
  const outcome=event.type==='goal'?'goal':event.outcome==='saved'||event.outcome==='save'?'saved':event.outcome==='wide'||event.outcome==='miss'?'wide':((after.onTarget?.[side]||0)-(before.onTarget?.[side]||0))>((after.score?.[side]||0)-(before.score?.[side]||0))?'saved':'wide';
  const goalY=47+noise(`${seed}:${index}:finish`)*6;
  let destination=outcome==='goal'?{x:side===0?100:0,y:goalY}:outcome==='saved'&&goalkeeper?{x:worldX(side,95),y:goalY}:{x:side===0?100:0,y:noise(`${seed}:${index}:miss`)>.5?34:66};
  let flightTime=Math.max(.5,distance(ball,destination)/40);
  let keeperPoint=goalkeeper?{x:worldX(side,97),y:goalY}:null;
  if(outcome==='saved'&&goalkeeper){
   const desired={x:destination.x,y:destination.y},d=distance(goalkeeper,desired),reach=Math.min(d,speed(g,goalkeeper)*flightTime*.72);
   keeperPoint={x:goalkeeper.x+(desired.x-goalkeeper.x)*(d?reach/d:0),y:goalkeeper.y+(desired.y-goalkeeper.y)*(d?reach/d:0)};
   destination=feet({...goalkeeper,...keeperPoint});flightTime=Math.max(.5,distance(ball,destination)/40);
   // A pass/shot endpoint must be within the actor's movement budget.
   const available=speed(g,goalkeeper)*flightTime*.85,actual=distance(goalkeeper,keeperPoint);
   if(actual>available){keeperPoint={x:goalkeeper.x+(keeperPoint.x-goalkeeper.x)*available/actual,y:goalkeeper.y+(keeperPoint.y-goalkeeper.y)*available/actual};destination=feet({...goalkeeper,...keeperPoint});}
  }
  const keeperTarget=goalkeeper?{[goalkeeper.id]:{...keeperPoint,task:'save'}}:{};
  advance(flightTime,{side,ownerId:null,overrides:keeperTarget,flight:{...destination,height:variant==='cross'?2.4:1.6},action:{type:'shot',label:variant==='cross'?'Dứt điểm từ quả tạt':'Sút bóng!',side,playerId:shooter.id,outcome}});
  if(outcome==='saved'&&goalkeeper){
   // Keeper meets the shot at the reachable dive point, never a phantom goal.
   const keeper=byId(goalkeeper.id);ball={...feet(keeper),z:0,ownerId:keeper.id};frames.at(-1).ball=copy(ball);
  }
  if(outcome==='goal'){score=Array.isArray(event.score)?[...event.score]:score.map((n,i)=>n+(i===side?1:0));restartSide=1-side;goalKickSide=null;}
  else if(outcome==='wide')goalKickSide=1-side;
  revealed=index+1;frames.at(-1).score=[...score];frames.at(-1).eventIndex=revealed;
  advance(.45,{side:outcome==='saved'?1-side:side,ownerId:ball.ownerId||null,action:{type:outcome==='goal'?'goal':outcome==='saved'?'save':'miss',label:outcome==='goal'?'VÀO!':outcome==='saved'?'Thủ môn cản phá':'Bóng đi chệch khung thành',side,playerId:shooter.id,outcome}});
 }
 const hasShot=newEvents.some(e=>e.type==='shot'||e.type==='goal');
 if(!hasShot){supportPlay(after.attack===1?1:0);if(at<6.1)advance(6.1-at,{side:currentSide,ownerId:ball.ownerId||null});}
 const departed=new Map();
 for(let offset=0;offset<newEvents.length;offset++){
  const event=newEvents[offset],index=(before.events?.length||0)+offset;
  if(event.type==='shot'||event.type==='goal')shotEvent(event,index);
  else{
   // Show the event at its boundary, after that minute's play. A dismissed,
   // injured or substituted scorer cannot defend a later action in this scene.
   if(['red','injury'].includes(event.type)){
    const removed=byId(event.playerId);if(removed)departed.set(`${removed.side}:${removed.seat}`,removed);
    players=players.filter(p=>p.id!==event.playerId);
   }
   if(event.type==='sub'&&g.players?.[event.playerId]){
    const side=event.side===1?1:0,seat=after.lineups?.[side]?.indexOf(event.playerId)??-1;
    if(seat>=0){
     const removed=players.find(p=>p.side===side&&p.seat===seat)||departed.get(`${side}:${seat}`);
     const incoming={id:event.playerId,side,seat,role:slot(after,side,seat,side===currentSide)[0]};
     players=players.filter(p=>!(p.side===side&&p.seat===seat));
     players.push({...incoming,...(removed?{x:removed.x,y:removed.y}:anchor(after,incoming,side===currentSide,ball)),task:'sub'});
    }
   }
   if(!byId(ball.ownerId))delete ball.ownerId;
   revealed=index+1;at+=.001;
   action={type:event.type,label:event.text||'Tạm dừng trận đấu',side:event.side??currentSide,playerId:event.playerId};push();
   // Whistles and cards pause the picture briefly instead of moving a removed actor.
   at+=.35;push();
  }
 }
 // Cards, injuries and AI substitutions happen after that player's action in a
 // simulation tick. Apply the authoritative final roster only after the action.
 const finalActors=actors(g,after),existing=new Map(players.map(p=>[p.id,p]));
 const rosterChanged=finalActors.length!==players.length||finalActors.some(p=>!existing.has(p.id));
 if(rosterChanged){
  const outgoing=players.filter(p=>!finalActors.some(q=>q.id===p.id));
  for(const p of outgoing){const incoming=finalActors.find(q=>q.side===p.side&&q.seat===p.seat&&!existing.has(q.id));if(incoming)existing.set(incoming.id,{...incoming,x:p.x,y:p.y,task:'sub'});}
  players=finalActors.map(p=>({...p,...(existing.get(p.id)||{...anchor(after,p,after.attack===p.side,ball),task:'sub'})}));
  if(!byId(ball.ownerId))delete ball.ownerId;
  startAction({type:'restart',label:'Cập nhật nhân sự trên sân',side:after.attack??0});
 }
 score=[...(after.score||score)];revealed=after.events?.length||revealed;
 at+=.001;push();
 return {duration:at,frames,minute:after.minute,fixtureId:after.fixtureId};
}

export function sampleMatchScene(scene,seconds){
 if(!scene?.frames?.length)return null;
 const frames=scene.frames,t=clamp(finite(seconds,0),0,scene.duration??frames.at(-1).at);
 if(t<=frames[0].at)return {...copyFrame(frames[0]),at:t};
 if(t>=frames.at(-1).at)return {...copyFrame(frames.at(-1)),at:t};
 let lo=0,hi=frames.length-1;
 while(lo+1<hi){const mid=(lo+hi)>>1;if(frames[mid].at<=t)lo=mid;else hi=mid;}
 const a=frames[lo],b=frames[hi],fraction=clamp((t-a.at)/(b.at-a.at||1),0,1);
 // Seats stay ordered for ordinary frames. Only substitutions/cards need the
 // tiny identity lookup; no Map allocation for each of the 60 paints/second.
 const players=a.players.map((p,i)=>{const q=b.players[i]?.id===p.id?b.players[i]:b.players.find(q=>q.id===p.id);return q?{...p,x:lerp(p.x,q.x,fraction),y:lerp(p.y,q.y,fraction)}:{...p};});
 const ball={...a.ball,x:lerp(a.ball.x,b.ball.x,fraction),y:lerp(a.ball.y,b.ball.y,fraction),z:lerp(a.ball.z||0,b.ball.z||0,fraction)};
 return {...a,at:t,players,ball,action:{...a.action},score:[...a.score]};
}
