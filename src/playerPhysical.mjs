/**
 * A deterministic game model, not a prediction of a real player's health.
 * Fitness is immediate condition; fatigue is accumulated load that survives a
 * short turnaround. This module never changes injuries or consumes game RNG.
 */
const DAY=86400000,MAX_HISTORY=24,HISTORY_DAYS=35;
const KINDS=new Set(['club','friendly','international']);
const UNSAFE_IDS=new Set(['__proto__','prototype','constructor']);
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
const rounded=n=>Math.round(n*100)/100;
// A match day is shared by thousands of players. Cache only immutable date
// parsing, never player condition or career state; bound memory for long saves.
const dateCache=new Map(),INVALID_DATE={time:NaN,valid:false},DATE_CACHE_LIMIT=512;
function dateInfo(value){
 if(typeof value!=='string'||value.length!==10)return INVALID_DATE;
 const cached=dateCache.get(value);if(cached)return cached;
 const time=Date.parse(`${value}T12:00:00Z`),valid=/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===value;
 const info={time,valid};if(dateCache.size>=DATE_CACHE_LIMIT)dateCache.delete(dateCache.keys().next().value);dateCache.set(value,info);return info;
}
const stamp=value=>dateInfo(value).time;
const validDate=value=>dateInfo(value).valid;
const days=(later,earlier)=>(stamp(later)-stamp(earlier))/DAY;
const own=(object,key)=>!!object&&Object.hasOwn(object,key);
const plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value)&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
const finite=(n,min,max)=>Number.isFinite(n)&&n>=min&&n<=max;
const playerExists=(g,id)=>typeof id==='string'&&!UNSAFE_IDS.has(id)&&own(g.players,id)&&g.players[id]?.id===id;
const stateFor=(g,p)=>own(g.physical?.players,p.id)?g.physical.players[p.id]:null;
const stamina=p=>clamp(Number(p.attributes?.stamina)||10,1,20);
const positionLoad=p=>p.position==='GK'?.5:1;
const condition=p=>clamp(Number(p.fitness)||0,0,100);
const historyAt=(state,date,span=HISTORY_DAYS)=>(state?.recent||[]).filter(match=>{const age=days(date,match.date);return age>=0&&age<span;});
const fatigueAt=state=>clamp(Number(state?.fatigue)||0,0,100);
const liveLoad=(p,m)=>Math.max(0,Number(m?.workload?.[p.id]??m?.minutes?.[p.id])||0);
const rates=(p,intensity='normal',recoveryBonus=0)=>({
 condition:((intensity==='light'?29:intensity==='hard'?15:23)+clamp(Number(recoveryBonus)||0,0,7))/7,
 fatigue:(intensity==='light'?3.5:intensity==='hard'?2:2.7)+(stamina(p)-14)*.025+clamp(Number(recoveryBonus)||0,0,7)/14
});
const trimHistory=(recent,date)=>{const now=stamp(date);return recent.filter(match=>{const age=(now-stamp(match.date))/DAY;return age>=0&&age<HISTORY_DAYS;}).sort((a,b)=>a.date.localeCompare(b.date)||a.fixtureId.localeCompare(b.fixtureId)).slice(-MAX_HISTORY);};
function recentLoad(state,date){
 let minutes7=0,minutes14=0,matches14=0,last=null,daysSinceLastMatch=null;const now=stamp(date);
 for(const match of state?.recent||[]){
  const age=(now-stamp(match.date))/DAY;if(!(age>=0&&age<HISTORY_DAYS))continue;
  last=match;daysSinceLastMatch=age;if(age<7)minutes7+=match.minutes;if(age<14){minutes14+=match.minutes;matches14++;}
 }
 return {minutes7,minutes14,matches14,last,daysSinceLastMatch};
}
const fail=()=>{throw Error('Dữ liệu thể lực và tải thi đấu không hợp lệ.');};

/** Optional for old saves. Initialization preserves existing condition and RNG. */
export function initializePhysical(g){
 if(g.physical===undefined){if(!validDate(g.date))fail();g.physical={version:1,startedAt:g.date,players:{}};}
 return g;
}

/** Same condition formula for the live UI, match engine and final settlement. */
export function matchCondition(g,p,m=null){
 const base=condition(p),load=liveLoad(p,m);if(!load)return rounded(base);
 const state=stateFor(g,p);
 if(m?.fixtureId&&state?.recent.some(match=>match.fixtureId===m.fixtureId))return rounded(base);
 const fatigue=fatigueAt(state);
 const loss=load*(22-stamina(p))/32*positionLoad(p)*(1+fatigue/200);
 return rounded(clamp(base-loss,0,100));
}

/** Pure: never silently advances recovery or changes a save while rendering. */
export function playerReadiness(g,p,{live=null,date=g.date}={}){
 const state=stateFor(g,p),{minutes7,minutes14,matches14,last,daysSinceLastMatch}=recentLoad(state,date);
 const fitness=matchCondition(g,p,live),fatigue=fatigueAt(state);
 const injured=(Number(p.injury)||0)>0||!!live?.injured?.includes(p.id);
 const heavySchedule=minutes7>=240,shortTurnaround=last&&daysSinceLastMatch<=2&&last.minutes>=60&&fitness<90;
 const high=injured||fitness<60||fatigue>=60;
 const needsRest=high||fitness<75||fatigue>=35||heavySchedule||!!shortTurnaround;
 const reasons=[];
 if(injured)reasons.push('Đang chấn thương; cần điều trị trước khi trở lại thi đấu.');
 if(fitness<60)reasons.push('Thể lực quá thấp để duy trì cường độ thi đấu.');
 else if(fitness<75)reasons.push('Thể lực chưa hồi phục đầy đủ; nên nghỉ hoặc vào sân từ ghế dự bị.');
 if(fatigue>=60)reasons.push('Mệt mỏi tích lũy rất cao; cần nghỉ thi đấu để hồi phục.');
 else if(fatigue>=35)reasons.push('Mệt mỏi tích lũy cao do thi đấu liên tục.');
 if(heavySchedule)reasons.push('Đã thi đấu ít nhất 240 phút trong 7 ngày gần nhất.');
 if(shortTurnaround)reasons.push('Thời gian nghỉ giữa hai trận quá ngắn.');
 const recovery=rates(p),restDays=needsRest?clamp(Math.ceil(Math.max((90-fitness)/recovery.condition,(fatigue-15)/recovery.fatigue,heavySchedule?3:0,shortTurnaround?2:0,injured?Math.min(14,Math.max(1,Number(p.injury)||1)*7):0)),1,14):0;
 return {fitness,fatigue,minutes7,minutes14,matches14,daysSinceLastMatch,needsRest,risk:high?'high':needsRest?'elevated':'normal',restDays,reasons};
}

/** Relative probability multiplier only; the engine owns every random draw. */
export function injuryRiskMultiplier(g,p,m=null){
 const state=stateFor(g,p),{minutes7}=recentLoad(state,validDate(m?.date)?m.date:g.date),liveMinutes=Math.max(0,Number(m?.minutes?.[p.id])||0);
 const loadPenalty=Math.max(0,minutes7+liveMinutes-180)/180;
 return rounded(clamp(1+fatigueAt(state)/35+Math.max(0,80-matchCondition(g,p,m))/30+loadPenalty,1,5));
}

/**
 * Credits each fixture/player once, including substitutes and national duty.
 * Caller recovers to match date first. A previous match cannot be backdated
 * after recovery. Zero-minute bench players receive no load or appearance.
 */
export function recordPhysicalMatch(g,{fixtureId,date=g.date,kind='club',minutes,workload={}}={}){
 if(typeof fixtureId!=='string'||!fixtureId||fixtureId.length>240||!validDate(date)||!KINDS.has(kind)||!plain(minutes)||!plain(workload))fail();
 if(date<(g.physical?.startedAt||g.date))fail();
 const pending=[];
 for(const [id,value]of Object.entries(minutes)){
  if(!playerExists(g,id)||!Number.isInteger(value)||!finite(value,0,150))fail();
  const load=own(workload,id)?workload[id]:value;
  if(!finite(load,0,600)||(value===0&&load!==0))fail();
  const p=g.players[id],state=stateFor(g,p);
  if(!value||state?.recent.some(m=>m.fixtureId===fixtureId))continue;
  if(state&&date<state.recoveredThrough)fail();
  if(g.physical&&date<g.physical.startedAt)fail();
  pending.push({p,value,load});
 }
 for(const [id,load]of Object.entries(workload))if(!own(minutes,id)||!playerExists(g,id)||!finite(load,0,600))fail();
 initializePhysical(g);
 for(const {p,value,load}of pending){
  const state=stateFor(g,p)||{fatigue:0,recent:[],recoveredThrough:date};
  const recent=historyAt(state,date,7),priorFullMatches=recent.filter(m=>m.minutes>=60).length;
  const congestion=1+Math.min(3,priorFullMatches)*.18;
  const nextCondition=matchCondition(g,p,{minutes:{[p.id]:value},workload:{[p.id]:load}});
  const fatigueGain=load/90*(23-stamina(p)*.35)*positionLoad(p)*congestion;
  p.fitness=nextCondition;
  state.fatigue=rounded(clamp(state.fatigue+fatigueGain,0,100));
  state.recent=trimHistory([...state.recent,{fixtureId,date,minutes:value,load,kind}],date);
  state.recoveredThrough=date;
  g.physical.players[p.id]=state;
 }
 return pending.length;
}

/**
 * Daily, idempotent recovery. No state is needed for untouched fully fit players.
 * Legacy callers may invoke this directly; it initializes at the game's date.
 * recoveryBonus uses the existing staff model's points per week.
 */
export function recoverPlayerPhysical(g,p,toDate,{intensity='normal',recoveryBonus=0}={}){
 if(!playerExists(g,p?.id)||!validDate(toDate)||!['light','normal','hard'].includes(intensity)||!finite(recoveryBonus,0,7))fail();
 initializePhysical(g);
 const existing=stateFor(g,p),from=existing?.recoveredThrough||g.physical.startedAt;
 const elapsed=Math.max(0,days(toDate,from));
 if(!elapsed)return p;
 if(!existing&&condition(p)===100)return p;
 const state=existing||{fatigue:0,recent:[],recoveredThrough:from},recovery=rates(p,intensity,recoveryBonus);
 p.fitness=rounded(clamp(condition(p)+elapsed*recovery.condition,0,100));
 state.fatigue=rounded(clamp(state.fatigue-elapsed*recovery.fatigue,0,100));
 state.recent=trimHistory(state.recent,toDate);
 state.recoveredThrough=toDate;
 g.physical.players[p.id]=state;
 return p;
}

/** Full Editor/season recovery: clear fatigue/history and restore fitness only. */
export function resetPhysical(g,playerIds=Object.keys(g.players),date=g.date){
 if(!validDate(date)||!Array.isArray(playerIds)||playerIds.some(id=>!playerExists(g,id)))fail();
 initializePhysical(g);
 if(date<g.physical.startedAt)fail();
 for(const id of playerIds){g.players[id].fitness=100;g.physical.players[id]={fatigue:0,recent:[],recoveredThrough:date};}
 return g;
}

/** Strict validation on import/load. Minimal legacy saves may omit this system. */
export function validatePhysical(g){
 if(g.physical===undefined)return true;
 const s=g.physical;
 if(!plain(s)||s.version!==1||!validDate(s.startedAt)||!plain(s.players))fail();
 for(const [id,state]of Object.entries(s.players)){
  if(!playerExists(g,id)||!plain(state)||!finite(state.fatigue,0,100)||!validDate(state.recoveredThrough)||state.recoveredThrough<s.startedAt||!Array.isArray(state.recent)||state.recent.length>MAX_HISTORY)fail();
  const ids=new Set();let previous=null;
  for(const match of state.recent){
   if(!plain(match)||typeof match.fixtureId!=='string'||!match.fixtureId||match.fixtureId.length>240||ids.has(match.fixtureId)||!validDate(match.date)||match.date<s.startedAt||match.date>state.recoveredThrough||(previous&&match.date<previous)||!Number.isInteger(match.minutes)||!finite(match.minutes,1,150)||!finite(match.load,0,600)||!KINDS.has(match.kind))fail();
   if(days(state.recoveredThrough,match.date)>=HISTORY_DAYS)fail();
   ids.add(match.fixtureId);previous=match.date;
  }
 }
 return true;
}
