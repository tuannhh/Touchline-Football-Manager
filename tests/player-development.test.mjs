import test from 'node:test';
import assert from 'node:assert/strict';
import {initializePlayerDevelopment,reviewPlayerDevelopment,resetDevelopmentSeason,resetPlayerDevelopment,resetPlayersDevelopment,playerDevelopmentReport,validatePlayerDevelopment,remainingContractYears} from '../src/playerDevelopment.mjs';
import {playerAbility} from '../src/playerAbility.mjs';
import {simulatedClubInterests,transferAssessment} from '../src/transfers.mjs';

const start='2026-08-15';
const at=days=>new Date(Date.parse(`${start}T12:00:00Z`)+days*86400000).toISOString().slice(0,10);
const attrs=value=>Object.fromEntries(['pace','stamina','strength','finishing','passing','dribbling','tackling','positioning','vision','composure','reflexes','handling','heading','crossing','teamwork','decisions'].map(key=>[key,value]));
function fresh(){
 const g={id:'development',date:start,year:2026,rng:42,clubId:'home',clubs:{},players:{},training:'balanced'};
 for(const [clubId,skill,reputation] of [['home',15,85],['buyer',13,80],['rich',17,90]]){
  g.clubs[clubId]={id:clubId,name:clubId,leagueId:`${clubId}.1`,reputation,budget:100e6,cash:150e6,wageBudget:1e6};
  for(let i=0;i<24;i++){
   const id=`${clubId}-${i}`,position=i<2?'GK':i<10?'DF':i<18?'MF':'FW';
   g.players[id]={id,name:id,clubId,position,naturalPositions:[{GK:'GK',DF:'CB',MF:'CM',FW:'RW'}[position]],abilityModel:'evidence-v1',age:24,potential:90,attributes:attrs(skill),value:20e6,wage:10000,contractUntil:2030,contractEndDate:'2030-06-30',fitness:100,injury:0,morale:80,appearances:0,seasonMinutes:0,form:[],listed:false};
  }
 }
 return g;
}
function month(g,p,day,{minutes=360,rating=7.5,appearances=4}={}){g.date=at(day);p.seasonMinutes+=minutes;p.appearances+=appearances;p.form=Array(Math.min(5,appearances)).fill(rating);return reviewPlayerDevelopment(g);}

test('legacy initialization and pure report preserve all player, money, RNG and match state',()=>{
 const g=fresh();g.liveMatch={minute:51};const before=structuredClone(g),p=g.players['home-10'];
 assert.equal(validatePlayerDevelopment(g),true);playerDevelopmentReport(g,p);assert.deepEqual(g,before);
 initializePlayerDevelopment(g);for(const [key,value]of Object.entries(before))assert.deepEqual(g[key],value,key);
 const initialized=structuredClone(g);initializePlayerDevelopment(g);assert.deepEqual(g,initialized);
 assert.equal(validatePlayerDevelopment(g),true);assert.deepEqual(reviewPlayerDevelopment(g),[]);assert.deepEqual(g,initialized);
});

test('28-day reviews are deterministic, persisted and idempotent without borrowing real-world form',()=>{
 const g=fresh(),p=g.players['home-10'];p.realWorld={performance:{rating:9.8,minutes:4000}};initializePlayerDevelopment(g);
 month(g,p,27,{minutes:90,rating:10,appearances:1});assert.equal(g.playerDevelopment.players[p.id].history.length,0);
 const copy=structuredClone(g);g.date=copy.date=at(28);
 assert.deepEqual(reviewPlayerDevelopment(g),reviewPlayerDevelopment(copy));assert.deepEqual(g,copy);
 assert.equal(g.rng,42);const reviewed=structuredClone(g);assert.deepEqual(reviewPlayerDevelopment(g),[]);assert.deepEqual(g,reviewed);
 const bench=g.players['home-11'],row=g.playerDevelopment.players[bench.id].history[0];assert.equal(row.rating,null);assert.equal(row.confidence,0);
 assert.equal(validatePlayerDevelopment(JSON.parse(JSON.stringify(g))),true);
});

test('one match is strongly shrunk; sustained strong minutes develop youth within potential and bounded monthly values',()=>{
 const one=fresh(),sustained=fresh(),p=one.players['home-10'],q=sustained.players['home-10'];p.age=q.age=20;p.potential=q.potential=79;
 initializePlayerDevelopment(one);initializePlayerDevelopment(sustained);
 const current=playerAbility(p);month(one,p,28,{minutes:15,rating:10,appearances:1});month(sustained,q,28,{minutes:540,rating:8.5,appearances:6});
 assert.equal(playerAbility(p),current);assert.ok(one.playerDevelopment.players[p.id].history[0].confidence<=.02);
 for(let period=2;period<=12;period++){
  const previous=q.value,oldAbility=playerAbility(q);month(sustained,q,period*28,{minutes:450,rating:8.2,appearances:5});
  assert.ok(Math.abs(q.value-previous)<=previous*.08+1);assert.ok(Math.abs(playerAbility(q)-oldAbility)<=1);assert.ok(playerAbility(q)<=q.potential);
 }
 assert.ok(playerAbility(q)>current);assert.equal(validatePlayerDevelopment(sustained),true);
});

test('a productive veteran stays strong while injury, poor form and expiring contracts reduce valuation',()=>{
 const strong=fresh(),weak=fresh(),p=strong.players['home-18'],q=weak.players['home-18'];p.age=q.age=34;p.attributes=q.attributes=attrs(18);p.potential=q.potential=94;
 initializePlayerDevelopment(strong);initializePlayerDevelopment(weak);q.injury=20;q.contractUntil=2027;q.contractEndDate='2027-06-30';
 for(let period=1;period<=4;period++){month(strong,p,period*28,{rating:8.8});month(weak,q,period*28,{minutes:60,rating:5,appearances:2});}
 assert.ok(playerAbility(p)>=89);assert.ok(p.value>q.value);assert.ok(q.value<20e6);
 const row=weak.playerDevelopment.players[q.id].history.at(-1);assert.ok(row.reasons.includes('injury'));assert.ok(row.reasons.includes('contract_running_down'));assert.ok(row.reasons.includes('form_falling'));
});

test('influence follows use within the club, without punishing idle fixture periods or injured players',()=>{
 const g=fresh(),starter=g.players['home-10'],bench=g.players['home-11'],injured=g.players['home-12'];
 for(const p of [starter,bench,injured])p.abilityAssessment={influence:90};injured.injury=5;
 initializePlayerDevelopment(g);g.date=at(28);reviewPlayerDevelopment(g);assert.equal(g.playerDevelopment.players[bench.id].influence,90);
 for(let period=2;period<=5;period++)month(g,starter,period*28,{rating:8,minutes:450,appearances:5});
 assert.ok(g.playerDevelopment.players[starter.id].influence>g.playerDevelopment.players[bench.id].influence);
 assert.equal(g.playerDevelopment.players[injured.id].influence,90);
 assert.equal(transferAssessment(g,injured,'buyer').important,true);
});

test('season rollover and explicit reanchor retain history without replaying old season minutes',()=>{
 const g=fresh(),p=g.players['home-10'];initializePlayerDevelopment(g);month(g,p,28);
 const previous=structuredClone(g.playerDevelopment.players[p.id]);g.year=2027;g.date='2027-08-15';p.age++;p.appearances=0;p.seasonMinutes=0;p.form=[];resetDevelopmentSeason(g);
 assert.deepEqual(g.playerDevelopment.players[p.id].history,previous.history);assert.equal(g.playerDevelopment.players[p.id].minutes,0);assert.deepEqual(reviewPlayerDevelopment(g),[]);
 p.value=9e6;resetPlayerDevelopment(g,p);assert.equal(g.playerDevelopment.players[p.id].baseline.value,9e6);assert.deepEqual(g.playerDevelopment.players[p.id].history,previous.history);assert.equal(validatePlayerDevelopment(g),true);
 g.date='2027-09-12';reviewPlayerDevelopment(g);assert.equal(g.playerDevelopment.players[p.id].history.at(-1).rating,null);
});

test('club interest is a pure, live fit and budget ranking rather than a permanent rumour',()=>{
 const g=fresh(),p=g.players['home-10'];p.listed=true;p.attributes=attrs(17);p.age=21;p.potential=95;
 const before=structuredClone(g),interests=simulatedClubInterests(g,p);assert.deepEqual(g,before);assert.ok(interests.length>0);assert.ok(interests.every(row=>row.basis==='simulation'&&row.clubId!==p.clubId));
 assert.ok(interests.some(row=>row.clubId==='buyer'&&row.level==='interested'));g.clubs.buyer.budget=0;
 assert.ok(!simulatedClubInterests(g,p).some(row=>row.clubId==='buyer'));
 for(const x of Object.values(g.players).filter(x=>x.clubId==='rich'&&x.position==='MF'))x.attributes=attrs(20);
 assert.ok(!simulatedClubInterests(g,p).some(row=>row.clubId==='rich'));
});

test('history caps its size, values do not compound indefinitely, and old source contract dates cannot override a signed renewal',()=>{
 const g=fresh(),p=g.players['home-10'];p.age=28;p.potential=playerAbility(p);p.contractUntil=2035;initializePlayerDevelopment(g);
 for(let period=1;period<=30;period++)month(g,p,period*28,{rating:7.8});
 assert.equal(g.playerDevelopment.players[p.id].history.length,24);assert.ok(p.value<30e6);assert.equal(validatePlayerDevelopment(g),true);
 p.contractUntil=2038;p.contractEndDate='2030-06-30';assert.ok(remainingContractYears(g,p)>8);
});

test('development validation rejects corrupt references, future dates, ranges and unbounded histories',()=>{
 const g=fresh();initializePlayerDevelopment(g);month(g,g.players['home-10'],28);
 for(const change of [
  x=>{x.playerDevelopment.version=2;},x=>{x.playerDevelopment.players.missing={};},x=>{x.playerDevelopment.players['home-10'].influence=NaN;},
  x=>{x.playerDevelopment.players['home-10'].reviewedAt='2099-01-01';},x=>{x.playerDevelopment.players['home-10'].baseline.value=-1;},
  x=>{x.playerDevelopment.players['home-10'].history[0].confidence=5;},x=>{x.playerDevelopment.players['home-10'].history[0].reasons=['fabricated'];},
  x=>{x.playerDevelopment.players['home-10'].history.push(x.playerDevelopment.players['home-10'].history[0]);},
 ]){const copy=structuredClone(g);change(copy);assert.throws(()=>validatePlayerDevelopment(copy));}
});


test('zero-valued Editor players and maximum-skill players stay valid under positive development',()=>{
 const g=fresh(),p=g.players['home-10'];p.value=0;p.attributes=attrs(20);p.potential=100;p.age=20;initializePlayerDevelopment(g);
 for(let period=1;period<=12;period++)month(g,p,period*28,{minutes:450,rating:9.5,appearances:5});
 assert.equal(p.value,0);assert.equal(playerAbility(p),100);assert.equal(validatePlayerDevelopment(g),true);
 const report=playerDevelopmentReport(g,p);report.baseline.value=5;report.history[0].reasons.push('changed');assert.equal(g.playerDevelopment.players[p.id].baseline.value,0);assert.ok(!g.playerDevelopment.players[p.id].history[0].reasons.includes('changed'));
});


test('batch reassessment uses current values without resetting finances, career history or other player states',()=>{
 const g=fresh();initializePlayerDevelopment(g);month(g,g.players['home-10'],28);
 const a=g.players['home-10'],b=g.players['buyer-10'],untouched=structuredClone(g.playerDevelopment.players['rich-10']),clubs=structuredClone(g.clubs),history=structuredClone(g.playerDevelopment.players[a.id].history);
 a.value=7e6;b.value=8e6;const states=resetPlayersDevelopment(g,[a,b]);assert.equal(states.length,2);assert.equal(states[0].baseline.value,7e6);assert.equal(states[1].baseline.value,8e6);
 assert.deepEqual(states[0].history,history);assert.deepEqual(g.playerDevelopment.players['rich-10'],untouched);assert.deepEqual(g.clubs,clubs);assert.equal(validatePlayerDevelopment(g),true);
});

test('world histories stay compact enough for a 16,440-player save while watched players retain longer trends',()=>{
 const g=fresh();g.shortlist=['buyer-11'];initializePlayerDevelopment(g);
 for(let period=1;period<=30;period++)month(g,g.players['home-10'],period*28,{rating:7.5});
 assert.equal(g.playerDevelopment.players['home-10'].history.length,24);assert.equal(g.playerDevelopment.players['buyer-11'].history.length,24);assert.equal(g.playerDevelopment.players['buyer-10'].history.length,6);
 const worldState=g.playerDevelopment.players['rich-10'],bytes=Buffer.byteLength(JSON.stringify(worldState));
 assert.ok(bytes*16440<50e6,`world development estimate ${bytes*16440} bytes`);assert.equal(validatePlayerDevelopment(g),true);
});


test('influence is re-evaluated at a new club instead of carrying the old club star label',()=>{
 const g=fresh(),p=g.players['home-10'];p.abilityAssessment={influence:98};initializePlayerDevelopment(g);assert.equal(playerDevelopmentReport(g,p).influence,98);
 p.clubId='rich';const changed=playerDevelopmentReport(g,p);assert.ok(changed.influence<98);assert.equal(transferAssessment(g,p,'buyer').influence,null);
 g.date=at(28);reviewPlayerDevelopment(g);assert.equal(g.playerDevelopment.players[p.id].clubId,'rich');assert.ok(g.playerDevelopment.players[p.id].influence<98);assert.ok(g.playerDevelopment.players[p.id].history.at(-1).reasons.includes('new_club'));
});
