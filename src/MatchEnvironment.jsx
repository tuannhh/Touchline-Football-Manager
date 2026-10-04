import React,{memo,useMemo} from 'react';
import {MapPin,UsersThree,CloudSun,Wind} from '@phosphor-icons/react';
import {matchEnvironment,stadiumForClub} from './matchEnvironment.mjs';
import {number,money,dateLabel,formatDistance} from './locale.mjs';
import './match-environment.css';

const CONDITIONS={clear:'Trời quang',cloudy:'Nhiều mây',rain:'Mưa', 'heavy-rain':'Mưa lớn',snow:'Tuyết'};
const PITCH={dry:'Khô',good:'Tốt',wet:'Ướt',heavy:'Sũng nước'};

export function StadiumInfo({g,clubId}){
 const stadium=stadiumForClub(g,clubId);
 return <section className="club-stadium panel" aria-label="Thông tin sân vận động">
  <MapPin size={25}/><div><h3 translate={stadium.nameEstimated?'yes':'no'}>{stadium.name}</h3><p><span>Sức chứa</span>: <strong>{number(stadium.capacity)}</strong> · {stadium.city||g.leagues.find(l=>l.id===g.clubs[clubId]?.leagueId)?.country}</p>
   <small>{stadium.capacityEstimated?'Sức chứa ước tính trong game':'Sức chứa theo nguồn công khai'}{stadium.sourceDate?' · '+dateLabel(stadium.sourceDate):''}</small>
   {stadium.capacityNote&&<p className="fine-print">{stadium.capacityNote}</p>}
   {stadium.sourceUrl&&<a href={stadium.sourceUrl} target="_blank" rel="noreferrer">Nguồn sân vận động</a>}
  </div>
 </section>;
}

function MatchEnvironment({g,fixture,environment,forecast=false}){
 const context=useMemo(()=>environment||fixture&&matchEnvironment(g,fixture),[environment,fixture,g.stadiums,g.year]);
 if(!context)return null;
 const {stadium,weather}=context;
 return <section className="match-environment" aria-label="Điều kiện trận đấu">
  <div className="match-environment-grid">
   <div className="environment-venue"><MapPin size={20}/><div><small>{context.neutral?'Sân trung lập':'Sân vận động'}</small><strong translate={stadium.nameEstimated?'yes':'no'}>{stadium.name}</strong><span>{number(stadium.capacity)} <span>chỗ</span>{stadium.capacityEstimated?' · Ước tính':''}</span></div></div>
   <div><CloudSun size={21}/><div><small>Thời tiết mô phỏng</small><strong>{CONDITIONS[weather.condition]} · {number(weather.temperatureC)} °C</strong><span><Wind size={13}/> {number(weather.windKmh)} km/h · <span>Độ ẩm</span> {number(weather.humidity)}%</span></div></div>
   <div><UsersThree size={21}/><div><small>{forecast?'Khán giả dự kiến':'Khán giả'}</small><strong>{number(context.attendance)} <span>người</span></strong><span>{`Lấp đầy ${number(context.occupancy*100,1)}%`}</span></div></div>
  </div>
  <details className="environment-details"><summary>Chi tiết sân & khán giả</summary>
   <dl><div><dt>Mặt sân</dt><dd>{PITCH[weather.pitch]}</dd></div><div><dt>Kích thước sân mô phỏng</dt><dd>{formatDistance(stadium.pitchLength,{short:true})} × {formatDistance(stadium.pitchWidth,{short:true})}</dd></div><div><dt>CĐV chủ nhà / đội khách</dt><dd>{number(context.homeFans)} / {number(context.awayFans)}</dd></div><div><dt>{forecast?'Tiền vé dự kiến':'Doanh thu vé'}</dt><dd>{money(context.gateReceipts)}</dd></div></dl>
   <p>Thời tiết, khán giả và giá vé thuộc mô phỏng theo lịch game; không phải dự báo hoặc số liệu trận đấu ngoài đời. Điều kiện sân hiện dùng để cung cấp thông tin, chưa thay đổi xác suất ghi bàn.</p>
   {context.neutral&&<p>Tiền vé sân trung lập được chia đều cho hai CLB trong mô phỏng.</p>}
   {stadium.capacityNote&&<p>{stadium.capacityNote}</p>}
   {stadium.sourceUrl&&<a href={stadium.sourceUrl} target="_blank" rel="noreferrer">Nguồn sân vận động</a>}
  </details>
 </section>;
}
export default memo(MatchEnvironment);
