/** Public source observations; no saves, rosters or immutable releases are edited.
 * node scripts/import-player-reality.mjs [--offline] [--as-of YYYY-MM-DD]
 * Team observations are refreshed, detailed profiles reuse their dated cache.
 * Missing detail profiles are fetched only for newly verified identities.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {normalizeSourceAvailability, normalizeSourcePerformance, calibratePerformance} from '../src/playerReality.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), offline = args.includes('--offline');
const asOf = args.includes('--as-of') ? args[args.indexOf('--as-of') + 1] : new Date().toISOString().slice(0,10);
if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) throw Error('Invalid --as-of date');
const importedAt = new Date().toISOString();
const db = JSON.parse(await fs.readFile(path.join(root,'public/data/database.json'),'utf8'));
const cache = path.join(root,'.cache'), errors = [];
await fs.mkdir(cache,{recursive:true});
const cachePath = url => path.join(cache,crypto.createHash('sha256').update(url).digest('hex'));
const norm = text => String(text || '').toLowerCase().replaceAll('đ','d').replaceAll('ø','o').replaceAll('ł','l').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
const validNumber = x => typeof x === 'number' && Number.isFinite(x) && x >= 0;
async function cached(url) {
  try {const f=cachePath(url);const [raw,stat]=await Promise.all([fs.readFile(f,'utf8'),fs.stat(f)]);return {data:JSON.parse(raw),observedAt:stat.mtime.toISOString(),cached:true};} catch {return null;}
}
async function get(url,{refresh=false}={}) {
  const prior=await cached(url);
  if (offline || !refresh && prior) return prior;
  // Three workers and a pause between requests keep the public API load modest.
  await new Promise(resolve=>setTimeout(resolve,150));
  try {
    const response=await fetch(url,{headers:{'User-Agent':'TouchlineLocal/1.8 (personal football source snapshot)'},signal:AbortSignal.timeout(25000)});
    if (!response.ok) throw Error(`HTTP ${response.status}`);
    const data=await response.json();
    await fs.writeFile(cachePath(url),JSON.stringify(data));
    return {data,observedAt:new Date().toISOString(),cached:false};
  } catch(error) {errors.push({url,error:error.message,cachedFallback:!!prior});return prior;}
}
async function pool(items,task) {let next=0;await Promise.all(Array.from({length:3},async()=>{while(next<items.length){const i=next++;await task(items[i],i);}}));}
const byId = new Map(db.players.map(p=>[p.id,p])), bySource=new Map(), byIdentity=new Map();
const profiles=new Map(), teamIds=new Set(), clubById=new Map(db.clubs.map(c=>[c.id,c]));
for (const p of db.players) {
  const fid=p.fotmobId || (p.id.startsWith('f') ? Number(p.sourceId) : null);
  if(fid)bySource.set(Number(fid),p);
  if(p.birthDate){const key=norm(p.name)+'|'+p.birthDate;const group=byIdentity.get(key)||[];group.push(p);byIdentity.set(key,group);}
  if(!fid)continue;
  const profile=await cached(`https://www.fotmob.com/api/data/playerData?id=${fid}`);
  if(profile?.data?.id===Number(fid)) {profiles.set(p.id,profile);if(profile.data.primaryTeam?.teamId)teamIds.add(profile.data.primaryTeam.teamId);}
}
for(const c of db.clubs)if(c.id.startsWith('f'))teamIds.add(Number(c.id.slice(1)));
function discoverTeams(value) {
  if(Array.isArray(value)){for(const child of value)discoverTeams(child);return;}
  if(!value || typeof value!=='object')return;
  if(value.id && typeof value.pageUrl==='string' && value.pageUrl.startsWith('/teams/'))teamIds.add(Number(value.id));
  for(const child of Object.values(value))discoverTeams(child);
}
await pool([47,54,53,55,87,61,57,9088],async id=>{const result=await get(`https://www.fotmob.com/api/data/leagues?id=${id}`,{refresh:true});if(result)discoverTeams(result.data.table);});
const observations={}, freshTeams=new Set();
function recordProfile(p,profile) {
  const d=profile.data,sourceUrl=`https://www.fotmob.com/players/${d.id}`;
  const performance=normalizeSourcePerformance(d.mainLeague);
  if(performance)performance.observedAt=profile.observedAt;
  const values=(d.marketValues?.values||[]).filter(v=>v.currency==='EUR'&&validNumber(v.value)&&v.value>0&&String(v.date).slice(0,10)<=asOf).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  const latest=values.at(-1);
  const marketValue=latest ? {eur:latest.value,lowerEUR:validNumber(latest.lowerBound)?latest.lowerBound:null,upperEUR:validNumber(latest.upperBound)?latest.upperBound:null,asOf:latest.date.slice(0,10),provider:latest.source==='scisports'?'SciSports via FotMob':String(latest.source||'FotMob'),kind:'provider_estimate'} : null;
  observations[p.id]={playerId:p.id,fotmobId:Number(d.id),observedAt:profile.observedAt,detailObservedAt:profile.observedAt,sourceUrl,sourceClub:d.primaryTeam?.teamName||null,marketValue,
    contractUntil:d.contractEnd?.utcTime?.slice(0,10)||null,performance,availability:normalizeSourceAvailability(d.injuryInformation,{observedAt:profile.observedAt,sourceUrl}),calibration:Number(performance?.season?.slice(0,4))>=Number(asOf.slice(0,4))-1?calibratePerformance(performance):null};
}
for(const [pid,profile]of profiles)recordProfile(byId.get(pid),profile);
const missingProfiles=new Map();
await pool([...teamIds].sort((a,b)=>a-b),async(tid,i)=>{
  const result=await get(`https://www.fotmob.com/api/data/teams?id=${tid}`,{refresh:true});
  if(!result?.data?.details?.id)return;
  const d=result.data,groups=Array.isArray(d.squad)?d.squad:d.squad?.squad||[];
  const currentObservation=result.observedAt.slice(0,10)===asOf;
  if(currentObservation)freshTeams.add(tid);
  for(const group of groups)for(const row of group.title==='coach'?[]:group.members||[]){
    let p=bySource.get(Number(row.id));
    if(!p){const found=byIdentity.get(norm(row.name)+'|'+row.dateOfBirth);if(found?.length===1)p=found[0];}
    if(!p)continue;
    const prior=observations[p.id] || {playerId:p.id,fotmobId:Number(row.id),sourceUrl:`https://www.fotmob.com/players/${row.id}`,contractUntil:null,performance:null,calibration:null};
    const oldInjury=profiles.get(p.id)?.data?.injuryInformation;
    const injury=row.injury ? {...(oldInjury?.key===`injury_${row.injury.id}`?oldInjury:{}),expectedReturn:row.injury.expectedReturn || oldInjury?.expectedReturn} : null;
    prior.observedAt=result.observedAt;
    prior.availability=normalizeSourceAvailability(injury,{observedAt:result.observedAt,sourceUrl:`https://www.fotmob.com/teams/${tid}/squad`,confirmedCurrent:currentObservation});
    if(row.injured && !row.injury)prior.availability={...prior.availability,status:'injured',description:'Injury reported',currentConfirmed:currentObservation};
    if(validNumber(row.transferValue)&&row.transferValue>0){
      const previous=prior.marketValue;
      prior.marketValue=previous?.eur===row.transferValue?previous:{eur:row.transferValue,lowerEUR:null,upperEUR:null,asOf:result.observedAt.slice(0,10),provider:'FotMob',kind:'provider_estimate'};
    }
    const season=d.details.latestSeason||d.overview?.season;
    if(!prior.performance&&season){prior.performance={season:String(season),observedAt:result.observedAt,competitionId:String(d.details.primaryLeagueId||''),competitionName:d.details.primaryLeagueName||'',rating:validNumber(row.rating)?row.rating:null,appearances:null,minutes:null,goals:validNumber(row.goals)?row.goals:null,assists:validNumber(row.assists)?row.assists:null,yellowCards:validNumber(row.ycards)?row.ycards:null,redCards:validNumber(row.rcards)?row.rcards:null};}
    observations[p.id]=prior;
    if(!profiles.has(p.id)&&!p.id.startsWith('f'))missingProfiles.set(p.id,{p,fid:row.id});
  }
  if(i%30===0)console.log(`Team observations ${i+1}/${teamIds.size}; matched players ${Object.keys(observations).length}`);
});
// New cross-provider joins require both normalized name and exact DOB again in
// the individual profile. Existing saved FotMob IDs are authoritative mappings.
await pool([...missingProfiles.values()],async({p,fid},i)=>{
  const profile=await get(`https://www.fotmob.com/api/data/playerData?id=${fid}`);
  if(!profile||Number(profile.data.id)!==Number(fid))return;
  if(!bySource.has(Number(fid))&&(norm(profile.data.name)!==norm(p.name)||profile.data.birthDate?.utcTime?.slice(0,10)!==p.birthDate))return;
  const previous=observations[p.id];recordProfile(p,profile);
  if(previous?.availability?.currentConfirmed){observations[p.id].availability={...observations[p.id].availability,...previous.availability,description:profile.data.injuryInformation?.name||previous.availability.description};observations[p.id].observedAt=previous.observedAt;}
  if(i%100===0)console.log(`New detailed profiles ${i+1}/${missingProfiles.size}`);
});
const coverage={totalPlayers:db.players.length,observations:Object.keys(observations).length,marketValues:0,performanceRatings:0,calibrated:0,injuryReports:0,suspensionReports:0,confirmedCurrentAvailability:0,freshTeams:freshTeams.size,sourceFailures:errors.length,byLeague:{}};
for(const p of db.players){const league=clubById.get(p.clubId)?.leagueId||'unknown';const c=coverage.byLeague[league]??={total:0,observed:0,marketValues:0};c.total++;const o=observations[p.id];if(!o)continue;c.observed++;if(o.marketValue){coverage.marketValues++;c.marketValues++;}if(o.performance?.rating!=null)coverage.performanceRatings++;if(o.calibration)coverage.calibrated++;if(['injured','doubtful'].includes(o.availability?.status))coverage.injuryReports++;if(o.availability?.status==='reported_suspended')coverage.suspensionReports++;if(o.availability?.currentConfirmed)coverage.confirmedCurrentAvailability++;}
const snapshot={version:1,asOf,importedAt,sources:[{name:'FotMob public player and squad data',url:'https://www.fotmob.com'},{name:'SciSports market-value estimates as published by FotMob',url:'https://www.fotmob.com'}],notes:['Market values are provider estimates, not asking prices or verified transfer fees.','1–20 skills and potential remain game estimates; sample-shrunk form calibration is labeled separately.','Yellow/red card totals are season statistics, not active bans. Unknown ban duration or competition is not invented.','Injury reports retain observed and source dates. No report does not establish that a player is healthy.','Coverage is incomplete. Missing values remain unknown and existing simulated careers are not updated.'],coverage,players:observations};
if(coverage.observations<100)throw Error('Too few verified observations; refusing to replace the existing snapshot.');
await fs.writeFile(path.join(root,'public/data/player-reality.json'),JSON.stringify(snapshot));
await fs.writeFile(path.join(cache,'player-reality-import-errors.json'),JSON.stringify(errors,null,2));
console.log(JSON.stringify(coverage,null,2));
