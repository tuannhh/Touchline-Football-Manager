import {OFFLINE_APP} from './platform.mjs';
import {mobileStorage} from './mobileStorage.mjs';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
export async function gameFetch(url,options={}){
 if(!OFFLINE_APP||!String(url).startsWith('/api/'))return fetch(url,options);
 try{
  const method=options.method||'GET';
  if(url==='/api/roster-releases')return fetch('/data/mobile-releases.json');
  if(url.startsWith('/api/roster-releases/')){
   const id=url.slice('/api/roster-releases/'.length);if(!/^[a-zA-Z0-9-]{1,100}$/.test(id))return json({error:'Invalid release'},400);
   const files=await Promise.all(['release','database','homegrown'].map(async name=>{const r=await fetch(`/data/releases/${id}/${name}.json`);if(!r.ok)throw Error('Không đọc được dữ liệu đội hình.');return r.json();}));
   return json({release:files[0],database:files[1],homegrown:files[2]});
  }
  if(url==='/api/player-assessments/refresh')return json(method==='GET'?{status:'offline'}:{error:'Dữ liệu mới được cung cấp qua bản cập nhật ứng dụng.'},method==='GET'?200:409);
  if(url==='/api/saves'&&method==='GET')return json(await mobileStorage.list());
  const match=String(url).match(/^\/api\/saves\/([a-zA-Z0-9-]{1,100})$/);
  if(match){const id=match[1];if(method==='GET')return json(await mobileStorage.load(id));if(method==='DELETE')return json(await mobileStorage.remove(id));const body=JSON.parse(options.body);if(method==='PATCH')return json(await mobileStorage.rename(id,body.name));if(['PUT','POST'].includes(method)){if(body.id!==id)throw Error('Save ID mismatch');return json(await mobileStorage.save(body,{exclusive:method==='POST'}));}}
  return json({error:'Not found'},404);
 }catch(error){return json({error:error.message},error.status||400);}
}
