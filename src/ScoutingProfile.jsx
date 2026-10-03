import React from 'react';
import {ArrowSquareOut} from '@phosphor-icons/react';
import {POSITION_DETAIL,FOOT,broadPosition} from './tactics.mjs';
import {number,formatHeight,formatWeight} from './locale.mjs';
import {dateLabel} from './engine.mjs';
import {PlayerPosition} from './components.jsx';
import {positionCode} from './playerPositions.mjs';
const spots={GK:[50,89],LB:[14,72],CB:[50,75],RB:[86,72],LWB:[11,58],RWB:[89,58],DM:[50,61],CM:[50,46],LM:[15,43],RM:[85,43],AM:[50,30],LW:[17,19],RW:[83,19],ST:[50,13]};
const roles=[
 ['GK','Thủ môn quét',['reflexes','handling','passing','decisions']],['GK','Thủ môn cản phá',['reflexes','handling','positioning']],
 ['DF','Trung vệ triển khai bóng',['passing','composure','positioning']],['DF','Hậu vệ thu hồi bóng',['tackling','strength','heading']],['DF','Hậu vệ hỗ trợ biên',['pace','stamina','crossing']],
 ['MF','Tiền vệ kiến thiết',['passing','vision','decisions']],['MF','Tiền vệ con thoi',['stamina','teamwork','tackling']],['MF','Tiền vệ công',['dribbling','vision','composure']],
 ['FW','Tiền đạo dứt điểm',['finishing','positioning','composure']],['FW','Tiền đạo xuyên phá',['pace','dribbling','finishing']],['FW','Tiền đạo phối hợp',['passing','teamwork','vision']],
];
export default function ScoutingProfile({p}){
 const natural=p.naturalPositions||[],other=p.otherPositions||[],groups=new Set([p.position,...natural.map(broadPosition)]);
 const recommended=roles.filter(([group])=>groups.has(group)).map(([group,name,keys])=>({name,score:Math.round(keys.reduce((s,k)=>s+p.attributes[k],0)/keys.length*5)})).sort((a,b)=>b.score-a.score).slice(0,3);
 return <section className="scouting-profile"><div className="profile-position-map"><div className="position-mini-pitch" role="img" aria-label={'Bản đồ vị trí: '+(natural.map(k=>POSITION_DETAIL[k]).join(', ')||'chưa có dữ liệu chi tiết')}><div className="mini-half"/><div className="mini-circle"/>{Object.entries(spots).map(([role,[x,y]])=><span key={role} style={{left:x+'%',top:y+'%'}} className={natural.includes(role)?'natural':other.includes(role)?'secondary':'unused'} title={POSITION_DETAIL[role]}>{positionCode(role)}</span>)}</div><div className="position-legend"><span><i/>Sở trường theo nguồn</span><span><i/>Đã chơi ở vị trí phụ</span></div></div>
 <div className="scouting-facts"><h3>Vị trí & phong cách</h3><div className="profile-position-tags"><PlayerPosition player={p}/></div>{natural.length>0&&<p className="secondary-positions">Sở trường: {natural.map(k=>`${positionCode(k)} (${POSITION_DETAIL[k]})`).join(', ')}</p>}{other.length>0&&<p className="secondary-positions">Vị trí phụ: {other.map(k=>`${positionCode(k)} (${POSITION_DETAIL[k]})`).join(', ')}</p>}<dl className="biography-grid"><div><dt>Chân thuận</dt><dd>{FOOT[p.preferredFoot]||FOOT.unknown}</dd></div><div><dt>Ngày sinh từ nguồn</dt><dd>{p.birthDate?dateLabel(p.birthDate):'Chưa có nguồn'}</dd></div><div><dt>Chiều cao</dt><dd>{p.height?formatHeight(p.height):'Chưa có nguồn'}</dd></div><div><dt>Cân nặng</dt><dd>{p.weight?formatWeight(p.weight):'Chưa có nguồn'}</dd></div></dl>
 <p className="fine-print">{p.positionsSource?.startsWith('https://')?<a href={p.positionsSource} target="_blank" rel="noreferrer">Nguồn vị trí <ArrowSquareOut size={12}/></a>:p.positionsSource?'Vị trí do người chơi chỉnh':'Vị trí chi tiết chưa được xác minh'}{p.footSource?.startsWith('https://')?<> · <a href={p.footSource} target="_blank" rel="noreferrer">Nguồn chân thuận <ArrowSquareOut size={12}/></a></>:p.footSource?' · Chân thuận do người chơi chỉnh':''}</p>
 <h4>Vai trò gợi ý trong game</h4><div className="role-recommendations">{recommended.map(r=><div key={r.name}><span>{r.name}</span><strong>{r.score}<small>/100</small></strong></div>)}</div><p className="fine-print">Gợi ý tính từ kỹ năng mô phỏng. Vị trí phụ phản ánh cách sử dụng trong nguồn, chưa phải thang điểm thành thạo được xác minh. Chân không thuận chưa có đánh giá.</p></div></section>;
}
