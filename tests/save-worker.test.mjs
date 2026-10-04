import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {savePayload,applySavePayload} from '../src/saveProtocol.mjs';

test('match autosaves preserve the complete career with a compact delta; world edits force a full snapshot',()=>{
 const game={id:'career-a',players:Object.fromEntries(Array.from({length:16440},(_,i)=>[i,{id:i,name:'Player '+i,attributes:{passing:12}}])),clubs:{barcelona:{cash:123456789}},messages:[{text:'Mail'}],liveMatch:{minute:10,score:[0,0],rng:19}};
 const next={...game,liveMatch:{minute:11,score:[1,0],rng:99}};
 const payload=savePayload(game,next);
 assert.equal(payload.type,'match');assert.ok(JSON.stringify(payload).length<JSON.stringify(next).length/1000);
 assert.deepEqual(applySavePayload(structuredClone(game),structuredClone(payload)),next);
 for(const changed of [{...next,clubs:{barcelona:{cash:800}}},{...next,id:'career-b'},{...next,messages:[...next.messages,{text:'New mail'}]}])assert.equal(savePayload(next,changed).type,'world');
 assert.equal(savePayload(null,next).type,'world');
 assert.throws(()=>applySavePayload(game,{type:'match',careerId:'career-b',match:null}),/current career/);
});

test('real save worker serializes A/B/A in order, retries after HTTP failure, and includes match and world fields',async()=>{
 const url=new URL('../src/save.worker.mjs',import.meta.url).href;
 const worker=new Worker(`const {parentPort}=require('node:worker_threads');let sequence=0;globalThis.self={postMessage:data=>parentPort.postMessage(data)};globalThis.fetch=async(url,options)=>{const index=++sequence;await new Promise(r=>setTimeout(r,index===1?25:1));const game=JSON.parse(options.body);parentPort.postMessage({written:{url,game,index}});return {ok:index!==2,json:async()=>index===2?{error:'Temporary failure'}:{ok:true}};};import(${JSON.stringify(url)}).then(()=>{parentPort.on('message',data=>self.onmessage({data}));parentPort.postMessage({ready:true});});`,{eval:true});
 try{
  await new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);});
  const a={id:'career-a',cash:123,liveMatch:{minute:1}},b={id:'career-b',cash:456,liveMatch:{minute:3}},a2={...a,liveMatch:{minute:2}},a3={...a,liveMatch:{minute:4}};
  const writes=[],results=[];
  const complete=new Promise((resolve,reject)=>{worker.on('error',reject);worker.on('message',data=>{if(data.written)writes.push(data.written);else{results.push(data);if(results.length===5)resolve();}});});
  const snapshots=[a,a2,b,a2,a3];let previous=null;
  snapshots.forEach((game,i)=>{worker.postMessage({requestId:i+1,payload:savePayload(previous,game)});previous=game;});
  await complete;
  assert.deepEqual(writes.map(x=>x.game),snapshots);assert.deepEqual(writes.map(x=>x.index),[1,2,3,4,5]);
  assert.equal(results[1].error,'Temporary failure');assert.equal(results[4].result.ok,true);
 }finally{await worker.terminate();}
});

test('unavailable browser workers fall back to ordered full saves instead of losing the career',async()=>{
 const previousWorker=globalThis.Worker,previousFetch=globalThis.fetch,writes=[];
 globalThis.Worker=class{constructor(){throw Error('Worker blocked');}};
 globalThis.fetch=async(url,options)=>{const snapshot=JSON.parse(options.body);await new Promise(resolve=>setTimeout(resolve,snapshot.liveMatch.minute===1?10:0));writes.push(snapshot);return {ok:true,json:async()=>({ok:true})};};
 try{
  const {persistCareer}=await import('../src/saveClient.mjs?fallback-test');
  await Promise.all([persistCareer({id:'one',liveMatch:{minute:1}}),persistCareer({id:'one',liveMatch:{minute:2}})]);
  assert.deepEqual(writes.map(g=>g.liveMatch.minute),[1,2]);
 }finally{globalThis.Worker=previousWorker;globalThis.fetch=previousFetch;}
});

test('deleted-slot errors preserve HTTP status through the worker and direct fallback',async()=>{
 const url=new URL('../src/save.worker.mjs',import.meta.url).href;
 const worker=new Worker(`const {parentPort}=require('node:worker_threads');globalThis.self={postMessage:data=>parentPort.postMessage(data)};globalThis.fetch=async()=>({ok:false,status:410,json:async()=>({error:'Deleted slot'})});import(${JSON.stringify(url)}).then(()=>{parentPort.on('message',data=>self.onmessage({data}));parentPort.postMessage({ready:true});});`,{eval:true});
 try{
  await new Promise((resolve,reject)=>{worker.once('error',reject);worker.once('message',resolve);});
  const response=new Promise((resolve,reject)=>{worker.once('error',reject);worker.once('message',resolve);});
  worker.postMessage({requestId:1,payload:savePayload(null,{id:'deleted-career',liveMatch:null})});
  assert.deepEqual(await response,{requestId:1,error:'Deleted slot',errorStatus:410});
 }finally{await worker.terminate();}
 const beforeFetch=globalThis.fetch,beforeWorker=globalThis.Worker;
 try{
  globalThis.Worker=undefined;globalThis.fetch=async()=>({ok:false,status:410,json:async()=>({error:'Deleted slot'})});
  const {persistCareer}=await import('../src/saveClient.mjs?deleted-direct-test');
  await assert.rejects(persistCareer({id:'deleted-career',liveMatch:null}),error=>error.status===410&&error.message==='Deleted slot');
 }finally{globalThis.fetch=beforeFetch;globalThis.Worker=beforeWorker;}
});

test('save-as can rescue a deleted career, while connection and disk errors still block switching',async()=>{
 const {saveBeforeSwitch}=await import('../src/saveClient.mjs');
 let copies=0;await saveBeforeSwitch(async()=>{throw Object.assign(Error('Deleted slot'),{status:410});});copies++;
 assert.equal(copies,1);
 for(const status of [400,403,500,undefined])await assert.rejects(saveBeforeSwitch(async()=>{throw Object.assign(Error('Cannot save'),{status});}),/Cannot save/);
 await saveBeforeSwitch(async()=>({ok:true}));
});
