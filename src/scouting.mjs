import {playerAbility as ability} from './playerAbility.mjs';
import {assignedStaff,STAFF_ROLES,workload} from './staff.mjs';
import {makeMessage} from './mail.mjs';
import {POSITION_DETAIL,phasePositions} from './tactics.mjs';
import {matchesPosition,naturalRoles,positionCode,positionLabel} from './playerPositions.mjs';
import {scoutingTransferEstimate} from './transfers.mjs';
import {assessTransferFinancials,financeReport} from './financialSustainability.mjs';

const DAY=86400000,ROLES=new Set(['scout','sportingDirector','assistant']);
const MAX_REPORTS=80,MAX_ASSIGNMENTS=120,MAX_CANDIDATES=5;
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
const stamp=date=>Date.parse(`${date}T12:00:00Z`);
const days=(a,b)=>(stamp(a)-stamp(b))/DAY;
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(stamp(v))&&new Date(stamp(v)).toISOString().slice(0,10)===v;
const hash=s=>{let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
const internalPosition=p=>({CAM:'AM',CDM:'DM'})[p]||p;
const money=n=>`${Number(n).toLocaleString('vi-VN')} €`;
const safeNumber=(n,max)=>Number.isFinite(n)&&n>=0&&n<=max;

/** This module owns advice only: it never spends money, changes staff tasks or buys players. */
export function initializeScouting(g){
 if(g.scouting===undefined)g.scouting={version:1,assignments:[],reports:[],lastRunDate:g.date,sequence:0};
 return g;
}
// Read directly so personnel changes do not leave an outdated scout index.
export function scoutingStaff(g){return Object.values(g.staff||{}).filter(s=>s.clubId===g.clubId&&ROLES.has(s.role)).sort((a,b)=>Number(b.role==='scout')-Number(a.role==='scout')||a.name.localeCompare(b.name));}
function validBrief(b){
 return b&&['position','prospect'].includes(b.kind)&&(Object.hasOwn(POSITION_DETAIL,b.position)||(b.kind==='prospect'&&b.position==='ANY'))&&Number.isInteger(b.maxAge)&&b.maxAge>=16&&b.maxAge<=50&&safeNumber(b.maxFee,1e12)&&safeNumber(b.maxWage,1e8)&&typeof b.scoutId==='string'&&Number.isInteger(b.durationWeeks)&&b.durationWeeks>=1&&b.durationWeeks<=4;
}
function prune(state){
 state.reports=state.reports.slice(0,MAX_REPORTS);
 const referenced=new Set(state.reports.map(r=>r.assignmentId).filter(Boolean));
 const protectedIds=new Set(state.assignments.filter(a=>a.status==='active'||referenced.has(a.id)).map(a=>a.id));
 let remaining=MAX_ASSIGNMENTS-protectedIds.size;
 state.assignments=state.assignments.filter(a=>protectedIds.has(a.id)||remaining-->0);
}
export function createScoutingAssignment(g,brief){
 if(g.liveMatch)throw Error('Hãy kết thúc trận đấu trước khi giao nhiệm vụ tuyển trạch.');
 const b={...brief,position:internalPosition(brief?.position)};
 if(!validBrief(b))throw Error('Yêu cầu tuyển trạch không hợp lệ.');
 if(!scoutingStaff(g).some(s=>s.id===b.scoutId))throw Error('Hãy chọn nhân sự tuyển trạch phù hợp của CLB.');
 initializeScouting(g);const state=g.scouting,active=state.assignments.filter(a=>a.status==='active');
 if(active.length>=3)throw Error('CLB chỉ có thể thực hiện tối đa ba nhiệm vụ tuyển trạch cùng lúc.');
 if(active.some(a=>a.scoutId===b.scoutId))throw Error('Nhân sự này đang thực hiện một nhiệm vụ tuyển trạch khác.');
 const assignment={id:`scout-assignment-${++state.sequence}`,kind:b.kind,position:b.position,maxAge:b.maxAge,maxFee:b.maxFee,maxWage:b.maxWage,scoutId:b.scoutId,durationWeeks:b.durationWeeks,status:'active',createdDate:g.date,completedDate:null,progressWeeks:0};
 state.assignments.unshift(assignment);prune(state);return assignment;
}
export function cancelScoutingAssignment(g,id){
 if(g.liveMatch)throw Error('Hãy kết thúc trận đấu trước khi thay đổi nhiệm vụ tuyển trạch.');
 const a=g.scouting?.assignments.find(a=>a.id===id);
 if(!a||a.status!=='active')throw Error('Không tìm thấy nhiệm vụ tuyển trạch đang thực hiện.');
 a.status='cancelled';a.completedDate=g.date;return a;
}
function quality(g,scout,weeks){
 const penalty=workload(g,scout.id).penalty;
 const qa=clamp((Number(scout.attributes?.judgingAbility)||1)/20*(1-penalty),.05,1);
 const qp=clamp((Number(scout.attributes?.judgingPotential)||1)/20*(1-penalty),.05,1);
 return {qa,qp,confidence:Math.round(clamp(25+(qa+qp)*22+weeks*7,1,97)),abilityRange:Math.ceil((15-qa*11)/Math.sqrt(weeks)),potentialRange:Math.ceil((19-qp*13)/Math.sqrt(weeks))};
}
function interval(value,range,seed){
 const error=((hash(seed)%2001)/1000-1)*range*.45,center=Math.round(clamp(value+error,1,100));
 return [Math.max(1,center-range),Math.min(100,center+range)];
}
function rosterContext(g){
 const roster=new Map();for(const p of Object.values(g.players)){if(!roster.has(p.clubId))roster.set(p.clubId,[]);roster.get(p.clubId).push(p);}
 const own=roster.get(g.clubId)||[],requirements={};
 for(const [role]of phasePositions(g.phaseTactics,'inPossession',g.formation||'4-3-3')||[])requirements[role]=(requirements[role]||0)+2;
 const gaps={};for(const [role,needed]of Object.entries(requirements))gaps[role]=Math.max(0,needed-own.filter(p=>matchesPosition(p,role)&&!p.injury&&!p.suspension&&!p.internationalDuty?.active).length);
 return {roster,own,gaps,weeklyWages:own.reduce((sum,p)=>sum+(Number(p.wage)||0),0),finance:financeReport(g,g.clubId)};
}
function candidateReport(g,p,brief,scout,q,context){
 const estimate=scoutingTransferEstimate(g,p,g.clubId,context.roster),{assessment,terms}=estimate;
 // Transfer terms use the same model as negotiations, but these are uncertain snapshots.
 const feeError=(1-q.qa)*.15+.06,feeLow=Math.max(0,Math.floor(estimate.fee*(1-feeError)/100)*100),feeHigh=Math.min(1e12,Math.ceil(estimate.fee*(1+feeError)/100)*100);
 if(feeHigh>brief.maxFee||terms.wage>brief.maxWage)return null;
 const natural=brief.position==='ANY'||naturalRoles(p).includes(brief.position)||(brief.position==='GK'&&p.position==='GK');
 const actualAbility=ability(p),potential=clamp(Number(p.potential)||actualAbility,actualAbility,100);
 const seed=`${g.date}:${scout.id}:${p.id}`, [abilityLow,abilityHigh]=interval(actualAbility,q.abilityRange,`${seed}:ability`),[potentialLow,potentialHigh]=interval(potential,q.potentialRange,`${seed}:potential`);
 const finance=assessTransferFinancials(g,p,g.clubId,estimate.fee,terms,context.finance),buyer=g.clubs[g.clubId],upfront=estimate.fee+terms.signingBonus+terms.agentFee;
 const lacksFunds=buyer.budget<upfront||buyer.cash<upfront||context.weeklyWages+terms.wage>(Number(buyer.wageBudget)||0);
 const refused=estimate.sellRefusal||assessment.sellerRefusal||assessment.playerRefusal;
 const feasibility=refused||lacksFunds||!finance.ok?'unlikely':assessment.difficulty==='difficult'||assessment.injuryWeeks>0?'difficult':'likely';
 const reasons=[];
 if(brief.position!=='ANY')reasons.push(natural?'Đúng vị trí sở trường HLV yêu cầu.':'Có thể chơi vị trí yêu cầu bằng vị trí phụ.');
 else if(naturalRoles(p).some(role=>context.gaps[role]>0))reasons.push('Bổ sung chiều sâu cho vị trí đội hình đang thiếu.');
 if(potential-actualAbility>=7)reasons.push('Còn dư địa phát triển theo đánh giá của tuyển trạch viên.');
 if(p.age<=21)reasons.push('Cầu thủ trẻ phù hợp để theo dõi dài hạn.');
 if(p.listed||p.dynamics?.wantsToLeave)reasons.push('Cầu thủ đang được rao bán hoặc muốn chuyển CLB.');
 if(assessment.injuryWeeks>0)reasons.push('Đang chấn thương; cần kiểm tra y tế trước khi đàm phán.');
 if(refused)reasons.push('CLB chủ quản hoặc cầu thủ hiện chưa sẵn sàng cho thương vụ.');
 if(lacksFunds)reasons.push('Tổng phí, thưởng ký hợp đồng hoặc quỹ lương hiện chưa đủ.');
 if(!finance.ok)reasons.push('Thương vụ có thể vượt giới hạn tài chính của CLB.');
 if(!reasons.length)reasons.push('Phù hợp tiêu chí tuổi, phí và lương trong yêu cầu.');
 const fit=Math.round(clamp((natural?80:68)+(potential-actualAbility)*.4+(feasibility==='likely'?10:feasibility==='difficult'?0:-15)-(assessment.injuryWeeks>0?8:0),1,100));
 return {playerId:p.id,clubId:p.clubId,abilityLow,abilityHigh,potentialLow,potentialHigh,confidence:q.confidence,fit,feeLow,feeHigh,wage:terms.wage,feasibility,reasons};
}
function candidates(g,brief,scout,weeks,context){
 const q=quality(g,scout,weeks),recentReports=g.scouting.reports.filter((r,i)=>i===0||r.date===g.date),recent=new Set(recentReports.flatMap(r=>r.candidates.map(c=>c.playerId))),ranked=[];
 for(const [clubId,players]of context.roster){
  if(clubId===g.clubId||!g.clubs[clubId])continue;
  for(const p of players){
   if(p.age>brief.maxAge||p.age<16||(Number(p.wage)||0)>brief.maxWage||(brief.position!=='ANY'&&!matchesPosition(p,brief.position)))continue;
   const ca=ability(p),pa=Math.max(ca,Number(p.potential)||ca),gap=naturalRoles(p).reduce((n,role)=>Math.max(n,context.gaps[role]||0),0);
   const uncertain=((hash(`${scout.id}:${p.id}:ranking`)%2001)/1000-1)*(1-(q.qa+q.qp)/2)*14;
   const naturalBonus=brief.kind==='position'&&naturalRoles(p).includes(brief.position)?8:0;
   const score=(brief.kind==='prospect'?pa*.7+ca*.2+(50-p.age)*.2:ca*.75+pa*.25)+naturalBonus+Math.min(3,gap)*3+(p.listed?2:0)+uncertain;
   ranked.push({p,score,recent:recent.has(p.id)});
  }
 }
 ranked.sort((a,b)=>Number(a.recent)-Number(b.recent)||b.score-a.score||a.p.id.localeCompare(b.p.id));
 const pool=[];
 // Evaluate a broader leading group so five unavailable stars do not hide
 // realistic alternatives. Finance and roster contexts are reused throughout.
 for(const row of ranked){const candidate=candidateReport(g,row.p,brief,scout,q,context);if(candidate)pool.push({...row,candidate});if(pool.length===60)break;}
 const feasible={likely:2,difficult:1,unlikely:0};
 pool.sort((a,b)=>Number(a.recent)-Number(b.recent)||feasible[b.candidate.feasibility]-feasible[a.candidate.feasibility]||b.score-a.score||a.p.id.localeCompare(b.p.id));
 return pool.slice(0,MAX_CANDIDATES).map(row=>row.candidate);
}
function publish(g,brief,scout,weeks,context,assignmentId=null){
 const selected=candidates(g,brief,scout,weeks,context),position=brief.position==='ANY'?'mọi vị trí':positionCode(brief.position);
 const title=brief.kind==='prospect'?'Báo cáo tìm kiếm tài năng trẻ':'Báo cáo tuyển trạch theo yêu cầu';
 const body=selected.length?`Đã tìm thấy ${selected.length} cầu thủ phù hợp tiêu chí tuyển trạch.`:'Chưa tìm thấy cầu thủ đáp ứng đầy đủ tiêu chí tuyển trạch.';
 const sender=`${scout.name} · ${STAFF_ROLES[scout.role].label}`;
 const paragraphs=[`Kính gửi HLV ${g.manager},`,body,`Phạm vi khảo sát: ${position}; tối đa ${brief.maxAge} tuổi, phí chuyển nhượng ${money(brief.maxFee)}, lương dự kiến ${money(brief.maxWage)}/tuần.`,`Thời gian theo dõi: ${weeks} tuần. Độ tin cậy chịu ảnh hưởng bởi chuyên môn và khối lượng công việc của nhân sự.`,...selected.flatMap(c=>{const p=g.players[c.playerId];return [`${p.name} · ${g.clubs[c.clubId].name} · ${p.age} tuổi · ${positionLabel(p)}.`,`Năng lực ${c.abilityLow}–${c.abilityHigh}/100; tiềm năng ${c.potentialLow}–${c.potentialHigh}/100; độ tin cậy ${c.confidence}%.`,`Phí dự kiến ${money(c.feeLow)}–${money(c.feeHigh)}; lương dự kiến ${money(c.wage)}/tuần.`,...c.reasons];}),selected.length?'Đây là đánh giá mô phỏng tại ngày lập báo cáo. Phí chuyển nhượng và lương còn phụ thuộc đàm phán; phí đại diện và thưởng ký hợp đồng có thể làm tăng tổng chi phí.':'Có thể tăng ngân sách, mở rộng độ tuổi hoặc thay đổi vị trí rồi giao một nhiệm vụ mới.','Chưa có cầu thủ nào được mua hoặc tự động thêm vào danh sách theo dõi. Hãy xem hồ sơ và quyết định bước tiếp theo tại trung tâm tuyển trạch.','Trân trọng,',sender];
 const message=makeMessage(g,title,body,'scouting',{sender,paragraphs,playerIds:selected.map(c=>c.playerId),action:{page:'scouting',label:'Mở trung tâm tuyển trạch'}});
 g.messages??=[];g.messages.unshift(message);g.messages=g.messages.slice(0,250);
 const report={id:`scout-report-${++g.scouting.sequence}`,assignmentId,scoutId:scout.id,date:g.date,kind:brief.kind,position:brief.position,candidates:selected,messageId:message.id};
 g.scouting.reports.unshift(report);prune(g.scouting);return report;
}
/** Assignment deadlines use their own start dates, not the passive report's weekly clock. */
export function runScoutingWeek(g){
 if(!g.scouting||g.liveMatch)return [];
 const state=g.scouting,active=state.assignments.filter(a=>a.status==='active'),reports=[];
 const available=new Map(scoutingStaff(g).map(s=>[s.id,s]));let context;
 for(const a of active){
  const scout=available.get(a.scoutId);
  if(!scout){a.status='cancelled';a.completedDate=g.date;continue;}
  a.progressWeeks=clamp(Math.floor(days(g.date,a.createdDate)/7),0,a.durationWeeks);
  if(a.progressWeeks<a.durationWeeks)continue;
  context??=rosterContext(g);reports.push(publish(g,a,scout,a.durationWeeks,context,a.id));a.status='completed';a.completedDate=g.date;
 }
 const passiveDue=state.lastRunDate===null||days(g.date,state.lastRunDate)>=7;
 if(passiveDue){
  state.lastRunDate=g.date;
  const scout=assignedStaff(g,'scouting');
  // An assignment report replaces the routine letter for this period.
  if(!active.length&&scout&&available.has(scout.id)){
   context??=rosterContext(g);const club=g.clubs[g.clubId];
   const brief={kind:'prospect',position:'ANY',maxAge:23,maxFee:clamp(Number(club.budget)||0,0,1e12),maxWage:clamp((Number(club.wageBudget)||0)-context.weeklyWages,0,1e8)};
   reports.push(publish(g,brief,scout,1,context));
  }
 }
 if(reports.length)state.lastRunDate=g.date;
 prune(state);return reports;
}

/** Legacy careers may omit this subsystem; once present it is strictly checked. */
export function validateScouting(g){
 if(g.scouting===undefined)return true;
 const fail=()=>{throw Error('Dữ liệu tuyển trạch không hợp lệ.');},s=g.scouting;
 const id=(v,prefix)=>typeof v==='string'&&new RegExp(`^${prefix}-[1-9][0-9]*$`).test(v)&&Number.isSafeInteger(Number(v.slice(prefix.length+1)))&&Number(v.slice(prefix.length+1))<=s.sequence;
 const staffId=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,160}$/.test(v);
 if(!s||s.version!==1||!Number.isSafeInteger(s.sequence)||s.sequence<0||!Array.isArray(s.assignments)||s.assignments.length>MAX_ASSIGNMENTS||!Array.isArray(s.reports)||s.reports.length>MAX_REPORTS||(s.lastRunDate!==null&&(!date(s.lastRunDate)||s.lastRunDate>g.date)))fail();
 const used=new Set(),activeScouts=new Set();
 for(const a of s.assignments){
  if(!a||!validBrief(a)||!id(a.id,'scout-assignment')||used.has(a.id)||!staffId(a.scoutId)||!['active','completed','cancelled'].includes(a.status)||!date(a.createdDate)||a.createdDate>g.date||!Number.isInteger(a.progressWeeks)||a.progressWeeks<0||a.progressWeeks>a.durationWeeks||a.progressWeeks>Math.floor(days(g.date,a.createdDate)/7))fail();
  used.add(a.id);
  if(a.status==='active'){
   const member=g.staff?.[a.scoutId];
   if(a.completedDate!==null||a.progressWeeks===a.durationWeeks||activeScouts.has(a.scoutId)||(member&&(member.clubId!==g.clubId||!ROLES.has(member.role))))fail();
   activeScouts.add(a.scoutId);
  }else if(!date(a.completedDate)||a.completedDate<a.createdDate||a.completedDate>g.date||(a.status==='completed'&&(a.progressWeeks!==a.durationWeeks||days(a.completedDate,a.createdDate)<a.durationWeeks*7)))fail();
 }
 if(activeScouts.size>3)fail();
 const reportedAssignments=new Set();
 for(const r of s.reports){
  if(!r||!id(r.id,'scout-report')||used.has(r.id)||(r.assignmentId!==null&&!id(r.assignmentId,'scout-assignment'))||!staffId(r.scoutId)||!date(r.date)||r.date>g.date||!['prospect','position'].includes(r.kind)||!(Object.hasOwn(POSITION_DETAIL,r.position)||(r.kind==='prospect'&&r.position==='ANY'))||typeof r.messageId!=='string'||r.messageId.length>200||!r.messageId||!Array.isArray(r.candidates)||r.candidates.length>MAX_CANDIDATES)fail();
  used.add(r.id);const players=new Set();
  const assignment=r.assignmentId&&s.assignments.find(a=>a.id===r.assignmentId);
  if(r.assignmentId&&(!assignment||reportedAssignments.has(r.assignmentId)||assignment.status!=='completed'||assignment.scoutId!==r.scoutId||assignment.kind!==r.kind||assignment.position!==r.position||assignment.completedDate!==r.date))fail();
  if(r.assignmentId)reportedAssignments.add(r.assignmentId);
  for(const c of r.candidates){
   if(!c||typeof c.playerId!=='string'||!Object.hasOwn(g.players,c.playerId)||typeof c.clubId!=='string'||!Object.hasOwn(g.clubs,c.clubId)||c.clubId===g.clubId||players.has(c.playerId)||!['abilityLow','abilityHigh','potentialLow','potentialHigh'].every(k=>Number.isInteger(c[k])&&c[k]>=1&&c[k]<=100)||c.abilityLow>c.abilityHigh||c.potentialLow>c.potentialHigh||!['confidence','fit'].every(k=>Number.isInteger(c[k])&&c[k]>=0&&c[k]<=100)||!safeNumber(c.feeLow,1e12)||!safeNumber(c.feeHigh,1e12)||c.feeLow>c.feeHigh||!safeNumber(c.wage,1e8)||!['likely','difficult','unlikely'].includes(c.feasibility)||!Array.isArray(c.reasons)||!c.reasons.length||c.reasons.length>12||c.reasons.some(v=>typeof v!=='string'||!v.length||v.length>500))fail();
   players.add(c.playerId);
  }
 }
 return true;
}
