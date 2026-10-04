// Discipline in the career is separate from dated real-world status snapshots.
// Official rules below cover the stages simulated by Touchline, not appeals,
// violent-conduct hearings or the UEFA qualifying rounds (not in this game).
const UEFA='https://documents.uefa.com/r/Regulations-of-the-UEFA-';
export const DISCIPLINE_SOURCES={
 'eng.1':'https://www.premierleague.com/en/news/4110053',
 'uefa.champions':UEFA+'Champions-League-2026/27/Article-63-Yellow-and-red-cards-Online',
 'uefa.europa':UEFA+'Europa-League-2026/27/Article-63-Yellow-and-red-cards-Online',
 'uefa.europa.conf':UEFA+'Conference-League-2026/27/Article-63-Yellow-and-red-cards-Online',
};
export function disciplineRule(g,competitionId){
 const name=[...(g.leagues||[]),...(g.cups||[])].find(c=>c.id===competitionId)?.name||competitionId;
 if(competitionId==='friendly')return {name,kind:'friendly',basis:'simulation',source:null,text:'Giao hữu không tích lũy thẻ hoặc xóa án treo giò chính thức.'};
 if(competitionId?.startsWith('uefa.'))return {name,kind:'uefa',first:g.year>=2026?4:3,every:2,basis:'official',source:(DISCIPLINE_SOURCES[competitionId]||DISCIPLINE_SOURCES['uefa.champions']).replace('2026/27',g.year>=2026?'2026/27':'2025/26'),text:g.year>=2026?'UEFA 2026/27: nghỉ 1 trận sau 4, 6, 8… thẻ vàng từ vòng phân hạng; xóa thẻ lẻ sau tứ kết. Thẻ đỏ tối thiểu 1 trận UEFA.':'UEFA trước 2026/27: nghỉ 1 trận sau 3, 5, 7… thẻ vàng; xóa thẻ lẻ sau tứ kết.',limitations:'Chưa mô phỏng án tăng nặng, khiếu nại hoặc vòng sơ loại. Quy định được giữ cố định cho những mùa mô phỏng sau.'};
 if(competitionId==='eng.1')return {name,kind:'premier',basis:'official',source:DISCIPLINE_SOURCES['eng.1'],thresholds:[{cards:5,deadline:19,ban:1},{cards:10,deadline:32,ban:2},{cards:15,deadline:Infinity,ban:3}],text:'Premier League: 5 thẻ trong 19 trận đầu của CLB nghỉ 1 trận; 10 trong 32 trận đầu nghỉ 2; 15 cả mùa nghỉ 3. Thẻ vàng tính riêng giải.',limitations:'Thẻ đỏ chưa xét loại lỗi, án tăng nặng và khiếu nại; game áp dụng tối thiểu 1 trận trong giải.'};
 return {name,kind:'simulated',first:5,every:5,basis:'simulation',source:null,text:'Quy tắc mô phỏng: mỗi 5 thẻ vàng nghỉ 1 trận trong giải; thẻ đỏ nghỉ 1 trận. Chưa đối chiếu đủ điều lệ hiện hành của giải này.'};
}
const blank=()=>({yellowCards:0,cautions:0,redCards:0,yellowBan:0,redBan:0,issued:[],quarterFinalReset:false});
function state(g,p){
 if(!p.discipline)p.discipline={year:g.year,competitions:{}};
 if(p.discipline.year!==g.year)startDisciplineSeason(g,p);
 return p.discipline;
}
export function startDisciplineSeason(g,p){
 if(!p.discipline)return;
 const previous=p.discipline.competitions;p.discipline={year:g.year,competitions:{}};
 for(const [id,row] of Object.entries(previous)){
  const yellowBan=id.startsWith('uefa.')?0:row.yellowBan;
  if(row.redBan||yellowBan)p.discipline.competitions[id]={...blank(),redBan:row.redBan,yellowBan};
 }
}
export function clearDisciplineBans(p){
 for(const row of Object.values(p.discipline?.competitions||{})){row.yellowBan=0;row.redBan=0;}
}
export function editorDisciplinePatch(player,draft){
 const patch={...draft};
 if(Number(draft.suspension)===player.suspension)delete patch.suspension;
 return patch;
}
export function competitionSuspension(g,p,competitionId){
 if(!p||!competitionId||competitionId==='friendly')return 0;
 let remaining=0;
 for(const [id,row] of Object.entries(p.discipline?.competitions||{})){
  if(id===competitionId)remaining+=row.yellowBan;
  if(id===competitionId||(id.startsWith('uefa.')&&competitionId.startsWith('uefa.')))remaining+=row.redBan;
 }
 return remaining;
}
export function disciplineReport(g,p,competitionId=null){
 const entries=p.discipline?.competitions||{};
 const ids=competitionId?[competitionId]:Object.keys(entries);
 return ids.map(id=>({competitionId:id,season:p.discipline?.year??g.year,...blank(),...entries[id],remaining:competitionSuspension(g,p,id),rule:disciplineRule(g,id),name:disciplineRule(g,id).name}));
}
function yellowSanction(rule,cautions,number){
 if(rule.kind==='premier')return rule.thresholds.find(t=>cautions===t.cards&&number<=t.deadline)?.ban||0;
 return cautions>=rule.first&&(cautions-rule.first)%rule.every===0?1:0;
}
export function recordDiscipline(g,f,m,clubSquads=null){
 if(!m.completed||m.fixtureId!==f.id||m.home!==f.home||m.away!==f.away)throw Error('Không thể cập nhật thẻ khi trận chưa hoàn tất.');
 if(f.leagueId==='friendly'||f.disciplineRecorded)return false;
 const rule=disciplineRule(g,f.leagueId),squads=clubSquads||Object.values(g.players).filter(p=>p.clubId===f.home||p.clubId===f.away);
 // Serving is tied to an actual completed fixture, including while injured.
 // It occurs BEFORE new cards so a new suspension never serves itself.
 for(const p of squads){
  let served=false;
  for(const [id,row] of Object.entries(p.discipline?.competitions||{})){
   if(served)break;
   if(row.redBan>0&&(id===f.leagueId||(id.startsWith('uefa.')&&f.leagueId.startsWith('uefa.')))){row.redBan--;served=true;}
   else if(id===f.leagueId&&row.yellowBan>0){row.yellowBan--;served=true;}
  }
  if(served){p.discipline.lastServedDate=g.date;p.discipline.lastServedRound=g.round;}
 }
 const number=Object.fromEntries([f.home,f.away].map(club=>[club,(g.fixtures||[]).filter(x=>x.id!==f.id&&x.leagueId===f.leagueId&&x.result&&(x.home===club||x.away===club)).length+1]));
 const yellows={...(m.yellows||{})};
 // Imported old match records may retain events but not the yellow-card map.
 for(const e of m.events||[])if(e.type==='yellow'&&e.playerId&&yellows[e.playerId]===undefined)yellows[e.playerId]=1;
 const sentOff=new Set(m.red||[]),involved=new Set([...Object.keys(yellows),...sentOff]);
 for(const id of involved){
  const p=g.players[id];if(!p||![f.home,f.away].includes(p.clubId))continue;
  const row=state(g,p).competitions[f.leagueId]||=(blank());
  const count=Math.max(0,Math.min(2,Math.floor(yellows[id]||0))),secondYellow=sentOff.has(id)&&count>=2;
  row.yellowCards+=count;
  if(!secondYellow&&count){
   row.cautions+=count;
   const ban=yellowSanction(rule,row.cautions,number[p.clubId]);
   if(ban&&!row.issued.includes(row.cautions)){row.yellowBan+=ban;row.issued.push(row.cautions);}
  }
  if(sentOff.has(id)){row.redCards++;row.redBan++;}
 }
 // The yellow count resets after the second quarter-final leg, but a ban
 // earned in that leg remains to be served in the semi-final.
 if(rule.kind==='uefa'&&f.stage==='qf'&&f.leg===f.legs){
  for(const p of squads){const row=p.discipline?.competitions?.[f.leagueId];if(row){row.cautions=0;row.issued=[];row.quarterFinalReset=true;}}
 }
 f.disciplineRecorded=true;return true;
}
export function validateDiscipline(g){
 for(const p of Object.values(g.players)){
  const d=p.discipline;if(d===undefined)continue;
  if(!d||!Number.isInteger(d.year)||d.year<1800||d.year>g.year||!d.competitions||Array.isArray(d.competitions)||Object.keys(d.competitions).length>60)throw Error('Hồ sơ kỷ luật không hợp lệ.');
  for(const [id,row] of Object.entries(d.competitions)){
   if(!/^[a-z0-9.-]{1,80}$/.test(id)||!row||!['yellowCards','cautions','redCards','yellowBan','redBan'].every(k=>Number.isInteger(row[k])&&row[k]>=0&&row[k]<=1000)||!Array.isArray(row.issued)||row.issued.length>100||row.issued.some(n=>!Number.isInteger(n)||n<0)||typeof row.quarterFinalReset!=='boolean')throw Error('Hồ sơ kỷ luật không hợp lệ.');
  }
 }
 return true;
}
