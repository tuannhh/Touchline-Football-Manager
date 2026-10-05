import React from 'react';
import './homegrown-evidence.css';
import {trainingStatus} from './registration.mjs';
import {dateLabel} from './engine.mjs';
export default function HomegrownEvidence({g,p,competitionId}){
 const s=trainingStatus(g,p,competitionId),u=s.uefa;
 return <div className="prose homegrown-evidence">
  <p>Quốc tịch không quyết định home-grown. CT là đào tạo tại CLB; AT là đào tạo tại liên đoàn. Có tên trong List A không chứng minh cầu thủ đạt CT hoặc AT.</p>
  {u&&<p><a href={u.source} target="_blank" rel="noreferrer">UEFA · List {u.list} · {u.season}</a> · {dateLabel(u.observedAt)}. {u.list==='B'?'UEFA đánh dấu cầu thủ ở List B tại mốc nguồn.':'UEFA công bố cầu thủ trong List A; điều kiện đào tạo được kiểm tra riêng.'}</p>}
  {u?.list==='B'&&u.observedAt>g.date&&<p className="fine-print">Ngày trong game sớm hơn mốc UEFA: quyền List B hiện xét từ lịch sử đào tạo có sẵn.</p>}
  {s.override&&<p>Hồ sơ do người chơi xác nhận được ưu tiên hơn dữ liệu nguồn.</p>}
  {s.records.length?<div className="table-scroll"><table><thead><tr><th>CLB / liên đoàn</th><th>Từ ngày</th><th>Đến ngày</th><th>Nguồn</th></tr></thead><tbody>{s.records.map((r,i)=><tr key={i}><td>{g.clubs[r.clubId]?.name||r.sourceTeamName||r.association} · {r.association}{r.isLoan?' · Cho mượn':''}</td><td>{dateLabel(r.start)}</td><td>{dateLabel(r.end)}</td><td><a href={r.source} title={r.evidence} target="_blank" rel="noreferrer">{r.sourceType==='career-provider'?'Lịch sử FotMob':r.sourceType==='reviewed-secondary'?'Tiểu sử đối chiếu':'Nguồn CLB / liên đoàn'}</a><small className="muted"> · {dateLabel(r.verifiedAt||s.asOf)}</small></td></tr>)}</tbody></table></div>:<p>Chưa có lịch sử đào tạo đầy đủ từ nguồn.</p>}
  <p className="fine-print">Khoảng trước 15 tuổi và sau 21 tuổi không tự tạo suất UEFA. Thời gian cho mượn tính tại đội mượn. Hồ sơ thiếu không được tự kết luận là không đạt.</p>
 </div>;
}
