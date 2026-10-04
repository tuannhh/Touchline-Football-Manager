import React from 'react';
import {ArrowLeft,CheckCircle,Play,WarningCircle} from '@phosphor-icons/react';
import {Badge} from './components.jsx';
import {dateLabel} from './locale.mjs';
import {competition} from './competitions.mjs';
import {preMatchReport} from './prematch.mjs';
import MatchEnvironment from './MatchEnvironment.jsx';
import TacticsPage from './TacticsPage.jsx';
import './prematch.css';

export default function PreMatch({g,fixture,onConfirm,onBack,mutate,openPlayer,nav}){
 const report=preMatchReport(g,fixture),home=g.clubs[fixture.home],away=g.clubs[fixture.away];
 return <>
  <section className="prematch-summary" aria-label="Chuẩn bị trước trận">
   <div className="prematch-heading"><div><span className="eyebrow">CHƯA GIAO BÓNG</span><h1>Chuẩn bị trước trận</h1><p>Chỉnh đội hình chính, dự bị và chiến thuật. Trận đấu chỉ bắt đầu sau khi bạn xác nhận.</p></div><button className="secondary" onClick={onBack}><ArrowLeft size={17}/>Về văn phòng</button></div>
   <div className="prematch-fixture"><div><Badge club={home} size={44}/><strong translate="no">{home.shortName}</strong></div><span>VS</span><div><Badge club={away} size={44}/><strong translate="no">{away.shortName}</strong></div></div>
   <p className="prematch-details">{fixture.leagueId==='friendly'?'Giao hữu':competition(g,fixture.leagueId)?.name} · {dateLabel(fixture.date||g.date)}</p>
   <div className={'prematch-readiness '+(report.valid?'ready':'needs-attention')}>
    {report.valid?<CheckCircle size={22}/>:<WarningCircle size={22}/>}
    <div><strong>{report.valid?'Đội hình đủ điều kiện thi đấu':'Cần kiểm tra danh sách trận'}</strong><p>{`Xuất phát: ${report.starters}/11 · Dự bị: ${report.reserves}/${report.rule.maxBench}`}</p>{report.starters<11&&<p>Đội hình chưa đủ 11 cầu thủ. Bạn vẫn có thể bổ sung trước khi xác nhận.</p>}</div>
   </div>
   {!report.valid&&<div role="alert" className="prematch-errors"><ul>{report.errors.map(error=><li key={error}>{error}</li>)}</ul><button className="text-button" onClick={()=>nav('registration')}>Đăng ký đội hình</button></div>}
   <div className="prematch-actions"><span>Ngày thi đấu và thời gian trận đấu chưa được tiếp tục.</span><button className="primary" disabled={!report.valid} onClick={onConfirm}><Play size={17} weight="fill"/>Xác nhận đội hình & vào trận</button></div>
  </section>
  <MatchEnvironment g={g} fixture={fixture} forecast/>
  <TacticsPage g={g} mutate={mutate} openPlayer={openPlayer} competitionId={fixture.leagueId}/>
  <div className="prematch-bottom"><button className="secondary" onClick={onBack}>Về văn phòng</button><button className="primary" disabled={!report.valid} onClick={onConfirm}><Play size={17} weight="fill"/>Xác nhận đội hình & vào trận</button></div>
 </>;
}
