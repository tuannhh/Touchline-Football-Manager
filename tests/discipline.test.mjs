import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {disciplineRule,recordDiscipline,competitionSuspension,disciplineReport,startDisciplineSeason,validateDiscipline,editorDisciplinePatch} from '../src/discipline.mjs';
import {registered} from '../src/registration.mjs';
import {reviewPlayerDynamics} from '../src/playerDynamics.mjs';
import * as E from '../src/engine.mjs';
const fixture=()=>({year:2026,players:{p:{id:'p',clubId:'a',injury:0,suspension:0}},clubs:{a:{leagueId:'eng.1'},b:{leagueId:'eng.1'}},leagues:[{id:'eng.1',name:'Premier League'},{id:'esp.1',name:'LaLiga'}],cups:[{id:'uefa.champions',name:'Champions League'},{id:'uefa.europa',name:'Europa League'}],fixtures:[]});
function play(g,{competition='eng.1',yellow=0,red=false,stage='domestic',leg,legs}={}){
 const f={id:'fixture-'+g.fixtures.length,leagueId:competition,home:'a',away:'b',round:g.round,stage,leg,legs,result:null};
 const m={fixtureId:f.id,home:f.home,away:f.away,completed:true,yellows:yellow?{p:yellow}:{},red:red?['p']:[],events:[]};
 g.fixtures.push(f);recordDiscipline(g,f,m);f.result={score:[0,0]};return {f,m};
}
test('Premier League thresholds use club matches, and yellow bans do not block Europe or friendlies',()=>{
 const g=fixture(),p=g.players.p;
 for(let i=0;i<4;i++)play(g,{yellow:1});
 assert.equal(competitionSuspension(g,p,'eng.1'),0);play(g,{yellow:1});
 assert.equal(competitionSuspension(g,p,'eng.1'),1);assert.equal(competitionSuspension(g,p,'uefa.champions'),0);
 assert.equal(registered(g,p,'eng.1'),false);assert.equal(registered(g,p,'friendly'),true);
 play(g,{competition:'friendly'});play(g,{competition:'uefa.champions'});
 assert.equal(competitionSuspension(g,p,'eng.1'),1,'unrelated fixtures cannot serve this ban');
 play(g);assert.equal(competitionSuspension(g,p,'eng.1'),0);
 assert.equal(disciplineReport(g,p,'eng.1')[0].yellowCards,5);
});
test('a fifth booking after club match19 is safe, but the tenth by match32 earns two matches',()=>{
 const g=fixture(),p=g.players.p;
 for(let i=0;i<19;i++)play(g,{yellow:i<4?1:0});
 play(g,{yellow:1});assert.equal(competitionSuspension(g,p,'eng.1'),0);
 for(let i=0;i<5;i++)play(g,{yellow:1});
 assert.equal(competitionSuspension(g,p,'eng.1'),2);play(g);assert.equal(competitionSuspension(g,p,'eng.1'),1);play(g);assert.equal(competitionSuspension(g,p,'eng.1'),0);
});
test('Premier League match19 and match32 are inclusive and unplayed fixtures do not count',()=>{
 for(const [threshold,deadline,expected] of [[5,19,1],[10,32,2]]){
  const g=fixture();
  for(let i=0;i<deadline-1;i++)play(g,{yellow:i<threshold-1?1:0});
  for(let i=0;i<10;i++)g.fixtures.push({id:'unplayed-'+i,leagueId:'eng.1',home:'a',away:'b',result:null});
  play(g,{yellow:1});assert.equal(competitionSuspension(g,g.players.p,'eng.1'),expected);
 }
});
test('15 Premier League cautions trigger three matches after the earlier cutoffs',()=>{
 const g=fixture();for(let i=0;i<33;i++)play(g,{yellow:i<14?1:0});play(g,{yellow:1});
 assert.equal(competitionSuspension(g,g.players.p,'eng.1'),3);
});
test('UEFA2026 uses four then six cautions and resets only the count after quarter-finals',()=>{
 const g=fixture(),p=g.players.p;
 for(let i=0;i<3;i++)play(g,{competition:'uefa.champions',yellow:1,stage:'league'});
 assert.equal(competitionSuspension(g,p,'uefa.champions'),0);
 play(g,{competition:'uefa.champions',yellow:1,stage:'league'});assert.equal(competitionSuspension(g,p,'uefa.champions'),1);
 play(g,{competition:'uefa.champions'});play(g,{competition:'uefa.champions',yellow:1,stage:'qf',leg:1,legs:2});
 play(g,{competition:'uefa.champions',yellow:1,stage:'qf',leg:2,legs:2});
 const row=disciplineReport(g,p,'uefa.champions')[0];assert.equal(row.yellowCards,6);assert.equal(row.cautions,0);assert.equal(row.remaining,1,'a new quarter-final ban remains for the semi-final');
 play(g,{competition:'uefa.champions',stage:'sf'});assert.equal(competitionSuspension(g,p,'uefa.champions'),0);
});
test('a second yellow is a red-card ban and does not also trigger accumulated cautions',()=>{
 const g=fixture(),p=g.players.p;
 for(let i=0;i<4;i++)play(g,{yellow:1});play(g,{yellow:2,red:true});
 const row=disciplineReport(g,p,'eng.1')[0];assert.equal(row.yellowCards,6);assert.equal(row.cautions,4);assert.equal(row.redCards,1);assert.equal(row.yellowBan,0);assert.equal(row.redBan,1);
 play(g);assert.equal(competitionSuspension(g,p,'eng.1'),0);
});
test('UEFA red bans span UEFA competitions while domestic fixtures do not consume them',()=>{
 const g=fixture(),p=g.players.p;play(g,{competition:'uefa.champions',red:true});
 assert.equal(competitionSuspension(g,p,'uefa.europa'),1);assert.equal(competitionSuspension(g,p,'eng.1'),0);
 play(g);assert.equal(competitionSuspension(g,p,'uefa.champions'),1);
 play(g,{competition:'uefa.europa'});assert.equal(competitionSuspension(g,p,'uefa.champions'),0);
});
test('discipline is idempotent, survives JSON and rejects unfinished results and corrupt saves',()=>{
 const g=fixture(),{f,m}=play(g,{yellow:1}),snapshot=JSON.stringify(g);recordDiscipline(g,f,m);assert.equal(JSON.stringify(g),snapshot);
 const restored=JSON.parse(snapshot);assert.ok(validateDiscipline(restored));assert.deepEqual(disciplineReport(restored,restored.players.p),disciplineReport(g,g.players.p));
 assert.throws(()=>recordDiscipline(g,{...f,id:'new'},{...m,fixtureId:'new',completed:false}));
 restored.players.p.discipline.competitions['eng.1'].redBan=-1;assert.throws(()=>validateDiscipline(restored));
});
test('new seasons clear UEFA yellow sanctions while keeping unserved red sanctions',()=>{
 const g=fixture(),p=g.players.p;for(let i=0;i<4;i++)play(g,{competition:'uefa.champions',yellow:1});play(g,{competition:'uefa.europa',red:true});
 g.year++;startDisciplineSeason(g,p);
 assert.equal(disciplineReport(g,p,'uefa.champions')[0].yellowCards,0);assert.equal(disciplineReport(g,p,'uefa.champions')[0].yellowBan,0);
 assert.equal(competitionSuspension(g,p,'uefa.champions'),1);
});
test('unverified domestic competitions openly use a simulated rule instead of a false source',()=>{
 const g=fixture();assert.equal(disciplineRule(g,'esp.1').basis,'simulation');assert.equal(disciplineRule(g,'esp.1').source,null);
 assert.equal(disciplineRule(g,'eng.1').basis,'official');assert.equal(disciplineRule(g,'uefa.champions').first,4);g.year=2025;assert.equal(disciplineRule(g,'uefa.champions').first,3);
});
test('attribute edits preserve competition bans until the suspension field is explicitly changed',()=>{
 const p={suspension:0};assert.deepEqual(editorDisciplinePatch(p,{suspension:0,age:29}),{age:29});
 assert.deepEqual(editorDisciplinePatch(p,{suspension:3,age:29}),{suspension:3,age:29});
 assert.deepEqual(editorDisciplinePatch({suspension:1},{suspension:0}),{suspension:0});
});
test('serving the final match of a ban does not count as being ignored by the manager',()=>{
 const g=fixture();g.date='2026-09-01';g.round=1;g.clubId='a';g.messages=[];g.manager='Test';Object.assign(g.players.p,{name:'Player',seasonMinutes:0,age:25,morale:80,fitness:100});
 play(g,{red:true});g.date='2026-09-08';g.round=2;play(g);
 assert.equal(competitionSuspension(g,g.players.p,'eng.1'),0);
 reviewPlayerDynamics(g,{training:false,playedClubs:new Set(['a'])});assert.equal(g.players.p.dynamics.unusedWeeks,0);
 g.date='2026-09-15';g.round=3;play(g);reviewPlayerDynamics(g,{training:false,playedClubs:new Set(['a'])});assert.equal(g.players.p.dynamics.unusedWeeks,1,'available and omitted next week counts normally');
});
test('engine saves scoped bans; lineups exclude banned players; the editor can clear them',()=>{
 const db=JSON.parse(fs.readFileSync(new URL('../public/data/database.json',import.meta.url),'utf8')),g=E.newGame(db,'e83','Discipline test',47),f=E.currentFixture(g),p=g.players[g.lineup[6]];
 const m=E.createMatch(g,f);m.completed=true;m.minute=90;m.yellows[p.id]=2;m.red.push(p.id);
 E.advanceRound(g,m);assert.ok(p.discipline);assert.equal(competitionSuspension(g,p,f.leagueId),1);assert.equal(p.suspension,0,'new competition bans are not global');
 assert.ok(!E.autoLineup(g,g.clubId,g.formation,f.leagueId).includes(p.id));assert.ok(E.validateGame(g));
 E.editPlayer(g,p.id,{suspension:0});assert.equal(competitionSuspension(g,p,f.leagueId),0);
 p.suspension=2;assert.equal(E.available(p),false,'legacy/editor bans still work');E.healSquad(g);assert.equal(E.available(p),true);
});
