import React,{useEffect,useState} from 'react';
import {number,dateLabel} from './locale.mjs';

export default function ScoutingSources(){
 const [sources,setSources]=useState(null);
 useEffect(()=>{const abort=new AbortController();fetch('/data/scouting-sources.json',{signal:abort.signal,cache:'no-cache'}).then(r=>r.ok?r.json():null).then(setSources).catch(()=>{});return()=>abort.abort();},[]);
 if(!sources)return null;
 return <details className="assessment-sources scouting-sources"><summary>Nguồn cầu thủ quốc tế</summary><p className="fine-print">Chỉ bổ sung vào New Game để tuyển trạch và chuyển nhượng. Các giải này không thể dẫn dắt và không có lịch giải trong game.</p><p className="fine-print">Ngày lấy dữ liệu: {dateLabel(sources.snapshotAt?.slice(0,10))}</p><div className="table-scroll"><table><thead><tr><th>Quốc gia</th><th>CLB</th><th>Cầu thủ</th><th>Ảnh thật</th></tr></thead><tbody>{sources.leagues.map(l=><tr key={l.id}><td><a href={l.sourceUrl} target="_blank" rel="noreferrer">{l.country}</a><small className="block muted">{l.name}</small></td><td>{number(l.coverage.clubs)}</td><td>{number(l.coverage.players)}</td><td>{number(l.coverage.realPhotos)}</td></tr>)}</tbody></table></div><p className="fine-print">Mức bao phủ theo gói nguồn, chưa loại hồ sơ đã có trong đội hình gốc. Một số quốc gia mới có một phần CLB; ảnh và thông tin chưa tìm được để trống.</p></details>;
}
