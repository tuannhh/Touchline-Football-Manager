// Regulatory references checked 2026-10-04. Every account below belongs to the
// career simulation; opening revenues and registration book values are estimates.
import {money} from './locale.mjs';
const DAY=86400000;
const number=v=>Math.max(0,Number(v)||0);
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
const stamp=date=>Date.parse(`${date}T12:00:00Z`);
const dateBefore=(date,days)=>new Date(stamp(date)-days*DAY).toISOString().slice(0,10);
const COACHES=new Set(['assistant','goalkeepingCoach','coach','fitnessCoach']);
const annualBonus=t=>number(t?.appearanceBonus)*25+number(t?.goalBonus)*5;
export const FINANCE_SOURCES={
 uefa:{id:'uefa',label:'UEFA · squad cost 70%',kind:'ratio',ratioLimit:.7,sourceLabel:'UEFA · Financial sustainability 2026',sourceUrl:'https://documents.uefa.com/r/UEFA-Club-Licensing-and-Financial-Sustainability-Regulations-2026/Article-93-Calculation-of-squad-cost-ratio-Online',description:'CLB dự cúp UEFA chịu kiểm soát chi phí đội hình, gồm lương, khấu hao chuyển nhượng và phí đại diện.',limitation:'Game dùng dự toán theo mùa; chưa mô phỏng kỳ báo cáo năm dương lịch, ngoại lệ, điều chỉnh kế toán và kiểm tra lợi nhuận ba năm của UEFA.'},
 eng:{id:'eng',label:'Premier League · SCR 85%',kind:'ratio',ratioLimit:.85,sourceLabel:'Premier League · SCR / SSR 2026/27',sourceUrl:'https://www.premierleague.com/en/news/4467022/new-premier-league-financial-system-explained',description:'Premier League áp dụng SCR từ 2026/27, với ngưỡng xanh 85% doanh thu bóng đá và lãi/lỗ bán cầu thủ.',limitation:'Game chặn hợp đồng mới tại ngưỡng xanh 85%; chưa mô phỏng dư địa 30 điểm phần trăm, khoản levy và ba phép kiểm tra SSR ngoài đời.'},
 championship:{id:'championship',label:'Championship · SCR 85%',kind:'ratio',costBasis:'wages',incomeBasis:'cash-trading',ratioLimit:.85,sourceLabel:'EFL · Financial Regulation 2026/27',sourceUrl:'https://www.efl.com/governance/financial-regulation/',description:'Championship kiểm tra lương theo 85% doanh thu và dòng tiền chuyển nhượng ròng từ 2026/27.',limitation:'Game dùng tiền bán trừ phí mua thực trả; chưa mô phỏng vốn chủ sở hữu, điều chỉnh doanh thu và giai đoạn chuyển tiếp cho đội xuống hạng.'},
 leagueOne:{id:'leagueOne',label:'League One · SCMP 50%',kind:'ratio',costBasis:'wages',ratioLimit:.5,sourceLabel:'EFL · thay đổi SCMP 15/05/2026',sourceUrl:'https://www.efl.com/news/2026/may/15/championship-and-league-one-clubs-approve-changes-to-financial-control-rules/',description:'League One giảm ngưỡng quỹ lương từ 60% xuống 50% doanh thu trong mùa 2026/27.',limitation:'Game dùng dự toán lương, thưởng và HLV; chưa mô phỏng vốn chủ sở hữu và mức 65% chuyển tiếp của CLB vừa xuống từ Championship.'},
 esp:{id:'esp',label:'LaLiga · ngân sách đội hình',kind:'budget',ratioLimit:null,sourceLabel:'LaLiga · Squad Cost Limit 2026/27',sourceUrl:'https://www.laliga.com/en-CO/transparency/economic-management/squad-cost-limit',description:'LaLiga phê duyệt giới hạn chi phí đội hình riêng cho từng CLB, không dùng một tỷ lệ chung cho toàn giải.',limitation:'Hạn mức trong sự nghiệp được game dự toán; không phải LCPD chính thức của CLB và chưa mô phỏng các cơ chế đăng ký ngoại lệ.'},
 ger:{id:'ger',label:'DFL · chi phí đội hình 70%',kind:'ratio',ratioLimit:.7,sourceLabel:'Hannover 96 · quyết định DFL 03/03/2026',sourceUrl:'https://www.hannover96.de/newscenter/news/details/new69a6fdfa0f5e8927496287-luettjes-vom-tage-kurzmeldungen-vom-dienstag.html',description:'DFL đưa tỷ lệ chi phí đội hình 70% vào Bundesliga và 2. Bundesliga từ 2026/27.',limitation:'Game chặn thương vụ vượt ngưỡng ngay; điều lệ thật có lộ trình áp dụng chế tài đến 2028/29. Doanh thu và chi phí trong game là ước tính.'},
 ita:{id:'ita',label:'FIGC · CLA/R 70%',kind:'ratio',ratioLimit:.7,sourceLabel:'FIGC · Comunicato Ufficiale 292/A',sourceUrl:'https://figc.it/media/268682/292-valori-indicatori-di-controllo.pdf',description:'FIGC quy định tỷ lệ chi phí lao động mở rộng trên doanh thu 0,70 cho mùa 2026/27.',limitation:'Game dùng dự toán lương, thưởng và khấu hao làm đại diện; chưa mô phỏng toàn bộ kiểm tra nợ, thanh khoản và điều kiện cấp phép FIGC.'},
 por:{id:'por',label:'Liga Portugal · quỹ lương 70%',kind:'ratio',costBasis:'wages',ratioLimit:.7,sourceLabel:'Liga Portugal · Manual de Licenciamento 2026/27',sourceUrl:'https://www.ligaportugal.pt/backoffice/assets/Comunicado_Oficial_n_234_Manual_de_Licenciamento_para_as_Competicoes_Profissionais_2026_27_e0531c5e13.pdf',description:'Quy tắc cấp phép 2026/27 giới hạn lương cầu thủ và HLV ở 70% ngân sách.',limitation:'Game kiểm tra lương và thưởng trên doanh thu dự toán. Chi phí khấu hao được kiểm tra riêng bằng ngân sách CLB hoặc quy tắc UEFA; chưa mô phỏng toàn bộ thủ tục cấp phép.'},
 fra:{id:'fra',label:'DNCG · ngân sách CLB',kind:'budget',ratioLimit:null,sourceLabel:'LFP · DNCG 23/06/2026',sourceUrl:'https://www.lfp.fr/article/dncg-releve-de-decisions-du-23-juin-2026',description:'DNCG đánh giá tình hình tài chính và có thể giám sát quỹ lương, chuyển nhượng theo từng CLB.',limitation:'Ngân sách hiển thị do game xây dựng; không phải một mức trần DNCG chung hoặc quyết định thật đối với CLB.'},
 ned:{id:'ned',label:'KNVB · cấp phép tài chính',kind:'budget',ratioLimit:null,sourceLabel:'KNVB · Controleprotocol 06/03/2026',sourceUrl:'https://www.knvb.nl/downloads/bestand/29921/richtlijn-controleprotocol-per-6-maart-2026',description:'KNVB kiểm tra báo cáo và điều kiện tài chính trong hệ thống cấp phép CLB.',limitation:'Hạn mức và dự trữ tiền mặt ở đây là mô hình game; không phải một tỷ lệ KNVB chung cho mọi CLB.'},
 vie:{id:'vie',label:'VFF · cấp phép CLB',kind:'budget',ratioLimit:null,sourceLabel:'VFF · Quy chế cấp phép CLB 2019',sourceUrl:'https://vff.org.vn/wp-content/uploads/2019/10/QC-cap-phep-2019.pdf',description:'Quy chế cấp phép VFF có các yêu cầu về tài chính và nghĩa vụ thanh toán với nhân viên, CLB khác.',limitation:'Nguồn tham chiếu 2019; game dùng hạn mức chi phí và dự trữ riêng, không khẳng định một trần FFP phần trăm hiện hành cho V.League.'},
 generic:{id:'board',label:'Ngân sách bền vững của CLB',kind:'budget',ratioLimit:null,sourceLabel:'Mô hình tài chính của Touchline',sourceUrl:null,description:'Ban lãnh đạo đặt hạn mức chi phí đội hình và dự trữ tiền mặt cho mùa giải.',limitation:'Đây là quy tắc cân bằng game; không phải một tỷ lệ FFP pháp lý chung của giải đấu.'}
};
export function financialPolicies(g,clubId){
 const club=g.clubs[clubId];if(!club)return [];
 const family=String(club.leagueId).split('.')[0];
 const domestic=club.leagueId==='eng.1'&&g.year>=2026?FINANCE_SOURCES.eng:club.leagueId==='eng.2'?FINANCE_SOURCES.championship:club.leagueId==='eng.3'?FINANCE_SOURCES.leagueOne:/^esp\.[12]$/.test(club.leagueId)?FINANCE_SOURCES.esp:/^ger\.[12]$/.test(club.leagueId)?FINANCE_SOURCES.ger:family==='ita'?FINANCE_SOURCES.ita:/^por\.[12]$/.test(club.leagueId)?FINANCE_SOURCES.por:['fra','ned','vie'].includes(family)?FINANCE_SOURCES[family]:FINANCE_SOURCES.generic;
 const result=[domestic];if(domestic.costBasis==='wages')result.push(FINANCE_SOURCES.generic);
 if((g.cups||[]).some(c=>(c.kind==='uefa'||String(c.id).startsWith('uefa.'))&&c.participants?.includes(clubId)))result.push(FINANCE_SOURCES.uefa);
 return result;
}
function payrolls(g){
 const map=Object.fromEntries(Object.keys(g.clubs).map(id=>[id,{players:0,staff:0,coaches:0,bonuses:0}]));
 for(const p of Object.values(g.players)){const row=map[p.clubId];if(row){row.players+=number(p.wage);row.bonuses+=annualBonus(p.contractTerms);}}
 for(const s of Object.values(g.staff||{})){const row=map[s.clubId];if(row){row.staff+=number(s.wage);if(COACHES.has(s.role))row.coaches+=number(s.wage);}}
 return map;
}
function assetCharge(asset,year){return asset.startYear+asset.years>year?asset.cost/asset.years:0;}
// A season close reads hundreds of club reports without changing any payroll
// or asset. Keep this snapshot local to that operation; transfers and editors
// mutate the world in place, so a persistent cache would become stale.
function reportContext(g){
 const annualAmortization={};
 for(const asset of Object.values(g.financials.assets))annualAmortization[asset.clubId]=(annualAmortization[asset.clubId]||0)+assetCharge(asset,g.financials.year);
 return {payrolls:payrolls(g),annualAmortization};
}
export function financialBookValue(asset,date){
 if(!asset)return 0;
 const elapsed=Math.max(0,(stamp(date)-stamp(asset.signedAt))/DAY/365.25);
 return Math.max(0,Math.round(asset.cost*(1-elapsed/asset.years)));
}
export function initializeFinancials(g){
 if(g.financeVersion===1)return g;
 const wages=payrolls(g),assets={},amortization={};
 for(const p of Object.values(g.players)){
  const years=clamp(Math.floor(number(p.contractUntil)-g.year)||1,1,5),cost=Math.round(number(p.value)*.2);
  assets[p.id]={clubId:p.clubId,cost,years,startYear:g.year,signedAt:g.date,estimated:true};amortization[p.clubId]=(amortization[p.clubId]||0)+cost/years;
 }
 const clubs={};
 for(const c of Object.values(g.clubs)){
  const pay=wages[c.id],annualCost=(pay.players+pay.coaches)*52+pay.bonuses+(amortization[c.id]||0);
  const revenue=Math.round(Math.max(100000,annualCost/.55,c.leagueId==='eng.3'?((pay.players+pay.coaches)*52+pay.bonuses)/.4:0));
  clubs[c.id]={baseRevenue:Math.round(revenue*.94),matchdayForecast:Math.round(revenue*.06),squadBudget:Math.round(revenue*.8),initialLeagueId:c.leagueId,policyIds:financialPolicies(g,c.id).map(p=>p.id),transferProfit:0,actualMatchdayIncome:0,weeklyIncome:0,weeklyExpense:0,purchases:0,sales:0,transferSpend:0,transferFeesSpent:0,transferReceipts:0};
 }
 g.financeVersion=1;g.financials={year:g.year,startedAt:g.date,lastWeeklyDate:dateBefore(g.date,7),clubs,assets,processedFixtures:[],processedTransfers:[],history:[]};return g;
}
export function financeReport(g,clubId=g.clubId,options={}){
 const club=g.clubs[clubId],state=g.financials?.clubs?.[clubId];
 if(g.financeVersion!==1||!club||!state)return {enabled:false,clubId};
 const pay=(options.context?.payrolls||payrolls(g))[clubId],policies=options.policyIds?options.policyIds.map(id=>Object.values(FINANCE_SOURCES).find(p=>p.id===id)).filter(Boolean):financialPolicies(g,clubId),revenue=state.baseRevenue+state.matchdayForecast,denominator=Math.max(1,revenue+state.transferProfit);
 let annualAmortization=options.context?.annualAmortization[clubId]||0;
 if(!options.context)for(const a of Object.values(g.financials.assets))if(a.clubId===clubId)annualAmortization+=assetCharge(a,g.financials.year);
 const annualWages=pay.players*52,annualStaffCost=pay.coaches*52,annualBonuses=pay.bonuses,annualCost=Math.round(annualWages+annualStaffCost+annualBonuses+annualAmortization);
 const netTransferCash=state.transferReceipts-state.transferFeesSpent;
 const checks=policies.map(policy=>{const measuredCost=policy.costBasis==='wages'?annualWages+annualStaffCost+annualBonuses:annualCost,base=policy.incomeBasis==='cash-trading'?Math.max(1,revenue+netTransferCash):policy.costBasis==='wages'?revenue:denominator,limit=Math.max(0,Math.round(policy.kind==='ratio'?base*policy.ratioLimit:state.squadBudget+state.transferProfit*.8));return {...policy,limit,measuredCost,calculationRevenue:base,headroom:limit-measuredCost,ratio:measuredCost/Math.max(1,base)};});
 checks.sort((a,b)=>a.headroom-b.headroom);const policy=checks[0],{limit,headroom,ratio,measuredCost}=policy;
 const cashReserve=Math.round((pay.players+pay.staff)*4),compliant=headroom>=0&&club.cash>=cashReserve;
 return {enabled:true,clubId,year:g.financials.year,policy,policies:checks,revenue,calculationRevenue:policy.calculationRevenue,netTransferCash,baseRevenue:state.baseRevenue,matchdayForecast:state.matchdayForecast,actualMatchdayIncome:state.actualMatchdayIncome,transferProfit:state.transferProfit,annualWages,annualStaffCost,annualBonuses,annualAmortization:Math.round(annualAmortization),annualCost,measuredCost,limit,ratio,headroom,cashReserve,compliant,status:!compliant?'restricted':headroom<limit*.08?'warning':'healthy',purchases:state.purchases,sales:state.sales,transferSpend:state.transferSpend,transferReceipts:state.transferReceipts,history:g.financials.history.filter(h=>h.clubId===clubId),assumptions:'Tài khoản mô phỏng: doanh thu được chốt đầu mùa, giá trị sổ sách ban đầu ước tính bằng 20% giá trị cầu thủ; phí mua, ký và đại diện khấu hao tối đa 5 năm. Dự toán thưởng: 25 lần ra sân và 5 bàn thắng. Chi phí gồm cầu thủ và nhóm HLV; dự trữ tiền mặt bằng 4 tuần lương toàn CLB. Các kiểm tra là giới hạn mua của game, không phải kết luận vi phạm ngoài đời.'};
}
export function assessTransferFinancials(g,p,buyerId,fee,terms,report){
 if(g.financeVersion!==1)return {ok:true,enabled:false};
 const current=report||financeReport(g,buyerId);if(!current.enabled)return {ok:false,message:'Thiếu hồ sơ tài chính của CLB.'};
 const years=clamp(Number(terms.years)||1,1,5),annualAddedCost=Math.round(number(terms.wage)*52+annualBonus(terms)+(number(fee)+number(terms.signingBonus)+number(terms.agentFee))/years);
 const annualCost=current.annualCost+annualAddedCost,policies=current.policies.map(policy=>{const measuredCost=policy.measuredCost+(policy.costBasis==='wages'?number(terms.wage)*52+annualBonus(terms):annualAddedCost),base=policy.incomeBasis==='cash-trading'?Math.max(1,policy.calculationRevenue-number(fee)):policy.calculationRevenue,limit=policy.incomeBasis==='cash-trading'?Math.round(base*policy.ratioLimit):policy.limit;return {...policy,limit,measuredCost,calculationRevenue:base,headroom:limit-measuredCost,ratio:measuredCost/Math.max(1,base)};}).sort((a,b)=>a.headroom-b.headroom),policy=policies[0],projected={...current,annualCost,policies,policy,limit:policy.limit,measuredCost:policy.measuredCost,calculationRevenue:policy.calculationRevenue,headroom:policy.headroom,ratio:policy.ratio};
 const remainingCash=g.clubs[buyerId].cash-fee-number(terms.signingBonus)-number(terms.agentFee),reserve=current.cashReserve+number(terms.wage)*4;
 if(projected.headroom<0)return {ok:false,enabled:true,annualAddedCost,projected,message:`Kiểm soát tài chính: thương vụ vượt hạn mức chi phí đội hình ${money(-projected.headroom)} mỗi mùa. Hãy giảm phí/lương hoặc bán cầu thủ trước.`};
 if(remainingCash<reserve)return {ok:false,enabled:true,annualAddedCost,projected,message:`Kiểm soát tài chính: cần giữ ${money(reserve)} để dự trữ bốn tuần lương sau thương vụ.`};
 return {ok:true,enabled:true,annualAddedCost,projected};
}
// Called after identity/cash settlement; the financial asset still belongs to the seller.
export function recordTransferFinancials(g,record){
 if(g.financeVersion!==1)return;
 const f=g.financials;if(f.processedTransfers.includes(record.eventId))return;
 const seller=f.clubs[record.from],buyer=f.clubs[record.to],id=record.playerId||record.id,asset=f.assets[id],bookValue=asset?.clubId===record.from?financialBookValue(asset,record.date):0;
 const net=record.fee-number(record.sellOnPayment);seller.transferProfit+=net-bookValue;seller.transferReceipts+=net;seller.sales++;
 buyer.transferSpend+=record.upfrontCost;buyer.transferFeesSpent+=record.fee;buyer.purchases++;
 if(record.sellOnClubId&&record.sellOnPayment&&f.clubs[record.sellOnClubId]){f.clubs[record.sellOnClubId].transferProfit+=record.sellOnPayment;f.clubs[record.sellOnClubId].transferReceipts+=record.sellOnPayment;}
 f.assets[id]={clubId:record.to,cost:record.upfrontCost,years:clamp(record.terms.years,1,5),startYear:f.year,signedAt:record.date,estimated:false};
 record.financialBookValue=bookValue;record.financialProfit=net-bookValue;f.processedTransfers.push(record.eventId);
}
export function settleWeeklyFinancials(g){
 if(g.financeVersion!==1)return [];
 const f=g.financials,days=Math.max(0,(stamp(g.date)-stamp(f.lastWeeklyDate))/DAY);if(!days)return [];
 const wages=payrolls(g),entries=[];
 for(const club of Object.values(g.clubs)){
  const state=f.clubs[club.id],pay=wages[club.id],playerWages=Math.round(pay.players*days/7),staffWages=Math.round(pay.staff*days/7),income=Math.round(state.baseRevenue*days/365.25),expense=playerWages+staffWages;
  club.cash+=income-expense;state.weeklyIncome+=income;state.weeklyExpense+=expense;
  const entry={round:g.round+1,date:g.date,type:'weekly',income,expense,playerWages,staffWages,balance:club.cash,clubId:club.id,days};entries.push(entry);
  if(club.id===g.clubId){g.ledger??=[];g.ledger.unshift(entry);g.ledger=g.ledger.slice(0,100);}
 }
 f.lastWeeklyDate=g.date;return entries;
}
export function settleMatchFinancials(g,fixture,environment){
 if(g.financeVersion!==1||!fixture?.id||!Number.isFinite(environment?.gateReceipts))return [];
 const f=g.financials;if(f.processedFixtures.includes(fixture.id))return [];
 const total=Math.max(0,Math.round(environment.gateReceipts)),recipients=fixture.neutral?[fixture.home,fixture.away]:[fixture.home],entries=[];
 for(let i=0;i<recipients.length;i++){
  const clubId=recipients[i],club=g.clubs[clubId],state=f.clubs[clubId];if(!club||!state)continue;
  const income=i===0?Math.ceil(total/recipients.length):Math.floor(total/recipients.length);club.cash+=income;state.actualMatchdayIncome+=income;
  const entry={round:g.round+1,date:fixture.date||g.date,type:'matchday',income,expense:0,balance:club.cash,clubId,fixtureId:fixture.id,attendance:environment.attendance};entries.push(entry);
  if(clubId===g.clubId){g.ledger??=[];g.ledger.unshift(entry);g.ledger=g.ledger.slice(0,100);}
 }
 f.processedFixtures.push(fixture.id);return entries;
}
export function rollFinancialSeason(g){
 if(g.financeVersion!==1)return initializeFinancials(g);
 const f=g.financials;if(f.year===g.year)return g;
 settleWeeklyFinancials(g);
 const context=reportContext(g);
 for(const club of Object.values(g.clubs)){
  const state=f.clubs[club.id],r=financeReport(g,club.id,{policyIds:state.policyIds,context});f.history.push({clubId:club.id,year:f.year,revenue:r.revenue,annualCost:r.annualCost,limit:r.limit,transferProfit:state.transferProfit,matchdayIncome:state.actualMatchdayIncome});
  const oldTier=Number(String(state.initialLeagueId).split('.')[1])||1,newTier=Number(String(club.leagueId).split('.')[1])||1,factor=clamp(oldTier/newTier,.75,1.25)*1.02;
  state.baseRevenue=Math.round(state.baseRevenue*factor);state.matchdayForecast=Math.round(state.matchdayForecast*factor);state.squadBudget=Math.round((state.baseRevenue+state.matchdayForecast)*.8);state.initialLeagueId=club.leagueId;state.policyIds=financialPolicies(g,club.id).map(p=>p.id);
  for(const key of ['transferProfit','actualMatchdayIncome','weeklyIncome','weeklyExpense','purchases','sales','transferSpend','transferFeesSpent','transferReceipts'])state[key]=0;
 }
 f.year=g.year;f.history=f.history.filter(h=>h.year>=g.year-3);f.processedFixtures=[];f.processedTransfers=[];f.lastWeeklyDate=g.date;return g;
}
export function validateFinancials(g){
 const invalid=()=>{throw Error('Dữ liệu kiểm soát tài chính không hợp lệ.');};
 if(g.financeVersion===undefined){if(g.financials!==undefined)invalid();return true;}
 const f=g.financials,finite=v=>Number.isFinite(v)&&Math.abs(v)<=1e15,date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(stamp(v))&&new Date(stamp(v)).toISOString().slice(0,10)===v;
 if(g.financeVersion!==1||!f||f.year!==g.year||!date(f.startedAt)||!date(f.lastWeeklyDate)||!f.clubs||!f.assets||!Array.isArray(f.history)||f.history.length>Object.keys(g.clubs).length*3)invalid();
 for(const key of ['processedFixtures','processedTransfers'])if(!Array.isArray(f[key])||f[key].length>50000||new Set(f[key]).size!==f[key].length||f[key].some(id=>typeof id!=='string'||id.length>200))invalid();
 if(Object.keys(f.clubs).length!==Object.keys(g.clubs).length)invalid();
 for(const c of Object.values(g.clubs)){
  const row=f.clubs[c.id];if(!row||typeof row.initialLeagueId!=='string'||!Array.isArray(row.policyIds)||!row.policyIds.length||row.policyIds.length>3||new Set(row.policyIds).size!==row.policyIds.length||row.policyIds.some(id=>!Object.values(FINANCE_SOURCES).some(p=>p.id===id)))invalid();
  for(const key of ['baseRevenue','matchdayForecast','squadBudget','transferProfit','actualMatchdayIncome','weeklyIncome','weeklyExpense','purchases','sales','transferSpend','transferFeesSpent','transferReceipts'])if(!finite(row[key])||(key!=='transferProfit'&&row[key]<0))invalid();
  if(!Number.isInteger(row.purchases)||!Number.isInteger(row.sales))invalid();
 }
 for(const [id,a]of Object.entries(f.assets))if(!g.players[id]||!a||a.clubId!==g.players[id].clubId||!finite(a.cost)||a.cost<0||!Number.isInteger(a.years)||a.years<1||a.years>5||!Number.isInteger(a.startYear)||a.startYear>g.year||!date(a.signedAt)||typeof a.estimated!=='boolean')invalid();
 if(Object.keys(f.assets).length!==Object.keys(g.players).length)invalid();
 for(const h of f.history)if(!h||!g.clubs[h.clubId]||!Number.isInteger(h.year)||h.year>=g.year||!['revenue','annualCost','limit','transferProfit','matchdayIncome'].every(k=>finite(h[k])))invalid();
 return true;
}
