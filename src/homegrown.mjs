// Verified football-registration evidence is separate from editable training
// flags. Importing this index never changes a manager's submitted squad lists.
const DAY=86400000;
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s));
const nextDay=s=>new Date(Date.parse(s)+DAY).toISOString().slice(0,10);
const addYears=(s,n)=>`${Number(s.slice(0,4))+n}${s.slice(4)}`;
const normalize=s=>String(s||'').normalize('NFKD').replace(/\p{M}/gu,'').replace(/[øØ]/g,'o').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
export const trainingAssociationFor=(g,id)=>{const cc=g.leagues?.find(l=>l.id===g.clubs?.[id]?.leagueId)?.countryCode||'';return cc==='EU'?g.homegrownMeta?.uefaClubs?.find(x=>x.clubId===id)?.association||'':cc;};
const associationFor=trainingAssociationFor;
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
  if(!row.uefaSquads&&old.uefaSquads)next.uefaSquads=old.uefaSquads;
  if(JSON.stringify(old)!==JSON.stringify(next)){p.homegrownVerified=next;updated++;}
 }
 g.homegrownMeta={...(g.homegrownMeta||{}),...(structuredClone(index?.meta||{}))};
 return {updated,skipped,total:records.length};
}

function unionIntervals(intervals){
 const sorted=intervals.filter(([a,b])=>a<=b).sort((a,b)=>a[0].localeCompare(b[0]));
 const result=[];
 for(const [start,end] of sorted){const last=result.at(-1);if(last&&start<=last[1])last[1]=end>last[1]?end:last[1];else result.push([start,end]);}
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
 const endOf=x=>x.datePrecision==='provider-inclusive'?nextDay(x.end):x.end;
 const minimum=addYears(birth,15),maximum=addYears(birth,21);
 const qualifying=xs=>{
  const intervals=unionIntervals(xs.map(x=>[x.start>minimum?x.start:minimum,[endOf(x),maximum,asOf].sort()[0]]));
  if(intervals.reduce((sum,[start,end])=>sum+wholeMonths(start,end),0)>=36)return true;
  const seasons=new Map();
  for(const x of xs)for(const season of x.entireSeasons||[]){
   if(eligibleEntireSeason(season,birth,asOf)&&x.start<=season.start&&x.end>=season.end)seasons.set(`${season.start}/${season.end}`,season);
  }
  return seasons.size>=3;
 };
 const atClub=periods.filter(x=>x.clubId===clubId),atAssociation=periods.filter(x=>x.association===association);
 const club=qualifying(atClub),local=qualifying(atAssociation);
 const continuous=unionIntervals(atClub.filter(x=>x.eligible!==false).map(x=>[x.start>minimum?x.start:minimum,endOf(x)<asOf?endOf(x):asOf]));
 let listB=continuous.some(([start,end])=>wholeMonths(start,end)>=24);
 // Separate exception for an actual 16-year-old registered for the previous
 // two years, including time before their 15th birthday (UEFA 31.12).
 if(!listB&&asOf>=addYears(birth,16)&&asOf<addYears(birth,17)){
  listB=unionIntervals(atClub.filter(x=>x.eligible!==false).map(x=>[x.start,endOf(x)<asOf?endOf(x):asOf]))
   .some(([start,end])=>end===asOf&&start<=addYears(asOf,-2));
 }
 // A source may prove non-local status only when it covers the entire expanded
 // age window abroad. Incomplete academy histories never become negative flags.
 const windowStart=`${Number(birth.slice(0,4))+15-(birth.slice(5)<'07-01'?1:0)}-07-01`;
 const windowEnd=[`${Number(birth.slice(0,4))+21+(birth.slice(5)>='07-01'?1:0)}-06-30`,asOf].sort()[0];
 const all=unionIntervals(periods.map(x=>[x.start,endOf(x)<asOf?endOf(x):asOf]));
 const complete=all.some(([a,b])=>a<=windowStart&&b>=windowEnd);
 const localTime=atAssociation.some(x=>x.start<=windowEnd&&endOf(x)>=windowStart);
 return {club,association:club||local,listB:p.clubId===clubId&&listB,known:club||local||!!association&&complete&&!localTime,periods,complete};
}

export function officialUefaRegistration(g,p,clubId=p.clubId){
 return (p.homegrownVerified?.uefaSquads||[]).find(x=>x.clubId===clubId&&x.season===`${g.year}/${String(g.year+1).slice(-2)}`&&['A','B'].includes(x.list)&&x.source?.startsWith('https://www.uefa.com/'))||null;
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
 const uefa=officialUefaRegistration(g,p,clubId),officialB=uefa?.list==='B'&&uefa.observedAt<=g.date&&p.clubId===clubId;
 return {club,association:club||association,known:override||club||association||history.known||pl!==undefined,source:source||'',evidence,derived:!override&&(history.club||history.association||!!training.derived),verified:!override&&!!(data.pl||history.periods.length),override,
  listB:override?!!training.listBClubs?.includes(clubId):history.listB||officialB||!!training.listBClubs?.includes(clubId),
  uefa,records:history.periods,plStatus:pl,asOf:data.asOf||data.pl?.verifiedAt||training.verifiedAt||''};
}
