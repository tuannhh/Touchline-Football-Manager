import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as E from '../src/engine.mjs';
import {prepareMatch,preMatchReport,kickOffPreparedMatch} from '../src/prematch.mjs';
import {repairBench} from '../src/matchday.mjs';
import {assignStaffTask,staffMembers} from '../src/staff.mjs';
import {translate} from '../src/i18n.mjs';
import {updatePreferences,resetPreferences} from '../src/preferences.mjs';

const db=JSON.parse(fs.readFileSync(new URL('../public/data/database.json',import.meta.url),'utf8'));
const base=E.newGame(db,'e359','Pre-match QA',47);
const fresh=()=>structuredClone(base);

test('opening and reopening preparation leave time, world, selected eleven and bench unchanged',()=>{
 const g=fresh();g.bench=g.bench.slice(1,5).reverse();const before=structuredClone(g);
 const request=prepareMatch(g);
 assert.equal(request.fixtureId,E.currentFixture(g).id);
 assert.deepEqual(prepareMatch(g),request);
 assert.deepEqual(g,before);
 assert.ok(!g.liveMatch);
});

test('explicit kickoff preserves manual swaps, ordering, empty bench seats and tactical choices',()=>{
 const g=fresh(),request=prepareMatch(g),date=g.date,rng=g.rng;
 E.assignSlot(g,5,g.bench[2]);g.bench=g.bench.slice(0,3).reverse();E.setFormation(g,'4-4-2');g.mentality='attacking';g.tactics.tempo=5;
 const eleven=[...g.lineup],bench=[...g.bench];assert.equal(preMatchReport(g,E.currentFixture(g)).valid,true);
 const m=kickOffPreparedMatch(g,request),side=m.home===g.clubId?0:1;
 assert.deepEqual(m.lineups[side],eleven);assert.deepEqual(m.bench[side],bench);assert.deepEqual(g.lineup,eleven);assert.deepEqual(g.bench,bench);
 assert.equal(m.formation[side],'4-4-2');assert.equal(m.mentality[side],'attacking');assert.equal(m.tactics[side].tempo,5);assert.equal(m.minute,0);assert.equal(g.date,date);assert.equal(g.rng,rng);
 assert.throws(()=>kickOffPreparedMatch(g,request));assert.equal(g.liveMatch,m,'double confirmation cannot restart the match');
 const loaded=E.migrateGame(JSON.parse(JSON.stringify(g)),db);assert.deepEqual(loaded.liveMatch,m,'a live save resumes without preparation');
});

test('eligibility changes after preparation block kickoff rather than replacing player selections',()=>{
 const g=fresh(),request=prepareMatch(g),injured=g.lineup[3];g.players[injured].injury=2;
 const before=structuredClone(g);assert.equal(preMatchReport(g,E.currentFixture(g)).valid,false);
 assert.throws(()=>kickOffPreparedMatch(g,request),/không đủ điều kiện/);assert.deepEqual(g,before);
 g.players[injured].injury=0;g.players[g.bench[0]].suspension=1;
 assert.throws(()=>kickOffPreparedMatch(g,request),/không đủ điều kiện/);assert.equal(g.liveMatch,null);
});

test('a deliberately short lineup remains short and invalid duplicate or oversized lists are rejected',()=>{
 const g=fresh(),request=prepareMatch(g);g.lineup[10]=null;
 const match=kickOffPreparedMatch(g,request),side=match.home===g.clubId?0:1;assert.equal(match.lineups[side][10],null,'no silent auto-repair');assert.equal(match.lineups[side].filter(Boolean).length,10);
 const duplicate=fresh();duplicate.bench.push(duplicate.lineup[0]);assert.equal(preMatchReport(duplicate,E.currentFixture(duplicate)).valid,false);assert.throws(()=>kickOffPreparedMatch(duplicate,prepareMatch(duplicate)));
 const depleted=fresh();depleted.lineup=depleted.lineup.map((id,i)=>i<6?id:null);assert.throws(()=>kickOffPreparedMatch(depleted,prepareMatch(depleted)),/7 đến 11/);
});

test('stale preparation or another career cannot start a different fixture',()=>{
 const g=fresh(),request=prepareMatch(g);g.id+='-copy';assert.throws(()=>kickOffPreparedMatch(g,request),/mở lại/);g.id=request.careerId;g.round++;
 assert.throws(()=>kickOffPreparedMatch(g,request),/mở lại/);assert.ok(!g.liveMatch);
 const current=fresh(),future=current.fixtures.find(f=>f.round>current.round&&(f.home===current.clubId||f.away===current.clubId));assert.throws(()=>prepareMatch(current,future.id),/mốc lịch/);
});

test('manager-led friendly uses friendly bench rules and preserves exact selections',()=>{
 const g=fresh(),opponent=Object.keys(g.clubs).find(id=>id!==g.clubId&&g.clubs[id].leagueId===g.clubs[g.clubId].leagueId);
 const fixture=E.arrangeFriendly(g,opponent);const request=prepareMatch(g,fixture.id);
 repairBench(g,{eligible:E.available,rank:E.overall,competitionId:'friendly',fill:true});assert.equal(g.bench.length,12);
 E.assignPhaseSlot(g,'inPossession',5,g.bench[11],'friendly');assert.equal(g.bench.length,12,'swapping in a friendly must not truncate to league bench size');
 g.bench.reverse();const bench=[...g.bench],eleven=[...g.lineup];const match=kickOffPreparedMatch(g,request);
 assert.equal(match.friendly,true);assert.equal(match.coachId,'manager');assert.equal(match.coachName,g.manager);assert.equal(fixture.coachId,'manager');assert.deepEqual(match.bench[0],bench);assert.deepEqual(match.lineups[0],eleven);assert.equal(match.matchdayRules.maxBench,12);
});

test('delegated friendlies still run through the assistant and cannot accidentally start as manual matches',()=>{
 const g=fresh(),assistant=staffMembers(g,g.clubId).find(s=>s.role==='assistant');assignStaffTask(g,'friendlies',assistant.id);
 const opponent=Object.keys(g.clubs).find(id=>id!==g.clubId&&g.clubs[id].leagueId===g.clubs[g.clubId].leagueId),fixture=E.arrangeFriendly(g,opponent);
 assert.throws(()=>kickOffPreparedMatch(g,prepareMatch(g,fixture.id)),/giao cho ban huấn luyện/);
 const match=E.startFriendly(g,fixture.id);assert.equal(match.completed,true);assert.equal(match.coachId,assistant.id);assert.ok(!g.liveMatch);assert.ok(fixture.result);
});

test('pre-match actions and validation templates translate in all four foreign languages',()=>{
 try{for(const language of ['en','fr','es','pt']){
  updatePreferences({language});
  for(const key of ['Chuẩn bị trước trận','Xác nhận đội hình & vào trận','Chuẩn bị trận đấu','Xuất phát: 11/11 · Dự bị: 7/9','Pedri: không đủ điều kiện thi đấu. Hãy thay cầu thủ này.'])assert.notEqual(translate(key),key,`${language}: ${key}`);
 }}finally{resetPreferences();}
});
