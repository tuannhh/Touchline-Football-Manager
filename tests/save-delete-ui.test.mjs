import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {transformSync} from 'esbuild';
import * as locale from '../src/locale.mjs';
import * as slots from '../src/saveSlots.mjs';

const source=readFileSync(new URL('../src/SavedGames.jsx',import.meta.url),'utf8');
const compiled=transformSync(source,{loader:'jsx',format:'cjs',target:'es2022'}).code;
const save={id:'old-save',saveName:'Barcelona · Trước mùa giải',club:'Barcelona',manager:'Tuan',date:'2026-08-15',year:2026,storageBytes:12500000};
const nodes=tree=>!tree||typeof tree!=='object'?[]:[tree,...[tree.props?.children].flat(Infinity).flatMap(nodes)];
const textOf=tree=>typeof tree==='string'||typeof tree==='number'?String(tree):!tree||typeof tree!=='object'?'':[tree.props?.children].flat(Infinity).map(textOf).join('');
const flush=()=>new Promise(resolve=>setImmediate(resolve));

// Execute the real handlers and hook state. In particular, retain the initial
// close callback just as Modal's one-time Escape listener does in the browser.
function mount(props={}){
 const hooks=[],effects=[],frames=[];let cursor=0,focused=null;
 const Modal=()=>null,react={
  createElement(type,props,...children){const node={type,props:{...props,children}};if(props?.ref)props.ref.current={focus(){focused=node;}};return node;},
  useState(value){const i=cursor++;if(!(i in hooks))hooks[i]=value;return [hooks[i],next=>{hooks[i]=typeof next==='function'?next(hooks[i]):next;}];},
  useRef(value){const i=cursor++;return hooks[i]??(hooks[i]={current:value});},
  useEffect(effect,deps){const i=cursor++;if(!hooks[i]||deps.some((value,j)=>value!==hooks[i][j]))effects.push(effect);hooks[i]=deps;}
 };
 const module={exports:{}};
 runInNewContext(compiled,{module,exports:module.exports,requestAnimationFrame(fn){frames.push(fn);return frames.length;},cancelAnimationFrame(){},require(name){
  if(name==='react')return react;
  if(name==='@phosphor-icons/react')return new Proxy({},{get:()=>()=>null});
  if(name==='./locale.mjs')return locale;
  if(name==='./saveSlots.mjs')return slots;
  if(name==='./components.jsx')return {Modal};
  if(name==='./saved-games.css')return {};
  throw Error(`Unexpected save UI dependency: ${name}`);
 }});
 const input={saves:[save],onLoad:()=>{},onDelete:async()=>({freedBytes:save.storageBytes}),...props};
 let tree;
 const render=()=>{cursor=0;tree=module.exports.default(input);effects.splice(0).forEach(fn=>fn());frames.splice(0).forEach(fn=>fn());return tree;};
 render();
 return {render,get tree(){return tree;},get focused(){return focused;},get modal(){return nodes(tree).find(n=>n.type===Modal);},button(label){return nodes(tree).find(n=>n.type==='button'&&(n.props['aria-label']===label||textOf(n)===label));},formatStorage:module.exports.formatStorage};
}

test('delete requires a reviewable confirmation and Cancel receives focus without deleting',()=>{
 let called=0;const view=mount({onDelete:()=>{called++;}});
 assert.match(textOf(view.tree),/12,50 MB/);
 view.button('Xóa bản lưu '+save.saveName).props.onClick();view.render();
 assert.equal(called,0);assert.ok(view.modal);
 const content=textOf(view.modal);
 assert.ok(content.includes(save.saveName));assert.ok(content.includes(save.club));assert.ok(content.includes('15/08/2026'));
 assert.match(content,/Không thể hoàn tác/);assert.match(content,/bản sao dự phòng/);
 assert.equal(textOf(view.focused),'Hủy');
 view.button('Hủy').props.onClick();view.render();assert.equal(view.modal,undefined);assert.equal(called,0);
});

test('pending deletion blocks double clicks and the initial Escape/backdrop callback, then reports released storage',async()=>{
 let resolve,called=0;
 const view=mount({onDelete:id=>{assert.equal(id,save.id);called++;return new Promise(done=>{resolve=done;});}});
 view.button('Xóa bản lưu '+save.saveName).props.onClick();view.render();
 const initialClose=view.modal.props.onClose,confirm=view.button('Xóa vĩnh viễn bản lưu');
 confirm.props.onClick();confirm.props.onClick();initialClose();view.render();
 assert.equal(called,1);assert.ok(view.modal);assert.equal(view.button('Hủy').props.disabled,true);
 assert.equal(view.button('Đang xóa…').props.disabled,true);
 resolve({freedBytes:save.storageBytes});await flush();view.render();
 assert.equal(view.modal,undefined);assert.match(textOf(view.tree),/Đã xóa bản lưu\. Đã giải phóng 12,50 MB\./);
});

test('a failed delete stays in the dialog and can be retried without reporting success',async()=>{
 let called=0;const view=mount({onDelete:async()=>{called++;throw Error('Không xóa được bản lưu.');}});
 view.button('Xóa bản lưu '+save.saveName).props.onClick();view.render();
 view.button('Xóa vĩnh viễn bản lưu').props.onClick();await flush();view.render();
 assert.ok(view.modal);assert.match(textOf(view.modal),/Không xóa được bản lưu/);assert.doesNotMatch(textOf(view.tree),/Đã giải phóng/);
 assert.equal(view.button('Xóa vĩnh viễn bản lưu').props.disabled,false);
 view.button('Xóa vĩnh viễn bản lưu').props.onClick();await flush();assert.equal(called,2);
});

test('the running slot is protected and small storage amounts are not reported as zero',()=>{
 const view=mount({currentGame:save});
 assert.equal(view.button('Xóa bản lưu '+save.saveName).props.disabled,true);
 assert.match(textOf(view.tree),/Về màn hình bắt đầu để xóa bản đang chơi/);
 assert.equal(view.formatStorage(0),'0,00 MB');assert.equal(view.formatStorage(500),'< 0,01 MB');assert.equal(view.formatStorage(undefined),'—');
});
