import React from 'react';
import {Heartbeat,WarningCircle,ArrowsClockwise} from '@phosphor-icons/react';
import {playerReadiness} from './playerPhysical.mjs';
import {number} from './locale.mjs';
import './physical-readiness.css';

const injuredNow=(p,live)=>p.injury>0||!!live?.injured?.includes(p.id);

export function ReadinessBadge({g,p,live=null,readiness,showNormal=false}){
 const report=readiness||playerReadiness(g,p,{live}),injured=injuredNow(p,live);
 if(!injured&&!report.needsRest&&report.risk==='normal'&&!showNormal)return null;
 const label=injured?'Chấn thương':report.needsRest?'Cần nghỉ ngơi':report.risk!=='normal'?'Nguy cơ quá tải':'Sẵn sàng';
 return <span className={'physical-badge '+(injured||report.risk==='high'?'high':report.needsRest||report.risk==='elevated'?'elevated':'normal')}><Heartbeat size={12} aria-hidden="true"/>{label}</span>;
}

export function RestWarningPanel({g,players,live=null,date=g.date,title='Cần cân nhắc thể lực',onTactics,onProfile}){
 if(live?.completed)return null;
 const reports=[...new Map(players.filter(Boolean).map(p=>[p.id,p])).values()]
  .filter(p=>!live||!live.off.includes(p.id)&&!live.red.includes(p.id))
  .map(p=>({p,report:playerReadiness(g,p,{live,date}),injured:injuredNow(p,live)}))
  .filter(({report,injured})=>injured||report.needsRest);
 if(!reports.length)return null;
 const hasInjury=reports.some(({injured})=>injured);
 return <section className={'physical-warning-panel '+(hasInjury?'has-injury':'')} aria-label={title}>
  <div className="physical-warning-heading"><WarningCircle size={23} aria-hidden="true"/><div><h3>{title}</h3><p>{live?(hasInjury?'Cầu thủ chấn thương cần được thay. Cân nhắc thay cả cầu thủ đang xuống sức.':'Cầu thủ đang xuống sức. Cân nhắc thay người hoặc giảm cường độ thi đấu.'):'Cân nhắc cho các cầu thủ dưới đây nghỉ ngơi và bố trí người thay thế. Bạn vẫn quyết định đội hình xuất phát.'}</p></div>{onTactics&&<button className="secondary" onClick={onTactics}><ArrowsClockwise size={16}/>Chiến thuật & nhân sự</button>}</div>
  <ul className="physical-warning-list">{reports.map(({p,report,injured})=><li key={p.id}>
   <div className="physical-warning-person">{onProfile?<button className="player-text-button" onClick={()=>onProfile(p.id)} translate="no">{p.name}</button>:<strong translate="no">{p.name}</strong>}<ReadinessBadge g={g} p={p} live={live} readiness={report}/></div>
   <div className="physical-warning-numbers"><span>{`Thể lực ${number(report.fitness)}%`}</span>{!injured&&report.restDays>0&&<span>{`Nghỉ ngơi đề xuất: ${number(report.restDays)} ngày`}</span>}</div>
   <p>{injured&&live?'Cần thay ra để xử lý chấn thương.':report.reasons.map((reason,i)=><React.Fragment key={reason}>{i>0&&' · '}<span>{reason}</span></React.Fragment>)}</p>
  </li>)}</ul>
 </section>;
}

export default function PhysicalReadiness({g,p,live=null}){
 const report=playerReadiness(g,p,{live}),injured=injuredNow(p,live);
 return <section className="physical-profile" aria-label="Thể lực & tải thi đấu">
  <div className="wellbeing-heading"><h3>Thể lực & tải thi đấu</h3><ReadinessBadge g={g} p={p} live={live} readiness={report} showNormal/></div>
  <dl className="physical-facts"><div><dt>Thể lực hiện tại</dt><dd>{number(report.fitness)}%</dd></div><div><dt>Mệt mỏi tích lũy</dt><dd>{number(report.fatigue)}/100</dd></div><div><dt>Phút thi đấu / 7 ngày</dt><dd>{number(report.minutes7)}</dd></div><div><dt>Phút thi đấu / 14 ngày</dt><dd>{number(report.minutes14)}</dd></div><div><dt>Trận đấu / 14 ngày</dt><dd>{number(report.matches14)}</dd></div><div><dt>Từ lần ra sân gần nhất</dt><dd>{report.daysSinceLastMatch==null?'Chưa có dữ liệu':`${number(report.daysSinceLastMatch)} ngày`}</dd></div></dl>
  {report.reasons.length>0&&<ul className="physical-reasons">{report.reasons.map(reason=><li key={reason}>{reason}</li>)}</ul>}
  {!injured&&report.restDays>0&&<p className="physical-rest-advice"><Heartbeat size={17}/><strong>{`Nghỉ ngơi đề xuất: ${number(report.restDays)} ngày`}</strong></p>}
  <p className="fine-print">Thể lực và mệt mỏi được mô phỏng theo số phút thi đấu, cường độ và thời gian hồi phục. Số ngày nghỉ là gợi ý; hãy kiểm tra lại trước trận tiếp theo.</p>
 </section>;
}
