import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as E from '../src/engine.mjs';
import {applyPlayerRealitySnapshot} from '../src/playerReality.mjs';
import {playerAbility} from '../src/playerAbility.mjs';
import {careerDatabase} from '../src/careerSource.mjs';
import {scoutingTransferEstimate} from '../src/transfers.mjs';
import {createScoutingAssignment,scoutingStaff,runScoutingWeek} from '../src/scouting.mjs';

const read=path=>JSON.parse(fs.readFileSync(new URL(path,import.meta.url),'utf8'));
const db=read('../public/data/database.json'),snapshot=read('../public/data/player-reality.json');
const latest=applyPlayerRealitySnapshot(db,snapshot);
const baseline=E.newGame(latest,'e83','Assessment QA',0);
function compactDatabase(){
 const ids=['eng.1','esp.1','ger.1','fra.1','ita.1','por.1','ned.1','vie.1'],leagues=db.leagues.filter(l=>ids.includes(l.id));
 const clubs=leagues.flatMap(l=>db.clubs.filter(c=>c.leagueId===l.id).slice(0,4)),clubIds=new Set(clubs.map(c=>c.id));
 return {...db,leagues,clubs,players:latest.players.filter(p=>clubIds.has(p.clubId)),competitions:[]};
}
const compact=compactDatabase(),freshSmall=()=>E.newGame(compact,compact.clubs[0].id,'Assessment review',0);

test('new careers apply the installed public observations and the requested established-player hierarchies',()=>{
 const g=baseline,[saliba,mosquera,yamal,salah]=['e277385','e328497','e362150','e173896'].map(id=>g.players[id]);
 assert.ok(E.overall(saliba)>E.overall(mosquera)+5);assert.ok(saliba.potential>=E.overall(saliba));
 assert.ok(E.overall(yamal)>E.overall(salah));assert.ok(E.overall(salah)>=85,'age alone does not discard a productive veteran');
 assert.ok(saliba.abilityAssessment.influence>mosquera.abilityAssessment.influence);
 assert.ok(saliba.value>mosquera.value);assert.ok(yamal.value>salah.value);
 for(const p of [saliba,mosquera,yamal,salah]){
  assert.equal(p.value,snapshot.players[p.id].marketValue.eur);assert.equal(p.abilityAssessment.target,E.overall(p));assert.equal(E.overall(p),playerAbility(p));
  assert.equal(p.appearances,0);assert.equal(p.seasonMinutes,0);assert.deepEqual(p.form,[]);assert.equal(g.playerDevelopment.players[p.id].baseline.value,p.value);
 }
 assert.equal(g.dbMeta.playerReality.asOf,snapshot.asOf);assert.ok(E.validateGame(g));
 assert.equal(db.players.find(p=>p.id===saliba.id).abilityModel,undefined,'installed source roster is immutable');
});

test('loading a legacy save preserves every existing skill, value and career observation despite newer installed evidence',()=>{
 const g=freshSmall();for(const p of Object.values(g.players)){delete p.abilityModel;delete p.abilityAssessment;}
 delete g.playerDevelopment;
 const p=Object.values(g.players)[0];p.attributes.passing=3;p.value=1234567;p.morale=43;p.age=39;p.potential=91;
 const before=structuredClone(g),loaded=E.migrateGame(g,careerDatabase(g));
 assert.deepEqual(loaded.players,before.players);assert.deepEqual(loaded.clubs,before.clubs);assert.deepEqual(loaded.fixtures,before.fixtures);assert.equal(loaded.rng,before.rng);assert.deepEqual(g,before);
 assert.equal(loaded.playerDevelopment.players[p.id].baseline.value,1234567);assert.equal(loaded.players[p.id].abilityModel,undefined);assert.ok(E.validateGame(loaded));
});

test('scouting and transfer assessments evaluate the same positional ability used by the match engine',()=>{
 const g=freshSmall(),p=Object.values(g.players).find(x=>x.clubId!==g.clubId&&x.naturalPositions?.includes('RW'));
 assert.ok(p);const quote=scoutingTransferEstimate(g,p);assert.equal(quote.assessment.quality,E.overall(p));
 const scout=scoutingStaff(g).find(s=>s.role==='scout');
 createScoutingAssignment(g,{kind:'position',position:'RW',maxAge:45,maxFee:1e12,maxWage:1e8,scoutId:scout.id,durationWeeks:1});g.date='2026-08-22';runScoutingWeek(g);
 const candidates=g.scouting.reports[0].candidates;assert.ok(candidates.length>0);
 for(const candidate of candidates){const actual=E.overall(g.players[candidate.playerId]);assert.ok(actual>=candidate.abilityLow&&actual<=candidate.abilityHigh);assert.equal(scoutingTransferEstimate(g,g.players[candidate.playerId]).assessment.quality,actual);}
});

test('advancing the real game calendar records career-dependent reviews and persists them without reapplying public ratings',()=>{
 const g=freshSmall(),start=g.date,before=Object.fromEntries(Object.values(g.players).map(p=>[p.id,{value:p.value,assessment:structuredClone(p.abilityAssessment)}]));
 for(let i=0;i<12&&!Object.values(g.playerDevelopment.players).some(state=>state.history.length);i++)E.advanceRound(g);
 assert.ok(Date.parse(g.date)-Date.parse(start)>=28*86400000);
 const reviewed=Object.values(g.players).filter(p=>g.playerDevelopment.players[p.id].history.length);
 assert.ok(reviewed.length>0);assert.ok(reviewed.some(p=>p.value!==before[p.id].value));
 assert.ok(reviewed.some(p=>g.playerDevelopment.players[p.id].history[0].minutes>0));
 for(const p of reviewed){assert.deepEqual(p.abilityAssessment,before[p.id].assessment);assert.ok(Math.abs(p.value-before[p.id].value)<=before[p.id].value*.08+1);}
 assert.ok(E.validateGame(g));const loaded=E.migrateGame(JSON.parse(JSON.stringify(g)),careerDatabase(g));assert.deepEqual(loaded.playerDevelopment,g.playerDevelopment);assert.deepEqual(loaded.players,g.players);
});

test('a full installed-world save with capped development histories remains below the server request limit',t=>{
 const g=structuredClone(baseline);const reviewDate=i=>new Date(Date.parse('2026-08-15T12:00:00Z')+(i+1)*28*86400000).toISOString().slice(0,10);
 // Materialize worst-shape bounded records without simulating dozens of world seasons.
 for(const p of Object.values(g.players)){
  const state=g.playerDevelopment.players[p.id],entry={ability:99,abilityDelta:1,value:9999999999,valueDelta:-799999999,influence:98.25,minutes:1200,appearances:12,rating:9.99,confidence:.85,reasons:['form_rising','youth_development','age_curve','injury','contract_running_down','new_club','no_new_minutes']};
  state.history=Array.from({length:p.clubId===g.clubId?24:6},(_,i)=>({date:reviewDate(i),...entry}));
 }
 const bytes=Buffer.byteLength(JSON.stringify(g));t.diagnostic(`16,440-player save with capped histories: ${bytes} bytes`);assert.ok(bytes<100*1024*1024,`save uses ${Math.round(bytes/1e6)} MB`);
});
