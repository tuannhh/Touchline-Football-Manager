import React,{useEffect,useMemo,useRef,useState} from 'react';
import {MagnifyingGlass} from '@phosphor-icons/react';
import {Modal,Badge,Portrait,PlayerPosition} from './components.jsx';
import {createSearchIndex,searchWorld} from './worldSearch.mjs';
import {number} from './locale.mjs';

export default function WorldSearch({g,onClose,onPlayer,onClub}){
 const [query,setQuery]=useState(''),[type,setType]=useState('all'),[page,setPage]=useState(0),input=useRef(null);
 const index=useMemo(()=>createSearchIndex(g),[g.players,g.clubs]);
 const found=useMemo(()=>searchWorld(index,query,{type,page}),[index,query,type,page]);
 useEffect(()=>{const frame=requestAnimationFrame(()=>input.current?.focus());return()=>cancelAnimationFrame(frame);},[]);
 const select=row=>{onClose();if(row.type==='player')onPlayer(row.id);else onClub(row.id);};
 return <Modal title="Tìm cầu thủ & CLB" wide onClose={onClose}><div className="world-search">
  <form className="world-search-form" onSubmit={e=>{e.preventDefault();if(found.results[0])select(found.results[0]);}}>
   <label className="search"><MagnifyingGlass size={22}/><span className="visually-hidden">Tìm cầu thủ hoặc câu lạc bộ</span><input ref={input} type="search" value={query} maxLength={120} placeholder="Nhập tên cầu thủ hoặc CLB…" onChange={e=>{setQuery(e.target.value);setPage(0);}} autoComplete="off"/></label>
  </form>
  <p className="fine-print">Tìm trong sự nghiệp đang chơi, gồm cả nguồn tuyển trạch. Có thể nhập tên không dấu hoặc một phần tên.</p>
  <div className="world-search-filters" role="group" aria-label="Loại kết quả">
   {[['all','Tất cả'],['player','Cầu thủ'],['club','Câu lạc bộ']].map(([id,label])=><button type="button" key={id} className={type===id?'primary':'secondary'} aria-pressed={type===id} onClick={()=>{setType(id);setPage(0);}}>{label}<span>{number(id==='all'?found.counts.player+found.counts.club:found.counts[id])}</span></button>)}
  </div>
  <div className="world-search-status" role="status">{!query.trim()?'Nhập tên để bắt đầu tìm kiếm.':`${number(found.total)} kết quả`}</div>
  {query.trim()&&!found.total&&<p className="empty">Không tìm thấy cầu thủ hoặc CLB phù hợp. Hãy thử tên ngắn hơn hoặc kiểm tra chính tả.</p>}
  <ul className="world-search-results">{found.results.map(row=>{
   const p=row.type==='player'?g.players[row.id]:null,c=p?g.clubs[p.clubId]:g.clubs[row.id],league=g.leagues.find(l=>l.id===(c?.scoutingLeagueId||c?.leagueId));
   return <li key={row.type+row.id}><button type="button" onClick={()=>select(row)}>
    {p?<Portrait player={p} size={42}/>:<Badge club={c} size={42}/>}
    <span className="world-search-name"><strong translate="no">{row.name}</strong><small>{p?<><span translate="no">{c?.name}</span> · <PlayerPosition player={p} compact/></>:<><span translate="no">{league?.name}</span> · <span>{league?.country}</span></>}</small></span>
    <span className="world-search-kind">{p?'Cầu thủ':'Câu lạc bộ'}</span>
   </button></li>;
  })}</ul>
  {found.pages>1&&<div className="world-search-pages"><button className="secondary" disabled={found.page===0} onClick={()=>setPage(found.page-1)}>Trước</button><span>{`Trang ${number(found.page+1)}/${number(found.pages)}`}</span><button className="secondary" disabled={found.page+1>=found.pages} onClick={()=>setPage(found.page+1)}>Sau</button></div>}
 </div></Modal>;
}
