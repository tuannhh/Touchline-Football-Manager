import {applySavePayload} from './saveProtocol.mjs';
let world=null,queue=Promise.resolve();
self.onmessage=({data})=>{
 queue=queue.catch(()=>{}).then(async()=>{
  try{
   world=applySavePayload(world,data.payload);
   const response=await fetch(`/api/saves/${encodeURIComponent(world.id)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(world)});
   const result=await response.json();if(!response.ok)throw Error(result.error||'Không lưu được game.');
   self.postMessage({requestId:data.requestId,result});
  }catch(error){self.postMessage({requestId:data.requestId,error:error.message});}
 });
};
