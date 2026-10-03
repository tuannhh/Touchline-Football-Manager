import React,{useState} from 'react';
import {Pitch} from './components.jsx';
import {FORMATION_SLOTS,TACTICAL_PHASES,PHASE_TACTICS_SOURCE,phaseLineup,phaseShape,roleFit} from './tactics.mjs';
import './phase-tactics.css';

export default function PhaseTacticsPanel({g,config,lineup,formation,phase,onPhase,onEnable,onFormation,disabled=false,live}){
 const [compare,setCompare]=useState(true),enabled=!!config?.enabled;
 return <section className="phase-tactics-panel" aria-label="Sơ đồ khi có bóng và khi không có bóng">
  <div className="phase-tactics-heading"><div><span className="eyebrow">HAI PHA · CÙNG MỘT ĐỘI HÌNH</span><h2>Có bóng / Không có bóng</h2><p>Chọn vị trí của từng cầu thủ trong mỗi pha. Cầu thủ vào thay kế thừa cả hai vị trí.</p></div><button className={enabled?'secondary':'primary'} disabled={disabled} onClick={()=>onEnable(!enabled)}>{enabled?'Dùng một sơ đồ':'Bật hai sơ đồ'}</button></div>
  {enabled?<>
   <div className="phase-tactics-switch"><div className="segmented">{Object.entries(TACTICAL_PHASES).map(([key,label])=><button key={key} aria-pressed={phase===key} className={phase===key?'active':''} onClick={()=>onPhase(key)}>{label}</button>)}</div><button className="text-button" onClick={()=>setCompare(!compare)}>{compare?'Ẩn so sánh':'Xem hai sơ đồ cạnh nhau'}</button></div>
   <div className={'phase-tactics-comparison '+(!compare?'without-pitches':'')}>{Object.entries(TACTICAL_PHASES).map(([key,label])=>{
    const shape=phaseShape(config,key,formation),ids=phaseLineup(lineup,config,key,formation),active=ids.map((id,i)=>({p:g.players[id],role:FORMATION_SLOTS[shape.formation][i][0]})).filter(({p})=>p&&!live?.red.includes(p.id)&&!live?.injured.includes(p.id));
    const fit=active.length?Math.round(active.reduce((n,{p,role})=>n+roleFit(p,role),0)/active.length*100):0;
    return <article key={key} aria-label={"Sơ đồ "+label.toLowerCase()} className={'phase-shape '+(phase===key?'selected':'')} data-phase-preview={key}><header><button className="text-button" onClick={()=>onPhase(key)} aria-pressed={phase===key}><strong>{label}</strong><small>{phase===key?'Đang chỉnh trên bảng bên dưới':'Bấm để chỉnh vị trí'}</small></button><label className="field"><span className="sr-only">Sơ đồ {label.toLowerCase()}</span><select aria-label={'Sơ đồ '+label.toLowerCase()} value={shape.formation} disabled={disabled} onChange={e=>{onFormation(key,e.target.value);onPhase(key);}}>{Object.keys(FORMATION_SLOTS).map(f=><option key={f} value={f} translate="no">{f}</option>)}</select></label></header>{compare&&<Pitch compact g={g} formation={shape.formation} lineup={ids} live={live} onSelect={()=>onPhase(key)}/>}<footer>Phù hợp vị trí: <strong>{fit}%</strong> · {key==='inPossession'?'Triển khai và tạo cơ hội':'Giữ khối và chống cơ hội'}</footer></article>;
   })}</div>
   <p className="fine-print">Đang chỉnh: <strong>{TACTICAL_PHASES[phase]}</strong>. Kéo hai cầu thủ đang đá chỉ đổi chỗ trong pha này; thay người cập nhật cả hai pha. Di chuyển xa hơn giữa hai sơ đồ làm hao thể lực nhanh hơn khi mất hoặc giành bóng. Tắt chế độ sẽ dùng sơ đồ có bóng cho cả hai pha.</p>
  </>:<p className="fine-print">Hiện dùng {formation} cho cả hai pha. Bật để tạo hai bản sao từ đội hình hiện tại rồi chỉnh riêng từng pha.</p>}
  <p className="phase-source">Tham khảo ý tưởng hai sơ đồ trong <a href={PHASE_TACTICS_SOURCE} target="_blank" rel="noreferrer">giới thiệu chiến thuật FM26</a>. Touchline dùng mô phỏng riêng: vị trí, độ phù hợp, cấu trúc đội hình và tải di chuyển.</p>
 </section>;
}
