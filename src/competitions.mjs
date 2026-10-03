export const CUP_PHASES={league:'Vòng phân hạng',playoff:'Play-off',r16:'Vòng 1/8',qf:'Tứ kết',sf:'Bán kết',final:'Chung kết',complete:'Đã kết thúc'};
const EURO_WEEKS=[4,8,9,11,14,16,18,22,23,26,27,30,31,34,35,38,39,42];
const dateAt=(year,days)=>new Date(Date.UTC(year,7,15+days)).toISOString().slice(0,10);
export function competition(g,id){return g.leagues.find(l=>l.id===id)||g.cups?.find(l=>l.id===id);}
export function allCompetitions(g){return [...g.leagues.filter(l=>l.kind!=='external'),...(g.cups||[])];}
export function ownCompetitions(g){return allCompetitions(g).filter(l=>l.id===g.clubs[g.clubId].leagueId||l.participants?.includes(g.clubId));}
export function buildCalendar(g,domesticRounds){
 const days=Array.from({length:domesticRounds},(_,week)=>({date:dateAt(g.year,week*7),kind:'domestic',week}));
 if(g.cups?.length)for(const week of EURO_WEEKS)days.push({date:dateAt(g.year,week*7+4),kind:'uefa',week});
 return days.sort((a,b)=>a.date.localeCompare(b.date));
}
function shuffle(ids,g,random){const result=[...ids];for(let i=result.length-1;i>0;i--){const j=Math.floor(random(g)*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;}
export function makeSeasonFixtures(g,schedule,random){
 const domestic=g.leagues.filter(l=>l.kind!=='external');const raw=domestic.flatMap(l=>schedule(Object.values(g.clubs).filter(c=>c.leagueId===l.id).map(c=>c.id),l.id,g.year));
 const total=Math.max(...raw.map(f=>f.round))+1;g.calendar=buildCalendar(g,total);g.seasonParticipants=Object.fromEntries(domestic.map(l=>[l.id,Object.values(g.clubs).filter(c=>c.leagueId===l.id).map(c=>c.id)]));
 const slot=(week,kind)=>g.calendar.findIndex(d=>d.week===week&&d.kind===kind);
 const fixtures=raw.map(f=>({...f,matchday:f.round+1,round:slot(f.round,'domestic'),date:dateAt(g.year,f.round*7),stage:'domestic'}));
 for(const cup of g.cups||[]){
  cup.stage='league';cup.champion=null;cup.ranking=[];cup.qualified=[];
  cup.countrySlots||=cup.participants.reduce((slots,id)=>{const own=g.leagues.find(l=>l.id===g.clubs[id].leagueId),lid=g.leagues.find(l=>l.countryCode===own?.countryCode&&l.tier===1)?.id;if(lid)slots[lid]=(slots[lid]||0)+1;return slots;},{});
  if(cup.participants.length!==36)throw Error(`${cup.name}: cần đủ 36 đội.`);
  const weeks=cup.matchdays===6?[8,9,11,14,16,18]:[4,8,9,11,14,16,22,23];
  // A regular 36-node graph gives every club distinct opponents and exactly 4/4 or 3/3 venues.
  // The career uses its own draw, openly labeled as simulated (not UEFA coefficient pots).
  const ids=shuffle(cup.participants,g,random);
  // First Berger rounds give distinct opponents without double booking.
  const draws=schedule(ids,cup.id,g.year).filter(f=>f.round<cup.matchdays);
  // Orient the union of perfect matchings through Euler tours: even degree => balanced venues.
  const edges=draws.map((f,i)=>({...f,edge:i}));const adjacency=new Map(ids.map(id=>[id,[]]));
  edges.forEach((f,i)=>{adjacency.get(f.home).push(i);adjacency.get(f.away).push(i);});const used=new Set();
  for(const start of ids){const stack=[start];while(stack.length){const v=stack.at(-1),list=adjacency.get(v);while(list.length&&used.has(list.at(-1)))list.pop();if(!list.length){stack.pop();continue;}const index=list.pop();if(used.has(index))continue;used.add(index);const f=edges[index],w=f.home===v?f.away:f.home;f.home=v;f.away=w;stack.push(w);}}
  for(const f of edges){const week=weeks[f.round];fixtures.push({id:f.id,leagueId:cup.id,matchday:f.round+1,round:slot(week,'uefa'),date:dateAt(g.year,week*7+4),home:f.home,away:f.away,result:null,stage:'league'});}
 }
 return fixtures.sort((a,b)=>a.round-b.round||a.leagueId.localeCompare(b.leagueId));
}
function knockout(g,cup,phase,pairs,weeks){
 cup.stage=phase;
 for(let i=0;i<pairs.length;i++){
  const [high,low]=pairs[i],tieId=`${g.year}-${cup.id}-${phase}-${i}`;
  weeks.forEach((week,leg)=>{const single=weeks.length===1,home=single||leg===1?high:low,away=home===high?low:high;
   g.fixtures.push({id:`${tieId}-${leg+1}`,tieId,leagueId:cup.id,stage:phase,leg:leg+1,legs:weeks.length,matchday:null,round:g.calendar.findIndex(d=>d.week===week&&d.kind==='uefa'),date:g.calendar.find(d=>d.week===week&&d.kind==='uefa').date,home,away,result:null,neutral:single});
  });
 }
 g.fixtures.sort((a,b)=>a.round-b.round||a.id.localeCompare(b.id));
}
export function settleKnockout(g,f,m,random){
 if(!f.tieId||f.leg!==f.legs)return;
 const first=f.legs===2?g.fixtures.find(x=>x.tieId===f.tieId&&x.leg===1):null;
 const aggregate=[m.score[0]+(first?.result?.score[1]||0),m.score[1]+(first?.result?.score[0]||0)];
 m.aggregate=aggregate;
 if(aggregate[0]===aggregate[1]){
  // Extra time is resolved in the match engine before this call. Shoot-outs do not add to the score.
  let h=0,a=0;for(let i=0;i<5;i++){h+=random(m)<.76?1:0;a+=random(m)<.76?1:0;}
  let attempts=0;while(h===a&&attempts++<30){h+=random(m)<.76?1:0;a+=random(m)<.76?1:0;}if(h===a){if(random(m)<.5)h++;else a++;}
  m.penalties=[h,a];m.winner=h>a?f.home:f.away;m.events.push({minute:m.minute,type:'penalties',text:`Luân lưu ${h} – ${a}. ${g.clubs[m.winner].name} đi tiếp.`});
 }else m.winner=aggregate[0]>aggregate[1]?f.home:f.away;
}
export function updateCups(g,table,notify){
 for(const cup of g.cups||[]){
  if(cup.stage==='complete')continue;
  const matches=g.fixtures.filter(f=>f.leagueId===cup.id&&f.stage===cup.stage);
  if(!matches.length||matches.some(f=>!f.result))continue;
  if(cup.stage==='league'){
   const ranks=table(g,cup.id).map(r=>r.clubId);cup.ranking=ranks;cup.qualified=ranks.slice(0,8);
   knockout(g,cup,'playoff',ranks.slice(8,16).map((id,i)=>[id,ranks[23-i]]),[26,27]);
   if(cup.participants.includes(g.clubId))notify(`Kết thúc vòng phân hạng ${cup.shortName}`,`CLB xếp hạng ${ranks.indexOf(g.clubId)+1}/36. Top 8 vào thẳng vòng 1/8; hạng 9–24 đá play-off; các đội còn lại dừng bước.`);
  }else{
   const winners=matches.filter(f=>f.leg===f.legs).map(f=>f.result.winner);
   if(winners.some(id=>!id))throw Error('Cặp đấu loại trực tiếp chưa có đội thắng.');
   if(cup.stage==='final'){cup.champion=winners[0];cup.stage='complete';if(cup.participants.includes(g.clubId))notify(`${g.clubs[cup.champion].name} vô địch ${cup.shortName}`,`Giải đã khép lại. Nhà vô địch: ${g.clubs[cup.champion].name}. Toàn bộ kết quả được lưu ở lịch thi đấu và phòng truyền thống.`);continue;}
   if(cup.stage==='playoff')knockout(g,cup,'r16',cup.qualified.map((id,i)=>[id,winners[7-i]]),[30,31]);
   else{const next={r16:['qf',[34,35]],qf:['sf',[38,39]],sf:['final',[42]]}[cup.stage];knockout(g,cup,next[0],Array.from({length:winners.length/2},(_,i)=>[winners[i*2],winners[i*2+1]]),next[1]);}
  }
 }
}
export function nextEurope(g,standings){
 const used=new Set();return (g.cups||[]).map(cup=>{
  const participants=[];const quotas={...cup.countrySlots};
  for(const id of cup.participants){const lid=g.clubs[id].leagueId;if(lid==='eur.other'&&!used.has(id)){participants.push(id);used.add(id);}}
  // The career preserves the source season's allocation per country; places move with league finishes.
  for(const [lid,count]of Object.entries(quotas))for(const row of (standings[lid]||[]).filter(r=>!used.has(r.clubId)).slice(0,count)){participants.push(row.clubId);used.add(row.clubId);}
  for(const id of cup.participants)if(participants.length<36&&!used.has(id)){participants.push(id);used.add(id);}
  return {...cup,participants,qualificationMode:'Vị trí giải quốc nội; số suất mỗi quốc gia giữ theo snapshot đầu game. Chưa mô phỏng vòng sơ loại, suất qua cúp quốc gia và hệ số UEFA.'};
 });
}
