import React,{useState} from 'react';
import {Panel,ClubLink,PlayerName,Empty} from './components.jsx';
import {money,dateLabel} from './engine.mjs';
import {number} from './locale.mjs';
const labels={club:'Đàm phán với CLB',contract:'Đàm phán hợp đồng',agreed:'Chờ ký chính thức',completed:'Đã ký',rejected:'Bị từ chối',withdrawn:'Đã rút',expired:'Hết hiệu lực'};
export default function TransferActivity({g,openPlayer,openNegotiation}){
 const [scope,setScope]=useState('all');
 const deals=(g.negotiations||[]).filter((deal,index,all)=>all.findIndex(d=>d.playerId===deal.playerId)===index).slice(0,8);
 const transfers=g.transfers.filter(t=>scope==='all'||(scope==='ai'?t.isAI:t.from===g.clubId||t.to===g.clubId)).slice(0,40);
 return <div className="transfer-activity">
 <Panel title="Bàn đàm phán" subtitle="Thống nhất với CLB và cầu thủ, sau đó xác nhận ký hợp đồng.">
 {deals.length?<div className="negotiation-summary-list">{deals.map(d=><div key={d.id} className="negotiation-summary"><div><strong>{g.players[d.playerId]?.name||'Cầu thủ'}</strong><small>{labels[d.stage]||d.stage} · {dateLabel(d.createdAt)}</small></div><ClubLink club={g.clubs[d.sellerId]}/><button className="secondary small-button" onClick={()=>openNegotiation(d.playerId)}>{['club','contract','agreed'].includes(d.stage)?'Tiếp tục đàm phán':'Xem trao đổi'}</button></div>)}</div>:<Empty>Mở hồ sơ một cầu thủ và chọn Thương lượng chuyển nhượng để bắt đầu.</Empty>}
 </Panel>
 <Panel title="Chuyển nhượng toàn thế giới" subtitle="Các CLB AI mua bán khi bạn tiếp tục lịch quốc nội. Thị trường mô phỏng mở quanh năm." action={<div className="segmented"><button className={scope==='all'?'active':''} onClick={()=>setScope('all')}>Toàn thế giới</button><button className={scope==='ai'?'active':''} onClick={()=>setScope('ai')}>Giữa các CLB AI</button><button className={scope==='mine'?'active':''} onClick={()=>setScope('mine')}>CLB của tôi</button></div>}>
 <p className="market-sustainability-note">Các CLB AI chọn cầu thủ theo nhu cầu vị trí, thương lượng giá và lương, rồi kiểm tra ngân sách và giới hạn tài chính trước khi ký.</p>
 <p className="fine-print">{`Đã ghi nhận ${number(g.transfers.filter(t=>t.isAI).length)} thương vụ giữa các CLB AI trong lịch sử thị trường.`}</p>
 {transfers.length?<div className="table-scroll"><table><thead><tr><th>Ngày</th><th>Cầu thủ</th><th>Từ CLB</th><th>Đến CLB</th><th>Phí</th><th>Giao dịch</th></tr></thead><tbody>{transfers.map((t,i)=><tr key={t.eventId||`${t.id}-${i}`}><td>{dateLabel(t.date)}</td><td>{g.players[t.playerId||t.id]?<PlayerName player={g.players[t.playerId||t.id]} onClick={openPlayer}/>:t.name}</td><td><ClubLink club={g.clubs[t.from]}/></td><td><ClubLink club={g.clubs[t.to]}/></td><td>{money(t.fee)}</td><td><span className="tag">{t.isAI?'Giữa các CLB AI':'CLB của bạn'}</span></td></tr>)}</tbody></table></div>:<Empty>Chưa có giao dịch trong sự nghiệp ở bộ lọc này. Thị trường bắt đầu vận động khi lịch thi đấu tiến lên.</Empty>}
 </Panel></div>;
}
