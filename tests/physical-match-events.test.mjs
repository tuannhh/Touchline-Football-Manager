import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as E from '../src/engine.mjs';
import {shouldPauseMatch} from '../src/matchPlayback.mjs';

const db=JSON.parse(readFileSync(new URL('../public/data/database.json',import.meta.url),'utf8'));
const career=E.newGame(db,'e83','Physical events QA',381);
const fixture=E.currentFixture(career),clubIds=[fixture.home,fixture.away];
// Keep the real match rosters/rules but avoid cloning the entire world for
// repeated seeded simulations. These tests never advance the world calendar.
const baseline={...career,players:Object.fromEntries(Object.entries(career.players).filter(([,p])=>clubIds.includes(p.clubId))),clubs:Object.fromEntries(clubIds.map(id=>[id,career.clubs[id]])),fixtures:[fixture],staff:{},messages:[]};
const fresh=()=>structuredClone(baseline);
const ownSide=m=>m.home===baseline.clubId?0:1;

function overload(g){for(const p of Object.values(g.players)){p.fitness=50;g.physical.players[p.id]={fatigue:80,recent:[],recoveredThrough:g.date};}}

test('fixed-seed quick simulations produce more injuries with high accumulated fatigue',()=>{
 const rested=fresh(),tired=fresh();overload(tired);
 let normalInjuries=0,tiredInjuries=0;
 for(let seed=1;seed<=128;seed++){
  rested.rng=tired.rng=seed;
  const fit=E.simulateQuick(rested,rested.fixtures[0]),worn=E.simulateQuick(tired,tired.fixtures[0]);
  normalInjuries+=fit.injured.length;tiredInjuries+=worn.injured.length;
 }
 assert.ok(tiredInjuries>normalInjuries*1.8,`rested ${normalInjuries}; fatigued ${tiredInjuries}`);
 assert.ok(normalInjuries>0,'rest does not eliminate the chance of an injury');
 assert.ok(tiredInjuries<128*2,'fatigue increases probability without guaranteeing an injury');
 assert.ok(Object.values(rested.players).every(p=>p.injury===0&&p.fitness===100),'preview simulations must not mutate career condition');
});

test('quick matches conserve total player-minutes after injuries, replacements, red cards and extra time',()=>{
 const g=fresh();overload(g);g.fixtures[0]={...g.fixtures[0],tieId:'qa-knockout',leg:1,legs:1};
 let injuries=0,reds=0,replacements=0,extraTimes=0,substituteReds=0;
 // Seed 439 explicitly covers the rare replacement at 70' sent off at 71'.
 for(const seed of [...Array.from({length:128},(_,i)=>i+1),439]){
  g.rng=seed;const m=E.simulateQuick(g,g.fixtures[0]),duration=m.extraTime?120:90;
  if(m.extraTime)extraTimes++;
  for(const side of [0,1]){
   const clubId=side?m.away:m.home,redEvents=m.events.filter(e=>e.type==='red'&&e.side===side),injuryEvents=m.events.filter(e=>e.type==='injury'&&e.side===side);
   const lostRed=redEvents.reduce((sum,e)=>sum+duration-e.minute,0);
   const lostInjury=injuryEvents.filter(e=>!m.off.includes(e.playerId)).reduce((sum,e)=>sum+duration-e.minute,0);
   const total=Object.entries(m.minutes).filter(([id])=>g.players[id].clubId===clubId).reduce((sum,[,minutes])=>sum+minutes,0);
   assert.equal(total,11*duration-lostRed-lostInjury,`seed ${seed}, side ${side}`);
  }
  for(const event of m.events){
   if(event.type==='injury'){injuries++;assert.equal(m.minutes[event.playerId],event.minute);assert.ok(!m.red.includes(event.playerId),'injured player cannot later receive an on-field red card');}
   if(event.type==='sub'){
    replacements++;const red=m.events.find(e=>e.type==='red'&&e.playerId===event.playerId);
    assert.equal(m.minutes[event.playerId],(red?.minute||duration)-event.minute);if(red)substituteReds++;
   }
   if(event.type==='red')reds++;
   if(['goal','yellow'].includes(event.type)){
    const enter=m.events.find(e=>e.type==='sub'&&e.playerId===event.playerId)?.minute||0;
    assert.ok(event.minute>=enter&&event.minute<=enter+m.minutes[event.playerId],`event outside player's time on pitch, seed ${seed}`);
   }
  }
 }
 assert.ok(injuries>0&&reds>0&&replacements>0&&extraTimes>0);assert.ok(substituteReds>0,'exercise a substitute who is later sent off');
});

test('a tired starter triggers one live alert and one automatic pause, retained through save/reload',()=>{
 const g=fresh(),initial=E.createMatch(g,g.fixtures[0]),side=ownSide(initial),id=initial.lineups[side].find(id=>g.players[id].position==='MF');
 g.players[id].fitness=59;initial.rng=42;
 const first=E.tickMatch(g,initial),alerts=first.events.filter(e=>e.type==='fatigue'&&e.playerId===id);
 assert.equal(alerts.length,1);assert.equal(alerts[0].side,side);assert.equal(shouldPauseMatch(initial,first,g.clubId),true);
 const restored=JSON.parse(JSON.stringify(first)),second=E.tickMatch(g,restored);
 assert.equal(second.events.filter(e=>e.type==='fatigue'&&e.playerId===id).length,1);assert.equal(shouldPauseMatch(restored,second,g.clubId),false);
 assert.deepEqual(E.tickMatch(g,first),second);
 const replacement=second.bench[side].find(pid=>g.players[pid].position==='MF')||second.bench[side][0];E.substitute(g,second,side,id,replacement);
 const third=E.tickMatch(g,second);assert.equal(third.minutes[id],second.minutes[id]);assert.equal(third.events.filter(e=>e.type==='fatigue'&&e.playerId===id).length,1);
 assert.equal(third.minutes[replacement],1);
});

test('opponent fatigue alerts do not pause the manager game and an already-seen alert does not repeat',()=>{
 const before={home:'home',away:'away',minute:20,events:[],completed:false};
 const rival={...before,minute:21,events:[{type:'fatigue',side:1,playerId:'rival'}]};
 assert.equal(shouldPauseMatch(before,rival,'home'),false);
 const own={...before,minute:21,events:[{type:'fatigue',side:0,playerId:'own'}]};
 assert.equal(shouldPauseMatch(before,own,'home'),true);assert.equal(shouldPauseMatch(own,{...own,minute:22},'home'),false);
});
