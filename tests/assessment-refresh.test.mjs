import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createAssessmentRefresh,vietnamDate} from '../src/assessmentRefresh.mjs';

const flush=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(options={}){
 const calls=[],children=[];
 const launch=(...args)=>{calls.push(args);const child=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();child.kill=signal=>{child.signal=signal;};children.push(child);return child;};
 const runner=createAssessmentRefresh({root:'/tmp/touchline-fixture',launch,now:()=>new Date('2026-10-04T22:00:00Z'),read:async()=>JSON.stringify({version:1,players:{},coverage:{observations:5}}),...options});
 return {runner,calls,children};
}
test('source refresh uses the Vietnamese calendar and a fixed command, with one shared job',async()=>{
 assert.equal(vietnamDate(new Date('2026-10-04T22:00:00Z')),'2026-10-05');
 const {runner,calls,children}=fixture();assert.equal(runner.status().status,'idle');
 const first=runner.start();assert.equal(first.status,'running');assert.deepEqual(runner.start(),first);assert.equal(calls.length,1);
 assert.deepEqual(calls[0][1],['/tmp/touchline-fixture/scripts/import-player-reality.mjs','--refresh-profiles','--profile-limit','100','--as-of','2026-10-05']);
 assert.equal(calls[0][2].shell,false);first.detail='tampered';assert.notEqual(runner.status().detail,'tampered');
 children[0].stdout.emit('data','untrusted provider HTML');children[0].emit('close',0);await flush();
 assert.equal(runner.status().status,'complete');assert.deepEqual(runner.status().summary,{observations:5});
 assert.equal(runner.status().detail,'');runner.stop();
});
test('failed importer never claims new source data and retry starts a fresh job',async()=>{
 let reads=0;const {runner,children,calls}=fixture({read:async()=>{reads++;}});
 runner.start();children[0].emit('close',1);await flush();assert.equal(runner.status().status,'error');assert.equal(reads,0);assert.equal(runner.status().summary,null);
 runner.start();assert.equal(calls.length,2);children[1].emit('error',Error('path details should not leak'));assert.equal(runner.status().status,'error');assert.ok(!runner.status().error.includes('path details'));runner.stop();
});
test('a corrupt completed snapshot is rejected and shutdown terminates the importer',async()=>{
 const {runner,children}=fixture({read:async()=>'not JSON'});runner.start();children[0].emit('close',0);await flush();assert.equal(runner.status().status,'error');
 runner.start();runner.stop();assert.equal(children[1].signal,'SIGTERM');
});
