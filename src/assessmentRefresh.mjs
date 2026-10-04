// Local, explicitly requested source refresh. It can only run the bundled
// importer: request bodies cannot provide commands, paths or remote addresses.
import {spawn} from 'node:child_process';
import {execPath} from 'node:process';
import {readFile} from 'node:fs/promises';
import path from 'node:path';

export function vietnamDate(now=new Date()){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const get=key=>parts.find(p=>p.type===key).value;
 return `${get('year')}-${get('month')}-${get('day')}`;
}
export function createAssessmentRefresh({root,launch=spawn,read=readFile,now=()=>new Date(),timeoutMs=20*60*1000}={}){
 let child=null,timer=null;
 let state={status:'idle',startedAt:null,finishedAt:null,detail:'',error:null,summary:null};
 const status=()=>structuredClone(state);
 const finish=(error,summary)=>{clearTimeout(timer);timer=null;child=null;state={...state,status:error?'error':'complete',finishedAt:now().toISOString(),error:error||null,detail:'',summary:summary||null};};
 function start(){
  if(state.status==='running')return status();
  state={status:'running',startedAt:now().toISOString(),finishedAt:null,detail:'Đang đối chiếu nguồn cầu thủ; quá trình có thể mất vài phút.',error:null,summary:null};
  let childProcess;
  try{childProcess=launch(execPath,[path.join(root,'scripts/import-player-reality.mjs'),'--refresh-profiles','--profile-limit','100','--as-of',vietnamDate(now())],{cwd:root,stdio:['ignore','pipe','pipe'],shell:false});child=childProcess;}
  catch{finish('Không khởi động được cập nhật nguồn cầu thủ.');return status();}
  let completed=false;
  const fail=message=>{if(completed)return;completed=true;finish(message);};
  // Drain progress without publishing arbitrary provider/process output to HTML.
  childProcess.stdout?.on('data',()=>{});childProcess.stderr?.on('data',()=>{});
  childProcess.once('error',()=>fail('Không khởi động được cập nhật nguồn cầu thủ.'));
  childProcess.once('close',async code=>{
   if(completed)return;
   if(code!==0){fail('Không cập nhật được nguồn. Bộ dữ liệu đã cài vẫn được giữ lại.');return;}
   try{
    const snapshot=JSON.parse(await read(path.join(root,'public/data/player-reality.json'),'utf8'));
    if(snapshot.version!==1||!snapshot.coverage||!snapshot.players)throw Error('Invalid snapshot');
    if(completed)return;completed=true;finish(null,snapshot.coverage);
   }catch{fail('Không đọc được kết quả cập nhật nguồn cầu thủ.');}
  });
  timer=setTimeout(()=>{childProcess.kill('SIGTERM');fail('Cập nhật nguồn quá thời gian. Bạn có thể thử lại sau.');},timeoutMs);timer.unref?.();
  return status();
 }
 function stop(){if(child){child.kill('SIGTERM');clearTimeout(timer);child=null;}}
 return {start,status,stop};
}
