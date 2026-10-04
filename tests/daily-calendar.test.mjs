import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as E from '../src/engine.mjs';
import {advanceCareerDay,finishDailyMatch} from '../src/dailyCalendar.mjs';
import {dailyCareer,addCareerDays,nextClubFixture,validateCareerClock} from '../src/careerClock.mjs';
import {inviteFriendly,processFriendlyInvitations,withdrawFriendlyInvitation,checkFriendlyMatchday,validateFriendlyInvitations} from '../src/friendlyInvitations.mjs';
import {beginNegotiation,submitClubOffer,submitContractOffer,processNegotiationReplies,withdrawNegotiation,validateTransferMarket} from '../src/transfers.mjs';
import {prepareMatch,kickOffPreparedMatch} from '../src/prematch.mjs';
import {repairBench} from '../src/matchday.mjs';
import {matchEnvironment} from '../src/matchEnvironment.mjs';
import {reviewPlayerDynamics} from '../src/playerDynamics.mjs';

const source=JSON.parse(fs.readFileSync(new URL('../public/data/database.json',import.meta.url),'utf8'));
const leagues=source.leagues.filter(l=>l.tier===1&&l.kind!=='external');
const clubs=leagues.flatMap(l=>source.clubs.filter(c=>c.leagueId===l.id).sort((a,b)=>(b.id==='e83')-(a.id==='e83')).slice(0,4));
const ids=new Set(clubs.map(c=>c.id)),db={...source,leagues,clubs,players:source.players.filter(p=>ids.has(p.clubId)),competitions:[]};
const baseline=E.newGame(db,'e83','Daily QA',42,{dailyCalendar:true});baseline.id='career-daily-test';
const fresh=()=>structuredClone(baseline);
const own=g=>E.clubPlayers(g,g.clubId);
const moveTo=(g,date)=>{g.date=date;g.careerClock.lastProcessedDate=date;};
const opponent=g=>Object.keys(g.clubs).find(id=>id!==g.clubId&&g.clubs[id].reputation<65);
function accepted(g,market='home',date='2026-07-28'){
 // Stable invitation seed accepts this lower-reputation opponent.
 const item=inviteFriendly(g,{opponentId:opponent(g),date,market});
 while(g.date<item.replyOn)advanceCareerDay(g);
 assert.equal(item.status,'accepted',item.reason);return g.friendlies.find(f=>f.id===item.fixtureId);
}
function matchReady(g,f){
 g.lineup=E.autoLineup(g,g.clubId,g.formation,f.leagueId);
 repairBench(g,{competitionId:f.leagueId,eligible:E.available,rank:E.overall,fill:true});
}

test('daily calendar starts in preseason and advances exactly one day without playing future fixtures or charging a week per day',()=>{
 const g=fresh(),cash=g.clubs[g.clubId].cash,p=own(g)[0];p.fitness=65;
 assert.equal(g.date,'2026-07-20');assert.equal(E.currentFixture(g),undefined);assert.equal(nextClubFixture(g).date,'2026-08-15');
 const report=advanceCareerDay(g);assert.equal(report.date,'2026-07-21');assert.equal(g.round,0);assert.ok(g.fixtures.every(f=>!f.result));assert.equal(g.clubs[g.clubId].cash,cash);assert.ok(p.fitness>65&&p.fitness<75);
 for(let i=0;i<6;i++)advanceCareerDay(g);
 assert.equal(g.date,'2026-07-27');assert.equal(g.ledger.filter(x=>x.type==='weekly').length,1);assert.equal(g.ledger.find(x=>x.type==='weekly').days,7);assert.ok(E.validateGame(g));
});

test('new behavior is opt-in for new careers; loading legacy saves does not add daily calendar or invitations',()=>{
 const g=E.newGame(db,'e83','Legacy',42),loaded=E.migrateGame(g,db);
 assert.equal(dailyCareer(g),false);assert.equal(loaded.careerClock,undefined);assert.equal(loaded.friendlyInvitations,undefined);assert.equal(loaded.date,g.date);assert.equal(loaded.round,g.round);assert.deepEqual(loaded.players,g.players);
 assert.throws(()=>advanceCareerDay(loaded));
});

test('daily progression stops on match day; preparation is explicit and committing a match does not jump to the next one',()=>{
 const g=fresh();let count=0;while(!E.currentFixture(g)&&count++<40)advanceCareerDay(g);
 assert.equal(g.date,'2026-08-15');assert.ok(count<40);assert.equal(g.liveMatch,null);assert.ok(g.fixtures.every(f=>!f.result));assert.throws(()=>advanceCareerDay(g));
 const f=E.currentFixture(g);matchReady(g,f);const prepared=prepareMatch(g);assert.equal(g.liveMatch,null);
 const m=kickOffPreparedMatch(g,prepared),result=E.finishMatchAutomatically(g,m);finishDailyMatch(g,result);
 assert.equal(g.date,'2026-08-15');assert.ok(f.result);assert.equal(g.liveMatch,null);assert.equal(E.currentFixture(g),undefined);assert.throws(()=>finishDailyMatch(g,result));
 advanceCareerDay(g);assert.equal(g.date,'2026-08-16');assert.ok(E.validateGame(g));
});

test('future friendlies need acceptance, survive intervening dates and use the chosen neutral tour market',()=>{
 const g=fresh(),f=accepted(g,'oceania');assert.equal(f.result,null);assert.equal(f.date,'2026-07-28');assert.equal(E.currentFixture(g),undefined);assert.throws(()=>E.startFriendly(g,f.id));assert.throws(()=>prepareMatch(g,f.id));
 const saved=JSON.parse(JSON.stringify(g));assert.ok(E.validateGame(saved));
 while(g.date<f.date)advanceCareerDay(g);assert.equal(E.currentFixture(g).id,f.id);assert.equal(f.cancelled,undefined);
 matchReady(g,f);const m=kickOffPreparedMatch(g,prepareMatch(g,f.id));assert.equal(m.environment.stadium.countryCode,'AU');assert.equal(m.environment.neutral,true);assert.match(m.environment.stadium.name,/Sydney/);assert.ok(E.validateGame(g));
 const date=g.date,round=g.round;finishDailyMatch(g,E.finishMatchAutomatically(g,m));assert.equal(g.date,date);assert.equal(g.round,round);assert.ok(f.result);assert.ok(own(g).every(p=>p.appearances===0));assert.ok(E.validateGame(g));
});

test('opponents can reject and rescheduling conflicts are checked again when the reply arrives',()=>{
 const g=fresh(),item=inviteFriendly(g,{opponentId:opponent(g),date:'2026-07-28',market:'northAmerica'});
 assert.throws(()=>inviteFriendly(g,{opponentId:item.opponentId,date:item.date,market:'home'}));
 g.fixtures.push({id:'new-conflict',leagueId:g.clubs[item.opponentId].leagueId,round:0,date:'2026-07-29',home:item.opponentId,away:Object.keys(g.clubs).find(id=>![g.clubId,item.opponentId].includes(id)),result:null});
 moveTo(g,item.replyOn);processFriendlyInvitations(g);assert.equal(item.status,'rejected');assert.equal(g.friendlies.length,0);assert.equal(g.messages[0].requiresAttention,true);
 const next=inviteFriendly(g,{opponentId:item.opponentId,date:'2026-08-04',market:'home'});withdrawFriendlyInvitation(g,next.id);moveTo(g,next.replyOn);processFriendlyInvitations(g);assert.equal(next.status,'withdrawn');assert.ok(validateFriendlyInvitations(g));
 assert.throws(()=>inviteFriendly(g,{opponentId:item.opponentId,date:'2026-02-30',market:'home'}));assert.throws(()=>inviteFriendly(g,{opponentId:item.opponentId,date:'2026-08-05',market:'invalid'}));
});

test('called-up players are unavailable to both starting eleven and bench in club friendlies; depleted matches are cancelled',()=>{
 const g=fresh(),f=accepted(g,'asia');moveTo(g,f.date);
 const called=own(g).find(p=>p.position==='FW');called.internationalDuty={active:true,to:'2026-08-05'};
 matchReady(g,f);assert.ok(!g.lineup.includes(called.id));assert.ok(!g.bench.includes(called.id));
 const m=E.createMatch(g,f);assert.ok(!m.lineups.flat().includes(called.id));assert.ok(!m.bench.flat().includes(called.id));
 for(const p of own(g))p.internationalDuty={active:true,to:'2026-08-05'};checkFriendlyMatchday(g);assert.equal(f.cancelled,true);assert.equal(E.currentFixture(g),undefined);assert.throws(()=>E.startFriendly(g,f.id));
});

test('club and player offers wait for separate dated replies, persist on reload and cannot spend money while pending',()=>{
 const g=fresh();let d;
 for(const p of Object.values(g.players).filter(p=>p.clubId!==g.clubId&&p.position==='MF')){p.listed=true;const r=beginNegotiation(g,p.id);if(r.deal?.stage==='club'){d=r.deal;break;}}
 assert.ok(d);const budget=g.clubs[g.clubId].budget;
 assert.equal(submitClubOffer(g,d.id,{...d.clubDemand}).ok,true);assert.equal(d.stage,'club');assert.ok(d.pendingOffer);assert.equal(d.clubRounds,0);assert.equal(submitClubOffer(g,d.id,{...d.clubDemand}).ok,false);assert.equal(E.completeTransfer(g,d.id).ok,false);
 const restored=JSON.parse(JSON.stringify(g));moveTo(g,d.pendingOffer.replyOn);moveTo(restored,g.date);
 processNegotiationReplies(g);processNegotiationReplies(restored);assert.deepEqual(restored.negotiations,g.negotiations);assert.equal(d.stage,'contract');assert.equal(g.clubs[g.clubId].budget,budget);assert.equal(g.messages[0].requiresAttention,true);
 assert.equal(submitContractOffer(g,d.id,{...d.playerDemand}).ok,true);assert.equal(d.stage,'contract');moveTo(g,d.pendingOffer.replyOn);processNegotiationReplies(g);assert.equal(d.stage,'agreed');assert.equal(g.clubs[g.clubId].budget,budget);assert.equal(g.players[d.playerId].clubId,d.sellerId);
 const history=d.history.length;processNegotiationReplies(g);assert.equal(d.history.length,history);assert.ok(validateTransferMarket(g));
});

test('a withdrawn offer cannot answer later and malformed pending terms fail save validation',()=>{
 const g=fresh();let d;for(const p of Object.values(g.players).filter(p=>p.clubId!==g.clubId)){p.listed=true;const r=beginNegotiation(g,p.id);if(r.deal?.stage==='club'){d=r.deal;break;}}
 assert.ok(d);submitClubOffer(g,d.id,{...d.clubDemand});const bad=structuredClone(g);bad.negotiations.find(x=>x.id===d.id).pendingOffer.terms.fee=-1;assert.throws(()=>validateTransferMarket(bad));
 const due=d.pendingOffer.replyOn;withdrawNegotiation(g,d.id);moveTo(g,due);assert.equal(processNegotiationReplies(g).length,0);assert.equal(d.stage,'withdrawn');assert.equal(d.pendingOffer,undefined);
});

test('daily check-ins preserve minutes for weekly player reactions, rather than treating regular starters as unused',()=>{
 const g=fresh(),p=own(g).find(p=>p.age>=23);p.seasonMinutes=90;const previous=p.dynamics.lastMinutes;
 reviewPlayerDynamics(g,{training:false,reviewMinutes:false,playedClubs:new Set()});assert.equal(p.dynamics.lastMinutes,previous);
 moveTo(g,addCareerDays(g.date,1));reviewPlayerDynamics(g,{training:false,playedClubs:new Set([g.clubId])});assert.equal(p.dynamics.lastMinutes,90);assert.equal(p.dynamics.unusedWeeks,0);
});

test('summer rollover keeps chronological time, injuries and fitness rather than healing the whole squad',()=>{
 const g=fresh();for(const f of g.fixtures)f.result={score:[0,0],events:[]};g.round=g.calendar.length;moveTo(g,'2027-06-29');g.careerClock.lastWeeklyDate=g.date;g.international.lastProcessedDate=g.date;g.physical.startedAt=g.date;g.physical.players={};
 const p=own(g)[0];p.fitness=55;p.injury=8;p.injuryDetail={since:g.date,active:true,lastWeeks:8,initialWeeks:8,kind:'Test',context:'match'};
 advanceCareerDay(g);assert.equal(g.date,'2027-06-30');assert.equal(g.year,2026);
 advanceCareerDay(g);assert.equal(g.date,'2027-07-01');assert.equal(g.year,2027);assert.ok(p.injury>0);assert.ok(p.fitness<100);assert.equal(nextClubFixture(g).date,'2027-08-15');assert.ok(E.validateGame(g));
});

test('clock validation rejects backward or inconsistent save metadata',()=>{
 const g=fresh();g.careerClock.lastProcessedDate='2026-07-21';assert.throws(()=>validateCareerClock(g));g.careerClock.lastProcessedDate=g.date;g.careerClock.lastWeeklyDate='2027-01-01';assert.throws(()=>validateCareerClock(g));
});
