import React,{useMemo,useState} from 'react';
import {ArrowSquareOut,ShieldCheck,WarningCircle} from '@phosphor-icons/react';
import {Badge,Panel} from './components.jsx';
import {money,number,getLocale} from './locale.mjs';
import {financeReport} from './financialSustainability.mjs';
import './financial-dashboard.css';

const statusLabels={healthy:'Trong giới hạn',warning:'Gần giới hạn',restricted:'Hạn chế tuyển quân'};

export default function FinancialDashboard({g}){
 const [selectedId,setSelectedId]=useState(g.clubId);
 const clubId=g.clubs[selectedId]?selectedId:g.clubId,club=g.clubs[clubId];
 const groups=useMemo(()=>g.leagues.map(league=>({league,clubs:Object.values(g.clubs).filter(c=>c.leagueId===league.id).sort((a,b)=>a.name.localeCompare(b.name,getLocale()))})).filter(group=>group.clubs.length),[g.clubs,g.leagues]);
 const report=financeReport(g,clubId);
 if(!report?.enabled||!club)return null;
 const measuredCost=report.measuredCost??report.annualCost,wagesOnly=report.policy?.costBasis==='wages',calculationRevenue=report.calculationRevenue??Math.max(1,report.revenue+(wagesOnly?0:report.transferProfit));
 const used=report.limit>0?measuredCost/report.limit*100:100;
 const policies=report.policies?.length?report.policies:[report.policy].filter(Boolean);
 return <Panel className="financial-dashboard" title="Kiểm soát tài chính" subtitle="Dự toán theo mùa trong thế giới mô phỏng của bạn." action={<label className="financial-club-picker"><span>Kiểm tra CLB</span><select aria-label="CLB kiểm soát tài chính" value={clubId} onChange={e=>setSelectedId(e.target.value)}>{groups.map(({league,clubs})=><optgroup key={league.id} label={league.name}>{clubs.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>)}</select></label>}>
  <div className="financial-content">
   <div className="financial-club-heading"><Badge club={club} size={44}/><div><h3 translate="no">{club.name}</h3><p>Mùa {report.year}/{String(report.year+1).slice(-2)} · {clubId===g.clubId?'CLB của bạn':'CLB AI'}</p></div><span className={'financial-status '+report.status}>{report.status==='healthy'?<ShieldCheck size={18}/>:<WarningCircle size={18}/>} {statusLabels[report.status]||statusLabels.warning}</span></div>
   <div className="financial-metrics">
    <div><span>{wagesOnly?'Lương đội hình / năm':'Chi phí đội hình / năm'}</span><strong>{money(measuredCost)}</strong><small>{number(report.ratio*100,1)}% doanh thu tính toán</small></div>
    <div><span>Hạn mức đang áp dụng</span><strong>{money(report.limit)}</strong><small>{report.policy?.label}</small></div>
    <div className={report.headroom<0?'financial-negative':'financial-headroom'}><span>Dư địa chi phí hằng năm</span><strong>{money(report.headroom)}</strong><small>{report.headroom<0?'Cần giảm chi trước khi tuyển thêm':wagesOnly?'Còn lại cho lương cầu thủ và HLV':'Còn lại cho lương và phân bổ phí'}</small></div>
   </div>
   <div className={'financial-limit-meter '+report.status} role="meter" aria-label="Mức sử dụng hạn mức tài chính" aria-valuemin={0} aria-valuemax={Math.max(100,Math.ceil(used))} aria-valuenow={Math.max(0,Math.round(used))}><span style={{width:`${Math.max(0,Math.min(100,used))}%`}}/></div>
   <div className="financial-meter-caption"><span>Đã sử dụng {number(used,1)}% hạn mức</span><span>Tiền dự phòng: {money(report.cashReserve)}</span></div>
   {report.status==='restricted'&&<p className="financial-restriction" role="status">CLB phải giảm chi phí đội hình hoặc cải thiện khả năng chi trả trước khi được duyệt thêm hợp đồng. Mọi thương vụ được kiểm tra lại khi ký.</p>}
   <div className="financial-breakdowns">
    <div><h3>Cơ sở doanh thu</h3><dl>
     <div><dt>Tài trợ và thương mại dự kiến</dt><dd>{money(report.baseRevenue)}</dd></div>
     <div><dt>Vé và ngày thi đấu dự kiến</dt><dd>{money(report.matchdayForecast)}</dd></div>
     {report.policy?.incomeBasis==='cash-trading'?<div><dt>Dòng tiền chuyển nhượng ròng</dt><dd>{money(report.netTransferCash)}</dd></div>:!wagesOnly&&<div><dt>Lãi / lỗ bán cầu thủ</dt><dd>{money(report.transferProfit)}</dd></div>}
     <div className="financial-total"><dt>Doanh thu tính toán</dt><dd>{money(calculationRevenue)}</dd></div>
    </dl><p className="financial-detail-note">Tiền vé đã ghi nhận: {money(report.actualMatchdayIncome)}.</p></div>
    <div><h3>Cơ cấu chi phí hằng năm</h3><dl>
     <div><dt>Lương cầu thủ</dt><dd>{money(report.annualWages)}</dd></div>
     <div><dt>Lương ban huấn luyện</dt><dd>{money(report.annualStaffCost)}</dd></div>
     <div><dt>Thưởng dự kiến</dt><dd>{money(report.annualBonuses)}</dd></div>
     <div><dt>Phân bổ phí chuyển nhượng và ký hợp đồng</dt><dd>{money(report.annualAmortization)}</dd></div>
     <div className="financial-total"><dt>Tổng chi phí đội hình</dt><dd>{money(report.annualCost)}</dd></div>
    </dl></div>
   </div>
   <div className="financial-market-summary"><div><span>Cầu thủ mua</span><strong>{number(report.purchases)}</strong><small>{money(report.transferSpend)}</small></div><div><span>Cầu thủ bán</span><strong>{number(report.sales)}</strong><small>{money(report.transferReceipts)}</small></div><p>CLB AI tự tìm người bổ sung đội hình và bán cầu thủ. Mọi CLB đều phải đáp ứng kiểm tra tài chính, ngân sách và quỹ lương khi ký hợp đồng.</p></div>
   <details className="financial-rule-details"><summary>Quy định, nguồn và cách mô phỏng</summary><div className="financial-rule-list">{policies.map(policy=><article key={policy.id}><div><h3>{policy.label}</h3><span className="tag">{policy.kind==='ratio'&&Number.isFinite(policy.ratioLimit)?`${number(policy.ratioLimit*100,0)}%`:'Hạn mức riêng của CLB'}</span></div><p>{policy.description}</p>{policy.limitation&&<p className="financial-rule-limit">{policy.limitation}</p>}{policy.sourceUrl&&<a href={policy.sourceUrl} target="_blank" rel="noreferrer">{policy.sourceLabel||'Nguồn điều lệ'} <ArrowSquareOut size={13}/></a>}</article>)}</div><p className="financial-model-note">Tài chính CLB và hạn mức bằng tiền là số liệu của sự nghiệp này. Game giản lược điều lệ thành kiểm tra trước khi ký; không mô phỏng đầy đủ kế toán, ngoại lệ, kháng cáo hay chế tài ngoài đời. Luật tài chính kiểm soát khả năng chi trả, không ấn định một số lượng cầu thủ được mua.</p>{report.assumptions&&<p className="financial-model-note">{Array.isArray(report.assumptions)?report.assumptions.join(' '):report.assumptions}</p>}</details>
  </div>
 </Panel>;
}
