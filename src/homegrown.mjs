// Verified football-registration evidence is separate from editable training
// flags. Importing this index never changes a manager's submitted squad lists.
const DAY=86400000;
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s));
const addYears=(s,n)=>`${Number(s.slice(0,4))+n}${s.slice(4)}`;
const normalize=s=>String(s||'').normalize('NFKD').replace(/\p{M}/gu,'').replace(/[øØ]/g,'o').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const associationFor=(g,id)=>g.leagues?.find(l=>l.id===g.clubs?.[id]?.leagueId)?.countryCode||'';
export const isTrainingOverride=p=>!!p.training?.reviewed&&!p.training?.derived||/người chơi|touchline editor|user override/i.test(p.training?.source||'');

export function mergeHomegrown(g,index){
 const records=Array.isArray(index?.players)?index.players:Object.values(index?.players||{});
 let updated=0,skipped=0;
 for(const row of records){
  const p=g.players?.[row.id||row.playerId];
  if(!p||normalize(p.name)!==normalize(row.name)||(p.birthDate&&row.birthDate&&p.birthDate!==row.birthDate)){skipped++;continue;}
  const old=p.homegrownVerified||{},next={...old,...structuredClone(row)};
  // Independent evidence types can be refreshed without discarding the other.
  if(!row.pl&&old.pl)next.pl=old.pl;
  if(!row.periods&&old.periods)next.periods=old.periods;
  if(JSON.stringify(old)!==JSON.stringify(next)){p.homegrownVerified=next;updated++;}
 }
 g.homegrownMeta={...(g.homegrownMeta||{}),...(structuredClone(index?.meta||{}))};
 return {updated,skipped,total:records.length};
}

function unionIntervals(intervals){
 const sorted=intervals.filter(([a,b])=>a<=b).sort((a,b)=>a[0].localeCompare(b[0]));
 const result=[];
 for(const [start,end] of sorted){const last=result.at(-1);if(last&&Date.parse(start)<=Date.parse(last[1])+DAY)last[1]=end>last[1]?end:last[1];else result.push([start,end]);}
 return result;
}
function wholeMonths(start,end){
 let months=(Number(end.slice(0,4))-Number(start.slice(0,4)))*12+Number(end.slice(5,7))-Number(start.slice(5,7));
 if(end.slice(8)<start.slice(8))months--;
 return Math.max(0,months);
}
// Explicit complete-season records must contain the actual first/last league
// match dates. Year labels alone cannot prove three complete seasons.
function eligibleEntireSeason(season,birthDate,asOf){
 if(!season.verified||!validDate(season.start)||!validDate(season.end)||season.end>asOf||season.start>season.end)return false;
 const min=addYears(birthDate,15),max=addYears(birthDate,21);
 const summer=season.calendar==='summer';
 const seasonStart=`${season.start.slice(0,4)}-${summer?'01-01':'07-01'}`;
 const seasonEnd=`${season.end.slice(0,4)}-${summer?'12-31':'06-30'}`;
 // UEFA 31.06/07 include the season in which 15/21 is reached, including
 // birthdays in the gap between the championship and June/December year-end.
 return min<=seasonEnd&&max>=seasonStart;
}

export function assessTrainingHistory(p,clubId,association,asOf='2026-10-03'){
 const data=p.homegrownVerified||{},birth=p.birthDate||data.birthDate;
 if(!validDate(birth)||!validDate(asOf))return {club:false,association:false,listB:false,known:false,periods:[]};
 const periods=(data.periods||[]).filter(x=>x.verified===true&&validDate(x.start)&&validDate(x.end)&&x.start<=x.end&&x.source);
 const minimum=addYears(birth,15),maximum=addYears(birth,21);
 const qualifying=xs=>{
  const intervals=unionIntervals(xs.map(x=>[x.start>minimum?x.start:minimum,[x.end,maximum,asOf].sort()[0]]));
  if(intervals.reduce((sum,[start,end])=>sum+wholeMonths(start,end),0)>=36)return true;
  const seasons=new Map();
  for(const x of xs)for(const season of x.entireSeasons||[]){
   if(eligibleEntireSeason(season,birth,asOf)&&x.start<=season.start&&x.end>=season.end)seasons.set(`${season.start}/${season.end}`,season);
  }
  return seasons.size>=3;
 };
 const atClub=periods.filter(x=>x.clubId===clubId),atAssociation=periods.filter(x=>x.association===association);
 const club=qualifying(atClub),local=qualifying(atAssociation);
 const continuous=unionIntervals(atClub.filter(x=>x.eligible!==false).map(x=>[x.start>minimum?x.start:minimum,x.end<asOf?x.end:asOf]));
 let listB=continuous.some(([start,end])=>wholeMonths(start,end)>=24);
 // Separate exception for an actual 16-year-old registered for the previous
 // two years, including time before their 15th birthday (UEFA 31.12).
 if(!listB&&asOf>=addYears(birth,16)&&asOf<addYears(birth,17)){
  listB=unionIntervals(atClub.filter(x=>x.eligible!==false).map(x=>[x.start,x.end<asOf?x.end:asOf]))
   .some(([start,end])=>end===asOf&&start<=addYears(asOf,-2));
 }
 return {club,association:club||local,listB:p.clubId===clubId&&listB,known:club||local,periods};
}

export function verifiedTrainingStatus(g,p,competitionId,clubId=p.clubId){
 const cc=associationFor(g,clubId),data=p.homegrownVerified||{},history=assessTrainingHistory(p,clubId,cc,g.date||`${g.year||2026}-08-15`);
 const training=p.training||{},override=isTrainingOverride(p),plRule=competitionId==='eng.1'||competitionId==='eng.2'||competitionId==='eng.3';
 const legacyClub=!!training.clubs?.includes(clubId),legacyAssociation=legacyClub||!!training.associations?.includes(cc)||!!training.clubs?.some(id=>cc&&associationFor(g,id)===cc);
 const importedPL=data.pl?(typeof data.pl.association==='boolean'?data.pl.association:undefined):(training.plAssociation??p.homegrown?.EN?.association);
 const pl=plRule?(override?training.plAssociation:importedPL):undefined;
 const club=override?legacyClub:legacyClub||history.club;
 const association=override?(plRule&&pl!==undefined?!!pl:legacyAssociation):(plRule&&pl!==undefined?pl===true:legacyAssociation||history.association);
 const source=override?training.source:(plRule&&data.pl?data.pl.source:(history.periods.find(x=>x.clubId===clubId)||history.periods[0])?.source||training.source||(pl!==undefined?p.homegrown?.EN?.source:''));
 const evidence=override?(training.evidence||'Hồ sơ do người chơi xác nhận.'):(plRule&&data.pl?data.pl.evidence:history.periods.map(x=>x.evidence).filter(Boolean).join(' ')||training.evidence||'');
 return {club,association:club||association,known:override||club||association||pl!==undefined,source:source||'',evidence,derived:!override&&(history.club||history.association||!!training.derived),verified:!override&&!!(data.pl||history.periods.length),override,
  listB:override?!!training.listBClubs?.includes(clubId):history.listB||!!training.listBClubs?.includes(clubId),
  records:history.periods,plStatus:pl,asOf:data.asOf||data.pl?.verifiedAt||training.verifiedAt||''};
}
