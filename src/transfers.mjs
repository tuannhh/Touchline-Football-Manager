import {dailyCareer} from './careerClock.mjs';
import {makeMessage} from './mail.mjs';
import {playerAbility as ability} from './playerAbility.mjs';
import {staffEffects} from './staff.mjs';
import {assessTransferFinancials,financeReport,recordTransferFinancials} from './financialSustainability.mjs';

// These are game rules, not a reproduction of any country's transfer regulations.
export const SQUAD_ROLES={star:'Ngôi sao',starter:'Đá chính',rotation:'Luân phiên',prospect:'Tài năng trẻ'};
export const TRANSFER_RULES={maxRounds:4,maxWage:10000000,maxMoney:1000000000000,maxSellOn:30,maxAnnualRise:20,minSquad:16};
const ACTIVE=new Set(['club','contract','agreed']);
const STAGES=new Set([...ACTIVE,'completed','rejected','withdrawn','expired']);
const MONEY_KEYS=['wage','signingBonus','agentFee','appearanceBonus','goalBonus','releaseClause'];
const DATE=/^\d{4}-\d{2}-\d{2}$/;
const validDate=v=>typeof v==='string'&&DATE.test(v)&&Number.isFinite(Date.parse(v+'T12:00:00Z'))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
const rounded=(n,step=100)=>Math.round(n/step)*step;
const money=n=>Number(n).toLocaleString('vi-VN')+' €';
const hash=s=>{let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
const random=holder=>{holder.rng=(Math.imul(holder.rng,1664525)+1013904223)>>>0;return holder.rng/4294967296;};
export const minimumReleaseClause=fee=>Math.ceil(fee*11/10);
const dayAdd=(s,n)=>new Date(Date.parse(s+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
const days=(a,b)=>(Date.parse(a+'T12:00:00Z')-Date.parse(b+'T12:00:00Z'))/86400000;
const squad=(g,id)=>Object.values(g.players).filter(p=>p.clubId===id);
const wages=(g,id)=>squad(g,id).reduce((s,p)=>s+p.wage,0);
const fail=message=>({ok:false,message});
const answer=(deal,message,extra={})=>({ok:true,message,deal,...extra});
const note=(g,d,side,text)=>{d.history.push({date:g.date,side,text});d.history=d.history.slice(-60);};
const ROLE_RANK={prospect:0,rotation:1,starter:2,star:3};
const desired={GK:3,DF:8,MF:8,FW:5};

// Transparent simulation factors, not valuations or willingness attributed to real clubs.
// A caller running the world market can pass its roster index to avoid full-world scans.
export function transferAssessment(g,p,buyerId,roster){
 const seller=g.clubs[p.clubId],buyer=g.clubs[buyerId],ps=roster?.get(p.clubId)||squad(g,p.clubId),bp=roster?.get(buyerId)||squad(g,buyerId);
 const quality=ability(p),years=Math.max(0,p.contractUntil-g.year),positionPlayers=ps.filter(x=>x.position===p.position);
 const replacements=positionPlayers.filter(x=>x.id!==p.id&&x.injury===0&&ability(x)>=quality-8&&(!p.naturalPositions?.length||!x.naturalPositions?.length||p.naturalPositions.some(pos=>[...x.naturalPositions,...(x.otherPositions||[])].includes(pos)))).length;
 const average=ps.reduce((s,x)=>s+ability(x),0)/Math.max(1,ps.length);
 const development=g.playerDevelopment?.players?.[p.id];
 const influence=development?(development.clubId===p.clubId?development.influence:null):p.abilityAssessment?.influence;
 const important=p.contractTerms?.squadRole==='star'||influence>=85||quality>=88||quality>=Math.max(80,average+6);
 const cornerstone=important&&quality>=88&&seller.reputation>=84&&years>=3;
 const wantsMove=p.listed||p.dynamics?.wantsToLeave||p.morale<45;
 const competitor=seller.leagueId===buyer.leagueId&&seller.reputation>=80&&buyer.reputation>=80&&Math.abs(seller.reputation-buyer.reputation)<=12;
 const release=Number.isFinite(p.contractTerms?.releaseClause)&&p.contractTerms.releaseClause>0?p.contractTerms.releaseClause:0;
 const repGap=seller.reputation-buyer.reputation;
 const recentSigning=p.contractTerms?.signedAt&&days(g.date,p.contractTerms.signedAt)>=0&&days(g.date,p.contractTerms.signedAt)<90;
 const buyerPosition=bp.filter(x=>x.position===p.position),buyerAverage=buyerPosition.reduce((s,x)=>s+ability(x),0)/Math.max(1,buyerPosition.length);
 const buyerNeedsPlayer=bp.length<36&&(buyerPosition.length<desired[p.position]||quality>=buyerAverage+3);
 const expectedRole=p.age<21&&quality<buyer.reputation-10?'prospect':quality>=buyer.reputation-1?'star':quality>=buyer.reputation-10?'starter':'rotation';
 let sellerRefusal=null,playerRefusal=null;
 if(!wantsMove&&!release){
  if(recentSigning)sellerRefusal='CLB vừa ký hợp đồng và chưa muốn bán cầu thủ trong 90 ngày đầu.';
  else if(cornerstone&&buyer.reputation<=seller.reputation+5)sellerRefusal='CLB coi đây là ngôi sao nền tảng còn hợp đồng dài hạn và không mở đàm phán.';
  else if(important&&years>=2&&competitor&&replacements<2)sellerRefusal='CLB không muốn tăng sức mạnh cho đối thủ trực tiếp khi chưa có người thay thế.';
 }
 if(buyer.reputation<quality-22||(!wantsMove&&important&&repGap>10))playerRefusal='Cầu thủ từ chối vì danh tiếng và mục tiêu cạnh tranh của CLB chưa phù hợp.';
 const injuryWeeks=Math.max(0,Number(p.injury)||0);
 return {modelVersion:2,quality,influence:Number.isFinite(influence)?influence:null,contractYears:years,important,cornerstone,replacements,competitor,release,wantsMove:!!wantsMove,expectedRole,buyerNeedsPlayer,buyerPositionQuality:Math.round(buyerAverage),injuryWeeks,sellerRefusal,playerRefusal,difficulty:sellerRefusal||playerRefusal?'unavailable':important||competitor||years>=4?'difficult':wantsMove||years<=1?'open':'normal'};
}

export function initializeTransferMarket(g){
 if(g.marketVersion===1)return g;
 g.marketVersion=1;
 g.negotiations=[];
 g.transferMarket={rng:hash(`${g.simulationId||g.id}:transfer-market`),sequence:0,processedDates:[]};
 return g;
}
export function getNegotiation(g,playerId){return g.negotiations?.find(d=>d.playerId===playerId&&ACTIVE.has(d.stage))||g.negotiations?.find(d=>d.playerId===playerId)||null;}
function mail(g,title,paragraphs,playerId){
 const body=paragraphs.join('\n\n');const m=makeMessage(g,title,body,'transfer',{paragraphs:[`Kính gửi HLV ${g.manager},`,...paragraphs,'Trân trọng,','Giám đốc thể thao'],...(playerId?{playerIds:[playerId]}:{}),action:{page:'transfers',label:'Mở thị trường chuyển nhượng'}});
 g.messages.unshift(m);g.messages=g.messages.slice(0,250);
}
function canSell(g,p,roster){
 const ps=roster?.get(p.clubId)||squad(g,p.clubId);
 if(ps.length<=TRANSFER_RULES.minSquad)return 'CLB chủ quản cần giữ tối thiểu 16 cầu thủ.';
 const atPosition=ps.filter(x=>x.position===p.position).length;
 if(atPosition<=(p.position==='GK'?1:2))return p.position==='GK'?'CLB không bán thủ môn duy nhất.':'CLB thiếu phương án thay thế ở vị trí này.';
 return null;
}
function close(g,d,stage,text,cooldown=14){
 delete d.pendingOffer;
 d.stage=stage;d.closedAt=g.date;d.cooldownUntil=dayAdd(g.date,cooldown);d.reason=text;note(g,d,'system',text);return answer(d,text);
}
function current(g,id,stage){
 const d=g.negotiations?.find(x=>x.id===id);
 if(!d||d.buyerId!==g.clubId)return fail('Cuộc đàm phán không tồn tại.');
 if(g.liveMatch)return fail('Hoàn tất trận đấu đang diễn ra trước khi đàm phán.');
 if(!ACTIVE.has(d.stage))return fail('Cuộc đàm phán này đã kết thúc.');
 if(!g.players[d.playerId]||g.players[d.playerId].clubId!==d.sellerId)return close(g,d,'expired','Cầu thủ đã chuyển sang CLB khác; thỏa thuận cũ không còn hiệu lực.',0);
 if(g.date>d.expiresOn)return close(g,d,'expired','Thỏa thuận đã hết hạn sau 28 ngày. Hãy mở lại đàm phán.',0);
 if(d.stage!==stage)return fail('Hãy hoàn tất đúng bước đàm phán trước khi tiếp tục.');
 return {deal:d};
}
function clubTerms(g,p,buyerId,assessment=transferAssessment(g,p,buyerId)){
 const seller=g.clubs[p.clubId],buyer=g.clubs[buyerId];
 const age=p.age<24?1.16:p.age>32?.86:1;
 const yearsFactor=assessment.contractYears<=1?.75:assessment.contractYears>=4?1.22:1;
 const qualityPremium=assessment.important?1.35:ability(p)>=seller.reputation?1.13:1;
 const replacementPremium=assessment.replacements===0?1.2:assessment.replacements===1?1.08:1;
 const competitionPremium=assessment.competitor?1.2:1;
 const medicalDiscount=1-clamp(assessment.injuryWeeks*.008,0,.25);
 const richBuyer=1+clamp(buyer.reputation-seller.reputation,0,30)/200;
 const discount=staffEffects(g,buyerId).transferDiscount;
 let fee=Math.max(1000,rounded(p.value*(assessment.wantsMove?.92:1.2)*age*yearsFactor*qualityPremium*replacementPremium*competitionPremium*medicalDiscount*richBuyer*(1-discount),1000));
 const release=p.contractTerms?.releaseClause;
 if(Number.isFinite(release)&&release>0)fee=Math.min(fee,release);
 return {fee:Math.min(TRANSFER_RULES.maxMoney,Math.round(fee)),sellOnPercent:p.age<24?10:5};
}
function playerTerms(g,p,buyerId,fee,assessment=transferAssessment(g,p,buyerId)){
 const rep=g.clubs[buyerId].reputation,quality=ability(p);
 const ambitionPremium=clamp(g.clubs[p.clubId].reputation-rep,0,20)/60;
 const rise=(assessment.wantsMove?1.05:1.18)+clamp(quality-rep,0,25)/60+ambitionPremium;
 const wage=clamp(rounded(Math.max(100,p.wage*rise,p.value/600)),100,TRANSFER_RULES.maxWage);
 return {wage,signingBonus:rounded(wage*(assessment.important?14:10)),agentFee:rounded(wage*5),appearanceBonus:rounded(wage*.12,10),goalBonus:rounded(wage*(p.position==='FW'?.15:.06),10),years:p.age>31?2:p.age<25?4:3,releaseClause:fee*1.1>TRANSFER_RULES.maxMoney?0:clamp(rounded(Math.max(fee*1.6,p.value*1.8),1000),minimumReleaseClause(fee),TRANSFER_RULES.maxMoney),annualRise:5,squadRole:assessment.expectedRole};
}
/** Read-only recruitment estimate using the same demands and refusals as negotiation. */
export function scoutingTransferEstimate(g,p,buyerId=g.clubId,roster){
 const assessment=transferAssessment(g,p,buyerId,roster),fee=clubTerms(g,p,buyerId,assessment).fee;
 return {assessment,fee,terms:playerTerms(g,p,buyerId,fee,assessment),sellRefusal:canSell(g,p,roster)};
}
export function beginNegotiation(g,playerId){
 const p=g.players[playerId];
 if(!p||p.clubId===g.clubId)return fail('Hãy chọn cầu thủ của CLB khác.');
 if(g.liveMatch)return fail('Hoàn tất trận đấu trước khi mở đàm phán.');
 const old=getNegotiation(g,playerId);
 if(old&&ACTIVE.has(old.stage)&&p.clubId===old.sellerId&&g.date<=old.expiresOn)return answer(old,'Tiếp tục cuộc đàm phán hiện tại.');
 if(old?.cooldownUntil>g.date&&old.sellerId===p.clubId)return fail(`Phía cầu thủ/CLB chưa muốn trở lại bàn đàm phán trước ${old.cooldownUntil}.`);
 initializeTransferMarket(g);
 if(old&&ACTIVE.has(old.stage))close(g,old,'expired','Thỏa thuận cũ đã hết hiệu lực.',0);
 const sellerId=p.clubId,assessment=transferAssessment(g,p,g.clubId),clubDemand=clubTerms(g,p,g.clubId,assessment);
 const d={id:`deal-${++g.transferMarket.sequence}`,playerId,buyerId:g.clubId,sellerId,stage:'club',createdAt:g.date,expiresOn:dayAdd(g.date,28),assessment,clubDemand,playerDemand:playerTerms(g,p,g.clubId,clubDemand.fee,assessment),originalClubDemand:{...clubDemand},clubRounds:0,playerRounds:0,maxRounds:4,clubPatience:4,playerPatience:4,history:[]};
 d.originalPlayerDemand={...d.playerDemand};g.negotiations.unshift(d);g.negotiations=g.negotiations.filter((x,i)=>i<1000||ACTIVE.has(x.stage));
 const refusal=canSell(g,p)||assessment.sellerRefusal;
 if(refusal){note(g,d,'club',refusal);return close(g,d,'rejected',refusal);}
 if(assessment.playerRefusal){note(g,d,'player',assessment.playerRefusal);return close(g,d,'rejected',assessment.playerRefusal);}
 note(g,d,'club',`${g.clubs[sellerId].name} yêu cầu ${money(clubDemand.fee)} và ${clubDemand.sellOnPercent}% phí lần bán tiếp theo.`);
 note(g,d,'player',`Người đại diện dự kiến lương ${money(d.playerDemand.wage)}/tuần, vai trò ${SQUAD_ROLES[d.playerDemand.squadRole]}. Điều khoản cá nhân được chốt sau khi hai CLB đồng ý.`);
 return answer(d,'Đã mở đàm phán phí chuyển nhượng với CLB chủ quản.');
}
const whole=(v,max=TRANSFER_RULES.maxMoney)=>Number.isSafeInteger(v)&&v>=0&&v<=max;
function validClubTerms(o){return !!o&&whole(o.fee)&&whole(o.sellOnPercent,TRANSFER_RULES.maxSellOn);}
function validPlayerTerms(o){return !!o&&MONEY_KEYS.every(k=>whole(o[k],k==='wage'?TRANSFER_RULES.maxWage:TRANSFER_RULES.maxMoney))&&o.wage>=100&&Number.isInteger(o.years)&&o.years>=1&&o.years<=5&&whole(o.annualRise,TRANSFER_RULES.maxAnnualRise)&&Object.hasOwn(SQUAD_ROLES,o.squadRole);}
function resolveClubOffer(g,dealId,offer){
 if(!validClubTerms(offer))return fail('Phí phải là số nguyên không âm; phần trăm bán tiếp từ 0 đến 30.');
 const check=current(g,dealId,'club');if(!check.deal||check.ok!==undefined)return check;const d=check.deal,p=g.players[d.playerId];
 const assessment=transferAssessment(g,p,d.buyerId);
 const refusal=canSell(g,p)||assessment.sellerRefusal||assessment.playerRefusal;if(refusal)return close(g,d,'rejected',refusal);
 const o={fee:offer.fee,sellOnPercent:offer.sellOnPercent};d.clubRounds++;d.clubPatience=4-d.clubRounds;d.lastClubOffer=o;
 note(g,d,'manager',`Đề nghị ${money(o.fee)}, ${o.sellOnPercent}% phí lần bán tiếp theo.`);
 const release=p.contractTerms?.releaseClause;
 const effective=o.fee*(1+o.sellOnPercent*.004);
 const askEffective=d.clubDemand.fee*(1+d.clubDemand.sellOnPercent*.004);
 const floor=d.originalClubDemand.fee*(p.listed?.88:.94)*(1+d.originalClubDemand.sellOnPercent*.004);
 if((release>0&&o.fee>=release)||effective>=Math.max(floor,askEffective*.99)){
  d.clubAgreement=o;d.stage='contract';
  note(g,d,'club',`Đồng ý phí ${money(o.fee)} và ${o.sellOnPercent}% lần bán tiếp theo. Mời thương lượng hợp đồng với cầu thủ.`);
  return answer(d,'CLB đã đồng ý. Tiếp theo là lương, thưởng và điều khoản cá nhân.');
 }
 if(effective<floor*.55||d.clubRounds>=4)return close(g,d,'rejected','CLB từ chối đề nghị và dừng đàm phán trong 14 ngày.');
 const target=Math.max(floor,askEffective*.965);
 d.clubDemand={fee:Math.ceil(target/(1+o.sellOnPercent*.004)/1000)*1000,sellOnPercent:o.sellOnPercent};
 note(g,d,'club',`Mức giá quá thấp. CLB trả giá ${money(d.clubDemand.fee)} và ${d.clubDemand.sellOnPercent}% lần bán tiếp theo; còn ${d.clubPatience} lượt thương lượng.`);
 return answer(d,'CLB đưa ra mức giá đối ứng.');
}
function contractProblems(d,o){
 const a=d.playerDemand,base=d.originalPlayerDemand;
 const roleShort=Math.max(0,ROLE_RANK[a.squadRole]-ROLE_RANK[o.squadRole]);
 const needWage=a.wage*(1+roleShort*.12);
 const annualWorth=t=>t.wage*52+t.signingBonus/t.years+Math.min(t.appearanceBonus,base.wage*.4)*20+Math.min(t.goalBonus,base.wage*.4)*5+t.wage*52*t.annualRise/100*.5;
 const needed={...a,wage:needWage};const problems=[];
 if(roleShort)problems.push('Vai trò được hứa thấp hơn yêu cầu; cầu thủ ưu tiên thời gian thi đấu');
 if(o.wage<Math.max(base.wage*.82,needWage*.85)||annualWorth(o)<annualWorth(needed)*.965)problems.push(`Tổng đãi ngộ chưa đạt yêu cầu ${money(a.wage)}/tuần và các khoản thưởng dự kiến${roleShort?' do vai trò thấp hơn mong muốn':''}`);
 if(o.agentFee<a.agentFee*.9)problems.push(`Phí đại diện cần ít nhất ${money(Math.ceil(a.agentFee*.9))}`);
 if(o.years<Math.max(1,a.years-1))problems.push(`Cầu thủ muốn hợp đồng ít nhất ${Math.max(1,a.years-1)} năm`);
 if(o.releaseClause>0&&o.releaseClause<minimumReleaseClause(d.clubAgreement.fee))problems.push(`Phí giải phóng phải bằng 0 hoặc tối thiểu ${money(minimumReleaseClause(d.clubAgreement.fee))}`);
 if(o.years>4&&base.years<=2)problems.push('Cầu thủ lớn tuổi chỉ muốn cam kết tối đa 4 năm');
 return problems;
}
function resolveContractOffer(g,dealId,terms){
 if(!validPlayerTerms(terms))return fail('Hợp đồng không hợp lệ: tiền là số nguyên, lương 100–10.000.000 €/tuần, thời hạn 1–5 năm, tăng lương 0–20%, vai trò hợp lệ.');
 const check=current(g,dealId,'contract');if(!check.deal||check.ok!==undefined)return check;const d=check.deal;
 const o=Object.fromEntries([...MONEY_KEYS,'years','annualRise','squadRole'].map(k=>[k,terms[k]]));
 d.playerRounds++;d.playerPatience=4-d.playerRounds;d.lastContractOffer=o;
 note(g,d,'manager',`Đề nghị ${money(o.wage)}/tuần, ${o.years} năm, lót tay ${money(o.signingBonus)}, phí đại diện ${money(o.agentFee)}, vai trò ${SQUAD_ROLES[o.squadRole]}.`);
 const problems=contractProblems(d,o);
 if(!problems.length){d.contractAgreement=o;d.stage='agreed';note(g,d,'player','Cầu thủ đồng ý điều khoản cá nhân. Thương vụ chỉ có hiệu lực sau khi HLV xác nhận ký và CLB đủ tiền/quỹ lương.');return answer(d,'Hai bên đã thống nhất. Kiểm tra tổng chi phí rồi xác nhận ký hợp đồng.');}
 if(o.wage<d.originalPlayerDemand.wage*.45||d.playerRounds>=4)return close(g,d,'rejected',`Người đại diện dừng đàm phán 14 ngày. ${problems.join('. ')}.`);
 const a=d.playerDemand,base=d.originalPlayerDemand;
 a.wage=rounded(Math.max(base.wage*.93,a.wage*.98));a.signingBonus=rounded(Math.max(base.signingBonus*.85,a.signingBonus*.96));a.agentFee=rounded(Math.max(base.agentFee*.9,a.agentFee*.97));
 note(g,d,'player',`${problems.join('. ')}. Đề nghị đối ứng: ${money(a.wage)}/tuần, lót tay ${money(a.signingBonus)}, phí đại diện ${money(a.agentFee)}; còn ${d.playerPatience} lượt.`);
 return answer(d,'Người đại diện đưa ra điều khoản đối ứng.');
}
function queueOffer(g,dealId,terms,kind){
 const check=current(g,dealId,kind);if(!check.deal||check.ok!==undefined)return check;const d=check.deal;
 if(d.pendingOffer)return fail('Đang chờ phản hồi đề nghị đã gửi. Hãy tiếp tục thời gian.');
 if(!(kind==='club'?validClubTerms(terms):validPlayerTerms(terms)))return fail('Điều khoản đề nghị không hợp lệ.');
 const replyOn=dayAdd(g.date,1+hash(`${d.id}:${d.clubRounds}:${d.playerRounds}:${kind}`)%3);
 d.pendingOffer={kind,terms:structuredClone(terms),sentOn:g.date,replyOn};
 note(g,d,'manager',`Đã gửi đề nghị. Dự kiến phản hồi ngày ${replyOn}.`);
 return answer(d,`Đã gửi đề nghị. Hãy đóng cửa sổ và tiếp tục từng ngày; dự kiến phản hồi ${replyOn}.`);
}
export function submitClubOffer(g,id,terms){return dailyCareer(g)?queueOffer(g,id,terms,'club'):resolveClubOffer(g,id,terms);}
export function submitContractOffer(g,id,terms){return dailyCareer(g)?queueOffer(g,id,terms,'contract'):resolveContractOffer(g,id,terms);}
export function processNegotiationReplies(g){
 if(!dailyCareer(g)||g.liveMatch)return [];
 const replies=[];
 for(const d of g.negotiations.filter(x=>ACTIVE.has(x.stage))){
  let response;
  if(g.date>d.expiresOn||g.players[d.playerId]?.clubId!==d.sellerId)response=close(g,d,'expired','Thỏa thuận đã hết hạn hoặc cầu thủ đã chuyển CLB.',0);
  else if(d.pendingOffer?.replyOn<=g.date){const offer=d.pendingOffer;delete d.pendingOffer;response=offer.kind==='club'?resolveClubOffer(g,d.id,offer.terms):resolveContractOffer(g,d.id,offer.terms);}
  if(response){mail(g,`Phản hồi chuyển nhượng · ${g.players[d.playerId].name}`,[response.message,d.history.at(-1)?.text||'Hãy xem diễn biến đàm phán.'],d.playerId);g.messages[0].requiresAttention=true;replies.push(d);}
 }
 return replies;
}
export function withdrawNegotiation(g,id){
 const d=g.negotiations?.find(x=>x.id===id);
 if(!d||d.buyerId!==g.clubId||!ACTIVE.has(d.stage))return fail('Không có cuộc đàm phán đang mở để rút lại.');
 if(g.liveMatch)return fail('Hoàn tất trận đấu trước khi thay đổi đàm phán.');
 return close(g,d,'withdrawn','Bạn đã rút khỏi đàm phán. Hai bên có thể trao đổi lại sau 7 ngày.',7);
}
function affordability(g,p,buyerId,fee,t){
 const buyer=g.clubs[buyerId];const upfront=fee+t.signingBonus+t.agentFee;
 if(!buyer||!Number.isSafeInteger(upfront)||buyer.budget<upfront||buyer.cash<upfront)return 'Ngân sách chuyển nhượng hoặc số dư không đủ trả phí, lót tay và phí đại diện.';
 if(wages(g,buyerId)+t.wage>buyer.wageBudget)return 'Không đủ quỹ lương hàng tuần để đăng ký hợp đồng mới.';
 const financial=assessTransferFinancials(g,p,buyerId,fee,t);if(!financial.ok)return financial.message;
 return canSell(g,p);
}
function jersey(g,p,buyerId){
 const used=new Set(squad(g,buyerId).filter(x=>x.id!==p.id).map(x=>String(x.number)));
 if(!p.number||used.has(String(p.number))){p.sourceNumber??=p.number;p.number=String(Array.from({length:99},(_,i)=>i+1).find(n=>!used.has(String(n)))||'');}
}
function move(g,p,buyerId,fee,terms,sellOnPercent,isAI,hooks,dealId){
 const from=p.clubId,buyer=g.clubs[buyerId],seller=g.clubs[from],oldTerms=p.contractTerms;
 const oldOwner=g.clubs[oldTerms?.sellOnClubId];const sellOnPayment=oldOwner&&oldOwner.id!==from?Math.round(fee*clamp(oldTerms.sellOnPercent||0,0,30)/100):0;
 const total=fee+terms.signingBonus+terms.agentFee;
 buyer.cash-=total;buyer.budget-=total;seller.cash+=fee-sellOnPayment;seller.budget+=fee-sellOnPayment;
 if(sellOnPayment){oldOwner.cash+=sellOnPayment;oldOwner.budget+=sellOnPayment;}
 jersey(g,p,buyerId);p.clubId=buyerId;p.wage=terms.wage;p.contractUntil=g.year+terms.years;p.listed=false;p.morale=Math.max(p.morale,85);
 p.contractTerms={...terms,sellOnClubId:from,sellOnPercent,signedAt:g.date,signedYear:g.year};
 p.contractEndDate=`${p.contractUntil}-06-30`;
 const record={eventId:`transfer-${++g.transferMarket.sequence}`,id:p.id,playerId:p.id,name:p.name,from,to:buyerId,fee,date:g.date,isAI,terms:{...p.contractTerms},upfrontCost:total,sellOnPayment,...(sellOnPayment?{sellOnClubId:oldOwner.id}:{}),...(dealId?{dealId}:{})};
 recordTransferFinancials(g,record);
 g.transfers.unshift(record);g.transfers=g.transfers.slice(0,5000);
 for(const d of g.negotiations)if(d.playerId===p.id&&d.id!==dealId&&ACTIVE.has(d.stage))close(g,d,'expired','Cầu thủ đã ký hợp đồng với CLB khác; cuộc đàm phán hết hiệu lực.',0);
 if(from===g.clubId||buyerId===g.clubId){g.ledger.unshift({date:g.date,round:g.round+1,type:'transfer',description:buyerId===g.clubId?`Mua ${p.name} · phí, thưởng ký và đại diện`:`Bán ${p.name}`,income:from===g.clubId?fee-sellOnPayment:sellOnPayment&&oldOwner?.id===g.clubId?sellOnPayment:0,expense:buyerId===g.clubId?total:0,balance:g.clubs[g.clubId].cash,playerId:p.id,eventId:record.eventId});g.ledger=g.ledger.slice(0,100);}
 else if(sellOnPayment&&oldOwner?.id===g.clubId){g.ledger.unshift({date:g.date,round:g.round+1,type:'sellOn',description:`Điều khoản bán lại ${p.name}`,income:sellOnPayment,expense:0,balance:oldOwner.cash,playerId:p.id,eventId:record.eventId});g.ledger=g.ledger.slice(0,100);}
 hooks.invalidateRosters?.(g);hooks.onTransfer?.(g,record);
 return record;
}
export function finalizeNegotiation(g,dealId,hooks={}){
 const check=current(g,dealId,'agreed');if(!check.deal||check.ok!==undefined)return check;const d=check.deal,p=g.players[d.playerId];
 if(!validClubTerms(d.clubAgreement)||!validPlayerTerms(d.contractAgreement))return fail('Thỏa thuận đã lưu không hợp lệ.');
 const error=affordability(g,p,d.buyerId,d.clubAgreement.fee,d.contractAgreement);if(error)return fail(error);
 const record=move(g,p,d.buyerId,d.clubAgreement.fee,d.contractAgreement,d.clubAgreement.sellOnPercent,false,hooks,d.id);
 d.stage='completed';d.closedAt=g.date;d.completedEventId=record.eventId;note(g,d,'system','Đã ký hợp đồng và chuyển đăng ký CLB.');hooks.repairLineup?.(g);
 mail(g,`Đã ký hợp đồng với ${p.name}`,[`${p.name} gia nhập ${g.clubs[d.buyerId].name} từ ${g.clubs[d.sellerId].name}. Phí chuyển nhượng ${money(record.fee)}.`,`Lương ${money(p.wage)}/tuần; hợp đồng đến ${p.contractUntil}. Lót tay ${money(d.contractAgreement.signingBonus)}, phí đại diện ${money(d.contractAgreement.agentFee)}. Tổng chi ngay: ${money(record.upfrontCost)}.`,`Thưởng ra sân ${money(d.contractAgreement.appearanceBonus)} mỗi trận chính thức, thưởng bàn thắng ${money(d.contractAgreement.goalBonus)}/bàn; tăng lương ${d.contractAgreement.annualRise}% mỗi mùa. Vai trò cam kết: ${SQUAD_ROLES[d.contractAgreement.squadRole]}.`,`Phí giải phóng: ${d.contractAgreement.releaseClause?money(d.contractAgreement.releaseClause):'không có'}. ${g.clubs[d.sellerId].name} nhận ${d.clubAgreement.sellOnPercent}% phí lần bán tiếp theo.`,`Hãy kiểm tra danh sách đăng ký và đội hình. Cầu thủ chưa được tự động thêm vào danh sách đăng ký thủ công của bạn.`],p.id);
 return answer(d,'Đã hoàn tất thương vụ.',{transfer:record});
}

export function saleQuote(g,p){
 const years=Math.max(0,p.contractUntil-g.year),contract=years<=1?.75:1,medical=1-clamp((p.injury||0)*.015,0,.4),age=p.age>32?.8:1;
 return Math.min(Math.max(1000,rounded(p.value*(p.listed?.78:.86)*contract*medical*age,1000)),p.contractTerms?.releaseClause||Infinity);
}
export function sellToAI(g,playerId,hooks={}){
 const p=g.players[playerId];if(!p||p.clubId!==g.clubId)return fail('Cầu thủ không thuộc CLB của bạn.');
 if(g.liveMatch)return fail('Hoàn tất trận đấu trước khi bán cầu thủ.');const shortage=canSell(g,p);if(shortage)return fail(shortage);
 if(p.wage>TRANSFER_RULES.maxWage)return fail('Mức lương hiện tại cao hơn giới hạn hợp đồng của thị trường. Hãy điều chỉnh lương trước khi bán.');
 if(p.injury>=8)return fail('Các CLB quan tâm đang chờ cầu thủ hồi phục chấn thương dài hạn trước khi ra giá.');
 const fee=saleQuote(g,p),roster=new Map(Object.keys(g.clubs).map(id=>[id,[]]));for(const player of Object.values(g.players))roster.get(player.clubId)?.push(player);
 const candidates=[];
 for(const buyer of Object.values(g.clubs)){
  if(buyer.id===g.clubId)continue;
  const assessment=transferAssessment(g,p,buyer.id,roster);
  if(assessment.playerRefusal||!assessment.buyerNeedsPlayer||assessment.quality<buyer.reputation-22)continue;
  const terms=playerTerms(g,p,buyer.id,fee,assessment),bp=roster.get(buyer.id),typicalWage=bp.reduce((s,x)=>s+x.wage,0)/Math.max(1,bp.length);
  // A wealthy club still rejects a wage that breaks its sporting salary structure.
  if(terms.wage>Math.max(500,typicalWage*3,p.value/400)||affordability(g,p,buyer.id,fee,terms))continue;
  candidates.push({buyer,terms,fit:assessment.quality-assessment.buyerPositionQuality});
 }
 candidates.sort((a,b)=>b.fit-a.fit||Math.abs(a.buyer.reputation-ability(p))-Math.abs(b.buyer.reputation-ability(p))||a.buyer.id.localeCompare(b.buyer.id));
 const selected=candidates[0];
 if(!selected)return fail('Chưa có CLB muốn mua với giá và mức lương này. Các đội còn cân nhắc nhu cầu vị trí, chất lượng và tham vọng của cầu thủ.');
 const {buyer,terms}=selected;
 initializeTransferMarket(g);const record=move(g,p,buyer.id,fee,terms,0,false,hooks);hooks.repairLineup?.(g);
 mail(g,`${p.name} gia nhập ${buyer.name}`,[`CLB đồng ý bán ${p.name} cho ${buyer.name} với phí ${money(fee)}.`,record.sellOnPayment?`Đã trả ${money(record.sellOnPayment)} cho ${g.clubs[record.sellOnClubId].name} theo điều khoản bán tiếp trước đó.`:'Không có khoản chia sẻ phí cho CLB trước.',`Số tiền thực nhận ${money(fee-record.sellOnPayment)} được cộng vào số dư và ngân sách chuyển nhượng. Đội hình đã được rà soát sau giao dịch.`],p.id);
 return {ok:true,message:'Đã bán cầu thủ.',transfer:record};
}


/** Live simulated interest, not a claim about real-world scouting or offers.
 * Uses the same squad/quality/ambition checks as negotiation and sale logic.
 * A monitoring club may lack funds; active interest must fit current finances.
 */
export function simulatedClubInterests(g,p,{limit=5}={}){
 if(!p||!g.clubs[p.clubId])return [];
 const roster=new Map(Object.keys(g.clubs).map(id=>[id,[]]));
 for(const player of Object.values(g.players))roster.get(player.clubId)?.push(player);
 const candidates=[];
 for(const buyer of Object.values(g.clubs)){
  if(buyer.id===p.clubId)continue;
  const assessment=transferAssessment(g,p,buyer.id,roster);
  if(assessment.playerRefusal||!assessment.buyerNeedsPlayer||assessment.quality<buyer.reputation-22)continue;
  const fee=clubTerms(g,p,buyer.id,assessment).fee,terms=playerTerms(g,p,buyer.id,fee,assessment);
  const bp=roster.get(buyer.id),payroll=bp.reduce((sum,x)=>sum+x.wage,0),funds=Math.max(0,Math.min(buyer.budget,buyer.cash));
  const cost=fee+terms.signingBonus+terms.agentFee,affordable=cost<=funds&&payroll+terms.wage<=buyer.wageBudget;
  if(!affordable&&funds<cost*.2)continue;
  const upgrade=assessment.quality-assessment.buyerPositionQuality;
  const shortage=bp.filter(x=>x.position===p.position).length<desired[p.position];
  const score=clamp(42+upgrade*1.4+(shortage?14:0)+(p.listed?8:0)+(p.age<24&&p.potential>=assessment.quality+5?6:0)+(affordable?14:-12)-(assessment.sellerRefusal?14:0)-(p.injury>=8?18:0),0,100);
  if(score<35)continue;
  const reasons=[shortage?'position_shortage':'quality_upgrade'];
  if(p.age<24&&p.potential>=assessment.quality+5)reasons.push('development_potential');
  reasons.push(affordable?'within_budget':'budget_watch');
  if(assessment.sellerRefusal)reasons.push('seller_reluctant');
  if(p.injury>0)reasons.push('medical_watch');
  candidates.push({clubId:buyer.id,clubName:buyer.name,score:Math.round(score),level:affordable&&!assessment.sellerRefusal&&p.injury<8?'interested':'monitoring',basis:'simulation',asOf:g.date,affordable,reasons});
 }
 return candidates.sort((a,b)=>b.score-a.score||a.clubId.localeCompare(b.clubId)).slice(0,clamp(Math.floor(limit),0,20));
}

export function runAITransfers(g,hooks={}){
 if(g.liveMatch)return {ok:false,message:'Thị trường đợi trận đấu đang diễn ra kết thúc.',transfers:[]};
 initializeTransferMarket(g);const market=g.transferMarket;
 if(market.processedDates.includes(g.date))return {ok:true,message:'Đã xử lý thị trường ở ngày này.',transfers:[]};
 market.processedDates.push(g.date);market.processedDates=market.processedDates.slice(-2000);
 for(const d of g.negotiations)if(ACTIVE.has(d.stage)&&(g.date>d.expiresOn||g.players[d.playerId]?.clubId!==d.sellerId))close(g,d,'expired','Thỏa thuận không còn hiệu lực sau khi thị trường hoặc ngày hết hạn thay đổi.',0);
 const target=dailyCareer(g)?1+Math.floor(random(market)*2):2+Math.floor(random(market)*5),records=[],touched=new Set(),financiallyLimited=new Set();let attempts=0;
 const clubs=Object.values(g.clubs).filter(c=>c.id!==g.clubId);
 const roster=new Map(clubs.map(c=>[c.id,[]]));for(const p of Object.values(g.players))roster.get(p.clubId)?.push(p);
 const lastMoved=new Map();for(const t of g.transfers)if(!lastMoved.has(t.playerId||t.id))lastMoved.set(t.playerId||t.id,t.date);
 const positions=['GK','DF','MF','FW'];
 for(let attempt=0;attempt<(dailyCareer(g)?30:100)&&records.length<target;attempt++){
  attempts++;
  const buyers=clubs.filter(c=>!touched.has(c.id)&&c.budget>50000&&c.cash>50000&&(roster.get(c.id)?.length||0)<36);
  if(!buyers.length)break;const buyer=buyers[Math.floor(random(market)*buyers.length)],bp=roster.get(buyer.id),financialReport=financeReport(g,buyer.id);
  const counts=Object.fromEntries(positions.map(pos=>[pos,bp.filter(p=>p.position===pos).length]));
  const need=positions.slice().sort((a,b)=>counts[a]/desired[a]-counts[b]/desired[b])[0];
  const positionQuality=bp.filter(p=>p.position===need).reduce((s,p)=>s+ability(p),0)/Math.max(1,counts[need]);
  const candidates=[];
  for(const seller of clubs){
   if(seller.id===buyer.id||touched.has(seller.id))continue;const ps=roster.get(seller.id);if(ps.length<=16)continue;
   const positionPlayers=ps.filter(p=>p.position===need);if(positionPlayers.length<=(need==='GK'?1:2))continue;
   for(const p of positionPlayers){
    if(lastMoved.has(p.id)&&days(g.date,lastMoved.get(p.id))<28)continue;
    const quality=ability(p);if(quality<Math.max(35,buyer.reputation-26)||quality>buyer.reputation+16)continue;
    if(p.age>36||p.injury>5)continue;
    const assessment=transferAssessment(g,p,buyer.id,roster);
    if(assessment.sellerRefusal||assessment.playerRefusal||!assessment.buyerNeedsPlayer)continue;
    const quoted=clubTerms(g,p,buyer.id,assessment);const fee=Math.min(quoted.fee,p.contractTerms?.releaseClause||Infinity,Math.max(1000,rounded(quoted.fee*(p.listed?.93:.99),1000)));
    const terms=playerTerms(g,p,buyer.id,fee,assessment),wage=terms.wage;
    const payroll=bp.reduce((s,x)=>s+x.wage,0);
    if(wage>Math.max(500,payroll/Math.max(1,bp.length)*3,p.value/400)||fee+terms.signingBonus+terms.agentFee>Math.min(buyer.budget,buyer.cash)||payroll+wage>buyer.wageBudget)continue;
    if(!assessTransferFinancials(g,p,buyer.id,fee,terms,financialReport).ok){financiallyLimited.add(buyer.id);continue;}
    const fit=(quality-positionQuality)*1.2+(p.age<25?7:0)+(p.listed?8:0)-fee/Math.max(1000,buyer.budget)*5;
    candidates.push({p,fee,terms,fit});
   }
  }
  candidates.sort((a,b)=>b.fit-a.fit||a.p.id.localeCompare(b.p.id));
  const pool=candidates.slice(0,10);if(!pool.length)continue;
  const {p,fee,terms}=pool[Math.floor(random(market)*pool.length)];
  if(affordability(g,p,buyer.id,fee,terms))continue;
  const from=p.clubId,record=move(g,p,buyer.id,fee,terms,p.age<24?10:0,true,hooks);records.push(record);touched.add(from);touched.add(buyer.id);
  roster.set(from,roster.get(from).filter(x=>x.id!==p.id));roster.get(buyer.id).push(p);lastMoved.set(p.id,g.date);
 }
 market.lastActivity={date:g.date,attempts,completed:records.length,financiallyLimitedClubs:financiallyLimited.size};
 if(records.length)mail(g,`Thị trường thế giới · ${records.length} thương vụ mới`,['Các CLB đã tự thương lượng và hoàn tất những giao dịch sau trong tuần:',...records.map(t=>`${t.name}: ${g.clubs[t.from].name} → ${g.clubs[t.to].name}, phí ${money(t.fee)}, lương ${money(t.terms.wage)}/tuần.`),'Danh sách cầu thủ, quỹ lương, ngân sách và đăng ký của các CLB do máy quản lý đã được cập nhật. Đây là thị trường mô phỏng hoạt động quanh năm.']);
 return {ok:true,message:`${records.length} thương vụ giữa các CLB khác.`,transfers:records};
}

export function validateTransferMarket(g){
 const invalid=()=>{throw Error('Dữ liệu đàm phán hoặc hợp đồng chuyển nhượng không hợp lệ.');};
 if(g.marketVersion===undefined){if(g.negotiations!==undefined||g.transferMarket!==undefined||Object.values(g.players).some(p=>p.contractTerms!==undefined))invalid();return true;}
 if(g.marketVersion!==1||!Array.isArray(g.negotiations)||g.negotiations.length>2000||!g.transferMarket)invalid();
 const market=g.transferMarket;
 if(market.lastActivity!==undefined){const a=market.lastActivity;if(!a||!validDate(a.date)||!whole(a.attempts,100)||!whole(a.completed,6)||!whole(a.financiallyLimitedClubs,Object.keys(g.clubs).length))invalid();}
 if(!whole(market.rng,4294967295)||!whole(market.sequence)||!Array.isArray(market.processedDates)||market.processedDates.length>2000||market.processedDates.some(d=>!validDate(d))||new Set(market.processedDates).size!==market.processedDates.length)invalid();
 const ids=new Set();
 for(const d of g.negotiations){
  if(!d||typeof d.id!=='string'||ids.has(d.id)||!g.players[d.playerId]||!g.clubs[d.buyerId]||!g.clubs[d.sellerId]||d.buyerId===d.sellerId||!STAGES.has(d.stage)||![d.createdAt,d.expiresOn].every(validDate)||!whole(d.clubRounds,4)||!whole(d.playerRounds,4)||!validClubTerms(d.clubDemand)||!validPlayerTerms(d.playerDemand)||!validClubTerms(d.originalClubDemand)||!validPlayerTerms(d.originalPlayerDemand)||!Array.isArray(d.history)||d.history.length>60||d.history.some(h=>!h||!validDate(h.date)||typeof h.text!=='string'||!['manager','club','player','system'].includes(h.side)))invalid();
  if(d.pendingOffer){const q=d.pendingOffer;if(!dailyCareer(g)||!['club','contract'].includes(q.kind)||q.kind!==d.stage||!validDate(q.sentOn)||!validDate(q.replyOn)||q.sentOn>=q.replyOn||q.sentOn>g.date||!(q.kind==='club'?validClubTerms(q.terms):validPlayerTerms(q.terms)))invalid();}
  if(d.clubAgreement!==undefined&&!validClubTerms(d.clubAgreement)||d.contractAgreement!==undefined&&!validPlayerTerms(d.contractAgreement))invalid();
  if(['contract','agreed','completed'].includes(d.stage)&&!d.clubAgreement||['agreed','completed'].includes(d.stage)&&!d.contractAgreement)invalid();
  if(d.cooldownUntil!==undefined&&!validDate(d.cooldownUntil))invalid();
  if(d.closedAt!==undefined&&!validDate(d.closedAt))invalid();
  ids.add(d.id);
 }
 for(const p of Object.values(g.players))if(p.contractTerms!==undefined){
  const t=p.contractTerms;if(!validPlayerTerms(t)||!whole(t.sellOnPercent,30)||!g.clubs[t.sellOnClubId]||!validDate(t.signedAt)||!Number.isInteger(t.signedYear))invalid();
  if(t.bonusPaidFixtures!==undefined&&(!Array.isArray(t.bonusPaidFixtures)||t.bonusPaidFixtures.length>200||new Set(t.bonusPaidFixtures).size!==t.bonusPaidFixtures.length||t.bonusPaidFixtures.some(id=>typeof id!=='string'||id.length<1||id.length>200)))invalid();
  if(t.promiseStartMinutes!==undefined&&!whole(t.promiseStartMinutes))invalid();
  for(const key of ['promiseFrom','lastPromiseReview'])if(t[key]!==undefined&&!validDate(t[key]))invalid();
  if(t.promiseWarned!==undefined&&typeof t.promiseWarned!=='boolean')invalid();
 }
 return true;
}
