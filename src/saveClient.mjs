import {savePayload} from './saveProtocol.mjs';
let worker=null,previous=null,serial=0,workerDisabled=false,directQueue=Promise.resolve();
const requests=new Map();
function directSave(snapshot){
 const task=directQueue.catch(()=>{}).then(async()=>{
  const response=await fetch(`/api/saves/${encodeURIComponent(snapshot.id)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(snapshot)});
  const result=await response.json();if(!response.ok)throw Object.assign(Error(result.error||'Không lưu được game.'),{status:response.status});return result;
 });
 directQueue=task;return task;
}
function disableWorker(){
 workerDisabled=true;worker?.terminate();worker=null;previous=null;
 // Keep the same ordering if an unsupported worker needs a one-time fallback.
 for(const task of requests.values())directSave(task.snapshot).then(task.resolve,task.reject);
 requests.clear();
}
function saveWorker(){
 if(!worker){
  worker=new Worker(new URL('./save.worker.mjs',import.meta.url),{type:'module'});
  worker.onmessage=({data})=>{const task=requests.get(data.requestId);if(!task)return;requests.delete(data.requestId);if(data.error)task.reject(Object.assign(Error(data.error),{status:data.errorStatus}));else task.resolve(data.result);};
  worker.onerror=disableWorker;
  worker.onmessageerror=disableWorker;
 }
 return worker;
}
export function persistCareer(snapshot){
 if(workerDisabled||typeof Worker==='undefined')return directSave(snapshot);
 return new Promise((resolve,reject)=>{
  const requestId=++serial;
  try{const target=saveWorker(),payload=savePayload(previous,snapshot);requests.set(requestId,{resolve,reject,snapshot});target.postMessage({requestId,payload});previous=snapshot;}
  catch(error){requests.delete(requestId);disableWorker();directSave(snapshot).then(resolve,reject);}
 });
}

// A slot explicitly deleted in another tab can be rescued under a new identity.
// Other write failures still block navigation/copying to protect unsaved progress.
export async function saveBeforeSwitch(save){
 try{await save();}catch(error){if(error.status!==410)throw error;}
}
