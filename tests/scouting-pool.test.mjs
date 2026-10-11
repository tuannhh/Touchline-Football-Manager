import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {applyScoutingPool} from '../src/scoutingPool.mjs';
import {newGame,validateGame,profile} from '../src/engine.mjs';
import {allCompetitions} from '../src/competitions.mjs';
import {careerDatabase} from '../src/careerSource.mjs';
import {normalizePreferences} from '../src/preferences.mjs';
import {beginNegotiation} from '../src/transfers.mjs';

const league={id:'scout.bra',kind:'external',scoutingOnly:true,playable:false,name:'Série A'};
const pool=(players,clubs=[{id:'brazil',name:'Brazil club',leagueId:league.id}])=>({schema:1,meta:{snapshotAt:'2026-10-11'},leagues:[league],clubs,players});
test('impossible source ages do not break a career and remain explicitly estimated',()=>{
 const p=profile({id:'invalid-age',name:'Test',position:'MF',age:1825},{id:'club',reputation:50});
 assert.equal(p.age,24);assert.equal(p.ageEstimated,true);
});
test('overlay deduplicates stable IDs and name/DOB without overwriting the original world',()=>{
 const db={meta:{},leagues:[],clubs:[{id:'old',name:'Old club',leagueId:'eng.1'}],players:[{id:'e1',fotmobId:11,name:'José Silva',birthDate:'2000-01-01',clubId:'old',value:40}]};
 const before=structuredClone(db),p=pool([{id:'f11',fotmobId:11,name:'Jose Silva',birthDate:'2000-01-01',clubId:'brazil',value:900},{id:'other',name:'José Silva',birthDate:'2000-01-01',clubId:'brazil'},{id:'new',name:'Another player',clubId:'brazil'}]);
 const merged=applyScoutingPool(db,p);assert.deepEqual(db,before);assert.equal(merged.players.length,2);assert.deepEqual(merged.players[0],before.players[0]);assert.equal(merged.meta.scoutingPool.conflicts.length,2);assert.equal(merged.clubs.at(-1).playable,false);
 assert.throws(()=>applyScoutingPool(db,{...p,leagues:[{...league,kind:'domestic'}]}));
});
test('a verified official photo can improve a known identity without moving or changing that player',()=>{
 const db={meta:{},leagues:[],clubs:[{id:'a',name:'A',leagueId:'eng.1'}],players:[{id:'e1',fotmobId:1,name:'Known Player',birthDate:'2000-01-01',clubId:'a',value:50,photo:''}]};
 const incoming={id:'f1',fotmobId:1,name:'Known Player',birthDate:'2000-01-01',clubId:'brazil',value:900,photo:'/portraits/real-new.png',photoPriority:100,photoVerified:true};
 const result=applyScoutingPool(db,pool([incoming])).players[0];assert.equal(result.photo,incoming.photo);assert.equal(result.value,50);assert.equal(result.clubId,'a');assert.equal(db.players[0].photo,'');
 incoming.birthDate='1990-01-01';assert.equal(applyScoutingPool(db,pool([incoming])).players[0].photo,'');
});
test('imported pool covers all 13 markets using sourced identities, without fabricated portraits',()=>{
 const data=JSON.parse(fs.readFileSync(new URL('../public/data/scouting-pool.json',import.meta.url)));
 assert.equal(data.leagues.length,13);assert.equal(new Set(data.players.map(p=>p.id)).size,data.players.length);
 for(const l of data.leagues){assert.ok(l.coverage.players>0,l.country);assert.equal(l.kind,'external');assert.equal(l.playable,false);}
 const clubs=new Set(data.clubs.map(c=>c.id));
 for(const p of data.players){assert.ok(clubs.has(p.clubId));assert.match(p.sourceUrl,/^https:\/\//);assert.ok(p.name.trim());if(p.photo){assert.equal(p.photoVerified,true);assert.match(p.photo,/^\/portraits\/real-/);assert.ok(fs.existsSync(new URL('../public'+p.photo,import.meta.url)));}}
 for(const code of ['nga','gha','civ'])assert.ok(data.players.some(p=>p.source==='Official club website'&&data.clubs.find(c=>c.id===p.clubId)?.leagueId==='scout.'+code));
});
test('new world keeps playable competitions and fixtures while exposing overseas transfer targets',()=>{
 const db=JSON.parse(fs.readFileSync(new URL('../public/data/database.json',import.meta.url))),data=JSON.parse(fs.readFileSync(new URL('../public/data/scouting-pool.json',import.meta.url)));
 const combined=applyScoutingPool(db,data),base=newGame(db,'e83','QA',12),g=newGame(combined,'e83','QA',12);
 assert.equal(validateGame(g),true);assert.deepEqual(allCompetitions(g),allCompetitions(base));assert.deepEqual(g.fixtures,base.fixtures);
 const external=Object.values(g.clubs).filter(c=>c.scoutingOnly);assert.ok(external.length>100);assert.throws(()=>newGame(combined,external[0].id),/tuyển trạch/);
 const target=Object.values(g.players).find(p=>p.clubId===external[0].id);assert.ok(beginNegotiation(g,target.id).ok);assert.ok(g.shortlist.includes(target.id));
 const source=careerDatabase(g);assert.equal(source.players.length,Object.keys(g.players).length);assert.ok(source.leagues.some(l=>l.scoutingOnly));assert.equal(db.leagues.length,30);
});
test('legacy 3D preference returns to 2D and missing photo UI has no AI fallback',()=>{
 assert.equal(normalizePreferences({matchView:'3d'}).matchView,'2d');
 const match=fs.readFileSync(new URL('../src/MatchRoom.jsx',import.meta.url),'utf8');assert.doesNotMatch(match,/Match3D|3D ·|matchView==='3d'/);assert.match(match,/<MatchCanvas/);
 const components=fs.readFileSync(new URL('../src/components.jsx',import.meta.url),'utf8');assert.doesNotMatch(components,/avatar-ai|avatar-initials/);assert.match(components,/portrait-empty/);
});
