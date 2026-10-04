import React,{useEffect,useState} from 'react';
import {money,number,dateLabel} from './locale.mjs';
import './player-reality.css';

let snapshotPromise;
function loadSnapshot(){
 return snapshotPromise??=fetch('/data/player-reality.json').then(r=>{if(!r.ok)throw Error('Snapshot unavailable');return r.json();}).catch(()=>{snapshotPromise=null;return null;});
}
const statusLabels={injured:'Nguồn báo chấn thương',doubtful:'Chưa chắc có thể thi đấu',reported_suspended:'Nguồn báo treo giò',historical:'Báo cáo cũ',not_reported:'Nguồn không báo tình trạng',unknown:'Chưa đủ dữ liệu'};
const shown=n=>Number.isFinite(n)?number(n):'—';
export default function PlayerReality({p}){
 const [reference,setReference]=useState(null),[loaded,setLoaded]=useState(false);
 useEffect(()=>{let active=true;if(!p.realWorld)loadSnapshot().then(s=>{if(active){setReference(s?.players?.[p.id]||null);setLoaded(true);}});return()=>{active=false;};},[p.id,p.realWorld]);
 const observation=p.realWorld||(reference?.playerId===p.id?reference:null);
 if(!observation)return loaded?<section className="player-reality"><h3>Dữ liệu ngoài đời</h3><p className="fine-print">Chưa có quan sát đủ tin cậy cho cầu thủ này. Giá trị và kỹ năng trong game là ước lượng.</p></section>:null;
 const performance=observation.performance,market=observation.marketValue,availability=observation.availability;
 return <section className="player-reality"><header><h3>Dữ liệu ngoài đời</h3><span className="tag">{dateLabel(observation.observedAt)}</span></header>
  <p className="fine-print">{p.realWorld?'Mốc dữ liệu của sự nghiệp này; tình trạng trong game thay đổi theo diễn biến mô phỏng.':'Dữ liệu tham khảo mới nhất. Bản lưu hiện tại giữ nguyên giá trị, kỹ năng và tình trạng thi đấu.'}</p>
  <dl className="reality-summary"><div><dt>Giá trị thị trường ước tính</dt><dd>{market?.eur?money(market.eur):'—'}</dd><small>{market?.provider||'Chưa đủ dữ liệu'}{market?.asOf?' · '+dateLabel(market.asOf):''}</small></div><div><dt>Tình trạng được nguồn báo</dt><dd>{statusLabels[availability?.status]||'Chưa đủ dữ liệu'}</dd><small>{availability?.description||'Chưa có báo cáo xác nhận'}</small></div></dl>
  {availability?.expectedReturnText&&<p className="fine-print">Dự kiến trở lại theo nguồn: <b>{availability.expectedReturnText}</b></p>}
  {performance&&<><p className="reality-season">{performance.competitionName} · {performance.season}</p><dl className="reality-stats">{[['Điểm thi đấu',Number.isFinite(performance.rating)?number(performance.rating,2):'—'],['Trận',shown(performance.appearances)],['Phút',shown(performance.minutes)],['Bàn thắng',shown(performance.goals)],['Kiến tạo',shown(performance.assists)],['Thẻ vàng',shown(performance.yellowCards)],['Thẻ đỏ',shown(performance.redCards)]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></>}
  <p className="fine-print">Thẻ trong thống kê mùa giải không đồng nghĩa đang chịu án treo giò. Thiếu thời hạn hoặc phạm vi giải đấu thì game không tự cấm thi đấu.</p>
  {p.realWorld&&<p className="fine-print">{observation.calibration?'Kỹ năng mô phỏng được hiệu chỉnh nhẹ theo điểm thi đấu và số phút; không phải chỉ số chính thức.':'Chưa đủ mẫu thi đấu để hiệu chỉnh kỹ năng. Chỉ số trong game vẫn là ước lượng.'}</p>}
  <a className="reality-source" href={observation.sourceUrl} target="_blank" rel="noreferrer">Xem nguồn FotMob ↗</a>
 </section>;
}
