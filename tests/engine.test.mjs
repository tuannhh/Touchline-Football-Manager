import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as E from '../src/engine.mjs';
import {competitionSuspension} from '../src/discipline.mjs';
import {beginNegotiation,submitClubOffer,submitContractOffer} from '../src/transfers.mjs';
const db=JSON.parse(fs.readFileSync(new URL('../public/data/database.json',import.meta.url),'utf8'));
const fresh=(club='e83')=>E.newGame(db,club,'Test',42);

test('snapshot covers eight complete top divisions, unique identities and real local assets',()=>{
 assert.equal(new Set(db.leagues.filter(l=>l.kind!=='external').map(l=>l.countryCode)).size,8);assert.ok(db.clubs.length>550);assert.equal(new Set(db.players.map(p=>p.id)).size,db.players.length);
 for(const l of db.leagues.filter(l=>l.kind!=='external'))assert.equal(db.clubs.filter(c=>c.leagueId===l.id).length,l.expectedTeams);
 for(const c of db.clubs){assert.ok(db.players.filter(p=>p.clubId===c.id).length>=14,c.name);if(c.badge)assert.ok(fs.existsSync(new URL('../public'+c.badge,import.meta.url)));}
 for(const p of db.players.filter(p=>p.photo))assert.ok(fs.existsSync(new URL('../public'+p.photo,import.meta.url)));
 for(const id of ['e83','e359','e364'])assert.ok(db.players.filter(p=>p.clubId===id).every(p=>p.photo),'Every Barcelona, Arsenal and Liverpool player has a real portrait');
});
test('round robin gives each pair exactly one home and one away match with no double booking',()=>{
 for(const n of [14,18,20]){
  const ids=Array.from({length:n},(_,i)=>String(i)),fixtures=E.schedule(ids,'test',2026);assert.equal(fixtures.length,n*(n-1));assert.equal(new Set(fixtures.map(f=>f.id)).size,fixtures.length);
  for(const id of ids){assert.equal(fixtures.filter(f=>f.home===id).length,n-1);assert.equal(fixtures.filter(f=>f.away===id).length,n-1);}
  for(let r=0;r<(n-1)*2;r++){const teams=fixtures.filter(f=>f.round===r).flatMap(f=>[f.home,f.away]);assert.equal(new Set(teams).size,n);}
  assert.equal(new Set(fixtures.map(f=>f.home+'-'+f.away)).size,fixtures.length);
  for(const id of ids){const sequence=fixtures.filter(f=>f.home===id||f.away===id).map(f=>f.home===id?'H':'A').join('');assert.ok(Math.max(...sequence.match(/(.)\1*/g).map(x=>x.length))<=3,sequence);}
 }
});
test('seeded match continues identically after a JSON save at half time',()=>{
 const g=fresh(),f=E.currentFixture(g);let first=E.createMatch(g,f);for(let i=0;i<45;i++)first=E.tickMatch(g,first);
 const loaded=JSON.parse(JSON.stringify(first));let a=first,b=loaded;while(!a.completed)a=E.tickMatch(g,a);while(!b.completed)b=E.tickMatch(g,b);assert.deepEqual(a,b);assert.equal(a.minute,90);assert.ok(a.shots.every(n=>n>=0));
});
test('five substitutions, no re-entry, red-carded players cannot be replaced',()=>{
 const g=fresh(),m=E.createMatch(g,E.currentFixture(g));const side=m.home===g.clubId?0:1;
 m.minute=30;
 const out=m.lineups[side][1],inside=m.bench[side][0];E.substitute(g,m,side,out,inside);assert.ok(m.off.includes(out));assert.ok(!m.bench[side].includes(out));assert.throws(()=>E.substitute(g,m,side,inside,out));
 const red=m.lineups[side][2];m.red.push(red);assert.throws(()=>E.substitute(g,m,side,red,m.bench[side][0]));
 for(let i=0;i<4;i++){const out=m.lineups[side].find(id=>!m.red.includes(id));E.substitute(g,m,side,out,m.bench[side][0]);}
 assert.equal(m.subs[side],5);assert.throws(()=>E.substitute(g,m,side,m.lineups[side][0],m.bench[side][0]));
});
test('played result commits once to every league and conserves goals and standings points',()=>{
 const g=fresh(),expected=g.fixtures.filter(f=>f.round===0).length,m=E.simulate(g,E.currentFixture(g));E.advanceRound(g,m);assert.equal(g.round,1);assert.equal(g.fixtures.filter(f=>f.result).length,expected);assert.equal(g.liveMatch,null);assert.throws(()=>E.advanceRound(g,m));
 for(const l of g.leagues.filter(l=>l.kind!=='external')){const rows=E.table(g,l.id);assert.ok(rows.every(r=>r.played===1||rows.length%2===1&&r.played===0));assert.equal(rows.reduce((s,r)=>s+r.gf,0),rows.reduce((s,r)=>s+r.ga,0));assert.equal(rows.reduce((s,r)=>s+r.won,0),rows.reduce((s,r)=>s+r.lost,0));}
 assert.ok(E.validateGame(g));
});
test('existing bans expire after exclusion; new red cards and injuries last into next round',()=>{
 const g=fresh();const banned=g.players[g.lineup[4]];banned.suspension=1;E.repairLineup(g);assert.ok(!g.lineup.includes(banned.id));
 const competitionId=E.currentFixture(g).leagueId,m=E.simulate(g,E.currentFixture(g));const red=m.lineups[m.home===g.clubId?0:1].find(id=>id);m.red.push(red);E.advanceRound(g,m);assert.equal(banned.appearances,0);assert.equal(banned.suspension,0);assert.equal(g.players[red].suspension,0);assert.equal(competitionSuspension(g,g.players[red],competitionId),1);assert.ok(!E.autoLineup(g,g.clubId,g.formation,competitionId).includes(red));
});
test('editor finances and all 20 attributes survive serialization and affect ability',()=>{
 const g=fresh(),p=g.players[g.lineup[8]];E.editClub(g,g.clubId,{cash:1e9,budget:1e9,wageBudget:1e7});E.editPlayer(g,p.id,{attributes:Object.fromEntries(Object.keys(E.ATTRS).map(k=>[k,20])),fitness:100,morale:100,potential:100});
 assert.equal(E.overall(p),100);assert.equal(g.clubs[g.clubId].budget,1e9);assert.equal(g.editorUsed,true);const saved=JSON.parse(JSON.stringify(g));assert.ok(E.validateGame(saved));assert.equal(E.overall(saved.players[p.id]),100);
});
test('buying transfers exactly one identity, charges buyer, credits seller and guards funds',()=>{
 const g=fresh(),p=Object.values(g.players).find(p=>p.clubId!==g.clubId&&p.value<1e6),old=p.clubId;p.number=E.clubPlayers(g,g.clubId)[0].number;
 E.editClub(g,g.clubId,{budget:0,cash:0});assert.throws(()=>E.buyPlayer(g,p.id));assert.equal(p.clubId,old);
 E.editClub(g,g.clubId,{budget:1e9,cash:1e9,wageBudget:1e8});const {deal}=beginNegotiation(g,p.id);assert.equal(deal.stage,'club');
 submitClubOffer(g,deal.id,deal.clubDemand);assert.equal(deal.stage,'contract');
 submitContractOffer(g,deal.id,deal.playerDemand);assert.equal(deal.stage,'agreed');
 const fee=deal.clubAgreement.fee,upfront=fee+deal.contractAgreement.signingBonus+deal.contractAgreement.agentFee,sellerCash=g.clubs[old].cash;
 E.editClub(g,g.clubId,{budget:0,cash:0});assert.throws(()=>E.buyPlayer(g,p.id,deal.id));assert.equal(p.clubId,old);
 E.editClub(g,g.clubId,{budget:1e9,cash:1e9});E.buyPlayer(g,p.id,deal.id);
 assert.equal(p.clubId,g.clubId);assert.equal(g.clubs[g.clubId].budget,1e9-upfront);assert.equal(g.clubs[old].cash,sellerCash+fee);assert.equal(Object.values(g.players).filter(x=>x.id===p.id).length,1);assert.equal(E.clubPlayers(g,g.clubId).filter(x=>String(x.number)===String(p.number)).length,1);assert.throws(()=>E.buyPlayer(g,p.id,deal.id));assert.ok(E.validateGame(g));
});
test('selling a starting player repairs the lineup and accounts for signing costs',()=>{
 const g=fresh();const p=g.players[g.lineup[4]];p.value=500000;const cash=Object.values(g.clubs).reduce((s,c)=>s+c.cash,0);E.sellPlayer(g,p.id);assert.notEqual(p.clubId,g.clubId);assert.ok(!g.lineup.includes(p.id));assert.equal(g.lineup.filter(Boolean).length,11);assert.equal(Object.values(g.clubs).reduce((s,c)=>s+c.cash,0),cash-g.transfers[0].terms.signingBonus-g.transfers[0].terms.agentFee);
});
test('attribute strength changes outcomes across deterministic matches',()=>{
 const g=fresh();const f=E.currentFixture(g);const own=f.home===g.clubId?0:1;for(const p of E.clubPlayers(g,g.clubId))E.editPlayer(g,p.id,{attributes:Object.fromEntries(Object.keys(E.ATTRS).map(k=>[k,20])),morale:100});
 for(const p of E.clubPlayers(g,own===0?f.away:f.home))p.attributes=Object.fromEntries(Object.keys(E.ATTRS).map(k=>[k,3]));
 let ownGoals=0,otherGoals=0;for(let i=0;i<12;i++){g.rng=i+1;const m=E.simulate(g,f);ownGoals+=m.score[own];otherGoals+=m.score[1-own];}assert.ok(ownGoals>otherGoals*3,`${ownGoals}:${otherGoals}`);
});
test('complete season supports shorter V.League, rolls over with history and valid finances',()=>{
 const g=fresh('v-ha-noi');while(g.round<E.maxRounds(g))E.advanceRound(g);
 assert.equal(g.fixtures.filter(f=>!f.result).length,0);assert.equal(E.table(g,'vie.1')[0].played,26);assert.equal(E.table(g,'eng.1')[0].played,38);assert.ok(E.validateGame(g));
 const goalsPerMatch=g.fixtures.reduce((sum,f)=>sum+f.result.score[0]+f.result.score[1],0)/g.fixtures.length;assert.ok(goalsPerMatch>1.5&&goalsPerMatch<4.5,`Season average ${goalsPerMatch.toFixed(2)} goals per match`);
 E.nextSeason(g);assert.equal(g.year,2027);assert.equal(g.round,0);assert.equal(g.history.length,1);assert.equal(g.fixtures.filter(f=>f.result).length,0);assert.ok(E.validateGame(g));assert.equal(new Set(g.lineup).size,11);
});
test('save validator rejects corrupt identities, invalid attributes, duplicate lineup and unfinished foreign match',()=>{
 const g=fresh();for(const corrupt of [x=>x.players[x.lineup[0]].attributes.pace=NaN,x=>x.lineup[1]=x.lineup[0],x=>x.schema=99,x=>x.clubs[x.clubId].cash=Infinity,x=>x.fixtures[0].home='not-a-club']){const invalid=structuredClone(g);corrupt(invalid);assert.throws(()=>E.validateGame(invalid));}
 assert.throws(()=>E.advanceRound(g,E.createMatch(g,E.currentFixture(g))));assert.equal(g.round,0);
});
