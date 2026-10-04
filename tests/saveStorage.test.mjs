import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,readdir,rm,symlink,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {DELETED_SAVE_MESSAGE,assertSaveWritable,deleteSaveSnapshot,readSaveSnapshot,saveStorageBytes,saveStoragePaths,writeSaveSnapshot} from '../src/saveStorage.mjs';

async function fixture(t){const directory=await mkdtemp(path.join(os.tmpdir(),'touchline-save-storage-'));t.after(()=>rm(directory,{recursive:true,force:true}));return directory;}
const gone=error=>error.status===410&&error.message===DELETED_SAVE_MESSAGE;

test('deleting one slot removes its primary, backup and temp, with exact freed bytes',async t=>{
 const directory=await fixture(t),files=saveStoragePaths(directory,'old-career');
 await writeFile(files.file,'{"old":true}');await writeFile(files.backup,'backup');await writeFile(files.temp,'temporary');
 const expected=Buffer.byteLength('{"old":true}backuptemporary');
 assert.equal(await saveStorageBytes(directory,'old-career'),expected);
 assert.deepEqual(await deleteSaveSnapshot(directory,'old-career'),{ok:true,deletedId:'old-career',freedBytes:expected});
 assert.deepEqual(await readdir(directory),['old-career.deleted']);assert.equal(await saveStorageBytes(directory,'old-career'),0);
 const marker=await readFile(files.deleted,'utf8');assert.ok(marker.length<100);assert.ok(Number.isFinite(Date.parse(JSON.parse(marker).deletedAt)));
});

test('neighboring slots, similarly named files, portraits and archived saves survive',async t=>{
 const directory=await fixture(t),files=saveStoragePaths(directory,'career');await writeFile(files.file,'one');
 const survivors=['career2.json','career2.json.bak','career-older.json','career.json.notes','career.json.bak.keep','face.png'];
 for(const file of survivors)await writeFile(path.join(directory,file),'keep:'+file);
 await mkdir(path.join(directory,'archive'));await writeFile(path.join(directory,'archive','career.json'),'archived');
 await deleteSaveSnapshot(directory,'career');
 for(const file of survivors)assert.equal(await readFile(path.join(directory,file),'utf8'),'keep:'+file);
 assert.equal(await readFile(path.join(directory,'archive','career.json'),'utf8'),'archived');
});

test('delete is idempotent, including absent ids, and retries interrupted file removal',async t=>{
 const directory=await fixture(t),id='missing',files=saveStoragePaths(directory,id);
 assert.deepEqual(await deleteSaveSnapshot(directory,id),{ok:true,deletedId:id,freedBytes:0});
 const marker=await readFile(files.deleted,'utf8');
 assert.deepEqual(await deleteSaveSnapshot(directory,id),{ok:true,deletedId:id,freedBytes:0});
 assert.equal(await readFile(files.deleted,'utf8'),marker,'retry preserves the original deletion marker');
 // Model a process exiting after recording deletion, before unlinking its backup.
 await writeFile(files.backup,'leftover');assert.equal((await deleteSaveSnapshot(directory,id)).freedBytes,8);
 assert.deepEqual(await readdir(directory),[id+'.deleted']);
});

test('deleted ids refuse late PUT, POST, reads and rename reads, even in a freshly imported storage module',async t=>{
 const directory=await fixture(t),id='closed-career';await writeSaveSnapshot(directory,id,'{"id":"closed-career"}');await deleteSaveSnapshot(directory,id);
 await assert.rejects(()=>writeSaveSnapshot(directory,id,'{}'),gone);
 await assert.rejects(()=>writeSaveSnapshot(directory,id,'{}',{exclusive:true}),gone);
 await assert.rejects(()=>readSaveSnapshot(directory,id),gone);await assert.rejects(()=>assertSaveWritable(directory,id),gone);
 const restarted=await import('../src/saveStorage.mjs?after-restart');await assert.rejects(()=>restarted.writeSaveSnapshot(directory,id,'{}'),gone);
 assert.deepEqual(await readdir(directory),[id+'.deleted']);
});

test('queued mutations reject stale autosaves parsed after deletion while other saves remain writable',async t=>{
 const directory=await fixture(t),id='queued';await writeSaveSnapshot(directory,id,'{"n":0}');let queue=Promise.resolve();
 const enqueue=fn=>{const work=queue.catch(()=>{}).then(fn);queue=work;return work;};
 const first=enqueue(()=>writeSaveSnapshot(directory,id,'{"n":1}'));
 const remove=enqueue(()=>deleteSaveSnapshot(directory,id));
 const stale=enqueue(()=>writeSaveSnapshot(directory,id,'{"n":2}'));
 await first;await remove;await assert.rejects(()=>stale,gone);
 await enqueue(()=>writeSaveSnapshot(directory,'new-slot','{"id":"new-slot"}',{exclusive:true}));
 assert.equal((await readSaveSnapshot(directory,'new-slot')).game.id,'new-slot');
 assert.deepEqual((await readdir(directory)).sort(),['new-slot.json','queued.deleted']);
});

test('identities reject traversal, encoded separators and filenames before touching disk',async t=>{
 const directory=await fixture(t);await writeFile(path.join(directory,'keep.json'),'keep');
 for(const id of ['../keep','/tmp/keep','a/b','a\\b','..','%2e%2e%2fkeep','a.json','a_b','',null,42,'x'.repeat(101)]){
  assert.throws(()=>saveStoragePaths(directory,id),/Mã bản lưu/);
  await assert.rejects(()=>deleteSaveSnapshot(directory,id),/Mã bản lưu/);
  await assert.rejects(()=>writeSaveSnapshot(directory,id,'{}'),/Mã bản lưu/);
 }
 assert.deepEqual(await readdir(directory),['keep.json']);assert.equal(await readFile(path.join(directory,'keep.json'),'utf8'),'keep');
});

test('symlinked save, backup, temp or marker is refused without following or removing its target',async t=>{
 const directory=await fixture(t),outside=await fixture(t),target=path.join(outside,'precious.json');await writeFile(target,'untouched');
 for(const key of ['file','backup','temp','deleted']){
  const id='linked-'+key,files=saveStoragePaths(directory,id);if(key!=='file')await writeFile(files.file,'original');await symlink(target,files[key]);
  await assert.rejects(()=>deleteSaveSnapshot(directory,id),/tệp thông thường/);
  await assert.rejects(()=>writeSaveSnapshot(directory,id,'overwritten'),/tệp thông thường/);
  if(key!=='deleted')await assert.rejects(()=>saveStorageBytes(directory,id),/tệp thông thường/);
  if(key==='file'||key==='deleted')await assert.rejects(()=>readSaveSnapshot(directory,id),/tệp thông thường/);
  if(key!=='file')assert.equal(await readFile(files.file,'utf8'),'original');
  assert.equal(await readFile(target,'utf8'),'untouched');
 }
});

test('directories masquerading as save artifacts are not recursively removed',async t=>{
 const directory=await fixture(t),files=saveStoragePaths(directory,'directory');await writeFile(files.file,'primary');await mkdir(files.backup);await writeFile(path.join(files.backup,'nested.json'),'keep');
 await assert.rejects(()=>deleteSaveSnapshot(directory,'directory'),/tệp thông thường/);
 assert.equal(await readFile(files.file,'utf8'),'primary');assert.equal(await readFile(path.join(files.backup,'nested.json'),'utf8'),'keep');assert.ok(!(await readdir(directory)).includes('directory.deleted'));
});

test('storage bytes include backups and interrupted writes; writes retain normal backup behavior',async t=>{
 const directory=await fixture(t),id='normal';assert.equal(await saveStorageBytes(directory,id),0);
 await writeSaveSnapshot(directory,id,'{"name":"Đội bóng"}',{exclusive:true});const firstBytes=Buffer.byteLength('{"name":"Đội bóng"}');assert.equal(await saveStorageBytes(directory,id),firstBytes);
 await assert.rejects(()=>writeSaveSnapshot(directory,id,'{}',{exclusive:true}),error=>error.status===409);
 await writeSaveSnapshot(directory,id,'{"name":"New"}');assert.equal(await saveStorageBytes(directory,id),firstBytes+Buffer.byteLength('{"name":"New"}'));
 const loaded=await readSaveSnapshot(directory,id);assert.deepEqual(loaded.game,{name:'New'});assert.ok(Number.isFinite(Date.parse(loaded.updatedAt)));
 const files=saveStoragePaths(directory,id);assert.equal(await readFile(files.backup,'utf8'),'{"name":"Đội bóng"}');assert.ok(!(await readdir(directory)).includes(id+'.json.tmp'));
});
