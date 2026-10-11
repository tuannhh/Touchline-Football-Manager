import {PORTRAIT_FIELDS,portraitPriority} from './portraits.mjs';
// Overlay only at career creation. Existing saves and immutable releases stay intact.
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const fid=p=>p.fotmobId?String(p.fotmobId):p.source==='FotMob'?String(p.sourceId||''):'';
const born=p=>String(p.birthDate||'').slice(0,10);
const identity=p=>born(p)&&norm(p.name)?`${norm(p.name)}:${born(p)}`:'';
export function applyScoutingPool(db,pool){
 if(pool?.schema!==1||!Array.isArray(pool.clubs)||!Array.isArray(pool.players)||!Array.isArray(pool.leagues))throw Error('Gói nguồn cầu thủ không hợp lệ.');
 const leagues=[...db.leagues],clubs=db.clubs.map(c=>({...c})),players=[...db.players],leagueIds=new Set(leagues.map(l=>l.id));
 for(const l of pool.leagues){if(l.kind!=='external'||!l.scoutingOnly||l.playable!==false)throw Error('Nguồn tuyển trạch không được tạo giải có thể thi đấu.');if(!leagueIds.has(l.id)){leagues.push(structuredClone(l));leagueIds.add(l.id);}}
 const byId=new Map(players.map(p=>[p.id,p])),byFid=new Map(),byIdentity=new Map(),clubMap=new Map(),conflicts=[];
 const index=p=>{if(fid(p))byFid.set(fid(p),p);if(identity(p))byIdentity.set(identity(p),p);};players.forEach(index);
 const clubIds=new Map(clubs.map(c=>[c.id,c]));
 for(const raw of pool.clubs){
  if(!pool.leagues.some(l=>l.id===raw.leagueId))throw Error('CLB tuyển trạch thiếu nguồn giải.');
  const candidates=clubs.filter(c=>c.id===raw.id||(c.fotmobId&&c.fotmobId===raw.fotmobId)||norm(c.name)===norm(raw.name));
  // Stable player IDs disambiguate alternate spellings of an existing UEFA club.
  const votes=new Map();for(const p of pool.players.filter(p=>p.clubId===raw.id)){const known=fid(p)&&byFid.get(fid(p));if(known)votes.set(known.clubId,(votes.get(known.clubId)||0)+1);}
  const ranked=[...votes].sort((a,b)=>b[1]-a[1]);
  let target=candidates.length===1?candidates[0]:null;
  if(!target&&ranked[0]?.[1]>=5&&ranked[0][1]>(ranked[1]?.[1]||0)*2){const candidate=clubIds.get(ranked[0][0]);if(db.leagues.some(l=>l.id===candidate?.leagueId&&l.kind==='external'))target=candidate;}
  if(target){target.scoutingLeagueId=raw.leagueId;clubMap.set(raw.id,target.id);continue;}
  const c={...structuredClone(raw),playable:false,scoutingOnly:true};clubs.push(c);clubIds.set(c.id,c);clubMap.set(raw.id,c.id);
 }
 for(const raw of pool.players){
  const clubId=clubMap.get(raw.clubId);if(!clubId)throw Error('Cầu thủ tuyển trạch thiếu CLB.');
  const known=byId.get(raw.id)||(fid(raw)&&byFid.get(fid(raw)))||(identity(raw)&&byIdentity.get(identity(raw)));
  if(known){
   const compatible=(!born(raw)||!born(known)||born(raw)===born(known))&&(fid(raw)&&fid(raw)===fid(known)||identity(raw)&&identity(raw)===identity(known)||raw.id===known.id&&norm(raw.name)===norm(known.name));
   if(compatible&&raw.photoVerified&&raw.photo&&portraitPriority(raw)>portraitPriority(known)&&!known.photoLocked&&!known.photoCustom&&!known.photoManual){
    const updated={...known};for(const key of PORTRAIT_FIELDS)if(raw[key]!==undefined)updated[key]=raw[key];
    players[players.indexOf(known)]=updated;byId.set(updated.id,updated);index(updated);
   }
   conflicts.push({player:raw.name,keptId:known.id,keptClub:known.clubId,sourceClub:clubId});continue;}
  const p={...structuredClone(raw),clubId};if(p.realWorld)p.realWorld.sourceGameClubId=clubId;
  players.push(p);byId.set(p.id,p);index(p);
 }
 // Exclude empty provider shells after deduplication; they cannot sell players.
 const populated=new Set(players.map(p=>p.clubId));
 return {...db,leagues,clubs:clubs.filter(c=>!c.scoutingOnly||populated.has(c.id)),players,
  meta:{...db.meta,scoutingPool:{snapshotAt:pool.meta?.snapshotAt,addedPlayers:players.length-db.players.length,coverage:pool.leagues.map(l=>({id:l.id,...l.coverage})),conflicts}}};
}
