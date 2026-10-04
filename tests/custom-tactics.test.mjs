import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as E from '../src/engine.mjs';
import {FORMATION_SLOTS,createPhaseTactics,validPhaseTactics,phasePositions,phaseSlot,phasePlayerRole,phaseLineup,hasCustomPhaseTactics,editTacticalPosition,editTacticalRole,validTacticalPositions,phaseShapeEffects} from '../src/tactics.mjs';
import {PLAYER_ROLES,defaultPlayerRole,rolesForPosition,validPlayerRole,playerRoleFit} from '../src/playerRoles.mjs';
import {registered} from '../src/registration.mjs';
const db=JSON.parse(fs.readFileSync(new URL('../public/data/database.json',import.meta.url),'utf8'));
const fresh=()=>E.newGame(db,'e83','Custom positions QA',731);
const own=(g,m)=>m.home===g.clubId?0:1;

test('the same 4-3-3 eleven can become CM-CM-CAM without changing its personnel',()=>{
 const g=fresh(),before=structuredClone({lineup:g.lineup,bench:g.bench,rng:g.rng});
 E.setTacticalPosition(g,'inPossession',5,{position:'CM'});
 E.setTacticalPosition(g,'inPossession',6,{position:'CM',x:30,y:43});
 E.setTacticalPosition(g,'inPossession',7,{position:'AM',x:65,y:29});
 assert.deepEqual(phasePositions(g.phaseTactics,'inPossession').slice(5,8).map(p=>p[0]),['CM','CM','AM']);
 assert.deepEqual(phasePositions(g.phaseTactics,'outOfPossession').slice(5,8).map(p=>p[0]),['DM','CM','CM']);
 assert.equal(g.formation,'4-3-3');assert.deepEqual({lineup:g.lineup,bench:g.bench,rng:g.rng},before);
 assert.equal(phaseSlot(g.phaseTactics,'inPossession',7)[0],'AM');assert.ok(E.validateGame(g));
});

test('each supported position has compatible IP and OOP roles, with no legacy duties',()=>{
 assert.equal(new Set(PLAYER_ROLES.map(r=>r.id)).size,PLAYER_ROLES.length);
 for(const position of new Set(Object.values(FORMATION_SLOTS).flat().map(p=>p[0])))for(const phase of ['inPossession','outOfPossession']){
  assert.ok(rolesForPosition(position,phase).length);assert.ok(validPlayerRole(defaultPlayerRole(position,phase),position,phase));
 }
 assert.ok(rolesForPosition('LB','inPossession').some(r=>r.id==='inside-full-back'));
 assert.ok(rolesForPosition('LB','inPossession').some(r=>r.id==='inside-wing-back'));
 assert.ok(rolesForPosition('LB','outOfPossession').some(r=>r.id==='holding-full-back'));
 assert.ok(PLAYER_ROLES.every(r=>!Object.hasOwn(r,'duty')));
});

test('role choices use phase indices and follow tactical seats across substitutions',()=>{
 const g=fresh();E.setTacticalRole(g,'inPossession',1,'inside-wing-back');
 E.assignPhaseSlot(g,'inPossession',1,g.lineup[4]);
 assert.equal(phasePlayerRole(g.phaseTactics,'inPossession',4),'inside-wing-back');
 assert.equal(phaseSlot(g.phaseTactics,'inPossession',4)[0],'LB');
 const incoming=g.bench[0],outgoing=g.lineup[4];E.assignPhaseSlot(g,'inPossession',1,incoming);
 assert.equal(phaseLineup(g.lineup,g.phaseTactics,'inPossession')[1],incoming);
 assert.equal(phasePlayerRole(g.phaseTactics,'inPossession',4),'inside-wing-back');
 assert.ok(!phaseLineup(g.lineup,g.phaseTactics,'outOfPossession').includes(outgoing));
 E.setTacticalPosition(g,'inPossession',1,{position:'CM',x:24,y:50});
 assert.equal(phasePlayerRole(g.phaseTactics,'inPossession',4),'central-midfielder');
});

test('invalid first edits never activate phases or partially change the game',()=>{
 const g=fresh(),before=JSON.stringify(g);
 const attempts=[()=>E.setTacticalPosition(g,'missing',5,{position:'CM'}),()=>E.setTacticalPosition(g,'inPossession',11,{position:'CM'}),()=>E.setTacticalPosition(g,'inPossession',0,{position:'ST'}),()=>E.setTacticalPosition(g,'inPossession',0,{x:51}),()=>E.setTacticalPosition(g,'inPossession',4,{position:'GK'}),()=>E.setTacticalPosition(g,'inPossession',6,{x:50,y:55}),()=>E.setTacticalPosition(g,'inPossession',6,{x:NaN}),()=>E.setTacticalPosition(g,'inPossession',6,{x:'30'}),()=>E.setTacticalPosition(g,'inPossession',6,{x:null}),()=>E.setTacticalPosition(g,'inPossession',6,{}),()=>E.setTacticalRole(g,'outOfPossession',1,'wing-back'),()=>E.setTacticalRole(g,'inPossession',5,'wing-back')];
 for(const attempt of attempts){assert.throws(attempt);assert.equal(JSON.stringify(g),before);}
});

test('temporary disable preserves custom geometry and roles; resets are explicit and phase-local',()=>{
 const g=fresh();E.setTacticalPosition(g,'inPossession',5,{position:'CM'});E.setTacticalRole(g,'outOfPossession',1,'holding-full-back');
 const before=structuredClone(g.phaseTactics),lineup=[...g.lineup];E.enablePhaseTactics(g,false);
 assert.equal(g.phaseTactics.enabled,false);assert.deepEqual(phasePositions(g.phaseTactics,'inPossession'),FORMATION_SLOTS[g.formation]);
 assert.deepEqual(g.phaseTactics.inPossession,before.inPossession);assert.deepEqual(g.lineup,lineup);
 const invalidBefore=JSON.stringify(g);assert.throws(()=>E.setTacticalRole(g,'inPossession',1,'unknown'));assert.equal(JSON.stringify(g),invalidBefore);
 const m=E.createMatch(g,E.currentFixture(g));assert.equal(m.phaseTactics[own(g,m)].enabled,false);
 E.enablePhaseTactics(g,true);assert.deepEqual(g.phaseTactics,before);
 E.resetTacticalPositions(g,'inPossession');assert.equal(g.phaseTactics.inPossession.positions,undefined);assert.deepEqual(g.phaseTactics.outOfPossession,before.outOfPossession);
 E.setPhaseFormation(g,'outOfPossession','5-4-1');assert.equal(g.phaseTactics.outOfPossession.roles,undefined);assert.equal(hasCustomPhaseTactics(g.phaseTactics),false);
});

test('match position and role edits preserve the club template, minute and substitution bookkeeping',()=>{
 const g=fresh();E.setTacticalRole(g,'inPossession',1,'inside-full-back');const clubTemplate=structuredClone(g.phaseTactics);
 const m=E.createMatch(g,E.currentFixture(g)),side=own(g,m);m.minute=53;
 E.assignMatchSlot(g,m,side,6,m.bench[side][0]);m.red.push(m.lineups[side][4]);
 const protectedKeys=['minute','rng','score','lineups','bench','subs','off','red','injured','workload','minutes'],before=Object.fromEntries(protectedKeys.map(k=>[k,structuredClone(m[k])]));
 E.setMatchTacticalPosition(g,m,side,'inPossession',7,{position:'AM',x:65,y:29});E.setMatchTacticalRole(g,m,side,'inPossession',1,'wing-back');
 assert.deepEqual(g.phaseTactics,clubTemplate);for(const key of protectedKeys)assert.deepEqual(m[key],before[key]);
 assert.equal(phasePlayerRole(m.phaseTactics[side],'inPossession',1),'wing-back');assert.equal(phaseSlot(m.phaseTactics[side],'inPossession',7)[0],'AM');
 const changed=JSON.stringify(m);assert.throws(()=>E.setMatchTacticalRole(g,m,1-side,'inPossession',1,'wing-back'));assert.equal(JSON.stringify(m),changed);
 E.enableMatchPhaseTactics(g,m,side,false);assert.equal(m.phaseTactics[side].enabled,false);E.enableMatchPhaseTactics(g,m,side,true);
 assert.equal(phaseSlot(m.phaseTactics[side],'inPossession',7)[0],'AM');E.resetMatchTacticalPositions(g,m,side,'inPossession');assert.equal(m.phaseTactics[side].inPossession.positions,undefined);
 assert.deepEqual(g.phaseTactics,clubTemplate);
});

test('custom tactics survive save-load and preserve deterministic match continuation',()=>{
 const g=fresh();E.setTacticalPosition(g,'inPossession',5,{position:'CM'});E.setTacticalRole(g,'inPossession',1,'inside-wing-back');E.setTacticalRole(g,'outOfPossession',1,'holding-full-back');
 g.liveMatch=E.createMatch(g,E.currentFixture(g));const side=own(g,g.liveMatch);E.setMatchTacticalPosition(g,g.liveMatch,side,'outOfPossession',8,{position:'LM',x:16,y:39});
 const loaded=JSON.parse(JSON.stringify(g));assert.ok(E.validateGame(loaded));const migrated=E.migrateGame(loaded,db);
 assert.deepEqual(migrated.phaseTactics,g.phaseTactics);assert.deepEqual(migrated.liveMatch,g.liveMatch);
 let a=g.liveMatch,b=migrated.liveMatch;for(let i=0;i<12;i++){a=E.tickMatch(g,a);b=E.tickMatch(migrated,b);}assert.deepEqual(a,b);
});

test('save validation rejects malformed geometry or position/phase-incompatible roles',()=>{
 const g=fresh();E.setTacticalRole(g,'inPossession',1,'inside-full-back');E.setTacticalPosition(g,'inPossession',5,{position:'CM'});g.liveMatch=E.createMatch(g,E.currentFixture(g));const side=own(g,g.liveMatch);
 for(const corrupt of [c=>c.inPossession.positions.pop(),c=>c.inPossession.positions[1][1]=Infinity,c=>c.inPossession.positions[2]=['GK',50,89],c=>c.inPossession.positions[1]=['LB',39,73],c=>c.inPossession.positions[5][0]='CAM',c=>c.inPossession.roles[1]='holding-full-back',c=>c.inPossession.roles.pop(),c=>c.inPossession.roles[5]='inside-full-back']){
  for(const target of ['club','match']){const bad=structuredClone(g);corrupt(target==='club'?bad.phaseTactics:bad.liveMatch.phaseTactics[side]);assert.throws(()=>E.validateGame(bad));}
 }
 for(const formation of Object.keys(FORMATION_SLOTS))assert.ok(validTacticalPositions(FORMATION_SLOTS[formation],formation),formation);
 const legacy=structuredClone(g);legacy.schema=2;legacy.phaseTactics.inPossession.positions[1][1]=-1;assert.throws(()=>E.validateGame(legacy));
});

test('explicit role skill requirements affect selection and quality within bounded modifiers',()=>{
 const low={attributes:{passing:1,vision:1,composure:1}},high={attributes:{passing:20,vision:20,composure:20}};
 assert.equal(playerRoleFit(low,'midfield-playmaker'),.88);assert.equal(playerRoleFit(high,'midfield-playmaker'),1.06);
 const g=fresh();E.setTacticalPosition(g,'inPossession',5,{position:'AM',x:50,y:29});E.setTacticalRole(g,'inPossession',5,'advanced-playmaker');
 const picked=E.autoPhaseLineup(g);assert.equal(picked.filter(Boolean).length,11);assert.equal(new Set(picked).size,11);
 const m=E.createMatch(g,E.currentFixture(g)),side=own(g,m),p=g.players[m.lineups[side][5]],base=E.tacticalQuality(g,m,side,'inPossession');
 const attrs=structuredClone(p.attributes);p.attributes.passing=1;p.attributes.vision=1;p.attributes.decisions=1;assert.ok(E.tacticalQuality(g,m,side,'inPossession')<base);p.attributes=attrs;
 const roles=g.phaseTactics.inPossession.roles;assert.ok(roles&&roles.length===11);for(const phase of ['inPossession','outOfPossession']){const e=phaseShapeEffects(g.phaseTactics,phase);assert.ok(e.attack>=.92&&e.attack<=1.08&&e.allowed>=.92&&e.allowed<=1.08);}
 const seat=5,injured=g.lineup[seat];g.players[injured].injury=3;const currentIds=new Set(g.lineup),cid=E.currentFixture(g).leagueId;
 const candidates=E.clubPlayers(g,g.clubId).filter(p=>!currentIds.has(p.id)&&E.available(p)&&registered(g,p,cid));E.repairLineup(g);
 assert.ok(candidates.some(p=>p.id===g.lineup[seat]));assert.notEqual(g.lineup[seat],injured);
});

test('edit helpers are pure and roles default safely for legacy or disabled configurations',()=>{
 const original=createPhaseTactics(),before=structuredClone(original),changed=editTacticalPosition(original,'inPossession',5,{position:'CM'});
 assert.deepEqual(original,before);assert.equal(changed.inPossession.positions[5][0],'CM');
 const withRole=editTacticalRole(changed,'inPossession',5,'midfield-playmaker');assert.equal(changed.inPossession.roles,undefined);assert.ok(validPhaseTactics(withRole));
 assert.equal(phasePlayerRole(undefined,'inPossession',1),'full-back');assert.equal(phasePlayerRole({...withRole,enabled:false},'inPossession',5),'defensive-midfielder');
});
