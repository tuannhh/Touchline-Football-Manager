import React,{useState} from 'react';
import {Panel,PlayerName,ClubLink,Empty} from './components.jsx';
import {dateLabel,money} from './engine.mjs';
import {number} from './locale.mjs';
import {SHORTLIST_MONTHS,trackPlayer,untrackPlayer,shortlistDeal,shortlistStatus,addMonths} from './shortlist.mjs';
import {NEGOTIATION_STATUS} from './TransferNegotiation.jsx';
import './mail-links.css';
const statusLabels={...NEGOTIATION_STATUS,watch:'Đang theo dõi',pending:'Đang chờ phản hồi'};
export function ShortlistControl({g,id,mutate}){
 const followed=g.shortlist.includes(id),entry=g.shortlistEntries?.[id];
 return <div className="shortlist-control"><label>Thời hạn theo dõi<select aria-label="Thời hạn theo dõi" value={followed?(entry?.months||6):''} onChange={e=>mutate(x=>trackPlayer(x,id,{months:Number(e.target.value)}))}><option value="" disabled>Thêm vào shortlist</option>{SHORTLIST_MONTHS.map(n=><option key={n} value={n}>{n} tháng</option>)}</select></label>{followed&&<><small>{`Theo dõi đến ${dateLabel(entry?.expiresOn||addMonths(g.date,6))}`}</small><button className="text-button" onClick={()=>mutate(x=>untrackPlayer(x,id))}>Bỏ theo dõi</button></>}</div>;
}
export default function Shortlist({g,mutate,openPlayer,openNegotiation,onNegotiate}){
 const [query,setQuery]=useState(''),[status,setStatus]=useState(''),[page,setPage]=useState(0);
 const ids=g.shortlist.filter(id=>g.players[id]&&g.players[id].name.toLocaleLowerCase().includes(query.toLocaleLowerCase())&&(!status||shortlistStatus(g,id)===status));
 const pages=Math.max(1,Math.ceil(ids.length/10)),current=Math.min(page,pages-1);
 return <Panel title="Shortlist · Theo dõi chuyển nhượng" subtitle="Cầu thủ mới đàm phán được theo dõi 6 tháng. Có thể đổi sang 3 hoặc 12 tháng; thời hạn tính theo lịch sự nghiệp.">
  <div className="toolbar wrap padded"><input aria-label="Tìm trong shortlist" placeholder="Tìm cầu thủ…" value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}}/><select aria-label="Trạng thái shortlist" value={status} onChange={e=>{setStatus(e.target.value);setPage(0);}}><option value="">Mọi tình trạng</option>{Object.entries(statusLabels).map(([key,label])=><option value={key} key={key}>{label}</option>)}</select></div>
  <div className="table-scroll"><table className="player-table"><thead><tr><th>Cầu thủ</th><th>CLB</th><th>Giá trị</th><th>Tình trạng</th><th>Thời hạn theo dõi</th><th></th></tr></thead><tbody>{ids.slice(current*10,current*10+10).map(id=>{const p=g.players[id],d=shortlistDeal(g,id);return <tr key={id}><td><PlayerName player={p} onClick={openPlayer}/></td><td><ClubLink club={g.clubs[p.clubId]}/></td><td>{money(p.value)}</td><td>{statusLabels[shortlistStatus(g,id)]}</td><td><ShortlistControl g={g} id={id} mutate={mutate}/></td><td>{d?<button className="small-button" onClick={()=>openNegotiation(id)}>{['club','contract','agreed'].includes(d.stage)?'Tiếp tục đàm phán':'Xem diễn biến đàm phán'}</button>:p.clubId!==g.clubId&&<button className="small-button" onClick={()=>onNegotiate(id)}>Đàm phán</button>}</td></tr>;})}</tbody></table></div>
  {!ids.length&&<Empty>Chưa có cầu thủ phù hợp trong shortlist.</Empty>}
  <div className="pagination"><span>{number(ids.length)} cầu thủ · Trang {current+1}/{pages}</span><button disabled={current===0} onClick={()=>setPage(current-1)}>Trước</button><button disabled={current>=pages-1} onClick={()=>setPage(current+1)}>Sau</button></div>
  <p className="fine-print padded">Đổi thời hạn sẽ gia hạn từ ngày hiện tại. Đàm phán đang mở được giữ đến khi kết thúc; thương vụ thất bại bắt đầu lại thời hạn theo dõi đã chọn.</p>
 </Panel>;
}
