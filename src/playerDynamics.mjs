import {makeMessage} from './mail.mjs';
import {competitionSuspension} from './discipline.mjs';
const clamp=n=>Math.max(0,Math.min(100,Math.round(n)));
const days=(a,b)=>Math.floor((Date.parse(a)-Date.parse(b))/86400000);
const addDays=(date,n)=>new Date(Date.parse(date)+n*86400000).toISOString().slice(0,10);
function hash(s){let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function report(g,p,title,body,type='news'){
 if(p.clubId!==g.clubId)return;
 const m=makeMessage(g,title,body,type,{paragraphs:[`Kính gửi HLV ${g.manager},`,body,`Cầu thủ: ${p.name}. Tinh thần hiện tại: ${p.morale}/100.`,`Đây là diễn biến trong sự nghiệp mô phỏng của bạn.`, 'Trợ lý huấn luyện viên'],action:{page:'squad',label:'Xem đội hình'}});
 g.messages.unshift(m);g.messages=g.messages.slice(0,250);
}
export function initializePlayerDynamics(g){
 for(const p of Object.values(g.players)){
  p.loanListed??=false;
  p.dynamics??={clubId:p.clubId,year:g.year,baselineMinutes:p.seasonMinutes,lastMinutes:p.seasonMinutes,unusedWeeks:0,concerns:[],wantsToLeave:false,startedAt:g.date};
 }
 g.dynamicsVersion=1;return g;
}
export function playerMood(p){
 if(p.dynamics?.wantsToLeave)return {label:'Muốn ra đi',tone:'bad'};
 if(p.dynamics?.concerns?.length||p.morale<50)return {label:p.morale<35?'Rất buồn':'Không hài lòng',tone:'bad'};
 return p.morale>=80?{label:'Vui vẻ',tone:'good'}:p.morale>=60?{label:'Ổn định',tone:'neutral'}:{label:'Lo lắng',tone:'warn'};
}
export function noteInjury(g,p,context='match'){
 if(!p.injury)return;
 if(p.injuryDetail?.active&&p.injury<=p.injuryDetail.lastWeeks){p.injuryDetail.lastWeeks=p.injury;return;}
 const kinds=context==='training'?['Căng cơ khi tập','Đau cổ chân khi tập','Quá tải cơ']:['Căng cơ','Chấn thương cổ chân','Va chạm đầu gối'];
 p.injuryDetail={kind:kinds[hash(p.id+g.date+context)%kinds.length],since:g.date,initialWeeks:p.injury,lastWeeks:p.injury,context,active:true};
 report(g,p,`Báo cáo y tế · ${p.name}`,`${p.name} bị ${p.injuryDetail.kind.toLowerCase()}, dự kiến nghỉ khoảng ${p.injury} tuần. Cầu thủ được loại khỏi danh sách đủ điều kiện; đội ngũ y tế sẽ theo dõi hồi phục. Tập nặng và thể lực thấp làm tăng rủi ro chấn thương trong mô phỏng.`);
}
export function reviewPlayerDynamics(g,{training=true,playedClubs=null}={}){
 initializePlayerDynamics(g);
 const playedCompetitions=new Map();
 for(const f of g.fixtures)if(f.round===g.round&&f.result)for(const club of [f.home,f.away]){if(!playedCompetitions.has(club))playedCompetitions.set(club,[]);playedCompetitions.get(club).push(f.leagueId);}
 for(const p of Object.values(g.players)){
  let d=p.dynamics;
  if(d.clubId!==p.clubId||d.year!==g.year){p.dynamics=d={clubId:p.clubId,year:g.year,baselineMinutes:p.seasonMinutes,lastMinutes:p.seasonMinutes,unusedWeeks:0,concerns:[],wantsToLeave:false,startedAt:g.date};p.loanListed=false;}
  if(d.lastReviewed===g.date)continue;d.lastReviewed=g.date;
  if(p.injury>0){noteInjury(g,p,p.injuryDetail?.context||'match');}
  else if(p.injuryDetail?.active){p.injuryDetail.active=false;report(g,p,`${p.name} trở lại tập luyện`,`${p.name} đã hoàn tất hồi phục. Ban huấn luyện khuyến nghị theo dõi thể lực trước khi đưa cầu thủ trở lại đội hình chính.`);}
  const played=Math.max(0,p.seasonMinutes-d.lastMinutes);d.lastMinutes=p.seasonMinutes;
  // A club without a fixture, national duty, an injury or a ban is not refusal to use a player.
  const hadFixture=playedClubs?playedClubs.has(p.clubId):g.fixtures.some(f=>f.round===g.round&&f.result&&(f.home===p.clubId||f.away===p.clubId));
  const servedBan=p.discipline?.lastServedDate===g.date&&p.discipline?.lastServedRound===g.round;
  const scopedBan=(playedCompetitions.get(p.clubId)||[]).some(id=>competitionSuspension(g,p,id)>0);
  if(hadFixture&&!p.injury&&!p.suspension&&!servedBan&&!scopedBan&&!p.internationalDuty?.active){
   d.unusedWeeks=played>=20?0:d.unusedWeeks+1;
   if(played>=20){d.concerns=d.concerns.filter(x=>x!=='Ít được thi đấu');if(d.unusedWeeks===0&&!d.wantsToLeave)p.morale=clamp(p.morale+1);}
   const expected=p.contractTerms?.squadRole!=='prospect'&&p.age>=21;
   if(expected&&d.unusedWeeks>=4){if(!d.concerns.includes('Ít được thi đấu')){d.concerns.push('Ít được thi đấu');report(g,p,`${p.name} muốn trao đổi về thời gian thi đấu`,`${p.name} không có đủ thời gian ra sân trong bốn vòng gần nhất và muốn biết vai trò trong đội. Bạn có thể động viên, hứa cơ hội hoặc chấp thuận để cầu thủ tìm CLB mới.`);}p.morale=clamp(p.morale-3);}
   if(expected&&d.unusedWeeks>=8&&!d.wantsToLeave){d.wantsToLeave=true;report(g,p,`${p.name} đề nghị được ra đi`,`${p.name} cho rằng cơ hội thi đấu quá ít và đề nghị chuyển nhượng. Yêu cầu sẽ còn hiệu lực cho đến khi bạn giữ lời hứa về thời gian thi đấu hoặc cho phép cầu thủ tìm bến đỗ mới.`,'transfer');if(p.clubId!==g.clubId)p.listed=true;}
   if(p.clubId!==g.clubId&&p.age<23&&d.unusedWeeks>=4)p.loanListed=true;
  }
  if(d.promise&&g.date>=d.promise.deadline){const minutes=Math.max(0,p.seasonMinutes-d.promise.startMinutes),kept=minutes>=d.promise.target;
   if(kept){d.concerns=d.concerns.filter(x=>!['Ít được thi đấu','Thất vọng vì lời hứa'].includes(x));d.wantsToLeave=false;p.morale=clamp(p.morale+8);}
   else{if(!d.concerns.includes('Thất vọng vì lời hứa'))d.concerns.push('Thất vọng vì lời hứa');d.wantsToLeave=true;p.morale=clamp(p.morale-10);}
   report(g,p,`${p.name} · ${kept?'Lời hứa được thực hiện':'Chưa được trao cơ hội'}`,`Bạn đã hứa ít nhất ${d.promise.target} phút trong bốn tuần. Thực tế: ${minutes} phút. ${kept?'Cầu thủ hài lòng và rút yêu cầu ra đi.':'Cầu thủ thất vọng và muốn tìm CLB khác.'}`);d.promiseResult={date:g.date,kept,minutes};delete d.promise;
  }
  if(training&&!p.injury&&!p.internationalDuty?.active){const intensity=p.clubId===g.clubId?g.intensity:'normal',risk=(intensity==='hard'?9:intensity==='light'?1:3)+(p.fitness<65?8:0);
   if(hash(`${g.simulationId||g.id}:${g.date}:${p.id}:training`) % 1000 < risk){p.injury=1+hash(p.id+g.date)%3;noteInjury(g,p,'training');}
  }
 }
}
export function setPlayerListing(g,id,patch){
 initializePlayerDynamics(g);const p=g.players[id];if(!p||p.clubId!==g.clubId||g.liveMatch)throw Error('Chỉ điều chỉnh danh sách chuyển nhượng của CLB bạn khi ngoài trận.');
 for(const [input,key]of [['transferListed','listed'],['loanListed','loanListed']])if(patch[input]!==undefined){if(typeof patch[input]!=='boolean')throw Error('Trạng thái danh sách không hợp lệ.');if(p[key]===patch[input])continue;p[key]=patch[input];
  const d=p.dynamics,concern=key==='listed'?'Bị đưa vào danh sách bán':'Bị đưa vào danh sách cho mượn';
  if(p[key]&&!d.wantsToLeave&&p.age>=23){if(!d.concerns.includes(concern))d.concerns.push(concern);p.morale=clamp(p.morale-5);}
  if(!p[key])d.concerns=d.concerns.filter(x=>x!==concern);
  report(g,p,`Tình trạng chuyển nhượng · ${p.name}`,`${p.name} ${p[key]?'được đưa vào':'được gỡ khỏi'} ${key==='listed'?'danh sách bán':'danh sách cho mượn'}. ${d.wantsToLeave?'Cầu thủ đang muốn tìm cơ hội ở nơi khác.':p[key]&&p.age>=23?'Cầu thủ không vui vì tương lai thiếu chắc chắn.':'Ban huấn luyện đã thông báo quyết định cho cầu thủ.'}`,'transfer');
 }
 return p;
}
export function talkToPlayer(g,id,action){
 initializePlayerDynamics(g);const p=g.players[id];if(!p||p.clubId!==g.clubId||g.liveMatch)throw Error('Không thể trao đổi với cầu thủ lúc này.');const d=p.dynamics;
 if(!['encourage','promise','leave'].includes(action))throw Error('Nội dung trao đổi không hợp lệ.');
 if(action==='leave'){d.wantsToLeave=true;setPlayerListing(g,id,{transferListed:true});return;}
 if(d.lastTalk&&days(g.date,d.lastTalk)<7)throw Error('Hãy cho cầu thủ ít nhất 7 ngày để phản hồi buổi trao đổi trước.');
 if(action==='promise'){if(d.promise)throw Error('Bạn đang có một lời hứa chưa đến hạn.');d.promise={startMinutes:p.seasonMinutes,target:180,deadline:addDays(g.date,28)};p.morale=clamp(p.morale+3);report(g,p,`Cam kết với ${p.name}`,`Bạn đã hứa cho ${p.name} thi đấu ít nhất 180 phút chính thức trong 28 ngày tới, hạn ${d.promise.deadline}. Đừng hứa nếu lịch thi đấu hoặc tình trạng sức khỏe không cho phép.`);}
 else{p.morale=clamp(p.morale+(d.wantsToLeave?1:4));report(g,p,`Trao đổi riêng · ${p.name}`,`Bạn đã động viên ${p.name}. Tinh thần cải thiện nhẹ; những lo ngại về thời gian thi đấu và lời hứa vẫn cần được giải quyết bằng hành động.`);}
 d.lastTalk=g.date;
}
export function resetDynamicsAfterTransfer(g,p){p.dynamics={clubId:p.clubId,year:g.year,baselineMinutes:p.seasonMinutes,lastMinutes:p.seasonMinutes,unusedWeeks:0,concerns:[],wantsToLeave:false,startedAt:g.date};p.loanListed=false;}
export function validatePlayerDynamics(g){
 if(g.dynamicsVersion===undefined)return true;
 if(g.dynamicsVersion!==1)throw Error('Phiên bản trạng thái cầu thủ không hợp lệ.');
 for(const p of Object.values(g.players)){const d=p.dynamics;if(d===undefined&&p.loanListed===undefined)continue;if(typeof p.loanListed!=='boolean'||!d||typeof d.wantsToLeave!=='boolean'||!Array.isArray(d.concerns)||d.concerns.length>20||d.concerns.some(s=>typeof s!=='string'||s.length>200)||!Number.isInteger(d.unusedWeeks)||d.unusedWeeks<0||!Number.isFinite(d.lastMinutes)||d.lastMinutes<0||d.promise&&(!Number.isFinite(d.promise.startMinutes)||!Number.isFinite(d.promise.target)||d.promise.target<0||!/^\d{4}-\d{2}-\d{2}$/.test(d.promise.deadline)))throw Error('Hồ sơ tâm lý cầu thủ không hợp lệ.');}
 return true;
}
