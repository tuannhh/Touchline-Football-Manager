import {planMatchScene} from './matchScenePlan.mjs';

self.onmessage=({data})=>{
 try{self.postMessage({id:data.id,scene:planMatchScene(data)});}
 catch(error){self.postMessage({id:data.id,error:error.message||String(error)});}
};
