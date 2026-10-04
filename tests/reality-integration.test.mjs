import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {newGame,migrateGame,validateGame,available} from '../src/engine.mjs';
import {careerDatabase} from '../src/careerSource.mjs';

const read=relative=>JSON.parse(fs.readFileSync(new URL(relative,import.meta.url)));
const initial=read('../public/data/releases/2026-10-03-initial/database.json');
const reality=read('../public/data/releases/2026-10-04-reality/database.json');
initial.homegrownIndex=read('../public/data/releases/2026-10-03-initial/homegrown.json');
reality.homegrownIndex=read('../public/data/releases/2026-10-04-reality/homegrown.json');

test('reality release preserves the entire previous roster and portraits while adding source observations',()=>{
  assert.deepEqual(reality.players.map(p=>p.id),initial.players.map(p=>p.id));
  assert.deepEqual(reality.clubs,initial.clubs);
  for(let i=0;i<initial.players.length;i++){
    const {realWorld,...player}=reality.players[i];
    assert.deepEqual(player,initial.players[i],`unchanged source player ${player.id}`);
    if(realWorld)assert.equal(realWorld.playerId,player.id);
  }
  assert.ok(reality.meta.playerReality.coverage.observations>5000);
});

test('opting into source injuries produces an eligible starting eleven and bench before opening match',()=>{
  const arsenal=reality.clubs.find(c=>c.name==='Arsenal').id;
  const g=newGame(reality,arsenal,'Reality QA',917,{sourceInjuries:true});
  assert.ok(g.snapshotInjuries.applied>0);
  assert.equal(g.players.e277385.injury,6);
  assert.equal(g.players.e277385.injuryDetail.sourceDate,'2026-10-04');
  assert.equal(g.players.e277385.injuryDetail.since,g.date);
  assert.equal(g.lineup.length,11);
  assert.equal(new Set(g.lineup).size,11);
  assert.ok(g.lineup.every(id=>id&&available(g.players[id])));
  assert.ok(g.bench.every(id=>id&&available(g.players[id])));
  assert.ok(![...g.lineup,...g.bench].includes('e277385'));
  assert.equal(g.players.e231050.injury,0,'doubtful is not a confirmed exclusion');
  assert.ok(Object.values(g.players).every(p=>p.suspension===0),'source cards never seed bans');
  assert.ok(validateGame(g));
});

test('new release applies market estimates but leaves injuries clear unless opted in',()=>{
  const g=newGame(reality,'e83','Reality QA',918);
  assert.equal(g.players.e250465.value,108881235);
  assert.equal(g.players.e250465.realWorld.marketValue.kind,'provider_estimate');
  assert.equal(g.players.e250465.contractEndDate,'2030-06-30');
  assert.ok(Object.values(g.players).every(p=>p.injury===0));
  assert.equal(g.snapshotInjuries,undefined);
  assert.ok(validateGame(g));
});

test('loading an existing career preserves simulated finances, skills and availability with a new release installed',()=>{
  const original=newGame(initial,'e83','Existing career QA',919);
  const p=original.players.e250465;
  p.value=1234567;p.wage=7654;p.attributes.passing=11;p.injury=3;p.suspension=2;p.morale=53;
  const before=structuredClone(original.players);
  // This is the same save-owned database path used by the application loader.
  const loaded=migrateGame(original,careerDatabase(original));
  assert.deepEqual(loaded.players,before);
  assert.deepEqual(original.players,before);
  assert.equal(loaded.players.e250465.realWorld,undefined);
  assert.equal(loaded.snapshotInjuries,undefined);
  assert.notEqual(reality.players.find(x=>x.id===p.id).realWorld.marketValue.eur,p.value);
  assert.ok(validateGame(loaded));
});
