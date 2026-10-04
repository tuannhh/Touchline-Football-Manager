import {playerReadiness} from './playerPhysical.mjs';
import i18n from './i18n.mjs';
import React, {createContext, useContext, useEffect, useRef, useState} from 'react';
import { X, SoccerBall, Check, WarningCircle } from '@phosphor-icons/react';
import { FORMATIONS, overall, POSITION, money, ATTRS, hash } from './engine.mjs';
import {FORMATION_SLOTS,roleFit,fitLabel} from './tactics.mjs';
import {portraitIndex,resolvePortrait,portraitFrame} from './portraits.mjs';
import {positionCode,positionLabel,positionDescription,secondaryRoles,detailedPositionOptions} from './playerPositions.mjs';

const PortraitContext=createContext(null);
const ClubNavigationContext=createContext(null);
export function ClubNavigationProvider({onOpen,children}){return <ClubNavigationContext.Provider value={onOpen}>{children}</ClubNavigationContext.Provider>;}
export function ClubLink({club,size=24,children,showBadge=true,className=''}){
 const open=useContext(ClubNavigationContext);if(!club)return null;
 const content=<>{showBadge&&<Badge club={club} size={size}/>} {children||<strong translate="no">{club.shortName||club.name}</strong>}</>;
 return open?<button type="button" className={'club-link '+className} aria-label={'Xem CLB '+club.name} onClick={()=>open(club.id)}>{content}</button>:<span className={'club-inline '+className}>{content}</span>;
}
export function PortraitProvider({children,paused=false}){
 const [index,setIndex]=useState(null);
 useEffect(()=>{
  let disposed=false,pending=false,serialized='';const controller=new AbortController();
  const refresh=async()=>{
   if(paused||pending||document.visibilityState==='hidden')return;pending=true;
   try{
    const response=await fetch('/data/portraits.json',{cache:'no-cache',signal:controller.signal});if(!response.ok)return;
    const data=await response.json();if(disposed)return;const next=JSON.stringify(data);
    if(next!==serialized){serialized=next;setIndex(portraitIndex(data));}
   }catch{/* The saved photos and illustrations remain available offline. */}finally{pending=false;}
  };
  refresh();const interval=setInterval(refresh,60000);document.addEventListener('visibilitychange',refresh);window.addEventListener('focus',refresh);
  return()=>{disposed=true;controller.abort();clearInterval(interval);document.removeEventListener('visibilitychange',refresh);window.removeEventListener('focus',refresh);};
 },[paused]);
 return <PortraitContext.Provider value={index}>{children}</PortraitContext.Provider>;
}
export function usePortrait(player){return resolvePortrait(player,useContext(PortraitContext));}

export function Badge({club,size=32}){return club?.badge?<img className="club-badge" src={club.badge} width={size} height={size} alt={club.name} translate="no"/>:<span className="badge-fallback" style={{width:size,height:size,background:club?.color}}>{club?.abbreviation?.slice(0,2)}</span>;}
export function Portrait({player,size=42}){
 const portrait=usePortrait(player),[failed,setFailed]=useState('');if(!portrait)return null;
 const frame=portraitFrame(portrait.photoFraming),imageStyle=frame?{position:'absolute',maxWidth:'none',width:`${100/frame.w}%`,height:`${100/frame.h}%`,left:`${-100*frame.x/frame.w}%`,top:`${-100*frame.y/frame.h}%`,objectFit:'fill'}:undefined;
 const src=typeof portrait.photo==='string'&&portrait.photo?portrait.photo+(typeof portrait.photoDigest==='string'&&portrait.photoDigest?(portrait.photo.includes('?')?'&':'?')+'v='+encodeURIComponent(portrait.photoDigest.slice(0,16)):''):'';
 const label=src&&failed!==src?'Ảnh thật · '+portrait.name:src?'Ảnh thật chưa tải được · '+portrait.name:'Ảnh minh họa AI, chưa có ảnh thật · '+portrait.name;
 return <span className="portrait" style={{width:size,height:size}} title={label}>{src&&failed!==src?<img key={src} src={src} style={imageStyle} alt={'Ảnh thật '+portrait.name} loading="lazy" onError={()=>setFailed(src)}/>:<span className="avatar-ai" role="img" aria-label={label} style={src?{backgroundImage:'none',backgroundColor:'var(--surface-2,#26382b)'}:{backgroundPosition:`${(hash(portrait.id)%8)/7*100}% ${Math.floor((hash(portrait.id)%64)/8)/7*100}%`}}><span className="avatar-initials" style={src?{display:'flex',width:'100%',height:'100%',alignItems:'center',justifyContent:'center',fontSize:Math.max(12,size*.3)}:undefined}>{portrait.name.split(' ').map(x=>x[0]).slice(-2).join('')}</span></span>}</span>;
}
export function Rating({player,small=false}){const n=overall(player);return <span className={`rating ${n>=85?'elite':n>=70?'good':'normal'} ${small?'small':''}`}>{n}</span>;}
export function Meter({value,tone}){return <span className="meter" title={Math.round(value)+'%'}><span style={{width:Math.max(0,Math.min(100,value))+'%',background:tone||(value<60?'var(--red)':value<80?'var(--amber)':'var(--lime)')}}/></span>;}
export function Form({results=[]}){return <span className="form-badges">{results.length?results.slice(-5).map((x,i)=><span key={i} className={'form-'+x}>{i18n.t('form.'+x)}</span>):<span className="muted">Chưa thi đấu</span>}</span>;}
export function Panel({title,subtitle,action,children,className=''}){return <section className={'panel '+className}><div className="panel-head"><div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div>{action}</div>{children}</section>;}
export function Empty({children}){return <div className="empty"><SoccerBall size={32}/><p>{children}</p></div>;}
export function PageTitle({eyebrow,title,description,action}){return <div className="page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{description&&<p>{description}</p>}</div>{action}</div>;}
export function Modal({title,children,onClose,wide=false}){
  const ref=useRef(null);
  useEffect(()=>{const prev=document.activeElement;ref.current?.focus();function key(e){if([...document.querySelectorAll('[role="dialog"]')].at(-1)!==ref.current)return;if(e.key==='Escape')onClose();if(e.key==='Tab'){const nodes=[...ref.current.querySelectorAll('button,input,select,a[href],textarea,[tabindex="0"]')].filter(x=>!x.disabled);if(!nodes.length){e.preventDefault();return;}const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&(document.activeElement===first||document.activeElement===ref.current)){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);prev?.focus();};},[]);
  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><section ref={ref} tabIndex={-1} className={'modal '+(wide?'wide':'')} role="dialog" aria-modal="true" aria-label={title}><header><h2>{title}</h2><button className="icon-button" aria-label="Đóng" onClick={onClose}><X size={22}/></button></header>{children}</section></div>;
}
export function Pitch({g,formation=g.formation,lineup=g.lineup,onSelect,selected,compact=false,dragBindings,slotBindings,dropTarget,live,positions,roleLabels,positionPreview}){
 const resolved=positions||FORMATION_SLOTS[formation];
 return <div className={'tactics-pitch '+(compact?'compact':'')}><div className="pitch-markings"><div className="half-line"/><div className="center-circle"/><div className="penalty top"/><div className="penalty bottom"/><div className="goal top"/><div className="goal bottom"/></div>{resolved.map(([baseRole,baseX,baseY],i)=>{
  const preview=positionPreview?.index===i?positionPreview:null,role=preview?.position||baseRole,x=preview?.x??baseX,y=preview?.y??baseY;
  const p=g.players[lineup[i]],bindings=slotBindings?.(i,p)||dragBindings?.(p?.id)||{},red=live?.red.includes(p?.id),injured=live?.injured.includes(p?.id)||p?.injury>0,readiness=p?playerReadiness(g,p,{live}):null;
  return <button {...bindings} type="button" data-drop-slot={i} className={`pitch-player ${selected===i?'selected':''} ${dropTarget===i?'drop-target':''} ${red?'sent-off':''} ${preview?'moving-position':''}`} style={{...bindings.style,left:x+'%',top:y+'%'}} key={i} onClick={()=>onSelect?.(i,p)} title={p?p.name+' · Đang đá: '+positionCode(role)+' · '+positionDescription(p)+' · '+fitLabel(p,role)+(roleLabels?.[i]?' · '+roleLabels[i]:'')+(red?' · ĐÃ NHẬN THẺ ĐỎ':injured?' · CHẤN THƯƠNG':readiness?.needsRest?' · Cần nghỉ ngơi':''):'Chọn cầu thủ'} aria-label={`Vị trí ${i+1}: ${p?.name||positionCode(role)}`}><span className={'shirt '+(role==='GK'?'keeper':'')}>{red?'×':p?.number||i+1}</span><span className="player-label">{p?.shortName||positionCode(role)}</span><span className="pitch-role">{positionCode(role)}{injured?' +':''}</span>{p&&!red&&!live?.off.includes(p.id)&&<span className={'pitch-condition '+(injured?'injured':readiness.needsRest?'needs-rest':'')}>{injured?'Chấn thương':`${Math.round(readiness.fitness)}%`}{!injured&&readiness.needsRest?' · Nghỉ':''}</span>}{roleLabels?.[i]&&<span className="pitch-assigned-role" translate="no" aria-label={roleLabels[i]}>{roleLabels[i].split(/[\s-]+/).map(word=>word[0]).join('')}</span>}{p&&<span className={'position-grade '+(roleFit(p,role)<.8?'mismatch':'')}>{Math.round(overall(p)*roleFit(p,role))}</span>}</button>;
 })}</div>;
}
export function PlayerPosition({player,compact=false}){
 const secondary=secondaryRoles(player);
 return <span className={'player-position'+(compact?' compact':'')} title={positionDescription(player)}><span className={'position '+player.position}>{positionLabel(player)}</span>{!compact&&secondary.length>0&&<small>Phụ: {secondary.map(positionCode).join(' / ')}</small>}</span>;
}
export function PositionOptions(){return <><optgroup label="Nhóm vị trí">{Object.entries(POSITION).map(([code,label])=><option key={code} value={code}>{code} · {label}</option>)}</optgroup><optgroup label="Vị trí cụ thể · gồm vị trí phụ">{detailedPositionOptions.filter(([code])=>code!=='GK').map(([code,label])=><option key={code} value={code}>{label}</option>)}</optgroup></>;}
export function PlayerName({player,onClick,sub}){return <button className="player-name" onClick={()=>onClick(player.id)}><Portrait player={player}/><span><strong translate="no">{player.name}</strong><small title={positionDescription(player)}>{sub||`${positionLabel(player)} · ${player.age} tuổi`}</small></span></button>;}
export function Attributes({player}){return <div className="attributes">{Object.entries(ATTRS).map(([key,label])=><div key={key}><span>{label}</span><b className={player.attributes[key]>=16?'lime':''}>{player.attributes[key]}</b><Meter value={player.attributes[key]*5}/></div>)}</div>;}
export function Toast({message}){return message?<div className={'toast '+(message.error?'error':'')} role={message.error?'alert':'status'}>{message.error?<WarningCircle size={20}/>:<Check size={20}/>}<span>{message.text}</span></div>:null;}
export function Stat({label,value,detail,icon:Icon}){return <div className="stat"><div className="stat-label">{label}{Icon&&<Icon size={18}/>}</div><strong>{value}</strong><small>{detail}</small></div>;}
export function TableStandings({g,rows,full=false}){return <div className="table-scroll"><table className="standings"><thead><tr><th>#</th><th>CLB</th><th>{i18n.t('table.played')}</th>{full&&<><th>{i18n.t('table.won')}</th><th>{i18n.t('table.drawn')}</th><th>{i18n.t('table.lost')}</th><th>{i18n.t('table.gf')}</th><th>{i18n.t('table.ga')}</th></>}<th>{i18n.t('table.gd')}</th><th>{i18n.t('table.points')}</th>{full&&<th>Phong độ</th>}</tr></thead><tbody>{rows.map((r,i)=><tr key={r.clubId} className={r.clubId===g.clubId?'own-row':''}><td>{r.rank??i+1}</td><td><ClubLink club={g.clubs[r.clubId]}/></td><td>{r.played}</td>{full&&<><td>{r.won}</td><td>{r.drawn}</td><td>{r.lost}</td><td>{r.gf}</td><td>{r.ga}</td></>}<td>{r.gf-r.ga>0?'+':''}{r.gf-r.ga}</td><td><b>{r.points}</b></td>{full&&<td><Form results={r.form}/></td>}</tr>)}</tbody></table></div>;}
export function ClubPicker({g,value,onChange,label='CLB'}){return <label className="field">{label}<select value={value} onChange={e=>onChange(e.target.value)}>{g.leagues.map(l=><optgroup label={l.name} key={l.id}>{Object.values(g.clubs).filter(c=>c.leagueId===l.id).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>)}</select></label>;}
