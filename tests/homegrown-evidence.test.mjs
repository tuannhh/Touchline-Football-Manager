import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {normalizeCareerPeriods} from '../scripts/homegrown-history-data.mjs';
import {mergeHomegrown,assessTrainingHistory,officialUefaRegistration} from '../src/homegrown.mjs';
import {autoRegistration,trainingStatus,registrationReport,exemptPlayer,officialUefaSelection,saveRegistration} from '../src/registration.mjs';
const p={id:'p',name:'Known Player',birthDate:'2005-01-01',clubId:'a',position:'CM'};
const entry=(teamId,startDate,endDate,extra={})=>({teamId,team:teamId===1?'Club A':'Club B',participantId:99,startDate,endDate,...extra});
const profile=entries=>({id:99,name:p.name,birthDate:{utcTime:p.birthDate},careerHistory:{careerItems:{senior:{teamEntries:entries}}}});
const options={observedAt:'2026-10-05',resolveTeam:e=>({clubId:e.teamId===1?'a':'b',association:e.teamId===1?'EN':'ES',source:'https://www.fotmob.com/teams/'+e.teamId})};
const game=()=>({year:2026,date:'2026-10-05',clubId:'a',leagues:[{id:'eng.1',countryCode:'EN'},{id:'esp.1',countryCode:'ES'}],clubs:{a:{leagueId:'eng.1'},b:{leagueId:'esp.1'}},players:{p:structuredClone(p)},registrations:{'uefa.champions':{a:['p']}}});
const evidence=(extra={})=>({id:p.id,name:p.name,birthDate:p.birthDate,periods:[],uefaSquads:[{clubId:'a',competitionId:'uefa.champions',season:'2026/27',list:'B',observedAt:'2026-10-05',source:'https://www.uefa.com/uefachampionsleague/clubs/52280--arsenal/squad/'}],...extra});
const merge=(g,row)=>mergeHomegrown(g,{players:{p:row}});

test('career importer rejects wrong identity, uncertain entries, wrong participants and national teams',()=>{
 const raw=profile([entry(1,'2020-01-01','2023-01-01'),entry(1,'2010-01-01','2020-01-01',{hasUncertainData:true}),entry(1,'2010-01-01','2020-01-01',{participantId:100})]);
 raw.careerHistory.careerItems.nationalTeam={teamEntries:[entry(2,'2010-01-01','2026-01-01')]};
 assert.equal(normalizeCareerPeriods(p,raw,options).length,1);
 assert.equal(normalizeCareerPeriods({...p,birthDate:'2005-02-01'},raw,options).length,0);
 assert.equal(normalizeCareerPeriods({...p,name:'Another Player'},raw,options).length,0);
});
test('unresolved foreign loan still cuts overlapping parent and academy history',()=>{
 const raw=profile([entry(1,'2020-01-01','2024-01-01'),entry(2,'2021-01-01','2022-12-31',{transferType:{localizationKey:'on_loan'}})]);
 const periods=normalizeCareerPeriods(p,raw,{...options,resolveTeam:e=>e.teamId===1?options.resolveTeam(e):null});
 assert.deepEqual(periods.map(x=>[x.start,x.end]),[['2020-01-01','2020-12-31'],['2023-01-01','2024-01-01']]);
 const assessment=assessTrainingHistory({...p,homegrownVerified:{periods}},'a','EN','2026-10-05');assert.equal(assessment.club,false);assert.equal(assessment.listB,false);
 const resolved=normalizeCareerPeriods(p,raw,options);assert.ok(resolved.some(x=>x.isLoan&&x.association==='ES'));assert.equal(assessTrainingHistory({...p,homegrownVerified:{periods:resolved}},'a','EN','2026-10-05').club,false);
});
test('inclusive July-to-June provider dates count a full 36 months and never count future time',()=>{
 const periods=normalizeCareerPeriods(p,profile([entry(1,'2020-07-01','2023-06-30')]),options);
 assert.equal(assessTrainingHistory({...p,homegrownVerified:{periods}},'a','EN','2023-07-01').club,true);
 assert.equal(assessTrainingHistory({...p,homegrownVerified:{periods}},'a','EN','2023-06-29').club,false);
 const open=normalizeCareerPeriods(p,profile([entry(1,'2025-01-01',null)]),options);assert.equal(open[0].end,'2026-10-05');
});
test('List A is registration evidence, never evidence of local training',()=>{
 const g=game(),row=evidence();row.uefaSquads[0].list='A';merge(g,row);const s=trainingStatus(g,g.players.p,'uefa.champions');assert.equal(s.club,false);assert.equal(s.association,false);assert.equal(s.known,false);assert.equal(exemptPlayer(g,g.players.p,'uefa.champions'),false);assert.equal(officialUefaSelection(g,'uefa.champions').length,1);assert.equal(officialUefaSelection(g,'uefa.europa').length,0);
});
test('direct UEFA List B evidence is scoped to observation date, season, club, age and manual override',()=>{
 const g=game();merge(g,evidence());const player=g.players.p;
 assert.equal(exemptPlayer(g,player,'uefa.champions'),true);assert.equal(trainingStatus(g,player,'uefa.champions').club,false);
 g.date='2026-08-15';assert.equal(exemptPlayer(g,player,'uefa.champions'),false);
 g.date='2026-10-05';player.clubId='b';assert.equal(exemptPlayer(g,player,'uefa.champions'),false);assert.equal(officialUefaRegistration(g,player),null);
 player.clubId='a';g.year=2027;assert.equal(exemptPlayer(g,player,'uefa.champions'),false);g.year=2026;
 player.birthDate='2004-12-31';assert.equal(exemptPlayer(g,player,'uefa.champions'),false);player.birthDate=p.birthDate;
 player.training={reviewed:true,clubs:[],associations:[],listBClubs:[]};assert.equal(exemptPlayer(g,player,'uefa.champions'),false);
});
test('UEFA youth may occupy A training/GK places without being counted twice; domestic U21 stays exempt',()=>{
 const g=game();g.players.p.position='GK';g.players.p.training={reviewed:true,clubs:['a'],associations:['EN'],listBClubs:['a']};
 let r=registrationReport(g,'uefa.champions','a',['p']);assert.equal(r.a.length,1);assert.equal(r.b.length,0);assert.equal(r.ct,1);assert.equal(r.capacity,18);
 r=registrationReport(g,'uefa.champions','a',[]);assert.equal(r.a.length,0);assert.equal(r.b.length,1);assert.equal(r.ct,0);
 r=registrationReport(g,'eng.1','a',['p']);assert.equal(r.a.length,0);assert.equal(r.b.length,1);
});
test('missing academy history is not a negative flag; complete foreign history may establish non-local status',()=>{
 const raw=profile([entry(2,'2018-01-01','2026-10-05')]);let periods=normalizeCareerPeriods(p,raw,options);
 assert.equal(assessTrainingHistory({...p,homegrownVerified:{periods}},'a','EN','2026-10-05').known,true);
 assert.equal(assessTrainingHistory({...p,homegrownVerified:{periods}},'a','','2026-10-05').known,false);
 periods=normalizeCareerPeriods(p,profile([entry(2,'2024-01-01','2026-10-05')]),options);
 assert.equal(assessTrainingHistory({...p,homegrownVerified:{periods}},'a','EN','2026-10-05').known,false);
});
test('refresh and save round trip retain manual training, submitted list and gameplay',()=>{
 const g=game();g.date='2028-12-01';g.year=2028;g.players.p.attributes={passing:97};g.players.p.training={reviewed:true,clubs:['a']};
 const before=structuredClone(g);merge(g,evidence());merge(g,{id:'p',name:p.name,birthDate:p.birthDate,pl:{association:true}});
 const restored=JSON.parse(JSON.stringify(g));assert.deepEqual(restored.registrations,before.registrations);assert.deepEqual(restored.players.p.training,before.players.p.training);assert.deepEqual(restored.players.p.attributes,before.players.p.attributes);assert.equal(restored.date,before.date);assert.equal(restored.players.p.homegrownVerified.uefaSquads.length,1);
});

const db=JSON.parse(fs.readFileSync(new URL('../public/data/database.json',import.meta.url))),index=JSON.parse(fs.readFileSync(new URL('../public/data/homegrown.json',import.meta.url)));
function sourcedGame(){const g={year:2026,date:'2026-08-15',leagues:db.leagues,clubs:Object.fromEntries(db.clubs.map(c=>[c.id,c])),players:Object.fromEntries(db.players.map(p=>[p.id,structuredClone(p)]))};mergeHomegrown(g,index);return g;}
test('source index covers all 36 UCL clubs and matches identities without inventing missing academy players',()=>{
 assert.equal(index.meta.uefaClubs.length,36);assert.equal(index.meta.uefaMatched,901);assert.equal(index.meta.uefaListB,114);assert.ok(index.meta.careerProfiles>4400);
 assert.equal(index.players.e236322.uefaSquads[0].list,'A');assert.equal(index.players.e236322.uefaSquads[0].sourcePlayerName,'Gabriel');
 for(const row of Object.values(index.players)){const player=db.players.find(p=>p.id===row.id);assert.equal(player.name,row.name);assert.equal(player.birthDate,row.birthDate);}
});
test('Arsenal, Barcelona and Liverpool official A drafts are valid with sourced training and two A keepers',()=>{
 const g=sourcedGame();for(const id of ['e359','e83','e364']){g.clubId=id;const ids=officialUefaSelection(g,'uefa.champions',id),report=registrationReport(g,'uefa.champions',id,ids);assert.equal(report.valid,true,g.clubs[id].name+': '+report.errors.join(' '));assert.ok(report.hg>=6);assert.doesNotThrow(()=>saveRegistration(g,'uefa.champions',ids));}
});
test('auto selection remains within quota and keeps two A keepers, even when both qualify for B',()=>{
 const g=sourcedGame();const id='e83',keepers=Object.values(g.players).filter(p=>p.clubId===id&&p.position==='GK');for(const p of keepers){p.birthDate='2006-01-01';p.training={reviewed:true,clubs:[id],associations:['ES'],listBClubs:[id]};}
 const ids=autoRegistration(g,'uefa.champions',id,()=>50),r=registrationReport(g,'uefa.champions',id,ids);assert.equal(r.valid,true);assert.ok(r.a.filter(p=>p.position==='GK').length>=2);assert.ok(r.a.length<=r.capacity);assert.ok(r.a.every(p=>!r.b.includes(p)));
});
test('reviewed Arsenal and Liverpool academy histories count as AT, not current-club CT',()=>{
 const g=sourcedGame();for(const name of ['David Raya','Ben White','Ezri Konsa','Eberechi Eze','Joe Gomez','Freddie Woodman']){const p=Object.values(g.players).find(x=>x.name===name),s=trainingStatus(g,p,'uefa.champions');assert.equal(s.association,true,name);assert.equal(s.club,false,name);}
 const mc=Object.values(g.players).find(x=>x.name==='James McConnell');assert.equal(trainingStatus(g,mc,'uefa.champions').club,true);
 assert.ok(index.players.e231859.periods.every(x=>x.association!=='VN'),'Unknown team ID -1 must never map to a Vietnamese club');
});
