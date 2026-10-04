import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as E from '../src/engine.mjs';
import {repairBench,matchSubLimit} from '../src/matchday.mjs';

const db=JSON.parse(fs.readFileSync(new URL('../public/data/database.json',import.meta.url),'utf8'));
const base=E.newGame(db,'e83','Auto QA',42,{dailyCalendar:true});
function fresh(){
 const g=structuredClone(base),f=g.fixtures.find(f=>f.home===g.clubId||f.away===g.clubId);g.date=f.date;g.careerClock.lastProcessedDate=g.date;
 g.lineup=E.autoLineup(g,g.clubId,g.formation,f.leagueId);repairBench(g,{competitionId:f.leagueId,eligible:E.available,rank:E.overall,fill:true});
 const m=E.createMatch(g,f),side=m.home===g.clubId?0:1;return {g,m,side};
}
test('to full time delegates the managed club, substitutes tired players and keeps all substitution limits',()=>{
 const {g,m,side}=fresh();for(const id of m.lineups[side])if(g.players[id].position!=='GK')g.players[id].fitness=63;
 const saved=JSON.parse(JSON.stringify(m)),a=E.finishMatchAutomatically(g,m),b=E.finishMatchAutomatically(g,saved);
 assert.deepEqual(a,b);assert.equal(m.completed,false);assert.equal(m.autoManage,undefined);assert.equal(a.completed,true);assert.ok(a.subs[side]>0);assert.ok(a.subs[side]<=matchSubLimit(a));assert.ok(a.subWindows[side]<=a.matchdayRules.subWindows+(a.extraTime?a.matchdayRules.extraTimeSub:0));
 const incoming=a.events.filter(e=>e.type==='sub'&&e.side===side).map(e=>e.playerId);assert.equal(new Set(incoming).size,incoming.length);
 for(const id of incoming)assert.ok(!m.lineups[side].includes(id));assert.ok(!a.bench[side].some(id=>a.off.includes(id)));
});
test('an injury already shown on screen is replaced immediately when handing control to the assistant',()=>{
 const {g,m,side}=fresh();m.minute=20;const out=m.lineups[side].find(id=>g.players[id].position==='MF');m.injured.push(out);m.minutes[out]=20;
 const a=E.finishMatchAutomatically(g,m);assert.ok(a.off.includes(out));assert.equal(a.minutes[out],20);assert.ok(a.events.some(e=>e.type==='sub'&&e.side===side&&e.minute===20));
});
test('a sent-off goalkeeper is restored by sacrificing one outfield player, preserving the red card and team size',()=>{
 const {g,m,side}=fresh();m.minute=25;const keeper=m.lineups[side].find(id=>g.players[id].position==='GK'),reserve=m.bench[side].find(id=>g.players[id].position==='GK');assert.ok(reserve);m.red.push(keeper);
 E.autoManageMatch(g,m,side);assert.equal(m.subs[side],1);assert.ok(m.red.includes(keeper));assert.equal(m.lineups[side][0],reserve);assert.equal(m.lineups[side].filter(id=>id&&!m.red.includes(id)&&!m.injured.includes(id)).length,10);assert.ok(!m.off.includes(keeper));
});
test('exhausted substitution windows and ineligible reserves are respected',()=>{
 const {g,m,side}=fresh();m.minute=70;m.subWindows[side]=m.matchdayRules.subWindows;m.lastSubMinute[side]=60;
 const out=m.lineups[side][5];m.injured.push(out);E.autoManageMatch(g,m,side);assert.equal(m.subs[side],0);
 m.minute=45;for(const id of m.bench[side])g.players[id].internationalDuty={active:true,to:'2026-09-01'};E.autoManageMatch(g,m,side);assert.equal(m.subs[side],0);
});
test('outfield substitutions keep a suitable outfield replacement and do not waste a healthy goalkeeper',()=>{
 const {g,m,side}=fresh();m.minute=60;
 for(const id of m.lineups[side]){m.minutes[id]=60;m.workload[id]=60;if(g.players[id].position!=='GK')g.players[id].fitness=60;}
 E.autoManageMatch(g,m,side);assert.ok(m.subs[side]>0);
 for(const e of m.events.filter(e=>e.type==='sub'&&e.side===side))assert.notEqual(g.players[e.playerId].position,'GK');
 assert.equal(g.players[m.lineups[side][0]].position,'GK');
});
test('legacy careers keep manual substitutions when skipping the match',()=>{
 const {g,m,side}=fresh();delete g.careerClock;const a=E.finishMatchAutomatically(g,m);assert.equal(a.autoManage,undefined);assert.equal(a.subs[side],0);
});
