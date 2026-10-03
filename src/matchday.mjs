// Match-day lists are separate from seasonal registration. Each rule carries
// its source season so an older verified regulation is never passed off as new.
const IFAB='https://www.theifab.com/laws/latest/the-players/';
const base={maxBench:9,maxSubs:5,subWindows:3,extraTimeSub:0,verified:false,sourceUrl:IFAB,sourceLabel:'IFAB · Luật 3',sourceSeason:'Quy tắc chung',notes:'Giới hạn danh sách của giải chưa được đối chiếu đầy đủ; đang dùng thiết lập mô phỏng, có thể điều chỉnh.'};
const rule=(maxBench,sourceUrl,sourceLabel,sourceSeason,extra={})=>({...base,maxBench,sourceUrl,sourceLabel,sourceSeason,verified:true,notes:'Không mô phỏng lượt thay bổ sung do chấn động não.',...extra});
const pl=rule(9,'https://www.premierleague.com/en/news/2669074','Premier League · Five substitutes','Từ 2022/23');
const efl=rule(9,'https://images.gc.eflservices.co.uk/526ac020-67b3-11f0-9ba4-015464ec39cd.pdf','EFL · Điều 34.4','2025/26');
const dfl=rule(9,'https://media.dfl.de/sites/2/2026/06/Spielordnung-SpOL-2026-06-11-Stand.pdf','DFL · Spielordnung','11/06/2026');
const spain=rule(12,'https://rfef.es/sites/default/files/2022-09/Primera%20y%20Segunda%20Divisi%C3%B3n.pdf','RFEF · Primera y Segunda División','2022/23',{notes:'Áp dụng giới hạn trong bản điều lệ được liên kết; chưa đối chiếu bản mùa 2026/27.'});
const primera=rule(12,'https://rfef.es/sites/default/files/2024-10/NRBC%20Primera%20Federacio%CC%81n%202024%20-%202025%20%20tras%20CD%20octb.pdf','RFEF · Primera Federación','2024/25',{extraTimeSub:1,notes:'Điều lệ nguồn 2024/25. Thêm một cầu thủ thay trong hiệp phụ play-off; chưa mô phỏng play-off quốc nội.'});
const figc=rule(15,'https://www.aia-figc.it/download/regolamenti/reg_2025.pdf','FIGC / AIA · Quyết định 8, trang 31','2025',{notes:'Quyết định FIGC: Serie A và Lega Pro tối đa 15 dự bị; Serie B tối đa 12. Bản nguồn cập nhật 15/07/2025.'});
const portugal=rule(12,'https://www.ligaportugal.pt/backoffice/assets/20260701_RC_2026_27_f53785bcd4.pdf','Liga Portugal · Điều 75','2026/27');
const dutchProfessional=rule(12,'https://www.knvb.nl/node/19132','KNVB · Danh sách 23 cầu thủ','12 dự bị từ 2016; thay người 2024/25',{substitutionSourceUrl:'https://www.knvb.nl/downloads/bestand/28805/reglementenbetaaldvoetbalseizoen2425',extraTimeSub:1,notes:'Nguồn KNVB xác nhận danh sách 23 cầu thủ, gồm 12 dự bị. Giới hạn thay người đối chiếu bản 2024/25; chưa đối chiếu trọn bộ điều lệ 2026/27.'});
const uefa=name=>rule(12,`https://documents.uefa.com/r/Regulations-of-the-UEFA-${name}-2026/27/Article-55-Match-sheet-Online`,'UEFA · Điều 55–56','2026/27',{extraTimeSub:1,substitutionSourceUrl:`https://documents.uefa.com/r/Regulations-of-the-UEFA-${name}-2026/27/Article-56-Player-replacements-and-substitutions-Online`});
export const MATCHDAY_RULES={
 'eng.1':pl,'eng.2':efl,'eng.3':{...efl,maxBench:7},'ger.1':dfl,'ger.2':dfl,'ger.3':{...base,maxBench:9},
 'fra.1':{...base,maxBench:9},'fra.2':{...base,maxBench:9},'fra.3':{...base,maxBench:7},
 'esp.1':spain,'esp.2':spain,'esp.3.1':primera,'esp.3.2':primera,
 'ita.1':figc,'ita.2':{...figc,maxBench:12},'ita.3.1':figc,'ita.3.2':figc,'ita.3.3':figc,
 'por.1':portugal,'por.2':portugal,
 'por.3.1':rule(9,'https://www.fpf.pt/Portals/0/REG_LIGA%203_1.pdf','FPF · Liga 3, Điều 71','Bản công khai, chưa xác định mùa',{notes:'Đã đối chiếu giới hạn trong bản công khai; chưa xác nhận bản mùa 2026/27.'}),
 'por.3.2':rule(9,'https://www.fpf.pt/Portals/0/REG_LIGA%203_1.pdf','FPF · Liga 3, Điều 71','Bản công khai, chưa xác định mùa',{notes:'Đã đối chiếu giới hạn trong bản công khai; chưa xác nhận bản mùa 2026/27.'}),
 'ned.1':dutchProfessional,'ned.2':dutchProfessional,
 'ned.3':rule(7,'https://www.knvb.nl/downloads/sites/bestand/knvb/30144/bestuursbesluit-handboek-veldvoetbal-2026-2027','KNVB · Handboek veldvoetbal, trang 7, 67, 70','2026/27'),
 'vie.1':rule(9,'https://vpf.vn/wp-content/uploads/2026/08/2026-08-26-Dieu-le-Giai-VDQG-LPBank-2026-27.pdf','VPF · V.League 1, Điều 14','2026/27',{notes:'Mô phỏng giới hạn tối đa và số lượt thay. Điều lệ thật còn yêu cầu tối thiểu 5 dự bị, gồm ít nhất một thủ môn.'}),
 'vie.2':rule(9,'https://vpf.vn/wp-content/uploads/2026/08/2026-08-26-Dieu-le-Giai-HNQG-2026-27.pdf','VPF · Hạng Nhất, Điều 14','2026/27',{notes:'Mô phỏng giới hạn tối đa và số lượt thay. Điều lệ thật còn yêu cầu tối thiểu 5 dự bị, gồm ít nhất một thủ môn.'}),
 'vie.3.1':{...base,maxBench:9},'vie.3.2':{...base,maxBench:9},'eur.other':{...base,maxBench:9},
 'uefa.champions':uefa('Champions-League'),'uefa.europa':uefa('Europa-League'),'uefa.europa.conf':uefa('Conference-League'),
 friendly:{...base,maxBench:12,maxSubs:12,subWindows:null,sourceLabel:'IFAB · Giao hữu theo thỏa thuận',notes:'Hai CLB thống nhất 12 dự bị và tối đa 12 thay người trong game. Không cho cầu thủ đã ra sân trở lại; có thể điều chỉnh trước trận.'},
};
const ownFixture=g=>g.fixtures?.find(f=>f.round===g.round&&!f.result&&(f.home===g.clubId||f.away===g.clubId));
const defaultCompetition=g=>ownFixture(g)?.leagueId||g.clubs[g.clubId]?.leagueId;
export function matchdayRule(g,competitionId=defaultCompetition(g)){
 const configured=g.matchdayRuleOverrides?.[competitionId],original=MATCHDAY_RULES[competitionId]||base;
 return {...original,...configured,id:competitionId,label:g.leagues?.find(l=>l.id===competitionId)?.name||g.cups?.find(c=>c.id===competitionId)?.name||(competitionId==='friendly'?'Giao hữu':competitionId||'Trận đấu'),custom:!!configured,...(configured?{verified:false,notes:'Thiết lập riêng của sự nghiệp. Các trận đã bắt đầu giữ nguyên điều lệ lúc giao bóng.'}:{})};
}
export function initializeMatchday(g){if(g.benchVersion===undefined){g.benchVersion=1;g.bench=[];}g.matchdayRuleOverrides??={};return g;}
const defaultEligible=p=>p.injury===0&&p.suspension===0;
/** Keeps manual choices/order. Only fill:true adds candidates to empty seats. */
export function repairBench(g,{eligible=defaultEligible,rank=p=>p.fitness||0,competitionId=defaultCompetition(g),fill=false}={}){
 initializeMatchday(g);const limit=matchdayRule(g,competitionId).maxBench,seen=new Set(g.lineup.filter(Boolean));
 g.bench=g.bench.filter(id=>{const p=g.players[id];if(!p||p.clubId!==g.clubId||seen.has(id)||!eligible(p))return false;seen.add(id);return true;}).slice(0,limit);
 if(fill){const chosen=new Set([...g.lineup,...g.bench]);const pool=Object.values(g.players).filter(p=>p.clubId===g.clubId&&!chosen.has(p.id)&&eligible(p)).sort((a,b)=>rank(b)-rank(a)||a.id.localeCompare(b.id));
  // Include a reserve goalkeeper where one is available, then retain ranking.
  if(g.bench.length<limit&&!g.bench.some(id=>g.players[id].position==='GK')){const index=pool.findIndex(p=>p.position==='GK');if(index>=0)g.bench.push(pool.splice(index,1)[0].id);}
  for(const p of pool){if(g.bench.length>=limit)break;g.bench.push(p.id);}
 }
 return g.bench;
}
/** Starter↔bench swaps both identities; bench↔bench reorders; outsiders replace one seat. */
export function assignBenchSlot(g,index,id,{eligible=defaultEligible,competitionId=defaultCompetition(g)}={}){
 if(g.liveMatch)throw Error('Danh sách dự bị đã chốt khi trận đấu bắt đầu.');
 const cap=matchdayRule(g,competitionId).maxBench,p=g.players[id];if(!Number.isInteger(index)||index<0||index>=cap||!p||p.clubId!==g.clubId||!eligible(p))throw Error('Cầu thủ hoặc vị trí dự bị không hợp lệ.');
 repairBench(g,{eligible,competitionId});const target=Math.min(index,g.bench.length),old=g.bench[target],current=g.bench.indexOf(id),starter=g.lineup.indexOf(id);
 if(current===target)return g.bench;
 if(current>=0){g.bench[current]=old;g.bench[target]=id;g.bench=g.bench.filter(Boolean);}
 else{g.bench[target]=id;if(starter>=0)g.lineup[starter]=old||null;}
 return g.bench;
}
export function removeFromBench(g,id){if(g.liveMatch)throw Error('Không thể đổi danh sách đăng ký trong trận.');initializeMatchday(g);g.bench=g.bench.filter(pid=>pid!==id);return g.bench;}
/** Only provisional rules and negotiated friendlies can be configured in the game UI. */
export function setMatchdayRule(g,competitionId,patch){
 if(g.liveMatch)throw Error('Hãy kết thúc trận đấu trước khi sửa điều lệ.');
 if(MATCHDAY_RULES[competitionId]?.verified)throw Error('Điều lệ đã đối chiếu nguồn chính thức không thể thay đổi ở đây.');
 if(!g.leagues?.some(l=>l.id===competitionId)&&!g.cups?.some(c=>c.id===competitionId)&&competitionId!=='friendly')throw Error('Giải đấu không hợp lệ.');
 const old=matchdayRule(g,competitionId),maxBench=patch.maxBench??old.maxBench,maxSubs=patch.maxSubs??old.maxSubs;
 if(!Number.isInteger(maxBench)||maxBench<3||maxBench>15||!Number.isInteger(maxSubs)||maxSubs<1||maxSubs>Math.min(15,maxBench))throw Error('Dự bị phải từ 3–15; số cầu thủ thay phải từ 1 đến số dự bị.');
 initializeMatchday(g);g.matchdayRuleOverrides[competitionId]={maxBench,maxSubs};if(competitionId===defaultCompetition(g))repairBench(g,{competitionId});return matchdayRule(g,competitionId);
}
export function matchSubLimit(m){return (m.matchdayRules?.maxSubs??m.maxSubs??5)+(m.extraTime?(m.matchdayRules?.extraTimeSub??0):0);}
/** Legacy live games keep their original list, even if longer than newly sourced rules. */
export function liveMatchdayRule(g,m){return m.matchdayRules||{...matchdayRule(g,m.friendly?'friendly':g.fixtures?.find(f=>f.id===m.fixtureId)?.leagueId),maxBench:Math.max(12,...m.bench.map(xs=>xs.length)),maxSubs:5,extraTimeSub:0,subWindows:null,notes:'Trận lưu từ phiên bản trước: giữ nguyên danh sách dự bị và giới hạn 5 thay người; không giới hạn số đợt.'};}
export function validateMatchday(g){
 if(g.benchVersion===undefined&&g.bench===undefined&&!g.liveMatch?.matchdayRules)return true;
 const fail=()=>{throw Error('Danh sách dự bị hoặc điều lệ trận đấu không hợp lệ.');};
 if(g.benchVersion!==1||!Array.isArray(g.bench)||g.bench.length>15||new Set(g.bench).size!==g.bench.length||g.bench.some(id=>typeof id!=='string'||g.players[id]?.clubId!==g.clubId||g.lineup.includes(id)))fail();
 if(!g.matchdayRuleOverrides||typeof g.matchdayRuleOverrides!=='object'||Array.isArray(g.matchdayRuleOverrides)||Object.keys(g.matchdayRuleOverrides).length>100)fail();
 for(const [id,x]of Object.entries(g.matchdayRuleOverrides)){if(!x||MATCHDAY_RULES[id]?.verified||!Number.isInteger(x.maxBench)||x.maxBench<3||x.maxBench>15||!Number.isInteger(x.maxSubs)||x.maxSubs<1||x.maxSubs>x.maxBench||Object.keys(x).some(k=>!['maxBench','maxSubs'].includes(k)))fail();}
 const m=g.liveMatch;if(m?.matchdayRules){const r=m.matchdayRules;if(!Array.isArray(m.bench)||m.bench.length!==2||m.bench.some(xs=>!Array.isArray(xs)||xs.length>r.maxBench))fail();if(!Number.isInteger(r.maxBench)||r.maxBench<3||r.maxBench>15||!Number.isInteger(r.maxSubs)||r.maxSubs<1||r.maxSubs>15||!Number.isInteger(r.extraTimeSub)||r.extraTimeSub<0||r.extraTimeSub>1||(r.subWindows!==null&&(!Number.isInteger(r.subWindows)||r.subWindows<1||r.subWindows>5)))fail();if(!Array.isArray(m.subWindows)||m.subWindows.length!==2||m.subWindows.some(n=>!Number.isInteger(n)||n<0||n>4)||!Array.isArray(m.lastSubMinute)||m.lastSubMinute.length!==2||m.lastSubMinute.some(n=>n!==null&&(!Number.isInteger(n)||n<0||n>120)))fail();}
 return true;
}
