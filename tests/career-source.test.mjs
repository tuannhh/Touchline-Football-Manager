import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {newGame,migrateGame,validateGame} from '../src/engine.mjs';
import {careerDatabase,databaseFromRelease,stampCareerRelease} from '../src/careerSource.mjs';
import {cloneAsSlot} from '../src/saveSlots.mjs';
const db=JSON.parse(fs.readFileSync(new URL('../public/data/database.json',import.meta.url)));db.homegrownIndex=JSON.parse(fs.readFileSync(new URL('../public/data/homegrown.json',import.meta.url)));
const base=newGame(db,'e83','Source QA',321);
test('loading a career uses its own world even after the installed roster has changed',()=>{
 const original=structuredClone(base),before=JSON.stringify(original),seed=careerDatabase(original);
 const newer=structuredClone(db);const player=newer.players.find(p=>p.clubId===original.clubId);player.clubId='e359';player.name='Future roster identity';newer.meta.season='2027/28';
 const loaded=migrateGame(original,seed);assert.equal(JSON.stringify(original),before);for(const key of ['players','clubs','date','round','rng','lineup','transfers','fixtures','dbMeta'])assert.deepEqual(loaded[key],original[key],key);
 seed.players[0].name='changed local source';assert.notEqual(seed.players[0].name,original.players[seed.players[0].id].name);assert.ok(validateGame(loaded));
});
test('a selected release starts a new world in its own season and is recorded in every snapshot',()=>{
 const release={id:'qa-next-season',label:'QA 2027/28',season:'2027/28',asOf:'2027-09-03',publishedAt:'2027-09-04T10:00:00Z'};
 const selected=databaseFromRelease({database:db,homegrown:db.homegrownIndex,release});const g=stampCareerRelease(newGame(selected,'e83','QA',321),release);
 assert.equal(g.year,2027);assert.equal(g.date,'2027-08-15');assert.equal(g.dbRelease.id,release.id);assert.ok(Object.values(g.players).every(p=>p.contractUntil>=2029));
 const copy=cloneAsSlot(g,'Trước trận chung kết',{id:'career-qa-copy',now:'2027-09-04T11:00:00Z'});assert.deepEqual(copy.dbRelease,g.dbRelease);assert.deepEqual(copy.players,g.players);assert.ok(validateGame(copy));
});
test('saving metadata cannot inject unknown slot structure into valid careers',()=>{const g=structuredClone(base);g.saveSlot={createdAt:'2026-10-03',parentId:'../../somewhere'};assert.throws(()=>validateGame(g),/bản lưu/);});
