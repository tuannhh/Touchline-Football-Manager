import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as E from '../src/engine.mjs';
import * as R from '../src/registration.mjs';
import * as C from '../src/competitions.mjs';
import {number,parseNumber,formatInput,nationality} from '../src/locale.mjs';
import {mailParagraphs,upgradeMessages} from '../src/mail.mjs';
const db=JSON.parse(fs.readFileSync(new URL('../public/data/database.json',import.meta.url)));
const base=E.newGame(db,'e83','Kiểm thử',812);
const fresh=()=>structuredClone(base);

test('Vietnamese numbers round trip without silently changing monetary value',()=>{
 for(const n of [0,1,1000,144437842,72218921,2122740,1e12,-124000])assert.equal(parseNumber(number(n)),n);
 assert.equal(number(1234567.89,2),'1.234.567,89');assert.equal(parseNumber('1.234.567,89'),1234567.89);assert.equal(formatInput('1234567,89'),'1.234.567,89');assert.equal(formatInput('1.234.567,'),'1.234.567,');
 for(const s of ['','1.2','1,2,3','1.234,','1e6','NaN','12.34.567'])assert.ok(Number.isNaN(parseNumber(s)),s);
 assert.equal(E.money(144437842),'144.437.842 €');assert.equal(nationality({countryCode:'ESP'}),'Tây Ban Nha');
});
test('all eight countries have three playable tiers and every club has a real source',()=>{
 for(const code of ['EN','DE','FR','IT','ES','PT','NL','VN'])for(const tier of [1,2,3]){const leagues=db.leagues.filter(l=>l.countryCode===code&&l.tier===tier);assert.ok(leagues.length,code+tier);for(const l of leagues)assert.equal(db.clubs.filter(c=>c.leagueId===l.id).length,l.expectedTeams,l.name);}
 for(const c of db.clubs)assert.match(c.sourceUrl,/^https:\/\//);
 const names=db.clubs.map(c=>c.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase());assert.equal(new Set(names).size,names.length);
 for(const c of db.clubs)assert.ok(db.players.some(p=>p.clubId===c.id&&p.position==='GK'),c.name+' has a goalkeeper');
 assert.equal(db.clubs.find(c=>c.id==='e21615').leagueId,'por.2');assert.ok(!db.clubs.some(c=>c.id==='f212820'));
 for(const p of db.players){assert.ok(db.clubs.some(c=>c.id===p.clubId));assert.match(p.sourceUrl,/^https:\/\//);assert.notEqual(p.fictional,true);}
 assert.ok(db.leagues.filter(l=>l.id.startsWith('vie.3')).every(l=>l.provisional&&l.dataNote));
});
test('UEFA source membership and generated opponents are complete, unique and balanced',()=>{
 const g=fresh(),all=new Set();assert.equal(g.cups.length,3);
 for(const c of g.cups){assert.equal(c.participants.length,36);for(const id of c.participants){assert.ok(g.clubs[id]);assert.ok(!all.has(id));all.add(id);const fs=g.fixtures.filter(f=>f.leagueId===c.id&&(f.home===id||f.away===id));assert.equal(fs.length,c.matchdays);assert.equal(fs.filter(f=>f.home===id).length,c.matchdays/2);assert.equal(new Set(fs.map(f=>f.home===id?f.away:f.home)).size,c.matchdays);}}
 assert.ok(g.cups.find(c=>c.id==='uefa.champions').participants.includes('e83'));assert.ok(g.cups.find(c=>c.id==='uefa.champions').participants.includes('e359'));
 for(let r=0;r<g.calendar.length;r++){const teams=g.fixtures.filter(f=>f.round===r).flatMap(f=>[f.home,f.away]);assert.equal(new Set(teams).size,teams.length,'double booking '+r);}
});
test('home-grown slots depend on training, never nationality; club reservation is enforced',()=>{
 const g=fresh(),ps=E.clubPlayers(g,g.clubId);for(const p of ps){p.training={reviewed:true};p.homegrown={};p.birthDate='1995-01-01';p.countryCode='ESP';}
 const selected=ps.slice(0,25);let r=R.registrationReport(g,'uefa.champions',g.clubId,selected.map(p=>p.id));assert.equal(r.capacity,17);assert.equal(r.hg,0);assert.equal(r.valid,false);
 selected.slice(0,8).forEach(p=>p.training={associations:['ES']});r=R.registrationReport(g,'uefa.champions',g.clubId,selected.map(p=>p.id));assert.equal(r.capacity,21);
 selected.slice(0,4).forEach(p=>p.training.clubs=[g.clubId]);r=R.registrationReport(g,'uefa.champions',g.clubId,selected.map(p=>p.id));assert.equal(r.capacity,25);assert.equal(r.ct,4);assert.equal(r.hg,8);
});
test('UEFA List B requires training as well as age, domestic U21 and Italian U22 have their own cutoffs',()=>{
 const g=fresh(),p=E.clubPlayers(g,g.clubId)[0];p.training={};p.birthDate='2005-01-01';assert.equal(R.exemptPlayer(g,p,'eng.1'),true);assert.equal(R.exemptPlayer(g,p,'uefa.champions'),false);
 p.training.listBClubs=[g.clubId];assert.equal(R.exemptPlayer(g,p,'uefa.champions'),true);p.birthDate='2004-12-31';assert.equal(R.exemptPlayer(g,p,'eng.1'),false);assert.equal(R.exemptPlayer(g,p,'uefa.champions'),false);assert.equal(R.exemptPlayer(g,p,'ita.1'),true);p.birthDate='2003-12-31';assert.equal(R.exemptPlayer(g,p,'ita.1'),false);
 p.birthDate='';assert.equal(R.exemptPlayer(g,p,'eng.1'),false);
});
test('non-registered players cannot enter a UEFA match; saving a legal list enables selection',()=>{
 const g=fresh(),f=g.fixtures.find(f=>f.leagueId==='uefa.champions'&&(f.home===g.clubId||f.away===g.clubId));g.round=f.round;g.date=f.date;E.repairLineup(g);
 const p=E.clubPlayers(g,g.clubId).find(p=>!R.registered(g,p,f.leagueId));assert.ok(p);g.lineup[10]=p.id;assert.throws(()=>E.createMatch(g,f),/đăng ký/);assert.throws(()=>E.assignSlot(g,10,p.id),/đăng ký/);
 const ids=R.autoRegistration(g,f.leagueId,g.clubId,E.overall);R.saveRegistration(g,f.leagueId,ids);E.repairLineup(g);assert.ok(E.createMatch(g,f));assert.equal(R.registered(g,p,'esp.1'),true);
});
test('an edited training profile cannot bypass a now-invalid squad quota at kickoff',()=>{
 const g=fresh(),f=g.fixtures.find(f=>f.leagueId==='uefa.champions'&&(f.home===g.clubId||f.away===g.clubId));g.round=f.round;
 const pool=E.clubPlayers(g,g.clubId);for(const p of pool){p.birthDate='1995-01-01';p.training={};}
 const selected=[...pool.filter(p=>p.position==='GK'),...pool.filter(p=>p.position!=='GK')].slice(0,25);
 selected.slice(0,8).forEach((p,i)=>p.training={associations:['ES'],clubs:i<4?[g.clubId]:[]});
 R.saveRegistration(g,f.leagueId,selected.map(p=>p.id));E.repairLineup(g);assert.ok(E.createMatch(g,f));
 selected.forEach(p=>p.training={});assert.throws(()=>E.createMatch(g,f),/Danh sách đăng ký chưa hợp lệ/);
});
test('reviewed club biographies provide separate UEFA training evidence and age-qualified List B',()=>{
 const g=fresh();for(const id of ['e323703','e368992','e250465','e323702','e354334','e376423','e362150']){const p=g.players[id],s=R.trainingStatus(g,p,'uefa.champions');assert.equal(s.club,true);assert.equal(s.derived,true);assert.match(s.source,/fcbarcelona.com/);assert.ok(s.evidence);}
 assert.equal(R.exemptPlayer(g,g.players.e362150,'uefa.champions'),true);assert.equal(R.exemptPlayer(g,g.players.e323703,'uefa.champions'),false);
 assert.equal(R.trainingStatus(g,g.players.e280555,'uefa.champions').club,true);
});
test('mail has distinct identities, durable read status and frozen send-time financial details',()=>{
 const g=fresh();E.addMessage(g,'Thư một','Nội dung một','board');E.addMessage(g,'Thư hai','Nội dung hai','board');assert.notEqual(g.messages[0].id,g.messages[1].id);const before=[...mailParagraphs(g.messages[0],g)];g.clubs[g.clubId].cash+=1e9;assert.deepEqual(mailParagraphs(g.messages[0],g),before);g.messages[0].readAt=g.date;
 const restored=JSON.parse(JSON.stringify(g));upgradeMessages(restored);assert.equal(restored.messages[0].readAt,g.date);assert.ok(restored.messages[0].paragraphs.length>=5);assert.equal(restored.messages[1].readAt,null);
 for(let i=0;i<280;i++)E.addMessage(g,'Tin '+i,'Nội dung','news');assert.equal(new Set(g.messages.map(m=>m.id)).size,250);
});
test('schema-1 migration preserves edits and transfers; active season waits for next season expansion',()=>{
 const leagues=db.leagues.filter(l=>l.tier===1),clubs=db.clubs.filter(c=>leagues.some(l=>l.id===c.leagueId));const original={meta:db.meta,leagues,clubs,players:db.players.filter(p=>clubs.some(c=>c.id===p.clubId))};
 const g=E.newGame(original,'e83','Old',123);g.schema=1;delete g.cups;delete g.calendar;delete g.registrations;g.fixtures=original.leagues.flatMap(l=>E.schedule(original.clubs.filter(c=>c.leagueId===l.id).map(c=>c.id),l.id,g.year));
 g.players.e347568=E.profile({...db.players.find(p=>p.id==='e347568'),clubId:'e102'},g.clubs.e102);E.invalidateRosters(g);
 E.editClub(g,g.clubId,{cash:123456789,budget:76543210,wageBudget:9876543});const p=g.players[g.lineup[0]];p.attributes.reflexes=20;g.messages[0].readAt=g.date;const id=g.id,xi=[...g.lineup],rng=g.rng;
 const upgraded=E.migrateGame(g,db);assert.equal(upgraded.id,id);assert.equal(upgraded.rng,rng);assert.equal(upgraded.clubs[g.clubId].cash,123456789);assert.equal(upgraded.players[p.id].attributes.reflexes,20);assert.deepEqual(upgraded.lineup,xi);assert.equal(upgraded.cups.length,3);assert.ok(E.validateGame(upgraded));assert.equal(E.migrateGame(upgraded,db).messages.length,upgraded.messages.length);assert.equal(upgraded.players.e347568.clubId,'f161771');
 const transferred=structuredClone(g);transferred.players.e347568.clubId='e83';transferred.transfers.unshift({id:'e347568',from:'e102',to:'e83'});assert.equal(E.migrateGame(transferred,db).players.e347568.clubId,'e83');
 E.advanceRound(g);const fixtures=structuredClone(g.fixtures),round=g.round;const mid=E.migrateGame(g,db);assert.deepEqual(mid.fixtures,fixtures);assert.equal(mid.round,round);assert.equal(mid.cups.length,0);assert.equal(mid.pendingExpansion.length,3);assert.ok(E.validateGame(mid));
});
test('knockout aggregate uses no away-goal rule and penalties do not inflate match score',()=>{
 const g=fresh(),c=g.cups[0],[a,b]=c.participants;const first={id:'leg1',tieId:'tie',leg:1,legs:2,home:a,away:b,result:{score:[2,1]}};const last={id:'leg2',tieId:'tie',leg:2,legs:2,home:b,away:a};g.fixtures.push(first,last);const m={minute:120,score:[1,0],events:[],rng:2};C.settleKnockout(g,last,m,E.random);assert.deepEqual(m.aggregate,[2,2]);assert.ok(m.penalties);assert.notEqual(m.penalties[0],m.penalties[1]);assert.deepEqual(m.score,[1,0]);assert.ok([a,b].includes(m.winner));
});
test('complete two seasons resolve all European ties and conserve league sizes through promotion',()=>{
 const g=fresh();const sizes=()=>Object.fromEntries(g.leagues.filter(l=>l.kind!=='external').map(l=>[l.id,Object.values(g.clubs).filter(c=>c.leagueId===l.id).length]));const before=sizes();const initialClubs=Object.keys(g.clubs).sort();
 for(let season=0;season<2;season++){
  while(g.round<E.maxRounds(g))E.advanceRound(g);assert.ok(g.fixtures.every(f=>f.result));
  for(const c of g.cups){assert.equal(c.stage,'complete');assert.ok(c.participants.includes(c.champion));assert.equal(g.fixtures.filter(f=>f.leagueId===c.id&&f.stage==='final').length,1);assert.ok(E.table(g,c.id).every(r=>r.played===c.matchdays));}
  assert.ok(E.validateGame(g));E.nextSeason(g);assert.deepEqual(sizes(),before);assert.deepEqual(Object.keys(g.clubs).sort(),initialClubs);assert.equal(new Set(g.cups.flatMap(c=>c.participants)).size,108);assert.ok(g.history[0].movements.length>0);assert.ok(g.history[0].movements.every(m=>m.from!=='ned.3'&&m.to!=='ned.3'));assert.ok(E.validateGame(g));
 }
 assert.equal(g.year,2028);assert.equal(g.history.length,2);
});
test('schema-2 validator rejects malformed UEFA participants, calendar, registration and messages',()=>{
 for(const corrupt of [g=>g.cups[0].participants[1]=g.cups[0].participants[0],g=>g.calendar[1].date=g.calendar[0].date,g=>g.registrations['uefa.champions'][g.clubId].push('unknown'),g=>g.messages[0].paragraphs=[42]]){const g=fresh();corrupt(g);assert.throws(()=>E.validateGame(g));}
});
