import {sceneGamePayload} from './matchScenePlan.mjs';

export function createScenePlanner(){
 if(typeof Worker==='undefined')return null;
 let worker;
 try{worker=new Worker(new URL('./matchScene.worker.mjs',import.meta.url),{type:'module'});}
 catch{return null;}
 const pending=new Map();let serial=0,closed=false;
 const rejectAll=error=>{for(const request of pending.values())request.reject(error);pending.clear();};
 worker.onmessage=({data})=>{
  const request=pending.get(data.id);if(!request)return;pending.delete(data.id);
  if(data.error)request.reject(new Error(data.error));else request.resolve(data.scene);
 };
 worker.onerror=()=>{closed=true;rejectAll(new Error('Match scene worker unavailable'));worker.terminate();};
 worker.onmessageerror=worker.onerror;
 return {
  planScene(game,before,after,previous){
   if(closed)return Promise.reject(new Error('Match scene planner closed'));
   const id=++serial;
   return new Promise((resolve,reject)=>{
    pending.set(id,{resolve,reject});
    try{worker.postMessage({id,game:sceneGamePayload(game,before,after),before,after,previous});}
    catch(error){pending.delete(id);reject(error);}
   });
  },
  dispose(){closed=true;worker.terminate();rejectAll(new Error('Match scene planner closed'));},
 };
}
