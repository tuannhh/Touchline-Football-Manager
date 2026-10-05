import {isoCountry} from './locale.mjs';
import {verifiedTrainingStatus,officialUefaRegistration,trainingAssociationFor} from './homegrown.mjs';
import {competitionSuspension} from './discipline.mjs';
export const RULE_SOURCES={
 UEFA:'https://documents.uefa.com/r/Regulations-of-the-UEFA-Champions-League-2026/27/Article-31-Player-lists-Online',
 EN:'https://www.premierleague.com/en/news/4706139/see-all-the-202627-premier-league-squad-lists',
 EFL:'https://www.efl.com/governance/regulations/',
 DE:'https://media.dfl.de/sites/2/2026/04/Lizenzordnung-Spieler-LOS-2026-04-21-Stand.pdf',
 IT:'https://files.figc.it/version/c%3AZmQ5Yzc3MGItNDE1Ni00%3AYzdmYmQ0YjItMDY4MS00/245%20-%20Modifica%20disposizioni%20in%20materia%20di%20Tetto%20alle%20Rose.pdf',
 PT:'https://www.ligaportugal.pt/backoffice/assets/20260701_RC_2026_27_f53785bcd4.pdf',
 ES:'https://rfef.es/es/federacion/normativas-y-circulares',
 FR:'https://www.lfp.fr/statuts-reglements',
 NL:'https://www.knvb.nl/assist-bestuurders/regelgeving/reglementen',
 VN:'https://vpf.vn/tin-tuc/tin-vleague/thong-cao-bao-chi-le-boc-tham-xep-lich-thi-dau-cac-giai-bong-da-chuyen-nghiep-quoc-gia-2026-27/'
};
export const countryForClub=trainingAssociationFor;
export function registrationRule(g,id){
 const league=g.leagues.find(l=>l.id===id);const country=league?.countryCode;
 if(id?.startsWith('uefa.'))return {name:'UEFA · List A / List B',max:25,localSlots:8,clubSlots:4,young:21,listB:true,minGK:2,minTotalGK:3,source:RULE_SOURCES.UEFA,mode:'enforced',text:'List A tối đa 25, dành 8 suất đào tạo tại liên đoàn, trong đó ít nhất 4 suất đào tạo tại CLB. Thiếu suất đào tạo thì giảm quy mô danh sách. List B cần đủ tuổi và thời gian đăng ký tại CLB; không chỉ là U21. Tối thiểu 2 thủ môn List A và 3 thủ môn tổng cộng.',detail:'Đào tạo: 3 mùa trọn vẹn hoặc 36 tháng trong khung 15–21 tuổi, có mở rộng đầu/cuối mùa sinh nhật theo UEFA. List B mùa 2026/27: sinh từ 01/01/2005, kèm 2 năm liên tục đủ điều kiện thi đấu tại CLB sau tuổi 15. Game tính riêng ngoại lệ 16 tuổi; ngoại lệ 3 năm có một lần cho mượn cần xác nhận thủ công. Game chặn khi thiếu 2 thủ môn List A; tổng 3 thủ môn A+B hiện chỉ cảnh báo vì một số nguồn thiếu danh sách trẻ. Cho sửa danh sách quanh năm; không mô phỏng hạn nộp và ngoại lệ y tế.'};
 if(id==='eng.1')return {name:'Premier League',max:25,localSlots:8,clubSlots:0,young:21,source:RULE_SOURCES.EN,mode:'enforced',text:'Tối đa 25 cầu thủ đội một, tối đa 17 cầu thủ không đạt home-grown. U21 được thi đấu ngoài danh sách 25.',detail:'Home-grown: đăng ký với CLB thuộc FA hoặc FA Wales đủ 3 mùa hoặc 36 tháng trước sinh nhật 21 tuổi (hoặc hết mùa tròn 21). Quốc tịch không quyết định home-grown. Mốc U21 mùa 2026/27 là sinh từ 01/01/2005.'};
 if(id==='eng.2'||id==='eng.3')return {name:'EFL · '+league.name,max:id==='eng.2'?25:22,localSlots:8,clubSlots:0,young:21,exemptGK:id==='eng.3',source:RULE_SOURCES.EFL,mode:'advisory',text:`Danh sách chính ${id==='eng.2'?'25':'22'} cầu thủ, tối thiểu 8 home-grown. Có quy định riêng về U21, thủ môn, cầu thủ cho mượn và cầu thủ do CLB đào tạo trong danh sách trận.`,detail:'Chưa đối chiếu toàn bộ ngoại lệ EFL 2026/27: trang này cảnh báo số lượng, chưa chặn ra sân theo EFL.'};
 if(id==='ita.1')return {name:'Serie A',max:25,localSlots:8,clubSlots:4,young:22,source:RULE_SOURCES.IT,mode:'enforced',text:'Danh sách 25 với 4 suất đào tạo tại CLB và 4 suất đào tạo tại Ý. Cầu thủ U23 được thi đấu ngoài danh sách.',detail:'U23 tính tại ngày 31/12 năm bắt đầu mùa: mùa 2026/27 sinh từ 01/01/2004. Theo FIGC CU 245/A ngày 26/05/2026; không suy ra quá trình đào tạo từ quốc tịch. Ngoại lệ thay thế danh sách và hạn ngạch nhập cầu thủ ngoài EU chưa mô phỏng.'};
 if(country==='DE'&&league.tier<=2)return {name:league.name,source:RULE_SOURCES.DE,mode:'advisory',minLocal:8,minClub:4,minNational:12,text:'DFL yêu cầu ít nhất 8 cầu thủ đào tạo tại Đức, trong đó ít nhất 4 do CLB đào tạo; CLB phải có ít nhất 12 cầu thủ quốc tịch Đức theo điều kiện cấp phép.',detail:'Đây là điều kiện đội bóng/cấp phép, không phải danh sách 25 của UEFA. Game đối chiếu và cảnh báo khi thiếu dữ liệu đào tạo, không tự biến cầu thủ Đức thành home-grown.'};
 if(country==='PT'&&league.tier<=2)return {name:league.name,max:30,minLocal:8,source:RULE_SOURCES.PT,mode:'advisory',text:'Tối đa 30 cầu thủ senior ở nhóm chính; ít nhất 8 cầu thủ đào tạo địa phương, hoặc 10 nếu CLB có đội B. Liga Portugal 2 còn yêu cầu 3 senior U23 và chỉ tiêu trên danh sách trận.',detail:'Đào tạo địa phương: 3 mùa/36 tháng trong khung 15–21 tuổi; có ngoại lệ 15–18 tuổi chưa từng đăng ký ở liên đoàn khác. Điều 87–88 có các nhóm bổ sung (junior, đội B, CLB liên kết). Game hiển thị cảnh báo; chưa mô phỏng toàn bộ nhóm đăng ký và quan hệ đội B.'};
 if(country==='VN')return {name:league.name,source:RULE_SOURCES.VN,mode:'advisory',foreignLimit:id==='vie.1'?4:id==='vie.2'?1:null,text:id==='vie.1'?'V.League 1 2026/27: đăng ký và sử dụng tối đa 4 ngoại binh trên sân. CLB dự AFF/AFC được đăng ký tới 7, vẫn chỉ 4 trên sân.':id==='vie.2'?'V.League 2 2026/27: tối đa 1 ngoại binh, thêm 1 cầu thủ Việt Nam gốc nước ngoài và 2 cầu thủ nước ngoài gốc Việt.':'Hạng Nhì: hiển thị nguồn đội bóng theo mùa công bố; chưa có bộ điều lệ đăng ký 2027 được xác minh.',detail:'Hạn ngạch ngoại binh khác tiêu chuẩn home-grown. Nguồn tiểu sử chưa có đủ quốc tịch kép/gốc Việt, nên game cảnh báo thay vì tự kết luận trường hợp miễn trừ.'};
 const texts={ES:'Tây Ban Nha sử dụng giới hạn giấy phép đội một và suất ngoài EU; đây không phải quota home-grown 8/4 của UEFA. Cần tính quốc tịch kép, hiệp định và đăng ký đội trẻ.',FR:'Pháp có điều kiện đăng ký cầu thủ ngoài EU/EEE và các nước có hiệp định. Không áp dụng mặc định danh sách home-grown 8/4 của UEFA cho giải quốc nội.',NL:'Đăng ký tại KNVB và điều kiện lao động của cầu thủ ngoài EU được xử lý riêng; không tự áp quota 8/4 UEFA cho giải quốc nội.',DE:'3. Liga dùng điều lệ DFB riêng, gồm quy định cầu thủ trẻ trong danh sách trận. Không dùng điều kiện cấp phép DFL của Bundesliga thay thế.',IT:'Serie B và Serie C có điều kiện tuổi, danh sách và đào tạo riêng. Không áp quy định 25 + U23 của Serie A cho hạng dưới.',PT:'Liga 3 theo điều lệ FPF riêng, không dùng giới hạn danh sách Liga Portugal làm quy định thay thế.'};
 return {name:league?.name||id,source:RULE_SOURCES[country]||RULE_SOURCES.UEFA,mode:'reference',text:texts[country]||'Xem điều lệ của ban tổ chức.',detail:'Bản này cung cấp nguồn và hồ sơ đào tạo để đối chiếu; chưa chặn thi đấu theo những điều khoản chưa xác minh đầy đủ. UEFA vẫn áp dụng riêng khi CLB dự cúp châu Âu.'};
}
export function trainingStatus(g,p,competitionId,clubId=p.clubId){
 return verifiedTrainingStatus(g,p,competitionId,clubId);
}
export function exemptPlayer(g,p,competitionId,clubId=p.clubId){
 const r=registrationRule(g,competitionId);
 if(r.exemptGK&&p.position==='GK')return true;
 if(!r.young||!p.birthDate||p.birthDate<`${g.year-r.young}-01-01`)return false;
 return !r.listB||trainingStatus(g,p,competitionId,clubId).listB;
}
export function registrationReport(g,competitionId,clubId,ids){
 const rule=registrationRule(g,competitionId);const pool=Object.values(g.players).filter(p=>p.clubId===clubId);
 const selected=new Set(ids||g.registrations?.[competitionId]?.[clubId]||[]);
 // List B eligibility is an option. A club may deliberately use an eligible
 // youth player on List A to fill a training/goalkeeper place.
 const a=pool.filter(p=>selected.has(p.id)&&(rule.listB||!exemptPlayer(g,p,competitionId,clubId)));const b=pool.filter(p=>exemptPlayer(g,p,competitionId,clubId)&&(!rule.listB||!selected.has(p.id)));
 const hg=a.filter(p=>trainingStatus(g,p,competitionId,clubId).association).length,ct=a.filter(p=>trainingStatus(g,p,competitionId,clubId).club).length;
 const capacity=rule.max==null?Infinity:rule.localSlots?rule.max-rule.localSlots+Math.min(rule.localSlots,ct+Math.min(rule.localSlots-(rule.clubSlots||0),hg-ct)):rule.max;
 const errors=[];if(a.length>capacity)errors.push(`Danh sách chính ${a.length}/${capacity===Infinity?'∞':capacity}; cần bớt ${a.length-capacity} hoặc bổ sung suất đào tạo hợp lệ.`);
 if(rule.minGK&&a.filter(p=>p.position==='GK').length<rule.minGK)errors.push(`List A cần ít nhất ${rule.minGK} thủ môn.`);
 const warnings=[];
 if(rule.minTotalGK&&[...a,...b].filter(p=>p.position==='GK').length<rule.minTotalGK)warnings.push(`UEFA cần tổng cộng ${rule.minTotalGK} thủ môn List A + B; nguồn đội hình có thể thiếu thủ môn trẻ.`);
 const unknown=pool.filter(p=>!trainingStatus(g,p,competitionId,clubId).known&&!b.includes(p)).length;
 if(unknown)warnings.push(`${unknown} cầu thủ chưa có xác minh đào tạo. Họ vẫn có thể đăng ký ở suất thường; chỉ chưa được tính vào suất home-grown.`);
 if(rule.minLocal&&pool.filter(p=>trainingStatus(g,p,competitionId,clubId).association).length<rule.minLocal)warnings.push(`Chưa xác nhận đủ ${rule.minLocal} cầu thủ đào tạo trong nước.`);
 if(rule.minClub&&pool.filter(p=>trainingStatus(g,p,competitionId,clubId).club).length<rule.minClub)warnings.push(`Chưa xác nhận đủ ${rule.minClub} cầu thủ đào tạo tại CLB.`);
 if(rule.minNational&&pool.filter(p=>isoCountry(p)==='DE').length<rule.minNational)warnings.push(`Chưa xác nhận đủ ${rule.minNational} cầu thủ quốc tịch Đức.`);
 if(rule.foreignLimit!=null){const foreign=pool.filter(p=>isoCountry(p)&&isoCountry(p)!=='VN').length;if(foreign>rule.foreignLimit)warnings.push(`${foreign} hồ sơ có quốc tịch chính ngoài Việt Nam; cần kiểm tra nhóm ngoại binh/gốc Việt và ngoại lệ trước khi đối chiếu hạn ngạch ${rule.foreignLimit}.`);}
 return {rule,a,b,capacity,hg,ct,unknown,errors,warnings,valid:errors.length===0};
}
export function autoRegistration(g,competitionId,clubId,rank){
 const rule=registrationRule(g,competitionId);const ps=Object.values(g.players).filter(p=>p.clubId===clubId&&(rule.listB||!exemptPlayer(g,p,competitionId,clubId))).sort((a,b)=>rank(b)-rank(a));
 if(rule.mode!=='enforced')return ps.map(p=>p.id);
 const ids=[],status=new Map(ps.map(p=>[p.id,trainingStatus(g,p,competitionId,clubId)]));
 const add=p=>{if(p&&!ids.includes(p.id))ids.push(p.id);};
 ps.filter(p=>p.position==='GK').slice(0,rule.minGK||0).forEach(add);
 for(const p of ps.filter(p=>status.get(p.id).club)){if(ids.filter(id=>status.get(id).club).length>=(rule.clubSlots||0))break;add(p);}
 for(const p of ps.filter(p=>status.get(p.id).association)){if(ids.filter(id=>status.get(id).association).length>=(rule.localSlots||0))break;add(p);}
 // Prefer keeping other List B players outside the capped list, while retaining
 // the ability to select them manually or to satisfy the reserved places above.
 for(const p of ps.filter(p=>!rule.listB||!exemptPlayer(g,p,competitionId,clubId))){if(ids.includes(p.id))continue;const candidate=[...ids,p.id].map(id=>g.players[id]),hg=candidate.filter(p=>status.get(p.id).association).length,ct=candidate.filter(p=>status.get(p.id).club).length;const capacity=rule.localSlots?rule.max-rule.localSlots+Math.min(rule.localSlots,ct+Math.min(rule.localSlots-(rule.clubSlots||0),hg-ct)):rule.max;if(candidate.length<=capacity)ids.push(p.id);}
 return ids;
}
export function officialUefaSelection(g,competitionId,clubId=g.clubId){
 return Object.values(g.players).filter(p=>p.clubId===clubId).filter(p=>{const s=officialUefaRegistration(g,p,clubId);return s?.competitionId===competitionId&&s.list==='A';}).map(p=>p.id);
}
export function registered(g,p,competitionId){
 if(competitionSuspension(g,p,competitionId)>0)return false;
 if(!competitionId)return true;const rule=registrationRule(g,competitionId);if(rule.mode!=='enforced')return true;
 if(exemptPlayer(g,p,competitionId))return true;
 const ids=g.registrations?.[competitionId]?.[p.clubId];return !ids||ids.includes(p.id);
}
export function saveRegistration(g,competitionId,ids){
 const report=registrationReport(g,competitionId,g.clubId,ids);if(report.rule.mode==='enforced'&&!report.valid)throw Error(report.errors.join(' '));
 g.registrations||={};g.registrations[competitionId]||={};g.registrations[competitionId][g.clubId]=[...new Set(ids)].filter(id=>g.players[id]?.clubId===g.clubId);
}
