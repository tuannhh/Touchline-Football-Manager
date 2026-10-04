import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as E from '../src/engine.mjs';
import {createScoutingAssignment,scoutingStaff,runScoutingWeek} from '../src/scouting.mjs';
import {scoutingTransferEstimate,beginNegotiation} from '../src/transfers.mjs';
const db=JSON.parse(fs.readFileSync(new URL('../public/data/database.json',import.meta.url)));
const fresh=()=>E.newGame(db,'e83','Scouting integration QA',4179);
const brief=g=>({kind:'position',position:'LW',maxAge:30,maxFee:1e9,maxWage:1e7,scoutId:scoutingStaff(g).find(s=>s.role==='scout').id,durationWeeks:1});

test('calendar progression delivers a requested position report, survives reload, and does not duplicate generic scouting',()=>{
 const g=fresh();createScoutingAssignment(g,brief(g));const job=g.scouting.assignments[0];
 assert.equal(g.scouting.reports.length,0);assert.ok(E.validateGame(g));
 const created=job.createdDate;
 for(let i=0;i<6&&g.scouting.assignments[0].status==='active';i++)E.advanceRound(g);
 const report=g.scouting.reports.find(r=>r.assignmentId===job.id);
 assert.ok(report);assert.ok(Date.parse(g.date)-Date.parse(created)>=7*86400000);
 assert.equal(g.scouting.assignments[0].status,'completed');assert.ok(report.candidates.length>0);
 assert.ok(g.messages.find(m=>m.id===report.messageId)?.action.page==='scouting');
 assert.equal(g.messages.filter(m=>m.type==='scouting').length,g.scouting.reports.length);
 assert.ok(E.validateGame(g));
 const loaded=E.migrateGame(JSON.parse(JSON.stringify(g)),db);
 assert.deepEqual(loaded.scouting,g.scouting);
 const before=structuredClone(loaded);runScoutingWeek(loaded);assert.deepEqual(loaded,before);
});

test('existing careers acquire empty scouting state without changing cash, results, market or RNG',()=>{
 const g=fresh();delete g.scouting;const before=structuredClone(g);
 const upgraded=E.migrateGame(g,db);
 assert.equal(upgraded.scouting.version,1);assert.equal(upgraded.scouting.reports.length,0);
 const stripped=structuredClone(upgraded);delete stripped.scouting;
 assert.deepEqual(stripped,before);assert.deepEqual(g,before);
 assert.deepEqual(E.migrateGame(upgraded,db),upgraded);assert.ok(E.validateGame(upgraded));
});

test('pending scouting request retains criteria and due date on save/load',()=>{
 const g=fresh();createScoutingAssignment(g,{...brief(g),durationWeeks:4});
 const loaded=E.migrateGame(JSON.parse(JSON.stringify(g)),db);
 assert.deepEqual(loaded.scouting,g.scouting);assert.ok(E.validateGame(loaded));
 const invalid=structuredClone(loaded);invalid.scouting.assignments[0].maxFee=-1;
 assert.throws(()=>E.validateGame(invalid));
});

test('scouting quote shares actual opening demands without opening negotiations or spending',()=>{
 const g=fresh(),p=Object.values(g.players).find(p=>p.clubId!==g.clubId&&p.age<25&&p.position==='FW');
 const before=structuredClone(g),quote=scoutingTransferEstimate(g,p);
 assert.deepEqual(g,before);assert.ok(quote.fee>0);assert.ok(quote.terms.wage>0);
 const response=beginNegotiation(g,p.id);
 assert.equal(response.deal.clubDemand.fee,quote.fee);
 assert.deepEqual(response.deal.playerDemand,quote.terms);
 assert.equal(g.clubs[g.clubId].cash,before.clubs[g.clubId].cash);
});


test('season rollover delivers assignments that become due during the summer break',()=>{
 const g=fresh();g.round=E.maxRounds(g);g.date='2027-07-01';
 createScoutingAssignment(g,brief(g));const job=g.scouting.assignments[0];
 E.nextSeason(g);assert.equal(g.year,2027);assert.equal(g.date,'2027-08-15');
 assert.equal(job.status,'completed');assert.equal(job.progressWeeks,1);
 assert.equal(g.scouting.reports.filter(r=>r.assignmentId===job.id).length,1);
 assert.ok(E.validateGame(g));
 const reportCount=g.scouting.reports.length;runScoutingWeek(g);assert.equal(g.scouting.reports.length,reportCount);
});

test('career validation rejects inherited or non-string scouting candidate identities',()=>{
 const g=fresh();createScoutingAssignment(g,brief(g));g.date='2026-08-22';runScoutingWeek(g);
 assert.ok(g.scouting.reports[0].candidates.length);assert.ok(E.validateGame(g));
 for(const [key,value]of [['playerId','toString'],['playerId',['toString']],['clubId','constructor'],['clubId',['e83']]]){
  const corrupt=structuredClone(g);corrupt.scouting.reports[0].candidates[0][key]=value;
  assert.throws(()=>E.validateGame(corrupt));
 }
});
