import React from 'react';
import {ChartLineUp,ArrowSquareOut} from '@phosphor-icons/react';
import {playerDevelopmentReport} from './playerDevelopment.mjs';
import {money,number,dateLabel} from './locale.mjs';
import {ClubLink} from './components.jsx';
import './player-development.css';

const confidenceLabels={high:'Cao',medium:'Trung bình',low:'Thấp'};
const developmentReasons={form_rising:'Phong độ cải thiện',form_falling:'Phong độ suy giảm',youth_development:'Phát triển cầu thủ trẻ',age_curve:'Giai đoạn tuổi nghề',injury:'Ảnh hưởng chấn thương',contract_running_down:'Hợp đồng sắp hết hạn',new_club:'Thay đổi đội bóng',no_new_minutes:'Chưa có phút thi đấu mới'};
const interestReasons={position_shortage:'Cần bổ sung vị trí',quality_upgrade:'Có thể nâng chất lượng đội hình',development_potential:'Đánh giá cao tiềm năng',within_budget:'Trong khả năng ngân sách',budget_watch:'Cần cân đối ngân sách',seller_reluctant:'CLB chủ quản muốn giữ người',medical_watch:'Theo dõi tình trạng chấn thương'};
const change=n=>`${n>0?'+':''}${number(n)}`;
const safeSource=url=>{try{const parsed=new URL(url);return parsed.protocol==='https:'||parsed.protocol==='http:'?parsed:null;}catch{return null;}};
export default function PlayerDevelopment({g,p}){
 const report=playerDevelopmentReport(g,p),assessment=p.abilityAssessment,history=report.history||[],latest=history.at(-1),sources=[...new Set(assessment?.sourceUrls||[])].map(safeSource).filter(Boolean),interests=report.interests||[];
 return <section className="player-development" aria-label="Năng lực & diễn biến sự nghiệp">
  <header><div><span className="eyebrow">ĐÁNH GIÁ CẦU THỦ</span><h3>Năng lực & diễn biến sự nghiệp</h3></div><ChartLineUp size={24} aria-hidden="true"/></header>
  <dl className="development-metrics"><div><dt>Năng lực hiện tại</dt><dd>{number(report.currentAbility)}<small> / 100</small></dd></div><div><dt>Tiềm năng ước lượng</dt><dd>{number(report.potential)}<small> / 100</small></dd></div><div><dt>Tầm ảnh hưởng trong đội</dt><dd>{number(report.influence)}<small> / 100</small></dd></div><div><dt>Giá trị trong sự nghiệp</dt><dd className="development-money">{money(report.value)}</dd></div></dl>
  <p className="fine-print">Năng lực phản ánh kỹ năng ở vị trí sở trường; tiềm năng là trần phát triển ước lượng. Tầm ảnh hưởng phụ thuộc chất lượng và vai trò trong đội, không phải chỉ số kỹ thuật.</p>
  <div className="development-evidence"><h4>Căn cứ đánh giá khởi điểm</h4><div className="development-evidence-tags"><span className="tag">{assessment?.basis==='source_estimate'?'Ước lượng từ nguồn':'Ước lượng khi dữ liệu hạn chế'}</span>{assessment?.asOf&&<span>{`Mốc đánh giá: ${dateLabel(assessment.asOf)}`}</span>}<span>{`Độ tin cậy của ước lượng: ${confidenceLabels[assessment?.confidence]||'Thấp'}`}</span></div>
   <p className="fine-print">{assessment?.basis==='source_estimate'?'Tổng hợp giá trị thị trường, thành tích, thời lượng thi đấu và các nguồn đối chiếu sẵn có. Chỉ số 1–100 là đánh giá của game, không phải chỉ số chính thức.':'Chưa đủ nguồn đối chiếu cho cầu thủ này. Năng lực và tiềm năng là ước lượng với độ tin cậy thấp.'}</p>
   {assessment?.anchorDate&&<p className="fine-print">{`Rà soát chứng cứ: ${dateLabel(assessment.anchorDate)}`}</p>}
   {p.realWorld?.detailObservedAt&&<p className="fine-print">{`Quan sát hồ sơ từ nguồn: ${dateLabel(p.realWorld.detailObservedAt)}`}</p>}
   {assessment?.components?.historySeasons>0&&<p className="fine-print">{`Số mùa có dữ liệu thành tích: ${number(assessment.components.historySeasons)}`}</p>}
   {assessment?.sourceClub&&<p className="development-source-club"><span>CLB tại mốc dữ liệu:</span> <strong translate="no">{assessment.sourceClub}</strong></p>}
   {sources.length>0&&<div className="development-sources">{sources.map((source,index)=><a href={source.href} target="_blank" rel="noreferrer" key={source.href}><span translate="no">{source.hostname.replace(/^www\./,'')}</span><span className="visually-hidden">{` · Nguồn ${index+1}`}</span><ArrowSquareOut size={12}/></a>)}</div>}
  {assessment?.evidence?.length>0&&<details className="development-evidence-details"><summary>Chứng cứ đối chiếu</summary><ul>{assessment.evidence.filter(item=>safeSource(item.url)).map((item,index)=><li key={`${item.url}-${index}`}><a href={item.url} target="_blank" rel="noreferrer" translate="no">{item.title}</a>{item.publishedAt&&<span>{dateLabel(item.publishedAt)}</span>}<p translate="no">{item.fact}</p></li>)}</ul><p className="fine-print">Tên nguồn và ghi chú chứng cứ được giữ bằng ngôn ngữ gốc.</p></details>}
  </div>
  <div className="development-career"><div className="development-section-heading"><h4>Diễn biến trong sự nghiệp</h4><span>{report.reviewedAt?`Lần đánh giá gần nhất: ${dateLabel(report.reviewedAt)}`:'Chưa có đợt đánh giá trong sự nghiệp'}</span></div>
   <p className="fine-print">{`Đánh giá lại mỗi ${number(report.reviewIntervalDays)} ngày trong game theo phong độ, thời gian thi đấu, tuổi, chấn thương và hợp đồng. Đây là diễn biến mô phỏng, không tự đồng bộ kết quả ngoài đời.`}</p>
   {latest&&<p className="development-latest"><span>{`Điểm thi đấu trong kỳ: ${latest.rating==null?'—':number(latest.rating,2)}`}</span><span>{`${number(latest.minutes)} phút · ${number(latest.appearances)} trận`}</span></p>}
   {history.length>0?<div className="table-scroll"><table className="development-history"><caption className="visually-hidden">Lịch sử năng lực và giá trị trong sự nghiệp</caption><thead><tr><th>Ngày</th><th>Năng lực</th><th>Giá trị</th><th>Yếu tố ảnh hưởng</th></tr></thead><tbody>{history.slice(-6).reverse().map((entry,index)=><tr key={`${entry.date}-${index}`}><td>{dateLabel(entry.date)}</td><td>{number(entry.ability)}{entry.abilityDelta!==0&&<small className={entry.abilityDelta>0?'rising':'falling'}>{change(entry.abilityDelta)}</small>}</td><td>{money(entry.value)}{entry.valueDelta!==0&&<small className={entry.valueDelta>0?'rising':'falling'}>{entry.valueDelta>0?'+':''}{money(entry.valueDelta)}</small>}</td><td>{(entry.reasons||[]).filter(reason=>developmentReasons[reason]).map((reason,index)=><React.Fragment key={reason}>{index>0&&' · '}<span>{developmentReasons[reason]}</span></React.Fragment>)}</td></tr>)}</tbody></table></div>:<p className="development-empty">Chưa đủ thời gian để đánh giá thay đổi. Lịch sử sẽ xuất hiện khi sự nghiệp tiếp diễn.</p>}
  </div>
  <div className="development-interest"><h4>CLB quan tâm trong mô phỏng</h4><p className="fine-print">Mức quan tâm được tính từ nhu cầu vị trí, chất lượng đội hình, ngân sách và khả năng thương lượng. Đây không phải tin đồn hoặc đề nghị chuyển nhượng ngoài đời.</p>
   {interests.length>0?<ul>{interests.map(interest=><li key={interest.clubId}><div className="development-interest-club">{g.clubs[interest.clubId]?<ClubLink club={g.clubs[interest.clubId]} size={22}/>:<strong translate="no">{interest.clubName}</strong>}<span className={'interest-level '+interest.level}>{interest.level==='interested'?'Quan tâm':'Đang theo dõi'} · {number(interest.score)}/100</span></div><p>{(interest.reasons||[]).filter(reason=>interestReasons[reason]).map((reason,index)=><React.Fragment key={reason}>{index>0&&' · '}<span>{interestReasons[reason]}</span></React.Fragment>)}</p></li>)}</ul>:<p className="development-empty">Chưa có CLB đạt ngưỡng quan tâm trong mô phỏng hiện tại.</p>}
  </div>
 </section>;
}
