import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as E from '../src/engine.mjs';
import {staffMembers,assignStaffTask,staffWeeklyWages} from '../src/staff.mjs';
const db=JSON.parse(fs.readFileSync(new URL('../public/data/database.json',import.meta.url)));
const fresh=()=>E.newGame(db,'e359','Staff QA',5179);
const officialState=g=>({round:g.round,date:g.date,rng:g.rng,fixtures:structuredClone(g.fixtures),lineup:[...g.lineup],cash:g.clubs[g.clubId].cash,budget:g.clubs[g.clubId].budget,ledger:structuredClone(g.ledger),stats:Object.fromEntries(Object.values(g.players).map(p=>[p.id,[p.goals,p.assists,p.appearances,p.seasonMinutes,p.suspension,JSON.stringify(p.competitionStats)]]))});
function assertFriendlyOnlyGate(g,before,fixture){
 const after=officialState(g),gate=fixture.result.environment.gateReceipts;
 assert.ok(gate>0);assert.equal(after.cash,before.cash+gate);assert.equal(after.ledger.length,before.ledger.length+1);
 assert.deepEqual(after.ledger.slice(1),before.ledger);const entry=after.ledger[0];assert.equal(entry.type,'matchday');assert.equal(entry.fixtureId,fixture.id);assert.equal(entry.income,gate);assert.equal(entry.expense,0);
 after.cash=before.cash;after.ledger=before.ledger;assert.deepEqual(after,before);
}

test('manual friendly uses 2D match lifecycle, survives halftime save, preserves official competitions',()=>{
 const g=fresh(),before=officialState(g),f=E.arrangeFriendly(g,'e83');
 assert.throws(()=>E.arrangeFriendly(g,'e86'));
 let m=E.startFriendly(g,f.id);assert.ok(m.friendly);assert.equal(m.coachId,'manager');assert.ok(E.validateGame(g));
 for(let i=0;i<45;i++)m=E.tickMatch(g,m);g.liveMatch=m;
 const loaded=E.migrateGame(JSON.parse(JSON.stringify(g)),db);assert.ok(E.validateGame(loaded));
 let a=g.liveMatch,b=loaded.liveMatch;while(!a.completed)a=E.tickMatch(g,a);while(!b.completed)b=E.tickMatch(loaded,b);assert.deepEqual(a,b);
 E.finishFriendly(loaded,b);assert.equal(loaded.liveMatch,null);assertFriendlyOnlyGate(loaded,before,loaded.friendlies.find(x=>x.id===f.id));
 assert.ok(Object.values(loaded.players).some(p=>p.friendlyStats?.minutes>0));assert.ok(loaded.messages.some(m=>m.type==='friendly'));
 const settledCash=loaded.clubs[loaded.clubId].cash;assert.throws(()=>E.finishFriendly(loaded,b));assert.equal(loaded.clubs[loaded.clubId].cash,settledCash);assert.equal(loaded.ledger.filter(e=>e.fixtureId===f.id).length,1);assert.ok(E.validateGame(loaded));
});

test('delegated assistant selects side, rotates players and sends one friendly and press result',()=>{
 const g=fresh(),assistant=staffMembers(g,g.clubId).find(s=>s.role==='assistant');
 assignStaffTask(g,'friendlies',assistant.id);assignStaffTask(g,'press',assistant.id);
 const before=officialState(g),f=E.arrangeFriendly(g,'e83'),m=E.startFriendly(g,f.id);
 assert.ok(m.completed);assert.equal(m.coachId,assistant.id);assert.equal(g.liveMatch,null);assert.equal(f.result.coachName,assistant.name);
 assert.ok(m.subs[0]>0);assertFriendlyOnlyGate(g,before,f);
 assert.equal(g.pressHistory.filter(p=>p.fixtureId===f.id).length,1);assert.ok(E.validateGame(g));
});

test('pending friendlies are cancelled on calendar advance and cannot be played later',()=>{
 const g=fresh(),f=E.arrangeFriendly(g,'e83');E.advanceRound(g);assert.ok(f.cancelled);assert.throws(()=>E.startFriendly(g,f.id));
 assert.doesNotThrow(()=>E.arrangeFriendly(g,'e83'));assert.ok(E.validateGame(g));
});

test('staff payroll charges only on domestic weekly accounting, itemized in ledger',()=>{
 const g=fresh(),staffCost=staffWeeklyWages(g,g.clubId),cash=g.clubs[g.clubId].cash;
 E.advanceRound(g);assert.equal(g.ledger[0].staffWages,staffCost);assert.equal(g.ledger[0].expense,g.ledger[0].playerWages+staffCost);
 assert.equal(g.clubs[g.clubId].cash,cash+g.ledger[0].income-g.ledger[0].expense);
 const h=fresh();h.calendar[h.round].kind='uefa';const start=h.clubs[h.clubId].cash;E.advanceRound(h);assert.equal(h.clubs[h.clubId].cash,start);assert.equal(h.ledger.length,0);
});

test('old career acquires staff without touching gameplay and repeats idempotently',()=>{
 const g=fresh();for(const k of ['staff','staffAssignments','staffVersion','friendlies','staffReports','pressHistory','pressTone'])delete g[k];
 const before=structuredClone(g),up=E.migrateGame(g,db);const added=Object.keys(up).filter(k=>!(k in before));
 assert.ok(added.includes('staff'));const unchanged=structuredClone(up);for(const k of added)delete unchanged[k];assert.deepEqual(unchanged,before);assert.deepEqual(g,before);
 assert.deepEqual(E.migrateGame(up,db),up);assert.ok(E.validateGame(up));
});

test('friendly validation rejects foreign or malformed live fixtures and blocks official advance',()=>{
 const g=fresh(),f=E.arrangeFriendly(g,'e83');E.startFriendly(g,f.id);assert.throws(()=>E.advanceRound(g));
 const bad=structuredClone(g);bad.friendlies[0].away=bad.clubId;assert.throws(()=>E.validateGame(bad));
 const bad2=structuredClone(g);bad2.friendlies[0].year--;assert.throws(()=>E.validateGame(bad2));
 for(const corrupt of [x=>x.friendlies[0].cancelled=true,x=>delete x.liveMatch.friendly,x=>x.friendlies[0].leagueId='eng.1',x=>x.liveMatch.away='e86']){const invalid=structuredClone(g);corrupt(invalid);assert.throws(()=>E.validateGame(invalid));}
});
