import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {transformSync} from 'esbuild';
import * as entities from '../src/mailEntities.mjs';
import * as mail from '../src/mail.mjs';
import * as transfers from '../src/transfers.mjs';
import * as shortlist from '../src/shortlist.mjs';

const nodes=tree=>!tree||typeof tree!=='object'?[]:[tree,...[tree.props?.children].flat(Infinity).flatMap(nodes)];
const textOf=tree=>typeof tree==='string'||typeof tree==='number'?String(tree):!tree||typeof tree!=='object'?'':[tree.props?.children].flat(Infinity).map(textOf).join('');
function mount(filename,props,exportName='default'){
 const hooks=[];let cursor=0;
 const react={createElement:(type,props,...children)=>({type,props:{...props,children}}),useMemo:fn=>fn(),useState(value){const i=cursor++;if(!(i in hooks))hooks[i]=value;return [hooks[i],value=>{hooks[i]=typeof value==='function'?value(hooks[i]):value;}];}};
 const module={exports:{}},compiled=transformSync(readFileSync(new URL('../src/'+filename,import.meta.url),'utf8'),{loader:'jsx',format:'cjs'}).code;
 runInNewContext(compiled,{module,exports:module.exports,require(name){
  if(name==='react')return react;
  if(name==='@phosphor-icons/react'||name==='./components.jsx')return new Proxy({},{get:()=>()=>null});
  if(name==='./engine.mjs')return {dateLabel:value=>value,money:value=>String(value)};
  if(name==='./locale.mjs')return {number:value=>String(value)};
  if(name==='./i18n.mjs')return {translate:value=>value};
  if(name==='./mailEntities.mjs')return entities;
  if(name==='./mail.mjs')return mail;
  if(name==='./transfers.mjs')return transfers;
  if(name==='./shortlist.mjs')return shortlist;
  if(name==='./TransferNegotiation.jsx')return {NEGOTIATION_STATUS:{club:'Đàm phán với CLB',rejected:'Bị từ chối'}};
  if(name.endsWith('.css'))return {};
  throw Error('Unexpected import '+name);
 }});
 let tree;const render=()=>{cursor=0;tree=module.exports[exportName](props);return tree;};render();
 return {render,get tree(){return tree;},find:predicate=>nodes(tree).find(predicate),button:label=>nodes(tree).find(n=>n.type==='button'&&textOf(n)===label)};
}
const fresh=()=>({id:'career-ui',manager:'QA',date:'2026-08-15',clubId:'a',shortlist:[],players:{p:{id:'p',name:'Lamine Yamal',clubId:'b',value:100}},clubs:{a:{id:'a',name:'Arsenal'},b:{id:'b',name:'Barcelona'}},leagues:[{id:'esp',name:'La Liga'}],messages:[{id:'mail-1',date:'2026-08-15',type:'transfer',title:'Báo cáo',body:'Lamine Yamal',playerIds:['p'],paragraphs:['Lamine Yamal thi đấu cho Barcelona tại La Liga.']}],negotiations:[]});
test('opening mail marks it read and name buttons route to the exact player, club and competition',()=>{
 const g=fresh(),calls=[],view=mount('Inbox.jsx',{g,mutate:fn=>fn(g),openPlayer:id=>calls.push(['player',id]),openClub:id=>calls.push(['club',id]),openCompetition:id=>calls.push(['competition',id])});
 view.find(n=>n.type==='button'&&n.props.className?.startsWith('mail-preview ')).props.onClick();view.render();assert.equal(g.messages[0].readAt,g.date);
 for(const label of ['Lamine Yamal','Barcelona','La Liga'])view.find(n=>n.type==='button'&&n.props.className==='mail-entity'&&textOf(n)===label).props.onClick();
 assert.deepEqual(calls,[['player','p'],['club','b'],['competition','esp']]);
});
test('pending and failed negotiations open their existing history from mail; no duplicate negotiation or payment is created',()=>{
 const g=fresh(),calls=[];g.negotiations=[{id:'deal-1',playerId:'p',stage:'club',pendingOffer:{terms:{fee:90},replyOn:'2026-08-17'},history:[{text:'Counteroffer'}]}];
 const view=mount('Inbox.jsx',{g,mutate:fn=>fn(g),openNegotiation:id=>calls.push(id),onNegotiate:()=>assert.fail('Must not restart the deal')});
 view.find(n=>n.type==='button'&&n.props.className?.startsWith('mail-preview ')).props.onClick();view.render();const before=structuredClone(g.negotiations);
 view.button('Xem đề nghị đang chờ phản hồi').props.onClick();assert.deepEqual(calls,['p']);assert.deepEqual(g.negotiations,before);
 g.negotiations[0].stage='rejected';delete g.negotiations[0].pendingOffer;view.render();view.button('Xem diễn biến đàm phán').props.onClick();assert.deepEqual(calls,['p','p']);
});
test('shortlist controls set 3/6/12 months, display expiry, and remove a watch through the real handlers',()=>{
 const g=fresh(),view=mount('Shortlist.jsx',{g,id:'p',mutate:fn=>fn(g)},'ShortlistControl');
 for(const months of [3,6,12]){view.find(n=>n.type==='select').props.onChange({target:{value:String(months)}});view.render();assert.equal(g.shortlistEntries.p.months,months);assert.ok(textOf(view.tree).includes(shortlist.addMonths(g.date,months)));}
 view.button('Bỏ theo dõi').props.onClick();view.render();assert.deepEqual(g.shortlist,[]);assert.equal(g.shortlistEntries.p,undefined);
});
