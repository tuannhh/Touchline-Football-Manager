import {available,createMatch,currentFixture,fixtureById} from './engine.mjs';
import {matchdayRule} from './matchday.mjs';
import {registered,registrationReport,registrationRule} from './registration.mjs';
import {assignedStaff} from './staff.mjs';

function fixtureForPreparation(g,id){
 if(g.liveMatch)throw Error('Hãy hoàn tất trận đấu đang diễn ra.');
 const fixture=fixtureById(g,id);
 const own=fixture&&(fixture.home===g.clubId||fixture.away===g.clubId);
 const current=fixture?.leagueId==='friendly'
  ?fixture.round===g.round&&fixture.year===g.year&&fixture.home===g.clubId
  :currentFixture(g)?.id===id;
 if(!own||!current||fixture.result||fixture.cancelled)throw Error('Trận đấu không còn ở mốc lịch hiện tại.');
 return fixture;
}

/** Opening preparation never creates a match, advances time or changes selections. */
export function prepareMatch(g,id=currentFixture(g)?.id){
 const fixture=fixtureForPreparation(g,id);
 return {careerId:g.id,fixtureId:fixture.id,clubId:g.clubId,round:g.round,year:g.year};
}

/** Report invalid selections rather than silently replacing the manager's choices. */
export function preMatchReport(g,fixture){
 const errors=[],rule=matchdayRule(g,fixture.leagueId),lineup=g.lineup||[],bench=g.bench||[],seen=new Set();
 if(lineup.length!==11||lineup.filter(Boolean).length<7)errors.push('Đội hình xuất phát cần từ 7 đến 11 cầu thủ.');
 if(bench.length>rule.maxBench)errors.push(`Danh sách dự bị vượt giới hạn ${rule.maxBench} cầu thủ.`);
 for(const id of [...lineup.filter(Boolean),...bench]){
  const p=g.players[id];
  if(!p||p.clubId!==g.clubId){errors.push('Danh sách trận có cầu thủ không thuộc CLB.');continue;}
  if(seen.has(id))errors.push(`${p.name}: bị trùng trong danh sách trận.`);
  seen.add(id);
  if(!available(p)||!registered(g,p,fixture.leagueId))errors.push(`${p.name}: không đủ điều kiện thi đấu. Hãy thay cầu thủ này.`);
 }
 if(g.registrations?.[fixture.leagueId]?.[g.clubId]&&registrationRule(g,fixture.leagueId).mode==='enforced'){
  if(!registrationReport(g,fixture.leagueId,g.clubId).valid)errors.push('Danh sách đăng ký chưa hợp lệ. Hãy mở Đăng ký đội hình.');
 }
 return {valid:errors.length===0,errors:[...new Set(errors)],rule,starters:lineup.filter(Boolean).length,reserves:bench.length};
}

/** Called only by the explicit confirmation action; rechecks the latest career. */
export function kickOffPreparedMatch(g,preparation){
 if(!preparation||preparation.careerId!==g.id||preparation.clubId!==g.clubId||preparation.round!==g.round||preparation.year!==g.year)throw Error('Hãy mở lại phần chuẩn bị cho trận đấu hiện tại.');
 const fixture=fixtureForPreparation(g,preparation.fixtureId),report=preMatchReport(g,fixture);
 if(!report.valid)throw Error(report.errors.join('\n'));
 if(fixture.leagueId==='friendly'&&assignedStaff(g,'friendlies'))throw Error('Trận giao hữu đã được giao cho ban huấn luyện. Hãy trở lại mục Ban huấn luyện.');
 const match=createMatch(g,fixture);
 // Older careers without a bench version still use the explicitly reviewed list.
 const side=fixture.home===g.clubId?0:1;
 match.bench[side]=[...(g.bench||[])];
 if(match.friendly){match.coachId='manager';match.coachName=g.manager;fixture.coachId=match.coachId;fixture.coachName=match.coachName;}
 g.liveMatch=match;
 return match;
}
