// Node-only storage for immutable, source-dated roster snapshots. Never reads or writes careers.
import {createHash,randomUUID} from 'node:crypto';
import {readFile,writeFile,mkdir,open,rename,rm,lstat,chmod,cp,realpath} from 'node:fs/promises';
import {constants} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {spawn} from 'node:child_process';

export const DEFAULT_ROSTER_ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ID=/^[a-z0-9][a-z0-9-]{0,79}$/;
const SEASON=/^(20\d\d)\/(\d\d)$/;
const FILES=['database.json','homegrown.json','release.json'];
const MAX_BYTES=100*1024*1024;
const REQUIRED_COUNTRIES=['EN','DE','FR','IT','ES','PT','NL','VN'];
const record=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const date=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T12:00:00Z'))&&new Date(x+'T12:00:00Z').toISOString().slice(0,10)===x;
const season=x=>typeof x==='string'&&SEASON.test(x)&&Number(x.slice(-2))===(Number(x.slice(0,4))+1)%100;
const nonempty=(s,n=500)=>typeof s==='string'&&s.trim().length>0&&s.length<=n;
const http=s=>{try{return ['http:','https:'].includes(new URL(s).protocol);}catch{return false;}};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const canonical=x=>Array.isArray(x)?'['+x.map(canonical).join(',')+']':record(x)?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}':JSON.stringify(x);
const releaseHash=release=>{const {hash,...rest}=release;return sha(canonical(rest));};
const directory=root=>path.join(root,'public','data','releases');
const normalizeName=s=>s.normalize('NFKD').replace(/\p{M}/gu,'').replace(/[øØ]/g,'o').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const error=(message,code='INVALID_ROSTER_RELEASE')=>Object.assign(new Error(message),{code});
function assert(check,message){if(!check)throw error(message);}
async function exists(file){try{await lstat(file);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}}
async function readJson(file){const info=await lstat(file);assert(info.isFile()&&!info.isSymbolicLink()&&info.size<=MAX_BYTES,'Expected a regular JSON file under 100 MB: '+file);const bytes=await readFile(file);let data;try{data=JSON.parse(bytes.toString('utf8'));}catch{throw error('Invalid JSON: '+file);}return {data,bytes};}
function rowsUnique(rows,label){const ids=new Set();for(const row of rows){assert(record(row)&&typeof row.id==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._%-]{0,119}$/.test(row.id)&&!['__proto__','constructor','prototype'].includes(row.id)&&!ids.has(row.id),label+' IDs must be safe, present and unique.');ids.add(row.id);}return ids;}

/** Structural errors cannot be overridden. Risk acknowledgements only apply to a valid snapshot's diff. */
export function validateRosterSnapshot(database,homegrown,{season:expectedSeason,asOf}={}){
 const db=database,hg=homegrown;
 assert(record(db)&&record(db.meta)&&season(db.meta.season),'Database requires a valid source season, e.g. 2026/27.');
 if(expectedSeason)assert(db.meta.season===expectedSeason,'Candidate database source season differs from the release season; update the source adapters first.');
 assert(Array.isArray(db.meta.sources)&&db.meta.sources.length>0&&db.meta.sources.every(s=>nonempty(s)),'Database source provenance is missing.');
 assert(Array.isArray(db.leagues)&&db.leagues.length>=8&&db.leagues.length<=60,'Expected the supported domestic leagues.');
 assert(Array.isArray(db.clubs)&&db.clubs.length>=500&&db.clubs.length<=2000,'Expected at least 500 clubs across the supported league pyramid.');
 assert(Array.isArray(db.players)&&db.players.length>=10000&&db.players.length<=50000,'Expected 10,000–50,000 source players.');
 assert(Array.isArray(db.competitions)&&db.competitions.length===3,'All three UEFA club competitions must be included.');
 const leagues=rowsUnique(db.leagues,'League'),clubs=rowsUnique(db.clubs,'Club'),players=rowsUnique(db.players,'Player');
 const byPlayer=new Map(db.players.map(p=>[p.id,p])),leagueCounts=new Map(),rosters=new Map(),keepers=new Map();
 for(const c of db.clubs){assert(leagues.has(c.leagueId)&&nonempty(c.name)&&nonempty(c.source)&&http(c.sourceUrl),'Club has invalid league, name or source: '+c.id);leagueCounts.set(c.leagueId,(leagueCounts.get(c.leagueId)||0)+1);}
 for(const l of db.leagues){assert(nonempty(l.name)&&nonempty(l.countryCode,8)&&['domestic','external'].includes(l.kind),'Invalid league metadata: '+l.id);if(l.kind!=='external')assert(Number.isInteger(l.expectedTeams)&&l.expectedTeams>=2&&l.expectedTeams<=40&&leagueCounts.get(l.id)===l.expectedTeams,'Incorrect club count for '+l.id);}
 for(const cc of REQUIRED_COUNTRIES)for(const tier of [1,2,3])assert(db.leagues.some(l=>l.kind==='domestic'&&l.countryCode===cc&&l.tier===tier),'Missing supported tier '+tier+' for '+cc);
 for(const p of db.players){assert(clubs.has(p.clubId)&&nonempty(p.name)&&nonempty(p.shortName)&&['GK','DF','MF','FW'].includes(p.position)&&nonempty(p.source)&&http(p.sourceUrl),'Player has invalid identity, club, position or source: '+p.id);assert(p.attributes===undefined&&p.contractTerms===undefined&&p.internationalDuty===undefined,'Candidate contains simulated career state instead of source roster data: '+p.id);
  // Some public providers use zero for an unknown age; preserve source bytes instead of inventing a birthday.
  if(p.age!==null&&p.age!==undefined)assert(Number.isInteger(p.age)&&(p.age===0||p.age>=12&&p.age<=65),'Invalid age for '+p.id);if(p.birthDate)assert(date(p.birthDate),'Invalid birth date for '+p.id);
  for(const field of ['photo','badge'])if(p[field])assert(typeof p[field]==='string'&&/^\/(portraits|badges)\/[a-zA-Z0-9_.-]+$/.test(p[field])&&!p[field].includes('..'),'Invalid local asset reference for '+p.id);
  rosters.set(p.clubId,(rosters.get(p.clubId)||0)+1);if(p.position==='GK')keepers.set(p.clubId,(keepers.get(p.clubId)||0)+1);
 }
 for(const c of db.clubs)assert((rosters.get(c.id)||0)>=14&&(keepers.get(c.id)||0)>=1,'Club roster is incomplete (minimum 14 and one goalkeeper): '+c.id);
 const participants=new Set(),competitionIds=new Set();for(const c of db.competitions){assert(nonempty(c.id)&&!competitionIds.has(c.id)&&!leagues.has(c.id)&&nonempty(c.name)&&http(c.sourceUrl)&&Array.isArray(c.participants)&&c.participants.length===36&&[6,8].includes(c.matchdays),'Invalid UEFA competition.');competitionIds.add(c.id);for(const id of c.participants){assert(clubs.has(id)&&!participants.has(id),'Missing or duplicate UEFA participant: '+id);participants.add(id);}}
 assert(record(hg)&&record(hg.meta)&&hg.meta.version===1&&season(hg.meta.season)&&hg.meta.season===db.meta.season&&date(hg.meta.verifiedAt),'Home-grown index season/date does not match the source database.');
 assert(record(hg.players)&&Object.keys(hg.players).length<=db.players.length,'Invalid home-grown index.');
 assert(Array.isArray(hg.meta.sources)&&hg.meta.sources.length>0&&hg.meta.sources.every(s=>record(s)&&nonempty(s.name)&&http(s.url)),'Home-grown evidence requires source links.');
 for(const [id,p]of Object.entries(hg.players)){const original=byPlayer.get(id);assert(original&&record(p)&&p.id===id&&nonempty(p.name)&&normalizeName(p.name)===normalizeName(original.name)&&date(p.asOf),'Home-grown identity does not match the database: '+id);if(original.birthDate&&p.birthDate)assert(original.birthDate===p.birthDate,'Home-grown birth date differs from the player identity: '+id);if(asOf)assert(p.asOf<=asOf,'Home-grown evidence is newer than the declared roster as-of date: '+id);
  if(p.pl)assert(record(p.pl)&&[true,false,null].includes(p.pl.association)&&http(p.pl.source)&&date(p.pl.verifiedAt)&&p.pl.season===db.meta.season,'Invalid PL evidence: '+id);
  if(p.periods!==undefined){assert(Array.isArray(p.periods),'Invalid training history: '+id);for(const period of p.periods)assert(record(period)&&(period.clubId===null||nonempty(period.clubId))&&nonempty(period.association)&&date(period.start)&&date(period.end)&&period.start<=period.end&&http(period.source)&&period.verified===true&&date(period.verifiedAt)&&(!asOf||period.end<=asOf),'Invalid sourced training period: '+id);}
 }
 if(asOf){assert(date(asOf),'Invalid as-of date.');assert(hg.meta.verifiedAt<=asOf,'Home-grown verification date is after the release as-of date.');}
 return {leagues:db.leagues.length,clubs:db.clubs.length,players:db.players.length,homegrownPlayers:Object.keys(hg.players).length};
}
export function compareRosterSnapshots(previous,next,{asOf}={}){
 if(!previous)return [];const risks=[],add=(code,message)=>risks.push({code,message}),old=previous.database,db=next.database;
 for(const [key,fraction]of [['players',.95],['clubs',.98]])if(db[key].length<old[key].length*fraction)add(key==='players'?'TOTAL_PLAYER_DROP':'TOTAL_CLUB_DROP',`${key}: ${old[key].length} → ${db[key].length}`);
 const ids=new Set(db.players.map(p=>p.id)),removed=old.players.filter(p=>!ids.has(p.id)).length;if(removed>old.players.length*.1)add('PLAYER_IDENTITY_CHURN',`${removed} previous player identities are absent; verify identity matching, not only total counts.`);
 const newLeagues=new Set(db.leagues.map(l=>l.id));for(const l of old.leagues)if(!newLeagues.has(l.id))add('LEAGUE_REMOVED:'+l.id,'Previous league absent: '+l.name);
 const counts=players=>{const rows=new Map();for(const p of players)rows.set(p.clubId,(rows.get(p.clubId)||0)+1);return rows;},before=counts(old.players),after=counts(db.players);
 for(const c of old.clubs){const a=before.get(c.id)||0,b=after.get(c.id)||0;if(a-b>Math.max(5,a*.3))add('CLUB_ROSTER_DROP:'+c.id,`${c.name}: ${a} → ${b} players`);}
 const prevHG=Object.keys(previous.homegrown.players).length,nextHG=Object.keys(next.homegrown.players).length;if(nextHG<prevHG*.95)add('HOMEGROWN_EVIDENCE_DROP',`Sourced home-grown records: ${prevHG} → ${nextHG}`);
 if(asOf&&Date.parse(asOf)-Date.parse(next.homegrown.meta.verifiedAt)>90*86400000)add('HOMEGROWN_EVIDENCE_AGE','Home-grown evidence is more than 90 days older than the release date; review season-specific squad flags.');
 return risks.sort((a,b)=>a.code.localeCompare(b.code));
}
function validateRelease(release){assert(record(release)&&ID.test(release.id)&&nonempty(release.name,160)&&release.label===release.name&&season(release.season)&&date(release.asOf)&&release.asOfTimezone==='Asia/Ho_Chi_Minh'&&typeof release.publishedAt==='string'&&Number.isFinite(Date.parse(release.publishedAt)),'Malformed roster release metadata.');assert(record(release.counts)&&['leagues','clubs','players','homegrownPlayers'].every(k=>Number.isInteger(release.counts[k])&&release.counts[k]>=0),'Invalid release counts.');assert(record(release.hashes)&&['database','homegrown'].every(k=>/^[a-f0-9]{64}$/.test(release.hashes[k]))&&/^[a-f0-9]{64}$/.test(release.hash)&&release.hash===releaseHash(release),'Roster release metadata checksum mismatch.');assert(Array.isArray(release.sources)&&release.sources.every(s=>record(s)&&nonempty(s.name)&&(!s.url||http(s.url))),'Invalid release sources.');return release;}
async function readManifest(root){const dir=directory(root),file=path.join(dir,'index.json');if(!await exists(file))return {version:1,latestId:null,releases:[]};const {data:m}=await readJson(file);assert(record(m)&&m.version===1&&Array.isArray(m.releases)&&m.releases.length<=1000,'Invalid roster release index.');const ids=new Set();for(const r of m.releases){validateRelease(r);assert(!ids.has(r.id),'Duplicate release ID.');ids.add(r.id);}assert(m.latestId===null&&!m.releases.length||ids.has(m.latestId),'Invalid latest release pointer.');return m;}
function newest(a,b){return b.asOf.localeCompare(a.asOf)||b.publishedAt.localeCompare(a.publishedAt)||a.id.localeCompare(b.id);}
/** Lists locally published, checksum-validated metadata. File content hashes are rechecked on load. */
export async function listRosterReleases({rootDir=DEFAULT_ROSTER_ROOT}={}){const manifest=await readManifest(rootDir);for(const r of manifest.releases){const {data}=await readJson(path.join(directory(rootDir),r.id,'release.json'));validateRelease(data);assert(canonical(data)===canonical(r),'Release metadata differs from its index: '+r.id);}return [...manifest.releases].sort(newest);}
/** Snapshot JSON is not decorated or merged with live indexes. Only newGame should consume it. */
export async function loadRosterRelease(id,{rootDir=DEFAULT_ROSTER_ROOT}={}){assert(typeof id==='string'&&ID.test(id),'Invalid roster release ID.');const manifest=await readManifest(rootDir),release=manifest.releases.find(r=>r.id===id);if(!release)throw error('Roster release not found: '+id,'ROSTER_RELEASE_NOT_FOUND');const dir=path.join(directory(rootDir),id),info=await lstat(dir);assert(info.isDirectory()&&!info.isSymbolicLink(),'Release directory must not be a symlink.');const [dbFile,hgFile,{data:stored}]=await Promise.all(FILES.map(filename=>readJson(path.join(dir,filename))));
 validateRelease(stored);assert(canonical(stored)===canonical(release),'Release metadata differs from its index.');assert(sha(dbFile.bytes)===release.hashes.database&&sha(hgFile.bytes)===release.hashes.homegrown,'Roster release content hash mismatch: '+id);const counts=validateRosterSnapshot(dbFile.data,hgFile.data,{season:release.season,asOf:release.asOf});assert(canonical(counts)===canonical(release.counts),'Roster release count mismatch.');return {release,database:dbFile.data,homegrown:hgFile.data};
}
async function durableWrite(file,bytes,mode=0o444){const handle=await open(file,'wx',0o600);try{await handle.writeFile(bytes);await handle.sync();}finally{await handle.close();}await chmod(file,mode);}
async function syncDirectory(dir){let handle;try{handle=await open(dir,'r');await handle.sync();}catch(e){if(!['EINVAL','ENOTSUP','EISDIR'].includes(e.code))throw e;}finally{await handle?.close();}}
function sourceList(database,homegrown){const entries=[...database.meta.sources.map(name=>({name})),...homegrown.meta.sources,...database.leagues.filter(l=>http(l.sourceUrl)).map(l=>({name:l.name+' · '+(l.sourceName||'roster source'),url:l.sourceUrl})),...database.competitions.map(c=>({name:c.name,url:c.sourceUrl}))];return [...new Map(entries.map(s=>[s.name+'|'+(s.url||''),{name:s.name,...(s.url?{url:s.url}:{})}])).values()];}
export async function prepareRosterRelease({rootDir=DEFAULT_ROSTER_ROOT,databasePath,homegrownPath,id,name,label,season:sourceSeason,asOf,notes='',acknowledgeRisks=[],reviewNote='',publishedAt=new Date().toISOString()}={}){
 assert(ID.test(id||''),'Use a release ID containing lowercase letters, digits and hyphens.');name=name||label;assert(nonempty(name,160)&&season(sourceSeason)&&date(asOf),'Release name, source season and precise as-of date are required.');assert(typeof publishedAt==='string'&&Number.isFinite(Date.parse(publishedAt)),'Invalid publication time.');const localPublicationDay=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(publishedAt));assert(asOf<=localPublicationDay,'As-of date cannot be later than publication day in Vietnam.');
 const [db,hg]=await Promise.all([readJson(databasePath||path.join(rootDir,'public/data/database.json')),readJson(homegrownPath||path.join(rootDir,'public/data/homegrown.json'))]);const counts=validateRosterSnapshot(db.data,hg.data,{season:sourceSeason,asOf}),list=await listRosterReleases({rootDir});assert(!list.some(r=>r.id===id)&&!await exists(path.join(directory(rootDir),id)),'This release ID already exists and cannot be overwritten.');
 const previous=list.length?await loadRosterRelease(list[0].id,{rootDir}):null,risks=compareRosterSnapshots(previous,{database:db.data,homegrown:hg.data},{asOf});assert(Array.isArray(acknowledgeRisks)&&new Set(acknowledgeRisks).size===acknowledgeRisks.length&&acknowledgeRisks.every(code=>risks.some(r=>r.code===code)),'Risk acknowledgements must name only the exact current risk codes.');
 const missing=risks.filter(r=>!acknowledgeRisks.includes(r.code));if(missing.length)throw Object.assign(error('Roster changes require review: '+missing.map(r=>r.code+' ('+r.message+')').join('; '),'ROSTER_REVIEW_REQUIRED'),{risks});if(risks.length)assert(typeof reviewNote==='string'&&reviewNote.trim().length>=20&&reviewNote.length<=2000,'A specific review note of 20–2,000 characters is required when accepting roster-loss risks.');
 const release={id,name,label:name,season:sourceSeason,asOf,asOfTimezone:'Asia/Ho_Chi_Minh',publishedAt:new Date(publishedAt).toISOString(),counts,sources:sourceList(db.data,hg.data),hashes:{database:sha(db.bytes),homegrown:sha(hg.bytes)},notes:String(notes).slice(0,4000),sourceImportedAt:db.data.meta.importedAt||null,homegrownVerifiedAt:hg.data.meta.verifiedAt,assets:'Portrait files and the live portrait index are maintained separately; roster identity and home-grown evidence are immutable.',review:{baseId:previous?.release.id||null,risks,acknowledged:[...acknowledgeRisks].sort(),note:reviewNote.trim()}};release.hash=releaseHash(release);return {release,databaseBytes:db.bytes,homegrownBytes:hg.bytes};
}
export async function publishRosterRelease(options={}){
 const rootDir=options.rootDir||DEFAULT_ROSTER_ROOT,dir=directory(rootDir);await mkdir(dir,{recursive:true});const lockFile=path.join(dir,'.publish.lock');let lock;try{lock=await open(lockFile,'wx',0o600);}catch(e){if(e.code==='EEXIST')throw error('A roster publication lock exists. Verify the owning process before removing a stale lock.','ROSTER_RELEASE_LOCKED');throw e;}
 let temp,finalDir,renamed=false,committed=false;
 try{await lock.writeFile(JSON.stringify({pid:process.pid,createdAt:new Date().toISOString(),token:randomUUID()}));await lock.sync();const ready=await prepareRosterRelease({...options,rootDir}),manifest=await readManifest(rootDir);finalDir=path.join(dir,ready.release.id);temp=path.join(dir,'.pending-'+randomUUID());await mkdir(temp,{mode:0o700});await durableWrite(path.join(temp,'database.json'),ready.databaseBytes);await durableWrite(path.join(temp,'homegrown.json'),ready.homegrownBytes);await durableWrite(path.join(temp,'release.json'),JSON.stringify(ready.release,null,2)+'\n');await syncDirectory(temp);assert(!await exists(finalDir),'Release already exists.');await rename(temp,finalDir);renamed=true;await chmod(finalDir,0o555);
  const releases=[...manifest.releases,ready.release].sort(newest),index={version:1,latestId:releases[0].id,releases},indexTemp=path.join(dir,'.index-'+randomUUID()+'.tmp');temp=indexTemp;await durableWrite(indexTemp,JSON.stringify(index,null,2)+'\n',0o644);await rename(indexTemp,path.join(dir,'index.json'));committed=true;await syncDirectory(dir);return ready.release;
 }finally{if(temp)await rm(temp,{recursive:true,force:true}).catch(()=>{});if(renamed&&!committed){await chmod(finalDir,0o755).catch(()=>{});await rm(finalDir,{recursive:true,force:true}).catch(()=>{});}await lock.close();await rm(lockFile,{force:true});}
}
/** Copy hard-coded legacy importers into a separate root, so their in-place writes cannot reach live data. */
export async function stageRosterRefresh({rootDir=DEFAULT_ROSTER_ROOT,stageDir,refresh=false,python='python3',season:requestedSeason}={}){
 assert(typeof stageDir==='string'&&stageDir.length>0,'A new staging directory is required.');rootDir=await realpath(rootDir);stageDir=path.resolve(stageDir);let parent=path.dirname(stageDir),suffix=[path.basename(stageDir)];while(!await exists(parent)){suffix.unshift(path.basename(parent));parent=path.dirname(parent);}stageDir=path.join(await realpath(parent),...suffix);assert(stageDir!==rootDir&&!rootDir.startsWith(stageDir+path.sep),'Staging must not replace the project or an ancestor.');for(const protectedName of ['public','saves','scripts','src']){const protectedPath=path.join(rootDir,protectedName);assert(stageDir!==protectedPath&&!stageDir.startsWith(protectedPath+path.sep),'Staging cannot be inside live '+protectedName+'.');}assert(!await exists(stageDir),'Staging directory must be new; refusing to overwrite it.');
 const source=await readJson(path.join(rootDir,'public/data/database.json'));if(requestedSeason)assert(requestedSeason===source.data.meta.season,'Existing adapters are pinned to '+source.data.meta.season+'; review copied scripts and source URLs before collecting a new season.');
 await mkdir(stageDir,{recursive:true});await mkdir(path.join(stageDir,'public/data'),{recursive:true});await mkdir(path.join(stageDir,'.cache'),{recursive:true});await cp(path.join(rootDir,'scripts'),path.join(stageDir,'scripts'),{recursive:true,dereference:true,filter:file=>!file.includes('__pycache__')});
 for(const file of ['database.json','homegrown.json','portraits.json'])if(await exists(path.join(rootDir,'public/data',file)))await cp(path.join(rootDir,'public/data',file),path.join(stageDir,'public/data',file));
 for(const folder of ['portraits','badges'])if(await exists(path.join(rootDir,'public',folder)))await cp(path.join(rootDir,'public',folder),path.join(stageDir,'public',folder),{recursive:true,dereference:true,mode:constants.COPYFILE_FICLONE});
 const report={version:1,createdAt:new Date().toISOString(),sourceRoot:rootDir,stageDir,season:source.data.meta.season,status:'prepared',note:'Only this isolated tree may be refreshed. Review candidate season/source dates and diff before a separate publication. Source caches and saves are deliberately not copied.'};const reportFile=path.join(stageDir,'staging.json');await writeFile(reportFile,JSON.stringify(report,null,2)+'\n');
 if(refresh){try{for(const script of ['refresh-data.py','refresh-homegrown.py'])await new Promise((resolve,reject)=>{const child=spawn(python,[path.join(stageDir,'scripts',script)],{cwd:stageDir,stdio:'inherit'});child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(error('Staged refresh failed: '+script+' (exit '+code+')')));});report.status='refreshed-pending-review';}catch(e){report.status='failed';report.error=e.message;await writeFile(reportFile,JSON.stringify(report,null,2)+'\n');throw e;}await writeFile(reportFile,JSON.stringify(report,null,2)+'\n');}
 return report;
}
