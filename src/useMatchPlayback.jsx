import {useEffect,useRef,useState,useCallback} from 'react';
import {tickMatch} from './engine.mjs';
import {createMatchPlayback,createPlaybackClock,shouldPauseMatch} from './matchPlayback.mjs';
import {createScenePlanner} from './matchSceneWorker.mjs';

export default function useMatchPlayback(g,m,onChange,notify){
 const controller=useRef(null);if(!controller.current)controller.current=createMatchPlayback(g,m);
 const latest=useRef({g,onChange,notify});latest.current={g,onChange,notify};
 const [running,updateRunning]=useState(false),[speed,updateSpeed]=useState(2);
 const playing=useRef(false),rate=useRef(2),frameRef=useRef(controller.current.frame());
 const [view,setView]=useState(()=>({match:m,frame:frameRef.current}));
 const signature=useRef('');
 const publish=(force=false)=>{
  const c=controller.current,frame=c.frame(),match=c.view();frameRef.current=frame;
  const key=[match.minute,match.completed,frame.action?.type,frame.action?.label,frame.action?.playerId,frame.action?.receiverId,frame.ball?.ownerId,frame.score?.join(':'),frame.eventIndex].join('|');
  if(force||key!==signature.current){signature.current=key;setView({match,frame});}
 };
 const setRunning=useCallback(value=>{playing.current=value;updateRunning(value);},[]);
 const setSpeed=useCallback(value=>{rate.current=value;updateSpeed(value);},[]);
 useEffect(()=>{
  if(controller.current.current()!==m){controller.current.replace(g,m);publish(true);}
 },[m]);
 useEffect(()=>{
  const planner=createScenePlanner(),c=controller.current;
  c.setPlanner(planner?.planScene||null);c.prepare(latest.current.g);
  return()=>{c.setPlanner(null);planner?.dispose();};
 },[]);
 useEffect(()=>{
  let handle;const clock=createPlaybackClock();
  const step=time=>{
   const delta=clock(time,playing.current,!document.hidden);
   if(delta>0){
    try{
     const c=controller.current,before=c.current(),{g,onChange}=latest.current;
     const committed=c.advance(g,delta*rate.current);publish();
     if(committed){onChange(committed);if(shouldPauseMatch(before,committed,g.clubId))setRunning(false);}
    }catch(error){setRunning(false);latest.current.notify(error.message||'Không thể tiếp tục trận đấu.',true);}
   }
   handle=requestAnimationFrame(step);
  };
  handle=requestAnimationFrame(step);return()=>cancelAnimationFrame(handle);
 },[]);
 const finishAction=()=>{
  setRunning(false);const committed=controller.current.settle();
  if(committed)latest.current.onChange(committed);publish(true);
  return controller.current.current();
 };
 const change=fn=>{
  const base=finishAction(),next=structuredClone(base);fn(next);
  controller.current.replace(latest.current.g,next);latest.current.onChange(next);publish(true);
 };
 const skip=()=>{
  let next=finishAction();while(!next.completed)next=tickMatch(latest.current.g,next);
  controller.current.replace(latest.current.g,next);latest.current.onChange(next);publish(true);
 };
 return {running,setRunning,speed,setSpeed,frameRef,view,change,skip,finishAction};
}
