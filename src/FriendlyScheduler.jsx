import React,{useMemo,useState} from 'react';
import {CalendarBlank,PaperPlaneTilt,Strategy} from '@phosphor-icons/react';
import {Panel,Empty} from './components.jsx';
import {dateLabel,cancelFriendly} from './engine.mjs';
import {addCareerDays} from './careerClock.mjs';
import {TOUR_MARKETS,inviteFriendly,withdrawFriendlyInvitation} from './friendlyInvitations.mjs';
import {assignedStaff} from './staff.mjs';
import './daily-calendar.css';

const statusLabels={pending:'Chờ phản hồi',accepted:'Đã đồng ý',rejected:'Đã từ chối',withdrawn:'Đã rút lời mời'};
const normalize=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export default function FriendlyScheduler({g,mutate,onFriendly}){
 const [query,setQuery]=useState(''),[country,setCountry]=useState(''),[tier,setTier]=useState(''),[opponentId,setOpponent]=useState(''),[date,setDate]=useState(()=>addCareerDays(g.date,7)),[market,setMarket]=useState('home');
 const countries=[...new Map(g.leagues.filter(l=>l.countryCode).map(l=>[l.countryCode,l.country||l.countryCode]))];
 const clubs=useMemo(()=>Object.values(g.clubs).filter(c=>{const l=g.leagues.find(l=>l.id===c.leagueId);return c.id!==g.clubId&&(!country||l?.countryCode===country)&&(!tier||String(l?.tier)===tier)&&normalize(c.name+' '+c.shortName).includes(normalize(query));}).sort((a,b)=>a.name.localeCompare(b.name)),[g.clubs,g.leagues,country,tier,query]);
 const fixtures=g.friendlies.filter(f=>!f.cancelled&&!f.result&&f.date>=g.date).sort((a,b)=>a.date.localeCompare(b.date));
 const coach=assignedStaff(g,'friendlies'),absent=Object.values(g.players).filter(p=>p.clubId===g.clubId&&p.internationalDuty?.active).length;
 const submit=e=>{e.preventDefault();if(mutate(x=>inviteFriendly(x,{opponentId,date,market}),'Đã gửi lời mời. Hãy tiếp tục từng ngày để nhận phản hồi.'))setOpponent('');};
 return <Panel title="Giao hữu & du đấu" subtitle="Gửi lời mời, chọn ngày và đợi đối thủ xác nhận." className="friendly-scheduler">
  <p className="friendly-intro">Đối thủ cân nhắc lịch, lực lượng và sức hút của trận đấu. Du đấu cần nhiều ngày nghỉ hơn. Cầu thủ đang lên tuyển không được ra sân cho CLB.</p>
  {absent>0&&<p className="friendly-duty">Đang lên tuyển: {absent} cầu thủ</p>}
  <form onSubmit={submit} className="friendly-form">
   <label>Tìm đối thủ<input aria-label="Tìm đối thủ giao hữu" value={query} onChange={e=>{setQuery(e.target.value);setOpponent('');}} placeholder="Tên câu lạc bộ…"/></label>
   <div className="friendly-fields"><label>Quốc gia<select aria-label="Quốc gia đối thủ" value={country} onChange={e=>{setCountry(e.target.value);setOpponent('');}}><option value="">Tất cả quốc gia</option>{countries.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label><label>Cấp giải<select aria-label="Cấp giải đối thủ" value={tier} onChange={e=>{setTier(e.target.value);setOpponent('');}}><option value="">Mọi cấp giải</option><option value="1">Hạng cao nhất</option><option value="2">Cấp 2</option><option value="3">Cấp 3</option></select></label></div>
   <label>Đối thủ<select required aria-label="Đối thủ được mời giao hữu" value={opponentId} onChange={e=>setOpponent(e.target.value)}><option value="">Chọn một CLB</option>{clubs.map(c=><option key={c.id} value={c.id}>{c.name} · {g.leagues.find(l=>l.id===c.leagueId)?.name}</option>)}</select></label>
   <div className="friendly-fields"><label>Ngày giao hữu<input required type="date" aria-label="Ngày giao hữu" min={addCareerDays(g.date,4)} max={addCareerDays(g.date,120)} value={date} onInput={e=>setDate(e.currentTarget.value)} onChange={e=>setDate(e.target.value)}/></label><label>Thị trường du đấu<select aria-label="Thị trường du đấu" value={market} onChange={e=>setMarket(e.target.value)}>{Object.entries(TOUR_MARKETS).map(([id,m])=><option key={id} value={id}>{m.label}</option>)}</select></label></div>
   <small>Sân tại các thị trường du đấu được mô phỏng. Có thể mời CLB hạng dưới trong database tới thi đấu.</small>
   <button className="secondary" type="submit" disabled={!opponentId||date<addCareerDays(g.date,4)}><PaperPlaneTilt size={17}/>Gửi lời mời giao hữu</button>
  </form>
  <div className="friendly-schedule"><h3><CalendarBlank size={18}/>Lịch giao hữu đã xác nhận</h3>{fixtures.length?fixtures.map(f=><article key={f.id}><div><strong>{g.clubs[f.away].name}</strong><small>{dateLabel(f.date)} · {TOUR_MARKETS[f.tourMarket]?.label||'Sân nhà'}</small></div>{f.date===g.date&&<button className="primary" onClick={()=>onFriendly(f.id)}><Strategy size={16}/>{coach?'Giao trợ lý dẫn dắt':'Chuẩn bị trận giao hữu'}</button>}<button className="text-button" onClick={()=>mutate(x=>cancelFriendly(x,f.id),'Đã hủy trận giao hữu.')}>Hủy trận</button></article>):<Empty>Chưa có trận giao hữu được xác nhận.</Empty>}</div>
  {g.friendlyInvitations.items.length>0&&<div className="friendly-replies"><h3>Lời mời & phản hồi</h3>{g.friendlyInvitations.items.slice(0,8).map(item=><article key={item.id}><div><strong>{g.clubs[item.opponentId].name}</strong><span className={'tag '+(item.status==='accepted'?'lime':'')}>{item.fixtureId&&g.friendlies.find(f=>f.id===item.fixtureId)?.cancelled?'Trận đã hủy':statusLabels[item.status]}</span></div><small>{dateLabel(item.date)} · {TOUR_MARKETS[item.market].label}</small><p>{item.status==='pending'?<>Dự kiến phản hồi: {dateLabel(item.replyOn)}</>:item.reason}</p>{item.status==='pending'&&<button className="text-button" onClick={()=>mutate(x=>withdrawFriendlyInvitation(x,item.id),'Đã rút lời mời giao hữu.')}>Rút lời mời</button>}</article>)}</div>}
 </Panel>;
}
