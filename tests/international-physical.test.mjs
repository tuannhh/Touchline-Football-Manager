import test from 'node:test';
import assert from 'node:assert/strict';
import {initializeInternational,processInternationalDate,validateInternational} from '../src/international.mjs';
import {initializePhysical,recordPhysicalMatch,playerReadiness,validatePhysical} from '../src/playerPhysical.mjs';

function fresh(){
 const g={id:'international-physical-qa',date:'2026-09-14',year:2026,rng:731,round:0,clubId:'c0',manager:'Physical QA',intensity:'normal',messages:[],clubs:{c0:{id:'c0',name:'Club 0'},c1:{id:'c1',name:'Club 1'}},players:{},fixtures:[],calendar:[]};
 for(const [team,countryCode]of [[0,'ENG'],[1,'ESP']])for(let i=0;i<25;i++){
  const id=`p-${team}-${i}`,position=i<3?'GK':i<11?'DF':i<19?'MF':'FW';
  g.players[id]={id,name:id,clubId:`c${team}`,position,countryCode,nationality:'',fitness:100,morale:80,injury:0,suspension:0,appearances:0,goals:0,seasonMinutes:0,attributes:Object.fromEntries(['stamina','reflexes','handling','positioning','composure','tackling','heading','strength','passing','vision','teamwork','dribbling','finishing','pace'].map(k=>[k,14]))};
 }
 initializePhysical(g);initializeInternational(g);return g;
}
const played=g=>g.international.matches.filter(f=>f.result&&!f.result.cancelled);

// Advance the international clock without moving g.date, as supported by the
// public API and used during the summer before the club's new-season reset.
test('large date jumps settle all national load chronologically and recover returned players once',()=>{
 const g=fresh();recordPhysicalMatch(g,{fixtureId:'club-before-camp',date:g.date,minutes:{'p-0-11':90},workload:{'p-0-11':90}});
 const initialRng=g.rng,clubCondition=g.players['p-0-11'].fitness;
 processInternationalDate(g,'2026-10-07');
 assert.ok(played(g).length>=4);assert.equal(g.date,'2026-09-14');assert.equal(g.rng,initialRng);
 assert.ok(Object.values(g.players).every(p=>!p.internationalDuty));
 const touched=Object.entries(g.physical.players);assert.ok(touched.length>=22);
 for(const [id,state]of touched){assert.equal(state.recoveredThrough,'2026-10-07');const national=state.recent.filter(m=>m.kind==='international');for(const m of national){const f=played(g).find(f=>f.id===m.fixtureId);assert.equal(m.minutes,f.result.statistics.find(stat=>stat.playerId===id).minutes);}}
 assert.ok(Object.values(g.players).some(p=>p.nationalStats?.appearances>0));assert.ok(Object.values(g.players).every(p=>p.appearances===0&&p.goals===0&&p.seasonMinutes===0));
 assert.ok(clubCondition<100);assert.equal(validatePhysical(g),true);assert.equal(validateInternational(g),true);
 const snapshot=structuredClone(g);processInternationalDate(g,'2026-10-07');assert.deepEqual(g,snapshot);
});

test('mid-window serialization preserves recovery, national results and accumulated fatigue',()=>{
 const first=fresh();processInternationalDate(first,'2026-09-24');const second=JSON.parse(JSON.stringify(first));
 processInternationalDate(first,'2026-10-07');processInternationalDate(second,'2026-10-07');assert.deepEqual(first,second);
 assert.equal(validatePhysical(second),true);assert.equal(validateInternational(second),true);
});

test('national selection rotates an exhausted star for a fit player in the same position',()=>{
 const g=fresh();for(const key of Object.keys(g.players['p-0-11'].attributes))g.players['p-0-11'].attributes[key]=20;
 processInternationalDate(g,'2026-09-21');const p=g.players['p-0-11'];assert.ok(p.internationalDuty?.active);
 p.fitness=40;g.physical.players[p.id]={fatigue:75,recent:[],recoveredThrough:'2026-09-21'};
 processInternationalDate(g,'2026-09-24');const first=played(g).find(f=>f.date==='2026-09-24');assert.ok(first);
 assert.equal(first.result.statistics.some(stat=>stat.playerId===p.id),false);assert.equal(p.nationalStats,undefined);assert.equal(playerReadiness(g,p,{date:'2026-09-24'}).needsRest,true);
});

test('national injury stops physical and statistical minutes at the recorded injury event',()=>{
 let injured;
 for(let seed=1;seed<=20&&!injured;seed++){
  const g=fresh();processInternationalDate(g,'2026-09-21');g.international.rng=seed;
  for(const p of Object.values(g.players)){p.fitness=65;g.physical.players[p.id]={fatigue:80,recent:[],recoveredThrough:'2026-09-21'};}
  processInternationalDate(g,'2026-09-24');const f=played(g).find(f=>f.date==='2026-09-24'),event=f?.result.events.find(e=>e.type==='injury');
  if(event)injured={g,f,event};
 }
 assert.ok(injured,'deterministic seeds exercise an injury, without changing production RNG');
 const {g,f,event}=injured,p=g.players[event.playerId],stat=f.result.statistics.find(s=>s.playerId===p.id),credit=g.physical.players[p.id].recent.find(m=>m.fixtureId===f.id);
 assert.equal(stat.minutes,event.minute);assert.ok(stat.minutes<90);assert.equal(p.nationalStats.minutes,event.minute);assert.equal(credit.minutes,event.minute);assert.equal(credit.load,event.minute);
 assert.ok(p.injury>0);assert.equal(p.internationalDuty,undefined);assert.ok(f.result.events.filter(e=>e.type==='goal'&&e.playerId===p.id).every(e=>e.minute<event.minute));
 processInternationalDate(g,'2026-09-25');assert.equal(g.physical.players[p.id].recoveredThrough,'2026-09-25');assert.equal(validatePhysical(g),true);
});

test('calendar recovery includes club players outside national duty and honours intensity',()=>{
 const light=fresh(),hard=fresh();light.intensity='light';hard.intensity='hard';
 for(const g of [light,hard]){const p=g.players['p-0-24'];p.countryCode='';recordPhysicalMatch(g,{fixtureId:'club-before-notice',date:g.date,minutes:{[p.id]:90},workload:{[p.id]:90}});processInternationalDate(g,'2026-09-17');assert.equal(p.internationalDuty,undefined);}
 assert.ok(light.players['p-0-24'].fitness>hard.players['p-0-24'].fitness+5);assert.ok(light.physical.players['p-0-24'].fatigue<hard.physical.players['p-0-24'].fatigue);
 const snapshot=structuredClone(light);processInternationalDate(light,'2026-09-17');assert.deepEqual(light,snapshot);
});
