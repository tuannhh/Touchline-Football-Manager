import {saveSummary,normalizeSlotName,validateSaveMetadata} from './saveSlots.mjs';
const fail=(message,status=400)=>Object.assign(Error(message),{status});
const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9-]{1,100}$/.test(id);
const request=req=>new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
const complete=tx=>new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||Error('Lưu game bị gián đoạn.'));tx.onerror=()=>{};});
async function encode(text){
 const blob=new Blob([text],{type:'application/json'});
 if(typeof CompressionStream==='undefined')return {blob,compressed:false};
 return {blob:await new Response(blob.stream().pipeThrough(new CompressionStream('gzip'))).blob(),compressed:true};
}
async function decode(body){const value=JSON.parse(await (body.compressed?new Response(body.blob.stream().pipeThrough(new DecompressionStream('gzip'))).text():body.blob.text()));if(body.matchPatch)value.liveMatch=await decode(body.matchPatch);return value;}
const snapshotBody=row=>row?.body?{...row.body,matchPatch:row.matchPatch}:null;
const bodyBytes=body=>body?body.blob.size+(body.matchPatch?.blob.size||0):0;
export function createMobileStorage({name='touchline-careers-v1',factory=globalThis.indexedDB}={}){
 let opening;
 const db=()=>opening??=new Promise((resolve,reject)=>{if(!factory){reject(Error('Không mở được bộ nhớ ứng dụng.'));return;}const req=factory.open(name,1);req.onupgradeneeded=()=>req.result.createObjectStore('careers',{keyPath:'id'});req.onsuccess=()=>{req.result.onversionchange=()=>{req.result.close();opening=null;};resolve(req.result);};req.onerror=()=>{opening=null;reject(req.error);};});
 const read=async id=>{if(!validId(id))throw fail('Mã bản lưu không hợp lệ.');const d=await db();return request(d.transaction('careers').objectStore('careers').get(id));};
 // Optimistic revision checks protect rename/delete against the save worker.
 async function change(id,fn){
  for(let attempt=0;attempt<4;attempt++){
   const old=await read(id),next=await fn(old),d=await db(),tx=d.transaction('careers','readwrite'),done=complete(tx),store=tx.objectStore('careers');let conflict=false;
   const req=store.get(id);req.onsuccess=()=>{if(req.result?.revision!==old?.revision){conflict=true;return;}store.put({...next,id,revision:(old?.revision||0)+1});};
   try{await done;}catch(e){if(e.name==='QuotaExceededError')throw fail('Bộ nhớ không đủ. Hãy xóa bản lưu cũ hoặc giải phóng dung lượng điện thoại.',507);throw e;}
   if(!conflict)return next;
  }
  throw fail('Bản lưu vừa thay đổi. Vui lòng thử lại.',409);
 }
 return {
  async list(){const d=await db(),rows=await request(d.transaction('careers').objectStore('careers').getAll());return rows.filter(r=>!r.deleted).map(r=>({...r.meta,storageBytes:bodyBytes(snapshotBody(r))+bodyBytes(r.backup)})).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));},
  async load(id){const row=await read(id);if(!row||row.deleted)throw fail('Không tìm thấy bản lưu.',404);try{return await decode(snapshotBody(row));}catch(e){if(row.backup)return decode(row.backup);throw e;}},
  async save(g,{exclusive=false}={}){
   if(!validId(g?.id)||!g.clubs?.[g.clubId]||!g.players||!g.date)throw fail('Dữ liệu bản lưu không hợp lệ.');validateSaveMetadata(g);
   const text=JSON.stringify(g);if(new Blob([text]).size>100*1024*1024)throw fail('File lưu vượt quá 100 MB.');
   const body=await encode(text),updatedAt=new Date().toISOString(),meta=saveSummary(g,updatedAt);
   await change(g.id,old=>{if(old?.deleted)throw fail('Bản lưu này đã bị xóa.',410);if(old&&exclusive)throw fail('Bản lưu đã tồn tại.',409);return {meta,body,backup:snapshotBody(old)};});return {ok:true,savedAt:updatedAt};
  },
  async patchMatch(id,match){const matchPatch=await encode(JSON.stringify(match)),updatedAt=new Date().toISOString();await change(id,old=>{if(!old||old.deleted)throw fail('Bản lưu này đã bị xóa.',410);return {...old,matchPatch,backup:snapshotBody(old),meta:{...old.meta,updatedAt,liveMinute:match?.minute??null,liveCompleted:match?.completed??false}};});return {ok:true,savedAt:updatedAt};},
  async rename(id,name){const saveName=normalizeSlotName(name);await change(id,async old=>{if(!old||old.deleted)throw fail('Không tìm thấy bản lưu.',404);const g=await decode(snapshotBody(old));g.saveName=saveName;return {...old,body:await encode(JSON.stringify(g)),matchPatch:undefined,meta:{...old.meta,name:saveName},backup:snapshotBody(old)};});return {ok:true,name:saveName};},
  async remove(id){let freed=0;await change(id,old=>{if(!old||old.deleted)throw fail('Không tìm thấy bản lưu.',404);freed=bodyBytes(snapshotBody(old))+bodyBytes(old.backup);return {deleted:true};});return {ok:true,freedBytes:freed};},
  async close(){if(opening)(await opening).close();opening=null;},
 };
}
export const mobileStorage=createMobileStorage();
