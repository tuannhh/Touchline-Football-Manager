import {dailyCareer} from './careerClock.mjs';
import {makeMessage} from './mail.mjs';
import {OFFICIAL_STAFF} from './staff-official.mjs';

export const STAFF_SKILLS={coaching:'Huấn luyện',tactical:'Chiến thuật',goalkeeping:'Huấn luyện thủ môn',fitness:'Thể lực',medical:'Y học thể thao',sportsScience:'Khoa học thể thao',youth:'Đào tạo trẻ',judgingAbility:'Đánh giá năng lực',judgingPotential:'Đánh giá tiềm năng',negotiating:'Đàm phán',communication:'Giao tiếp',motivation:'Động viên'};
export const STAFF_ROLES={
 assistant:{label:'Trợ lý HLV trưởng',department:'Huấn luyện',skills:['tactical','coaching','communication','motivation']},
 sportingDirector:{label:'Giám đốc thể thao',department:'Điều hành bóng đá',skills:['negotiating','judgingAbility','communication']},
 youthDirector:{label:'Giám đốc đào tạo trẻ',department:'Học viện',skills:['youth','judgingPotential','coaching']},
 headDoctor:{label:'Bác sỹ trưởng',department:'Y tế & thể lực',skills:['medical','communication','sportsScience']},
 goalkeepingCoach:{label:'HLV thủ môn',department:'Huấn luyện',skills:['goalkeeping','coaching','motivation']},
 coach:{label:'HLV chung',department:'Huấn luyện',skills:['coaching','tactical','motivation']},
 doctor:{label:'Bác sỹ',department:'Y tế & thể lực',skills:['medical','sportsScience']},
 fitnessCoach:{label:'HLV thể lực',department:'Y tế & thể lực',skills:['fitness','sportsScience','motivation']},
 sportsScientist:{label:'Chuyên gia khoa học thể thao',department:'Y tế & thể lực',skills:['sportsScience','fitness','medical']},
 scout:{label:'Tuyển trạch viên',department:'Tuyển trạch',skills:['judgingAbility','judgingPotential','communication']},
};
export const STAFF_TASKS={
 training:{label:'Huấn luyện đội một',description:'Phụ trách chuyên môn tập luyện; chất lượng và khối lượng công việc ảnh hưởng tốc độ phát triển kỹ năng.',roles:['coach','assistant','youthDirector'],skills:['coaching','motivation']},
 goalkeeping:{label:'Huấn luyện thủ môn',description:'Tổ chức các bài tập chuyên biệt cho thủ môn.',roles:['goalkeepingCoach','coach','assistant'],skills:['goalkeeping','coaching']},
 fitness:{label:'Huấn luyện thể lực',description:'Phụ trách nhóm bài tập thể lực và sức bền.',roles:['fitnessCoach','sportsScientist','coach','assistant'],skills:['fitness','sportsScience']},
 medical:{label:'Điều trị chấn thương',description:'Giám sát điều trị; có thể rút ngắn chấn thương còn từ hai tuần trở lên.',roles:['headDoctor','doctor'],skills:['medical','sportsScience']},
 recovery:{label:'Hồi phục & tải vận động',description:'Theo dõi tải vận động, tăng lượng thể lực hồi phục giữa các tuần.',roles:['sportsScientist','fitnessCoach','headDoctor','doctor'],skills:['sportsScience','fitness']},
 youth:{label:'Phát triển cầu thủ trẻ',description:'Theo dõi tài năng trẻ và hỗ trợ phát triển cầu thủ dưới 22 tuổi.',roles:['youthDirector','coach','assistant'],skills:['youth','judgingPotential','coaching']},
 scouting:{label:'Báo cáo tuyển trạch',description:'Gửi gợi ý cầu thủ hằng tuần; quyết định mua và ngân sách vẫn do bạn kiểm soát.',roles:['scout','sportingDirector','assistant'],skills:['judgingAbility','judgingPotential']},
 transfers:{label:'Đàm phán chuyển nhượng',description:'Hỗ trợ thương lượng giá khi bạn xác nhận mua cầu thủ; không tự thực hiện giao dịch.',roles:['sportingDirector','scout','assistant'],skills:['negotiating','communication']},
 friendlies:{label:'Dẫn dắt trận giao hữu',description:'Người được giao tự chọn đội hình và điều hành trận giao hữu khi bạn yêu cầu mô phỏng.',roles:['assistant','coach'],skills:['tactical','coaching','motivation']},
 press:{label:'Trả lời báo chí',description:'Đại diện CLB trả lời họp báo sau trận; cách giao tiếp ảnh hưởng nhẹ đến tinh thần đội.',roles:['assistant','sportingDirector','coach'],skills:['communication','motivation']},
};
export const PRESS_TONES={balanced:'Cân bằng',encourage:'Động viên',demanding:'Yêu cầu cao'};
const ROLE_KEYS=Object.keys(STAFF_ROLES),SKILL_KEYS=Object.keys(STAFF_SKILLS),TASK_KEYS=Object.keys(STAFF_TASKS);
const DEFAULT_ROLES={training:'coach',goalkeeping:'goalkeepingCoach',fitness:'fitnessCoach',medical:'headDoctor',recovery:'sportsScientist',youth:'youthDirector',scouting:'scout',transfers:'sportingDirector'};
const clamp=(n,lo,hi)=>Math.min(hi,Math.max(lo,n));
function hash(text){let h=2166136261;for(const c of String(text)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function generator(seed){let n=hash(seed);return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
const normalized=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const names={
 eng:[['Adrian','Nathan','Oliver','Matthew','Elliot','Daniel','Callum','Toby'],['Whitmore','Ellison','Hartwell','Bennett','Langley','Ainsworth','Kendall','Ashford']],
 ger:[['Lukas','Felix','Jonas','Leon','Markus','Daniel','Jan','Niklas'],['Bergmann','Lindner','Hartwig','Seidel','Waldner','Falk','Albrecht','Sommer']],
 fra:[['Julien','Mathieu','Antoine','Laurent','Émile','Romain','Hugo','Bastien'],['Morel','Delorme','Lenoir','Renaud','Perrin','Marchand','Fabre','Garnier']],
 ita:[['Marco','Luca','Andrea','Fabio','Matteo','Alessio','Paolo','Davide'],['Bellarini','Venturi','Mariani','Fontana','Lombardi','Rinaldi','Moretti','Sereni']],
 esp:[['Javier','Álvaro','Diego','Sergio','Pablo','Rubén','Adrián','Héctor'],['Valverde','Serrano','Molina','Navarro','Soler','Fuentes','Carrasco','Vidal']],
 por:[['Tiago','Nuno','Bruno','Duarte','Gonçalo','Rui','Miguel','Vasco'],['Figueira','Andrade','Matos','Carvalho','Lopes','Teixeira','Cardoso','Pires']],
 ned:[['Daan','Bram','Jeroen','Lars','Niels','Jasper','Wouter','Sander'],['van Dalen','Vermeer','Koster','de Bruin','van Loon','Bosman','Veldman','de Wit']],
 vie:[['Nguyễn Minh','Trần Quốc','Lê Hoàng','Phạm Đức','Vũ Thành','Đặng Tuấn','Đỗ Việt','Bùi Thanh'],['Hải','Nam','Phong','Dũng','Sơn','Hưng','Quân','Long']],
};
const memberCache=new WeakMap();
function indexStaff(g){if(!g.staff)return new Map();let index=memberCache.get(g.staff);if(!index){index=new Map();for(const s of Object.values(g.staff)){if(!index.has(s.clubId))index.set(s.clubId,[]);index.get(s.clubId).push(s);}for(const xs of index.values())xs.sort((a,b)=>ROLE_KEYS.indexOf(a.role)-ROLE_KEYS.indexOf(b.role)||a.name.localeCompare(b.name));memberCache.set(g.staff,index);}return index;}
/** Club index is tied to the staff object; callers changing personnel must invalidate it. */
export function invalidateStaff(g){if(g.staff)memberCache.delete(g.staff);}
export function staffMembers(g,clubId=g.clubId){return [...(indexStaff(g).get(clubId)||[])];}
export function eligibleStaff(g,task,clubId=g.clubId){return STAFF_TASKS[task]?staffMembers(g,clubId).filter(s=>STAFF_TASKS[task].roles.includes(s.role)):[];}
export function assignedStaff(g,task,clubId=g.clubId){const id=g.staffAssignments?.[clubId]?.[task],s=g.staff?.[id];return s?.clubId===clubId&&STAFF_TASKS[task]?.roles.includes(s.role)?s:null;}

function createMember(club,role,official){
 const seed=`staff:${club.id}:${role}:${official?.name||'generated'}`,rand=generator(seed),pool=names[String(club.leagueId).split('.')[0]]||names.eng;
 const name=official?.name||`${pool[0][Math.floor(rand()*pool[0].length)]} ${pool[1][Math.floor(rand()*pool[1].length)]}`;
 const base=clamp((Number(club.reputation)||60)/6-1,5,15),attributes={};
 for(const skill of SKILL_KEYS)attributes[skill]=clamp(Math.round(base+(rand()-.5)*6+(STAFF_ROLES[role].skills.includes(skill)?3:-3)),1,20);
 const wage=Math.max(100,Math.round((Number(club.reputation)||60)**2*(role==='sportingDirector'?1.35:role==='assistant'?1.05:.65)*(String(club.leagueId).startsWith('vie.')?.12:1)/50)*50);
 return {id:`staff-${club.id}-${role}-${official?hash(normalized(name)).toString(36):'generated'}`,clubId:club.id,name,role,attributes,wage,sourceKind:official?'official':'simulated',attributesEstimated:true,...(official?{sourceUrl:official.sourceUrl,sourceLabel:official.sourceLabel,checkedAt:official.checkedAt,...(official.sourceRole?{sourceRole:official.sourceRole}:{})}:{sourceLabel:'Nhân sự giả lập cho sự nghiệp này'})};
}

/** Adds deterministic staffing without consuming match RNG or changing existing personnel/gameplay. */
export function initializeStaff(g){
 g.staff??={};g.staffAssignments??={};g.friendlies??=[];g.staffReports??=[];g.pressHistory??=[];g.pressTone??='balanced';
 const existing=new Map();for(const s of Object.values(g.staff)){if(!existing.has(s.clubId))existing.set(s.clubId,[]);existing.get(s.clubId).push(s);}
 const source=new Map();for(const row of OFFICIAL_STAFF){if(!g.clubs[row.clubId]||!STAFF_ROLES[row.role])continue;if(!source.has(row.clubId))source.set(row.clubId,[]);source.get(row.clubId).push(row);}
 for(const club of Object.values(g.clubs)){
  const own=existing.get(club.id)||[];
  // A populated career keeps its personnel. Official names are used when a club is first seeded.
  if(!own.length)for(const official of source.get(club.id)||[]){if(own.some(s=>normalized(s.name)===normalized(official.name)))continue;const s=createMember(club,official.role,official);g.staff[s.id]=s;own.push(s);}
  for(const role of ROLE_KEYS)if(!own.some(s=>s.role===role)){const s=createMember(club,role);g.staff[s.id]=s;own.push(s);}
  g.staffAssignments[club.id]??={};
  for(const task of TASK_KEYS)if(g.staffAssignments[club.id][task]===undefined){const role=DEFAULT_ROLES[task];g.staffAssignments[club.id][task]=role?(own.find(s=>s.role===role)?.id||'manager'):'manager';}
 }
 g.staffVersion=1;invalidateStaff(g);return g;
}

/** No automatic spending or simulation happens when a responsibility changes. */
export function assignStaffTask(g,task,id,clubId=g.clubId){
 if(clubId!==g.clubId||!g.clubs[clubId])throw Error('Chỉ có thể phân công ban huấn luyện của CLB bạn đang dẫn dắt.');
 if(g.liveMatch)throw Error('Hãy kết thúc trận đấu trước khi thay đổi phân công.');
 if(!STAFF_TASKS[task]||typeof id!=='string')throw Error('Nhiệm vụ không hợp lệ.');
 if(id!=='manager'&&!eligibleStaff(g,task,clubId).some(s=>s.id===id))throw Error('Nhân sự không thuộc CLB hoặc không có chuyên môn phù hợp.');
 g.staffAssignments??={};g.staffAssignments[clubId]??={};g.staffAssignments[clubId][task]=id;return assignedStaff(g,task,clubId);
}
export function workload(g,id){const s=g.staff?.[id],tasks=s?TASK_KEYS.filter(task=>g.staffAssignments?.[s.clubId]?.[task]===id):[],count=tasks.length,capacity=3;return {count,capacity,tasks,overloaded:count>capacity,penalty:Math.min(.45,Math.max(0,count-capacity)*.15)};}
export function staffTaskQuality(g,task,clubId=g.clubId){const s=assignedStaff(g,task,clubId),skills=STAFF_TASKS[task]?.skills;if(!s||!skills)return .5;return clamp(skills.reduce((sum,key)=>sum+(s.attributes[key]||1),0)/skills.length/20*(1-workload(g,s.id).penalty),0,1);}
export function staffEffects(g,clubId=g.clubId){const quality=task=>staffTaskQuality(g,task,clubId),present=task=>!!assignedStaff(g,task,clubId);return {trainingMultiplier:.8+.4*quality('training'),goalkeepingMultiplier:.8+.4*quality('goalkeeping'),fitnessMultiplier:.8+.4*quality('fitness'),youthMultiplier:.8+.4*quality('youth'),recoveryBonus:present('recovery')?Math.round(3*quality('recovery')):0,medicalRecoveryChance:present('medical')?.15*quality('medical'):0,scoutingQuality:quality('scouting'),transferDiscount:present('transfers')?.06*quality('transfers'):0};}
export function staffWeeklyWages(g,clubId=g.clubId){return staffMembers(g,clubId).reduce((sum,s)=>sum+s.wage,0);}

/** Full text is stored in the inbox; reports retain player links for the staff page. */
export function sendStaffReport(g,title,body,type='news',staff=null,paragraphs){
 const sender=staff?`${staff.name} · ${STAFF_ROLES[staff.role].label}`:`${g.manager} · HLV trưởng`;
 const m=makeMessage(g,title,body,type,{sender,paragraphs:paragraphs||[`Kính gửi HLV ${g.manager},`,body,'Trân trọng,',sender],action:{page:'staff',label:'Xem ban huấn luyện'}});
 g.messages??=[];g.messages.unshift(m);g.messages=g.messages.slice(0,250);return m;
}
const averageAbility=p=>{const xs=Object.values(p.attributes||{});return xs.length?xs.reduce((s,n)=>s+n,0)/xs.length*5:50;};
const weekKey=g=>`${g.clubId}-${Math.floor(Date.parse(`${g.date}T12:00:00Z`)/(7*86400000))}`;
function addReport(g,{title,body,type,staff,players=[],paragraphs,week}){const m=sendStaffReport(g,title,body,type,staff,paragraphs);const report={id:`staff-report-${m.id}`,date:g.date,weekKey:week||weekKey(g),type,title,body,staffId:staff?.id||'manager',playerIds:players.map(p=>p.id),messageId:m.id};g.staffReports.unshift(report);g.staffReports=g.staffReports.slice(0,120);return report;}
/** Weekly advice only. Does not buy, shortlist, heal, train, or consume gameplay RNG. */
export function runStaffWeek(g){
 if(!g.staff)return [];const week=weekKey(g);if(g.staffReports.some(r=>r.weekKey===week&&r.type!=='press'))return [];
 const own=Object.values(g.players).filter(p=>p.clubId===g.clubId),reports=[],club=g.clubs[g.clubId];
 const scout=assignedStaff(g,'scouting');if(scout&&!g.scouting){const q=staffTaskQuality(g,'scouting'),range=Math.round(12-q*8),budget=Math.max(club.budget||0,100000),candidates=Object.values(g.players).filter(p=>p.clubId!==g.clubId&&g.clubs[p.clubId]&&p.value<=budget*1.5).sort((a,b)=>(averageAbility(b)+(b.age<23?8:0))-(averageAbility(a)+(a.age<23?8:0))||a.id.localeCompare(b.id)).slice(0,24);const picks=candidates.sort((a,b)=>hash(`${week}:${a.id}`)-hash(`${week}:${b.id}`)).slice(0,3);const lines=picks.map(p=>`${p.name} (${g.clubs[p.clubId].name}, ${p.age} tuổi, ${p.position}) · năng lực ước lượng ${Math.max(1,Math.round(averageAbility(p))-range)}–${Math.min(100,Math.round(averageAbility(p))+range)}/100 · giá trị tham khảo ${Number(p.value).toLocaleString('vi-VN')} €.`);const body=picks.length?`Tôi đề xuất theo dõi ${picks.map(p=>p.name).join(', ')}. Chất lượng đánh giá hiện tại ${Math.round(q*100)}%.`:'Chưa tìm thấy mục tiêu phù hợp với ngân sách trong lượt khảo sát này.';reports.push(addReport(g,{title:'Báo cáo tuyển trạch tuần',body,type:'scouting',staff:scout,players:picks,week,paragraphs:[`Kính gửi HLV ${g.manager},`,body,...lines,'Đây là báo cáo mô phỏng, các khoảng đánh giá có sai số. Giá trị tham khảo không phải giá chào bán; hãy xem hồ sơ trước khi quyết định. Tôi chưa tự thêm cầu thủ vào danh sách theo dõi hoặc thực hiện giao dịch.','Trân trọng,',`${scout.name} · ${STAFF_ROLES[scout.role].label}`]}));}
 const doctor=assignedStaff(g,'medical');if(doctor){const affected=own.filter(p=>p.injury>0||p.fitness<75).sort((a,b)=>b.injury-a.injury||a.fitness-b.fitness),body=affected.length?`${affected.length} cầu thủ cần theo dõi y tế hoặc giảm tải trong tuần này.`:'Toàn đội hiện không có ca chấn thương và không có cầu thủ nào dưới 75% thể lực.';reports.push(addReport(g,{title:'Báo cáo sức khỏe đội một',body,type:'medical',staff:doctor,players:affected,week,paragraphs:[`Kính gửi HLV ${g.manager},`,body,...affected.map(p=>`${p.name}: ${p.injury>0?`còn khoảng ${p.injury} tuần điều trị`:'không chấn thương'}, thể lực ${Math.round(p.fitness)}%.`),'Đề nghị xoay vòng cầu thủ thiếu thể lực. Hồi phục và điều trị được cập nhật khi lịch thi đấu tiến sang tuần mới; phân công nhân sự không lập tức xóa chấn thương.','Trân trọng,',`${doctor.name} · ${STAFF_ROLES[doctor.role].label}`]}));}
 const youth=assignedStaff(g,'youth');if(youth){const young=own.filter(p=>p.age<22).sort((a,b)=>b.potential-a.potential||a.age-b.age).slice(0,3),body=young.length?`Nhóm cần chú ý: ${young.map(p=>p.name).join(', ')}.`:'Đội một hiện không có cầu thủ dưới 22 tuổi để theo dõi trong báo cáo này.';reports.push(addReport(g,{title:'Báo cáo phát triển cầu thủ trẻ',body,type:'youth',staff:youth,players:young,week,paragraphs:[`Kính gửi HLV ${g.manager},`,body,...young.map(p=>`${p.name}, ${p.age} tuổi: tiềm năng mô phỏng ${p.potential}/100, thể lực ${Math.round(p.fitness)}%. ${p.injury?'Ưu tiên hồi phục chấn thương.':'Nên bố trí thời gian thi đấu phù hợp và duy trì bài tập chuyên môn.'}`),'Bộ phận đào tạo trẻ hỗ trợ hiệu quả tập luyện của cầu thủ dưới 22 tuổi. Tiềm năng là chỉ số mô phỏng, không phải dự báo chắc chắn về cầu thủ thật.','Trân trọng,',`${youth.name} · ${STAFF_ROLES[youth.role].label}`]}));}
 return reports;
}

/** One press conference per completed fixture, including friendlies, with bounded morale effects. */
export function handlePress(g,{fixture,result,tone=g.pressTone||'balanced'}={}){
 if(!PRESS_TONES[tone])throw Error('Thái độ họp báo không hợp lệ.');
 if(!fixture?.id)throw Error('Chưa có trận đấu để họp báo.');
 const actual=[...(g.fixtures||[]),...(g.friendlies||[])].find(f=>f.id===fixture.id);
 if(!actual||actual.cancelled||![actual.home,actual.away].includes(g.clubId)||!actual.result)throw Error('Chỉ có thể họp báo sau trận đấu của CLB.');
 const previous=g.pressHistory.find(p=>p.fixtureId===actual.id);if(previous||actual.pressHandled)return previous||null;
 const score=actual.result?.score||result?.score;if(!Array.isArray(score)||score.length!==2||score.some(n=>!Number.isInteger(n)||n<0||n>100))throw Error('Kết quả họp báo không hợp lệ.');
 const staff=assignedStaff(g,'press'),speaker=staff?.name||g.manager,side=actual.home===g.clubId?0:1,difference=score[side]-score[1-side],opponent=g.clubs[side===0?actual.away:actual.home],quality=staffTaskQuality(g,'press');
 const moraleChange=tone==='encourage'?(difference<0&&quality>=.5?2:1):tone==='demanding'?(difference<0?-1:0):(difference>=0?1:0);
 const opening=tone==='encourage'?'Tôi tin tưởng các cầu thủ. Chúng tôi ghi nhận nỗ lực và sẽ cùng nhau cải thiện.':tone==='demanding'?'Tiêu chuẩn của CLB luôn cao. Chúng tôi cần tập trung và làm tốt hơn ở từng tình huống.':'Chúng tôi đánh giá cả kết quả lẫn cách thi đấu, giữ bình tĩnh và tập trung vào việc chuẩn bị trận tiếp theo.';
 const squad=Object.values(g.players).filter(p=>p.clubId===g.clubId);for(const p of squad)p.morale=clamp(p.morale+moraleChange,20,100);
 const body=`${speaker} đại diện CLB sau trận gặp ${opponent.name} (${score[side]}–${score[1-side]}). Tinh thần toàn đội ${moraleChange>0?'+':''}${moraleChange}.`;
 const paragraphs=[`Biên bản họp báo · ${g.clubs[g.clubId].name} – ${opponent.name}`,`Người trả lời: ${speaker} · ${staff?STAFF_ROLES[staff.role].label:'HLV trưởng'}.`,`Phóng viên: Ông đánh giá thế nào về trận đấu?`,`${speaker}: ${opening}`,`Phóng viên: Đội bóng sẽ chuẩn bị gì tiếp theo?`,`${speaker}: Chúng tôi sẽ rà soát thể lực, xem lại các tình huống quan trọng và điều chỉnh bài tập. Mỗi cầu thủ cần sẵn sàng khi được trao cơ hội.`,`Phóng viên: Ông có thông báo nào về chuyển nhượng hoặc đội hình không?`,`${speaker}: Các quyết định chuyên môn và chuyển nhượng sẽ được HLV trưởng cùng CLB xem xét. Hôm nay chúng tôi tập trung vào trận đấu.`,`Tác động trong game: tinh thần mỗi cầu thủ ${moraleChange>0?'+':''}${moraleChange}, giới hạn trong khoảng 20–100. Nội dung họp báo do game mô phỏng.`];
 const report=addReport(g,{title:`Họp báo: ${speaker} trả lời truyền thông`,body,type:'press',staff,paragraphs}),record={fixtureId:actual.id,date:g.date,staffId:staff?.id||'manager',tone,moraleChange,messageId:report.messageId};
 g.pressHistory.unshift(record);g.pressHistory=g.pressHistory.slice(0,500);actual.pressHandled=true;return record;
}

/** Optional on legacy saves; strict once staffVersion is present. */
export function validateStaff(g){
 const fail=()=>{throw Error('Dữ liệu ban huấn luyện hoặc giao hữu không hợp lệ.');};
 if(g.staff===undefined&&g.staffVersion===undefined)return true;
 if(g.staffVersion!==1||!g.staff||typeof g.staff!=='object'||Array.isArray(g.staff)||!g.staffAssignments||typeof g.staffAssignments!=='object'||Array.isArray(g.staffAssignments))fail();
 const members=Object.entries(g.staff);if(members.length>30000)fail();
 for(const [id,s]of members){if(!s||s.id!==id||!/^[a-zA-Z0-9_-]{1,160}$/.test(id)||!g.clubs[s.clubId]||!STAFF_ROLES[s.role]||typeof s.name!=='string'||!s.name.trim()||s.name.length>160||!Number.isInteger(s.wage)||s.wage<0||s.wage>10000000||!['official','simulated'].includes(s.sourceKind)||!s.attributes||SKILL_KEYS.some(k=>!Number.isInteger(s.attributes[k])||s.attributes[k]<1||s.attributes[k]>20))fail();if(s.sourceKind==='official'&&(typeof s.sourceUrl!=='string'||!/^https:\/\//.test(s.sourceUrl)||typeof s.sourceLabel!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s.checkedAt)))fail();}
 for(const [clubId,tasks]of Object.entries(g.staffAssignments)){if(!g.clubs[clubId]||!tasks||typeof tasks!=='object'||Array.isArray(tasks))fail();for(const [task,id]of Object.entries(tasks)){const s=g.staff[id];if(!STAFF_TASKS[task]||(id!=='manager'&&(!s||s.clubId!==clubId||!STAFF_TASKS[task].roles.includes(s.role))))fail();}}
 for(const clubId of Object.keys(g.clubs))if(!g.staffAssignments[clubId]||TASK_KEYS.some(task=>g.staffAssignments[clubId][task]===undefined))fail();
 if(!PRESS_TONES[g.pressTone])fail();
 for(const [key,max]of [['friendlies',500],['staffReports',120],['pressHistory',500]])if(!Array.isArray(g[key])||g[key].length>max)fail();
 const fixtureIds=new Set((g.fixtures||[]).map(f=>f.id));for(const f of g.friendlies){if(!f||typeof f.id!=='string'||f.id.length>160||fixtureIds.has(f.id)||!g.clubs[f.home]||!g.clubs[f.away]||f.home===f.away||![f.home,f.away].includes(g.clubId)||f.leagueId!=='friendly'||f.stage!=='friendly'||!Number.isInteger(f.year)||f.year<1900||f.year>9999||!Number.isInteger(f.round)||f.round<0||f.round>400||!/^\d{4}-\d{2}-\d{2}$/.test(f.date)||!Number.isFinite(Date.parse(f.date))||(f.cancelled!==undefined&&typeof f.cancelled!=='boolean')||(f.cancelled&&f.result))fail();fixtureIds.add(f.id);if(f.result&&(!Array.isArray(f.result.score)||f.result.score.length!==2||f.result.score.some(n=>!Number.isInteger(n)||n<0||n>100)||!Array.isArray(f.result.events)))fail();}
 if(g.liveMatch?.friendly){const f=g.friendlies.find(f=>f.id===g.liveMatch.fixtureId);if(!f||f.cancelled||f.result||(dailyCareer(g)?f.date!==g.date:f.year!==g.year||f.round!==g.round)||f.home!==g.liveMatch.home||f.away!==g.liveMatch.away)fail();}
 for(const r of g.staffReports)if(!r||typeof r.id!=='string'||typeof r.title!=='string'||typeof r.body!=='string'||!Array.isArray(r.playerIds)||r.playerIds.length>1000||r.playerIds.some(id=>!g.players[id])||(r.staffId!=='manager'&&g.staff[r.staffId]?.clubId!==g.clubId)||typeof r.messageId!=='string')fail();
 const conferences=new Set();for(const h of g.pressHistory){if(!h||typeof h.fixtureId!=='string'||conferences.has(h.fixtureId)||!PRESS_TONES[h.tone]||!Number.isInteger(h.moraleChange)||Math.abs(h.moraleChange)>2||(h.staffId!=='manager'&&g.staff[h.staffId]?.clubId!==g.clubId)||typeof h.messageId!=='string')fail();conferences.add(h.fixtureId);}
 return true;
}
