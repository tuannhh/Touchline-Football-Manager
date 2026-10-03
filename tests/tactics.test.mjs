import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as E from '../src/engine.mjs';
import {FORMATION_SLOTS,TACTICAL_PRESETS,DEFAULT_TACTICS,roleFit,tacticalEffects,validTactics} from '../src/tactics.mjs';
const db=JSON.parse(fs.readFileSync(new URL('../public/data/database.json',import.meta.url),'utf8'));
const fresh=()=>E.newGame(db,'e83','Tactics QA',42);
const fixture=g=>E.createMatch(g,E.currentFixture(g));
const own=(g,m)=>m.home===g.clubId?0:1;
const ids=xs=>[...xs].filter(Boolean).sort();

test('coach systems and formations preserve the selected eleven without implicit substitutions',()=>{
 const g=fresh(),original=ids(g.lineup);
 assert.equal(TACTICAL_PRESETS.length,10);assert.equal(Object.keys(FORMATION_SLOTS).length,11);
 for(const [name,slots]of Object.entries(FORMATION_SLOTS)){
  assert.equal(slots.length,11,name);assert.equal(slots.filter(s=>s[0]==='GK').length,1,name);
  E.setFormation(g,name);assert.deepEqual(ids(g.lineup),original);assert.equal(g.lineup.length,11);
 }
 for(const p of TACTICAL_PRESETS){assert.ok(validTactics(p.settings));assert.match(p.source,/^https:\/\//);E.applyTacticPreset(g,p.id);assert.equal(g.formation,p.formation);assert.equal(g.tactics.presetId,p.id);assert.deepEqual(ids(g.lineup),original);}
 assert.ok(E.validateGame(g));
});

test('prematch drag swaps two starters or brings in exactly one eligible reserve',()=>{
 const g=fresh(),[first,second]=g.lineup;
 E.assignSlot(g,1,first);assert.equal(g.lineup[1],first);assert.equal(g.lineup[0],second);
 const p=E.clubPlayers(g,g.clubId).find(p=>!g.lineup.includes(p.id)&&E.available(p));
 E.assignSlot(g,4,p.id);assert.equal(g.lineup[4],p.id);assert.equal(new Set(g.lineup).size,11);
 assert.throws(()=>E.assignSlot(g,-1,p.id));assert.throws(()=>E.assignSlot(g,11,p.id));
 const other=Object.values(g.players).find(p=>p.clubId!==g.clubId);assert.throws(()=>E.assignSlot(g,4,other.id));
 p.injury=2;assert.throws(()=>E.assignSlot(g,5,p.id));
});

test('live drag distinguishes positional swaps, substitutions, dismissals and re-entry',()=>{
 const g=fresh(),m=fixture(g),s=own(g,m);m.minute=34;
 const [a,b]=m.lineups[s];E.assignMatchSlot(g,m,s,1,a);
 assert.equal(m.lineups[s][0],b);assert.equal(m.lineups[s][1],a);assert.equal(m.subs[s],0);assert.equal(m.minute,34);
 const removed=m.lineups[s][4],incoming=m.bench[s][0];E.assignMatchSlot(g,m,s,4,incoming);
 assert.equal(m.subs[s],1);assert.ok(m.off.includes(removed));assert.equal(m.lineups[s][4],incoming);
 assert.throws(()=>E.assignMatchSlot(g,m,s,4,removed));assert.throws(()=>E.assignMatchSlot(g,m,1-s,1,m.lineups[1-s][1]));
 const red=m.lineups[s][3];m.red.push(red);
 assert.throws(()=>E.assignMatchSlot(g,m,s,3,m.bench[s][0]));assert.throws(()=>E.assignMatchSlot(g,m,s,2,red));
 // Repositioning a player into the empty space still leaves only ten active players.
 E.assignMatchSlot(g,m,s,3,m.lineups[s][5]);assert.equal(m.lineups[s].filter(id=>!m.red.includes(id)).length,10);assert.equal(m.subs[s],1);
 while(m.subs[s]<5){const i=m.lineups[s].findIndex(id=>id&&!m.red.includes(id));E.assignMatchSlot(g,m,s,i,m.bench[s][0]);}
 assert.throws(()=>E.assignMatchSlot(g,m,s,m.lineups[s].findIndex(id=>!m.red.includes(id)),m.bench[s][0]));
 const indices=m.lineups[s].map((id,i)=>!m.red.includes(id)?i:null).filter(i=>i!==null);
 E.assignMatchSlot(g,m,s,indices[0],m.lineups[s][indices[1]]);assert.equal(m.subs[s],5);
 g.liveMatch=m;assert.ok(E.validateGame(g));
});

test('live presets keep all on-field identities and do not restore a dismissed or substituted player',()=>{
 const g=fresh(),m=fixture(g),s=own(g,m);m.minute=30;E.assignMatchSlot(g,m,s,5,m.bench[s][0]);m.red.push(m.lineups[s][4]);
 const original=ids(m.lineups[s]),bench=ids(m.bench[s]);
 for(const p of TACTICAL_PRESETS){E.applyMatchPreset(g,m,s,p.id);assert.deepEqual(ids(m.lineups[s]),original);assert.deepEqual(ids(m.bench[s]),bench);assert.equal(m.subs[s],1);assert.equal(m.lineups[s].filter(id=>!m.red.includes(id)).length,10);}
 m.completed=true;assert.throws(()=>E.applyMatchPreset(g,m,s,'pep-city'));assert.throws(()=>E.assignMatchSlot(g,m,s,3,m.bench[s][0]));
});

test('changing tactics and substituting at half time survives a save without changing continuation',()=>{
 const g=fresh();let m=fixture(g),s=own(g,m);while(m.minute<45)m=E.tickMatch(g,m);
 E.applyMatchPreset(g,m,s,'alonso-leverkusen');
 const i=m.lineups[s].findIndex(id=>id&&!m.red.includes(id));E.assignMatchSlot(g,m,s,i,m.bench[s][0]);g.liveMatch=m;
 const loaded=JSON.parse(JSON.stringify(g));assert.ok(E.validateGame(loaded));
 let a=m,b=loaded.liveMatch;while(!a.completed)a=E.tickMatch(g,a);while(!b.completed)b=E.tickMatch(loaded,b);
 assert.deepEqual(a,b);assert.equal(a.tactics[s].presetId,'alonso-leverkusen');
});

test('short passing, counter attacks and pressing change simulation with an actual fatigue cost',()=>{
 const g=fresh(),m=fixture(g),s=own(g,m),ps=m.lineups[s].map(id=>g.players[id]),op=m.lineups[1-s].map(id=>g.players[id]);
 const short={...DEFAULT_TACTICS,passing:'short'},direct={...DEFAULT_TACTICS,passing:'direct',transition:'counter'};
 assert.ok(tacticalEffects(short,ps,DEFAULT_TACTICS,op).possession>tacticalEffects(direct,ps,DEFAULT_TACTICS,op).possession);
 assert.ok(tacticalEffects(direct,ps,{...DEFAULT_TACTICS,line:5},op).attack>tacticalEffects(direct,ps,{...DEFAULT_TACTICS,line:1},op).attack);
 let high=structuredClone(m),low=structuredClone(m);
 E.setMatchTactics(g,high,s,{settings:{pressing:5,tempo:5,transition:'counterpress'}});
 E.setMatchTactics(g,low,s,{settings:{pressing:1,tempo:1,transition:'regroup'}});
 for(let minute=0;minute<30;minute++){high=E.tickMatch(g,high);low=E.tickMatch(g,low);}
 const effort=x=>ps.reduce((sum,p)=>sum+(x.workload[p.id]||0),0);
 assert.ok(effort(high)>effort(low)*1.5);assert.notDeepEqual(high.possession,low.possession);
});

test('natural positions improve fit while missing foot and position data remain unknown',()=>{
 const p={position:'FW',naturalPositions:['RW'],otherPositions:['AM']};
 assert.equal(roleFit(p,'RW'),1);assert.ok(roleFit(p,'AM')>roleFit(p,'ST'));assert.ok(roleFit(p,'ST')>roleFit(p,'CB'));
 const raw=db.players.find(p=>!p.naturalPositions&&!p.preferredFoot),club=db.clubs.find(c=>c.id===raw.clubId);
 const unknown=E.profile(raw,{...club,reputation:65});assert.equal(unknown.preferredFoot,undefined);assert.equal(unknown.naturalPositions,undefined);
 const yamal=db.players.find(p=>p.name==='Lamine Yamal');assert.equal(yamal.preferredFoot,'left');assert.ok(yamal.naturalPositions.includes('RW'));assert.match(yamal.footSource,/fotmob/);
});

test('profile edits carry provenance and are preserved during repeated loads',()=>{
 const g=fresh(),p=g.players[g.lineup[9]];
 E.editPlayer(g,p.id,{preferredFoot:'both',naturalPositions:['ST'],otherPositions:['RW','ST']});
 assert.equal(p.preferredFoot,'both');assert.deepEqual(p.otherPositions,['RW']);assert.match(p.footSource,/Editor/);assert.match(p.positionsSource,/Editor/);
 const loaded=E.migrateGame(g,db);assert.equal(loaded.players[p.id].preferredFoot,'both');assert.deepEqual(loaded.players[p.id].naturalPositions,['ST']);assert.ok(E.validateGame(loaded));
 assert.throws(()=>E.editPlayer(g,p.id,{preferredFoot:'guess'}));assert.throws(()=>E.editPlayer(g,p.id,{naturalPositions:['XYZ']}));
});

test('schema-2 migration preserves finances, edits, transfers and an active match while enriching biography',()=>{
 const g=fresh();g.schema=2;delete g.tactics;
 for(const p of Object.values(g.players))for(const k of ['naturalPositions','otherPositions','preferredFoot','profileSource','positionsSource','footSource'])delete p[k];
 E.editClub(g,g.clubId,{cash:987654321,budget:876543210});g.players[g.lineup[8]].attributes.finishing=20;
 let m=fixture(g);while(m.minute<27)m=E.tickMatch(g,m);delete m.tactics;delete m.workload;g.liveMatch=m;
 const before=structuredClone(g),up=E.migrateGame(g,db);
 for(const k of ['id','clubs','lineup','transfers','ledger','history','fixtures','rng','round','date'])assert.deepEqual(up[k],before[k],k);
 for(const k of ['minute','lineups','bench','subs','off','red','injured','minutes','rng','score','goals','assists','events'])assert.deepEqual(up.liveMatch[k],before.liveMatch[k],k);
 for(const p of Object.values(g.players))assert.deepEqual(up.players[p.id].attributes,p.attributes,p.name);
 assert.deepEqual(up.liveMatch.workload,m.minutes);assert.ok(E.validateGame(up));assert.equal(up.schema,3);
 const twice=E.migrateGame(up,db);assert.equal(twice.messages.length,up.messages.length);assert.deepEqual(g,before);
});

test('save validation rejects corrupt tactical values, role codes, feet and live workload',()=>{
 const g=fresh();g.liveMatch=fixture(g);const p=g.lineup[1];
 for(const corrupt of [x=>x.tactics.pressing=7,x=>x.tactics.passing='magic',x=>x.players[p].preferredFoot='guess',x=>x.players[p].naturalPositions=['ST','ST'],x=>x.liveMatch.formation[0]='1-1',x=>x.liveMatch.workload[p]=-1,x=>x.liveMatch.subs[0]=6,x=>x.liveMatch.lineups[0][1]=x.liveMatch.lineups[0][2]]){
  const bad=structuredClone(g);corrupt(bad);assert.throws(()=>E.validateGame(bad));
 }
});
