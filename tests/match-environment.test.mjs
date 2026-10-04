import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {STADIUM_SOURCES,stadiumForClub,initializeMatchEnvironment,matchEnvironment,validateMatchEnvironment} from '../src/matchEnvironment.mjs';

function setup(){
 const g={id:'career-a',year:2026,date:'2026-08-15',rng:291,round:0,clubs:{barca:{id:'barca',name:'Barcelona',leagueId:'esp.1',reputation:90},arsenal:{id:'arsenal',name:'Arsenal',leagueId:'eng.1',reputation:88},small:{id:'small',name:'Local Club',leagueId:'eng.3',reputation:50},viettel:{id:'viettel',name:'Thể Công – Viettel',stadium:'SVĐ Mỹ Đình',leagueId:'vie.1',reputation:55}},leagues:[{id:'esp.1',countryCode:'ES',tier:1},{id:'eng.1',countryCode:'EN',tier:1},{id:'eng.3',countryCode:'EN',tier:3},{id:'vie.1',countryCode:'VN',tier:1}],fixtures:[{id:'match-1',home:'barca',away:'arsenal',date:'2026-08-15',round:0,leagueId:'uefa.champions',result:null}]};
 return g;
}

test('venue provenance distinguishes sourced capacities, partial openings and estimates',()=>{
 const g=setup(),barca=stadiumForClub(g,'barca'),small=stadiumForClub(g,'small');
 assert.equal(barca.name,'Spotify Camp Nou');assert.equal(barca.capacity,62652);assert.equal(barca.capacityEstimated,false);assert.equal(barca.sourceDate,'2026-03-10');assert.match(barca.capacityNote,/1C/);assert.equal(barca.pitchDimensionsEstimated,true);
 assert.equal(stadiumForClub(g,'arsenal').capacity,60704);assert.equal(stadiumForClub(g,'viettel').capacity,40000);
 assert.equal(small.capacityEstimated,true);assert.equal(small.nameEstimated,true);assert.ok(small.capacity<barca.capacity);assert.equal(small.sourceUrl,'');
 for(const entry of Object.values(STADIUM_SOURCES)){assert.ok(entry.capacity>0);assert.match(entry.sourceUrl,/^https:\/\//);assert.ok(entry.sourceDate);}
});

test('all database clubs receive a valid venue without discarding their sourced names',()=>{
 const database=JSON.parse(readFileSync(new URL('../public/data/database.json',import.meta.url)));
 const g={year:2026,leagues:database.leagues,clubs:Object.fromEntries(database.clubs.map(c=>[c.id,{...c,reputation:65}]))};
 initializeMatchEnvironment(g);assert.equal(Object.keys(g.stadiums).length,database.clubs.length);assert.equal(validateMatchEnvironment(g),true);
 for(const c of database.clubs)if(c.stadium&&!STADIUM_SOURCES[c.name])assert.equal(g.stadiums[c.id].name,c.stadium);
 for(const c of database.clubs)if(['eng.1','esp.1','ger.1','ita.1','fra.1','por.1','ned.1'].includes(c.leagueId)){assert.equal(g.stadiums[c.id].nameEstimated,false,`${c.name} must have a sourced stadium name`);assert.match(g.stadiums[c.id].sourceUrl,/^https:\/\//);}
 assert.equal(g.stadiums.e89.name,'Reale Arena');assert.equal(g.stadiums.e89.capacityEstimated,true);
});

test('preview is pure and stable across career IDs, RNG advances and JSON reloads',()=>{
 const g=setup(),before=structuredClone(g),context=matchEnvironment(g,g.fixtures[0]);
 assert.deepEqual(g,before);
 const reload=JSON.parse(JSON.stringify(g));reload.id='a-different-random-career-id';reload.rng=999;reload.date='2027-04-01';
 assert.deepEqual(matchEnvironment(reload,reload.fixtures[0]),context);
 initializeMatchEnvironment(g);assert.deepEqual(matchEnvironment(g,g.fixtures[0]),context);assert.equal(g.rng,291);
 const saved=JSON.stringify(g);initializeMatchEnvironment(g);assert.equal(JSON.stringify(g),saved);
});

test('recorded and live environments remain frozen after reputation, date or venue changes',()=>{
 const g=setup();initializeMatchEnvironment(g);const f=g.fixtures[0],context=matchEnvironment(g,f);
 g.liveMatch={fixtureId:f.id,environment:context};g.stadiums.barca.capacity=70000;g.clubs.barca.reputation=10;g.date='2028-01-01';
 assert.deepEqual(matchEnvironment(g,f),context);
 f.result={score:[2,1],environment:context};g.liveMatch=null;
 assert.deepEqual(matchEnvironment(JSON.parse(JSON.stringify(g)),f),context);
 const copy=matchEnvironment(g,f);copy.weather.temperatureC=99;assert.notEqual(f.result.environment.weather.temperatureC,99);
 assert.equal(validateMatchEnvironment(g),true);
});

test('neutral finals use a simulated neutral ground and balanced fan allocation',()=>{
 const g=setup(),f={...g.fixtures[0],neutral:true,stage:'final'},context=matchEnvironment(g,f);
 assert.equal(context.neutral,true);assert.equal(context.stadium.clubId,null);assert.equal(context.stadium.estimated,true);assert.equal(context.stadium.countryCode,'EU');assert.notEqual(context.stadium.name,stadiumForClub(g,f.home).name);
 assert.ok(context.awayFans/context.attendance>=.46&&context.awayFans/context.attendance<=.54);
 assert.equal(context.homeFans+context.awayFans,context.attendance);
});

test('attendance is bounded, gate income reconciles and friendly demand is lower',()=>{
 const g=setup();initializeMatchEnvironment(g);
 let leagueAttendance=0,friendlyAttendance=0;
 for(let i=0;i<180;i++){
  const f={...g.fixtures[0],id:`m-${i}`,leagueId:'esp.1',result:null},c=matchEnvironment(g,f),friendly=matchEnvironment(g,{...f,friendly:true});
  assert.ok(c.attendance>=0&&c.attendance<=c.stadium.capacity);assert.equal(c.homeFans+c.awayFans,c.attendance);assert.equal(c.occupancy,c.attendance/c.stadium.capacity);assert.equal(c.gateReceipts,Math.round(c.ticketPrice*c.attendance));
  assert.ok(friendly.attendance<c.attendance);assert.ok(friendly.ticketPrice<c.ticketPrice);leagueAttendance+=c.attendance;friendlyAttendance+=friendly.attendance;
  f.result={environment:c};g.fixtures=[f];assert.equal(validateMatchEnvironment(g),true);
 }
 assert.ok(friendlyAttendance<leagueAttendance*.75);
});

test('weather follows the simulated calendar and region, with no tropical snow',()=>{
 const g=setup();let winter=0,summer=0;const kinds=new Set();
 for(let i=0;i<200;i++){
  const f={id:`weather-${i}`,home:'arsenal',away:'barca',leagueId:'eng.1'},jan=matchEnvironment(g,{...f,date:'2027-01-15'}),jul=matchEnvironment(g,{...f,date:'2027-07-15'}),vn=matchEnvironment(g,{...f,home:'viettel',date:'2027-01-15'});
  winter+=jan.weather.temperatureC;summer+=jul.weather.temperatureC;kinds.add(jan.weather.condition);assert.notEqual(vn.weather.condition,'snow');assert.equal(vn.weather.simulated,true);assert.ok(vn.weather.temperatureC>=13);
 }
 assert.ok(summer/200-winter/200>12);assert.ok(kinds.has('rain'));assert.ok(kinds.has('clear'));
});

test('legacy saves migrate idempotently and malformed venues or match contexts are rejected',()=>{
 const g=setup();assert.equal(validateMatchEnvironment(g),true);initializeMatchEnvironment(g);assert.equal(validateMatchEnvironment(g),true);
 const f=g.fixtures[0];f.result={environment:matchEnvironment(g,f)};assert.equal(validateMatchEnvironment(g),true);
 for(const corrupt of [x=>{x.stadiums.barca.capacity=-1;},x=>{x.stadiums.barca.sourceUrl='javascript:alert(1)';},x=>{delete x.stadiums.small;},x=>{x.fixtures[0].result.environment.attendance=999999;},x=>{x.fixtures[0].result.environment.homeFans=-1;},x=>{x.fixtures[0].result.environment.weather.temperatureC=Infinity;},x=>{x.fixtures[0].result.environment.gateReceipts+=1;},x=>{x.fixtures[0].result.environment.date='2027-02-30';},x=>{x.fixtures[0].result.environment.fixtureId='wrong';},x=>{x.environmentVersion=2;}]){
  const bad=structuredClone(g);corrupt(bad);assert.throws(()=>validateMatchEnvironment(bad));
 }
});
