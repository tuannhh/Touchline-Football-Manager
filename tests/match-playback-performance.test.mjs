import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Worker} from 'node:worker_threads';
import * as E from '../src/engine.mjs';
import {createMatchPlayback,createPlaybackClock} from '../src/matchPlayback.mjs';
import {buildMatchScene,restingMatchFrame,sampleMatchScene} from '../src/matchMotion.mjs';
import {sceneGamePayload,planMatchScene} from '../src/matchScenePlan.mjs';
import {createScenePlanner} from '../src/matchSceneWorker.mjs';

const db=JSON.parse(fs.readFileSync(new URL('../public/data/database.json',import.meta.url),'utf8'));
const game=E.newGame(db,'e83','Playback performance',42);
const initial=E.createMatch(game,E.currentFixture(game));
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const deferredPlanner=()=>{
 const requests=[];
 return {requests,planScene:(game,before,after,previous)=>new Promise((resolve,reject)=>requests.push({game:sceneGamePayload(game,before,after),before,after,previous,resolve,reject}))};
};
const resolve=request=>request.resolve(planMatchScene(request));

test('worker messages contain only match actors; real worker returns the identical deterministic scene',async()=>{
 const after=E.tickMatch(game,initial),previous=restingMatchFrame(game,initial);
 const compact=sceneGamePayload(game,initial,after),payload={id:1,game:compact,before:initial,after,previous};
 assert.ok(Object.keys(compact.players).length<=24);
 assert.ok(JSON.stringify(compact).length<12000,'never clone the 16,000-player career into the match worker');
 assert.deepEqual(buildMatchScene(compact,initial,after,previous),buildMatchScene(game,initial,after,previous));
 const workerURL=new URL('../src/matchScene.worker.mjs',import.meta.url).href;
 const worker=new Worker(`const {parentPort}=require('node:worker_threads');globalThis.self={postMessage:data=>parentPort.postMessage(data)};import(${JSON.stringify(workerURL)}).then(()=>{parentPort.on('message',data=>self.onmessage({data}));parentPort.postMessage({ready:true});});`,{eval:true});
 try{
  await new Promise((resolve,reject)=>{worker.once('error',reject);worker.once('message',resolve);});
  const output=new Promise((resolve,reject)=>{worker.once('error',reject);worker.once('message',resolve);});
  worker.postMessage(payload);const response=await output;
  assert.equal(response.id,1);assert.equal(response.error,undefined);
  assert.deepEqual(response.scene,buildMatchScene(game,initial,after,previous));
 }finally{await worker.terminate();}
});

test('lookahead stays speculative and does not block the next animation frame or commit paused state',async()=>{
 const planner=deferredPlanner(),playback=createMatchPlayback(game,initial,planner);
 const saved=JSON.stringify(initial),firstPicture=structuredClone(playback.frame());
 playback.prepare(game);assert.equal(playback.advance(game,.016),null);
 await flush();assert.equal(planner.requests.length,1);
 assert.equal(playback.current(),initial);assert.deepEqual(playback.frame(),firstPicture);
 resolve(planner.requests[0]);await flush();
 assert.equal(JSON.stringify(playback.current()),saved,'worker completion alone never advances a save');
 playback.advance(game,.01);await flush();assert.equal(planner.requests.length,2,'following minute plans while this minute animates');
 resolve(planner.requests[1]);await flush();
 assert.equal(playback.current(),initial,'even two ready minutes do not advance a paused simulation');
 const committed=playback.settle();assert.deepEqual(committed,E.tickMatch(game,initial));
 assert.equal(playback.settle(),null,'settle must not accidentally commit the prefetched next minute');
});

test('tactical replacement invalidates a slow worker result, including its old XI and RNG',async()=>{
 const planner=deferredPlanner(),playback=createMatchPlayback(game,initial,planner);
 playback.prepare(game);await flush();
 const changed=structuredClone(initial),side=changed.home===game.clubId?0:1;
 E.substitute(game,changed,side,changed.lineups[side][5],changed.bench[side][0]);
 E.setMatchTactics(game,changed,side,{settings:{passing:'direct'}});
 playback.replace(game,changed);playback.prepare(game);await flush();
 resolve(planner.requests[0]);await flush();
 assert.equal(playback.advance(game,.01),null);assert.equal(playback.hasPending(),false);
 resolve(planner.requests[1]);await flush();
 assert.deepEqual(playback.advance(game,1e6),E.tickMatch(game,changed));
});

test('asynchronous lookahead preserves positions at scene boundaries and full-time seeded outcomes',async()=>{
 const before={...structuredClone(initial),minute:83,rng:91};
 const playback=createMatchPlayback(game,before,{planScene:(g,b,a,p)=>Promise.resolve(buildMatchScene(sceneGamePayload(g,b,a),b,a,p))});
 let expected=before;
 while(!playback.current().completed){
  playback.prepare(game);await flush();
  const previous=structuredClone(playback.frame());
  playback.advance(game,.00001);
  const next=playback.frame();
  assert.ok(Math.hypot(previous.ball.x-next.ball.x,previous.ball.y-next.ball.y)<.001);
  for(const p of next.players){const old=previous.players.find(q=>q.id===p.id);if(old)assert.ok(Math.hypot(old.x-p.x,old.y-p.y)<.001);}
  await flush();expected=E.tickMatch(game,expected);
  assert.deepEqual(playback.advance(game,1e6),expected);
 }
 assert.deepEqual(playback.current(),expected);
});

test('worker failure falls back without re-rolling and late failures cannot discard a new plan',async()=>{
 const planner=deferredPlanner(),playback=createMatchPlayback(game,initial,planner);
 playback.prepare(game);await flush();planner.requests[0].reject(new Error('Worker disabled'));await flush();
 assert.deepEqual(playback.advance(game,1e6),E.tickMatch(game,initial));
 const other=deferredPlanner();playback.setPlanner(other.planScene);playback.prepare(game);await flush();
 const next=structuredClone(playback.current());playback.replace(game,next);playback.prepare(game);await flush();
 other.requests[0].reject(new Error('Old cancelled request'));await flush();
 resolve(other.requests[1]);await flush();
 assert.deepEqual(playback.advance(game,1e6),E.tickMatch(game,next));
});

test('paused and hidden clocks never advance or catch up on return; long stalls are bounded',()=>{
 const clock=createPlaybackClock();
 assert.equal(clock(0,true,true),0);assert.equal(clock(16,true,true),.016);
 assert.equal(clock(30000,false,true),0);assert.equal(clock(60000,true,true),0);
 assert.equal(clock(60016,true,true),.016);assert.equal(clock(60032,true,false),0);
 assert.equal(clock(960032,true,false),0);assert.equal(clock(960050,true,true),0);
 assert.equal(clock(960066,true,true),.016);assert.equal(clock(970066,true,true),.05);
});

test('sample snapshots retain independent ownership without structured clone on the render hot path',()=>{
 const after=E.tickMatch(game,initial),scene=buildMatchScene(game,initial,after),stored=structuredClone(scene);
 const original=globalThis.structuredClone;let frame;
 try{globalThis.structuredClone=()=>{throw new Error('per-frame deep clone');};frame=sampleMatchScene(scene,scene.duration*.45);}
 finally{globalThis.structuredClone=original;}
 frame.players[0].x=-99;frame.ball.x=-99;frame.action.label='Changed';frame.score[0]=99;
 assert.deepEqual(scene,stored);
});

test('an unreadable worker response rejects pending plans so playback can fall back instead of freezing',async()=>{
 const previousWorker=globalThis.Worker;let instance;
 globalThis.Worker=class{
  constructor(){instance=this;}
  postMessage(){}
  terminate(){this.closed=true;}
 };
 try{
  const planner=createScenePlanner(),after=E.tickMatch(game,initial);
  const request=planner.planScene(game,initial,after,restingMatchFrame(game,initial));
  const failure=assert.rejects(request,/unavailable/);
  instance.onmessageerror();await failure;assert.equal(instance.closed,true);
  await assert.rejects(planner.planScene(game,initial,after,null),/closed/);
 }finally{globalThis.Worker=previousWorker;}
});
