import {toggleShortlist} from './shortlist.mjs';
import {nextSuspension,hasScopedBan} from './playerStatus.mjs';
import React,{useMemo,useState} from 'react';
import {Panel,PlayerName,Empty} from './components.jsx';
import MoneyInput,{moneyLabel} from './MoneyInput.jsx';
import {clubPlayers,money} from './engine.mjs';
import {POSITION_DETAIL,FORMATION_SLOTS} from './tactics.mjs';
import {positionCode} from './playerPositions.mjs';
import {squadDepth,recruitmentMatches,setRecruitmentPlan} from './recruitment.mjs';
import './recruitment.css';
export default function RecruitmentPlanner({g,mutate,openPlayer,onNegotiate,nav}){
 const [expanded,setExpanded]=useState(false),[phase,setPhase]=useState('inPossession');
 const [draft,setDraft]=useState(()=>g.recruitmentPlan||{position:'ST',maxAge:28,maxFee:g.clubs[g.clubId].budget,maxWage:150000});
 const formation=g.phaseTactics?.enabled?g.phaseTactics[phase].formation:g.formation;
 const rows=useMemo(()=>squadDepth(g,formation),[g,formation]),matches=useMemo(()=>recruitmentMatches(g),[g]);
 const contracts=clubPlayers(g,g.clubId).filter(p=>p.contractUntil<=g.year+1).sort((a,b)=>a.contractUntil-b.contractUntil);
 const gaps=rows.filter(r=>r.gap>0);const update=(key,value)=>setDraft(p=>({...p,[key]:value}));
 return <Panel title="Hoạch định đội hình & tuyển mộ" subtitle={`${gaps.length} vị trí chưa có đủ người dự phòng · ${contracts.length} hợp đồng hết hạn năm ${g.year}–${g.year+1}`} action={<button className="secondary" onClick={()=>setExpanded(!expanded)}>{expanded?'Thu gọn':'Mở kế hoạch'}</button>}>
 {expanded?<div className="recruitment-planner">
  <div className="recruitment-plan-head"><div><h3>Chiều sâu đội hình · {formation}</h3><p>Mục tiêu hai người cho mỗi suất. Cầu thủ đa năng có thể xuất hiện ở nhiều vị trí; đây không phải một đội hình đã được đăng ký.</p></div>{g.phaseTactics?.enabled&&<select aria-label="Trạng thái hoạch định" value={phase} onChange={e=>setPhase(e.target.value)}><option value="inPossession">Khi có bóng</option><option value="outOfPossession">Khi không có bóng</option></select>}</div>
  <div className="depth-grid">{rows.map(row=><article key={row.role} className={row.ready<row.needed?'thin':''}><header><strong>{positionCode(row.role)} · {POSITION_DETAIL[row.role]}</strong><span>{row.ready}/{row.target} sẵn sàng</span></header><div>{row.players.slice(0,row.target).map(p=><button key={p.id} onClick={()=>openPlayer(p.id)}>{p.name}{p.injury?' · Chấn thương':nextSuspension(g,p)?' · Treo giò':p.internationalDuty?.active?' · Lên tuyển':''}</button>)}</div>{row.gap>0&&<button className="small-button" onClick={()=>update('position',row.role)}>Tìm thêm {positionCode(row.role)}</button>}</article>)}</div>
  <details className="contract-watch"><summary>Hợp đồng cần theo dõi ({contracts.length})</summary>{contracts.length?contracts.map(p=><div key={p.id}><button className="text-button" onClick={()=>openPlayer(p.id)}>{p.name}</button><span>Hết năm {p.contractUntil} · {money(p.wage)}/tuần</span></div>):<p>Chưa có hợp đồng gần hết hạn.</p>}<p>Game hiện lưu thời hạn theo năm; chưa có ngày hết hạn chính xác.</p></details>
  <h3>Yêu cầu tuyển mộ</h3><p>Đặt tiêu chí để tổng hợp ứng viên từ thị trường mô phỏng. Chỉ mở hồ sơ hoặc bắt đầu đàm phán khi bạn chọn.</p>
  <form className="recruitment-brief" onSubmit={e=>{e.preventDefault();mutate(x=>setRecruitmentPlan(x,draft),'Đã lưu yêu cầu tuyển mộ.');}}>
   <label className="field">Vị trí<select value={draft.position} onChange={e=>update('position',e.target.value)}>{[...new Set(Object.values(FORMATION_SLOTS).flatMap(xs=>xs.map(x=>x[0])))].map(role=><option key={role} value={role}>{positionCode(role)} · {POSITION_DETAIL[role]}</option>)}</select></label>
   <label className="field">Tuổi tối đa<input type="number" min="16" max="50" required value={draft.maxAge} onChange={e=>update('maxAge',Number(e.target.value))}/></label>
   <label className="field">{moneyLabel('Phí tối đa (€)')}<MoneyInput min={0} max={1e12} required value={draft.maxFee} onChange={v=>update('maxFee',v)}/></label>
   <label className="field">{moneyLabel('Lương hiện tại tối đa (€/tuần)')}<MoneyInput min={0} max={1e8} required value={draft.maxWage} onChange={v=>update('maxWage',v)}/></label>
   <button className="primary">Lưu yêu cầu & tìm ứng viên</button>
  </form>
  {g.recruitmentPlan&&<><button className="secondary" onClick={()=>nav?.('scouting')}>Mở trung tâm tuyển trạch</button><h3>Ứng viên · {positionCode(g.recruitmentPlan.position)}</h3><p className="fine-print">Ưu tiên cầu thủ đang được rao bán. Phí là ước tính; lương đang hưởng có thể khác mức cầu thủ yêu cầu khi đàm phán.</p><div className="recruitment-candidates">{matches.map(({player:p,fee,wage})=><article key={p.id}><PlayerName player={p} onClick={openPlayer}/><div><strong>{money(fee)}</strong><small>{money(wage)}/tuần</small></div><button className="small-button" onClick={()=>mutate(x=>{toggleShortlist(x,p.id);})}>{g.shortlist.includes(p.id)?'Bỏ theo dõi':'Theo dõi'}</button><button className="small-button" onClick={()=>onNegotiate(p.id)}>Đàm phán</button></article>)}</div>{!matches.length&&<Empty>Chưa có ứng viên khớp tiêu chí. Có thể tăng ngân sách hoặc nới độ tuổi.</Empty>}</>}
  <p className="fine-print">Lấy cảm hứng từ <a href="https://www.footballmanager.com/fm26/features/powered-transferroom-fm26s-recruitment-revamp" target="_blank" rel="noreferrer">khu tuyển dụng FM26</a>. Phân tích và ứng viên thuộc thế giới game, không kết nối TransferRoom.</p>
 </div>:<p className="recruitment-summary">Xem người dự phòng, hợp đồng và tìm ứng viên theo vị trí, tuổi, phí, lương.</p>}
 </Panel>;
}
