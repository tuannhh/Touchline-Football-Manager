// Touchline estimates, not a licensed or official player-rating database.
export const ABILITY_MODEL='evidence-v1';
export const LEGACY_ABILITY_KEYS={GK:['reflexes','handling','positioning','composure','decisions'],DF:['tackling','positioning','heading','strength','pace','decisions'],MF:['passing','vision','teamwork','dribbling','stamina','decisions'],FW:['finishing','dribbling','pace','composure','positioning','heading']};
const WEIGHTS={
 GK:{reflexes:26,handling:20,positioning:18,composure:10,decisions:14,passing:7,teamwork:5},
 CB:{tackling:20,positioning:24,heading:13,strength:13,pace:10,decisions:12,passing:4,composure:4},
 FB:{tackling:16,positioning:12,pace:16,stamina:14,crossing:16,passing:10,decisions:8,teamwork:8},
 DM:{tackling:15,positioning:16,passing:18,decisions:16,teamwork:12,stamina:10,vision:8,composure:5},
 CM:{passing:23,vision:18,decisions:17,teamwork:12,dribbling:12,stamina:10,composure:8},
 AM:{passing:18,vision:22,dribbling:18,decisions:14,composure:12,finishing:10,teamwork:6},
 W:{dribbling:23,pace:18,passing:12,vision:10,crossing:12,finishing:12,decisions:7,composure:6},
 ST:{finishing:25,positioning:20,composure:15,pace:10,heading:10,strength:8,dribbling:7,decisions:5},
};
const ROLE_MAP={GK:'GK',CB:'CB',LB:'FB',RB:'FB',LWB:'FB',RWB:'FB',DM:'DM',CDM:'DM',CM:'CM',AM:'AM',CAM:'AM',LM:'W',RM:'W',LW:'W',RW:'W',SS:'AM',CF:'ST',ST:'ST'};
const BROAD_MAP={GK:'GK',DF:'CB',MF:'CM',FW:'ST'};
const NORMALIZED=Object.fromEntries(Object.entries(WEIGHTS).map(([role,weights])=>[role,Object.freeze(Object.fromEntries(Object.entries(weights).map(([key,value])=>[key,value/100])))]));
const LEGACY=Object.fromEntries(Object.entries(LEGACY_ABILITY_KEYS).map(([role,keys])=>[role,Object.freeze(Object.fromEntries(keys.map(key=>[key,1/keys.length])))]));
const ENTRIES=new Map([...Object.values(NORMALIZED),...Object.values(LEGACY)].map(weights=>[weights,Object.entries(weights)]));
export function abilityRole(p){
 const role=p?.naturalPositions?.[0];
 return ROLE_MAP[role]||BROAD_MAP[p?.position]||'CM';
}
export function abilityWeights(p){
 return p?.abilityModel===ABILITY_MODEL?NORMALIZED[abilityRole(p)]:LEGACY[p?.position]||LEGACY.MF;
}
const exact=p=>{
 if(p?.abilityModel!==ABILITY_MODEL){const keys=LEGACY_ABILITY_KEYS[p?.position]||LEGACY_ABILITY_KEYS.MF;let sum=0;for(const key of keys)sum+=Number.isFinite(p?.attributes?.[key])?p.attributes[key]:10;return sum/keys.length*5;}
 let total=0;for(const [key,weight]of ENTRIES.get(abilityWeights(p))){const value=p?.attributes?.[key];total+=(Number.isFinite(value)?value:10)*weight*5;}return total;
};
export const playerAbility=p=>Math.round(exact(p));

/** Adjust integer /20 attributes towards a target without changing non-role skills.
 * The residual is minimized explicitly; the random skill spread cannot reverse
 * the intended player hierarchy or push a player above the requested ceiling.
 */
export function adjustAbility(p,target){
 if(!p.attributes||!Number.isFinite(target))return playerAbility(p);
 target=Math.min(99,Math.max(5,target));
 const weights=abilityWeights(p),initial={...p.attributes};
 for(let n=0;n<300;n++){
  const now=exact(p);if(Math.abs(target-now)<.025)break;
  const direction=Math.sign(target-now);
  let best=null,bestError=Math.abs(target-now),bestSpread=Infinity;
  for(const [key,weight]of Object.entries(weights)){
   const value=p.attributes[key];if(!Number.isInteger(value)||value+direction<1||value+direction>20)continue;
   const error=Math.abs(target-(now+direction*weight*5)),spread=Math.abs(value+direction-initial[key]);
   if(error<bestError-1e-8||Math.abs(error-bestError)<1e-8&&spread<bestSpread){best=key;bestError=error;bestSpread=spread;}
  }
  if(!best||bestError>=Math.abs(target-now)-1e-8)break;
  p.attributes[best]+=direction;
 }
 return playerAbility(p);
}
