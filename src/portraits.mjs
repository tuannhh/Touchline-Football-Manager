// Photo updates are deliberately separate from the season database: never copy club,
// ratings, contracts, match state or any other gameplay fields during a refresh.
export const PORTRAIT_FIELDS = ['photo','photoUrl','photoSource','photoSourceUrl','photoVerified','photoUpdatedAt','photoDigest','photoPriority','photoFraming'];
// A display window for wide official photos; the downloaded pixels stay intact.
export function portraitFrame(value){
 if(!value||!['x','y','w','h'].every(k=>Number.isFinite(value[k])))return null;
 const {x,y,w,h}=value;return x>=0&&y>=0&&w>=.05&&h>=.05&&x+w<=1.000001&&y+h<=1.000001?{x,y,w,h}:null;
}
const normalizeName=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().replace(/[^a-z0-9]/g,'');
const birthDate=player=>String(player?.birthDate||player?.dateOfBirth||'').slice(0,10);
const stamp=value=>Number.isFinite(Date.parse(value))?Date.parse(value):0;
export function samePortraitIdentity(player,candidate){
 if(!player||!candidate||typeof player.id!=='string'||player.id!==candidate.id)return false;
 const a=birthDate(player),b=birthDate(candidate);if(a&&b&&a!==b)return false;
 // Stable provider IDs allow harmless name spelling changes. An ID collision or
 // conflicting birth date must never attach another player's face.
 if(player.sourceId!=null&&candidate.sourceId!=null&&String(player.sourceId)!==String(candidate.sourceId))return false;
 const sameName=normalizeName(player.name)&&normalizeName(player.name)===normalizeName(candidate.name);
 return !!(sameName||(a&&a===b&&player.sourceId!=null&&candidate.sourceId!=null&&String(player.sourceId)===String(candidate.sourceId)));
}
export function localPortraitPath(value){
 return typeof value==='string'&&/^\/(?:portraits|photos|assets)\/[a-zA-Z0-9_/-]+\.(?:png|jpe?g|webp|avif)$/i.test(value)&&!value.includes('..');
}
export function portraitPriority(player){
 if(!player?.photo)return 0;
 if(player.photoVerified===true&&Number.isFinite(player.photoPriority))return Math.max(0,Math.min(100,player.photoPriority));
 // Older saves have source labels but no priority metadata. Honour official
 // photos from those saves before considering lower-priority fallback feeds.
 const source=String(player.photoSource||player.source||'').toLowerCase();
 const inferred=/official|chính thức|trang chủ/.test(source)?100:/\bvpf\b|\buefa\b|league official|ban tổ chức/.test(source)?90:/fotmob/.test(source)?70:/espn/.test(source)?60:10;
 return inferred;
}
export function customPortrait(player){
 return !!(player?.photoLocked||player?.photoCustom||player?.photoManual||/manual|custom|editor|người chơi|tự chọn/i.test(String(player?.photoSource||'')));
}
export function portraitUpdate(player,candidate){
 if(customPortrait(player)||!samePortraitIdentity(player,candidate)||candidate.photoVerified!==true||!localPortraitPath(candidate.photo)||!candidate.photoSource||!/^https:\/\//i.test(candidate.photoSourceUrl||''))return null;
 const previous=portraitPriority(player),next=portraitPriority(candidate);
 if(player.photo&&next<previous)return null;
 const oldTime=stamp(player.photoUpdatedAt),newTime=stamp(candidate.photoUpdatedAt);
 const staleSameAsset=!!(player.photo&&next===previous&&oldTime&&newTime<oldTime);
 if(player.photo&&next===previous&&oldTime&&newTime<=oldTime){
  // An identical asset can gain source metadata, but an old index must not roll
  // a newer photo back merely because it was fetched after the game was loaded.
  if(candidate.photo!==player.photo||candidate.photoDigest!==player.photoDigest)return null;
 }
 if(player.photo&&next===previous&&player.photoVerified===true&&!newTime&&candidate.photo!==player.photo)return null;
 const patch={};
 for(const key of PORTRAIT_FIELDS){
  if(key==='photoFraming'||candidate[key]===undefined||candidate[key]===player[key])continue;
  // An old copy of the same asset may fill missing attribution, but may not
  // lower its version timestamp or overwrite newer source metadata.
  if(staleSameAsset&&player[key]!==undefined&&player[key]!==null&&player[key]!=='')continue;
  patch[key]=candidate[key];
 }
 const frame=portraitFrame(candidate.photoFraming);
 const previousFrame=portraitFrame(player.photoFraming);
 if((!staleSameAsset||!previousFrame)&&JSON.stringify(frame)!==JSON.stringify(previousFrame))patch.photoFraming=frame;
 return Object.keys(patch).length?patch:null;
}
export function portraitIndex(data){
 const result=Object.create(null),rows=Array.isArray(data?.players)?data.players:Object.values(data?.players||{});
 for(const row of rows)if(row&&typeof row.id==='string'&&row.photoVerified===true&&localPortraitPath(row.photo))result[row.id]=row;
 return result;
}
export function resolvePortrait(player,index){
 const patch=portraitUpdate(player,index?.[player?.id]);return patch?{...player,...patch}:player;
}
// Mutates only the whitelisted photo fields. Safe for the server's save
// read/write path as well as migrations, including a currently active match.
export function mergePortraits(game,data){
 const index=portraitIndex(data);let changed=0;
 for(const player of Object.values(game.players||{})){
  const patch=portraitUpdate(player,index[player.id]);if(patch){Object.assign(player,patch);changed++;}
 }
 return changed;
}
