import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as E from '../src/engine.mjs';
import {matchCondition,playerReadiness,recordPhysicalMatch,recoverPlayerPhysical} from '../src/playerPhysical.mjs';
import {registered} from '../src/registration.mjs';

const db=JSON.parse(readFileSync(new URL('../public/data/database.json',import.meta.url),'utf8'));
const baseline=E.newGame(db,'e83','Physical integration',120226);
const fresh=()=>structuredClone(baseline);

test('new careers initialize physical load without inventing appearances or fatigue',()=>{
 const g=fresh();
 assert.equal(g.physical.version,1);assert.equal(g.physical.startedAt,g.date);
 assert.deepEqual(g.physical.players,{});
 for(const id of g.lineup){const r=playerReadiness(g,g.players[id]);assert.equal(r.fatigue,0);assert.equal(r.minutes14,0);assert.equal(r.needsRest,false);}
 assert.equal(E.validateGame(g),true);
});

test('legacy live save gains physical tracking without rewriting fitness, RNG or match progress',()=>{
 const g=fresh();delete g.physical;
 const p=g.players[g.lineup[2]];p.fitness=61;
 let m=E.createMatch(g,E.currentFixture(g));for(let i=0;i<20;i++)m=E.tickMatch(g,m);g.liveMatch=m;
 const before=structuredClone(g),loaded=E.migrateGame(g,db);
 assert.equal(loaded.physical.version,1);assert.equal(loaded.physical.startedAt,g.date);
 assert.deepEqual(loaded.players,before.players);assert.deepEqual(loaded.lineup,before.lineup);
 assert.equal(loaded.rng,before.rng);assert.deepEqual(loaded.liveMatch,before.liveMatch);
 assert.deepEqual(g,before,'migration does not mutate the supplied old save');
 assert.deepEqual(E.migrateGame(loaded,db),loaded);assert.equal(E.validateGame(loaded),true);
});

test('official match commits physical minutes once and elapsed recovery keeps the load history',()=>{
 const g=fresh(),f=E.currentFixture(g),m=E.simulate(g,f),playedIds=Object.keys(m.minutes).filter(id=>m.minutes[id]>0);
 assert.ok(playedIds.length>=22);E.advanceRound(g,m);
 for(const id of playedIds){
  const state=g.physical.players[id],history=state?.recent.filter(item=>item.fixtureId===f.id);
  assert.equal(history?.length,1,id);assert.equal(history[0].kind,'club');
  assert.equal(history[0].minutes,m.minutes[id]);assert.equal(history[0].load,m.workload[id]);
  assert.ok(state.recoveredThrough>=f.date);assert.ok(g.players[id].fitness>=0&&g.players[id].fitness<=100);
 }
 const before=structuredClone(g.physical);assert.throws(()=>E.advanceRound(g,m));assert.deepEqual(g.physical,before);
 assert.equal(E.validateGame(g),true);
});

test('friendly substitutes accrue their actual minutes and live condition matches settled condition',()=>{
 const g=fresh(),f=E.arrangeFriendly(g,'e359');let m=E.startFriendly(g,f.id);
 for(let i=0;i<30;i++)m=E.tickMatch(g,m);
 const side=m.home===g.clubId?0:1,out=m.lineups[side].find(id=>g.players[id].position!=='GK'&&!m.red.includes(id)&&!m.injured.includes(id));
 const incoming=m.bench[side].find(id=>g.players[id].position===g.players[out].position)||m.bench[side][0];
 assert.ok(out&&incoming);const minutesAtChange=m.minutes[out];E.substitute(g,m,side,out,incoming);
 while(!m.completed)m=E.tickMatch(g,m);
 assert.equal(m.minutes[out],minutesAtChange);assert.ok(m.minutes[incoming]>0&&m.minutes[incoming]<=60);
 const expected=Object.fromEntries(Object.keys(m.minutes).filter(id=>m.minutes[id]>0).map(id=>[id,matchCondition(g,g.players[id],m)]));
 const unused=m.bench[side].find(id=>!m.minutes[id]);E.finishFriendly(g,m);
 for(const [id,fitness]of Object.entries(expected)){
  assert.equal(g.players[id].fitness,fitness,id);const history=g.physical.players[id].recent.filter(item=>item.fixtureId===f.id);
  assert.equal(history.length,1);assert.equal(history[0].kind,'friendly');assert.equal(history[0].minutes,m.minutes[id]);
  assert.equal(matchCondition(g,g.players[id],m),fitness,'finished live view does not apply the workload twice');
 }
 if(unused)assert.equal(g.physical.players[unused],undefined,'unused bench players receive no fatigue');
 const before=structuredClone(g.physical);assert.throws(()=>E.finishFriendly(g,m));assert.deepEqual(g.physical,before);
 assert.equal(E.validateGame(g),true);
});

test('injured players stop accumulating live minutes and work immediately, including before replacement',()=>{
 const g=fresh();let m=E.createMatch(g,E.currentFixture(g));for(let i=0;i<10;i++)m=E.tickMatch(g,m);
 const side=m.home===g.clubId?0:1,id=m.lineups[side].find(id=>!m.injured.includes(id)&&!m.red.includes(id)),p=g.players[id];
 m.injured.push(id);const minutes=m.minutes[id],workload=m.workload[id];
 for(let i=0;i<6;i++)m=E.tickMatch(g,m);
 assert.equal(p.injury,0,'injury settlement remains separate from the live event');
 assert.equal(m.minutes[id],minutes);assert.equal(m.workload[id],workload);
 assert.equal(playerReadiness(g,p,{live:m}).risk,'high');
 const replacement=m.bench[side][0];E.substitute(g,m,side,id,replacement);m=E.tickMatch(g,m);
 assert.equal(m.minutes[id],minutes);assert.equal(m.workload[id],workload);assert.equal(m.minutes[replacement],1);
});

test('automatic selection rotates an exhausted goalkeeper while preserving the manager manual selection',()=>{
 const g=fresh(),competitionId=E.currentFixture(g).leagueId;
 const keepers=E.clubPlayers(g,g.clubId).filter(p=>p.position==='GK'&&E.available(p)&&registered(g,p,competitionId));
 const tired=g.players[g.lineup[0]],rested=keepers.find(p=>p.id!==tired.id);
 assert.equal(tired.position,'GK');assert.ok(rested);
 tired.attributes=structuredClone(rested.attributes);tired.fitness=40;
 g.physical.players[tired.id]={fatigue:85,recent:[],recoveredThrough:g.date};
 const manual=[...g.lineup];E.repairLineup(g);assert.deepEqual(g.lineup,manual);
 const selected=E.autoLineup(g,g.clubId,g.formation,competitionId);
 assert.notEqual(selected[0],tired.id);assert.equal(g.players[selected[0]].position,'GK');assert.deepEqual(g.lineup,manual);
 const m=E.createMatch(g,E.currentFixture(g)),side=m.home===g.clubId?0:1;
 assert.deepEqual(m.lineups[side],manual,'low fitness gives a warning rather than replacing the manager choice');
 E.enablePhaseTactics(g,true);assert.notEqual(E.autoPhaseLineup(g,competitionId)[0],tired.id);
});

test('Editor full-squad recovery clears own fatigue and injuries without changing another club',()=>{
 const g=fresh(),p=g.players[g.lineup[1]],other=E.clubPlayers(g,'e359')[0];
 recordPhysicalMatch(g,{fixtureId:'recovery-fixture',date:g.date,kind:'friendly',minutes:{[p.id]:90,[other.id]:90},workload:{[p.id]:130,[other.id]:110}});
 p.injury=3;p.suspension=2;const rival={player:structuredClone(other),physical:structuredClone(g.physical.players[other.id])};
 assert.ok(playerReadiness(g,p).needsRest);E.healSquad(g);
 assert.equal(p.injury,0);assert.equal(p.suspension,0);assert.equal(p.fitness,100);
 assert.equal(playerReadiness(g,p).fatigue,0);assert.equal(playerReadiness(g,p).minutes14,0);assert.equal(playerReadiness(g,p).needsRest,false);
 assert.deepEqual(other,rival.player);assert.deepEqual(g.physical.players[other.id],rival.physical);assert.ok(g.editorUsed);
 assert.equal(E.validateGame(g),true);
});

test('Editor fitness change on an unused player starts recovery from the edit date',()=>{
 const g=fresh(),p=g.players[g.lineup[1]];g.date='2026-10-01';
 assert.equal(g.physical.players[p.id],undefined);E.editPlayer(g,p.id,{fitness:50});
 assert.equal(g.physical.players[p.id].recoveredThrough,g.date);
 recoverPlayerPhysical(g,p,'2026-10-02');
 assert.ok(p.fitness>50&&p.fitness<55,'only the day after the edit may recover, not the whole season');
 const fitness=p.fitness;recoverPlayerPhysical(g,p,'2026-10-02');assert.equal(p.fitness,fitness);
});
