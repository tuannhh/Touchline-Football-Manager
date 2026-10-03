import {FORMATION_SLOTS,roleFit} from './tactics.mjs';
import {matchesPosition} from './playerPositions.mjs';
import {overall,available,transferQuote,clubPlayers} from './engine.mjs';
const ROLES=new Set(Object.values(FORMATION_SLOTS).flatMap(xs=>xs.map(x=>x[0])));
export function validateRecruitmentPlan(g){
 const p=g.recruitmentPlan;if(p===undefined)return true;
 if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).some(k=>!['position','maxAge','maxFee','maxWage'].includes(k))||!ROLES.has(p.position)||!Number.isInteger(p.maxAge)||p.maxAge<16||p.maxAge>50||!Number.isFinite(p.maxFee)||p.maxFee<0||p.maxFee>1e12||!Number.isFinite(p.maxWage)||p.maxWage<0||p.maxWage>1e8)throw Error('Yêu cầu tuyển mộ không hợp lệ.');
 return true;
}
export function setRecruitmentPlan(g,plan){if(g.liveMatch)throw Error('Hãy hoàn tất trận đấu trước khi đổi kế hoạch tuyển mộ.');validateRecruitmentPlan({recruitmentPlan:plan});g.recruitmentPlan={...plan};}
export function squadDepth(g,formation=g.formation){
 const squad=clubPlayers(g,g.clubId),counts={};for(const [role]of FORMATION_SLOTS[formation]||FORMATION_SLOTS[g.formation])counts[role]=(counts[role]||0)+1;
 return Object.entries(counts).map(([role,needed])=>{const players=squad.filter(p=>roleFit(p,role)>=.84).sort((a,b)=>Number(available(b))-Number(available(a))||overall(b)*roleFit(b,role)-overall(a)*roleFit(a,role)||a.id.localeCompare(b.id));const ready=players.filter(available).length;return {role,needed,players,ready,target:needed*2,gap:Math.max(0,needed*2-ready)};});
}
export function recruitmentMatches(g,plan=g.recruitmentPlan){
 if(!plan)return [];validateRecruitmentPlan({recruitmentPlan:plan});
 return Object.values(g.players).filter(p=>p.clubId!==g.clubId&&matchesPosition(p,plan.position)&&p.age<=plan.maxAge&&transferQuote(g,p)<=plan.maxFee&&p.wage<=plan.maxWage).sort((a,b)=>Number(b.listed)-Number(a.listed)||overall(b)-overall(a)||a.id.localeCompare(b.id)).slice(0,8).map(p=>({player:p,fee:transferQuote(g,p),wage:p.wage}));
}
