import {playerAbility,adjustAbility} from './playerAbility.mjs';
import {simulatedClubInterests} from './transfers.mjs';
import {staffEffects} from './staff.mjs';

const DAY=86400000,PERIOD=28;
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
const round=n=>Math.round(n*100)/100;
const finite=(n,fallback=0)=>Number.isFinite(n)?n:fallback;
const elapsed=(a,b)=>(Date.parse(`${a}T12:00:00Z`)-Date.parse(`${b}T12:00:00Z`))/DAY;
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(`${s}T12:00:00Z`))&&new Date(`${s}T12:00:00Z`).toISOString().slice(0,10)===s;
const bounded=(n,lo,hi)=>Number.isFinite(n)&&n>=lo&&n<=hi;
const mean=xs=>xs.length?xs.reduce((s,n)=>s+n,0)/xs.length:0;
const ageFactor=(age,position)=>age<=23?1.2:age<=28?1.1:Math.max(.18,1.1-(age-28)*(position==='GK'?.045:.08));
const contractFactor=years=>clamp(.6+years*.14,.6,1.22);
export function remainingContractYears(g,p){
 const end=validDate(p.contractEndDate)&&Number(p.contractEndDate.slice(0,4))===p.contractUntil?p.contractEndDate:`${Math.floor(p.contractUntil)}-06-30`;
 return validDate(end)?Math.max(0,elapsed(end,g.date)/365.25):0;
}
function sourceInfluence(p,quality,peers){
 const assessment=p.abilityAssessment||{},source=assessment.influence??assessment.importance;
 if(Number.isFinite(source))return clamp(source,0,100);
 if(typeof source==='string'&&Object.hasOwn({star:92,starter:78,rotation:58,prospect:45},source))return {star:92,starter:78,rotation:58,prospect:45}[source];
 const rank=peers.filter(x=>playerAbility(x)>quality).length;
 return clamp(82-rank*2.3+(quality-mean(peers.map(playerAbility)))*.6,25,96);
}
function rosterIndex(g){const roster=new Map();for(const p of Object.values(g.players)){if(!roster.has(p.clubId))roster.set(p.clubId,[]);roster.get(p.clubId).push(p);}return roster;}
function makeState(g,p,peers=[]){
 const quality=playerAbility(p),influence=sourceInfluence(p,quality,peers);
 return {startedAt:g.date,reviewedAt:g.date,clubId:p.clubId,year:g.year,minutes:finite(p.seasonMinutes),appearances:finite(p.appearances),credit:0,influence:round(influence),
  baseline:{date:g.date,ability:quality,potential:p.potential,value:p.value,age:p.age,contractYears:round(remainingContractYears(g,p)),influence:round(influence)},history:[]};
}
/** Migration adds a separate state map and does not rewrite a career's players or money. */
export function initializePlayerDevelopment(g){
 g.playerDevelopment??={version:1,players:{}};
 const missing=Object.values(g.players).filter(p=>!Object.hasOwn(g.playerDevelopment.players,p.id));
 if(missing.length){const roster=rosterIndex(g);for(const p of missing)g.playerDevelopment.players[p.id]=makeState(g,p,roster.get(p.clubId));}
 return g;
}
/** Explicit Editor/source application reanchors that player's future drift only. */
export function resetPlayersDevelopment(g,players){
 initializePlayerDevelopment(g);const roster=rosterIndex(g),result=[];
 for(const p of players){if(!p||g.players[p.id]!==p)continue;const old=g.playerDevelopment.players[p.id],next=makeState(g,p,roster.get(p.clubId)||[]);next.history=old.history;g.playerDevelopment.players[p.id]=next;result.push(next);}
 return result;
}
export function resetPlayerDevelopment(g,p){return resetPlayersDevelopment(g,[p])[0];}
function performanceSample(g,p,state,days){
 const sameSeason=state.year===g.year,minutes=Math.max(0,finite(p.seasonMinutes)-(sameSeason?state.minutes:0));
 const appearances=Math.max(0,finite(p.appearances)-(sameSeason?state.appearances:0));
 // Old form is never reused when no new appearance occurred. Prior real-world
 // source observations are deliberately excluded from career match counters.
 const ratings=(p.form||[]).slice(-Math.min(5,appearances)).filter(n=>bounded(n,1,10));
 const usable=appearances>0?ratings:[],confidence=usable.length?minutes/(minutes+900):0;
 const rating=usable.length?mean(usable):null;
 return {minutes,appearances,rating:rating===null?null:round(rating),confidence:round(confidence),signal:rating===null?0:clamp((rating-6.6)*confidence,-1.5,1.5),usage:clamp(minutes/Math.max(90,days/7*90),0,1)};
}
function projectedInfluence(p,state,sample,peers,clubActive){
 const quality=playerAbility(p),relative=sourceInfluence({...p,abilityAssessment:null},quality,peers);
 const initial=state.clubId===p.clubId?state.influence:relative;
 if(!sample.appearances&&!sample.minutes&&(!clubActive||p.injury>0||p.internationalDuty?.active))return initial;
 const target=clamp(relative*.65+(35+sample.usage*60)*.35+sample.signal*8,15,99);
 return round(initial+clamp((target-initial)*.28,-5,5));
}
/** Deterministic career simulation, reviewed at most once per 28 elapsed days.
 * Values approach an anchored target; good form never compounds a price forever.
 */
export function reviewPlayerDevelopment(g){
 initializePlayerDevelopment(g);if(g.liveMatch)return [];
 const roster=rosterIndex(g),changes=[],samples=new Map(),activeClubs=new Set(),support=new Map(),followed=new Set(g.shortlist||[]);
 for(const p of Object.values(g.players)){const state=g.playerDevelopment.players[p.id],days=elapsed(g.date,state.reviewedAt);if(days<PERIOD)continue;const sample=performanceSample(g,p,state,days);samples.set(p.id,sample);if(sample.minutes>0)activeClubs.add(p.clubId);}
 for(const p of Object.values(g.players)){
  const state=g.playerDevelopment.players[p.id],days=elapsed(g.date,state.reviewedAt);
  if(days<PERIOD)continue;
  const period=Math.min(days,56)/PERIOD,sample=samples.get(p.id),before=playerAbility(p),valueBefore=p.value;
  const gap=Math.max(0,p.potential-before),healthy=!(p.injury>0);
  if(!support.has(p.clubId))support.set(p.clubId,staffEffects(g,p.clubId));
  const staff=support.get(p.clubId),train=p.clubId===g.clubId?g.training:'balanced',trainingMultiplier=(train==='physical'?staff.fitnessMultiplier:p.position==='GK'?staff.goalkeepingMultiplier:staff.trainingMultiplier)*(p.age<22?staff.youthMultiplier:1);
  const growth=p.age<25&&healthy?.32*clamp(gap/10,0,1)*(.35+.65*sample.usage)*trainingMultiplier:0;
  const decline=Math.max(0,p.age-(p.position==='GK'?35:31))*.025*(1-clamp(sample.signal,0,.9));
  const injuryLoss=p.injury>=8?.06*clamp(p.injury/20,0,1):0;
  // Ability responds slowly; weak evidence cannot turn one great match into a superstar.
  const credit=(growth+sample.signal*.24-decline-injuryLoss)*period;
  state.credit=clamp(state.credit+credit,-2,2);
  if(Math.abs(state.credit)>=1){
   const direction=Math.sign(state.credit),target=clamp(before+direction,1,direction>0?Math.max(before,p.potential):100);
   if(direction<0&&target<before||direction>0&&target>before&&before<99)adjustAbility(p,target);
   state.credit-=direction;
  }
  const quality=playerAbility(p);state.influence=projectedInfluence(p,state,sample,roster.get(p.clubId)||[],activeClubs.has(p.clubId));
  const base=state.baseline,years=remainingContractYears(g,p);
  const abilityMultiplier=Math.pow(Math.max(1,quality)/Math.max(1,base.ability),3.5);
  const ageMultiplier=ageFactor(p.age,p.position)/ageFactor(base.age,p.position);
  const contractMultiplier=contractFactor(years)/contractFactor(base.contractYears);
  const formMultiplier=clamp(1+sample.signal*.2,.8,1.25);
  const influenceMultiplier=clamp(1+(state.influence-base.influence)/250,.85,1.15);
  const medicalMultiplier=1-clamp(finite(p.injury)*.01,0,.25);
  const targetValue=clamp(base.value*abilityMultiplier*ageMultiplier*contractMultiplier*formMultiplier*influenceMultiplier*medicalMultiplier,0,1e10);
  // Preserve zero-valued Editor/free-agent baselines. Rounding never pushes the
  // change outside the advertised eight-percent review limit.
  const delta=clamp((targetValue-p.value)*.35,-p.value*.08,p.value*.08);
  p.value=Math.round(clamp(p.value+delta,0,1e10));
  const reasons=[];
  if(sample.rating!==null)reasons.push(sample.signal>=0?'form_rising':'form_falling');
  if(growth>0)reasons.push('youth_development');
  if(decline>0)reasons.push('age_curve');
  if(p.injury>0)reasons.push('injury');
  if(years<base.contractYears-.05)reasons.push('contract_running_down');
  if(state.clubId!==p.clubId)reasons.push('new_club');
  if(!sample.minutes)reasons.push('no_new_minutes');
  const entry={date:g.date,ability:quality,abilityDelta:quality-before,value:p.value,valueDelta:p.value-valueBefore,influence:state.influence,minutes:sample.minutes,appearances:sample.appearances,rating:sample.rating,confidence:sample.confidence,reasons};
  state.history.push(entry);state.history=state.history.slice(p.clubId===g.clubId||followed.has(p.id)?-24:-6);
  state.reviewedAt=g.date;state.clubId=p.clubId;state.year=g.year;state.minutes=finite(p.seasonMinutes);state.appearances=finite(p.appearances);
  changes.push({playerId:p.id,...entry});
 }
 return changes;
}
/** Call after seasonal statistic reset, retaining ability, valuation and history. */
export function resetDevelopmentSeason(g){
 initializePlayerDevelopment(g);
 for(const p of Object.values(g.players)){const state=g.playerDevelopment.players[p.id];state.year=g.year;state.minutes=finite(p.seasonMinutes);state.appearances=finite(p.appearances);state.reviewedAt=g.date;}
}
export function playerDevelopmentReport(g,p,{includeInterests=true}={}){
 const state=g.playerDevelopment?.players?.[p.id]||makeState(g,p,Object.values(g.players).filter(x=>x.clubId===p.clubId));
 const influence=state.clubId===p.clubId?state.influence:sourceInfluence({...p,abilityAssessment:null},playerAbility(p),Object.values(g.players).filter(x=>x.clubId===p.clubId));
 return {model:'career-simulation',currentAbility:playerAbility(p),potential:p.potential,value:p.value,influence,baseline:{...state.baseline},reviewedAt:state.reviewedAt,reviewIntervalDays:PERIOD,
  history:state.history.map(row=>({...row,reasons:[...row.reasons]})),...(includeInterests?{interests:simulatedClubInterests(g,p)}:{})};
}
const REASONS=new Set(['form_rising','form_falling','youth_development','age_curve','injury','contract_running_down','new_club','no_new_minutes']);
export function validatePlayerDevelopment(g){
 const root=g.playerDevelopment;if(root===undefined)return true;
 const invalid=()=>{throw Error('Dữ liệu phát triển cầu thủ không hợp lệ.');};
 if(!root||root.version!==1||!root.players||typeof root.players!=='object'||Array.isArray(root.players)||Object.keys(root.players).length>Object.keys(g.players).length)invalid();
 for(const [id,s]of Object.entries(root.players)){
  if(!Object.hasOwn(g.players,id)||!s||!validDate(s.startedAt)||!validDate(s.reviewedAt)||s.startedAt>s.reviewedAt||s.reviewedAt>g.date||!Object.hasOwn(g.clubs,s.clubId)||!Number.isInteger(s.year)||s.year>g.year||!bounded(s.minutes,0,1e7)||!bounded(s.appearances,0,1e6)||!bounded(s.credit,-2,2)||!bounded(s.influence,0,100)||!Array.isArray(s.history)||s.history.length>24)invalid();
  const b=s.baseline;if(!b||!validDate(b.date)||b.date>s.reviewedAt||!bounded(b.ability,1,100)||!bounded(b.potential,1,100)||!bounded(b.value,0,1e10)||!bounded(b.age,0,120)||!bounded(b.contractYears,0,100)||!bounded(b.influence,0,100))invalid();
  let previous='';for(const h of s.history){if(!h||!validDate(h.date)||h.date>s.reviewedAt||h.date<=previous||!bounded(h.ability,1,100)||!bounded(h.abilityDelta,-5,5)||!bounded(h.value,0,1e10)||!bounded(h.valueDelta,-1e10,1e10)||!bounded(h.influence,0,100)||!bounded(h.minutes,0,1e7)||!bounded(h.appearances,0,1e6)||h.rating!==null&&!bounded(h.rating,1,10)||!bounded(h.confidence,0,1)||!Array.isArray(h.reasons)||h.reasons.length>8||h.reasons.some(reason=>!REASONS.has(reason)))invalid();previous=h.date;}
 }
 return true;
}
