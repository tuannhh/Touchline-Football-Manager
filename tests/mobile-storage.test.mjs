import test from 'node:test';
import assert from 'node:assert/strict';
import {IDBFactory} from 'fake-indexeddb';
import {createMobileStorage} from '../src/mobileStorage.mjs';
const world=(name='Test')=>({id:'career-test',saveName:name,clubId:'club',clubs:{club:{name:'Barcelona'}},players:{p:{id:'p',name:'Nguyễn Văn A'}},year:2026,date:'2026-08-01',round:0});
test('compressed offline saves survive reopen; rename and deletion preserve metadata and tombstones',async()=>{
 const factory=new IDBFactory(),store=createMobileStorage({factory});await store.save(world(),{exclusive:true});
 assert.equal((await store.load('career-test')).players.p.name,'Nguyễn Văn A');assert.ok((await store.list())[0].storageBytes>0);
 await assert.rejects(store.save(world(),{exclusive:true}),e=>e.status===409);
 await store.save({...world(),date:'2026-08-02'});await store.rename('career-test','Sự nghiệp mới');await store.close();
 const reopened=createMobileStorage({factory});assert.equal((await reopened.load('career-test')).date,'2026-08-02');assert.equal((await reopened.list())[0].name,'Sự nghiệp mới');
 const deletion=await reopened.remove('career-test');assert.ok(deletion.freedBytes>0);assert.deepEqual(await reopened.list(),[]);await assert.rejects(reopened.save(world()),e=>e.status===410);await assert.rejects(reopened.load('career-test'),e=>e.status===404);await reopened.close();
});
test('independent workers cannot resurrect a deleted save or replace an existing slot via POST',async()=>{
 const factory=new IDBFactory(),a=createMobileStorage({factory}),b=createMobileStorage({factory});
 const results=await Promise.allSettled([a.save(world('A'),{exclusive:true}),b.save(world('B'),{exclusive:true})]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 await b.remove('career-test');await assert.rejects(a.save(world()),e=>e.status===410);assert.equal((await a.list()).length,0);await a.close();await b.close();
});
test('invalid save and unsafe identifiers leave stored careers unchanged',async()=>{
 const store=createMobileStorage({factory:new IDBFactory()});await store.save(world());await assert.rejects(store.save({...world(),saveName:''}));await assert.rejects(store.load('../secret'));assert.equal((await store.load('career-test')).saveName,'Test');await store.close();
});
test('match autosave persists only match deltas, preserving the world through rename and reopen',async()=>{
 const factory=new IDBFactory(),store=createMobileStorage({factory});await store.save({...world(),liveMatch:{minute:0,score:[0,0]}});
 await store.patchMatch('career-test',{minute:45,score:[1,0]});await store.rename('career-test','Half time');await store.close();
 const next=createMobileStorage({factory}),g=await next.load('career-test');assert.equal(g.liveMatch.minute,45);assert.deepEqual(g.liveMatch.score,[1,0]);assert.equal(g.players.p.name,'Nguyễn Văn A');assert.equal(g.saveName,'Half time');assert.equal((await next.list())[0].liveMinute,45);
 await next.patchMatch('career-test',null);assert.equal((await next.load('career-test')).liveMatch,null);await next.remove('career-test');await assert.rejects(next.patchMatch('career-test',{minute:80}),e=>e.status===410);await next.close();
});
