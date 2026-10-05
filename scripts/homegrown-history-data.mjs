import {verifiedProfileIdentity} from './player-reality-data.mjs';
const day=86400000;
const date=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}/.test(s)?s.slice(0,10):null;
const plus=(s,n)=>new Date(Date.parse(s)+n*day).toISOString().slice(0,10);
export function normalizeCareerPeriods(player,profile,{observedAt,resolveTeam}){
 if(!verifiedProfileIdentity(player,profile,profile?.id)||!date(observedAt))return [];
 const source=`https://www.fotmob.com/players/${profile.id}`,entries=[];
 for(const group of ['senior','youth'])for(const entry of profile.careerHistory?.careerItems?.[group]?.teamEntries||[]){
  const start=date(entry.startDate),end=date(entry.endDate)||observedAt,team=resolveTeam(entry);
  if(entry.hasUncertainData||Number(entry.participantId)!==Number(profile.id)||!start||start>end||start>observedAt)continue;
  entries.push({...team,sourceTeamId:entry.teamId,sourceTeamName:entry.team,start,end:end<observedAt?end:observedAt,isLoan:entry.transferType?.localizationKey==='on_loan',group});
 }
 const periods=[];
 for(const e of entries){
  // Even an unresolved loan must cut a parent interval. Missing association
  // evidence prevents emitting that loan, not pretending the player stayed.
  if(!e.association)continue;
  let parts=[[e.start,e.end]];
  // Loans can overlap an academy/parent entry. That time belongs to the loan
  // club and cannot also qualify as training at the parent club.
  for(const loan of entries.filter(x=>x.isLoan&&x.sourceTeamId!==e.sourceTeamId&&(!x.clubId||x.clubId!==e.clubId))){
   parts=parts.flatMap(([a,b])=>loan.start>b||loan.end<a?[[a,b]]:[...(a<loan.start?[[a,plus(loan.start,-1)]]:[]),...(b>loan.end?[[plus(loan.end,1),b]]:[])]);
  }
  for(const [start,end]of parts)periods.push({clubId:e.clubId||null,association:e.association,start,end,verified:true,eligible:true,isLoan:e.isLoan,sourceType:'career-provider',datePrecision:'provider-inclusive',source,sourceTeamId:e.sourceTeamId,sourceTeamName:e.sourceTeamName,associationSource:e.source,verifiedAt:observedAt,
   evidence:`FotMob · ${e.sourceTeamName}: ${start} – ${end}${e.isLoan?' (cho mượn)':''}. Hồ sơ khớp tên và ngày sinh; lịch sử nhà cung cấp có thể chưa bao gồm toàn bộ học viện.`});
 }
 return periods;
}
