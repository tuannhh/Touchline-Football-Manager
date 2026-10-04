import {competitionSuspension} from './discipline.mjs';
export function nextCompetition(g,p){
 let next;
 for(const f of g.fixtures)if(!f.result&&f.round>=g.round&&(f.home===p.clubId||f.away===p.clubId)&&(!next||f.round<next.round))next=f;
 return next?.leagueId||g.clubs[p.clubId]?.leagueId;
}
export function nextSuspension(g,p){return (p.suspension||0)+competitionSuspension(g,p,nextCompetition(g,p));}
export function hasScopedBan(p){return Object.values(p.discipline?.competitions||{}).some(r=>r.yellowBan||r.redBan);}
