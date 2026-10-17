import React,{useState} from 'react';
import {createPortal} from 'react-dom';
import {Modal,Portrait,PlayerPosition} from './components.jsx';
import {roleFit,fitLabel} from './tactics.mjs';
import {positionCode} from './playerPositions.mjs';
import {matchCondition} from './playerPhysical.mjs';
import {overall} from './engine.mjs';
import {matchSubLimit} from './matchday.mjs';
import {number} from './locale.mjs';

export default function TacticalPlayerPicker({g,lineup,bench,roles,players,eligible,live,side,rule,initial,onAssign,onAssignBench,onClose}){
 const [target,setTarget]=useState(initial.target||null),[selected,setSelected]=useState(initial.playerId||null),[query,setQuery]=useState(''),[error,setError]=useState('');
 const current=target&&(target.kind==='starter'?lineup:bench)[target.index],outgoing=g.players[current],incoming=g.players[selected];
 const position=target?.kind==='starter'?roles[target.index][0]:null;
 const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('vi').replaceAll('đ','d');
 const candidates=players.filter(p=>p.id!==current&&eligible(p)&&normalize(p.name).includes(normalize(query))).sort((a,b)=>(position?roleFit(b,position)-roleFit(a,position):0)||overall(b)-overall(a));
 const allowed=!!target&&incoming&&incoming.id!==current&&eligible(incoming)&&!(live&&live.red.includes(current));
 const chooseTarget=(kind,index)=>{setTarget({kind,index});setError('');};
 const confirm=()=>{if(!allowed)return;const ok=target.kind==='starter'?onAssign(target.index,selected):onAssignBench(target.index,selected);if(ok!==false)onClose();else setError('Chưa thể đổi cầu thủ. Hãy kiểm tra điều kiện thi đấu và số lượt thay người.');};
 const person=p=><><Portrait player={p} size={36}/><span><strong translate="no">{p.name}</strong><small><PlayerPosition player={p} compact/> · {number(matchCondition(g,p,live))}%</small></span></>;
 return createPortal(<Modal title={live?'Thay người & đổi vị trí':'Chọn cầu thủ cho đội hình'} onClose={onClose}><div className="touch-lineup-picker">
  <div className="touch-picker-context">{target?<><strong>{target.kind==='starter'?positionCode(position):'Ghế dự bị'} · {outgoing?.name||'Vị trí trống'}</strong><p>{live?'Chọn người thay thế rồi xác nhận. Trận đấu đang tạm dừng.':'Chọn cầu thủ rồi xác nhận để đổi đội hình.'}</p></>:<><strong translate="no">{incoming?.name}</strong><p>Chọn vị trí muốn xếp cầu thủ này.</p></>}{live&&<small>Đã thay {live.subs[side]}/{matchSubLimit(live)} cầu thủ</small>}</div>
  {target&&<input className="touch-picker-search" aria-label="Tìm người thay thế" placeholder="Tìm cầu thủ…" value={query} onChange={e=>setQuery(e.target.value)}/>}
  <div className="touch-picker-list">{!target?<>{roles.map((_,i)=>lineup[i]).map((id,i)=><button type="button" key={'s'+i} className="touch-target" disabled={id===selected||!!live&&(live.completed||live.red.includes(id))} onClick={()=>chooseTarget('starter',i)}><b>{positionCode(roles[i][0])}</b>{g.players[id]?person(g.players[id]):<span>Vị trí trống</span>}</button>)}{!live&&onAssignBench&&Array.from({length:rule.maxBench},(_,i)=><button type="button" key={'b'+i} className="touch-target" disabled={bench[i]===selected} onClick={()=>chooseTarget('bench',i)}><b>D{i+1}</b>{g.players[bench[i]]?person(g.players[bench[i]]):<span>Ghế dự bị trống</span>}</button>)}</>:<>{candidates.map(p=><button type="button" key={p.id} data-player-id={p.id} className={'touch-candidate '+(selected===p.id?'selected':'')} aria-pressed={selected===p.id} onClick={()=>{setSelected(p.id);setError('');}}>{person(p)}<span className="touch-candidate-fit"><small>{lineup.includes(p.id)?'Trên sân':bench.includes(p.id)?'Dự bị':'Ngoài danh sách'}</small>{position&&<small>{fitLabel(p,position)}</small>}</span></button>)}{!candidates.length&&<p className="empty">Không có cầu thủ phù hợp với tìm kiếm và điều kiện thi đấu.</p>}</>}</div>
  <div className="touch-picker-footer">{incoming&&target&&<p><strong translate="no">{incoming.name}</strong><span> → </span><strong translate="no">{outgoing?.name||positionCode(position)||'Ghế dự bị'}</strong></p>}{error&&<p role="alert">{error}</p>}<div><button type="button" className="secondary" onClick={onClose}>Hủy</button><button type="button" className="primary touch-confirm" disabled={!allowed} onClick={confirm}>{live&&incoming&&!lineup.includes(incoming.id)?'Xác nhận thay người':'Xác nhận đổi đội hình'}</button></div></div>
 </div></Modal>,document.body);
}
