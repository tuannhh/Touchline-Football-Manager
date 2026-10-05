/** Rebuild training evidence from identity-checked, dated public career profiles.
 * Uses the existing FotMob observation cache; does not pretend a cache is live.
 * node scripts/import-homegrown-history.mjs [--as-of YYYY-MM-DD]
 * Never edits a save or an immutable roster release.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {normalizeIdentity as norm,verifiedProfileIdentity,sourceGameClubId} from './player-reality-data.mjs';
import {normalizeCareerPeriods} from './homegrown-history-data.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2),asOf=args.includes('--as-of')?args[args.indexOf('--as-of')+1]:new Date().toISOString().slice(0,10);
if(!/^\d{4}-\d{2}-\d{2}$/.test(asOf))throw Error('Invalid date');
const read=async name=>JSON.parse(await fs.readFile(path.join(root,name),'utf8'));
const db=await read('public/data/database.json'),reality=await read('public/data/player-reality.json'),index=await read('public/data/homegrown.json');
const profiles=[],byTeam=new Map(),byName=new Map(),leagues=new Map(db.leagues.map(l=>[l.id,l]));
const clubAssociation=c=>{const cc=leagues.get(c.leagueId)?.countryCode;return cc==='EU'?index.meta.uefaClubs?.find(x=>x.clubId===c.id)?.association:cc;};
const clubCache=new Map();
const clubAliases={9823:'e132',8686:'e104',8636:'e110'};
const clubIdFor=(id,name)=>{if(clubAliases[id])return clubAliases[id];const key=`${id}:${name}`;if(!clubCache.has(key))clubCache.set(key,sourceGameClubId(db.clubs,id,name));return clubCache.get(key);};
function team(id,name,clubId,association,source){
 if(!(Number(id)>0)||!association||association==='EU')return;
 const old=byTeam.get(Number(id));
 if(old&&(old.clubId!==clubId||old.association!==association))return;
 const value={clubId,association,source,sourceTeamId:Number(id),sourceTeamName:name};byTeam.set(Number(id),value);
 if(name){const key=norm(name),xs=byName.get(key)||[];if(!xs.some(x=>x.clubId===clubId&&x.association===association))xs.push(value);byName.set(key,xs);}
}
for(const p of db.players){
 const r=reality.players[p.id];if(!r?.fotmobId)continue;
 const url=`https://www.fotmob.com/api/data/playerData?id=${r.fotmobId}`,file=path.join(root,'.cache',crypto.createHash('sha256').update(url).digest('hex'));
 try{
  const raw=JSON.parse(await fs.readFile(file,'utf8'));
  if(!verifiedProfileIdentity(p,raw,r.fotmobId))continue;
  const observedAt=(await fs.stat(file)).mtime.toISOString().slice(0,10);
  profiles.push({p,raw,observedAt:observedAt<asOf?observedAt:asOf});
  const c=db.clubs.find(c=>c.id===clubIdFor(raw.primaryTeam?.teamId,raw.primaryTeam?.teamName));
  if(c)team(raw.primaryTeam.teamId,raw.primaryTeam.teamName,c.id,clubAssociation(c),`https://www.fotmob.com/teams/${raw.primaryTeam.teamId}`);
 }catch{/* Missing or ambiguous profiles are not guessed. */}
}
for(const c of db.clubs){const cc=clubAssociation(c);if(c.fotmobId||c.id.startsWith('f'))team(c.fotmobId||Number(c.id.slice(1)),c.name,c.id,cc,c.sourceUrl);}
// Domestic league participation identifies the association of a historical club,
// never the nationality of the player. International competitions are excluded.
const domestic={47:'EN',48:'EN',108:'EN',109:'EN',54:'DE',146:'DE',208:'DE',512:'DE',87:'ES',140:'ES',53:'FR',110:'FR',55:'IT',86:'IT',147:'IT',61:'PT',185:'PT',57:'NL',111:'NL',9195:'NL',40:'BE',264:'BE',38:'AT',119:'AT',59:'NO',64:'SCO',69:'CH',46:'DK',67:'SE',268:'BR',8814:'BR',112:'AR',130:'US',252:'HR',135:'GR',71:'TR',223:'JP',196:'PL',9088:'VN'};
for(const {raw}of profiles)for(const entry of raw.careerHistory?.careerItems?.senior?.seasonEntries||[]){
 const found=[...new Set((entry.tournamentStats||[]).filter(x=>!x.isFriendly).map(x=>domestic[x.leagueId]).filter(Boolean))];
 if(found.length!==1)continue;
 const c=clubIdFor(entry.teamId,entry.team);
 // Welsh clubs in the English pyramid need the association's own evidence.
 if(/cardiff|swansea|wrexham|newport/i.test(entry.team))continue;
 team(entry.teamId,entry.team,c,found[0],`https://www.fotmob.com/teams/${entry.teamId}`);
}
// Exact parent names plus an explicit reserve/age suffix only. No surname,
// nationality or fuzzy matching. Reserve entries with an exact parent name are
// attributed to that parent; ambiguous names are left unresolved.
function resolve(entry){
 const direct=Number(entry.teamId)>0?byTeam.get(Number(entry.teamId)):null;
 const reserveParent=String(entry.team||'').replace(/\s+(?:U(?:1[6-9]|2[0-3])|II|B|Reserves)$/i,'').replace(/^Jong /i,'');
 const reserveHit=reserveParent!==entry.team?byName.get(norm(reserveParent)):null;
 if(reserveHit?.length===1)return {...reserveHit[0],sourceTeamId:entry.teamId,sourceTeamName:entry.team};
 if(direct?.clubId)return direct;
 const parent=String(entry.team||'').replace(/\s+U(?:1[6-9]|2[0-3])$/i,'');
 const hit=parent!==entry.team?byName.get(norm(parent)):null;
 if(hit?.length===1)return {...hit[0],sourceTeamId:entry.teamId,sourceTeamName:entry.team};
 return direct||null;
}
let added=0,totalPeriods=0;
const unmatchedTeams=new Map();
for(const row of Object.values(index.players))if(row.periods)row.periods=row.periods.filter(x=>x.sourceType!=='career-provider');
for(const {p,raw,observedAt}of profiles){
 const periods=normalizeCareerPeriods(p,raw,{observedAt,resolveTeam:resolve}).filter(x=>x.start<`${Number(p.birthDate.slice(0,4))+22}-01-01`);
 if(!periods.length)continue;
 const row=index.players[p.id]||{id:p.id,name:p.name,birthDate:p.birthDate};
 row.periods=[...(row.periods||[]).filter(x=>x.sourceType!=='career-provider'),...periods];
 row.asOf=asOf;index.players[p.id]=row;added++;totalPeriods+=periods.length;
 for(const group of ['senior','youth'])for(const e of raw.careerHistory?.careerItems?.[group]?.teamEntries||[])if(!resolve(e))unmatchedTeams.set(e.teamId,e.team);
}
index.meta={...index.meta,historyVersion:2,verifiedAt:asOf,careerProfiles:added,careerPeriods:totalPeriods,biographyPlayers:Object.values(index.players).filter(x=>x.periods?.length).length,
 note:'UEFA A/B là danh sách đăng ký, không phải cờ home-grown. CT/AT tính từ lịch sử có nguồn; lịch sử thiếu không được tự kết luận là không đạt. Dữ liệu nhà cung cấp được ghi riêng với xác nhận chính thức.',
 limitations:['Không suy đào tạo từ quốc tịch hoặc từ việc có tên ở List A.','Lịch sử nhà cung cấp có thể thiếu học viện; khoảng không rõ giữ nguyên chưa xác minh.','Ngày quan sát giữ theo từng hồ sơ; không cộng thời gian ngoài đời sau mốc nguồn.']};
const reviewed=await read('docs/data/homegrown-reviewed-periods.json');
for(const row of Object.values(index.players))if(row.periods)row.periods=row.periods.filter(x=>!['reviewed-biography','reviewed-secondary'].includes(x.sourceType));
for(const item of reviewed){
 const p=db.players.find(p=>p.id===item.id);
 if(!p||norm(p.name)!==norm(item.name)||p.birthDate!==item.birthDate)throw Error('Reviewed identity mismatch '+item.id);
 const row=index.players[p.id]||{id:p.id,name:p.name,birthDate:p.birthDate};
 row.periods=[...(row.periods||[]),item.period];row.asOf=asOf;index.players[p.id]=row;
}
index.meta.biographyPlayers=Object.values(index.players).filter(x=>x.periods?.length).length;
index.meta.reviewedSupplementPlayers=new Set(reviewed.map(x=>x.id)).size;
index.meta.sources=[...(index.meta.sources||[]).filter(x=>!['UEFA Article 31','FotMob career histories','UEFA squad observations'].includes(x.name)),
 {name:'UEFA Article 31',url:'https://documents.uefa.com/r/Regulations-of-the-UEFA-Champions-League-2026/27/Article-31-Player-lists-Online'},
 {name:'FotMob career histories',url:'https://www.fotmob.com',note:'Individual profile URLs and observation dates are recorded on each period.'},
 {name:'UEFA squad observations',url:'https://www.uefa.com/uefachampionsleague/clubs/',observedAt:'2026-10-05'}];
await fs.writeFile(path.join(root,'public/data/homegrown.json'),JSON.stringify(index,null,2)+'\n');
await fs.writeFile(path.join(root,'.cache/homegrown-history-unmapped.json'),JSON.stringify([...unmatchedTeams].map(([id,name])=>({id,name})),null,2));
console.log(JSON.stringify({profiles:added,periods:totalPeriods,unmappedTeams:unmatchedTeams.size}));
