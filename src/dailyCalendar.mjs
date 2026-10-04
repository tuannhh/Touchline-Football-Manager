import {dailyCareer,addCareerDays,daysBetween,nextClubFixture} from './careerClock.mjs';
import {advanceRound,currentFixture,maxRounds,nextSeason,finishFriendly,repairLineup,postponeNationalAbsences,runCareerMarket,reviewSquadPromises,addMessage,hash,clubPlayers} from './engine.mjs';
import {processInternationalDate} from './international.mjs';
import {settleWeeklyFinancials} from './financialSustainability.mjs';
import {reviewPlayerDevelopment} from './playerDevelopment.mjs';
import {reviewPlayerDynamics} from './playerDynamics.mjs';
import {runStaffWeek,staffEffects} from './staff.mjs';
import {runScoutingWeek} from './scouting.mjs';
import {processNegotiationReplies,simulatedClubInterests} from './transfers.mjs';
import {processFriendlyInvitations,checkFriendlyMatchday} from './friendlyInvitations.mjs';

function weeklyWork(g){
 const clock=g.careerClock,previous=clock.lastWeeklyDate;
 if(daysBetween(g.date,previous)<7)return false;
 const support=new Map();
 for(const p of Object.values(g.players))if(p.injury>0&&(!p.injuryDetail?.since||daysBetween(g.date,p.injuryDetail.since)>=7)){
  if(!support.has(p.clubId))support.set(p.clubId,staffEffects(g,p.clubId));
  const bonus=p.injury>1&&hash(`${g.date}:${p.id}:medical`)%1000<support.get(p.clubId).medicalRecoveryChance*1000?1:0;
  p.injury=Math.max(0,p.injury-1-bonus);
 }
 settleWeeklyFinancials(g);runStaffWeek(g);reviewSquadPromises(g);
 const playedClubs=new Set(g.fixtures.filter(f=>f.result&&f.date>previous&&f.date<=g.date).flatMap(f=>[f.home,f.away]));
 reviewPlayerDynamics(g,{playedClubs});clock.lastWeeklyDate=g.date;return true;
}
function marketRumour(g){
 const c=g.careerClock;if(c.lastRumourDate&&daysBetween(g.date,c.lastRumourDate)<7)return;
 c.lastRumourDate=g.date;
 const candidates=[...g.shortlist.map(id=>g.players[id]).filter(Boolean),...clubPlayers(g,g.clubId).filter(p=>p.listed||p.dynamics?.wantsToLeave)];
 if(!candidates.length)return;
 const p=candidates[hash(`${g.id}:${g.date}:rumour`)%candidates.length],interest=simulatedClubInterests(g,p,{limit:1})[0];
 if(!interest)return;
 addMessage(g,`Tin đồn chuyển nhượng · ${p.name}`,`${g.clubs[interest.clubId].name} đang theo dõi ${p.name}. Đây là tin đồn trong mô phỏng dựa trên nhu cầu đội hình và ngân sách, chưa phải lời đề nghị hoặc thương vụ đã chốt.`,'transfer',{paragraphs:[`Bản tin thị trường ngày ${g.date}`,`${g.clubs[interest.clubId].name} đang theo dõi ${p.name}.`,`Mức quan tâm có thể thay đổi theo phong độ, nhu cầu vị trí và tài chính. Chưa có đề nghị mua được gửi. Tin này thuộc thế giới mô phỏng, không phải tin tức ngoài đời.`],playerIds:[p.id],action:{page:'transfers',label:'Xem thị trường chuyển nhượng'}});
}
function seasonTransition(g){
 if(g.round<maxRounds(g))return;
 const c=g.careerClock;
 c.seasonReadyDate??=(g.date<`${g.year+1}-07-01`?`${g.year+1}-07-01`:addCareerDays(g.date,1));
 if(g.date>=c.seasonReadyDate){nextSeason(g,{daily:true});c.seasonReadyDate=null;}
}
/** Commit only today's result. The manager remains in the office on that date. */
export function finishDailyMatch(g,played){
 if(!dailyCareer(g)||!played?.completed)throw Error('Trận đấu chưa kết thúc.');
 if(played.friendly)finishFriendly(g,played);else advanceRound(g,played,{daily:true});
 repairLineup(g);return g;
}
/** One real career day; world fixtures, recovery and news never cross its boundary. */
export function advanceCareerDay(g){
 if(!dailyCareer(g))throw Error('Save này sử dụng lịch mốc trận của phiên bản trước.');
 if(g.liveMatch)throw Error('Hãy ghi nhận trận đấu đang diễn ra trước khi chuyển ngày.');
 if(currentFixture(g))throw Error('Hôm nay có trận đấu. Hãy chuẩn bị đội hình và hoàn tất trận đấu.');
 const beforeSequence=g.messageSequence||0;
 while(g.calendar?.[g.round]?.date<=g.date)advanceRound(g,null,{daily:true});
 g.date=addCareerDays(g.date,1);g.careerClock.lastProcessedDate=g.date;
 processInternationalDate(g,g.date);
 if(g.calendar?.[g.round]?.date===g.date)postponeNationalAbsences(g);
 if(!weeklyWork(g))reviewPlayerDynamics(g,{training:false,playedClubs:new Set(),reviewMinutes:false});
 processNegotiationReplies(g);processFriendlyInvitations(g);checkFriendlyMatchday(g);
 reviewPlayerDevelopment(g);runScoutingWeek(g);marketRumour(g);
 // Negotiations progress daily; completed AI transfers are spread across dates.
 if(daysBetween(g.date,g.careerClock.startedAt)%3===0)runCareerMarket(g);
 seasonTransition(g);repairLineup(g);
 const messages=g.messages.filter(m=>Number(m.id.split('-').at(-1))>beforeSequence),attention=messages.find(m=>m.requiresAttention||m.action?.page==='international'||m.action?.page==='squad');
 return {date:g.date,fixture:currentFixture(g)||null,nextFixture:nextClubFixture(g),attention:attention||null,messages:messages.length};
}
