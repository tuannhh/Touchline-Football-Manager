import {createAssessmentRefresh} from './src/assessmentRefresh.mjs';
import http from 'node:http';
import { readFile, readdir, stat, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validateGame } from './src/engine.mjs';
import { mergePortraits } from './src/portraits.mjs';
import {listRosterReleases,loadRosterRelease} from './src/rosterReleases.mjs';
import {saveSummary,normalizeSlotName,validateSaveMetadata} from './src/saveSlots.mjs';
import {saveStorageBytes,readSaveSnapshot,writeSaveSnapshot,deleteSaveSnapshot} from './src/saveStorage.mjs';

const root=path.dirname(fileURLToPath(import.meta.url));
const assessmentRefresh=createAssessmentRefresh({root});
const saves=process.env.TOUCHLINE_SAVE_DIR||path.join(root,'saves');
await mkdir(saves,{recursive:true});
const port=Number(process.env.PORT||4179);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.avif':'image/avif','.svg':'image/svg+xml','.woff2':'font/woff2'};
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
let writeQueue=Promise.resolve();
let portraitStamp=0,portraits={players:[]};
async function portraitData(){
 const file=path.join(root,'public/data/portraits.json');
 try{const s=await stat(file);if(s.mtimeMs!==portraitStamp){portraits=JSON.parse(await readFile(file,'utf8'));portraitStamp=s.mtimeMs;}}catch(e){if(e.code!=='ENOENT')console.warn('Portrait index unavailable:',e.message);}
 return portraits;
}
async function refreshPortraits(g){mergePortraits(g,await portraitData());return g;}
async function body(req){let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>100*1024*1024)throw Error('File lưu vượt quá giới hạn 100 MB.');chunks.push(chunk);}return JSON.parse(Buffer.concat(chunks).toString());}
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1');
  if(req.headers.host&&!['127.0.0.1','localhost','[::1]'].some(h=>req.headers.host===`${h}:${port}`||req.headers.host===h))return json(res,403,{error:'Local access only'});
  if(req.method!=='GET'&&req.headers.origin&&!new Set(['http://127.0.0.1:'+port,'http://localhost:'+port,'http://127.0.0.1:5179','http://localhost:5179']).has(req.headers.origin))return json(res,403,{error:'Origin is not allowed'});
  if(url.pathname==='/api/health')return json(res,200,{ok:true,name:'Touchline',version:3,appVersion:'1.17.0'});
  if(url.pathname==='/api/player-assessments/refresh'&&req.method==='GET')return json(res,200,assessmentRefresh.status());
  if(url.pathname==='/api/player-assessments/refresh'&&req.method==='POST')return json(res,202,assessmentRefresh.start());
  if(url.pathname==='/data/player-reality.json'&&req.method==='GET')return json(res,200,JSON.parse(await readFile(path.join(root,'public/data/player-reality.json'),'utf8')));
  if(url.pathname==='/api/roster-releases'&&req.method==='GET')return json(res,200,await listRosterReleases({rootDir:root}));
  const roster=url.pathname.match(/^\/api\/roster-releases\/([a-zA-Z0-9-]{1,100})$/);
  if(roster&&req.method==='GET')return json(res,200,await loadRosterRelease(roster[1],{rootDir:root}));
  if(url.pathname==='/data/portraits.json'&&req.method==='GET')return json(res,200,await portraitData());
  if(url.pathname==='/api/saves'&&req.method==='GET'){
    const files=(await readdir(saves)).filter(f=>/^[\w-]+\.json$/.test(f));const entries=[];
    for(const f of files){try{const id=f.slice(0,-5),{game:g,updatedAt}=await readSaveSnapshot(saves,id);if(g.id!==id)continue;entries.push({...saveSummary(g,updatedAt),storageBytes:await saveStorageBytes(saves,id)});}catch{}}
    return json(res,200,entries.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)));
  }
  const match=url.pathname.match(/^\/api\/saves\/([a-zA-Z0-9-]{1,100})$/);
  if(match){const id=match[1];
    if(req.method==='GET'){const {game}=await readSaveSnapshot(saves,id);return json(res,200,await refreshPortraits(game));}
    if(req.method==='PUT'||req.method==='POST'){
      const g=await refreshPortraits(await body(req));validateGame(g);validateSaveMetadata(g);if(g.id!==match[1])return json(res,400,{error:'Save ID mismatch'});
      const serialized=JSON.stringify(g);const write=writeQueue.catch(()=>{}).then(()=>writeSaveSnapshot(saves,id,serialized,{exclusive:req.method==='POST'}));writeQueue=write;await write;return json(res,200,{ok:true,savedAt:new Date().toISOString()});
    }
    if(req.method==='PATCH'){
      const input=await body(req);if(!input||Object.keys(input).some(k=>k!=='name'))throw Error('Chỉ đổi tên bản lưu ở thao tác này.');
      const name=normalizeSlotName(input.name);const write=writeQueue.catch(()=>{}).then(async()=>{const {game:g}=await readSaveSnapshot(saves,id);g.saveName=name;validateGame(g);validateSaveMetadata(g);await writeSaveSnapshot(saves,id,JSON.stringify(g));});writeQueue=write;await write;return json(res,200,{ok:true,name});
    }
    if(req.method==='DELETE'){
      const write=writeQueue.catch(()=>{}).then(()=>deleteSaveSnapshot(saves,id));writeQueue=write;return json(res,200,await write);
    }
  }
  if(url.pathname.startsWith('/api/'))return json(res,404,{error:'Not found'});
  if(req.method!=='GET'&&req.method!=='HEAD')return json(res,405,{error:'Method not allowed'});
  const decoded=decodeURIComponent(url.pathname);const dist=/^\/portraits\/real-[a-f0-9]{24}\.(?:png|jpg|webp|avif)$/.test(decoded)?path.join(root,'public'):path.join(root,'dist');let file=path.resolve(dist,'.'+decoded);
  if(!file.startsWith(dist+path.sep))file=path.join(dist,'index.html');
  let buffer;try{buffer=await readFile(file);}catch{if(path.extname(decoded))return json(res,404,{error:'File not found'});file=path.join(dist,'index.html');buffer=await readFile(file);}
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':decoded.startsWith('/assets/')?'public,max-age=31536000,immutable':'no-cache','Content-Security-Policy':"default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'"});res.end(req.method==='HEAD'?undefined:buffer);
 }catch(error){json(res,error.status||400,{error:error.message});}
});
server.listen(port,'127.0.0.1',()=>console.log(`Touchline is running at http://127.0.0.1:${port}\nSaves: ${saves}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{assessmentRefresh.stop();server.close(async()=>{await writeQueue.catch(()=>{});process.exit(0);});server.closeIdleConnections();});
