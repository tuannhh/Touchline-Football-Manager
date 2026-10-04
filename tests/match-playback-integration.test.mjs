import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as E from '../src/engine.mjs';
import {createMatchPlayback,shouldPauseMatch} from '../src/matchPlayback.mjs';
import {buildMatchScene,sampleMatchScene} from '../src/matchMotion.mjs';

const db=JSON.parse(fs.readFileSync(new URL('../public/data/database.json',import.meta.url),'utf8'));
const g=E.newGame(db,'e83','Motion QA',42);
const initial=E.createMatch(g,E.currentFixture(g));
const fresh=(rng=42,minute=0)=>({...structuredClone(initial),rng,minute});
const attacks=events=>events.filter(e=>e.type==='goal'||e.type==='shot');

test('shot metadata reconciles exactly with shots, saves, goals and credited assists',()=>{
 const outcomes=new Set();
 for(const seed of [42,91,3657]){
  let before=fresh(seed);
  while(!before.completed){
   const input=JSON.stringify(before),gameRng=g.rng;
   const after=E.tickMatch(g,before),events=after.events.slice(before.events.length);
   assert.equal(JSON.stringify(before),input,'planning a tick must not change the committed minute');
   assert.equal(g.rng,gameRng,'match playback must not consume career RNG');
   for(const side of [0,1]){
    const shots=attacks(events).filter(e=>e.side===side),goals=shots.filter(e=>e.type==='goal');
    assert.equal(after.shots[side]-before.shots[side],shots.length);
    assert.equal(after.score[side]-before.score[side],goals.length);
    assert.equal(after.onTarget[side]-before.onTarget[side],shots.filter(e=>['goal','saved'].includes(e.outcome)).length);
    for(const event of shots){
     outcomes.add(event.outcome);
     assert.ok(before.lineups[side].includes(event.playerId),'actor was on the field before this minute');
     assert.ok(!before.red.includes(event.playerId)&&!before.injured.includes(event.playerId)&&!before.off.includes(event.playerId));
     if(event.type==='goal'){
      assert.equal(event.outcome,'goal');
      assert.ok(event.assistId&&event.assistId!==event.playerId);
      assert.ok(before.lineups[side].includes(event.assistId));
      assert.equal((after.assists[event.assistId]||0)-(before.assists[event.assistId]||0),1);
      assert.equal((after.goals[event.playerId]||0)-(before.goals[event.playerId]||0),1);
     }else assert.ok(['saved','wide'].includes(event.outcome));
    }
   }
   const helpers=events.filter(e=>e.type==='goal'&&e.assistId);
   assert.equal(Object.values(after.assists).reduce((a,b)=>a+b,0)-Object.values(before.assists).reduce((a,b)=>a+b,0),helpers.length);
   before=after;
  }
 }
 assert.deepEqual([...outcomes].sort(),['goal','saved','wide']);
});

test('adding playback metadata preserves the seeded pre-playback result and RNG',()=>{
 // Baselines captured from the previous engine with no assistId/outcome fields.
 // They guard against using simulation RNG to choose visual passes or shot arcs.
 const baselines=[
  {seed:42,score:[0,2],shots:[5,16],onTarget:[1,7],rng:273678926},
  {seed:91,score:[1,2],shots:[10,22],onTarget:[3,6],rng:4293959431},
  {seed:3657,score:[1,5],shots:[10,20],onTarget:[4,14],rng:1254287181},
 ];
 for(const expected of baselines){
  let m=fresh(expected.seed);while(!m.completed)m=E.tickMatch(g,m);
  for(const key of ['score','shots','onTarget','rng'])assert.deepEqual(m[key],expected[key],`${expected.seed}: ${key}`);
 }
});

test('both teams can shoot or score in one minute and their events remain ordered around substitutions',()=>{
 for(const [seed,expected] of [[37,['shot','sub','shot']],[91,['goal','sub','shot']],[3657,['goal','sub','goal']]]){
  const before=fresh(seed,61),after=E.tickMatch(g,before),events=after.events.slice(before.events.length);
  assert.deepEqual(events.map(e=>e.type),expected);
  assert.deepEqual(attacks(events).map(e=>e.side),[0,1]);
  assert.deepEqual(after.shots.map((n,i)=>n-before.shots[i]),[1,1]);
  assert.equal(events[1].type,'sub');
  assert.ok(after.lineups[0].includes(events[1].playerId));
  assert.ok(!before.lineups[0].includes(events[1].playerId));
  if(seed===91){assert.equal(after.phase,'shot');assert.deepEqual(after.score,[1,0]);}
  if(seed===3657){assert.deepEqual(events[0].score,[1,0]);assert.deepEqual(events[2].score,[1,1]);}
 }
});

test('metadata and continuation survive saving after a multi-action minute and after half time',()=>{
 for(const start of [fresh(3657,61),fresh(91,44)]){
  let a=E.tickMatch(g,start),b=JSON.parse(JSON.stringify(a));
  assert.deepEqual(b,a);
  while(!a.completed){a=E.tickMatch(g,a);b=E.tickMatch(g,b);assert.deepEqual(b,a);}
  assert.equal(a.minute,90);
  assert.equal(a.events.at(-1).type,'fulltime');
 }
});

test('old saves without event metadata retain identical future results',()=>{
 const original=E.tickMatch(g,fresh(3657,61)),legacy=structuredClone(original);
 for(const event of legacy.events){delete event.assistId;delete event.outcome;}
 let a=original,b=JSON.parse(JSON.stringify(legacy));
 const boundary=original.events.length;
 while(!a.completed){a=E.tickMatch(g,a);b=E.tickMatch(g,b);}
 assert.deepEqual(a.events.slice(boundary),b.events.slice(boundary));
 for(const key of ['score','shots','onTarget','xg','rng','lineups','bench','off','red','injured','goals','assists','minutes','workload'])assert.deepEqual(a[key],b[key],key);
});

test('a partially played scene keeps the saved minute untouched and commits its complete tick once',()=>{
 const before=fresh(3657,61),snapshot=JSON.stringify(before),expected=E.tickMatch(g,before),playback=createMatchPlayback(g,before);
 assert.equal(playback.advance(g,0),null);
 assert.equal(playback.advance(g,NaN),null);
 assert.equal(playback.hasPending(),false);
 assert.equal(playback.advance(g,.00001),null);
 assert.equal(playback.hasPending(),true);
 assert.equal(playback.current(),before);
 assert.equal(JSON.stringify(playback.current()),snapshot,'Save / Save As only sees the completed simulation minute');
 assert.deepEqual(playback.view(),expected);
 assert.deepEqual(playback.advance(g,1e6),expected);
 assert.equal(playback.hasPending(),false);
 assert.deepEqual(playback.current(),expected);
 assert.equal(playback.settle(),null,'the same minute cannot be committed a second time');
 assert.equal(JSON.stringify(before),snapshot);
});

test('dropping an unfinished scene and resuming its JSON save cannot change outcomes',()=>{
 const before=fresh(91,61),first=createMatchPlayback(g,before);
 first.advance(g,.1);
 const saved=JSON.parse(JSON.stringify(first.current()));
 const loaded=createMatchPlayback(g,saved);
 assert.equal(loaded.hasPending(),false);
 assert.deepEqual(loaded.advance(g,1e6),first.advance(g,1e6));
 assert.deepEqual(loaded.current(),E.tickMatch(g,before));
});

test('frame rate and playback speed do not alter full-time results or consume more RNG',()=>{
 const before=fresh(91,84);
 let expected=before;while(!expected.completed)expected=E.tickMatch(g,expected);
 for(const delta of [.04,.4,4]){
  const playback=createMatchPlayback(g,structuredClone(before));
  let advances=0;
  while(!playback.current().completed&&advances++<30000)playback.advance(g,delta);
  assert.ok(advances<30000,'playback must make forward progress');
  assert.deepEqual(playback.current(),expected,`step ${delta}`);
  assert.equal(playback.advance(g,10),null,'full time does not schedule a new scene');
 }
});

test('tactical changes and fast forward settle a pending minute without rerolling or restoring old players',()=>{
 const before=fresh(3657,61),playback=createMatchPlayback(g,before);
 playback.advance(g,.00001);
 const settled=playback.settle();assert.deepEqual(settled,E.tickMatch(g,before));
 const changed=structuredClone(settled),side=changed.home===g.clubId?0:1;
 const out=changed.lineups[side][5],incoming=changed.bench[side][0];
 E.substitute(g,changed,side,out,incoming);
 E.setMatchTactics(g,changed,side,{settings:{passing:'direct',transition:'counter'}});
 playback.replace(g,changed);
 assert.equal(playback.hasPending(),false);
 assert.ok(playback.current().off.includes(out));
 assert.ok(playback.current().lineups[side].includes(incoming));
 assert.deepEqual(playback.advance(g,1e6),E.tickMatch(g,changed));
 // The UI's fast-forward path settles any visual minute, then uses the same engine.
 playback.advance(g,.00001);
 let skipped=playback.settle()||playback.current(),expected=changed;
 while(!skipped.completed)skipped=E.tickMatch(g,skipped);
 while(!expected.completed)expected=E.tickMatch(g,expected);
 assert.deepEqual(skipped,expected);
 playback.replace(g,skipped);
 assert.equal(playback.advance(g,1),null);
});

test('pause boundaries include half time, extra-time intervals and own injuries anywhere in the new events',()=>{
 for(const minute of [44,89]){
  const before=fresh(91,minute),after=E.tickMatch(g,before);
  assert.equal(shouldPauseMatch(before,after,g.clubId),true);
 }
 const before=fresh(286,61),after=E.tickMatch(g,before);
 assert.ok(after.events.some(e=>e.type==='injury'&&e.side===1));
 after.events.push({minute:62,type:'tactics',text:'Later event in the same minute'});
 assert.equal(shouldPauseMatch(before,after,g.clubId),true,'injury need not be the last event');
 assert.equal(shouldPauseMatch(before,after,after.home),false,'opposition injury does not pause for the manager');
 for(const minute of [90,105]){
  const interval={...after,minute,extraTime:true,completed:false,events:before.events};
  assert.equal(shouldPauseMatch(before,interval,g.clubId),true);
 }
 const oldInjury={...after,minute:63,events:[...after.events]};
 assert.equal(shouldPauseMatch(after,oldInjury,g.clubId),false,'an already reported injury cannot stop every later minute');
});

test('scene score and revealed events follow both shots in order, including two goals in one minute',()=>{
 for(const seed of [37,91,3657]){
  const before=fresh(seed,61),after=E.tickMatch(g,before),scene=buildMatchScene(g,before,after);
  const attackEvents=attacks(after.events.slice(before.events.length));
  let previousIndex=before.events.length;
  for(const frame of scene.frames){
   assert.ok(frame.eventIndex>=previousIndex&&frame.eventIndex<=after.events.length);
   previousIndex=frame.eventIndex;
   const revealed=after.events.slice(before.events.length,frame.eventIndex);
   const score=before.score.map((n,side)=>n+revealed.filter(e=>e.type==='goal'&&e.side===side).length);
   assert.deepEqual(frame.score,score,'a score is shown only when its goal event is revealed');
   if(frame.action.type==='goal')assert.equal(revealed.filter(e=>e.type==='goal').at(-1)?.playerId,frame.action.playerId,'the goal banner names the scorer whose goal has actually been revealed');
  }
  for(const event of attackEvents){
   const shot=scene.frames.find(f=>f.action.type==='shot'&&f.action.playerId===event.playerId);
   assert.ok(shot,`missing shot by ${event.playerId}`);
   assert.ok(shot.players.some(p=>p.id===event.playerId));
   assert.equal(shot.action.outcome,event.outcome);
  }
  const final=sampleMatchScene(scene,scene.duration);
  assert.deepEqual(final.score,after.score);
  assert.equal(final.eventIndex,after.events.length);
 }
});

test('a scorer substituted in the same minute takes his shot and then leaves the rendered field',()=>{
 const before=fresh(91,61);before.minutes.e388601=61;before.workload.e388601=61;
 const after=E.tickMatch(g,before),scene=buildMatchScene(g,before,after);
 const goal=after.events[before.events.length],subIndex=before.events.length+1,sub=after.events[subIndex];
 assert.equal(goal.type,'goal');assert.equal(sub.type,'sub');assert.ok(after.off.includes(goal.playerId));
 const shot=scene.frames.find(f=>f.action.type==='shot'&&f.action.playerId===goal.playerId);
 assert.ok(shot?.players.some(p=>p.id===goal.playerId),'outgoing scorer must still perform his recorded shot');
 const end=sampleMatchScene(scene,scene.duration);
 assert.ok(!end.players.some(p=>p.id===goal.playerId));
 assert.ok(end.players.some(p=>p.id===sub.playerId));
 for(const frame of scene.frames.filter(f=>f.eventIndex>subIndex)){
  assert.ok(!frame.players.some(p=>p.id===goal.playerId),'a substituted scorer cannot defend the next action');
  assert.ok(frame.players.some(p=>p.id===sub.playerId));
 }
 const expected=after.lineups.flat().filter(id=>id&&!after.red.includes(id)&&!after.injured.includes(id)&&!after.off.includes(id)).sort();
 assert.deepEqual(end.players.map(p=>p.id).sort(),expected);
});

test('whistles and injuries are revealed after play, and injured actors leave at their event boundary',()=>{
 for(const before of [fresh(42,44),fresh(42,89),fresh(286,61)]){
  const after=E.tickMatch(g,before),scene=buildMatchScene(g,before,after);
  assert.equal(scene.frames[0].eventIndex,before.events.length,'future commentary must not appear before the scene starts');
  for(let i=before.events.length;i<after.events.length;i++){
   const event=after.events[i];if(!['injury','halftime','fulltime'].includes(event.type))continue;
   const boundary=scene.frames.find(f=>f.eventIndex>i);
   assert.ok(boundary?.at>0);
   if(event.type==='injury')for(const frame of scene.frames.filter(f=>f.eventIndex>i))assert.ok(!frame.players.some(p=>p.id===event.playerId));
  }
 }
});
