import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mergeHomegrown,assessTrainingHistory} from '../src/homegrown.mjs';
import {trainingStatus,exemptPlayer,registrationReport} from '../src/registration.mjs';

const source='https://www.example-club.test/academy/player';
const period=(clubId,start,end,extra={})=>({clubId,association:'ES',start,end,verified:true,eligible:true,source,evidence:'Official academy chronology',...extra});
function game(birthDate='2005-01-01'){
 const p={id:'p',name:'Known Player',birthDate,clubId:'a',position:'CM',countryCode:'BRA'};
 return {year:2026,date:'2026-08-15',clubId:'a',leagues:[{id:'esp.1',countryCode:'ES'},{id:'eng.1',countryCode:'EN'}],clubs:{a:{leagueId:'esp.1'},b:{leagueId:'esp.1'},c:{leagueId:'eng.1'}},players:{p},registrations:{'uefa.champions':{a:['p']}}};
}
function enrich(g,periods,extra={}){return mergeHomegrown(g,{meta:{version:1},players:{p:{id:'p',name:'Known Player',birthDate:g.players.p.birthDate,periods,...extra}}});}

test('verified index merges idempotently without touching manual training, registration or gameplay',()=>{
 const g=game(),p=g.players.p;p.training={reviewed:true,clubs:[],associations:[],source:'Người chơi xác nhận trong Touchline Editor'};p.attributes={passing:99};
 const training=structuredClone(p.training),lists=structuredClone(g.registrations),before=structuredClone(p.attributes);
 assert.equal(enrich(g,[period('a','2020-01-01','2025-01-01')]).updated,1);
 assert.equal(enrich(g,[period('a','2020-01-01','2025-01-01')]).updated,0);
 assert.deepEqual(p.training,training);assert.deepEqual(g.registrations,lists);assert.deepEqual(p.attributes,before);
 assert.equal(trainingStatus(g,p,'uefa.champions').club,false);assert.equal(trainingStatus(g,p,'uefa.champions').override,true);
});
test('a user override wins even when the editor retained a legacy derived flag',()=>{
 const g=game(),p=g.players.p;enrich(g,[period('a','2020-01-01','2025-01-01')]);
 p.training={reviewed:true,derived:true,clubs:[],associations:[],source:'Người chơi xác nhận trong Touchline Editor'};
 assert.equal(trainingStatus(g,p,'uefa.champions').club,false);
});
test('CT stays with original club, association training survives domestic transfer, neither follows overseas',()=>{
 const g=game(),p=g.players.p;enrich(g,[period('a','2020-01-01','2023-01-01')]);
 assert.equal(trainingStatus(g,p,'uefa.champions').club,true);
 p.clubId='b';assert.equal(trainingStatus(g,p,'uefa.champions').club,false);assert.equal(trainingStatus(g,p,'uefa.champions').association,true);assert.equal(exemptPlayer(g,p,'uefa.champions'),false);
 p.clubId='c';assert.equal(trainingStatus(g,p,'uefa.champions').association,false);
});
test('legacy edited club-training evidence also retains its original association after a transfer',()=>{
 const g=game(),p=g.players.p;p.training={clubs:['a']};p.clubId='b';
 const status=trainingStatus(g,p,'uefa.champions');assert.equal(status.club,false);assert.equal(status.association,true);
});
test('36 calendar months count exactly and time before 15 or after 21 cannot pad the interval',()=>{
 const g=game('2000-06-15'),p=g.players.p;
 for(const [start,end,expected] of [['2015-06-15','2018-06-15',true],['2015-06-15','2018-06-14',false],['2013-06-15','2016-06-15',false],['2020-06-15','2024-06-15',false]]){
  p.homegrownVerified={periods:[period('a',start,end)]};assert.equal(assessTrainingHistory(p,'a','ES',g.date).club,expected,`${start}/${end}`);
 }
});
test('three verified entire seasons qualify inside expanded age bounds but not from year labels alone',()=>{
 const g=game('2000-06-15'),p=g.players.p;
 const seasons=[['2014-08-23','2015-05-23'],['2015-08-22','2016-05-15'],['2016-08-19','2017-05-21']].map(([start,end])=>({start,end,verified:true}));
 p.homegrownVerified={periods:[period('a','2014-08-01','2017-06-01',{entireSeasons:seasons})]};
 assert.equal(assessTrainingHistory(p,'a','ES',g.date).club,true);
 p.homegrownVerified.periods[0].entireSeasons=seasons.slice(0,2);assert.equal(assessTrainingHistory(p,'a','ES',g.date).club,false);
 p.homegrownVerified.periods[0].entireSeasons=['2014/15','2015/16','2016/17'];assert.equal(assessTrainingHistory(p,'a','ES',g.date).club,false);
 p.birthDate='2002-06-15';p.homegrownVerified.periods[0].entireSeasons=seasons;assert.equal(assessTrainingHistory(p,'a','ES',g.date).club,false);
});
test('overlapping evidence and duplicate entire seasons cannot be double counted',()=>{
 const g=game(),p=g.players.p;const one=period('a','2020-01-01','2022-01-01');
 p.homegrownVerified={periods:[one,structuredClone(one)]};assert.equal(assessTrainingHistory(p,'a','ES',g.date).club,false);
});
test('List B needs separate two-year continuous tenure, not the CT flag or three disconnected years',()=>{
 const g=game(),p=g.players.p;p.training={clubs:['a']};assert.equal(exemptPlayer(g,p,'uefa.champions'),false);
 p.training={};enrich(g,[period('a','2020-01-01','2021-01-01'),period('a','2022-02-01','2023-02-01'),period('a','2024-03-01','2025-03-01')]);
 assert.equal(trainingStatus(g,p,'uefa.champions').club,true);assert.equal(exemptPlayer(g,p,'uefa.champions'),false);
 enrich(g,[period('a','2020-01-01','2022-01-01')]);assert.equal(exemptPlayer(g,p,'uefa.champions'),true);
 p.birthDate='2004-12-31';assert.equal(exemptPlayer(g,p,'uefa.champions'),false);
});
test('List B 16-year-old exception requires the previous two years without interruption',()=>{
 const g=game('2009-12-31'),p=g.players.p;
 enrich(g,[period('a','2018-01-01','2026-10-03')]);assert.equal(exemptPlayer(g,p,'uefa.champions'),true);
 p.homegrownVerified.periods[0].end='2025-01-01';assert.equal(exemptPlayer(g,p,'uefa.champions'),false);
});
test('PL official flags are not UEFA training or nationality evidence; youth non-flags stay unknown',()=>{
 const g=game(),p=g.players.p;p.clubId='c';
 enrich(g,[],{pl:{association:true,source,evidence:'Official PL star'}});
 assert.equal(trainingStatus(g,p,'eng.1').association,true);assert.equal(trainingStatus(g,p,'uefa.champions').association,false);
});
test('unmarked U21 source replaces legacy inferred negative without falsely marking reviewed',()=>{
 const g=game(),p=g.players.p;p.clubId='c';p.homegrown={EN:{association:false,source}};
 enrich(g,[],{pl:{association:null,source,evidence:'U21, unmarked'}});
 const status=trainingStatus(g,p,'eng.1');assert.equal(status.known,false);assert.equal(status.association,false);assert.equal(status.source,source);
});
test('unknown nationality or a known domestic nationality never creates training evidence',()=>{
 const g=game(),p=g.players.p;p.countryCode='ESP';let status=trainingStatus(g,p,'uefa.champions');assert.equal(status.known,false);assert.equal(status.association,false);
 assert.equal(registrationReport(g,'uefa.champions','a',['p']).unknown,1);
});
test('identity mismatch is skipped and refresh preserves independently sourced history',()=>{
 const g=game();enrich(g,[period('a','2020-01-01','2023-01-01')]);
 const r=mergeHomegrown(g,{players:[{id:'p',name:'Different Player',birthDate:'2005-01-01',pl:{association:false}}]});assert.equal(r.skipped,1);
 mergeHomegrown(g,{players:[{id:'p',name:'Known Player',birthDate:'2005-01-01',pl:{association:true,source}}]});assert.equal(g.players.p.homegrownVerified.periods.length,1);
});
test('published research index has identity-specific official sources and no nationality-generated flags',()=>{
 const index=JSON.parse(readFileSync(new URL('../public/data/homegrown.json',import.meta.url),'utf8'));
 assert.ok(index.meta.plMatched>=490);assert.ok(index.meta.biographyPlayers>=20);
 for(const [id,p] of Object.entries(index.players)){
  assert.equal(id,p.id);assert.ok(p.name);
  if(p.pl){assert.ok([true,false,null].includes(p.pl.association));assert.match(p.pl.source,/premierleague\.com/);assert.ok(p.pl.sourcePlayerName&&p.pl.sourceClubId);}
  for(const row of p.periods||[]){assert.equal(row.verified,true);assert.match(row.source,/fcbarcelona\.com|arsenal\.com|realmadrid\.com/);assert.ok(row.evidence);}
 }
});
