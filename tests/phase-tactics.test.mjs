import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as E from '../src/engine.mjs';
import {FORMATION_SLOTS,createPhaseTactics,phaseLineup,phaseShape,phaseSlot,validPhaseTactics,phaseTransitionEffort,fatigueRate,phaseShapeEffects,roleFit} from '../src/tactics.mjs';
import {registered} from '../src/registration.mjs';
import {staffMembers,assignStaffTask} from '../src/staff.mjs';
const db=JSON.parse(fs.readFileSync(new URL('../public/data/database.json',import.meta.url),'utf8'));
const fresh=()=>E.newGame(db,'e83','Two phases QA',42);
const match=g=>E.createMatch(g,E.currentFixture(g));
const own=(g,m)=>m.home===g.clubId?0:1;
const ids=xs=>xs.filter(Boolean).slice().sort();

test('legacy matches retain their path and RNG until the manager explicitly enables phases',()=>{
 const g=fresh();assert.equal(g.phaseTactics,undefined);let a=match(g),b=structuredClone(a);assert.equal(a.phaseTactics,undefined);
 b.phaseTactics=[{...createPhaseTactics('4-3-3'),enabled:false},null];
 for(let i=0;i<90;i++){
  a=E.tickMatch(g,a);b=E.tickMatch(g,b);const plain=structuredClone(b);delete plain.phaseTactics;assert.deepEqual(plain,a);
 }
 const before={rng:g.rng,lineup:[...g.lineup],tactics:structuredClone(g.tactics)};E.enablePhaseTactics(g);
 assert.equal(g.rng,before.rng);assert.deepEqual(g.lineup,before.lineup);assert.deepEqual(g.tactics,before.tactics);
 for(const phase of ['inPossession','outOfPossession']){assert.equal(g.phaseTactics[phase].formation,g.formation);assert.deepEqual(phaseLineup(g.lineup,g.phaseTactics,phase),g.lineup);}
 const m=match(g),side=own(g,m);assert.deepEqual(m.phaseTactics[side],g.phaseTactics);m.phaseTactics[side].inPossession.slots.reverse();assert.notDeepEqual(m.phaseTactics[side],g.phaseTactics);
});

test('two formations and phase-specific positional swaps always contain the same XI',()=>{
 const g=fresh(),original=[...g.lineup];E.enablePhaseTactics(g);
 for(const f of Object.keys(FORMATION_SLOTS)){
  E.setPhaseFormation(g,'outOfPossession',f);assert.ok(validPhaseTactics(g.phaseTactics));
  assert.deepEqual(ids(phaseLineup(g.lineup,g.phaseTactics,'outOfPossession')),ids(original));assert.deepEqual(g.lineup,original);
 }
 const beforeIP=structuredClone(g.phaseTactics.inPossession),chosen=g.lineup[8];
 E.assignPhaseSlot(g,'outOfPossession',2,chosen);
 assert.equal(phaseLineup(g.lineup,g.phaseTactics,'outOfPossession')[2],chosen);assert.deepEqual(g.phaseTactics.inPossession,beforeIP);assert.deepEqual(g.lineup,original);
 const shape=phaseShape(g.phaseTactics,'outOfPossession');assert.deepEqual(phaseSlot(g.phaseTactics,'outOfPossession',8),FORMATION_SLOTS[shape.formation][2]);
 E.enablePhaseTactics(g,false);assert.equal(g.phaseTactics,undefined);assert.deepEqual(ids(g.lineup),ids(original));
});

test('a reserve replaces one shared seat in both prematch phase lineups',()=>{
 const g=fresh();E.enablePhaseTactics(g);E.setPhaseFormation(g,'outOfPossession','5-4-1');
 const seat=g.phaseTactics.outOfPossession.slots[4],out=g.lineup[seat],incoming=g.bench[0];E.assignPhaseSlot(g,'outOfPossession',4,incoming);
 assert.equal(g.lineup[seat],incoming);assert.ok(g.bench.includes(out));assert.ok(!g.bench.includes(incoming));
 for(const phase of ['inPossession','outOfPossession']){const lineup=phaseLineup(g.lineup,g.phaseTactics,phase);assert.ok(lineup.includes(incoming));assert.ok(!lineup.includes(out));assert.equal(new Set(lineup).size,11);}
 assert.throws(()=>E.assignPhaseSlot(g,'unknown',4,incoming));assert.throws(()=>E.assignPhaseSlot(g,'inPossession',11,incoming));
});

test('live activation, phase edits and presets preserve runtime, substitutions and dismissals',()=>{
 const g=fresh(),m=match(g),side=own(g,m);m.minute=51;E.assignMatchSlot(g,m,side,6,m.bench[side][0]);m.red.push(m.lineups[side][4]);
 const snapshot=structuredClone(m);E.enableMatchPhaseTactics(g,m,side);
 E.setMatchPhaseFormation(g,m,side,'outOfPossession','5-4-1');E.applyMatchPreset(g,m,side,'pep-city');
 for(const key of ['minute','rng','score','lineups','bench','subs','off','red','injured','workload','minutes'])assert.deepEqual(m[key],snapshot[key],key);
 assert.equal(m.phaseTactics[side].outOfPossession.formation,'5-4-1');
 const cfg=m.phaseTactics[side],red=m.red[0];assert.throws(()=>E.assignMatchPhaseSlot(g,m,side,'inPossession',2,red));assert.throws(()=>E.assignMatchPhaseSlot(g,m,side,'inPossession',2,m.off[0]));
 const redIndex=cfg.outOfPossession.slots.indexOf(m.lineups[side].indexOf(red));assert.throws(()=>E.assignMatchPhaseSlot(g,m,side,'outOfPossession',redIndex,m.bench[side][0]));
 const playing=m.lineups[side].find(id=>id!==red);E.assignMatchPhaseSlot(g,m,side,'outOfPossession',redIndex,playing);
 for(const phase of ['inPossession','outOfPossession'])assert.equal(phaseLineup(m.lineups[side],cfg,phase).filter(id=>id&&!m.red.includes(id)&&!m.off.includes(id)).length,10);
 const nextIndex=cfg.inPossession.slots.findIndex(seat=>m.lineups[side][seat]!==red),removed=phaseLineup(m.lineups[side],cfg,'inPossession')[nextIndex],incoming=m.bench[side][0];
 E.assignMatchPhaseSlot(g,m,side,'inPossession',nextIndex,incoming);assert.equal(m.subs[side],2);
 for(const phase of ['inPossession','outOfPossession']){const lineup=phaseLineup(m.lineups[side],cfg,phase);assert.ok(lineup.includes(incoming));assert.ok(!lineup.includes(removed));}
 E.enableMatchPhaseTactics(g,m,side,false);assert.equal(m.phaseTactics,undefined);assert.equal(m.lineups[side].filter(id=>!m.red.includes(id)&&!m.off.includes(id)).length,10);
 assert.throws(()=>E.enableMatchPhaseTactics(g,m,1-side));m.completed=true;assert.throws(()=>E.enableMatchPhaseTactics(g,m,side));
});

test('attacking and defensive quality use their own position suitability and affect the match',()=>{
 const g=fresh(),a=match(g),side=own(g,a);E.enableMatchPhaseTactics(g,a,side);const b=structuredClone(a);
 const ip=E.tacticalQuality(g,a,side,'inPossession'),oop=E.tacticalQuality(g,a,side,'outOfPossession');
 E.assignMatchPhaseSlot(g,b,side,'outOfPossession',9,b.lineups[side][0]);
 assert.equal(E.tacticalQuality(g,b,side,'inPossession'),ip);assert.ok(E.tacticalQuality(g,b,side,'outOfPossession')<oop);
 const aa=E.tickMatch(g,a),bb=E.tickMatch(g,b);assert.notDeepEqual(aa.possession,bb.possession);
 E.setMatchPhaseFormation(g,b,side,'outOfPossession','5-4-1');
 assert.ok(phaseShapeEffects(b.phaseTactics[side],'outOfPossession').allowed<phaseShapeEffects(b.phaseTactics[side],'inPossession').allowed);
});

test('changing possession adds bounded movement workload only to active players',()=>{
 const g=fresh(),m=match(g),side=own(g,m);E.enableMatchPhaseTactics(g,m,side);E.setMatchPhaseFormation(g,m,side,'outOfPossession','5-4-1');m.minute=20;
 let changed;for(let rng=1;rng<100&&!changed;rng++){const input=structuredClone(m);input.rng=rng;input.attack=1;const next=E.tickMatch(g,input);if(next.attack!==input.attack&&next.injured.length===0&&next.red.length===0)changed=next;}
 assert.ok(changed,'deterministic possession-change fixture');let extra=0;
 changed.lineups[side].forEach((id,seat)=>{const expected=phaseTransitionEffort(changed.phaseTactics[side],seat);assert.ok(expected>=0&&expected<=.15);assert.ok(Math.abs(changed.workload[id]-fatigueRate(changed.tactics[side])-expected)<1e-10);extra+=expected;});
 assert.ok(extra>0);assert.equal(phaseTransitionEffort(createPhaseTactics('4-3-3'),3),0);
});

test('phase tactics and an ongoing match survive reload with deterministic continuation',()=>{
 const g=fresh();E.enablePhaseTactics(g);E.setPhaseFormation(g,'inPossession','3-2-4-1');E.setPhaseFormation(g,'outOfPossession','4-1-4-1');let m=match(g),side=own(g,m);
 while(m.minute<45)m=E.tickMatch(g,m);
 const index=m.phaseTactics[side].outOfPossession.slots.findIndex(seat=>!m.red.includes(m.lineups[side][seat]));E.assignMatchPhaseSlot(g,m,side,'outOfPossession',index,m.bench[side][0]);g.liveMatch=m;
 const loaded=JSON.parse(JSON.stringify(g));assert.ok(E.validateGame(loaded));const migrated=E.migrateGame(loaded,db);assert.deepEqual(migrated.phaseTactics,g.phaseTactics);assert.deepEqual(migrated.liveMatch,m);
 let a=m,b=loaded.liveMatch;while(!a.completed)a=E.tickMatch(g,a);while(!b.completed)b=E.tickMatch(loaded,b);assert.deepEqual(a,b);
});

test('validation rejects duplicate, missing, nonnumeric or out-of-range phase seats',()=>{
 const g=fresh();E.enablePhaseTactics(g);g.liveMatch=match(g);const side=own(g,g.liveMatch);
 for(const corrupt of [x=>x.phaseTactics.inPossession.slots[1]=0,x=>x.phaseTactics.outOfPossession.slots.pop(),x=>x.phaseTactics.enabled='yes',x=>x.phaseTactics.inPossession.formation='1-1',x=>x.liveMatch.phaseTactics[side].inPossession.slots[2]='e1',x=>x.liveMatch.phaseTactics[side].outOfPossession.slots[2]=11,x=>x.liveMatch.phaseTactics.push(null)]){const bad=structuredClone(g);corrupt(bad);assert.throws(()=>E.validateGame(bad));}
});

test('quick simulation of the managed club also honors enabled dual tactics',()=>{
 const g=fresh();E.enablePhaseTactics(g);E.setPhaseFormation(g,'outOfPossession','4-1-4-1');const f=E.currentFixture(g);
 assert.deepEqual(E.simulateQuick(g,f),E.simulate(g,f));
});

test('injury repair selects a replacement for the actual phase role and keeps other seats',()=>{
 const g=fresh();E.enablePhaseTactics(g);E.setPhaseFormation(g,'inPossession','3-2-4-1');const before=[...g.lineup],seat=g.phaseTactics.inPossession.slots[8];
 assert.equal(phaseSlot(g.phaseTactics,'inPossession',seat)[0],'AM');g.players[g.lineup[seat]].injury=2;
 const role='AM',cid=E.currentFixture(g)?.leagueId,candidates=E.clubPlayers(g,g.clubId).filter(p=>!g.lineup.includes(p.id)&&E.available(p)&&registered(g,p,cid));
 candidates.sort((a,b)=>(E.overall(b)*roleFit(b,role)+b.fitness/15)-(E.overall(a)*roleFit(a,role)+a.fitness/15));
 E.repairLineup(g);assert.equal(g.lineup[seat],candidates[0].id);assert.ok(roleFit(g.players[g.lineup[seat]],role)>=.84);
 before.forEach((id,i)=>{if(i!==seat)assert.equal(g.lineup[i],id);});assert.equal(new Set(g.lineup).size,11);
});

test('assistant friendly selection maps the chosen IP players into the shared seats',()=>{
 const g=fresh();E.enablePhaseTactics(g);E.setPhaseFormation(g,'inPossession','3-2-4-1');E.setPhaseFormation(g,'outOfPossession','5-4-1');
 const expected=E.autoPhaseLineup(g,'friendly');assert.deepEqual(phaseLineup(expected,g.phaseTactics,'inPossession'),E.autoLineup(g,g.clubId,'3-2-4-1','friendly'));
 const assistant=staffMembers(g,g.clubId).find(p=>p.role==='assistant');assignStaffTask(g,'friendlies',assistant.id);
 const f=E.arrangeFriendly(g,'e86'),m=E.startFriendly(g,f.id),side=own(g,m);
 expected.forEach((id,seat)=>{if(!m.off.includes(id))assert.equal(m.lineups[side][seat],id);});assert.deepEqual(m.phaseTactics[side],g.phaseTactics);assert.ok(m.completed);
});
