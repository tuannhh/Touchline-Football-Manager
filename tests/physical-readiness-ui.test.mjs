import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {transformSync} from 'esbuild';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as physical from '../src/playerPhysical.mjs';
import * as locale from '../src/locale.mjs';

const source=readFileSync(new URL('../src/PhysicalReadiness.jsx',import.meta.url),'utf8');
const compiled=transformSync(source,{loader:'jsx',format:'cjs',target:'es2022'}).code;
const module={exports:{}};
runInNewContext(compiled,{module,exports:module.exports,require(name){
 if(name==='react')return React;
 if(name==='@phosphor-icons/react')return {Heartbeat:()=>null,WarningCircle:()=>null,ArrowsClockwise:()=>null};
 if(name==='./playerPhysical.mjs')return physical;
 if(name==='./locale.mjs')return locale;
 if(name==='./physical-readiness.css')return {};
 throw Error(`Unexpected readiness dependency: ${name}`);
}});
const {RestWarningPanel,default:PhysicalReadiness}=module.exports;
const player=(id,fitness=100)=>({id,name:`Player ${id}`,fitness,injury:0,position:'MF',attributes:{stamina:15}});
const render=(Component,props)=>renderToStaticMarkup(React.createElement(Component,props));

test('pre-match warning identifies a tired starter and gives rest advice without an automatic change',()=>{
 const p=player('tired',55),healthy=player('healthy'),g={date:'2026-08-15',players:{tired:p,healthy}};
 const html=render(RestWarningPanel,{g,players:[p,healthy],onProfile:()=>{}});
 assert.match(html,/Player tired/);assert.doesNotMatch(html,/Player healthy/);
 assert.match(html,/Cần nghỉ ngơi/);assert.match(html,/Thể lực 55%/);assert.match(html,/Nghỉ ngơi đề xuất:/);
 assert.match(html,/Bạn vẫn quyết định đội hình xuất phát/);
 assert.equal(p.fitness,55);assert.equal(healthy.fitness,100);
});

test('live injury is visible before post-match injury settlement and disappears after replacement or full time',()=>{
 const p=player('injured'),g={date:'2026-08-15',players:{injured:p}},live={injured:[p.id],off:[],red:[],minutes:{injured:20},completed:false};
 const props={g,players:[p],live,onTactics:()=>{}};
 const html=render(RestWarningPanel,props);
 assert.equal(p.injury,0);assert.match(html,/Chấn thương/);assert.match(html,/Cần thay ra để xử lý chấn thương/);
 assert.match(html,/Chiến thuật &amp; nhân sự/);assert.doesNotMatch(html,/Nghỉ ngơi đề xuất/);
 assert.equal(render(RestWarningPanel,{...props,live:{...live,off:[p.id]}}),'');
 assert.equal(render(RestWarningPanel,{...props,live:{...live,red:[p.id]}}),'');
 assert.equal(render(RestWarningPanel,{...props,live:{...live,completed:true}}),'');
});

test('profile renders accumulated recent workload and a separate rest recommendation',()=>{
 const p=player('busy',70),g={date:'2026-08-15',players:{busy:p},physical:{version:1,startedAt:'2026-08-01',players:{busy:{fatigue:40,recoveredThrough:'2026-08-15',recent:[{fixtureId:'a',date:'2026-08-10',minutes:90,load:90,kind:'club'},{fixtureId:'b',date:'2026-08-14',minutes:120,load:140,kind:'club'}]}}}};
 const html=render(PhysicalReadiness,{g,p});
 assert.match(html,/Mệt mỏi tích lũy/);assert.match(html,/40\/100/);
 assert.match(html,/Phút thi đấu \/ 7 ngày<\/dt><dd>210<\/dd>/);
 assert.match(html,/Phút thi đấu \/ 14 ngày<\/dt><dd>210<\/dd>/);
 assert.match(html,/Trận đấu \/ 14 ngày<\/dt><dd>2<\/dd>/);
 assert.match(html,/Từ lần ra sân gần nhất<\/dt><dd>1 ngày<\/dd>/);
 assert.match(html,/Nghỉ ngơi đề xuất:/);
});
