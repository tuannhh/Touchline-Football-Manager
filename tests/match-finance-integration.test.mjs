import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {newGame,currentFixture,createMatch,simulate,advanceRound,migrateGame,validateGame,editClub,nextSeason,maxRounds,clubPlayers} from '../src/engine.mjs';
import {matchEnvironment} from '../src/matchEnvironment.mjs';
import {financeReport,settleMatchFinancials} from '../src/financialSustainability.mjs';
const db=JSON.parse(fs.readFileSync(new URL('../public/data/database.json',import.meta.url),'utf8'));

test('preview, live match, JSON reload and committed report keep the same conditions',()=>{
 const g=newGame(db,'e83','Conditions QA',81),f=currentFixture(g),rng=g.rng;
 const preview=matchEnvironment(g,f),m=createMatch(g,f);
 assert.equal(g.rng,rng);assert.equal(f.environment,undefined);
 assert.deepEqual(m.environment,preview);
 g.liveMatch=m;const loaded=migrateGame(JSON.parse(JSON.stringify(g)),db);
 assert.deepEqual(loaded.liveMatch.environment,preview);assert.equal(loaded.liveMatch.rng,m.rng);
 const finished=simulate(g,f);g.liveMatch=null;advanceRound(g,finished);
 assert.deepEqual(f.result.environment,preview);assert.equal(validateGame(g),true);
 for(const fixture of g.fixtures.filter(f=>f.result)){
  assert.ok(fixture.result.environment.attendance<=fixture.result.environment.stadium.capacity);
  assert.equal(fixture.result.environment.fixtureId,fixture.id);
 }
 const cash=g.clubs[f.home].cash;settleMatchFinancials(g,f,f.result.environment);
 assert.equal(g.clubs[f.home].cash,cash,'same gate cannot be collected twice');
});

test('migration adds new systems without resetting the old career or charging historical gates',()=>{
 const g=newGame(db,'e83','Legacy QA',82),f=currentFixture(g);g.liveMatch=createMatch(g,f);
 delete g.liveMatch.environment;delete g.environmentVersion;delete g.stadiums;
 delete g.financeVersion;delete g.financials;
 const before=structuredClone(g),loaded=migrateGame(g,db);
 assert.equal(loaded.clubs[g.clubId].cash,before.clubs[g.clubId].cash);
 assert.deepEqual(loaded.players,before.players);assert.equal(loaded.liveMatch.rng,before.liveMatch.rng);
 assert.equal(loaded.liveMatch.minute,0);assert.ok(loaded.liveMatch.environment);
 assert.ok(financeReport(loaded,g.clubId));assert.equal(validateGame(loaded),true);
});

test('cash injected in Editor cannot change the annual sustainability spending allowance',()=>{
 const g=newGame(db,'e83','Budget QA',83),before=financeReport(g,g.clubId);
 editClub(g,g.clubId,{cash:1e12,budget:1e12,wageBudget:1e10});
 const after=financeReport(g,g.clubId);
 assert.equal(after.revenue,before.revenue);assert.equal(after.limit,before.limit);
 assert.equal(after.headroom,before.headroom);
});


test('season closing pays the summer interval at old wages before contractual annual rises',()=>{
 const g=newGame(db,'e83','Summer payroll QA',84),p=g.players[g.lineup[1]],oldWage=p.wage;
 p.contractTerms={wage:p.wage,years:3,signingBonus:0,agentFee:0,appearanceBonus:0,goalBonus:0,annualRise:20,squadRole:'starter',releaseClause:0,sellOnPercent:0,sellOnClubId:g.clubId,signedAt:g.date,signedYear:g.year};
 const oldReport=financeReport(g),oldPayroll=clubPlayers(g,g.clubId).reduce((sum,p)=>sum+p.wage,0);
 g.round=maxRounds(g);g.date='2027-08-08';g.financials.lastWeeklyDate=g.date;
 nextSeason(g);
 assert.equal(p.wage,Math.round(oldWage*1.2));
 assert.equal(g.ledger.find(l=>l.type==='weekly'&&l.date==='2027-08-15').playerWages,oldPayroll);
 assert.equal(g.financials.history.find(h=>h.clubId===g.clubId&&h.year===2026).annualCost,oldReport.annualCost);
 assert.equal(validateGame(g),true);
});
