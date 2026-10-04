import {dailyCareer,addCareerDays,daysBetween,validCareerDate} from './careerClock.mjs';
import {makeMessage} from './mail.mjs';

// Tour markets and capacities are fictional settings, not booked real venues.
export const TOUR_MARKETS=Object.freeze({
 home:{label:'Sân nhà',travelDays:2},
 europe:{label:'Châu Âu',city:'Lisboa',countryCode:'PT',capacity:30000,travelDays:3},
 northAmerica:{label:'Bắc Mỹ',city:'Los Angeles',countryCode:'US',capacity:65000,travelDays:5},
 asia:{label:'Châu Á',city:'Tokyo',countryCode:'JP',capacity:50000,travelDays:5},
 oceania:{label:'Châu Đại Dương',city:'Sydney',countryCode:'AU',capacity:45000,travelDays:5},
});
const hash=s=>{let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
const fit=p=>p.injury===0&&p.suspension===0&&!p.internationalDuty?.active;
function mail(g,title,body,attention=false){const m=makeMessage(g,title,body,'news',{sender:'Thư ký phụ trách giao hữu',paragraphs:[`Kính gửi HLV ${g.manager},`,body,'Lời mời, địa điểm du đấu và quyết định của đối thủ thuộc sự nghiệp mô phỏng.','Thư ký CLB'],requiresAttention:attention,action:{page:'fixtures',label:'Xem lịch giao hữu'}});g.messages.unshift(m);g.messages=g.messages.slice(0,250);return m;}
export function friendlyConflict(g,opponentId,date,market='home',ignoreId=null){
 const rule=TOUR_MARKETS[market];if(!rule)return 'Thị trường du đấu không hợp lệ.';
 const clubs=[g.clubId,opponentId];
 for(const f of [...g.fixtures,...(g.friendlies||[])])if(f.id!==ignoreId&&!f.cancelled&&clubs.some(id=>f.home===id||f.away===id)&&Math.abs(daysBetween(f.date,date))<Math.max(rule.travelDays,TOUR_MARKETS[f.tourMarket]?.travelDays||2))return 'Lịch quá sát trận khác của một trong hai CLB; cần thêm ngày nghỉ và di chuyển.';
 return null;
}
export function inviteFriendly(g,{opponentId,date,market='home'}){
 if(!dailyCareer(g)||g.liveMatch)throw Error('Chỉ gửi lời mời ngoài trận trong sự nghiệp có lịch từng ngày.');
 if(!g.clubs[opponentId]||opponentId===g.clubId)throw Error('Hãy chọn một CLB khác để đá giao hữu.');
 if(!validCareerDate(date)||daysBetween(date,g.date)<4||daysBetween(date,g.date)>120)throw Error('Chọn ngày giao hữu cách hôm nay từ 4 đến 120 ngày.');
 if(!TOUR_MARKETS[market])throw Error('Thị trường du đấu không hợp lệ.');
 const state=g.friendlyInvitations;
 const retained=new Set(g.friendlies.filter(f=>!f.result&&!f.cancelled||f.date>=addCareerDays(g.date,-370)).map(f=>f.id));
 g.friendlies=g.friendlies.filter(f=>retained.has(f.id)).slice(-450);
 const kept=new Set(g.friendlies.map(f=>f.id));state.items=state.items.filter(x=>!x.fixtureId||kept.has(x.fixtureId));
 if(state.items.filter(x=>x.status==='pending').length>=12)throw Error('Hãy đợi phản hồi các lời mời đã gửi.');
 if(state.items.some(x=>['pending','accepted'].includes(x.status)&&x.opponentId===opponentId&&Math.abs(daysBetween(x.date,date))<7))throw Error('Đã có lời mời hoặc trận giao hữu với đối thủ này trong tuần đó.');
 const conflict=friendlyConflict(g,opponentId,date,market);if(conflict)throw Error(conflict);
 const id=`invitation-${++state.sequence}`,replyOn=addCareerDays(g.date,1+hash(`${g.id}:${id}:reply`)%3);
 const item={id,opponentId,date,market,status:'pending',sentOn:g.date,replyOn,reason:'',fixtureId:null};state.items.unshift(item);state.items=state.items.filter((x,i)=>i<200||x.status==='pending'||x.status==='accepted');
 mail(g,'Đã gửi lời mời giao hữu',`${g.clubs[opponentId].name} được mời thi đấu ngày ${date} tại ${TOUR_MARKETS[market].label}. Dự kiến nhận phản hồi vào ${replyOn}.`);return item;
}
export function withdrawFriendlyInvitation(g,id){
 const item=g.friendlyInvitations?.items.find(x=>x.id===id);
 if(!item||item.status!=='pending'||g.liveMatch)throw Error('Không thể rút lời mời này.');
 item.status='withdrawn';item.reason='HLV rút lời mời trước khi có phản hồi.';
}
export function processFriendlyInvitations(g){
 if(!dailyCareer(g))return [];
 const replies=[];
 for(const item of g.friendlyInvitations.items.filter(x=>x.status==='pending'&&x.replyOn<=g.date)){
  const other=g.clubs[item.opponentId],own=g.clubs[g.clubId],conflict=friendlyConflict(g,item.opponentId,item.date,item.market);
  // Future call-ups are not known with certainty. Recheck actual availability on match day.
  const ownPool=Object.values(g.players).filter(p=>p.clubId===own.id&&fit(p)),otherPool=Object.values(g.players).filter(p=>p.clubId===other.id&&fit(p));
  let reason=conflict;
  if(!reason&&item.date<=g.date)reason='Ngày thi đấu đề xuất đã qua.';
  if(!reason&&daysBetween(item.date,g.date)<8&&(ownPool.length<11||otherPool.length<11))reason='Lực lượng hiện tại không đủ để nhận thêm một trận giao hữu.';
  const gap=other.reputation-own.reputation,travel=item.market==='home'?0:TOUR_MARKETS[item.market].travelDays;
  const chance=Math.max(20,Math.min(94,83-gap*.9-travel*3));
  if(!reason&&hash(`${g.id}:${item.id}:${item.opponentId}:accept`)%100>=chance)reason=gap>15?'Đối thủ ưu tiên kế hoạch chuẩn bị khác và từ chối lời mời.':'Đối thủ từ chối vì kế hoạch tập luyện và di chuyển của họ.';
  if(reason){item.status='rejected';item.reason=reason;}
  else{
   const id=`friendly-${g.id}-${item.id}`,round=g.calendar.findIndex(s=>s.date>=item.date);
   const f={id,leagueId:'friendly',stage:'friendly',year:g.year,round:round<0?g.calendar.length:round,date:item.date,home:g.clubId,away:other.id,result:null,neutral:item.market!=='home',tourMarket:item.market,invitationId:item.id};
   g.friendlies.push(f);item.status='accepted';item.fixtureId=id;item.reason='Đã xác nhận lịch giao hữu.';
  }
  const body=`${other.name} ${item.status==='accepted'?'đồng ý':'từ chối'} giao hữu ngày ${item.date} tại ${TOUR_MARKETS[item.market].label}. ${item.reason}`;
  mail(g,'Phản hồi lời mời giao hữu',body,true);replies.push(item);
 }
 return replies;
}
export function checkFriendlyMatchday(g){
 for(const f of (g.friendlies||[]).filter(f=>!f.result&&!f.cancelled)){
  const conflict=friendlyConflict(g,f.away,f.date,f.tourMarket||'home',f.id);
  if(conflict){f.cancelled=true;f.cancellationReason=conflict;mail(g,'Điều chỉnh lịch giao hữu',`${g.clubs[f.away].name}, ${f.date}: ${conflict}`,true);continue;}
  if(f.date>g.date)continue;
  const missing=[f.home,f.away].filter(id=>{const ps=Object.values(g.players).filter(p=>p.clubId===id&&fit(p));return ps.length<7||!ps.some(p=>p.position==='GK');});
  if(missing.length){f.cancelled=true;f.cancellationReason='Không đủ cầu thủ hoặc thủ môn sau chấn thương / triệu tập đội tuyển.';mail(g,'Trận giao hữu phải hủy',`${g.clubs[f.home].name} – ${g.clubs[f.away].name}, ${f.date}: ${f.cancellationReason}`,true);}
 }
}
export function tourStadium(fixture,date){
 const market=TOUR_MARKETS[fixture.tourMarket];if(!market||fixture.tourMarket==='home')return null;
 return {id:`tour-${fixture.tourMarket}`,clubId:null,name:`SVĐ du đấu ${market.city} (mô phỏng)`,city:market.city,countryCode:market.countryCode,capacity:market.capacity,capacityEstimated:true,nameEstimated:true,estimated:true,sourceName:'Touchline',sourceUrl:'',sourceDate:'',checkedAt:date,capacityNote:'Sân du đấu và sức chứa do game mô phỏng.',pitchLength:105,pitchWidth:68,pitchDimensionsEstimated:true};
}
export function validateFriendlyInvitations(g){
 if(!dailyCareer(g)){if(g.friendlyInvitations!==undefined)throw Error('Lời mời cần lịch từng ngày.');return true;}
 const s=g.friendlyInvitations,fail=()=>{throw Error('Dữ liệu lời mời giao hữu không hợp lệ.');};
 if(!s||s.version!==1||!Number.isSafeInteger(s.sequence)||s.sequence<0||!Array.isArray(s.items)||s.items.length>500)fail();
 const ids=new Set();
 for(const x of s.items){if(!x||typeof x.id!=='string'||ids.has(x.id)||!g.clubs[x.opponentId]||x.opponentId===g.clubId||![x.date,x.sentOn,x.replyOn].every(validCareerDate)||x.sentOn>=x.replyOn||x.replyOn>=x.date||!TOUR_MARKETS[x.market]||!['pending','accepted','rejected','withdrawn'].includes(x.status)||typeof x.reason!=='string'||x.reason.length>1000)fail();ids.add(x.id);if(x.status==='accepted'&&!g.friendlies.some(f=>f.id===x.fixtureId&&f.away===x.opponentId&&f.date===x.date&&f.tourMarket===x.market))fail();}
 for(const f of g.friendlies)if(f.tourMarket!==undefined&&(!TOUR_MARKETS[f.tourMarket]||f.neutral!==(f.tourMarket!=='home')))fail();
 return true;
}
