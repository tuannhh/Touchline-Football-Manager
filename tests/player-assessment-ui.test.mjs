import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {transformSync} from 'esbuild';
import * as locale from '../src/locale.mjs';

const compile=name=>transformSync(readFileSync(new URL(`../src/${name}.jsx`,import.meta.url),'utf8'),{loader:'jsx',format:'cjs',target:'es2022'}).code;
const nodes=tree=>!tree||typeof tree!=='object'?[]:[tree,...[tree.props?.children].flat(Infinity).flatMap(nodes)];
const textOf=tree=>typeof tree==='string'||typeof tree==='number'?String(tree):!tree||typeof tree!=='object'?'':[tree.props?.children].flat(Infinity).map(textOf).join('');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const snapshot={version:1,asOf:'2026-10-05',importedAt:'2026-10-05T00:00:00Z',players:{p:{}},coverage:{totalPlayers:16440,observations:5000,marketValues:4200,performanceHistories:4000,sourceFailures:2}};

function mountSources(fetch,onUpdated){
 const hooks=[],effects=[],timers=new Map();let cursor=0,timerId=0,tree;
 const react={createElement:(type,props,...children)=>({type,props:{...props,children}}),
  useState(initial){const i=cursor++;if(!(i in hooks))hooks[i]=initial;return [hooks[i],next=>{hooks[i]=typeof next==='function'?next(hooks[i]):next;}];},
  useRef(initial){const i=cursor++;return hooks[i]??(hooks[i]={current:initial});},
  useEffect(effect,deps){const i=cursor++,previous=hooks[i];if(!previous||deps.some((value,j)=>value!==previous.deps[j]))effects.push(()=>{previous?.cleanup?.();hooks[i]={deps,cleanup:effect()};});}
 };
 const module={exports:{}};
 runInNewContext(compile('AssessmentSources'),{module,exports:module.exports,fetch,setTimeout(fn,delay){const id=++timerId;timers.set(id,{fn,delay});return id;},clearTimeout(id){timers.delete(id);},require(name){if(name==='react')return react;if(name==='./locale.mjs')return locale;if(name==='@phosphor-icons/react')return new Proxy({},{get:()=>()=>null});if(name.endsWith('.css'))return {};throw Error(name);}});
 const render=()=>{cursor=0;tree=module.exports.default({onUpdated});effects.splice(0).forEach(effect=>effect());return tree;};render();
 return {render,get tree(){return tree;},button(){return nodes(tree).find(node=>node.type==='button');},get timers(){return [...timers.values()];},unmount(){hooks.forEach(hook=>hook?.cleanup?.());}};
}
const response=(data,status=200)=>({ok:status>=200&&status<300,status,json:async()=>data});

test('assessment data is read-only until explicit refresh and refresh never targets a career save',async()=>{
 const calls=[];let state={status:'idle'},updated;
 const view=mountSources(async(url,options={})=>{calls.push({url,method:options.method||'GET'});if(url==='/data/player-reality.json')return response(snapshot);if(options.method==='POST')state={status:'running',startedAt:'2026-10-05T00:01:00Z'};return response({...state});},value=>{updated=value;});
 await flush();view.render();assert.equal(calls.filter(call=>call.method==='POST').length,0);
 assert.match(textOf(view.tree),/Chỉ áp dụng khi tạo New Game/);assert.match(textOf(view.tree),/5\.000 \/ 16\.440/);
 const button=view.button();button.props.onClick();button.props.onClick();await flush();view.render();
 assert.equal(calls.filter(call=>call.method==='POST').length,1);assert.equal(view.button().props.disabled,true);assert.equal(view.timers.at(-1).delay,3000);
 state={...state,status:'complete',finishedAt:'2026-10-05T00:03:00Z'};
 await view.timers.at(-1).fn();await flush();view.render();await flush();view.render();
 assert.equal(updated.asOf,snapshot.asOf);assert.equal(view.button().props.disabled,false);
 assert.equal(calls.every(call=>['/data/player-reality.json','/api/player-assessments/refresh'].includes(call.url)),true);
 view.unmount();
});

test('refresh errors preserve displayed installed coverage and allow another attempt',async()=>{
 let attempts=0;const view=mountSources(async(url,options={})=>{if(url==='/data/player-reality.json')return response(snapshot);if(options.method==='POST'){attempts++;return response({error:'Nguồn tạm thời không phản hồi.'},503);}return response({status:'idle'});});
 await flush();view.render();view.button().props.onClick();await flush();view.render();
 assert.match(textOf(view.tree),/Nguồn tạm thời không phản hồi/);assert.match(textOf(view.tree),/5\.000 \/ 16\.440/);assert.equal(view.button().props.disabled,false);
 view.button().props.onClick();await flush();assert.equal(attempts,2);view.unmount();
});

test('player profile separates ability, potential, source evidence and simulated club interest',()=>{
 const report={currentAbility:89,potential:94,influence:92,value:100000000,reviewIntervalDays:28,reviewedAt:'2026-10-05',history:[{date:'2026-10-05',ability:89,abilityDelta:1,value:100000000,valueDelta:2000000,minutes:360,appearances:4,rating:7.65,reasons:['form_rising']}],interests:[{clubId:'buyer',clubName:'Example FC',level:'interested',score:75,reasons:['quality_upgrade','within_budget']}]};
 const react={Fragment:'fragment',createElement:(type,props,...children)=>({type,props:{...props,children}})},module={exports:{}};
 runInNewContext(compile('PlayerDevelopment'),{module,exports:module.exports,URL,require(name){if(name==='react')return react;if(name==='./locale.mjs')return locale;if(name==='./playerDevelopment.mjs')return {playerDevelopmentReport:()=>report};if(name==='./components.jsx')return {ClubLink:()=>null};if(name==='@phosphor-icons/react')return new Proxy({},{get:()=>()=>null});if(name.endsWith('.css'))return {};throw Error(name);}});
 const p={abilityAssessment:{basis:'source_estimate',asOf:'2026-10-05',confidence:'high',sourceUrls:['javascript:alert(1)','https://example.com/evidence','https://example.com/evidence']}};
 const tree=module.exports.default({g:{clubs:{}},p}),text=textOf(tree);
 assert.match(text,/Năng lực hiện tại89 \/ 100/);assert.match(text,/Tiềm năng ước lượng94 \/ 100/);assert.match(text,/Tầm ảnh hưởng trong đội92 \/ 100/);
 assert.match(text,/không phải tin đồn hoặc đề nghị chuyển nhượng ngoài đời/);assert.match(text,/Example FC/);assert.match(text,/Phong độ cải thiện/);
 const links=nodes(tree).filter(node=>node.type==='a');assert.equal(links.length,1);assert.equal(links[0].props.href,'https://example.com/evidence');
 const fallback=textOf(module.exports.default({g:{clubs:{}},p:{}}));assert.match(fallback,/ước lượng với độ tin cậy thấp/);
});
