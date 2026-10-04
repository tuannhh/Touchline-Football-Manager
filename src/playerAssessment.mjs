import {ABILITY_MODEL,abilityRole,adjustAbility,playerAbility} from './playerAbility.mjs';
import {ASSESSMENT_EVIDENCE} from './data/ability-evidence.mjs';

export const ASSESSMENT_VERSION='2026-10-05-v1';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const valid=n=>typeof n==='number'&&Number.isFinite(n);
const day=s=>{if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}(?:$|T)/.test(s))return null;const date=s.slice(0,10),stamp=Date.parse(date+'T12:00:00Z');return Number.isFinite(stamp)&&new Date(stamp).toISOString().slice(0,10)===date?date:null;};
const safeUrl=s=>{if(typeof s!=='string'||s.length>4096)return false;try{const url=new URL(s);return url.protocol==='https:'&&!!url.hostname;}catch{return false;}};
const normalize=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const hash=s=>{let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
const attrKeys=['pace','stamina','strength','finishing','passing','dribbling','tackling','positioning','vision','composure','reflexes','handling','heading','crossing','teamwork','decisions'];
const shape={
 GK:{reflexes:1,handling:.5,positioning:.4,decisions:.2,pace:-4,stamina:-4,finishing:-11,dribbling:-6,tackling:-8,crossing:-9,heading:-7,strength:-1,passing:-3,vision:-4},
 CB:{tackling:.7,positioning:.8,heading:.1,strength:.2,pace:-.4,passing:-1,vision:-3,finishing:-7,dribbling:-3,crossing:-5,composure:-.2},
 FB:{pace:.6,stamina:.5,crossing:.4,passing:-.4,strength:-2,heading:-3,vision:-1,finishing:-5},
 DM:{positioning:.5,passing:.4,decisions:.5,teamwork:.5,finishing:-4,crossing:-3,pace:-2,dribbling:-1},
 CM:{passing:.6,vision:.5,decisions:.4,teamwork:.2,finishing:-3,heading:-4,strength:-2,tackling:-2,crossing:-2,pace:-1},
 AM:{vision:.6,dribbling:.5,passing:.5,finishing:-1,strength:-3,heading:-5,tackling:-7,positioning:-2},
 W:{dribbling:.7,pace:.5,crossing:.2,passing:.1,finishing:-.6,heading:-7,strength:-4,tackling:-9,positioning:-2,stamina:-1},
 ST:{finishing:.7,positioning:.5,composure:.3,heading:-.8,passing:-3,vision:-3,crossing:-6,tackling:-9,teamwork:-1,stamina:-2},
};

function anchorFor(p){
 const a=ASSESSMENT_EVIDENCE.players?.[p.id];
 if(!a||a.playerId!==p.id||a.birthDate&&p.birthDate&&a.birthDate!==p.birthDate)return null;
 return a;
}
function performanceEvidence(observation,asOf){
 const unique=new Map(),year=Number(asOf?.slice(0,4)||2026);
 // The current main-league row takes precedence over a season-history summary.
 for(const row of [observation?.performance,...(observation?.performanceHistory||[])]){
  if(!row||!valid(row.rating)||row.rating<1||row.rating>10)continue;
  const season=Number(String(row.season).slice(0,4));
  if(!Number.isInteger(season)||season>year||season<year-3)continue;
  const key=`${season}:${row.competitionId}`;if(unique.has(key))continue;
  const sample=valid(row.minutes)?row.minutes:valid(row.appearances)?row.appearances*60:0;
  if(sample<=0)continue;
  unique.set(key,{...row,weight:Math.min(sample,3000)*Math.pow(.68,Math.max(0,year-season))});
 }
 const rows=[...unique.values()],weight=rows.reduce((s,r)=>s+r.weight,0);
 return {rating:weight?rows.reduce((s,r)=>s+r.rating*r.weight,0)/weight:null,confidence:weight/(weight+900),seasons:new Set(rows.map(r=>Number(String(r.season).slice(0,4)))).size,minutes:valid(observation?.performance?.minutes)&&observation.performance.minutes>=0?observation.performance.minutes:null};
}

/** Reproducible estimate: market evidence is an age-adjusted prior, never an
 * identity shortcut or a substitute for sustained playing performance. */
export function assessPlayer(raw,club,{asOf}={}){
 const explicit=day(asOf);
 let observation=raw.realWorld?.playerId===raw.id?raw.realWorld:null,anchor=anchorFor(raw);
 if(explicit&&day(observation?.observedAt)>explicit)observation=null;
 if(explicit&&day(anchor?.reviewedAt)>explicit)anchor=null;
 asOf=explicit||[day(observation?.observedAt),day(anchor?.reviewedAt)].filter(Boolean).sort().at(-1)||ASSESSMENT_EVIDENCE.asOf;
 const age=valid(raw.age)&&raw.age>=15?raw.age:24,rep=valid(club?.reputation)?club.reputation:70;
 const fallback=clamp(rep-11-(age<21?6:age<24?2:0),36,82);
 const market=valid(observation?.marketValue?.eur)&&observation.marketValue.eur>0&&observation.marketValue.eur<=2e9?observation.marketValue.eur:null;
 const ageCorrection=age<23?.68+(age-16)*.045:age>29?Math.min(2.2,1+(age-29)*.19):1;
 const marketPrior=market?clamp(64+11*Math.log10(Math.max(.02,market*ageCorrection/1e6)),35,92):null;
 const performance=performanceEvidence(observation,asOf);
 const formDelta=performance.rating===null?0:clamp((performance.rating-6.85)*5*performance.confidence,-4,5);
 let target=Math.round(clamp((marketPrior===null?fallback:marketPrior*.88+fallback*.12)+formDelta,35,94));
 if(anchor){
  // A reviewed sustained-performance anchor replaces arbitrary star-name bonuses.
  // Subsequent source snapshots may move it gradually rather than freezing it.
  const reference=valid(anchor.referenceRating)?anchor.referenceRating:performance.rating;
  const adjustment=performance.rating!==null&&reference!==null?clamp((performance.rating-reference)*5*performance.confidence,-6,6):0;
  const yearsSinceReview=Math.max(0,(Date.parse(asOf)-Date.parse(anchor.reviewedAt))/31557600000);
  const trust=Math.exp(-Math.max(0,yearsSinceReview-.5)/2);
  target=Math.round(clamp((anchor.target+adjustment)*trust+target*(1-trust),35,97));
 }
 const potential=Math.max(target,Math.round(clamp(anchor?.potential??target+(age<21?7:age<24?5:age<27?2:0),target,99)));
 const sameClub=observation?.sourceGameClubId?observation.sourceGameClubId===club?.id:normalize(observation?.sourceClub)===normalize(club?.name)&&!!club?.name;
 const sourceImportance=anchor&&(!anchor.sourceGameClubId||anchor.sourceGameClubId===club?.id)&&valid(anchor.clubInfluence)?anchor.clubInfluence+(sameClub&&performance.rating!==null&&valid(anchor.referenceRating)?clamp((performance.rating-anchor.referenceRating)*7*performance.confidence,-8,8):0):null;
 const minutesSignal=sameClub&&valid(observation?.performance?.minutes)?clamp(observation.performance.minutes/2500,0,1)*6:0;
 const influence=Math.round(clamp(sourceImportance??(72+(target-(rep-4))*1.8+minutesSignal),15,98));
 const urls=[observation?.sourceUrl,...(anchor?.evidence||[]).map(x=>x.url)].filter(safeUrl);
 return {version:1,asOf,basis:anchor||market!==null||performance.rating!==null?'source_estimate':'limited_estimate',target,potential,influence,confidence:anchor&&performance.seasons>=2?'high':anchor||market&&performance.confidence>.5?'medium':'low',sourceUrls:[...new Set(urls)],sourceClub:observation?.sourceClub||null,
  components:{market,performance:performance.rating===null?null:Math.round(performance.rating*100)/100,minutes:performance.minutes,historySeasons:performance.seasons},
  ...(anchor?{anchorDate:anchor.reviewedAt,evidence:anchor.evidence}:{}),model:ASSESSMENT_VERSION};
}

/** Build positional skills with a small deterministic shape, then normalize the
 * actual weighted total. Centre-backs and wingers no longer share a striker model. */
export function applyAbilityAssessment(player,raw,club,options={}){
 const assessment=assessPlayer(raw,club,options),result={...player,abilityModel:ABILITY_MODEL,abilityAssessment:assessment,attributes:{}};
 const offsets=shape[abilityRole(raw)];
 for(const key of attrKeys){const jitter=((hash(`${raw.id}:${key}`)%5)-2)*.18;result.attributes[key]=clamp(Math.round(assessment.target/5+(offsets[key]||0)+jitter),1,20);}
 if(raw.position!=='GK'){result.attributes.reflexes=2;result.attributes.handling=2;}
 adjustAbility(result,assessment.target);
 result.potential=Math.max(playerAbility(result),assessment.potential);
 return result;
}

export function validatePlayerAssessments(g){
 for(const p of Object.values(g.players)){
  if(p.abilityModel===undefined&&p.abilityAssessment===undefined)continue;
  const a=p.abilityAssessment;
  if(p.abilityModel!==ABILITY_MODEL||!a||a.version!==1||!day(a.asOf)||!['source_estimate','limited_estimate'].includes(a.basis)||!['high','medium','low'].includes(a.confidence)||!['target','potential','influence'].every(k=>valid(a[k])&&a[k]>=(k==='influence'?0:5)&&a[k]<=100)||a.potential<a.target||!Array.isArray(a.sourceUrls)||a.sourceUrls.length>60||!a.sourceUrls.every(safeUrl))throw Error('Dữ liệu đánh giá cầu thủ không hợp lệ.');
  const c=a.components;
  if(typeof a.model!=='string'||a.model.length>80||!c||typeof c!=='object'||![c.market,c.performance,c.minutes].every(n=>n===null||valid(n)&&n>=0)||c.performance>10||!Number.isInteger(c.historySeasons)||c.historySeasons<0||c.historySeasons>4||a.sourceClub!==null&&typeof a.sourceClub!=='string'||a.anchorDate!==undefined&&!day(a.anchorDate)||a.evidence!==undefined&&(!Array.isArray(a.evidence)||a.evidence.length>60||a.evidence.some(e=>!e||!safeUrl(e.url)||typeof e.title!=='string'||typeof e.fact!=='string'||e.publishedAt!==null&&!day(e.publishedAt))))throw Error('Dữ liệu đánh giá cầu thủ không hợp lệ.');
 }

 return true;
}
