export function competitionTeamStats(g,id){
 const members=g.cups?.find(c=>c.id===id)?.participants||g.seasonParticipants?.[id]||Object.values(g.clubs).filter(c=>c.leagueId===id).map(c=>c.id);
 const rows=new Map(members.map(clubId=>[clubId,{clubId,played:0,won:0,drawn:0,lost:0,gf:0,ga:0,cleanSheets:0}]));
 for(const f of g.fixtures||[]){
  if(f.leagueId!==id||!f.result||f.cancelled)continue;
  for(const [side,clubId]of [f.home,f.away].entries()){
   if(!g.clubs[clubId])continue;
   if(!rows.has(clubId))rows.set(clubId,{clubId,played:0,won:0,drawn:0,lost:0,gf:0,ga:0,cleanSheets:0});
   const r=rows.get(clubId),gf=f.result.score[side],ga=f.result.score[1-side];
   r.played++;r.gf+=gf;r.ga+=ga;r.cleanSheets+=Number(ga===0);r.won+=Number(gf>ga);r.drawn+=Number(gf===ga);r.lost+=Number(gf<ga);
  }
 }
 return [...rows.values()].sort((a,b)=>b.gf-a.gf||a.ga-b.ga||a.clubId.localeCompare(b.clubId));
}
export function competitionPlayerStats(g,id,sort='goals'){
 const key=['goals','assists','appearances'].includes(sort)?sort:'goals';
 return Object.values(g.players).filter(p=>p.competitionStats?.[id]?.appearances>0).map(p=>({p,stat:p.competitionStats[id]})).sort((a,b)=>(b.stat[key]||0)-(a.stat[key]||0)||a.p.name.localeCompare(b.p.name));
}
