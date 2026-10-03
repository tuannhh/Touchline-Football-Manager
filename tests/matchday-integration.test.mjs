import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as E from '../src/engine.mjs';
import {registered} from '../src/registration.mjs';
import {repairBench,matchSubLimit,matchdayRule} from '../src/matchday.mjs';

const db=JSON.parse(fs.readFileSync(new URL('../public/data/database.json',import.meta.url),'utf8'));
const fresh=()=>E.newGame(db,'e359','Matchday QA',31);
const side=(g,m)=>m.home===g.clubId?0:1;
const setup=()=>{const g=fresh(),m=E.createMatch(g,E.currentFixture(g));return {g,m,s:side(g,m)};};
function replace(g,m,s,minute){m.minute=minute;const outgoing=m.lineups[s].find(id=>id&&!m.red.includes(id)),incoming=m.bench[s][0];assert.ok(incoming,'a selected reserve remains');E.substitute(g,m,s,outgoing,incoming);return {outgoing,incoming};}
function european(){const g=fresh(),f=g.fixtures.find(f=>f.leagueId==='uefa.champions'&&(f.home===g.clubId||f.away===g.clubId));assert.ok(f);g.round=f.round;g.date=f.date;E.repairLineup(g);repairBench(g,{eligible:p=>E.available(p)&&registered(g,p,f.leagueId),rank:E.overall,competitionId:f.leagueId,fill:true});const m=E.createMatch(g,f);return {g,m,s:side(g,m)};}

test('kickoff uses the manually ordered reserves and preserves empty seats after repair and reload',()=>{
 const {g}=setup();g.bench=g.bench.slice(1,6).reverse();const chosen=[...g.bench];E.repairLineup(g);assert.deepEqual(g.bench,chosen);
 const loaded=E.migrateGame(JSON.parse(JSON.stringify(g)),db);assert.deepEqual(loaded.bench,chosen);
 const m=E.createMatch(loaded,E.currentFixture(loaded)),s=side(loaded,m);assert.deepEqual(m.bench[s],chosen);assert.equal(m.matchdayRules.maxBench,9);assert.ok(m.bench[s].length<9);
 const outsider=E.clubPlayers(g,g.clubId).find(p=>E.available(p)&&!g.lineup.includes(p.id)&&!g.bench.includes(p.id));assert.ok(outsider);m.minute=10;assert.throws(()=>E.assignMatchSlot(loaded,m,s,4,outsider.id));
 loaded.liveMatch=m;assert.equal(E.validateGame(loaded),true);const saved=E.migrateGame(JSON.parse(JSON.stringify(loaded)),db);assert.deepEqual(saved.liveMatch,m);
});

test('bench to starter swaps keep the same seat before kickoff and consume no match substitution',()=>{
 const {g}=setup(),originalStarter=g.lineup[5],originalReserve=g.bench[2];E.assignSlot(g,5,originalReserve);assert.equal(g.lineup[5],originalReserve);assert.equal(g.bench[2],originalStarter);
 const m=E.createMatch(g,E.currentFixture(g)),s=side(g,m),start=m.lineups[s][4],reserve=m.bench[s][1],rng=m.rng;
 E.assignMatchSlot(g,m,s,4,reserve);assert.equal(m.lineups[s][4],reserve);assert.equal(m.bench[s][1],start);assert.deepEqual(m.subs,[0,0]);assert.deepEqual(m.subWindows,[0,0]);assert.deepEqual(m.off,[]);assert.equal(m.rng,rng);
 E.assignMatchSlot(g,m,s,4,start);assert.equal(m.lineups[s][4],start);assert.equal(m.bench[s][1],reserve);assert.equal(m.subs[s],0);
 m.minute=1;E.assignMatchSlot(g,m,s,4,reserve);assert.equal(m.subs[s],1);assert.equal(m.subWindows[s],1);assert.ok(m.off.includes(start));assert.ok(!m.bench[s].includes(start));assert.throws(()=>E.assignMatchSlot(g,m,s,4,start));g.liveMatch=m;assert.equal(E.validateGame(g),true);
});

test('three stoppages permit batched changes at the same minute and a remaining change at half time',()=>{
 const {g,m,s}=setup();for(const minute of [10,20,30])replace(g,m,s,minute);assert.equal(m.subWindows[s],3);assert.equal(m.subs[s],3);
 replace(g,m,s,30);assert.equal(m.subWindows[s],3);assert.equal(m.subs[s],4);
 m.minute=40;assert.equal(E.canSubstitute(m,s),false);const before=structuredClone(m);assert.throws(()=>E.substitute(g,m,s,m.lineups[s][0],m.bench[s][0]));assert.deepEqual(m,before);
 replace(g,m,s,45);assert.equal(m.subWindows[s],3);assert.equal(m.subs[s],5);assert.equal(E.canSubstitute(m,s),false);m.minute=46;assert.throws(()=>E.substitute(g,m,s,m.lineups[s][0],m.bench[s][0]));g.liveMatch=m;assert.equal(E.validateGame(g),true);
});

test('UEFA extra time adds one substitution and one stoppage while interval changes remain free',()=>{
 const {g,m,s}=european();assert.equal(m.matchdayRules.maxBench,12);assert.equal(matchSubLimit(m),5);
 for(const minute of [10,20,30])replace(g,m,s,minute);m.minute=89;assert.equal(E.canSubstitute(m,s),false);
 m.extraTime=true;assert.equal(matchSubLimit(m),6);replace(g,m,s,91);assert.equal(m.subWindows[s],4);assert.equal(m.subs[s],4);
 m.minute=95;assert.equal(E.canSubstitute(m,s),false);replace(g,m,s,105);assert.equal(m.subWindows[s],4);assert.equal(m.subs[s],5);replace(g,m,s,105);assert.equal(m.subs[s],6);assert.equal(m.subWindows[s],4);assert.equal(E.canSubstitute(m,s),false);g.liveMatch=m;assert.equal(E.validateGame(g),true);
 const second=european();for(const minute of [10,20,30])replace(second.g,second.m,second.s,minute);second.m.extraTime=true;replace(second.g,second.m,second.s,90);assert.equal(second.m.subWindows[second.s],3,'interval before extra time does not consume the fourth stoppage');
});

test('bench eligibility is checked again at kickoff and at substitution time',()=>{
 const {g}=setup(),injured=g.bench[0],suspended=g.bench[1];g.players[injured].injury=1;g.players[suspended].suspension=1;const m=E.createMatch(g,E.currentFixture(g)),s=side(g,m);assert.ok(!m.bench[s].includes(injured));assert.ok(!m.bench[s].includes(suspended));
 const candidate=m.bench[s][0];m.minute=25;m.injured.push(candidate);assert.throws(()=>E.assignMatchSlot(g,m,s,4,candidate));m.injured=[];g.players[candidate].suspension=1;assert.throws(()=>E.assignMatchSlot(g,m,s,4,candidate));g.players[candidate].suspension=0;m.red.push(m.lineups[s][4]);assert.throws(()=>E.assignMatchSlot(g,m,s,4,candidate));assert.equal(m.subs[s],0);
});

test('legacy live saves retain their original twelve-player bench and unrestricted stoppages during migration',()=>{
 const {g,m,s}=setup();m.minute=28;delete m.matchdayRules;delete m.subWindows;delete m.lastSubMinute;m.bench[s]=E.clubPlayers(g,g.clubId).filter(p=>!m.lineups[s].includes(p.id)).slice(0,12).map(p=>p.id);assert.equal(m.bench[s].length,12);
 g.liveMatch=m;delete g.bench;delete g.benchVersion;delete g.matchdayRuleOverrides;const original=structuredClone(m);assert.equal(E.validateGame(g),true);
 const migrated=E.migrateGame(JSON.parse(JSON.stringify(g)),db);assert.deepEqual(migrated.liveMatch,original);assert.equal(migrated.benchVersion,1);assert.equal(migrated.liveMatch.bench[s].length,12);assert.equal(matchSubLimit(migrated.liveMatch),5);assert.equal(E.validateGame(migrated),true);
 const legacy=migrated.liveMatch;legacy.subs[s]=4;legacy.minute=80;legacy.lastSubMinute=[10,20];legacy.subWindows=[3,3];assert.equal(E.canSubstitute(legacy,s),true,'old live saves do not acquire new stoppage restrictions');
 const modern=setup();modern.g.liveMatch=modern.m;modern.m.subWindows[modern.s]=5;assert.throws(()=>E.validateGame(modern.g));
});

test('Italy, Portugal and Dutch division rules retain the sourced competition-specific capacities',()=>{
 const g=fresh();for(const [id,capacity]of [['ita.1',15],['ita.2',12],['ita.3.1',15],['ita.3.2',15],['ita.3.3',15],['por.1',12],['por.2',12],['ned.1',12],['ned.2',12],['ned.3',7]]){const rule=matchdayRule(g,id);assert.equal(rule.maxBench,capacity,id);assert.equal(rule.verified,true,id);assert.match(rule.sourceUrl,/^https:\/\//);}
});
