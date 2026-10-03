import test from 'node:test';
import assert from 'node:assert/strict';
import {initializeInternational,internationalCalendarEntries,internationalAvailability,nationalTeamId,processInternationalDate,respondToCallUp,validateInternational,internationalTable} from '../src/international.mjs';
import {internationalWindows} from '../src/international-data.mjs';

function fresh(date='2026-08-15'){
 const countries=['ENG','ESP','FRA','GER','ITA','NED','POR','VIE','JPN','AUS','KOR','IDN'],g={id:'national-review',date,year:2026,rng:814,round:5,clubId:'c0',manager:'Review',messages:[],transfers:[],ledger:[],fixtures:[],calendar:[{date,kind:'domestic',week:5}],lineup:[],clubs:{},players:{}};
 for(let i=0;i<4;i++)g.clubs['c'+i]={id:'c'+i,name:'Club '+i,cash:1e7,budget:5e6};
 for(let team=0;team<countries.length;team++)for(let i=0;i<28;i++){const id=`p-${team}-${i}`,position=i<3?'GK':i<12?'DF':i<21?'MF':'FW';g.players[id]={id,name:id,countryCode:countries[team],nationality:countries[team]==='VIE'?'Việt Nam':'',clubId:'c'+(i%4),position,fitness:100,morale:80,injury:0,suspension:0,attributes:Object.fromEntries(['reflexes','handling','positioning','composure','tackling','heading','strength','passing','vision','teamwork','dribbling','finishing','pace'].map(k=>[k,12+i%6])),appearances:5,goals:1,assists:2,seasonMinutes:430,competitionStats:{test:{apps:5}},contractTerms:{appearanceBonus:200}};}
 return g;
}
const at=(g,date)=>{g.date=date;return processInternationalDate(g,date);};
const ownCalls=g=>g.international.callups.filter(c=>g.players[c.playerId].clubId===g.clubId);
const clubStats=g=>Object.fromEntries(Object.values(g.players).map(p=>[p.id,{clubId:p.clubId,appearances:p.appearances,goals:p.goals,assists:p.assists,seasonMinutes:p.seasonMinutes,suspension:p.suspension,competitionStats:p.competitionStats,contractTerms:p.contractTerms}]));

test('verified FIFA dates and optional camp are distinct, with complete notice and return calendar entries',()=>{
 const w=internationalWindows(2026);assert.deepEqual(w.filter(w=>w.kind==='window').map(w=>[w.start,w.end]),[['2026-03-23','2026-03-31'],['2026-06-01','2026-06-09'],['2026-09-21','2026-10-06'],['2026-11-09','2026-11-17']]);
 assert.equal(w.find(w=>w.start==='2026-09-21').matchDates.length,4);assert.equal(w.find(w=>w.kind==='friendly').mandatory,false);
 const asia=internationalWindows(2027).find(w=>w.kind==='asian');assert.equal(asia.start,'2026-12-28');assert.equal(asia.end,'2027-02-05');assert.equal(asia.scope,'AFC');
 const g=fresh(),before=structuredClone(g),entries=internationalCalendarEntries(g);assert.deepEqual(g,before);assert.equal(new Set(entries.map(e=>e.date)).size,entries.length);assert.ok(entries.some(e=>e.date==='2026-09-14'));assert.ok(entries.some(e=>e.date==='2026-10-07'));assert.ok(entries.every(e=>e.kind==='international'&&e.date>=g.date));
 assert.ok(internationalWindows(2031).every(w=>w.officialDates===false));
});
test('nationality normalization preserves British home nations and handles public database aliases',()=>{
 for(const [p,id]of [[{countryCode:'ENG'},'ENG'],[{countryCode:'GB',nationality:'Scotland'},'SCO'],[{countryCode:'GB',nationality:'England'},'ENG'],[{countryCode:'GB'},null],[{countryCode:'SBA'},'RS'],[{countryCode:'KORS'},'KR'],[{countryCode:'RDC'},'CD'],[{countryCode:'CRM'},'CM'],[{countryCode:'',nationality:'Việt Nam'},'VN'],[{countryCode:'',nationality:'Bỉ'},'BE']])assert.equal(nationalTeamId(p),id);
});
test('initialization is additive and idempotent, preserves a live club save and never releases players during it',()=>{
 const g=fresh();g.liveMatch={fixtureId:'club-live',minute:19,rng:99};const before=structuredClone(g);initializeInternational(g);const {international,...unchanged}=g;assert.deepEqual(unchanged,before);assert.equal(international.callups.length,0);assert.equal(Object.values(g.players).filter(p=>p.internationalDuty).length,0);const initialized=structuredClone(g);initializeInternational(g);assert.deepEqual(g,initialized);assert.equal(processInternationalDate(g,'2026-09-24').ok,false);assert.deepEqual(g,initialized);assert.ok(validateInternational(g));
});
test('mandatory calls require release, while injury exemption requires current injury and a documented reason',()=>{
 const g=fresh();initializeInternational(g);at(g,'2026-09-14');const calls=ownCalls(g);assert.ok(calls.length);const c=calls[0],p=g.players[c.playerId];assert.equal(c.status,'announced');assert.throws(()=>respondToCallUp(g,c.id,{accept:false,reason:'Need for club game'}));p.injury=2;assert.throws(()=>respondToCallUp(g,c.id,{accept:false}));respondToCallUp(g,c.id,{accept:false,reason:'Confirmed muscle injury'});assert.equal(c.status,'exempt');at(g,'2026-09-21');assert.equal(p.internationalDuty,undefined);const active=calls.find(x=>x.status==='released');assert.ok(active);assert.equal(internationalAvailability(g,g.players[active.playerId]),false);assert.ok(validateInternational(g));
});
test('outside-window release requires human opt-in and AI clubs refuse when club fixtures clash',()=>{
 const g=fresh('2026-11-25');g.fixtures=[{id:'ai-club',date:'2026-12-03',home:'c1',away:'c2',result:null}];initializeInternational(g);processInternationalDate(g);const own=ownCalls(g);assert.ok(own.every(c=>c.status==='pending'));respondToCallUp(g,own[0].id,{accept:true});respondToCallUp(g,own[1].id,{accept:false,reason:'Keep for next club match'});assert.equal(own[1].status,'declined');assert.ok(g.international.callups.filter(c=>['c1','c2'].includes(c.clubId)).every(c=>c.status==='declined'));
 // A newly inserted club fixture after the invitation is checked again at departure.
 g.fixtures.push({id:'late',date:'2026-12-04',home:'c3',away:'c2',result:null});at(g,'2026-12-02');assert.equal(own[0].status,'released');assert.equal(own[2].status,'declined');assert.ok(g.international.callups.filter(c=>c.clubId==='c3').every(c=>c.status==='declined'));assert.ok(validateInternational(g));
});
test('national matches keep club stats, money, fixtures and match RNG separate; duty clears on return',()=>{
 const g=fresh(),stats=clubStats(g),clubs=structuredClone(g.clubs),fixtures=structuredClone(g.fixtures),calendar=structuredClone(g.calendar),rng=g.rng;initializeInternational(g);at(g,'2026-10-07');assert.ok(g.international.matches.some(f=>f.result&&!f.result.cancelled));assert.ok(Object.values(g.players).some(p=>p.nationalStats?.appearances>0));assert.deepEqual(clubStats(g),stats);assert.deepEqual(g.clubs,clubs);assert.deepEqual(g.fixtures,fixtures);assert.deepEqual(g.calendar,calendar);assert.equal(g.rng,rng);assert.deepEqual(g.ledger,[]);assert.ok(Object.values(g.players).every(p=>!p.internationalDuty));assert.ok(Object.values(g.players).every(p=>p.fitness>=0&&p.fitness<=100&&p.morale>=0&&p.morale<=100));assert.ok(validateInternational(g));
});
test('national RNG and results continue deterministically across save/reload with no duplicate date processing',()=>{
 const a=fresh();initializeInternational(a);at(a,'2026-09-24');const b=JSON.parse(JSON.stringify(a));at(a,'2026-10-07');at(b,'2026-10-07');assert.deepEqual(a,b);const done=structuredClone(a);processInternationalDate(a);assert.deepEqual(a,done);assert.ok(internationalTable(a,'nations-2026').some(r=>r.played>0));
});
test('national recovery accrues by elapsed days once, without touching the club calendar',()=>{
 const g=fresh();initializeInternational(g);at(g,'2026-09-21');const p=Object.values(g.players).find(p=>p.internationalDuty);p.fitness=40;at(g,'2026-09-22');assert.equal(p.fitness,43);processInternationalDate(g);assert.equal(p.fitness,43);at(g,'2026-09-23');assert.equal(p.fitness,46);
});
test('legacy mid-window upgrade does not replay past national matches or results',()=>{
 const g=fresh('2026-10-01');initializeInternational(g);processInternationalDate(g);assert.ok(g.international.matches.every(f=>f.date>=g.international.startedAt));assert.ok(g.international.matches.every(f=>!f.result||f.date===g.international.startedAt));assert.ok(validateInternational(g));
});
test('Asian Cup produces a simulated champion and returns all players after the sourced tournament period',()=>{
 const g=fresh('2026-12-01');initializeInternational(g);at(g,'2027-01-24');const eliminated=g.international.callups.filter(c=>c.windowId==='asian-2027'&&c.to<'2027-02-06');assert.ok(eliminated.length);assert.ok(eliminated.every(c=>c.status!=='released'&&!g.players[c.playerId].internationalDuty));at(g,'2027-02-06');const cup=g.international.competitions.find(c=>c.id==='asian-2027');assert.ok(cup);assert.ok(cup.champion);assert.ok(cup.limitation.includes('24'));assert.ok(Object.values(g.players).every(p=>!p.internationalDuty));assert.ok(validateInternational(g));
});
test('validation rejects dangling or malformed duty, stats, fixtures and legacy national fields',()=>{
 const g=fresh();initializeInternational(g);at(g,'2026-09-24');for(const change of [g=>g.international.rng=-1,g=>g.international.matches[0].home='missing',g=>g.international.callups[0].playerId='missing',g=>{const p=Object.values(g.players).find(p=>p.internationalDuty);p.internationalDuty.callUpId='missing';},g=>{const p=Object.values(g.players).find(p=>p.nationalStats);p.nationalStats.goals=-1;}]){const bad=structuredClone(g);change(bad);assert.throws(()=>validateInternational(bad));}const old=fresh();old.players['p-0-0'].nationalStats={appearances:0,goals:0,minutes:0};assert.throws(()=>validateInternational(old));
});
