import React from 'react';
import {disciplineReport} from './discipline.mjs';
import {number} from './locale.mjs';

export default function PlayerDiscipline({g,p}){
 const club=g.clubs[p.clubId],ids=[club?.leagueId,...(g.cups||[]).filter(c=>c.participants.includes(p.clubId)).map(c=>c.id),...Object.keys(p.discipline?.competitions||{})].filter(Boolean);
 const rows=[...new Set(ids)].flatMap(id=>disciplineReport(g,p,id));
 return <section className="player-reality"><h3>Thẻ & án treo giò trong sự nghiệp</h3><p className="fine-print">Thống kê mô phỏng, tách riêng dữ liệu ngoài đời. Chỉ trận chính thức đúng phạm vi mới được tính chấp hành án.</p>
  {rows.map(row=><details key={row.competitionId} className="discipline-competition"><summary><strong>{row.name}</strong><span>{number(row.yellowCards)} 🟨 · {number(row.redCards)} 🟥</span><span className={row.remaining?'status-bad':'muted'}>{row.remaining?`Còn treo giò ${number(row.remaining)} trận`:'Không có án tại giải này'}</span></summary><p className="fine-print">{row.rule.text}</p>{row.rule.limitations&&<p className="fine-print">{row.rule.limitations}</p>}{row.rule.source?<a className="reality-source" href={row.rule.source} target="_blank" rel="noreferrer">Nguồn điều lệ ↗</a>:<span className="tag">Quy tắc mô phỏng</span>}</details>)}
 </section>;
}
