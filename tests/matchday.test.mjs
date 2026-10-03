import test from 'node:test';
import assert from 'node:assert/strict';
import {MATCHDAY_RULES,matchdayRule,initializeMatchday,repairBench,assignBenchSlot,removeFromBench,setMatchdayRule,validateMatchday,matchSubLimit,liveMatchdayRule} from '../src/matchday.mjs';
function fresh(){const players={};for(let i=0;i<30;i++)players['p'+i]={id:'p'+i,clubId:'c1',position:i===0||i===15?'GK':'MF',fitness:100-i,injury:0,suspension:0,eligible:i!==27};players.foreign={id:'foreign',clubId:'c2',injury:0,suspension:0};return {clubId:'c1',round:0,clubs:{c1:{leagueId:'eng.1'},c2:{leagueId:'eng.1'}},players,lineup:Array.from({length:11},(_,i)=>'p'+i),leagues:[{id:'eng.1',name:'Premier League'},{id:'unknown',name:'Custom'}],cups:[{id:'uefa.champions',name:'Champions League'}],fixtures:[{id:'m1',home:'c1',away:'c2',round:0,leagueId:'eng.1',result:null}],rng:91,liveMatch:null};}
const eligible=p=>p.injury===0&&p.suspension===0&&p.eligible!==false;
const setup=()=>{const g=fresh();initializeMatchday(g);repairBench(g,{eligible,rank:p=>p.fitness,fill:true});return g;};

test('sourced match-day limits differ across PL, League One, UEFA and negotiated friendlies',()=>{
 const g=fresh();assert.equal(matchdayRule(g).maxBench,9);assert.equal(matchdayRule(g,'eng.3').maxBench,7);assert.equal(matchdayRule(g,'uefa.champions').maxBench,12);assert.equal(matchdayRule(g,'uefa.champions').extraTimeSub,1);assert.equal(matchdayRule(g,'friendly').maxSubs,12);
 for(const rule of Object.values(MATCHDAY_RULES)){assert.ok(Number.isInteger(rule.maxBench)&&rule.maxBench>=3&&rule.maxBench<=15);assert.match(rule.sourceUrl,/^https:\/\//);if(rule.verified){assert.ok(rule.sourceSeason);assert.ok(rule.sourceLabel);}}
 assert.equal(matchdayRule(g,'unknown').verified,false);
});

test('initial bench selection excludes starters, suspended/injured/unregistered players and includes a goalkeeper',()=>{
 const g=fresh();g.players.p11.injury=2;g.players.p12.suspension=1;initializeMatchday(g);assert.deepEqual(g.bench,[]);repairBench(g,{eligible,rank:p=>p.fitness,fill:true});assert.equal(g.bench.length,9);assert.ok(g.bench.includes('p15'));assert.ok(!g.bench.includes('p11'));assert.ok(!g.bench.includes('p12'));assert.ok(!g.bench.includes('p27'));assert.ok(g.bench.every(id=>!g.lineup.includes(id)));assert.equal(validateMatchday(g),true);
});

test('manual substitutions list and order survive repair, repeated initialization and serialization',()=>{
 const g=setup();g.bench=g.bench.slice().reverse();removeFromBench(g,g.bench[2]);const selected=[...g.bench],before=structuredClone(g);initializeMatchday(g);repairBench(g,{eligible});assert.deepEqual(g.bench,selected);assert.deepEqual(g,before);const loaded=JSON.parse(JSON.stringify(g));initializeMatchday(loaded);repairBench(loaded,{eligible});assert.deepEqual(loaded.bench,selected);assert.equal(loaded.rng,91);
});

test('starter to bench swaps identities; bench reorder and outside replacement do not add duplicates',()=>{
 const g=setup(),starter=g.lineup[4],reserve=g.bench[1];assignBenchSlot(g,1,starter,{eligible});assert.equal(g.lineup[4],reserve);assert.equal(g.bench[1],starter);const [first,second]=g.bench;assignBenchSlot(g,0,second,{eligible});assert.equal(g.bench[0],second);assert.equal(g.bench[1],first);assignBenchSlot(g,2,'p26',{eligible});assert.equal(g.bench[2],'p26');assert.equal(new Set([...g.lineup,...g.bench]).size,g.lineup.length+g.bench.length);assert.equal(validateMatchday(g),true);
});

test('moving a starter to an empty seat leaves an explicit empty starting slot; empty benches stay empty',()=>{
 const g=setup(),id=g.lineup[3];g.bench=[];assignBenchSlot(g,7,id,{eligible});assert.deepEqual(g.bench,[id]);assert.equal(g.lineup[3],null);removeFromBench(g,id);repairBench(g,{eligible});assert.deepEqual(g.bench,[]);assert.equal(validateMatchday(g),true);
});

test('bench validation and assignment reject foreign players, duplicate selection, invalid seats and live editing',()=>{
 const g=setup();assert.throws(()=>assignBenchSlot(g,-1,'p26',{eligible}));assert.throws(()=>assignBenchSlot(g,9,'p26',{eligible}));assert.throws(()=>assignBenchSlot(g,0,'foreign',{eligible}));assert.throws(()=>assignBenchSlot(g,0,'p27',{eligible}));g.liveMatch={minute:10};assert.throws(()=>assignBenchSlot(g,0,'p26',{eligible}));assert.throws(()=>removeFromBench(g,g.bench[0]));g.liveMatch=null;
 const corrupt=structuredClone(g);corrupt.bench.push(corrupt.bench[0]);assert.throws(()=>validateMatchday(corrupt));const double=structuredClone(g);double.bench[0]=double.lineup[0];assert.throws(()=>validateMatchday(double));
});

test('changing competition trims capacity without reordering retained choices or silently refilling',()=>{
 const g=setup(),before=[...g.bench];repairBench(g,{eligible,competitionId:'eng.3'});assert.deepEqual(g.bench,before.slice(0,7));repairBench(g,{eligible,competitionId:'uefa.champions'});assert.equal(g.bench.length,7);repairBench(g,{eligible,competitionId:'uefa.champions',fill:true});assert.equal(g.bench.length,12);
});

test('only provisional rules can be configured; live rule snapshots and legacy saves keep their original limits',()=>{
 const g=setup();assert.throws(()=>setMatchdayRule(g,'eng.1',{maxBench:15}));setMatchdayRule(g,'unknown',{maxBench:7,maxSubs:3});assert.equal(matchdayRule(g,'unknown').maxBench,7);assert.equal(matchdayRule(g,'unknown').custom,true);assert.throws(()=>setMatchdayRule(g,'unknown',{maxSubs:8}));assert.equal(validateMatchday(g),true);
 const legacy={fixtureId:'m1',bench:[Array(12).fill('p'),[]],extraTime:true};assert.equal(matchSubLimit(legacy),5);assert.equal(liveMatchdayRule(g,legacy).maxBench,12);const modern={...legacy,matchdayRules:matchdayRule(g,'uefa.champions')};assert.equal(matchSubLimit(modern),6);modern.extraTime=false;assert.equal(matchSubLimit(modern),5);
});

test('new match snapshots validate substitution limits, windows and last stoppage without modifying legacy live state',()=>{
 const g=setup();g.liveMatch={bench:[[],[]],matchdayRules:matchdayRule(g),subWindows:[0,0],lastSubMinute:[null,null]};assert.equal(validateMatchday(g),true);
 const bad=change=>{const x=structuredClone(g);change(x.liveMatch);assert.throws(()=>validateMatchday(x));};
 bad(m=>{m.bench[0]=Array(16).fill('p1');});bad(m=>{m.matchdayRules.maxBench=30;});bad(m=>{m.matchdayRules.maxSubs=0;});bad(m=>{m.matchdayRules.extraTimeSub=2;});bad(m=>{m.matchdayRules.subWindows=0;});bad(m=>{m.subWindows[0]=5;});bad(m=>{m.lastSubMinute[0]=121;});bad(m=>{delete m.subWindows;});
 const old=fresh();old.liveMatch={minute:25,bench:[['p11'],['foreign']],rng:123};const snapshot=structuredClone(old.liveMatch);assert.equal(validateMatchday(old),true);initializeMatchday(old);assert.deepEqual(old.liveMatch,snapshot);
});
