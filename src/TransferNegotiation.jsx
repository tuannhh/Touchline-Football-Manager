import React,{useEffect,useRef,useState} from 'react';
import {ArrowRight,Check,Handshake,PaperPlaneTilt,Signature,WarningCircle} from '@phosphor-icons/react';
import {Badge,Modal,Portrait} from './components.jsx';
import {positionLabel,positionDescription} from './playerPositions.mjs';
import MoneyInput,{moneyLabel} from './MoneyInput.jsx';
import NumberInput from './NumberInput.jsx';
import {clubPlayers,completeTransfer,dateLabel,money,POSITION} from './engine.mjs';
import {number} from './locale.mjs';
import {beginNegotiation,getNegotiation,submitClubOffer,submitContractOffer,withdrawNegotiation,minimumReleaseClause,SQUAD_ROLES,TRANSFER_RULES} from './transfers.mjs';
import './transfers.css';

const ACTIVE=new Set(['club','contract','agreed']);
const ROLES=SQUAD_ROLES;
export const NEGOTIATION_STATUS={club:'Đàm phán với CLB',contract:'Đàm phán hợp đồng',agreed:'Chờ ký hợp đồng',completed:'Đã hoàn tất',rejected:'Bị từ chối',withdrawn:'Đã rút lui',expired:'Đã hết hạn'};
const numeric=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const clubDraft=offer=>({fee:numeric(offer?.fee),sellOnPercent:numeric(offer?.sellOnPercent)});
const contractDraft=offer=>({wage:numeric(offer?.wage),signingBonus:numeric(offer?.signingBonus),agentFee:numeric(offer?.agentFee),appearanceBonus:numeric(offer?.appearanceBonus),goalBonus:numeric(offer?.goalBonus),years:numeric(offer?.years,4),releaseClause:numeric(offer?.releaseClause),annualRise:numeric(offer?.annualRise),squadRole:ROLES[offer?.squadRole]?offer.squadRole:'rotation'});
const fmtDate=value=>value?dateLabel(value):'—';

function AmountField({label,value,onChange,min=0,max=1e12,decimals=0,hint,monetary=false}){
 const Input=monetary?MoneyInput:NumberInput;
 return <label className="field negotiation-field"><span>{moneyLabel(label)}</span><Input {...(monetary?{wholeEuro:true}:{})} required value={value} onChange={onChange} min={min} max={max} decimals={monetary?2:decimals}/>{hint&&<small>{hint}</small>}</label>;
}

function ContractTerms({terms,compact=false}){
 if(!terms)return null;
 return <dl className={'negotiation-terms '+(compact?'compact':'')}>
  <div><dt>Lương mỗi tuần</dt><dd>{money(terms.wage)}</dd></div>
  <div><dt>Thời hạn hợp đồng</dt><dd>{number(terms.years)} năm</dd></div>
  <div><dt>Thưởng ký hợp đồng</dt><dd>{money(terms.signingBonus)}</dd></div>
  <div><dt>Phí đại diện</dt><dd>{money(terms.agentFee)}</dd></div>
  <div><dt>Thưởng ra sân</dt><dd>{money(terms.appearanceBonus)} / trận</dd></div>
  <div><dt>Thưởng ghi bàn</dt><dd>{money(terms.goalBonus)} / bàn</dd></div>
  <div><dt>Tăng lương hằng năm</dt><dd>{number(terms.annualRise)}%</dd></div>
  <div><dt>Vai trò trong đội</dt><dd>{ROLES[terms.squadRole]||terms.squadRole}</dd></div>
  <div><dt>Điều khoản giải phóng</dt><dd>{terms.releaseClause?money(terms.releaseClause):'Không có'}</dd></div>
 </dl>;
}

function BudgetSummary({g,player,clubOffer,contractOffer,agreed=false}){
 const club=g.clubs[g.clubId],fee=numeric(clubOffer?.fee),signing=numeric(contractOffer?.signingBonus),agent=numeric(contractOffer?.agentFee),wage=numeric(contractOffer?.wage);
 const upfront=fee+signing+agent,currentWages=clubPlayers(g,g.clubId).filter(p=>p.id!==player.id).reduce((sum,p)=>sum+numeric(p.wage),0),wageRoom=club.wageBudget-currentWages;
 const cashShort=upfront>club.cash,budgetShort=upfront>club.budget,wageShort=wage>wageRoom;
 return <aside className="negotiation-budget" aria-label="Dự toán chuyển nhượng">
  <div className="negotiation-section-heading"><span className="eyebrow">NGÂN SÁCH CỦA BẠN</span><h3>{agreed?'Chi phí khi ký':'Dự toán theo đề nghị'}</h3></div>
  <dl><div><dt>Phí chuyển nhượng</dt><dd>{money(fee)}</dd></div><div><dt>Thưởng ký + phí đại diện</dt><dd>{money(signing+agent)}</dd></div><div className="negotiation-budget-total"><dt>Thanh toán ngay</dt><dd>{money(upfront)}</dd></div><div><dt>Tiền mặt hiện có</dt><dd className={cashShort?'status-bad':''}>{money(club.cash)}</dd></div><div><dt>Ngân sách chuyển nhượng</dt><dd className={budgetShort?'status-bad':''}>{money(club.budget)}</dd></div></dl>
  <dl><div><dt>Lương mới mỗi tuần</dt><dd>{money(wage)}</dd></div><div><dt>Quỹ lương cầu thủ còn lại</dt><dd className={wageShort?'status-bad':''}>{money(wageRoom)}</dd></div><div><dt>Lương cơ bản năm đầu</dt><dd>{money(wage*52)}</dd></div></dl>
  <p>Thưởng ra sân và ghi bàn được trả theo thực tế. Tăng lương và phần trăm bán lại tạo nghĩa vụ ở các mùa sau.</p>
  {!agreed&&<p>Điều khoản cá nhân chưa thống nhất là mức tham khảo từ người đại diện.</p>}
  {(cashShort||budgetShort||wageShort)&&<div className="negotiation-warning"><WarningCircle size={17}/><span>{[cashShort&&'Thiếu tiền mặt để thanh toán ngay.',budgetShort&&'Tổng chi phí ngay vượt ngân sách chuyển nhượng.',wageShort&&'Lương mới vượt quỹ lương còn lại.'].filter(Boolean).join(' ')}</span></div>}
 </aside>;
}

function ClubProposal({g,player,deal,act}){
 const [proposal,setProposal]=useState(()=>clubDraft(deal.lastClubOffer||deal.clubDemand));
 const seller=g.clubs[deal.sellerClubId||deal.sellerId||player.clubId];
 return <div className="negotiation-layout"><div>
  <section className="negotiation-demand"><div className="negotiation-section-heading"><span className="eyebrow">PHẢN HỒI TỪ {seller?.shortName||'CLB CHỦ QUẢN'}</span><h3>Điều kiện để bán cầu thủ</h3></div><dl className="negotiation-terms"><div><dt>Phí chuyển nhượng</dt><dd>{money(deal.clubDemand?.fee||0)}</dd></div><div><dt>Phần trăm bán lại</dt><dd>{number(deal.clubDemand?.sellOnPercent||0)}%</dd></div></dl><p>CLB cân nhắc vai trò, giá trị cầu thủ và khả năng thay thế khi trả giá.</p></section>
  <form className="negotiation-proposal" onSubmit={e=>{e.preventDefault();act(x=>submitClubOffer(x,deal.id,proposal));}}>
   <div className="negotiation-section-heading"><h3>Đề nghị của {g.clubs[g.clubId].shortName}</h3><button type="button" className="text-button" onClick={()=>setProposal(clubDraft(deal.clubDemand))}>Dùng yêu cầu này</button></div>
   <div className="negotiation-fields"><AmountField monetary label="Phí chuyển nhượng (€)" value={proposal.fee} onChange={fee=>setProposal(v=>({...v,fee}))}/><AmountField label="Phần trăm bán lại (%)" value={proposal.sellOnPercent} max={TRANSFER_RULES.maxSellOn} onChange={sellOnPercent=>setProposal(v=>({...v,sellOnPercent}))} hint="Trích từ phí bán cầu thủ trong tương lai."/></div>
   <button className="primary" type="submit"><PaperPlaneTilt size={17}/>Gửi đề nghị cho CLB</button>
  </form>
 </div><BudgetSummary g={g} player={player} clubOffer={proposal} contractOffer={deal.playerDemand}/></div>;
}

function ContractProposal({g,player,deal,act}){
 const [proposal,setProposal]=useState(()=>contractDraft(deal.lastContractOffer||deal.playerDemand));
 const edit=(key,value)=>setProposal(v=>({...v,[key]:value}));
 return <div className="negotiation-layout"><div>
  <section className="negotiation-demand"><div className="negotiation-section-heading"><span className="eyebrow">YÊU CẦU CỦA NGƯỜI ĐẠI DIỆN</span><h3>Hợp đồng cho {player.shortName||player.name}</h3></div><ContractTerms terms={deal.playerDemand} compact/></section>
  <form className="negotiation-proposal" onSubmit={e=>{e.preventDefault();act(x=>submitContractOffer(x,deal.id,proposal));}}>
   <div className="negotiation-section-heading"><h3>Điều khoản bạn đề nghị</h3><button type="button" className="text-button" onClick={()=>setProposal(contractDraft(deal.playerDemand))}>Dùng yêu cầu này</button></div>
   <div className="negotiation-fields">
    <AmountField monetary label="Lương mỗi tuần (€)" value={proposal.wage} min={100} max={TRANSFER_RULES.maxWage} onChange={n=>edit('wage',n)}/>
    <label className="field negotiation-field"><span>Thời hạn hợp đồng</span><select value={proposal.years} onChange={e=>edit('years',Number(e.target.value))}>{[1,2,3,4,5].map(y=><option key={y} value={y}>{y} năm</option>)}</select></label>
    <AmountField monetary label="Thưởng ký hợp đồng (€)" value={proposal.signingBonus} onChange={n=>edit('signingBonus',n)}/>
    <AmountField monetary label="Phí đại diện (€)" value={proposal.agentFee} onChange={n=>edit('agentFee',n)}/>
    <AmountField monetary label="Thưởng mỗi lần ra sân (€)" value={proposal.appearanceBonus} onChange={n=>edit('appearanceBonus',n)}/>
    <AmountField monetary label="Thưởng mỗi bàn thắng (€)" value={proposal.goalBonus} onChange={n=>edit('goalBonus',n)}/>
    <AmountField label="Tăng lương hằng năm (%)" value={proposal.annualRise} max={TRANSFER_RULES.maxAnnualRise} onChange={n=>edit('annualRise',n)}/>
    <label className="field negotiation-field"><span>Vai trò trong đội</span><select value={proposal.squadRole} onChange={e=>edit('squadRole',e.target.value)}>{Object.entries(ROLES).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
    <AmountField monetary label="Điều khoản giải phóng (€)" value={proposal.releaseClause} onChange={n=>edit('releaseClause',n)} hint={`Nhập 0 nếu không có; nếu có, tối thiểu ${money(minimumReleaseClause(numeric(deal.clubAgreement?.fee)))}.`}/>
   </div>
   <button className="primary" type="submit"><PaperPlaneTilt size={17}/>Gửi đề nghị hợp đồng</button>
  </form>
 </div><BudgetSummary g={g} player={player} clubOffer={deal.clubAgreement} contractOffer={proposal}/></div>;
}

function Agreement({g,player,deal,act}){
 return <div className="negotiation-layout"><section className="negotiation-agreement"><div className="negotiation-section-heading"><span className="eyebrow">HAI BÊN ĐÃ THỐNG NHẤT</span><h3>Sẵn sàng ký hợp đồng</h3></div><p>{player.name} sẽ chuyển đến {g.clubs[g.clubId].name} khi bạn xác nhận bên dưới.</p><dl className="negotiation-terms"><div><dt>Phí chuyển nhượng</dt><dd>{money(deal.clubAgreement?.fee||0)}</dd></div><div><dt>Phần trăm bán lại</dt><dd>{number(deal.clubAgreement?.sellOnPercent||0)}%</dd></div></dl><ContractTerms terms={deal.contractAgreement}/><div className="negotiation-sign"><button className="primary" onClick={()=>act(x=>completeTransfer(x,deal.id),true)}><Signature size={20}/>Ký hợp đồng và hoàn tất chuyển nhượng</button><small>Trừ tiền và ngân sách, cập nhật đội hình và hợp đồng ngay khi ký.</small></div></section><BudgetSummary g={g} player={player} clubOffer={deal.clubAgreement} contractOffer={deal.contractAgreement} agreed/></div>;
}

export default function TransferNegotiation({g,playerId,mutate,onClose,onComplete,onOpenClub}){
 const stageRef=useRef(null);
 const player=g.players[playerId],deal=getNegotiation(g,playerId),[notice,setNotice]=useState(null),[confirmWithdrawal,setConfirmWithdrawal]=useState(false);
 useEffect(()=>{const modal=stageRef.current?.closest('[role=dialog]');if(modal)modal.scrollTop=0;},[deal?.id,deal?.stage]);
 if(!player)return <Modal title="Đàm phán chuyển nhượng" onClose={onClose}><div className="negotiation-empty"><p>Cầu thủ không còn trong dữ liệu sự nghiệp.</p><button className="secondary" onClick={onClose}>Đóng</button></div></Modal>;
 const stage=deal?.stage,active=ACTIVE.has(stage),seller=g.clubs[deal?.sellerClubId||deal?.sellerId||player.clubId],buyer=g.clubs[g.clubId],step=stage==='club'?0:stage==='contract'?1:stage==='agreed'||stage==='completed'?2:-1;
 const coolingDown=deal?.sellerId===player.clubId&&deal?.cooldownUntil&&g.date<deal.cooldownUntil,canRestart=player.clubId!==g.clubId&&!coolingDown,rounds=stage==='club'?deal.clubRounds:deal?.playerRounds;
 const act=(fn,complete=false)=>{
  let result;
  const ok=mutate(x=>{result=fn(x);if(result?.ok===false)throw Error(result.message||'Không thể thực hiện đề nghị này.');});
  setNotice({text:result?.message||(ok?'Đã cập nhật cuộc đàm phán.':'Không thể thực hiện. Hãy kiểm tra lại đề nghị.'),error:!ok});
  setConfirmWithdrawal(false);
  if(ok&&complete&&result?.transfer)onComplete?.(result);
 };
 return <Modal title="Đàm phán chuyển nhượng" wide onClose={onClose}><div ref={stageRef} className="transfer-negotiation">
  <div className="negotiation-player"><Portrait player={player} size={66}/><div><span className="eyebrow" title={positionDescription(player)}>{positionLabel(player)} · {player.age} TUỔI</span><h2>{player.name}</h2><div className="negotiation-club-route">{onOpenClub?<button className="text-button" onClick={()=>onOpenClub(seller.id)}><Badge club={seller} size={20}/>{seller.shortName}</button>:<span><Badge club={seller} size={20}/>{seller?.shortName}</span>}<ArrowRight size={15}/><span><Badge club={buyer} size={20}/>{buyer.shortName}</span></div></div><span className={'negotiation-status '+(stage||'')}>{NEGOTIATION_STATUS[stage]||'Bắt đầu đàm phán'}</span></div>
  <ol className="negotiation-steps" aria-label="Tiến trình chuyển nhượng">{['Thỏa thuận với CLB','Điều khoản cá nhân','Ký hợp đồng'].map((label,i)=><li className={i===step?'current':i<step?'done':''} aria-current={i===step?'step':undefined} key={label}><span>{i<step?<Check size={15}/>:i+1}</span>{label}</li>)}</ol>
  {notice&&<div className={'negotiation-notice '+(notice.error?'error':'')} role={notice.error?'alert':'status'}>{notice.error?<WarningCircle size={18}/>:<Handshake size={18}/>}<span>{notice.text}</span></div>}
  {active&&<div className="negotiation-context"><span>{stage==='agreed'?'Chờ quyết định cuối cùng của bạn':`Đã gửi ${number(rounds||0)} / ${deal.maxRounds||TRANSFER_RULES.maxRounds} đề nghị ở bước này`}</span>{deal.expiresOn&&<span>Hạn trả lời: {fmtDate(deal.expiresOn)}</span>}</div>}
  {stage==='club'&&<ClubProposal key={deal.id+'-club'} g={g} player={player} deal={deal} act={act}/>}
  {stage==='contract'&&<ContractProposal key={deal.id+'-contract'} g={g} player={player} deal={deal} act={act}/>}
  {stage==='agreed'&&<Agreement g={g} player={player} deal={deal} act={act}/>}
  {!active&&<section className="negotiation-empty">{stage==='completed'?<Check size={30}/>:<Handshake size={30}/>}<h3>{stage?NEGOTIATION_STATUS[stage]:'Mở cuộc đàm phán'}</h3><p>{deal?.reason||(stage==='completed'?`${player.name} đã hoàn tất chuyển nhượng. Hồ sơ và đội hình đã được cập nhật.`:deal?'Xem diễn biến bên dưới để biết phản hồi của CLB và người đại diện.':'Bạn sẽ thỏa thuận giá với CLB, sau đó đàm phán lương, thưởng và các điều khoản cá nhân.')}</p>{coolingDown&&<p className="amber">Có thể liên hệ lại từ {fmtDate(deal.cooldownUntil)}.</p>}{canRestart&&<button className="primary" onClick={()=>act(x=>beginNegotiation(x,playerId))}><Handshake size={18}/>{deal?'Mở lại đàm phán':'Liên hệ CLB và người đại diện'}</button>}</section>}
  {deal?.history?.length>0&&<section className="negotiation-history"><h3>Diễn biến đàm phán · mới nhất trước</h3><ol>{deal.history.slice().reverse().map((entry,i)=><li key={i}><div><strong>{({club:seller?.shortName,seller:seller?.shortName,player:'Người đại diện',agent:'Người đại diện',buyer:buyer.shortName,manager:'Bạn',system:'Thông báo'})[entry.side]||'Thông báo'}</strong><time>{fmtDate(entry.date)}</time></div><p>{entry.text}</p></li>)}</ol></section>}
  <footer className="negotiation-footer">{active&&(confirmWithdrawal?<div className="negotiation-withdraw-confirm"><span>Rút lui sẽ đóng cuộc đàm phán này.</span><button className="secondary" onClick={()=>act(x=>withdrawNegotiation(x,deal.id))}>Xác nhận rút lui</button><button className="text-button" onClick={()=>setConfirmWithdrawal(false)}>Tiếp tục đàm phán</button></div>:<button className="text-button negotiation-withdraw" onClick={()=>setConfirmWithdrawal(true)}>Rút khỏi đàm phán</button>)}<button className="secondary" onClick={onClose}>{active?'Đóng và tiếp tục sau':'Đóng'}</button></footer>
 </div></Modal>;
}
