import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSlotName,validateSaveMetadata,cloneAsSlot,saveSummary,filterSortSaves} from '../src/saveSlots.mjs';
import {initializePlayerDynamics,reviewPlayerDynamics} from '../src/playerDynamics.mjs';
import {initializeInternational} from '../src/international.mjs';
import {initializeTransferMarket} from '../src/transfers.mjs';

const game=()=>({id:'career-original',manager:'Dũng',clubId:'barca',clubs:{barca:{name:'Barcelona',cash:1234567}},year:2026,round:4,date:'2026-09-12',rng:918273,players:{yamal:{id:'yamal',attributes:{pace:18},goals:4}},lineup:['yamal'],bench:['keeper'],fixtures:[{id:'fixture-original',home:'barca',away:'rival',result:null}],liveMatch:{fixtureId:'fixture-original',minute:67,score:[2,1],lineups:[['yamal'],['rival1']],bench:[['keeper'],[]],rng:39128},staffAssignments:{barca:{press:'staff-original'}},negotiations:[{id:'deal-career-original',fee:18000000}],dbRelease:{id:'roster-2026-10-03',label:'Đội hình đầu tháng 10',asOf:'2026-10-03',season:'2026/27'}});

test('save-as creates an independent named slot without changing progress, live match, embedded identities or RNG',()=>{
 const g=game(),before=structuredClone(g),copy=cloneAsSlot(g,'  Trước trận   lượt về  ',{id:'career-backup',now:'2026-10-03T14:00:00.000Z'});
 assert.equal(copy.id,'career-backup');assert.equal(copy.simulationId,g.id);assert.equal(copy.saveName,'Trước trận lượt về');assert.deepEqual(copy.saveSlot,{createdAt:'2026-10-03T14:00:00.000Z',parentId:g.id});
 for(const key of Object.keys(g).filter(key=>key!=='id'))assert.deepEqual(copy[key],g[key],key);
 copy.liveMatch.score[0]=9;copy.players.yamal.attributes.pace=1;copy.clubs.barca.cash=0;assert.deepEqual(g,before);assert.equal(validateSaveMetadata(copy),true);
});

test('save-as rejects a reused or malformed identity and invalid names before altering the original',()=>{
 const g=game(),before=structuredClone(g);for(const id of [g.id,'../backup','',null])assert.throws(()=>cloneAsSlot(g,'Bản lưu',{id,now:'2026-10-03T14:00:00Z'}));
 assert.throws(()=>cloneAsSlot(g,'',{id:'career-new',now:'2026-10-03T14:00:00Z'}));assert.throws(()=>cloneAsSlot(g,'Bản lưu',{id:'career-new',now:'invalid'}));assert.deepEqual(g,before);
 assert.equal(normalizeSlotName('  Chung kết\nChampions League '),'Chung kết Champions League');for(const name of [' ',null,'x'.repeat(81),'bad\u0000name'])assert.throws(()=>normalizeSlotName(name));
});

test('save summaries use persisted database identity and show a paused match even at minute zero',()=>{
 const g=game();g.saveName='Hành trình Barcelona';g.dbMeta={release:{id:'different-release',asOf:'2025-01-01'},season:'2025/26'};
 const summary=saveSummary(g,'2026-10-03T14:00:00.000Z');assert.equal(summary.name,g.saveName);assert.equal(summary.club,'Barcelona');assert.equal(summary.manager,'Dũng');assert.equal(summary.date,'2026-09-12');assert.equal(summary.season,'2026/27');assert.equal(summary.dbReleaseId,'roster-2026-10-03');assert.equal(summary.dbReleaseLabel,'Đội hình đầu tháng 10');assert.equal(summary.dbAsOf,'2026-10-03');assert.equal(summary.dbSeason,'2026/27');assert.equal(summary.liveMinute,67);
 g.liveMatch.minute=0;assert.equal(saveSummary(g).liveMinute,0);assert.equal(saveSummary({...g,liveMatch:null}).liveMinute,null);
 assert.deepEqual(saveSummary(summary,summary.updatedAt),summary,'summary response can be consumed directly by the list component');
});

test('legacy metadata remains readable and does not invent a release identity or date',()=>{
 const g=game();delete g.dbRelease;g.dbMeta={season:'2026/27',importedAt:'2026-10-02T16:30:54Z'};const summary=saveSummary(g);assert.equal(summary.name,'Barcelona · Dũng');assert.equal(summary.dbReleaseId,'');assert.equal(summary.dbAsOf,g.dbMeta.importedAt);assert.equal(validateSaveMetadata(g),true);
 delete g.dbMeta;assert.equal(saveSummary(g).dbAsOf,'');assert.equal(saveSummary(g).dbReleaseLabel,'');
});

test('all slots remain visible; search handles Vietnamese accents and sorting never mutates its source',()=>{
 const saves=Array.from({length:12},(_,i)=>({id:`career-${i}`,name:`Lần lưu ${i}`,club:i===2?'Đà Nẵng':'Barcelona',manager:i===2?'Dũng':'An',year:2026,round:i,date:`2026-09-${String(i+1).padStart(2,'0')}`,updatedAt:`2026-10-03T${String(i).padStart(2,'0')}:00:00Z`}));const before=structuredClone(saves);
 assert.equal(filterSortSaves(saves).length,12);assert.equal(filterSortSaves(saves)[0].id,'career-11');assert.deepEqual(filterSortSaves(saves,{query:'da nang'}).map(s=>s.id),['career-2']);assert.deepEqual(filterSortSaves(saves,{query:'dung'}).map(s=>s.id),['career-2']);assert.equal(filterSortSaves(saves,{sort:'date'})[0].id,'career-11');assert.equal(filterSortSaves(saves,{sort:'name'})[0].id,'career-0');assert.deepEqual(saves,before);
});

test('metadata validation allows unnamed older saves and rejects malformed optional slot fields',()=>{
 const g=game();assert.equal(validateSaveMetadata(g),true);g.saveName='Hợp lệ';g.saveSlot={createdAt:'2026-10-03T14:00:00Z'};assert.equal(validateSaveMetadata(g),true);
 for(const patch of [{saveName:' '},{saveName:'  Còn khoảng trắng '},{saveSlot:[]},{saveSlot:{createdAt:'bad'}},{saveSlot:{createdAt:'2026-10-03',parentId:'../escape'}},{saveSlot:{createdAt:'2026-10-03',extra:'not-supported'}}])assert.throws(()=>validateSaveMetadata({...g,...patch}));
 for(const simulationId of ['',null,9,'../invalid'])assert.throws(()=>validateSaveMetadata({...g,simulationId}));
});

test('saving to new slots preserves next training injuries, morale and later initializer RNG streams',()=>{
 const g={...game(),messages:[],intensity:'hard',liveMatch:null,players:Object.fromEntries(Array.from({length:1000},(_,i)=>{const id='player-'+i;return [id,{id,name:'Cầu thủ '+i,clubId:'barca',countryCode:'ES',nationality:'Spain',position:i%12===0?'GK':'MF',attributes:{passing:12,vision:12,teamwork:12,dribbling:12},age:25,fitness:50,morale:80,injury:0,suspension:0,seasonMinutes:0}];}))};
 initializePlayerDynamics(g);for(const p of Object.values(g.players))p.seasonMinutes=60;
 const original=structuredClone(g),copy=cloneAsSlot(g,'Lần một',{id:'career-copy',now:'2026-10-03T14:00:00Z'}),again=cloneAsSlot(copy,'Lần hai',{id:'career-copy-two',now:'2026-10-03T15:00:00Z'});assert.equal(again.simulationId,g.id);assert.deepEqual(g,original);
 for(const world of [g,copy,again]){reviewPlayerDynamics(world,{playedClubs:new Set(['barca'])});initializeInternational(world);initializeTransferMarket(world);}
 assert.ok(Object.values(g.players).some(p=>p.injury>0),'fixture exercises actual training injuries');assert.ok(Object.values(g.players).some(p=>p.morale>80),'fixture exercises playing-time morale');
 for(const world of [copy,again]){assert.deepEqual(world.players,g.players);assert.equal(world.rng,g.rng);assert.equal(world.international.rng,g.international.rng);assert.equal(world.transferMarket.rng,g.transferMarket.rng);}
});

test('storage size survives summary normalization, search and sort without inventing unknown sizes',()=>{
 const saves=[{...saveSummary(game()),storageBytes:12345678},{...saveSummary(game()),id:'old-save',name:'Old'}];
 assert.equal(saveSummary(saves[0]).storageBytes,12345678);
 assert.equal(filterSortSaves(saves,{query:'Barcelona'})[0].storageBytes,12345678);
 assert.equal(filterSortSaves(saves,{query:'Old'})[0].storageBytes,undefined);
 for(const storageBytes of [-1,Infinity,'123',null])assert.equal(saveSummary({...game(),storageBytes}).storageBytes,undefined);
});
