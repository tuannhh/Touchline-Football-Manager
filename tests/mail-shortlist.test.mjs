import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildMailEntityIndex,linkMailText,mailPlayerIds} from '../src/mailEntities.mjs';
import {addMonths,initializeShortlist,trackPlayer,untrackPlayer,toggleShortlist,refreshShortlist,shortlistStatus,validateShortlist} from '../src/shortlist.mjs';
import {competitionTeamStats,competitionPlayerStats} from '../src/competitionStats.mjs';
import {newGame,migrateGame,validateGame} from '../src/engine.mjs';
import {beginNegotiation,submitClubOffer,getNegotiation,processNegotiationReplies} from '../src/transfers.mjs';
import {advanceCareerDay} from '../src/dailyCalendar.mjs';

const small=()=>({date:'2026-08-31',clubId:'ars',shortlist:[],players:{p:{id:'p',name:'William Saliba',clubId:'ars'},q:{id:'q',name:'Lamine Yamal',clubId:'bar'}},clubs:{ars:{id:'ars',name:'Arsenal',shortName:'Arsenal',leagueId:'eng'},bar:{id:'bar',name:'Barcelona',leagueId:'esp'}},leagues:[{id:'eng',name:'Premier League'},{id:'esp',name:'La Liga'}],cups:[{id:'cl',name:'UEFA Champions League',shortName:'Champions League',participants:['ars','bar']}]});
test('mail names resolve players, clubs and competitions with word boundaries and longest match',()=>{
 const g=small(),index=buildMailEntityIndex(g),text='William Saliba (Arsenal) gặp Lamine Yamal — Barcelona tại UEFA Champions League. ArsenalFan không phải Arsenal.';
 const parts=linkMailText(text,index);
 assert.equal(parts.map(p=>p.text).join(''),text);
 assert.deepEqual(parts.filter(p=>p.entity).map(p=>[p.entity.kind,p.entity.id]),[['player','p'],['club','ars'],['player','q'],['club','bar'],['competition','cl'],['club','ars']]);
 assert.equal(linkMailText('<script>Premier League</script>',index).map(p=>p.text).join(''),'<script>Premier League</script>');
});
test('ambiguous names stay plain unless mail metadata identifies exactly one player; metadata also supports old brief messages',()=>{
 const g=small();g.players.other={id:'other',name:'William Saliba',clubId:'bar'};const index=buildMailEntityIndex(g);
 assert.equal(linkMailText('William Saliba',index)[0].entity,undefined);
 assert.equal(linkMailText('William Saliba',index,{playerIds:['other']})[0].entity.id,'other');
 assert.deepEqual(mailPlayerIds({title:'Báo cáo',playerIds:['q','missing','q']},index,g),['q']);
});
test('calendar month arithmetic clamps to month ends and handles leap years',()=>{
 assert.equal(addMonths('2026-08-31',6),'2027-02-28');assert.equal(addMonths('2027-08-31',6),'2028-02-29');assert.equal(addMonths('2028-02-29',12),'2029-02-28');
});
test('legacy shortlist migration is idempotent, deduplicates and preserves expiry through a save roundtrip',()=>{
 const g=small();g.shortlist=['p','p','missing'];initializeShortlist(g);assert.deepEqual(g.shortlist,['p']);
 const copy=JSON.parse(JSON.stringify(g));initializeShortlist(copy);assert.deepEqual(copy,g);validateShortlist(copy);
 copy.date='2027-02-27';refreshShortlist(copy);assert.deepEqual(copy.shortlist,['p']);copy.date='2027-02-28';refreshShortlist(copy);assert.deepEqual(copy.shortlist,[]);
});
test('renewal uses the current date; removal persists and invalid durations cannot mutate state',()=>{
 const g=small();trackPlayer(g,'q',{months:3});g.date='2026-10-11';trackPlayer(g,'q',{months:12});assert.equal(g.shortlistEntries.q.expiresOn,'2027-10-11');
 const before=structuredClone(g);assert.throws(()=>trackPlayer(g,'q',{months:2}));assert.deepEqual(g,before);
 untrackPlayer(g,'q');refreshShortlist(g);assert.deepEqual(g.shortlist,[]);toggleShortlist(g,'q');assert.equal(g.shortlistEntries.q.months,6);
});
test('active offers are retained on tracking expiry, while ended or stale negotiations can expire',()=>{
 const g=small();trackPlayer(g,'q',{months:3});g.date='2026-11-30';g.negotiations=[{playerId:'q',buyerId:'ars',sellerId:'bar',stage:'club',expiresOn:'2026-12-02',pendingOffer:{replyOn:'2026-12-01'}}];
 refreshShortlist(g);assert.deepEqual(g.shortlist,['q']);assert.equal(shortlistStatus(g,'q'),'pending');
 g.date='2026-12-03';refreshShortlist(g);assert.deepEqual(g.shortlist,[]);assert.equal(shortlistStatus(g,'q'),'expired');
});
test('competition statistics include knockout rounds, exclude other competitions and penalties, and do not mutate world state',()=>{
 const g=small();g.fixtures=[{leagueId:'cl',home:'ars',away:'bar',stage:'league',result:{score:[2,0]}},{leagueId:'cl',home:'bar',away:'ars',stage:'final',result:{score:[1,1],penalties:[5,4]}},{leagueId:'eng',home:'ars',away:'bar',result:{score:[9,0]}}];
 g.players.p.competitionStats={cl:{appearances:2,goals:2,assists:1},eng:{appearances:1,goals:9}};g.players.q.competitionStats={cl:{appearances:2,goals:1,assists:2}};
 const before=structuredClone(g),rows=competitionTeamStats(g,'cl');assert.deepEqual(rows[0],{clubId:'ars',played:2,won:1,drawn:1,lost:0,gf:3,ga:1,cleanSheets:1});
 assert.equal(competitionPlayerStats(g,'cl')[0].p.id,'p');assert.equal(competitionPlayerStats(g,'cl','assists')[0].p.id,'q');assert.deepEqual(g,before);
});

const source=JSON.parse(fs.readFileSync(new URL('../public/data/database.json',import.meta.url)));
const leagues=source.leagues.filter(l=>l.tier===1&&l.kind!=='external'),clubs=leagues.flatMap(l=>source.clubs.filter(c=>c.leagueId===l.id).sort((a,b)=>(b.id==='e83')-(a.id==='e83')).slice(0,4)),ids=new Set(clubs.map(c=>c.id));
const db={...source,leagues,clubs,players:source.players.filter(p=>ids.has(p.clubId)),competitions:[]};
test('negotiation tracking and reply mail survive engine migration; rejection restarts chosen duration; daily advance expires watches',()=>{
 const g=newGame(db,'e83','Mailbox QA',42,{dailyCalendar:true});g.clubs.e83.reputation=100;
 const p=Object.values(g.players).find(p=>p.clubId!==g.clubId&&p.age>=25&&p.value<1e7);assert.ok(p);
 trackPlayer(g,p.id,{months:12});let d=beginNegotiation(g,p.id).deal;assert.ok(d);assert.ok(g.shortlist.includes(p.id));
 assert.equal(d.stage,'club');assert.ok(submitClubOffer(g,d.id,{fee:1,sellOnPercent:0}).ok);
 assert.equal(shortlistStatus(g,p.id),'pending');const clone=migrateGame(JSON.parse(JSON.stringify(g)),db);
 assert.deepEqual(getNegotiation(clone,p.id),d);assert.deepEqual(clone.shortlistEntries,g.shortlistEntries);assert.ok(validateGame(clone));
 g.date=d.pendingOffer.replyOn;processNegotiationReplies(g);assert.equal(d.stage,'rejected');assert.equal(g.shortlistEntries[p.id].expiresOn,addMonths(g.date,12));assert.ok(g.messages[0].playerIds.includes(p.id));
 const index=buildMailEntityIndex(g);assert.ok(mailPlayerIds(g.messages[0],index,g,g.messages[0].paragraphs).includes(p.id));
 const watched=Object.keys(g.players).find(id=>id!==p.id);trackPlayer(g,watched,{months:3});g.shortlistEntries[watched].expiresOn=g.date;
 advanceCareerDay(g);assert.ok(!g.shortlist.includes(watched));assert.ok(validateGame(g));
});
