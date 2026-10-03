import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as E from '../src/engine.mjs';
import {beginNegotiation,submitClubOffer,submitContractOffer} from '../src/transfers.mjs';

const db=JSON.parse(fs.readFileSync(new URL('../public/data/database.json',import.meta.url),'utf8'));
const fresh=()=>E.newGame(db,'e359','Market integration',88017);
const terms=(g,p,patch={})=>({wage:p.wage,signingBonus:0,agentFee:0,appearanceBonus:1200,goalBonus:400,years:4,releaseClause:0,annualRise:5,squadRole:'star',sellOnClubId:'e86',sellOnPercent:0,signedAt:g.date,signedYear:g.year,...patch});
const playerStats=g=>Object.fromEntries(Object.values(g.players).map(p=>[p.id,{clubId:p.clubId,goals:p.goals,assists:p.assists,appearances:p.appearances,seasonMinutes:p.seasonMinutes,suspension:p.suspension,competitionStats:p.competitionStats}]));

test('legacy migration adds market state without rewriting a live career or creating trades',()=>{
 const legacy=fresh();delete legacy.marketVersion;delete legacy.negotiations;delete legacy.transferMarket;
 legacy.liveMatch=E.createMatch(legacy,E.currentFixture(legacy));
 for(let n=0;n<19;n++)legacy.liveMatch=E.tickMatch(legacy,legacy.liveMatch);
 const before=structuredClone(legacy),migrated=E.migrateGame(legacy,db);
 assert.equal(migrated.marketVersion,1);assert.deepEqual(migrated.negotiations,[]);assert.deepEqual(migrated.transferMarket.processedDates,[]);
 const oldFields=structuredClone(migrated);delete oldFields.marketVersion;delete oldFields.negotiations;delete oldFields.transferMarket;
 assert.deepEqual(oldFields,before);assert.deepEqual(legacy,before);assert.deepEqual(E.migrateGame(migrated,db),migrated);assert.ok(E.validateGame(migrated));
});

test('completing negotiation refreshes roster caches, seller registration and playing-time baseline',()=>{
 const g=fresh(),target=E.clubPlayers(g,'e86').find(p=>p.position==='MF'),seller=target.clubId;
 target.seasonMinutes=720;target.appearances=8;target.number=E.clubPlayers(g,g.clubId)[0].number;
 Object.assign(g.clubs[g.clubId],{cash:1e10,budget:1e10,wageBudget:1e8});
 const count=Object.keys(g.players).length,ownBefore=E.clubPlayers(g,g.clubId).length,sellerBefore=E.clubPlayers(g,seller).length;
 const registrationBefore=Object.fromEntries(Object.entries(g.registrations).filter(([,lists])=>lists[g.clubId]).map(([cid,lists])=>[cid,[...lists[g.clubId]]]));
 const started=beginNegotiation(g,target.id);assert.ok(started.ok,started.message);const deal=started.deal;
 assert.equal(deal.stage,'club');assert.ok(submitClubOffer(g,deal.id,{...deal.clubDemand}).ok);assert.equal(deal.stage,'contract');
 assert.ok(submitContractOffer(g,deal.id,{...deal.playerDemand}).ok);assert.equal(deal.stage,'agreed');
 const done=E.completeTransfer(g,deal.id);assert.ok(done.ok,done.message);assert.equal(target.clubId,g.clubId);
 assert.equal(Object.keys(g.players).length,count);assert.equal(E.clubPlayers(g,g.clubId).length,ownBefore+1);assert.equal(E.clubPlayers(g,seller).length,sellerBefore-1);
 assert.equal(E.clubPlayers(g,g.clubId).filter(p=>String(p.number)===String(target.number)).length,1);
 for(const [cid,ids]of Object.entries(registrationBefore))assert.deepEqual(g.registrations[cid][g.clubId],ids,'Human registration stays manual');
 for(const lists of Object.values(g.registrations))if(lists[seller])assert.ok(!lists[seller].includes(target.id));
 assert.equal(target.contractTerms.promiseStartMinutes,720);assert.equal(target.contractTerms.promiseFrom,g.date);assert.equal(target.seasonMinutes,720);
 assert.ok(g.lineup.every(id=>!id||g.players[id].clubId===g.clubId));assert.equal(new Set(g.lineup.filter(Boolean)).size,11);
 const cash=g.clubs[g.clubId].cash;assert.equal(E.completeTransfer(g,deal.id).ok,false);assert.equal(g.clubs[g.clubId].cash,cash);assert.ok(E.validateGame(g));
});

test('official appearance and goal bonuses charge once and survive serialization',()=>{
 const g=fresh(),f=E.currentFixture(g),p=g.players[g.lineup[8]];p.contractTerms=terms(g,p);
 const m=E.createMatch(g,f);m.completed=true;m.minute=90;m.minutes={[p.id]:90};m.goals={[p.id]:2};f.result={score:[2,0],events:[]};
 const cash=g.clubs[g.clubId].cash;E.payContractBonuses(g,f,m);
 assert.equal(g.clubs[g.clubId].cash,cash-2000);assert.equal(g.ledger[0].type,'contract-bonus');assert.equal(g.ledger[0].expense,2000);
 const saved=JSON.parse(JSON.stringify(g));E.payContractBonuses(saved,saved.fixtures.find(x=>x.id===f.id),m);
 assert.equal(saved.clubs[g.clubId].cash,cash-2000);assert.equal(saved.ledger.length,1);assert.ok(E.validateGame(saved));
});

test('official match commit pays negotiated bonuses alongside weekly payroll',()=>{
 const g=fresh(),f=E.currentFixture(g),p=g.players[g.lineup[8]];p.contractTerms=terms(g,p);
 const m=E.simulate(g,f),expected=1200+(m.goals[p.id]||0)*400,cash=g.clubs[g.clubId].cash;
 assert.ok(m.minutes[p.id]>0);E.advanceRound(g,m);
 const bonus=g.ledger.find(entry=>entry.type==='contract-bonus'&&entry.fixtureId===f.id);
 assert.equal(bonus?.expense,expected);assert.ok(p.contractTerms.bonusPaidFixtures.includes(f.id));
 assert.equal(g.clubs[g.clubId].cash,cash+g.ledger.reduce((sum,entry)=>sum+entry.income-entry.expense,0));
 assert.throws(()=>E.advanceRound(g,m));assert.equal(g.ledger.filter(entry=>entry.type==='contract-bonus'&&entry.fixtureId===f.id).length,1);assert.ok(E.validateGame(g));
});

test('friendly completion does not pay contract bonuses, review promises or run AI transfers',()=>{
 const g=fresh();for(const p of E.clubPlayers(g,g.clubId))p.contractTerms=terms(g,p,{appearanceBonus:1e6,goalBonus:1e6,promiseStartMinutes:p.seasonMinutes,promiseFrom:g.date});
 const before={clubs:structuredClone(g.clubs),market:structuredClone(g.transferMarket),trades:structuredClone(g.transfers),stats:playerStats(g),ledger:structuredClone(g.ledger)};
 const f=E.arrangeFriendly(g,'e83');let m=E.startFriendly(g,f.id);while(!m.completed)m=E.tickMatch(g,m);E.finishFriendly(g,m);
 assert.deepEqual(g.clubs,before.clubs);assert.deepEqual(g.transferMarket,before.market);assert.deepEqual(g.transfers,before.trades);assert.deepEqual(playerStats(g),before.stats);assert.deepEqual(g.ledger,before.ledger);
 assert.ok(E.clubPlayers(g,g.clubId).every(p=>!p.contractTerms.bonusPaidFixtures&&!p.contractTerms.lastPromiseReview));assert.ok(E.validateGame(g));
});

test('playing-time promises discount pre-transfer minutes and are reviewed at most once per date',()=>{
 const g=fresh(),p=g.players[g.lineup[8]];p.seasonMinutes=1000;p.morale=80;
 p.contractTerms=terms(g,p,{promiseStartMinutes:1000,promiseFrom:g.date});
 const fixtures=g.fixtures.filter(f=>f.home===g.clubId||f.away===g.clubId).slice(0,4);
 for(const f of fixtures){f.date=g.date;f.result={score:[0,0],events:[]};}
 E.reviewSquadPromises(g);assert.equal(p.morale,78);assert.ok(p.contractTerms.promiseWarned);
 E.reviewSquadPromises(g);assert.equal(p.morale,78);
 g.date='2026-09-15';p.seasonMinutes=1360;E.reviewSquadPromises(g);assert.equal(p.morale,78);assert.equal(p.contractTerms.promiseWarned,false);
});

test('season rollover applies annual rises once and restarts promise and bonus accounting',()=>{
 const g=fresh(),p=g.players[g.lineup[8]],oldWage=p.wage;
 p.contractUntil=g.year+4;p.seasonMinutes=1600;p.contractTerms=terms(g,p,{annualRise:10,promiseStartMinutes:1200,promiseFrom:g.date,bonusPaidFixtures:['old-fixture'],promiseWarned:true,lastPromiseReview:g.date});
 g.round=E.maxRounds(g);E.nextSeason(g);
 assert.equal(p.wage,Math.round(oldWage*1.1));assert.equal(p.seasonMinutes,0);assert.equal(p.contractTerms.promiseStartMinutes,0);assert.equal(p.contractTerms.promiseFrom,g.date);assert.deepEqual(p.contractTerms.bonusPaidFixtures,[]);assert.equal(p.contractTerms.promiseWarned,undefined);
 assert.throws(()=>E.nextSeason(g));assert.equal(p.wage,Math.round(oldWage*1.1));assert.ok(E.validateGame(g));
});

test('weekly advancement runs deterministic AI deals after the date changes and repairs cached rosters',()=>{
 const initial=fresh(),a=structuredClone(initial),b=structuredClone(initial),oldDate=initial.date,ownIds=E.clubPlayers(initial,initial.clubId).map(p=>p.id).sort();
 for(const c of Object.values(a.clubs))E.clubPlayers(a,c.id);
 assert.deepEqual(a.transferMarket.processedDates,[]);E.advanceRound(a);E.advanceRound(b);
 assert.notEqual(a.date,oldDate);assert.deepEqual(a.transferMarket.processedDates,[a.date]);
 const signature=g=>g.transfers.map(t=>({id:t.id,from:t.from,to:t.to,fee:t.fee,date:t.date,terms:t.terms}));
 assert.deepEqual(signature(a),signature(b));assert.deepEqual(a.transferMarket,b.transferMarket);assert.ok(a.transfers.length>0);
 assert.ok(a.transfers.every(t=>t.isAI&&t.from!==a.clubId&&t.to!==a.clubId&&t.date===a.date));assert.deepEqual(E.clubPlayers(a,a.clubId).map(p=>p.id).sort(),ownIds);
 for(const t of a.transfers){assert.equal(a.players[t.id].clubId,t.to);assert.ok(E.clubPlayers(a,t.to).some(p=>p.id===t.id));assert.ok(!E.clubPlayers(a,t.from).some(p=>p.id===t.id));for(const lists of Object.values(a.registrations))if(lists[t.from])assert.ok(!lists[t.from].includes(t.id));}
 assert.ok(E.validateGame(a));assert.ok(E.validateGame(b));
 const extra=fresh();extra.calendar[0].kind='uefa';E.advanceRound(extra);assert.deepEqual(extra.transferMarket.processedDates,[]);assert.deepEqual(extra.transfers,[]);
});
