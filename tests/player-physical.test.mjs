import test from 'node:test';
import assert from 'node:assert/strict';
import {initializePhysical,playerReadiness,matchCondition,injuryRiskMultiplier,recordPhysicalMatch,recoverPlayerPhysical,resetPhysical,validatePhysical} from '../src/playerPhysical.mjs';

const start='2026-08-15';
const at=day=>new Date(Date.parse(`${start}T12:00:00Z`)+day*86400000).toISOString().slice(0,10);
function fresh(){
 const g={date:start,rng:2026,players:{}};
 for(const [id,position,stamina]of [['starter','MF',14],['reserve','MF',14],['keeper','GK',14],['runner','MF',20]])g.players[id]={id,position,fitness:100,injury:0,attributes:{stamina}};
 return g;
}
const play=(g,id,day,minutes=90,workload=minutes,kind='club',fixtureId=`fixture-${day}-${kind}`)=>recordPhysicalMatch(g,{fixtureId,date:at(day),kind,minutes:{[id]:minutes},workload:{[id]:workload}});
function advance(g,day,options={}){const date=at(day);for(const p of Object.values(g.players))recoverPlayerPhysical(g,p,date,options);g.date=date;}

test('initialization and pure readiness preserve legacy condition, injury and RNG',()=>{
 const g=fresh();g.players.starter.fitness=72;g.players.starter.injury=2;
 const before=structuredClone(g),r=playerReadiness(g,g.players.starter);
 assert.equal(r.fitness,72);assert.equal(r.fatigue,0);assert.equal(r.needsRest,true);assert.equal(r.risk,'high');assert.equal(r.daysSinceLastMatch,null);assert.equal(r.minutes14,0);assert.ok(r.reasons.some(s=>s.includes('chấn thương')));
 assert.deepEqual(g,before);assert.equal(validatePhysical(g),true);
 initializePhysical(g);assert.deepEqual(g.physical,{version:1,startedAt:start,players:{}});assert.deepEqual(g.players,before.players);assert.equal(g.rng,before.rng);
 const initialized=structuredClone(g);initializePhysical(g);assert.deepEqual(g,initialized);
});

test('live workload, substitutes and recorded fitness use one condition formula',()=>{
 const g=fresh();initializePhysical(g);
 const m={fixtureId:'match',minutes:{starter:90,reserve:22,keeper:90,runner:90},workload:{starter:117,reserve:22,keeper:90,runner:90}};
 const before=structuredClone(g),expected=Object.fromEntries(Object.values(g.players).map(p=>[p.id,matchCondition(g,p,m)]));
 assert.equal(expected.starter,70.75);assert.equal(expected.reserve,94.5);assert.equal(expected.keeper,88.75);assert.equal(expected.runner,94.38);
 assert.equal(playerReadiness(g,g.players.starter,{live:m}).fitness,expected.starter);assert.deepEqual(g,before);
 assert.equal(recordPhysicalMatch(g,{fixtureId:m.fixtureId,date:g.date,minutes:m.minutes,workload:m.workload}),4);
 for(const p of Object.values(g.players)){assert.equal(p.fitness,expected[p.id]);assert.equal(matchCondition(g,p,m),expected[p.id]);}
 assert.equal(g.physical.players.reserve.recent[0].minutes,22);
 assert.ok(g.physical.players.starter.fatigue>g.physical.players.reserve.fatigue);
 assert.ok(g.physical.players.keeper.fatigue<g.physical.players.starter.fatigue);
 assert.equal(g.rng,2026);assert.equal(validatePhysical(g),true);
});

test('three matches in six days build fatigue and a rest warning unlike weekly fixtures',()=>{
 const congested=fresh(),weekly=fresh();initializePhysical(congested);initializePhysical(weekly);
 for(const day of [0,3,6]){advance(congested,day);play(congested,'starter',day);}
 for(const day of [0,7,14]){advance(weekly,day);play(weekly,'starter',day);}
 const c=playerReadiness(congested,congested.players.starter),w=playerReadiness(weekly,weekly.players.starter);
 assert.equal(c.minutes7,270);assert.equal(c.matches14,3);assert.equal(c.needsRest,true);assert.equal(c.risk,'high');assert.ok(c.restDays>=7&&c.restDays<=14);
 assert.ok(c.fatigue>w.fatigue+25);assert.ok(c.fitness<w.fitness-20);assert.equal(w.minutes7,90);assert.ok(w.fatigue<20);
 assert.ok(c.reasons.some(s=>s.includes('240 phút')));assert.ok(injuryRiskMultiplier(congested,congested.players.starter)>injuryRiskMultiplier(weekly,weekly.players.starter));
 advance(congested,20);assert.ok(congested.players.starter.fitness>=90);assert.equal(playerReadiness(congested,congested.players.starter).needsRest,false);assert.ok(congested.physical.players.starter.fatigue<15);
 advance(congested,28);assert.equal(congested.players.starter.fitness,100);assert.equal(congested.physical.players.starter.fatigue,0);
});

test('rest recommendations distinguish marginal, exhausted and fit players, and reflect active injuries',()=>{
 const g=fresh(),p=g.players.starter;initializePhysical(g);
 assert.equal(playerReadiness(g,p).needsRest,false);assert.equal(playerReadiness(g,p).restDays,0);
 p.fitness=74;assert.equal(playerReadiness(g,p).risk,'elevated');assert.ok(playerReadiness(g,p).restDays>0);
 p.fitness=59;assert.equal(playerReadiness(g,p).risk,'high');
 p.fitness=100;g.physical.players[p.id]={fatigue:36,recent:[],recoveredThrough:g.date};assert.equal(playerReadiness(g,p).risk,'elevated');
 g.physical.players[p.id].fatigue=61;assert.equal(playerReadiness(g,p).risk,'high');
 g.physical.players[p.id].fatigue=0;assert.equal(playerReadiness(g,p,{live:{injured:[p.id]}}).risk,'high');
});

test('relative injury risk grows under live effort and load but remains bounded without RNG draws',()=>{
 const g=fresh(),p=g.players.starter;initializePhysical(g);
 assert.equal(injuryRiskMultiplier(g,p),1);
 const live={minutes:{starter:90},workload:{starter:140}};
 assert.ok(injuryRiskMultiplier(g,p,live)>1);const before=structuredClone(g);injuryRiskMultiplier(g,p,live);assert.deepEqual(g,before);
 p.fitness=5;g.physical.players.starter={fatigue:100,recent:[],recoveredThrough:g.date};assert.equal(injuryRiskMultiplier(g,p,live),5);
 assert.equal(g.rng,2026);
});

test('club, friendly and international minutes share debt; zero-minute reserves receive none',()=>{
 const g=fresh();initializePhysical(g);
 play(g,'starter',0,90,90,'club');advance(g,3);play(g,'starter',3,90,110,'international');advance(g,5);play(g,'starter',5,45,45,'friendly');
 recordPhysicalMatch(g,{fixtureId:'friendly-bench',date:g.date,kind:'friendly',minutes:{reserve:0},workload:{reserve:0}});
 const r=playerReadiness(g,g.players.starter);assert.equal(r.minutes7,225);assert.equal(r.matches14,3);assert.equal(r.daysSinceLastMatch,0);assert.deepEqual(g.physical.players.starter.recent.map(m=>m.kind),['club','international','friendly']);
 assert.equal(g.physical.players.reserve,undefined);assert.equal(g.players.reserve.fitness,100);assert.equal(validatePhysical(g),true);
});

test('match recording and elapsed-day recovery are idempotent through save/load',()=>{
 const g=fresh();initializePhysical(g);play(g,'starter',0);const finished=structuredClone(g);
 assert.equal(play(g,'starter',0),0);assert.deepEqual(g,finished);
 advance(g,3);const recovered=JSON.parse(JSON.stringify(g));assert.equal(play(g,'starter',0),0);assert.deepEqual(g,recovered);
 recoverPlayerPhysical(g,g.players.starter,at(3));recoverPlayerPhysical(g,g.players.starter,at(1));assert.deepEqual(g,recovered);
 const loaded=JSON.parse(JSON.stringify(g));assert.equal(validatePhysical(loaded),true);advance(g,7);advance(loaded,7);assert.deepEqual(loaded,g);
 assert.equal(g.players.starter.fitness,100);assert.equal(g.physical.players.starter.fatigue,0);
 assert.throws(()=>play(g,'starter',2,90,90,'club','unseen-old-fixture'));assert.equal(g.rng,2026);
});

test('light training and assigned recovery staff improve recovery over hard training',()=>{
 const light=fresh(),hard=fresh();initializePhysical(light);initializePhysical(hard);play(light,'starter',0);play(hard,'starter',0);
 advance(light,3,{intensity:'light',recoveryBonus:3});advance(hard,3,{intensity:'hard'});
 assert.ok(light.players.starter.fitness>hard.players.starter.fitness+7);
 assert.ok(light.physical.players.starter.fatigue<hard.physical.players.starter.fatigue-4);
 assert.equal(light.players.reserve.fitness,100);assert.equal(light.physical.players.reserve,undefined);
});

test('season break prunes history and Editor reset only clears selected physical state',()=>{
 const g=fresh();initializePhysical(g);play(g,'starter',0);play(g,'reserve',0);g.players.starter.injury=3;
 resetPhysical(g,['starter']);assert.equal(g.players.starter.fitness,100);assert.equal(g.players.starter.injury,3);assert.deepEqual(g.physical.players.starter.recent,[]);assert.equal(g.physical.players.starter.fatigue,0);assert.ok(g.physical.players.reserve.fatigue>0);
 advance(g,60);assert.equal(g.players.reserve.fitness,100);assert.equal(g.physical.players.reserve.fatigue,0);assert.deepEqual(g.physical.players.reserve.recent,[]);assert.equal(validatePhysical(g),true);
 resetPhysical(g);assert.ok(Object.values(g.players).every(p=>p.fitness===100));assert.equal(validatePhysical(g),true);
});

test('history is bounded and preserves recent substitutes while windows exclude exactly seven days ago',()=>{
 const g=fresh();initializePhysical(g);
 for(let day=0;day<30;day++){advance(g,day);play(g,'starter',day,20);}
 const state=g.physical.players.starter,r=playerReadiness(g,g.players.starter);
 assert.equal(state.recent.length,24);assert.equal(r.minutes7,140);assert.equal(r.minutes14,280);assert.equal(r.matches14,14);assert.equal(state.recent[0].date,at(6));assert.equal(validatePhysical(g),true);
 advance(g,65);assert.deepEqual(g.physical.players.starter.recent,[]);assert.equal(playerReadiness(g,g.players.starter).daysSinceLastMatch,null);
});

test('international date processing may run ahead of club clock without invalidating physical records',()=>{
 const g=fresh();initializePhysical(g);play(g,'starter',0);recoverPlayerPhysical(g,g.players.starter,at(3));
 play(g,'starter',3,90,90,'international');g.international={lastProcessedDate:at(3)};
 assert.equal(g.date,start);assert.equal(validatePhysical(g),true);assert.equal(playerReadiness(g,g.players.starter,{date:at(3)}).minutes7,180);
 assert.ok(injuryRiskMultiplier(g,g.players.starter,{date:at(3),minutes:{starter:90},workload:{starter:90}})>1);
});

test('invalid match credits fail atomically without partially exhausting other players',()=>{
 const g=fresh();initializePhysical(g);const original=structuredClone(g);
 for(const change of [
  {minutes:{starter:90,absent:90}},
  {minutes:{starter:90,reserve:-1}},
  {minutes:{starter:90},workload:{starter:Infinity}},
  {minutes:{starter:0},workload:{starter:10}},
  {minutes:{starter:90},workload:{reserve:50}},
  {minutes:{starter:151}},
  {minutes:{starter:1.5}},
  {kind:'bogus'},
  {date:'2026-02-30'},
  {date:'2026-08-14'},
  {minutes:JSON.parse('{"__proto__":90}')},
  {minutes:{constructor:90}},
 ]){
  assert.throws(()=>recordPhysicalMatch(g,{fixtureId:'bad',date:g.date,minutes:{starter:90},...change}));assert.deepEqual(g,original);
 }
});

test('save validation rejects corrupted ranges, references, dates, duplicates and prototype IDs',()=>{
 const valid=fresh();initializePhysical(valid);play(valid,'starter',0);
 const bad=change=>{const g=structuredClone(valid);change(g);assert.throws(()=>validatePhysical(g));};
 bad(g=>{g.physical=null;});bad(g=>{g.physical.version=2;});bad(g=>{g.physical.startedAt='2026-02-30';});
 bad(g=>{g.physical.players.starter.fatigue=NaN;});bad(g=>{g.physical.players.starter.fatigue=101;});
 bad(g=>{g.physical.players.starter.recoveredThrough='2026-08-14';});
 bad(g=>{g.physical.players.starter.recent[0].date='2026-08-16';});
 bad(g=>{g.physical.players.starter.recent[0].minutes=0;});bad(g=>{g.physical.players.starter.recent[0].load=-1;});
 bad(g=>{g.physical.players.starter.recent[0].kind='training';});
 bad(g=>{g.physical.players.starter.recent.push({...g.physical.players.starter.recent[0]});});
 bad(g=>{g.physical.players.absent=g.physical.players.starter;});
 bad(g=>{g.physical.players.constructor=g.physical.players.starter;});
 bad(g=>{g.physical.players=JSON.parse('{"__proto__":{"fatigue":0,"recent":[],"recoveredThrough":"2026-08-15"}}');});
 bad(g=>{g.physical.players.starter.recoveredThrough=at(35);});
 assert.equal(validatePhysical(valid),true);
});
