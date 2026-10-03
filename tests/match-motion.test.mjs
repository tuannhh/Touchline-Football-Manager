import test from 'node:test';
import assert from 'node:assert/strict';
import {buildMatchScene,restingMatchFrame,sampleMatchScene} from '../src/matchMotion.mjs';
import {createPhaseTactics} from '../src/tactics.mjs';

const ids=xs=>xs.map(p=>p.id).sort();
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function fixture(settings={}){
 const g={players:{},clubs:{home:{},away:{}}};
 const lineups=[0,1].map(side=>Array.from({length:11},(_,seat)=>{
  const id=`${side}-${seat}`;g.players[id]={id,position:seat===0?'GK':seat<5?'DF':seat<8?'MF':'FW',attributes:{pace:10+seat%5,stamina:14,decisions:12,teamwork:13,positioning:14,passing:14,crossing:13}};return id;
 }));
 g.players.sub={id:'sub',position:'MF',attributes:{pace:14,stamina:13}};
 const before={fixtureId:'test-match',home:'home',away:'away',minute:12,lineups,formation:['4-3-3','4-3-3'],tactics:[{...settings},{...settings}],attack:0,score:[0,0],shots:[0,0],onTarget:[0,0],assists:{},red:[],off:[],injured:[],events:[],rng:352123,ball:{x:48,y:44}};
 const after=structuredClone(before);after.minute++;
 return {g,before,after};
}
function freeze(o){Object.freeze(o);for(const v of Object.values(o))if(v&&typeof v==='object'&&!Object.isFrozen(v))freeze(v);return o;}
function addShot(after,side,outcome='wide',shooter=`${side}-9`){
 after.shots[side]++;const goal=outcome==='goal';if(goal){after.score[side]++;after.assists[`${side}-6`]=1;}if(goal||outcome==='saved')after.onTarget[side]++;
 after.events.push({minute:after.minute,type:goal?'goal':'shot',side,playerId:shooter,outcome,...(goal?{assistId:`${side}-6`,score:[...after.score]}:{})});
}

test('scene generation and sampling are deterministic, pure and independent of match RNG',()=>{
 const {g,before,after}=fixture({passing:'short'});addShot(after,0,'goal');
 const previous=restingMatchFrame(g,before),snapshot=structuredClone({g,before,after,previous});freeze(g);freeze(before);freeze(after);freeze(previous);
 const a=buildMatchScene(g,before,after,previous),b=buildMatchScene(g,before,after,previous);assert.deepEqual(a,b);
 assert.deepEqual({g,before,after,previous},snapshot);
 const stored=structuredClone(a),sample=sampleMatchScene(a,a.duration*.53);sample.players[0].x=-10;sample.ball.y=800;sample.score[0]=50;assert.deepEqual(a,stored);
});

test('continuous ball travel, bounded independent runs and feet-to-feet receiving',()=>{
 const {g,before,after}=fixture({passing:'short',width:5,pressing:5});addShot(after,0,'goal');addShot(after,1,'saved');
 const scene=buildMatchScene(g,before,after);let airborne=false,passSpeed=0;const tasks=new Set();
 for(let i=0;i<scene.frames.length;i++){
  const frame=scene.frames[i];for(const p of frame.players){assert.ok(p.x>=0&&p.x<=100&&p.y>=0&&p.y<=100);tasks.add(p.task);}
  assert.ok(frame.ball.z>=0&&frame.ball.z<=1);airborne||=frame.ball.z>.4;
  if(frame.ball.ownerId){const owner=frame.players.find(p=>p.id===frame.ball.ownerId);assert.ok(owner);assert.ok(dist(frame.ball,owner)<.8);}
  if(i){const prev=scene.frames[i-1],dt=frame.at-prev.at;assert.ok(dt>0,'strictly increasing keyframe time');
   assert.ok(dist(frame.ball,prev.ball)<=42*dt+.001,`ball cannot teleport (${dist(frame.ball,prev.ball)}/${dt})`);
   for(const p of frame.players){const old=prev.players.find(q=>q.id===p.id);if(old)assert.ok(dist(p,old)<=7.5*dt+.001,'player speed bounded');}
   passSpeed=Math.max(passSpeed,dist(frame.ball,prev.ball)/dt);
  }
 }
 assert.ok(airborne);assert.ok(passSpeed>20);for(const task of ['run','support','mark','cover','keeper','receive'])assert.ok(tasks.has(task),task);
 const middle=scene.frames[Math.floor(scene.frames.length/2)],first=scene.frames[0];
 const motions=new Set(middle.players.filter(p=>p.side===0).map(p=>{const old=first.players.find(q=>q.id===p.id);return `${(p.x-old.x).toFixed(1)},${(p.y-old.y).toFixed(1)}`;}));assert.ok(motions.size>8,'players do not translate as one block');
});

test('short passing produces one-twos; direct attacks produce through balls; width affects shape and crosses',()=>{
 const short=fixture({passing:'short',width:2}),direct=fixture({passing:'direct',width:2}),wide=fixture({passing:'mixed',width:5});
 assert.ok(buildMatchScene(short.g,short.before,short.after).frames.some(f=>f.action.type==='one-two'));
 assert.ok(buildMatchScene(direct.g,direct.before,direct.after).frames.some(f=>f.action.type==='throughball'));
 addShot(wide.after,0,'wide');assert.ok(buildMatchScene(wide.g,wide.before,wide.after).frames.some(f=>f.action.type==='cross'&&f.ball.z>.2));
 const a=restingMatchFrame(short.g,short.before),b=restingMatchFrame(wide.g,wide.before);
 assert.ok(b.players.find(p=>p.id==='0-8').y<a.players.find(p=>p.id==='0-8').y);
 const high=structuredClone(short.before);high.tactics[0].line=5;short.before.tactics[0].line=1;
 assert.ok(restingMatchFrame(short.g,high).players.find(p=>p.id==='0-2').x>restingMatchFrame(short.g,short.before).players.find(p=>p.id==='0-2').x+7);
});

test('phase formation seats and roles follow possession, including swapped positions',()=>{
 const {g,before}=fixture();before.phaseTactics=[createPhaseTactics('4-3-3'),null];
 before.phaseTactics[0].outOfPossession.formation='5-4-1';
 [before.phaseTactics[0].outOfPossession.slots[1],before.phaseTactics[0].outOfPossession.slots[8]]=[8,1];
 const attacking=restingMatchFrame(g,before);before.attack=1;const defending=restingMatchFrame(g,before);
 assert.equal(attacking.players.find(p=>p.id==='0-8').role,'LW');assert.equal(defending.players.find(p=>p.id==='0-8').role,'LWB');
 assert.notDeepEqual(attacking.players.find(p=>p.id==='0-8'),defending.players.find(p=>p.id==='0-8'));
});

test('each ordered shot resolves visibly and score changes only at its actual goal outcome',()=>{
 const {g,before,after}=fixture();addShot(after,0,'goal');addShot(after,1,'goal');const scene=buildMatchScene(g,before,after);
 const resolved=scene.frames.filter((f,i)=>f.action.type==='goal'&&(i===0||scene.frames[i-1].action.type!=='goal'));
 assert.equal(resolved.length,2);assert.deepEqual(resolved.map(f=>f.action.playerId),['0-9','1-9']);assert.deepEqual(resolved.map(f=>f.score),[[1,0],[1,1]]);
 assert.deepEqual(resolved.map(f=>f.eventIndex),[1,2]);assert.deepEqual(scene.frames.at(-1).score,after.score);
 assert.equal(scene.frames[0].score[0],0);assert.ok(scene.frames.some(f=>f.action.type==='restart'&&f.at>resolved[0].at));
});

test('saved and wide shots end at keeper or outside the posts; old saves infer outcomes from target totals',()=>{
 for(const outcome of ['saved','wide']){
  const {g,before,after}=fixture();addShot(after,0,outcome);delete after.events[0].outcome;
  const scene=buildMatchScene(g,before,after),resolved=scene.frames.find(f=>f.action.type===(outcome==='saved'?'save':'miss'));
  assert.ok(resolved);assert.deepEqual(resolved.score,[0,0]);
  if(outcome==='saved'){assert.equal(resolved.ball.ownerId,'1-0');assert.ok(resolved.ball.x<99);}
  else{assert.equal(resolved.ball.x,100);assert.ok(resolved.ball.y<43||resolved.ball.y>57);}
 }
});

test('a scorer acts before their substitution and does not reappear as a defender afterwards',()=>{
 const {g,before,after}=fixture();addShot(after,0,'goal');after.events.push({type:'sub',side:0,playerId:'sub',minute:13});after.lineups[0][9]='sub';after.off.push('0-9');addShot(after,1,'wide');
 const scene=buildMatchScene(g,before,after),goal=scene.frames.find(f=>f.action.type==='goal'),awayShot=scene.frames.find(f=>f.action.type==='shot'&&f.action.side===1);
 assert.ok(goal.players.some(p=>p.id==='0-9'));assert.ok(!awayShot.players.some(p=>p.id==='0-9'));assert.ok(awayShot.players.some(p=>p.id==='sub'));
 assert.deepEqual(ids(scene.frames.at(-1).players),after.lineups.flat().sort());
});

test('injury and red card events remove actors and halftime is revealed after support play',()=>{
 const {g,before,after}=fixture();after.injured=['0-6'];after.red=['1-5'];after.events=[{type:'injury',side:0,playerId:'0-6',text:'Chấn thương'},{type:'red',side:1,playerId:'1-5',text:'Thẻ đỏ'},{type:'halftime',text:'Hết hiệp một'}];
 const scene=buildMatchScene(g,before,after);assert.equal(scene.frames[0].eventIndex,0);assert.ok(scene.frames.find(f=>f.action.type==='halftime').at>5);
 const final=scene.frames.at(-1);assert.equal(final.players.length,20);assert.ok(!final.players.some(p=>['0-6','1-5'].includes(p.id)));assert.equal(final.eventIndex,3);
});

test('kickoff starts in the centre and subsequent scenes preserve the exact previous picture',()=>{
 const {g,before,after}=fixture();before.minute=0;before.ball={x:50,y:50};after.minute=1;
 const a=buildMatchScene(g,before,after);assert.deepEqual(a.frames[0].ball,{x:50,y:50,z:0});
 const next=structuredClone(after);next.minute++;next.attack=1;const last=sampleMatchScene(a,a.duration),b=buildMatchScene(g,after,next,last);
 assert.deepEqual(b.frames[0].ball,last.ball);for(const p of b.frames[0].players){const old=last.players.find(q=>q.id===p.id);assert.equal(p.x,old.x);assert.equal(p.y,old.y);}
 for(let t=-1;t<=b.duration+1;t+=.037){const frame=sampleMatchScene(b,t);for(const p of frame.players)assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));assert.ok(Number.isFinite(frame.ball.x)&&Number.isFinite(frame.ball.y)&&Number.isFinite(frame.ball.z));}
 assert.equal(sampleMatchScene(b,Infinity).at,0);assert.equal(sampleMatchScene({frames:[]},0),null);
});

test('goals restart through the centre with the conceding team, including next scene carry-over',()=>{
 const {g,before,after}=fixture();addShot(after,0,'goal');const scene=buildMatchScene(g,before,after),last=scene.frames.at(-1);assert.equal(last.restartSide,1);
 const next=structuredClone(after);next.minute++;next.attack=1;const continued=buildMatchScene(g,after,next,last);
 const kickoff=continued.frames.find(f=>f.action.type==='kickoff'&&f.ball.ownerId);
 assert.ok(kickoff);assert.equal(kickoff.action.side,1);assert.ok(dist(kickoff.ball,{x:50,y:50})<1);assert.equal(continued.frames.at(-1).restartSide,null);
 assert.ok(continued.frames.some(f=>f.action.type==='kickoff'&&f.action.receiverId),'kickoff is passed to a teammate before anyone dribbles');
});

test('wide shots yield a defending goalkeeper goal kick before play continues',()=>{
 const {g,before,after}=fixture();addShot(after,0,'wide');const scene=buildMatchScene(g,before,after),last=scene.frames.at(-1);assert.equal(last.goalKickSide,1);
 const next=structuredClone(after);next.minute++;next.attack=0;const continued=buildMatchScene(g,after,next,last),restart=continued.frames.find(f=>f.action.type==='goalkick');
 assert.equal(restart.action.side,1);assert.equal(restart.action.playerId,'1-0');assert.ok(continued.frames.some(f=>f.action.type==='goalkick'&&f.action.receiverId));assert.equal(continued.frames.at(-1).goalKickSide,null);
});

test('higher tempo sends passes faster without changing the authoritative match result',()=>{
 const slow=fixture({passing:'direct',tempo:1}),fast=fixture({passing:'direct',tempo:5});
 const velocity=scene=>Math.max(...scene.frames.slice(1).map((f,i)=>['pass','throughball'].includes(scene.frames[i].action.type)?dist(f.ball,scene.frames[i].ball)/(f.at-scene.frames[i].at):0));
 const a=buildMatchScene(slow.g,slow.before,slow.after),b=buildMatchScene(fast.g,fast.before,fast.after);assert.ok(velocity(b)>velocity(a)*1.15);assert.deepEqual(a.frames.at(-1).score,b.frames.at(-1).score);
});
