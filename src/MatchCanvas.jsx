import React,{useEffect,useRef} from 'react';
import i18n,{translate} from './i18n.mjs';

const passActions=new Set(['pass','one-two','throughball','cross','shot']);
const taskLabels={run:'Chạy chỗ',overlap:'Chồng biên',support:'Hỗ trợ',dribble:'Dẫn bóng',press:'Áp sát',screen:'Chặn đường chuyền',mark:'Theo người',cover:'Bọc lót',keeper:'Giữ khung thành',receive:'Đón bóng',save:'Cản phá',sub:'Vào sân',shape:'Giữ vị trí',restart:'Về vị trí'};
export default function MatchCanvas({g,m,names,frameRef,showMovement=false}){
 const canvas=useRef(null),latest=useRef({g,m,names,showMovement});latest.current={g,m,names,showMovement};
 useEffect(()=>{
  const el=canvas.current,ctx=el.getContext('2d'),pitch=document.createElement('canvas'),pitchContext=pitch.getContext('2d');let animation,lastFrame=null,lastPaintKey='',pitchKey='';
  const trails=[],directions=new Map(),lastPositions=new Map(),labelWidths=new Map(),drawOrder=[];
  let width=el.clientWidth,height=el.clientHeight;
  const resize=new ResizeObserver(entries=>{width=entries[0].contentRect.width;height=entries[0].contentRect.height;});resize.observe(el);
  const render=()=>{
   const {g,m,names,showMovement}=latest.current,frame=frameRef.current;
   const dpr=Math.min(window.devicePixelRatio||1,2),w=width,h=height;
   if(document.hidden||!frame||w<60||h<60){animation=requestAnimationFrame(render);return;}
   const paintKey=[w,h,dpr,names,showMovement,i18n.language].join(':');
   if(lastFrame===frame&&lastPaintKey===paintKey){animation=requestAnimationFrame(render);return;}
   lastPaintKey=paintKey;
   if(el.width!==Math.round(w*dpr)||el.height!==Math.round(h*dpr)){el.width=Math.round(w*dpr);el.height=Math.round(h*dpr);}
   ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
   const margin=w<500?22:30,pw=w-margin*2,ph=h-margin*2,X=x=>margin+x/100*pw,Y=y=>margin+y/100*ph;
   const backgroundKey=[w,h,dpr].join(':');
   if(pitchKey!==backgroundKey){
   pitchKey=backgroundKey;pitch.width=el.width;pitch.height=el.height;
   const ctx=pitchContext;ctx.setTransform(dpr,0,0,dpr,0,0);
   ctx.fillStyle='#142b21';ctx.fillRect(0,0,w,h);
   for(let i=0;i<10;i++){ctx.fillStyle=i%2?'#28503b':'#244934';ctx.fillRect(X(i*10),Y(0),pw/10,ph);}
   ctx.strokeStyle='rgba(221,239,216,.5)';ctx.lineWidth=1.2;ctx.strokeRect(X(0),Y(0),pw,ph);
   ctx.beginPath();ctx.moveTo(X(50),Y(0));ctx.lineTo(X(50),Y(100));ctx.stroke();
   ctx.beginPath();ctx.ellipse(X(50),Y(50),pw*.087,ph*.135,0,0,Math.PI*2);ctx.stroke();
   for(const side of [0,1]){
    ctx.strokeRect(X(side===0?0:84.3),Y(20.4),pw*.157,ph*.592);
    ctx.strokeRect(X(side===0?0:94.8),Y(36.5),pw*.052,ph*.27);
    ctx.fillStyle='#d9e0d2';ctx.beginPath();ctx.arc(X(side===0?10.5:89.5),Y(50),2,0,7);ctx.fill();
    const goalX=side===0?-2:100;ctx.fillStyle='rgba(224,239,227,.08)';ctx.fillRect(X(goalX),Y(44.6),pw*.02,ph*.108);
    ctx.strokeStyle='rgba(233,245,232,.8)';ctx.strokeRect(X(goalX),Y(44.6),pw*.02,ph*.108);
    ctx.strokeStyle='rgba(221,239,216,.5)';
   }
   ctx.fillStyle='rgba(235,245,234,.6)';ctx.beginPath();ctx.arc(X(50),Y(50),2.3,0,7);ctx.fill();
   }
   ctx.drawImage(pitch,0,0,pitch.width,pitch.height,0,0,w,h);
   if(lastFrame!==frame){
    if(passActions.has(frame.action?.type)){
     const tail=trails.at(-1);if(tail&&Math.hypot(tail.x-frame.ball.x,tail.y-frame.ball.y)>30)trails.length=0;
     trails.push({...frame.ball});if(trails.length>10)trails.shift();
    }else trails.length=0;
    for(const p of frame.players){const old=lastPositions.get(p.id);if(old){const dx=p.x-old.x,dy=p.y-old.y;if(Math.hypot(dx,dy)>.015)directions.set(p.id,Math.atan2(dy*ph,dx*pw));old.x=p.x;old.y=p.y;}else lastPositions.set(p.id,{x:p.x,y:p.y});}
    lastFrame=frame;
   }
   if(trails.length>1){
    for(let i=1;i<trails.length;i++){const a=trails[i-1],b=trails[i];ctx.beginPath();ctx.moveTo(X(a.x),Y(a.y)-(a.z||0)*22);ctx.lineTo(X(b.x),Y(b.y)-(b.z||0)*22);ctx.strokeStyle=`rgba(252,244,198,${i/trails.length*.5})`;ctx.lineWidth=1+i/trails.length*1.5;ctx.stroke();}
   }
   const owner=frame.ball.ownerId||null,receiver=frame.action?.receiverId;
   drawOrder.length=frame.players.length;for(let i=0;i<frame.players.length;i++)drawOrder[i]=frame.players[i];drawOrder.sort((a,b)=>a.y-b.y);
   for(const actor of drawOrder){
    const p=g.players[actor.id];if(!p)continue;
    const x=X(actor.x),y=Y(actor.y),rad=Math.max(7,Math.min(12,pw*.014)),angle=directions.get(actor.id)??(actor.side===0?0:Math.PI);
    const keeper=actor.role==='GK';
    if(actor.id===owner||actor.id===receiver){ctx.beginPath();ctx.ellipse(x,y,rad+4,(rad+4)*.9,0,0,Math.PI*2);ctx.strokeStyle=actor.id===owner?'#d6f177':'rgba(214,241,119,.4)';ctx.lineWidth=actor.id===owner?2:1;ctx.stroke();}
    ctx.beginPath();ctx.ellipse(x+1,y+4,rad+2,rad*.66,0,0,7);ctx.fillStyle='rgba(0,0,0,.3)';ctx.fill();
    // A short direction marker makes individual turns readable even with names off.
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.beginPath();ctx.moveTo(rad+4,0);ctx.lineTo(rad-1,-3);ctx.lineTo(rad-1,3);ctx.closePath();ctx.fillStyle='rgba(255,255,255,.7)';ctx.fill();ctx.restore();
    ctx.beginPath();ctx.arc(x,y,rad,0,7);ctx.fillStyle=keeper?(actor.side===0?'#e7bc43':'#69c7c1'):actor.side===0?g.clubs[m.home].color||'#ab313f':'#e9eee4';ctx.fill();
    ctx.lineWidth=1.8;ctx.strokeStyle=actor.side===0?'#e9eddf':'#51565c';ctx.stroke();
    ctx.fillStyle=keeper||actor.side===1?'#17211b':'#fff';ctx.font=`700 ${Math.max(9,rad*.9)}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(p.number||actor.seat+1,x,y+.5);
    if(names||showMovement&&actor.task){
     ctx.font='10px system-ui';const short=p.shortName||p.name,label=showMovement&&actor.task?translate(taskLabels[actor.task]||'Giữ vị trí'):short.length>17?short.slice(0,16)+'…':short;
     let textW=labelWidths.get(label);if(textW===undefined){textW=ctx.measureText(label).width;labelWidths.set(label,textW);}ctx.fillStyle='rgba(11,25,17,.85)';ctx.fillRect(x-textW/2-3,y+rad+4,textW+6,14);ctx.fillStyle=showMovement&&actor.task?'#d6f177':'#f6f8ef';ctx.fillText(label,x,y+rad+11);
    }
   }
   const ball=frame.ball,bx=X(ball.x),groundY=Y(ball.y),height=(ball.z||0)*22;
   ctx.fillStyle='rgba(0,0,0,.35)';ctx.beginPath();ctx.ellipse(bx+1,groundY+3,4+height*.07,2.6,0,0,7);ctx.fill();
   ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(bx,groundY-height,4.1+height*.025,0,7);ctx.fill();ctx.strokeStyle='#20372a';ctx.lineWidth=.8;ctx.stroke();
   ctx.fillStyle='#253428';ctx.beginPath();ctx.arc(bx,groundY-height,1.6,0,7);ctx.fill();
   ctx.textAlign='left';ctx.fillStyle='rgba(225,238,218,.55)';ctx.font='600 9px system-ui';ctx.fillText(`${g.clubs[m.home].abbreviation||translate('CHỦ NHÀ')} →`,X(0),h-9);
   ctx.textAlign='right';ctx.fillText(`← ${g.clubs[m.away].abbreviation||translate('ĐỘI KHÁCH')}`,X(100),h-9);
   ctx.textAlign='center';ctx.fillStyle='rgba(219,232,216,.3)';ctx.fillText('TOUCHLINE / 2D',w/2,h-9);
   animation=requestAnimationFrame(render);
  };
  animation=requestAnimationFrame(render);return()=>{cancelAnimationFrame(animation);resize.disconnect();};
 },[]);
 return <canvas className="match-canvas" ref={canvas} aria-label={translate(`Sân bóng 2D, phút ${m.minute}, tỉ số ${m.score.join(' - ')}`)} role="img"/>;
}
