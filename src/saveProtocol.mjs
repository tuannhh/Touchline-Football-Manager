// Career objects use immutable updates. Match ticks replace only liveMatch, so
// the world (16k players plus schedules) needs to cross to the worker only once.
export function sameSaveWorld(previous,next){
 if(!previous||!next)return false;
 const a=Object.keys(previous).filter(k=>k!=='liveMatch'),b=Object.keys(next).filter(k=>k!=='liveMatch');
 return a.length===b.length&&a.every(k=>Object.hasOwn(next,k)&&previous[k]===next[k]);
}
export function savePayload(previous,next){
 return sameSaveWorld(previous,next)?{type:'match',careerId:next.id,match:next.liveMatch}:{type:'world',careerId:next.id,game:next};
}
export function applySavePayload(current,payload){
 if(payload.type==='world'){
  if(!payload.game||payload.game.id!==payload.careerId)throw Error('Save identity mismatch');
  return payload.game;
 }
 if(payload.type!=='match'||!current||current.id!==payload.careerId)throw Error('Save worker needs the current career');
 return {...current,liveMatch:payload.match};
}
