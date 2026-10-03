import {tickMatch} from './engine.mjs';
import {buildMatchScene,restingMatchFrame,sampleMatchScene} from './matchMotion.mjs';

// The scene is a deterministic view of one simulation minute. Only a completed
// scene advances the saved match; rendering and playback speed never draw RNG.
export function createMatchPlayback(g,initial,{planScene=null}={}){
 let current=initial,pending=null,planned=null,generation=0,planner=planScene,frame=restingMatchFrame(g,initial);
 const invalidate=()=>{generation++;planned=null;};
 const prepare=game=>{
  if(!planner)return;
  const before=pending?.after||current;
  if(before.completed||planned?.before===before)return;
  const after=tickMatch(game,before),previous=pending?.scene.frames.at(-1)||frame;
  const request={before,after,scene:null,generation};planned=request;
  // Preparing a visual minute is speculative. Its RNG/state is not published
  // until playback reaches the end, including when paused or the tab is hidden.
  Promise.resolve().then(()=>planner(game,before,after,previous)).then(scene=>{
   if(request.generation===generation&&planned===request)request.scene=scene;
  }).catch(()=>{
   if(request.generation!==generation||planned!==request)return;
   // A disabled/unavailable worker must not make the match unplayable.
   planner=null;invalidate();
  });
 };
 const commit=()=>{
  if(!pending)return null;
  frame=sampleMatchScene(pending.scene,pending.scene.duration);
  current=pending.after;pending=null;return current;
 };
 return {
  current:()=>current,
  frame:()=>frame,
  view:()=>pending?.after||current,
  hasPending:()=>!!pending,
  prepare,
  setPlanner(next){planner=next;invalidate();},
  advance(game,seconds){
   if(current.completed||!Number.isFinite(seconds)||seconds<=0)return null;
   if(!pending){
    if(planner){
     prepare(game);if(!planned?.scene)return null;
     pending={after:planned.after,scene:planned.scene,elapsed:0};planned=null;prepare(game);
    }else{const after=tickMatch(game,current);pending={after,scene:buildMatchScene(game,current,after,frame),elapsed:0};}
   }
   pending.elapsed=Math.min(pending.scene.duration,pending.elapsed+seconds);
   frame=sampleMatchScene(pending.scene,pending.elapsed);
   return pending.elapsed>=pending.scene.duration?commit():null;
  },
  settle:commit,
  replace(game,match){invalidate();current=match;pending=null;frame=restingMatchFrame(game,match);return frame;},
 };
}

// Reset the clock while inactive, so coming back from another tab (or a long
// pause) does not fast-forward the players to catch up with wall-clock time.
export function createPlaybackClock(){
 let previous=null;
 return (time,playing,visible)=>{
  if(!playing||!visible||!Number.isFinite(time)){previous=null;return 0;}
  const delta=previous===null?0:Math.min(.05,Math.max(0,(time-previous)/1000));previous=time;return delta;
 };
}

export function shouldPauseMatch(before,after,clubId){
 const own=after.home===clubId?0:1;
 return after.completed||after.minute===45||after.extraTime&&[90,105].includes(after.minute)
  ||after.events.slice(before.events.length).some(e=>e.type==='injury'&&e.side===own);
}
