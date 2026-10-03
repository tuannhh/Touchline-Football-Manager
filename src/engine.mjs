import {number,money,dateLabel} from './locale.mjs';
import {validateSaveMetadata} from './saveSlots.mjs';
import {validateRecruitmentPlan} from './recruitment.mjs';
import {initializeMatchday,repairBench,matchdayRule,matchSubLimit,validateMatchday} from './matchday.mjs';
import {initializeInternational,processInternationalDate,validateInternational} from './international.mjs';
import {mergeInternationalCalendar} from './careerCalendar.mjs';
import {mergeHomegrown} from './homegrown.mjs';
import {initializePlayerDynamics,reviewPlayerDynamics,noteInjury,resetDynamicsAfterTransfer,validatePlayerDynamics} from './playerDynamics.mjs';
import {mergePortraits} from './portraits.mjs';
import {initializeStaff,validateStaff,staffEffects,staffWeeklyWages,assignedStaff,runStaffWeek,handlePress,sendStaffReport} from './staff.mjs';
import {initializeTransferMarket,validateTransferMarket,finalizeNegotiation,runAITransfers,sellToAI} from './transfers.mjs';
import {makeMessage,upgradeMessages,mailParagraphs} from './mail.mjs';
import {registered,autoRegistration,registrationRule,registrationReport} from './registration.mjs';
import {makeSeasonFixtures,settleKnockout,updateCups,nextEurope,competition,ownCompetitions} from './competitions.mjs';
import {FORMATIONS,FORMATION_SLOTS,DEFAULT_TACTICS,TACTICAL_PRESETS,POSITION_DETAIL,FOOT,normalizeTactics,validTactics,roleFit,tacticalEffects,fatigueRate,TACTICAL_PHASES,createPhaseTactics,validPhaseTactics,phaseLineup,phaseSlot,remapPhaseFormation,swapPhaseSeats,phaseTransitionEffort,phaseShapeEffects} from './tactics.mjs';
export {FORMATIONS} from './tactics.mjs';
export const SCHEMA = 3;
export const ATTRS = {pace:'Tốc độ',stamina:'Thể lực',strength:'Sức mạnh',finishing:'Dứt điểm',passing:'Chuyền bóng',dribbling:'Rê bóng',tackling:'Tắc bóng',positioning:'Chọn vị trí',vision:'Tầm nhìn',composure:'Bình tĩnh',reflexes:'Phản xạ',handling:'Bắt bóng',heading:'Đánh đầu',crossing:'Tạt bóng',teamwork:'Phối hợp',decisions:'Quyết định'};
export const POSITION = {GK:'Thủ môn',DF:'Hậu vệ',MF:'Tiền vệ',FW:'Tiền đạo'};
export const clamp = (n,lo,hi) => Math.min(hi,Math.max(lo,n));
export function hash(str){let h=2166136261;for(const c of String(str)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
export function random(holder){holder.rng=(Math.imul(holder.rng,1664525)+1013904223)>>>0;return holder.rng/4294967296;}
const mean=a=>a.length?a.reduce((s,n)=>s+n,0)/a.length:0;
const KEYS={GK:['reflexes','handling','positioning','composure','decisions'],DF:['tackling','positioning','heading','strength','pace','decisions'],MF:['passing','vision','teamwork','dribbling','stamina','decisions'],FW:['finishing','dribbling','pace','composure','positioning','heading']};
export const overall=p=>Math.round(mean(KEYS[p.position].map(k=>p.attributes[k]))*5);
export {money,dateLabel};
const rosterCache=new WeakMap();
export function clubPlayers(g,id){let index=rosterCache.get(g.players);if(!index){index={};for(const p of Object.values(g.players))(index[p.clubId]??=[]).push(p);rosterCache.set(g.players,index);}return [...(index[id]||[])];}
export const invalidateRosters=g=>rosterCache.delete(g.players);
export const available=p=>!!p&&p.injury===0&&p.suspension===0&&!p.internationalDuty?.active;
const repMap={'Barcelona':90,'Real Madrid':92,'Manchester City':90,'Arsenal':88,'Liverpool':89,'Bayern Munich':90,'Paris Saint-Germain':89,'Internazionale':86,'Bayer Leverkusen':83,'Borussia Dortmund':82,'Atlético Madrid':85,'Chelsea':85,'Manchester United':82,'Tottenham Hotspur':81,'Newcastle United':82,'Aston Villa':82,'Juventus':83,'AC Milan':82,'Napoli':85,'Atalanta':82,'AS Roma':80,'Benfica':81,'FC Porto':79,'Sporting CP':82,'Ajax Amsterdam':78,'PSV Eindhoven':80,'Feyenoord Rotterdam':78};
const elite={'Lamine Yamal':94,'Pedri':92,'Raphinha':90,'Rodri':90,'Kylian Mbappé':95,'Erling Haaland':95,'Jude Bellingham':92,'Vinícius Júnior':92,'Jamal Musiala':91,'Florian Wirtz':90,'Bukayo Saka':91,'Mohamed Salah':92,'Harry Kane':92,'Ousmane Dembélé':91,'Cole Palmer':89,'Declan Rice':88,'Frenkie de Jong':88,'Pau Cubarsí':87,'Jules Koundé':87,'Gavi':85,'Dani Olmo':86,'Joan García':85,'Alejandro Balde':85,'Gabriel Jesus':82,'Anthony Gordon':84,'Karim Adeyemi':83};
export function profile(raw,club,seasonYear=2026){
  const r={rng:hash(raw.id)};const age=raw.age??24;
  const apps=raw.sourceStats?.appearances||0;
  const base=elite[raw.name]??clamp(club.reputation-9+(random(r)-.5)*16+(apps>4?4:0)-(age<21?5:0),38,87);
  const attributes={};for(const key of Object.keys(ATTRS))attributes[key]=clamp(Math.round(base/5+(random(r)-.5)*5+(KEYS[raw.position].includes(key)?0:-2)),1,20);
  if(raw.position!=='GK'){attributes.reflexes=clamp(Math.round(random(r)*4+1),1,20);attributes.handling=clamp(Math.round(random(r)*3+1),1,20);}
  const p={...raw,attributes,age,ageEstimated:raw.age==null,potential:clamp(Math.round(base+(age<24?9+random(r)*7:3)),1,100),fitness:100,morale:82,injury:0,suspension:0,goals:0,assists:0,appearances:0,seasonMinutes:0,form:[],listed:false,contractUntil:seasonYear+2+Math.floor(random(r)*4)};
  p.potential=Math.max(p.potential,overall(p));
  p.value=Math.round(Math.max(25000,Math.pow(overall(p)/45,6)*700000*(age<24?1.35:age>32?.35:1))/10000)*10000;
  p.wage=Math.round(p.value/450/100)*100;return p;
}
export function schedule(ids,leagueId,year){
  const ring=[...ids];if(ring.length%2)ring.push(null);const first=[];
  for(let round=0;round<ring.length-1;round++){
    const matches=[];for(let i=0;i<ring.length/2;i++){
      const a=ring[i],b=ring[ring.length-1-i];if(!a||!b)continue;
      const flip=(i===0?round:i)%2===1;matches.push({id:`${year}-${leagueId}-${round}-${i}`,leagueId,round,home:flip?b:a,away:flip?a:b,result:null});
    }first.push(matches);ring.splice(1,0,ring.pop());
  }
  return [...first.flat(),...first.flatMap((xs,r)=>xs.map((x,i)=>({...x,id:`${year}-${leagueId}-${r+first.length}-${i}`,round:r+first.length,home:x.away,away:x.home})))];
}
export function autoLineup(g,clubId,formation='4-3-3',competitionId=clubId===g.clubId?currentFixture(g)?.leagueId:g.clubs[clubId].leagueId){
  const pool=clubPlayers(g,clubId).filter(p=>available(p)&&registered(g,p,competitionId));const used=new Set();
  return FORMATION_SLOTS[formation].map(([role])=>{
    const candidates=pool.filter(p=>!used.has(p.id)).sort((a,b)=>(overall(b)*roleFit(b,role)+b.fitness/15)-(overall(a)*roleFit(a,role)+a.fitness/15));
    const p=candidates[0];if(!p)return null;used.add(p.id);return p.id;
  });
}
export function autoPhaseLineup(g,competitionId=currentFixture(g)?.leagueId){
 if(!g.phaseTactics?.enabled)return autoLineup(g,g.clubId,g.formation,competitionId);
 const shape=g.phaseTactics.inPossession,chosen=autoLineup(g,g.clubId,shape.formation,competitionId),lineup=Array(11).fill(null);
 shape.slots.forEach((seat,index)=>{lineup[seat]=chosen[index];});return lineup;
}
export function newGame(db,clubId='e83',manager='HLV',seed=Date.now()){
  if(!db.clubs.some(c=>c.id===clubId))throw Error('CLB không tồn tại.');
  const seasonYear=Number(String(db.release?.season||db.meta?.season||'2026/27').slice(0,4));
  if(!Number.isInteger(seasonYear)||seasonYear<2026||seasonYear>2200)throw Error('Mùa của bản đội hình không hợp lệ.');
  const g={schema:SCHEMA,id:`career-${Date.now()}-${Math.floor(Math.random()*1e6)}`,manager:manager.trim().slice(0,40)||'HLV',clubId,year:seasonYear,round:0,date:`${seasonYear}-08-15`,rng:seed>>>0,dbMeta:structuredClone(db.meta),leagues:structuredClone(db.leagues),clubs:{},players:{},fixtures:[],lineup:[],formation:'4-3-3',mentality:'balanced',training:'balanced',intensity:'normal',shortlist:[],messages:[],transfers:[],history:[],ledger:[],liveMatch:null,editorUsed:false,editorLog:[]};
  for(const c of db.clubs){const tier=db.leagues.find(l=>l.id===c.leagueId)?.tier||1;const reputation=repMap[c.name]??(c.leagueId.startsWith('vie.')?56-tier*4:['por.1','ned.1'].includes(c.leagueId)?69:c.leagueId==='eur.other'?68:76-(tier-1)*9);const budget=Math.round(Math.pow(reputation/70,5)*(c.leagueId.startsWith('vie.')?500000:23000000)/tier);g.clubs[c.id]={...c,reputation,budget,cash:budget*2,wageBudget:0};}
  for(const p of db.players)g.players[p.id]=profile(p,g.clubs[p.clubId],seasonYear);
  for(const c of Object.values(g.clubs)){c.wageBudget=Math.round(clubPlayers(g,c.id).reduce((s,p)=>s+p.wage,0)*1.35);}
  mergeHomegrown(g,db.homegrownIndex);initializeInternational(g);g.tactics={...DEFAULT_TACTICS};g.cups=structuredClone(db.competitions||[]);g.fixtures=makeSeasonFixtures(g,schedule,random);g.registrations={};initializeRegistrations(g);
  g.lineup=autoLineup(g,clubId);addMessage(g,'Chào mừng đến '+g.clubs[clubId].name,`Ban lãnh đạo dành ${money(g.clubs[clubId].budget)} cho chuyển nhượng. Chọn đội hình, thiết lập chiến thuật và bắt đầu vòng đấu đầu tiên.`, 'board');
  initializeStaff(g);initializeTransferMarket(g);initializePlayerDynamics(g);initializeMatchday(g);repairBench(g,{eligible:p=>available(p)&&registered(g,p,currentFixture(g)?.leagueId),rank:overall,fill:true});mergeInternationalCalendar(g,{fresh:true});processInternationalDate(g,g.date);
  return g;
}
export function addMessage(g,title,body,type='news',details={}){const m=makeMessage(g,title,body,type,details);m.paragraphs??=mailParagraphs(m,g);g.messages.unshift(m);g.messages=g.messages.slice(0,250);return m;}
export function initializeRegistrations(g){g.registrations={};for(const c of Object.values(g.clubs)){const ids=[c.leagueId,...(g.cups||[]).filter(x=>x.participants.includes(c.id)).map(x=>x.id)];for(const id of ids)if(registrationRule(g,id).mode==='enforced'){g.registrations[id]||={};g.registrations[id][c.id]=autoRegistration(g,id,c.id,overall);}}}
export function table(g,leagueId){
  const members=g.cups?.find(c=>c.id===leagueId)?.participants||g.seasonParticipants?.[leagueId]||Object.values(g.clubs).filter(c=>c.leagueId===leagueId).map(c=>c.id);
  const rows=members.map(id=>({clubId:id,played:0,won:0,drawn:0,lost:0,gf:0,ga:0,points:0,form:[]}));const map=Object.fromEntries(rows.map(r=>[r.clubId,r]));
  for(const f of g.fixtures.filter(f=>f.leagueId===leagueId&&f.result&&(!f.stage||['domestic','league'].includes(f.stage))).sort((a,b)=>a.round-b.round)){
    const [h,a]=[map[f.home],map[f.away]],[hg,ag]=f.result.score;h.played++;a.played++;h.gf+=hg;h.ga+=ag;a.gf+=ag;a.ga+=hg;
    if(hg===ag){h.drawn++;a.drawn++;h.points++;a.points++;h.form.push('D');a.form.push('D');}
    else{const w=hg>ag?h:a,l=hg>ag?a:h;w.won++;w.points+=3;l.lost++;w.form.push('W');l.form.push('L');}
  }
  return rows.sort((a,b)=>b.points-a.points||(b.gf-b.ga)-(a.gf-a.ga)||b.gf-a.gf||g.clubs[a.clubId].name.localeCompare(g.clubs[b.clubId].name));
}
export const currentFixture=g=>g.fixtures.find(f=>f.round===g.round&&!f.result&&(f.home===g.clubId||f.away===g.clubId));
export const fixtureById=(g,id)=>g.fixtures.find(f=>f.id===id)||(g.friendlies||[]).find(f=>f.id===id);
export const maxRounds=g=>g.calendar?.length||Math.max(...g.fixtures.map(f=>f.round))+1;
export function repairLineup(g){
  const cid=currentFixture(g)?.leagueId;const used=new Set();g.lineup=g.lineup.map(id=>{const p=g.players[id];if(!p||p.clubId!==g.clubId||!available(p)||!registered(g,p,cid)||used.has(id))return null;used.add(id);return id;});
  if(g.phaseTactics?.enabled){
    const pool=clubPlayers(g,g.clubId).filter(p=>available(p)&&registered(g,p,cid));
    g.lineup=g.lineup.map((id,seat)=>{if(id)return id;const role=phaseSlot(g.phaseTactics,'inPossession',seat,g.formation)[0];const candidate=pool.filter(p=>!used.has(p.id)).sort((a,b)=>(overall(b)*roleFit(b,role)+b.fitness/15)-(overall(a)*roleFit(a,role)+a.fitness/15))[0]?.id;if(candidate)used.add(candidate);return candidate||null;});
  }else{
    const best=autoLineup(g,g.clubId,g.formation);g.lineup=g.lineup.map((id,i)=>{if(id)return id;const candidate=[best[i],...best,...clubPlayers(g,g.clubId).filter(p=>available(p)&&registered(g,p,cid)).map(p=>p.id)].find(x=>x&&!used.has(x));if(candidate)used.add(candidate);return candidate||null;});
  }
  if(g.benchVersion!==undefined)repairBench(g,{eligible:p=>available(p)&&registered(g,p,cid),rank:overall});
}
export function rearrangeLineup(g,ids,formation){
 const pool=[...new Set(ids.filter(id=>g.players[id]))];while(pool.length<11)pool.push(null);
 // Find the best assignment of this eleven as a whole. A greedy LB/DM choice
 // can otherwise consume the only suitable forward before reaching that slot.
 const scores=new Float64Array(1<<11).fill(-Infinity),chosen=new Int8Array(1<<11).fill(-1);scores[0]=0;
 for(let mask=0;mask<(1<<11)-1;mask++){let slot=0;for(let n=mask;n;n&=n-1)slot++;
  const role=FORMATION_SLOTS[formation][slot][0];
  for(let i=0;i<11;i++)if(!(mask&(1<<i))){const next=mask|(1<<i),score=scores[mask]+roleFit(g.players[pool[i]],role)*100+(ids[slot]===pool[i]?.001:0);if(score>scores[next]){scores[next]=score;chosen[next]=i;}}
 }
 const lineup=Array(11).fill(null);let mask=(1<<11)-1;for(let slot=10;slot>=0;slot--){const i=chosen[mask];lineup[slot]=pool[i];mask^=1<<i;}return lineup;
}
export function setFormation(g,formation){if(!FORMATIONS[formation])throw Error('Sơ đồ không hợp lệ.');if(g.phaseTactics?.enabled)remapPhaseFormation(g.phaseTactics,'inPossession',formation,g.lineup,g.players);else g.lineup=rearrangeLineup(g,g.lineup,formation);g.formation=formation;g.tactics={...normalizeTactics(g.tactics),presetId:'custom'};}
export function applyTacticPreset(g,id){const p=TACTICAL_PRESETS.find(p=>p.id===id);if(!p)throw Error('Mẫu chiến thuật không hợp lệ.');setFormation(g,p.formation);g.mentality=p.mentality;g.tactics={...p.settings};}
export function assignSlot(g,index,id,competitionId=currentFixture(g)?.leagueId){const p=g.players[id];if(!Number.isInteger(index)||index<0||index>10||!p||p.clubId!==g.clubId||!available(p)||!registered(g,p,competitionId))throw Error('Cầu thủ không đủ điều kiện hoặc chưa đăng ký cho giải đấu.');const old=g.lineup.indexOf(id);if(old>=0)[g.lineup[old],g.lineup[index]]=[g.lineup[index],g.lineup[old]];else{const outgoing=g.lineup[index],seat=g.bench?.indexOf(id)??-1;g.lineup[index]=id;if(seat>=0){g.bench[seat]=outgoing;g.bench=g.bench.filter(Boolean);}}if(g.benchVersion!==undefined)repairBench(g,{competitionId,eligible:p=>available(p)&&registered(g,p,competitionId)});}
export function enablePhaseTactics(g,enabled=true){
 if(enabled){if(!g.phaseTactics?.enabled)g.phaseTactics=createPhaseTactics(g.formation);}
 else if(g.phaseTactics){if(g.phaseTactics.enabled){g.lineup=phaseLineup(g.lineup,g.phaseTactics,'inPossession',g.formation);g.formation=g.phaseTactics.inPossession.formation;}delete g.phaseTactics;}
}
export function setPhaseFormation(g,phase,formation){
 if(!g.phaseTactics?.enabled)throw Error('Hãy bật hai sơ đồ theo pha trước.');
 remapPhaseFormation(g.phaseTactics,phase,formation,g.lineup,g.players);g.tactics={...normalizeTactics(g.tactics),presetId:'custom'};
}
export function assignPhaseSlot(g,phase,index,id,competitionId=currentFixture(g)?.leagueId){
 if(!g.phaseTactics?.enabled)return assignSlot(g,index,id,competitionId);
 const p=g.players[id],shape=g.phaseTactics[phase];
 if(!shape||!Number.isInteger(index)||index<0||index>10||!p||p.clubId!==g.clubId||!available(p)||!registered(g,p,competitionId))throw Error('Cầu thủ hoặc vị trí theo pha không hợp lệ.');
 const seat=g.lineup.indexOf(id);if(seat>=0)swapPhaseSeats(g.phaseTactics,phase,index,seat);else assignSlot(g,shape.slots[index],id,competitionId);
}
function requireLiveTactics(g,m,side){if(m.completed||![0,1].includes(side)||[m.home,m.away][side]!==g.clubId)throw Error('Không thể chỉnh chiến thuật lúc này.');}
export function enableMatchPhaseTactics(g,m,side,enabled=true){
 requireLiveTactics(g,m,side);
 if(enabled){m.phaseTactics||=[null,null];if(!m.phaseTactics[side]?.enabled)m.phaseTactics[side]=createPhaseTactics(m.formation[side]);}
 else if(m.phaseTactics?.[side]){const cfg=m.phaseTactics[side];if(cfg.enabled){m.lineups[side]=phaseLineup(m.lineups[side],cfg,'inPossession',m.formation[side]);m.formation[side]=cfg.inPossession.formation;}m.phaseTactics[side]=null;if(m.phaseTactics.every(v=>!v))delete m.phaseTactics;}
 event(m,'tactics',enabled?'Bật sơ đồ riêng khi có bóng và khi không có bóng.':'Dùng sơ đồ có bóng cho cả hai pha.',{side});return m;
}
export function setMatchPhaseFormation(g,m,side,phase,formation){
 requireLiveTactics(g,m,side);if(!m.phaseTactics?.[side]?.enabled)throw Error('Hãy bật hai sơ đồ theo pha trước.');
 remapPhaseFormation(m.phaseTactics[side],phase,formation,m.lineups[side],g.players);
 m.tactics[side]={...normalizeTactics(m.tactics[side]),presetId:'custom'};
 event(m,'tactics',`${TACTICAL_PHASES[phase]}: chuyển sang ${formation}.`,{side});return m;
}
export function assignMatchPhaseSlot(g,m,side,phase,index,id){
 requireLiveTactics(g,m,side);const cfg=m.phaseTactics?.[side];if(!cfg?.enabled)return assignMatchSlot(g,m,side,index,id);
 const shape=cfg[phase],p=g.players[id];if(!shape||!Number.isInteger(index)||index<0||index>10||!p||p.clubId!==g.clubId||m.off.includes(id)||m.red.includes(id)||m.injured.includes(id))throw Error('Cầu thủ đã rời sân hoặc vị trí không hợp lệ.');
 const seat=m.lineups[side].indexOf(id);if(seat<0)return assignMatchSlot(g,m,side,shape.slots[index],id);
 swapPhaseSeats(cfg,phase,index,seat);event(m,'tactics',`${p.name} đổi vị trí ${TACTICAL_PHASES[phase].toLowerCase()}.`,{side});return m;
}
export function setMatchTactics(g,m,side,patch){
 if(m.completed||![0,1].includes(side)||[m.home,m.away][side]!==g.clubId)throw Error('Không thể chỉnh chiến thuật lúc này.');
 if(patch.formation){if(!FORMATIONS[patch.formation])throw Error('Sơ đồ không hợp lệ.');if(m.phaseTactics?.[side]?.enabled)remapPhaseFormation(m.phaseTactics[side],'inPossession',patch.formation,m.lineups[side],g.players);else m.lineups[side]=rearrangeLineup(g,m.lineups[side],patch.formation);m.formation[side]=patch.formation;}
 if(patch.mentality){if(!['balanced','attacking','defensive'].includes(patch.mentality))throw Error('Tâm thế không hợp lệ.');m.mentality[side]=patch.mentality;}
 m.tactics||=[{...DEFAULT_TACTICS},{...DEFAULT_TACTICS}];m.tactics[side]=normalizeTactics({...m.tactics[side],...patch.settings});
 event(m,'tactics',`${g.clubs[g.clubId].shortName} điều chỉnh chiến thuật · ${m.formation[side]}.`,{side});return m;
}
export function applyMatchPreset(g,m,side,id){const p=TACTICAL_PRESETS.find(p=>p.id===id);if(!p)throw Error('Mẫu chiến thuật không hợp lệ.');return setMatchTactics(g,m,side,{formation:p.formation,mentality:p.mentality,settings:p.settings});}
export function assignMatchSlot(g,m,side,index,id){
 if(m.completed||![0,1].includes(side)||[m.home,m.away][side]!==g.clubId||!Number.isInteger(index)||index<0||index>10)throw Error('Vị trí trong trận không hợp lệ.');
 const p=g.players[id];if(!p||p.clubId!==g.clubId||m.off.includes(id)||m.red.includes(id)||m.injured.includes(id))throw Error('Cầu thủ đã rời sân hoặc không thể thi đấu.');
 const old=m.lineups[side].indexOf(id);if(old===index)return m;
 if(old>=0){[m.lineups[side][old],m.lineups[side][index]]=[m.lineups[side][index],m.lineups[side][old]];event(m,'tactics',`${p.name} đổi vị trí trong đội hình.`,{side});return m;}
 return substitute(g,m,side,m.lineups[side][index],id);
}

export function createMatch(g,fixture){
  if(!fixture||fixture.result)throw Error('Trận đấu không hợp lệ.');
  const userSide=fixture.home===g.clubId?0:fixture.away===g.clubId?1:-1;
  if(userSide>=0&&g.registrations?.[fixture.leagueId]?.[g.clubId]&&registrationRule(g,fixture.leagueId).mode==='enforced'){
    const report=registrationReport(g,fixture.leagueId,g.clubId);
    if(!report.valid)throw Error('Danh sách đăng ký chưa hợp lệ. '+report.errors.join(' ')+' Hãy mở Đăng ký đội hình.');
  }
  const lineups=[fixture.home,fixture.away].map((id,i)=>i===userSide?g.lineup.slice():autoLineup(g,id,'4-3-3',fixture.leagueId));
  if(lineups.flat().some(id=>id&&(!available(g.players[id])||!registered(g,g.players[id],fixture.leagueId))))throw Error('Đội hình có cầu thủ chưa đăng ký cho giải này. Hãy mở Đăng ký đội hình.');
  if(lineups.some(l=>l.filter(Boolean).length<7))throw Error('Đội bóng cần ít nhất 7 cầu thủ đủ điều kiện để thi đấu.');
  const rules=matchdayRule(g,fixture.leagueId);
  const all=lineups.flat().filter(Boolean);const bench=[fixture.home,fixture.away].map((id,i)=>{
    const eligible=p=>p&&p.clubId===id&&available(p)&&registered(g,p,fixture.leagueId)&&!lineups[i].includes(p.id);
    if(i===userSide&&g.benchVersion!==undefined)return [...new Set(g.bench||[])].filter(pid=>eligible(g.players[pid])).slice(0,rules.maxBench);
    return clubPlayers(g,id).filter(eligible).sort((a,b)=>overall(b)-overall(a)).slice(0,rules.maxBench).map(p=>p.id);
  });
  return {fixtureId:fixture.id,...(fixture.leagueId==='friendly'?{friendly:true}:{}),...(userSide>=0&&g.phaseTactics?.enabled?{phaseTactics:[0,1].map(side=>side===userSide?structuredClone(g.phaseTactics):null)}:{}),home:fixture.home,away:fixture.away,minute:0,score:[0,0],shots:[0,0],onTarget:[0,0],xg:[0,0],possession:[0,0],lineups,bench,formation:[0,1].map(i=>i===userSide?g.formation:'4-3-3'),mentality:[0,1].map(i=>i===userSide?g.mentality:'balanced'),tactics:[0,1].map(i=>normalizeTactics(i===userSide?g.tactics:DEFAULT_TACTICS)),matchdayRules:structuredClone(rules),subWindows:[0,0],lastSubMinute:[null,null],subs:[0,0],off:[],red:[],injured:[],yellows:{},minutes:Object.fromEntries(all.map(id=>[id,0])),workload:Object.fromEntries(all.map(id=>[id,0])),goals:{},assists:{},events:[{minute:0,type:'kickoff',text:'Hai đội đã ra sân. Sẵn sàng giao bóng!'}],rng:hash(`${g.rng}:${fixture.id}`),ball:{x:50,y:50},phase:'kickoff',attack:0,neutral:!!fixture.neutral,completed:false};
}
function active(g,m,side){return m.lineups[side].filter(id=>id&&!m.red.includes(id)&&!m.injured.includes(id)).map(id=>g.players[id]);}
export function tacticalQuality(g,m,side,phase){
  const ps=active(g,m,side);return mean(ps.map(p=>{
    const slot=m.lineups[side].indexOf(p.id),role=phase?phaseSlot(m.phaseTactics?.[side],phase,slot,m.formation[side])?.[0]:FORMATION_SLOTS[m.formation[side]][slot]?.[0];
    const fatigue=clamp(p.fitness-(m.workload?.[p.id]??m.minutes[p.id]??0)*(22-p.attributes.stamina)/32,30,100)/100;
    return overall(p)*roleFit(p,role)*(.64+.36*fatigue)*(.9+p.morale/1000);
  }))*(ps.length/11);
}
const quality=tacticalQuality;
function event(m,type,text,extra={}){m.events.push({minute:m.minute,type,text,...extra});}
export function tickMatch(g,original){
  if(original.completed)return original;
  const m=structuredClone(original);m.minute++;
  m.workload||={};for(const side of [0,1])for(const id of m.lineups[side].filter(Boolean)){if(!m.red.includes(id)&&!m.injured.includes(id)){m.workload[id]=(m.workload[id]??m.minutes[id]??0)+fatigueRate(m.tactics?.[side]);m.minutes[id]=(m.minutes[id]||0)+1;}}
  const effects=[0,1].map(side=>tacticalEffects(m.tactics?.[side],active(g,m,side),m.tactics?.[1-side],active(g,m,1-side)));
  const dual=m.phaseTactics?.some(t=>t?.enabled),previousAttack=m.attack;
  const attacking=dual?[0,1].map(side=>quality(g,m,side,'inPossession')*(side===0&&!m.neutral?1.025:1)):null;
  const defending=dual?[0,1].map(side=>quality(g,m,side,'outOfPossession')*(side===0&&!m.neutral?1.025:1)):null;
  const strengths=dual?attacking.map((v,i)=>(v+defending[i])/2):[quality(g,m,0)*(m.neutral?1:1.025),quality(g,m,1)];const possession=clamp(.5+(strengths[0]-strengths[1])/100+effects[0].possession-effects[1].possession,.20,.80);m.possession[0]+=possession;m.possession[1]+=1-possession;
  m.attack=random(m)<possession?0:1;m.phase='passing';m.ball={x:20+random(m)*60,y:15+random(m)*70};
  for(const side of [0,1]){
    const ps=active(g,m,side);if(!ps.length)continue;
    const mental=m.mentality[side],other=m.mentality[1-side];
    const attackFactor=mental==='attacking'?1.28:mental==='defensive'?.73:1;
    const defenceFactor=other==='attacking'?1.18:other==='defensive'?.80:1;
    const difference=dual?attacking[side]-defending[1-side]:strengths[side]-strengths[1-side];
    const shapeAttack=dual?phaseShapeEffects(m.phaseTactics?.[side],'inPossession').attack:1,shapeAllowed=dual?phaseShapeEffects(m.phaseTactics?.[1-side],'outOfPossession').allowed:1;
    const chance=clamp(.14*Math.exp(difference/45)*attackFactor*defenceFactor*effects[side].attack*effects[1-side].allowed*shapeAttack*shapeAllowed,.025,.40);
    if(random(m)<chance){
      const attackers=ps.filter(p=>p.position==='FW'||p.position==='MF');const pick=attackers.length?attackers:ps;const shooter=pick[Math.floor(random(m)*pick.length)];
      m.shots[side]++;m.attack=side;m.phase='shot';m.ball={x:side===0?91:9,y:40+random(m)*20};
      const xg=clamp((.035+random(m)*.14+difference/500)*effects[side].xg,.02,.55);m.xg[side]+=xg;
      const goal=random(m)<xg*(.6+shooter.attributes.finishing/25);
      if(goal){m.score[side]++;m.onTarget[side]++;m.goals[shooter.id]=(m.goals[shooter.id]||0)+1;m.phase='goal';
        const helpers=ps.filter(p=>p.id!==shooter.id&&p.position!=='GK');const helper=helpers[Math.floor(random(m)*helpers.length)];
        if(helper)m.assists[helper.id]=(m.assists[helper.id]||0)+1;
        event(m,'goal',`${shooter.name} ghi bàn!${helper?' Kiến tạo: '+helper.name+'.':''}`,{side,playerId:shooter.id,assistId:helper?.id||null,outcome:'goal',score:[...m.score]});
      }else{const target=random(m)<.36;if(target)m.onTarget[side]++;event(m,'shot',`${shooter.name} ${target?'dứt điểm, thủ môn cản phá!':'sút bóng chệch khung thành.'}`,{side,playerId:shooter.id,outcome:target?'saved':'wide'});}
    }
    if(random(m)<.018){const p=ps[Math.floor(random(m)*ps.length)];m.yellows[p.id]=(m.yellows[p.id]||0)+1;
      if(m.yellows[p.id]>1){m.red.push(p.id);event(m,'red',`${p.name} nhận thẻ vàng thứ hai và rời sân.`,{side,playerId:p.id});}
      else event(m,'yellow',`${p.name} nhận thẻ vàng.`,{side,playerId:p.id});
    }
    if(random(m)<.0008){const p=ps[Math.floor(random(m)*ps.length)];if(!m.red.includes(p.id)){m.injured.push(p.id);event(m,'injury',`${p.name} bị đau và không thể tiếp tục.`,{side,playerId:p.id});}}
    // AI rotates tired players; injury replacements use the same five-substitution limit.
    if((m.minute===62||m.minute===74||m.minute===83||m.injured.some(id=>m.lineups[side].includes(id)))&&[m.home,m.away][side]!==g.clubId&&canSubstitute(m,side)){
      const outgoing=m.lineups[side].filter(id=>id&&!m.red.includes(id)).sort((a,b)=>(m.injured.includes(b)?1000:0)+(m.minutes[b]||0)-(m.injured.includes(a)?1000:0)-(m.minutes[a]||0))[0];
      if(outgoing){const incoming=m.bench[side].find(id=>g.players[id].position===g.players[outgoing].position)||m.bench[side][0];if(incoming)substitute(g,m,side,outgoing,incoming);}
    }
  }
  if(dual&&m.minute>1&&previousAttack!==m.attack)for(const side of [0,1])m.lineups[side].forEach((id,seat)=>{if(id&&!m.red.includes(id)&&!m.injured.includes(id)&&!m.off.includes(id))m.workload[id]+=phaseTransitionEffort(m.phaseTactics?.[side],seat);});
  if(m.minute===45)event(m,'halftime','Kết thúc hiệp một. Đội bóng trở lại phòng thay đồ.');
  if(m.minute>=90){
    const f=fixtureById(g,m.fixtureId);const first=f?.legs===2?g.fixtures.find(x=>x.tieId===f.tieId&&x.leg===1):null;
    const tied=m.score[0]+(first?.result?.score[1]||0)===m.score[1]+(first?.result?.score[0]||0);
    if(m.minute===90&&f?.tieId&&f.leg===f.legs&&tied){m.extraTime=true;event(m,'extraTime','Tổng tỉ số hòa. Hai đội bước vào 30 phút hiệp phụ.');}
    else if(!m.extraTime||m.minute>=120){m.completed=true;if(f)settleKnockout(g,f,m,random);event(m,'fulltime',`Hết giờ. ${g.clubs[m.home].shortName} ${m.score[0]} – ${m.score[1]} ${g.clubs[m.away].shortName}.`);}
  }
  return m;
}
export function canSubstitute(m,side){
 const windows=m.matchdayRules?.subWindows,free=m.minute===0||m.minute===45||(m.extraTime&&(m.minute===90||m.minute===105));
 return !m.completed&&m.subs[side]<matchSubLimit(m)&&(free||windows==null||m.lastSubMinute?.[side]===m.minute||(m.subWindows?.[side]||0)<windows+(m.extraTime&&m.matchdayRules?.extraTimeSub?1:0));
}
export function substitute(g,m,side,outId,inId){
  if(m.completed)throw Error('Trận đấu đã kết thúc.');
  if(![0,1].includes(side))throw Error('Đội bóng không hợp lệ.');
  if(m.minute>0&&!canSubstitute(m,side))throw Error(`Đã dùng hết số cầu thủ hoặc đợt thay người cho phép (${matchSubLimit(m)} cầu thủ).`);
  const index=m.lineups[side].indexOf(outId);
  const p=g.players[inId],f=fixtureById(g,m.fixtureId);
  if(index<0||m.red.includes(outId)||!m.bench[side].includes(inId)||m.off.includes(inId)||m.red.includes(inId)||m.injured.includes(inId)||!p||p.clubId!==[m.home,m.away][side]||!available(p)||!registered(g,p,f?.leagueId))throw Error('Thay người không hợp lệ.');
  if(m.minute===0){const seat=m.bench[side].indexOf(inId);m.lineups[side][index]=inId;m.bench[side][seat]=outId;m.minutes[inId]=0;m.workload||={};m.workload[inId]=0;delete m.minutes[outId];delete m.workload[outId];event(m,'tactics',`${p.name} đổi suất đá chính với ${g.players[outId].name} trước giao bóng.`,{side});return m;}
  const free=m.minute===45||(m.extraTime&&(m.minute===90||m.minute===105));
  if(m.matchdayRules?.subWindows!=null&&!free&&m.lastSubMinute?.[side]!==m.minute){m.subWindows||=[0,0];m.subWindows[side]++;}m.lastSubMinute||=[null,null];m.lastSubMinute[side]=m.minute;
  m.lineups[side][index]=inId;m.bench[side]=m.bench[side].filter(id=>id!==inId);m.off.push(outId);m.minutes[inId]=0;m.workload||={};m.workload[inId]=0;m.subs[side]++;
  event(m,'sub',`${g.players[inId].name} vào sân thay ${g.players[outId].name}.`,{side,playerId:inId});return m;
}
export function simulate(g,f){let m=createMatch(g,f);while(!m.completed)m=tickMatch(g,m);return m;}
export function arrangeFriendly(g,opponentId){
 if(g.liveMatch)throw Error('Hãy hoàn tất trận đấu đang diễn ra.');
 initializeStaff(g);
 if(!g.clubs[opponentId]||opponentId===g.clubId)throw Error('Hãy chọn một CLB khác để đá giao hữu.');
 if(g.friendlies.some(f=>f.year===g.year&&f.round===g.round))throw Error('Mỗi mốc lịch chỉ tổ chức một trận giao hữu để tránh quá tải.');
 if(g.friendlies.some(f=>!f.result&&!f.cancelled))throw Error('Hãy hoàn tất hoặc hủy trận giao hữu đã lên lịch.');
 for(const id of [g.clubId,opponentId])if(clubPlayers(g,id).filter(available).length<7)throw Error('Hai đội cần ít nhất 7 cầu thủ đủ thể lực và điều kiện ra sân.');
 const f={id:`friendly-${g.year}-${g.round}-${g.clubId}`,leagueId:'friendly',stage:'friendly',year:g.year,round:g.round,date:g.date,home:g.clubId,away:opponentId,result:null};
 g.friendlies.push(f);g.friendlies=g.friendlies.slice(-100);return f;
}
export function cancelFriendly(g,id){
 const f=g.friendlies?.find(f=>f.id===id);if(!f||f.result||f.cancelled||g.liveMatch)throw Error('Không thể hủy trận giao hữu này.');f.cancelled=true;
}
export function startFriendly(g,id){
 if(g.liveMatch)throw Error('Hãy hoàn tất trận đấu đang diễn ra.');
 const f=g.friendlies?.find(f=>f.id===id);
 if(!f||f.result||f.cancelled||f.round!==g.round||f.year!==g.year||f.home!==g.clubId)throw Error('Trận giao hữu không còn ở mốc lịch hiện tại.');
 const coach=assignedStaff(g,'friendlies');
 const picked=autoPhaseLineup(g,'friendly');
 const own=coach?picked:g.lineup.map(id=>id&&available(g.players[id])?id:null),used=new Set(own.filter(Boolean));
 const lineup=own.map(id=>{if(id)return id;const p=picked.find(x=>x&&!used.has(x));if(p)used.add(p);return p||null;});
 const prepared={...g,lineup,bench:[...(g.bench||[])]};if(coach)repairBench(prepared,{eligible:available,rank:overall,competitionId:'friendly',fill:true});const m=createMatch(prepared,f);m.coachId=coach?.id||'manager';m.coachName=coach?.name||g.manager;f.coachId=m.coachId;f.coachName=m.coachName;
 if(!coach){g.liveMatch=m;return m;}
 let played=m;
 while(!played.completed){
  played=tickMatch(g,played);
  if(!played.completed){const side=played.home===g.clubId?0:1;for(const out of played.lineups[side].filter(id=>played.injured.includes(id))){if(!canSubstitute(played,side))break;const replacement=played.bench[side].find(id=>g.players[id].position===g.players[out].position)||played.bench[side].find(id=>g.players[id].position!=='GK');if(replacement)substitute(g,played,side,out,replacement);}}
  if(played.minute===60){
   const side=played.home===g.clubId?0:1;
   const candidates=played.lineups[side].filter(pid=>pid&&g.players[pid].position!=='GK'&&!played.red.includes(pid)).sort((a,b)=>g.players[a].fitness-g.players[b].fitness);
   for(const out of candidates){if(!canSubstitute(played,side))break;const replacement=played.bench[side].find(pid=>g.players[pid].position===g.players[out].position&&!played.off.includes(pid));if(replacement)substitute(g,played,side,out,replacement);}
  }
 }
 finishFriendly(g,played);return played;
}
export function finishFriendly(g,m){
 const f=g.friendlies?.find(f=>f.id===m.fixtureId);
 if(!f||f.result||f.cancelled||!m.friendly||!m.completed||m.home!==f.home||m.away!==f.away||f.home!==g.clubId||f.year!==g.year||f.round!==g.round)throw Error('Kết quả giao hữu không hợp lệ hoặc đã được ghi nhận.');
 f.result={score:[...m.score],shots:[...m.shots],xg:[...m.xg],events:structuredClone(m.events),coachId:m.coachId||'manager',coachName:m.coachName||g.manager};
 for(const [id,minutes] of Object.entries(m.minutes)){
  const p=g.players[id];if(!p||minutes<=0)continue;
  p.fitness=clamp(p.fitness-(m.workload?.[id]??minutes)*(22-p.attributes.stamina)/35,25,100);
  p.friendlyStats||={appearances:0,goals:0,assists:0,minutes:0};p.friendlyStats.appearances++;p.friendlyStats.goals+=m.goals[id]||0;p.friendlyStats.assists+=m.assists[id]||0;p.friendlyStats.minutes+=minutes;
 }
 for(const id of m.injured){g.players[id].injury=Math.max(g.players[id].injury,1+hash(f.id+id)%2);noteInjury(g,g.players[id],'friendly');}
 const coach=g.staff?.[m.coachId],body=`${g.clubs[f.home].name} ${m.score.join(' – ')} ${g.clubs[f.away].name}. Người chỉ đạo: ${m.coachName||g.manager}.`;
 sendStaffReport(g,'Báo cáo giao hữu',body,'friendly',coach,[`Kính gửi HLV ${g.manager},`,body,`Cú sút: ${m.shots.join(' – ')}. xG: ${m.xg.map(n=>number(n,2)).join(' – ')}.`,...m.events.filter(e=>['goal','sub','injury'].includes(e.type)).map(e=>`${e.minute}′: ${e.text}`),'Thể lực và chấn thương đã cập nhật. Kết quả và thẻ phạt giao hữu không tính vào bảng xếp hạng, thống kê hay án treo giò chính thức.']);
 handlePress(g,{fixture:f,result:f.result,tone:g.pressTone});g.liveMatch=null;return f;
}
function recordMatch(g,f,m){
  if(f.result)throw Error('Trận đấu đã được ghi nhận.');
  if(!m.completed||m.fixtureId!==f.id||m.home!==f.home||m.away!==f.away)throw Error('Kết quả chưa hoàn tất hoặc sai trận đấu.');
  f.result={score:m.score,shots:m.shots,xg:m.xg,events:m.events,winner:m.winner||null,aggregate:m.aggregate||null,penalties:m.penalties||null,extraTime:!!m.extraTime};
  for(const [id,minutes]of Object.entries(m.minutes)){const p=g.players[id];if(!p||minutes===0)continue;p.appearances++;p.seasonMinutes+=minutes;p.competitionStats||={};const stat=p.competitionStats[f.leagueId]||={goals:0,assists:0,appearances:0};stat.goals+=m.goals[id]||0;stat.assists+=m.assists[id]||0;stat.appearances++;p.goals+=m.goals[id]||0;p.assists+=m.assists[id]||0;p.fitness=clamp(p.fitness-(m.workload?.[id]??minutes)*(22-p.attributes.stamina)/30,25,100);
    const side=p.clubId===f.home?0:1,won=m.score[side]>m.score[1-side],lost=m.score[side]<m.score[1-side];p.morale=clamp(p.morale+(won?5:lost?-5:0),20,100);p.form.push(clamp(6.4+(won?.5:lost?-.5:0)+(m.goals[id]||0)*.8+(m.assists[id]||0)*.4-(m.red.includes(id)?2:0),1,10));p.form=p.form.slice(-5);
  }
  for(const id of m.red)g.players[id].suspension=1;
  for(const id of m.injured){g.players[id].injury=1+Math.floor(random(g)*4);noteInjury(g,g.players[id],'match');}
  payContractBonuses(g,f,m);
}
export function payContractBonuses(g,f,m){
 if(f.leagueId==='friendly'||!f.result||!m.completed||f.id!==m.fixtureId) return;
 const expense={};
 for(const [id,minutes]of Object.entries(m.minutes)){
  const p=g.players[id],terms=p?.contractTerms;if(!terms||minutes<=0)continue;
  terms.bonusPaidFixtures||=[];if(terms.bonusPaidFixtures.includes(f.id))continue;
  const amount=(terms.appearanceBonus||0)+(m.goals[id]||0)*(terms.goalBonus||0);
  if(!Number.isFinite(amount)||amount<0)throw Error('Thưởng hợp đồng không hợp lệ.');
  g.clubs[p.clubId].cash-=amount;expense[p.clubId]=(expense[p.clubId]||0)+amount;
  terms.bonusPaidFixtures.push(f.id);terms.bonusPaidFixtures=terms.bonusPaidFixtures.slice(-200);
 }
 if(expense[g.clubId]){g.ledger.unshift({round:g.round+1,date:g.date,type:'contract-bonus',description:'Thưởng ra sân và bàn thắng',income:0,expense:expense[g.clubId],balance:g.clubs[g.clubId].cash,fixtureId:f.id});g.ledger=g.ledger.slice(0,100);}
}
export function reviewSquadPromises(g){
 const thresholds={star:.7,starter:.5,rotation:.2,prospect:0};
 const fixtures=g.fixtures.filter(f=>f.result&&(f.home===g.clubId||f.away===g.clubId));
 for(const p of clubPlayers(g,g.clubId)){
  const terms=p.contractTerms;if(!terms||!thresholds[terms.squadRole])continue;
  const since=terms.promiseFrom||terms.signedAt,played=fixtures.filter(f=>(f.date||`${g.year}-08-15`)>=since).length;
  if(played<4||terms.lastPromiseReview===g.date)continue;
  const minutes=Math.max(0,p.seasonMinutes-(terms.promiseStartMinutes||0)),ratio=minutes/(played*90);terms.lastPromiseReview=g.date;
  if(ratio<thresholds[terms.squadRole]){p.morale=clamp(p.morale-2,20,100);if(!terms.promiseWarned){terms.promiseWarned=true;addMessage(g,`${p.name} muốn được thi đấu nhiều hơn`,'Thời gian thi đấu chưa đáp ứng vai trò đã hứa trong hợp đồng. Tinh thần giảm nhẹ mỗi tuần cho đến khi thời lượng được cải thiện.','transfer',{action:{page:'squad',label:'Xem đội hình'}});}}
  else terms.promiseWarned=false;
 }
}
// Other clubs use a compact match calculation; the managed club retains the minute-by-minute engine.
export function simulateQuick(g,f){
 if(g.phaseTactics?.enabled&&(f.home===g.clubId||f.away===g.clubId))return simulate(g,f);
 const m=createMatch(g,f);const strengths=[quality(g,m,0)*(m.neutral?1:1.025),quality(g,m,1)];m.minute=90;m.completed=true;
 for(let side=0;side<2;side++){
  const ps=active(g,m,side);const attackers=ps.filter(p=>p.position!=='GK');m.shots[side]=Math.max(3,Math.round(12+(strengths[side]-strengths[1-side])/5+random(m)*8-4));
  m.xg[side]=m.shots[side]*clamp(.11+(strengths[side]-strengths[1-side])/350,.03,.35);
  for(let shot=0;shot<m.shots[side];shot++)if(random(m)<m.xg[side]/m.shots[side]){
   const scorer=attackers[Math.floor(random(m)*attackers.length)];m.score[side]++;m.goals[scorer.id]=(m.goals[scorer.id]||0)+1;
   m.events.push({minute:1+Math.floor(random(m)*90),type:'goal',side,playerId:scorer.id,text:scorer.name+' ghi bàn.'});
  }
  m.onTarget[side]=Math.max(m.score[side],Math.round(m.shots[side]*.4));for(const p of ps){m.minutes[p.id]=90;m.workload[p.id]=90*fatigueRate(m.tactics[side]);}
  if(random(m)<.04){const p=ps[Math.floor(random(m)*ps.length)];m.injured.push(p.id);m.events.push({minute:70,type:'injury',playerId:p.id,side,text:p.name+' rời sân vì chấn thương.'});}
  if(random(m)<.055){const p=ps[Math.floor(random(m)*ps.length)];m.red.push(p.id);m.events.push({minute:65,type:'red',playerId:p.id,side,text:p.name+' nhận thẻ đỏ.'});}
 }
 if(f.tieId&&f.leg===f.legs){const first=f.legs===2?g.fixtures.find(x=>x.tieId===f.tieId&&x.leg===1):null;
  if(m.score[0]+(first?.result?.score[1]||0)===m.score[1]+(first?.result?.score[0]||0)){m.extraTime=true;m.minute=120;for(const side of [0,1])for(const p of active(g,m,side)){m.minutes[p.id]+=30;m.workload[p.id]+=30*fatigueRate(m.tactics[side]);}for(let side=0;side<2;side++){if(random(m)<.4){m.score[side]++;const p=active(g,m,side).find(p=>p.position==='FW')||active(g,m,side)[0];m.goals[p.id]=(m.goals[p.id]||0)+1;m.events.push({minute:105,type:'goal',side,playerId:p.id,text:p.name+' ghi bàn trong hiệp phụ.'});}}}
  settleKnockout(g,f,m,random);
 }
 m.events.sort((a,b)=>a.minute-b.minute);return m;
}
export function postponeNationalAbsences(g){
 if(!g.calendar||g.liveMatch)return;
 const addDays=(d,n)=>new Date(Date.parse(d)+n*86400000).toISOString().slice(0,10);
 for(const f of g.fixtures.filter(f=>f.round===g.round&&!f.result)){
  const clubs=[f.home,f.away],unavailable=clubs.filter(id=>clubPlayers(g,id).filter(p=>available(p)&&registered(g,p,f.leagueId)).length<7);
  if(!unavailable.length)continue;
  const duty=unavailable.flatMap(id=>clubPlayers(g,id).filter(p=>p.internationalDuty?.active));if(!duty.length)continue;
  let date=duty.map(p=>p.internationalDuty.to).sort().at(-1);date=date>g.date?date:addDays(g.date,3);
  const windows=g.international?.windows.filter(w=>w.mandatory&&w.scope==='all')||[];
  for(let tries=0;tries<180;tries++,date=addDays(date,1)){
   if(windows.some(w=>date>=w.start&&date<=w.end))continue;
   if(g.fixtures.some(x=>x.id!==f.id&&clubs.some(id=>id===x.home||id===x.away)&&Math.abs(Date.parse(x.date)-Date.parse(date))<3*86400000))continue;
   break;
  }
  let round=g.calendar.findIndex(s=>s.date===date);
  if(round<0){round=g.calendar.findIndex(s=>s.date>date);if(round<0)round=g.calendar.length;g.calendar.splice(round,0,{date,kind:'catchup',label:'Đá bù vì lịch đội tuyển'});for(const x of [...g.fixtures,...(g.friendlies||[])])if(x.round>=round&&(!x.year||x.year===g.year))x.round++;}
  f.postponedFrom??=f.date;f.round=round;f.date=date;
  if(clubs.includes(g.clubId))addMessage(g,'Điều chỉnh lịch vì thiếu quân lên tuyển',`${g.clubs[f.home].name} gặp ${g.clubs[f.away].name} được chuyển sang ${dateLabel(date)} vì một đội còn dưới 7 cầu thủ đủ điều kiện. Đây là xử lý hoãn trận giản lược trong game.`, 'news',{action:{page:'fixtures',label:'Xem lịch thi đấu'}});
 }
 g.fixtures.sort((a,b)=>a.round-b.round||a.id.localeCompare(b.id));
}
export function advanceRound(g,played=null){
 if(g.round>=maxRounds(g))throw Error('Mùa giải đã kết thúc. Hãy bắt đầu mùa mới.');
 if(g.liveMatch?.friendly)throw Error('Hãy ghi nhận trận giao hữu trước khi chuyển ngày.');
 if(played){const own=currentFixture(g);if(!own||played.fixtureId!==own.id||!played.completed)throw Error('Trận đấu chưa kết thúc.');}
 processInternationalDate(g,g.date);postponeNationalAbsences(g);
 const slot=g.calendar?.[g.round];const weekly=!slot||slot.kind==='domestic';
 const fixtures=g.fixtures.filter(f=>f.round===g.round&&!f.result),activeClubs=new Set(fixtures.flatMap(f=>[f.home,f.away]));
 const recovering=Object.values(g.players).filter(p=>p.injury>0).map(p=>p.id),banned=Object.values(g.players).filter(p=>p.suspension>0&&activeClubs.has(p.clubId)).map(p=>p.id);
 repairLineup(g);let ownMatch=null,ownFixture=null;
 for(const f of fixtures){const own=f.home===g.clubId||f.away===g.clubId;const m=played?.fixtureId===f.id?played:own?simulate(g,f):simulateQuick(g,f);recordMatch(g,f,m);if(own){ownMatch=m;ownFixture=f;}}
 const support=Object.fromEntries(Object.keys(g.clubs).map(id=>[id,staffEffects(g,id)]));
 if(weekly)for(const id of recovering){const p=g.players[id],bonus=p.injury>1&&hash(`${g.year}:${g.round}:${id}:medical`)%1000<support[p.clubId].medicalRecoveryChance*1000?1:0;p.injury=Math.max(0,p.injury-1-bonus);}
 for(const id of banned)g.players[id].suspension=Math.max(0,g.players[id].suspension-1);
 const nextDate=g.calendar?.[g.round+1]?.date||new Date(new Date(g.date+'T12:00:00Z').getTime()+7*86400000).toISOString().slice(0,10);
 const days=Math.max(1,Math.round((new Date(nextDate)-new Date(g.date))/86400000));
 for(const p of Object.values(g.players)){
  if(p.internationalDuty?.active)continue;
  const own=p.clubId===g.clubId,intensity=own?g.intensity:'normal',staff=support[p.clubId];p.fitness=clamp(p.fitness+((intensity==='light'?29:intensity==='hard'?15:23)+staff.recoveryBonus)*days/7,0,100);
  if(!weekly||p.injury>0||p.age>34)continue;
  const train=own?g.training:'balanced',chance=(intensity==='hard'?.055:intensity==='light'?.013:.03)*(p.age<24?1.6:1)*(p.age<22?staff.youthMultiplier:1)*(train==='physical'?staff.fitnessMultiplier:p.position==='GK'?staff.goalkeepingMultiplier:staff.trainingMultiplier);
  if(overall(p)<p.potential&&random(g)<chance){const keys=train==='attack'?['finishing','dribbling','composure']:train==='defence'?['tackling','positioning','heading']:train==='physical'?['pace','stamina','strength']:KEYS[p.position];const key=keys[Math.floor(random(g)*keys.length)];p.attributes[key]=clamp(p.attributes[key]+1,1,20);}
 }
 if(weekly)for(const c of Object.values(g.clubs)){const playerWages=clubPlayers(g,c.id).reduce((sum,p)=>sum+p.wage,0),staffWages=staffWeeklyWages(g,c.id),wage=playerWages+staffWages,income=Math.round(playerWages*1.06+(c.id===g.clubId&&ownMatch?.home===c.id?c.reputation*12000:0));c.cash+=income-wage;
  if(c.id===g.clubId){g.ledger.unshift({round:g.round+1,date:g.date,type:'weekly',income,expense:wage,playerWages,staffWages,balance:c.cash});g.ledger=g.ledger.slice(0,100);}}
 if(ownMatch){const m=ownMatch,f=ownFixture,c=g.clubs[g.clubId],op=g.clubs[f.home===g.clubId?f.away:f.home],name=competition(g,f.leagueId)?.name||f.leagueId;
  const notes=m.events.filter(e=>['goal','red','injury','penalties'].includes(e.type)).map(e=>`${e.minute}’: ${e.text}`);
  const body=`${g.clubs[f.home].name} ${m.score.join(' – ')} ${g.clubs[f.away].name}. ${name}.`;
  addMessage(g,`${g.clubs[f.home].shortName} ${m.score.join(' – ')} ${g.clubs[f.away].shortName}`,body,'match',{paragraphs:[`Kính gửi HLV ${g.manager},`,`Ban huấn luyện gửi báo cáo trận ${c.name} gặp ${op.name}, ngày ${dateLabel(g.date)}.`,body,`Cú sút: ${m.shots.join(' – ')}. Trúng đích: ${m.onTarget.join(' – ')}. Bàn thắng kỳ vọng (xG): ${m.xg.map(n=>number(n,2)).join(' – ')}.`,...notes,m.aggregate?`Tổng tỉ số hai lượt: ${m.aggregate.join(' – ')}.${m.penalties?' Luân lưu: '+m.penalties.join(' – ')+'.':''}`:'Kết quả đã được cập nhật vào bảng xếp hạng.',`Chấn thương mới: ${m.injured.map(id=>g.players[id].name).join(', ')||'không có'}. Thẻ đỏ: ${m.red.map(id=>g.players[id].name).join(', ')||'không có'}.`,`Hãy kiểm tra mục Huấn luyện để theo dõi hồi phục và chuẩn bị đội hình cho lịch tiếp theo.`,`Trân trọng,`,`Trợ lý huấn luyện viên`],action:{page:'fixtures',label:'Xem lịch và báo cáo trận'}});
 }
 if(weekly&&(slot?.week??g.round)%4===0){const c=g.clubs[g.clubId],entry=g.ledger[0];addMessage(g,'Báo cáo ngân sách và quỹ lương',`Số dư ${money(c.cash)}; ngân sách chuyển nhượng ${money(c.budget)}.`,'finance',{paragraphs:[`Kính gửi HLV ${g.manager},`,`Phòng tài chính xác nhận đã hạch toán tuần vừa qua: tài trợ và tiền vé ${money(entry.income)}, chi phí lương ${money(entry.expense)}, chênh lệch ${money(entry.income-entry.expense)}.`,`Số dư sau hạch toán: ${money(c.cash)}. Ngân sách chuyển nhượng còn lại: ${money(c.budget)}. Quỹ lương cho phép: ${money(c.wageBudget)}/tuần.`,`Các khoản trong báo cáo thuộc mô phỏng tài chính của sự nghiệp. Giao dịch sau ngày gửi sẽ được ghi ở báo cáo kế tiếp.`,`Trân trọng,`,`Giám đốc tài chính`],action:{page:'finances',label:'Mở sổ thu chi'}});}
 if(ownMatch)handlePress(g,{fixture:ownFixture,result:ownFixture.result,tone:g.pressTone});
 if(weekly){runStaffWeek(g);reviewSquadPromises(g);reviewPlayerDynamics(g,{playedClubs:activeClubs});}
 for(const f of g.friendlies||[])if(!f.result&&!f.cancelled&&f.year===g.year&&f.round===g.round)f.cancelled=true;
 updateCups(g,table,(title,body)=>addMessage(g,title,body,'season',{action:{page:'league',label:'Xem giải đấu'}}));
 g.rng=(g.rng+1)>>>0;g.round++;g.date=nextDate;g.liveMatch=null;processInternationalDate(g,g.date);postponeNationalAbsences(g);repairLineup(g);
 if(weekly)runAITransfers(g,transferHooks);
 if(g.round===maxRounds(g))addMessage(g,'Mùa giải đã khép lại','Bảng xếp hạng quốc nội và danh hiệu UEFA đã hoàn tất. Chọn Mùa giải mới để tiến hành chuyển mùa, phân lại suất UEFA và cập nhật các hạng đấu.','season');
 return g;
}
export function promotionMoves(g,standings){
 const moves=[];const swap=(upper,lower,count)=>{
  const low=lower.flatMap(lid=>(standings[lid]||[]).map((r,i)=>({...r,rank:i,lid}))).filter(r=>!g.clubs[r.clubId].reserveTeam).sort((a,b)=>a.rank-b.rank||b.points/Math.max(1,b.played)-a.points/Math.max(1,a.played));
  if(!low.length)return;const down=(standings[upper]||[]).slice(-Math.min(count,low.length));
  down.forEach((r,i)=>{const up=low[i];moves.push({clubId:up.clubId,from:up.lid,to:upper},{clubId:r.clubId,from:upper,to:up.lid});});
 };
 for(const country of ['EN','DE','FR','IT','ES','PT','NL','VN']){
  const ls=g.leagues.filter(l=>l.countryCode===country&&l.kind!=='external');const top=ls.find(l=>l.tier===1),second=ls.find(l=>l.tier===2),third=ls.filter(l=>l.tier===3&&!l.historical);
  if(top&&second)swap(top.id,[second.id],country==='VN'?2:3);
  // The licensed Eerste Divisie / amateur Tweede Divisie link is not modeled as automatic promotion.
  if(second&&third.length&&country!=='NL')swap(second.id,third.map(l=>l.id),['IT','ES'].includes(country)?4:country==='VN'?2:3);
 }
 const assigned=new Set();for(const move of moves){if(assigned.has(move.clubId))continue;g.clubs[move.clubId].leagueId=move.to;assigned.add(move.clubId);}return moves.filter((m,i)=>moves.findIndex(x=>x.clubId===m.clubId)===i);
}
export function nextSeason(g){
 if(g.round<maxRounds(g))throw Error('Mùa giải chưa kết thúc.');
 for(const f of g.friendlies||[])if(!f.result&&!f.cancelled)f.cancelled=true;
 const standings=Object.fromEntries(g.leagues.filter(l=>l.kind!=='external').map(l=>[l.id,table(g,l.id)]));const rank=standings[g.clubs[g.clubId].leagueId].findIndex(r=>r.clubId===g.clubId)+1;
 const history={year:g.year,rank,leagueId:g.clubs[g.clubId].leagueId,champions:[...Object.entries(standings).filter(([,rs])=>rs.length).map(([id,rs])=>({leagueId:id,clubId:rs[0].clubId})),...(g.cups||[]).filter(c=>c.champion).map(c=>({leagueId:c.id,clubId:c.champion}))],goals:clubPlayers(g,g.clubId).reduce((sum,p)=>sum+p.goals,0)};
 g.cups=nextEurope(g,standings);history.movements=promotionMoves(g,standings);g.history.unshift(history);
 g.year++;g.round=0;g.date=`${g.year}-08-15`;
 for(const p of Object.values(g.players)){p.age++;p.appearances=0;p.goals=0;p.assists=0;p.seasonMinutes=0;p.competitionStats={};p.form=[];p.fitness=100;p.injury=0;p.suspension=0;p.morale=80;
  if(p.contractTerms){if(p.contractUntil>=g.year&&p.contractTerms.signedYear<g.year)p.wage=Math.round(p.wage*(1+(p.contractTerms.annualRise||0)/100));p.contractTerms.promiseFrom=g.date;p.contractTerms.promiseStartMinutes=0;p.contractTerms.bonusPaidFixtures=[];delete p.contractTerms.lastPromiseReview;delete p.contractTerms.promiseWarned;}
  if(p.age>=33)for(const key of ['pace','stamina'])p.attributes[key]=clamp(p.attributes[key]-1,1,20);if(p.contractUntil<g.year)p.contractUntil=g.year+1;}
 for(const c of Object.values(g.clubs)){const prize=Math.round(c.reputation*200000/Math.max(1,g.leagues.find(l=>l.id===c.leagueId)?.tier||1));c.cash+=prize;c.budget+=Math.round(prize*.6);}
 if(g.pendingExpansion){g.cups=structuredClone(g.pendingExpansion);delete g.pendingExpansion;}
 g.fixtures=makeSeasonFixtures(g,schedule,random);initializeInternational(g);mergeInternationalCalendar(g,{fresh:true});initializeRegistrations(g);initializePlayerDynamics(g);repairLineup(g);repairBench(g,{eligible:p=>available(p)&&registered(g,p,currentFixture(g)?.leagueId),rank:overall,fill:true});
 const move=history.movements.find(m=>m.clubId===g.clubId);addMessage(g,`Mùa giải ${g.year}/${String(g.year+1).slice(-2)}`,`Bạn kết thúc mùa trước ở vị trí ${rank}. ${move?'CLB chuyển sang '+g.leagues.find(l=>l.id===move.to).name+'. ':''}Ban lãnh đạo đã bổ sung ngân sách. Hợp đồng hết hạn tự gia hạn một năm. Suất lên xuống hạng mô phỏng theo thứ hạng, chưa có play-off quốc nội.`,'season');
}
export function migrateGame(input,db){
 validateGame(input);const g=structuredClone(input);upgradeMessages(g);mergePortraits(g,db);
 if(g.schema===SCHEMA){mergeScoutingProfiles(g,db);initializeStaff(g);initializeTransferMarket(g);upgradeCareerSystems(g,db);return g;}
 if(g.schema===2){upgradeTactics(g,db);return g;}
 const fresh=newGame(db,g.clubId,g.manager,g.rng);if(fresh.year!==g.year){fresh.year=g.year;fresh.date=`${g.year}-08-15`;fresh.fixtures=makeSeasonFixtures(fresh,schedule,random);}
 for(const [id,c]of Object.entries(fresh.clubs))if(!g.clubs[id])g.clubs[id]=c;
 for(const raw of db.players){if(!g.players[raw.id])g.players[raw.id]=fresh.players[raw.id];else{
   const p=g.players[raw.id];for(const key of ['nationality','countryCode','nationalitySource','homegrown','training','rosterNote','rosterSourceUrl'])if(raw[key]!==undefined)p[key]=structuredClone(raw[key]);
   if(raw.primaryRegistrationCorrection&&p.clubId===raw.previousClubId&&p.clubId!==g.clubId&&!g.transfers.some(t=>t.id===p.id))p.clubId=raw.clubId;
 }}
 invalidateRosters(g);g.leagues=structuredClone(db.leagues);g.dbMeta=db.meta;g.schema=SCHEMA;
 if(g.round===0&&!g.liveMatch&&!g.fixtures.some(f=>f.result)){g.cups=fresh.cups;g.calendar=fresh.calendar;g.fixtures=fresh.fixtures;g.seasonParticipants=fresh.seasonParticipants;initializeRegistrations(g);repairLineup(g);}
 else{g.cups=[];g.pendingExpansion=structuredClone(db.competitions||[]);g.registrations={};g.calendar=null;g.seasonParticipants=Object.fromEntries(g.leagues.map(l=>[l.id,[...new Set(g.fixtures.filter(f=>f.leagueId===l.id).flatMap(f=>[f.home,f.away]))]]));}
 addMessage(g,'Touchline 1.1 · Sự nghiệp đã được nâng cấp',`Tiền, chỉ số, chuyển nhượng và kết quả cũ được giữ lại. ${g.pendingExpansion?'Lịch mới và UEFA sẽ bắt đầu vào mùa tiếp theo để bảo toàn mùa đang chơi.':'UEFA và các hạng dưới đã sẵn sàng trong lịch mùa này.'} Quốc tịch và nguồn home-grown được bổ sung; hồ sơ chưa xác minh vẫn hiển thị rõ.`,'board');upgradeTactics(g,db);return g;
}
function upgradeCareerSystems(g,db){
 const first=g.benchVersion===undefined;
 mergeHomegrown(g,db.homegrownIndex);initializePlayerDynamics(g);initializeInternational(g);initializeMatchday(g);
 if(first)repairBench(g,{eligible:p=>available(p)&&registered(g,p,currentFixture(g)?.leagueId),rank:overall,fill:true});
 mergeInternationalCalendar(g);
}
function mergeScoutingProfiles(g,db){
 for(const raw of db.players){const p=g.players[raw.id];if(!p)continue;for(const k of ['naturalPositions','otherPositions','preferredFoot','profileSource','footSource','positionsSource','positionBasis','profileUpdatedAt','weight'])if(p[k]===undefined&&raw[k]!==undefined)p[k]=structuredClone(raw[k]);}
}
function upgradeTactics(g,db){
 mergeScoutingProfiles(g,db);initializeStaff(g);initializeTransferMarket(g);upgradeCareerSystems(g,db);
 g.schema=SCHEMA;g.tactics=normalizeTactics(g.tactics);
 if(g.liveMatch){g.liveMatch.tactics||=[{...DEFAULT_TACTICS},{...DEFAULT_TACTICS}];g.liveMatch.workload||={...g.liveMatch.minutes};}
 addMessage(g,'Touchline 1.2 · Phòng chiến thuật mới','Đã bổ sung thư viện chiến thuật HLV, kéo thả cầu thủ trước và trong trận, cùng vị trí chi tiết và chân thuận có nguồn. Chiến thuật, đội hình, tiền và kết quả hiện tại của bạn được giữ lại.','news',{action:{page:'tactics',label:'Mở phòng chiến thuật'}});
}
export function transferQuote(g,p,discount=staffEffects(g,g.clubId).transferDiscount){const club=g.clubs[p.clubId];const age=p.age<24?1.12:1;return Math.round(p.value*(p.listed?.86:1.2)*age*(club.id===g.clubId?.72:1-discount)/1000)*1000;}
function registerNumber(g,p,clubId){const used=new Set(clubPlayers(g,clubId).filter(x=>x.id!==p.id).map(x=>String(x.number)));if(!p.number||used.has(String(p.number))){p.sourceNumber??=p.number;p.number=String(Array.from({length:99},(_,i)=>i+1).find(n=>!used.has(String(n)))||'');}}
function afterTransfer(g,record){
 const p=g.players[record.playerId||record.id];if(p)resetDynamicsAfterTransfer(g,p);
 if(p?.contractTerms){p.contractTerms.promiseStartMinutes=p.seasonMinutes;p.contractTerms.promiseFrom=g.date;}
 for(const [cid,lists]of Object.entries(g.registrations||{}))for(const clubId of [record.from,record.to]){
  if(!lists[clubId])continue;
  if(clubId===g.clubId)lists[clubId]=lists[clubId].filter(id=>g.players[id]?.clubId===clubId);
  else lists[clubId]=autoRegistration(g,cid,clubId,overall);
 }
}
const transferHooks={invalidateRosters,repairLineup,onTransfer:afterTransfer};
export function completeTransfer(g,dealId){return finalizeNegotiation(g,dealId,transferHooks);}
export function buyPlayer(g,id,dealId){
 const deal=g.negotiations?.find(d=>d.id===dealId&&d.playerId===id&&d.stage==='agreed');
 if(!deal)throw Error('Cần thống nhất phí chuyển nhượng và hợp đồng trước khi ký.');
 const result=completeTransfer(g,dealId);if(!result.ok)throw Error(result.message);return result.transfer.fee;
}
export function sellPlayer(g,id){const result=sellToAI(g,id,transferHooks);if(!result.ok)throw Error(result.message);return result.transfer.fee;}
export function editClub(g,id,patch){const c=g.clubs[id];if(!c)throw Error('CLB không hợp lệ.');for(const key of ['cash','budget','wageBudget']){if(patch[key]!==undefined){if(!Number.isFinite(Number(patch[key])))throw Error('Số tiền không hợp lệ.');c[key]=clamp(Number(patch[key]),0,1e12);}}g.editorUsed=true;g.editorLog.unshift({date:g.date,text:`Chỉnh tài chính ${c.name}`});g.editorLog=g.editorLog.slice(0,50);}
export function editPlayer(g,id,patch){const p=g.players[id];if(!p)throw Error('Cầu thủ không hợp lệ.');
  if(patch.preferredFoot!==undefined){if(!FOOT[patch.preferredFoot])throw Error('Chân thuận không hợp lệ.');if(patch.preferredFoot!==(p.preferredFoot||'unknown')){p.preferredFoot=patch.preferredFoot;p.footSource='Người chơi chỉnh trong Editor';}}
  for(const key of ['naturalPositions','otherPositions'])if(patch[key]!==undefined){if(!Array.isArray(patch[key])||patch[key].some(k=>!POSITION_DETAIL[k]))throw Error('Vị trí chi tiết không hợp lệ.');const next=[...new Set(patch[key])];if(JSON.stringify(next)!==JSON.stringify(p[key]||[])){p[key]=next;p.positionsSource='Người chơi chỉnh trong Editor';}}
  if(p.otherPositions)p.otherPositions=p.otherPositions.filter(k=>!p.naturalPositions?.includes(k));
  if(patch.attributes)for(const key of Object.keys(ATTRS)){const n=Number(patch.attributes[key]);if(!Number.isFinite(n))throw Error('Chỉ số không hợp lệ.');p.attributes[key]=clamp(Math.round(n),1,20);}
  for(const [k,lo,hi]of [['potential',1,100],['fitness',0,100],['morale',0,100],['age',15,60],['value',0,1e10],['wage',0,1e8],['injury',0,52],['suspension',0,20]])if(patch[k]!==undefined){const n=Number(patch[k]);if(!Number.isFinite(n))throw Error('Giá trị không hợp lệ.');p[k]=clamp(Math.round(n),lo,hi);}
  p.potential=Math.max(p.potential,overall(p));g.editorUsed=true;g.editorLog.unshift({date:g.date,text:`Chỉnh cầu thủ ${p.name}`});g.editorLog=g.editorLog.slice(0,50);repairLineup(g);
}
export function healSquad(g){for(const p of clubPlayers(g,g.clubId)){p.fitness=100;p.morale=100;p.injury=0;p.suspension=0;}g.editorUsed=true;g.editorLog.unshift({date:g.date,text:'Hồi phục toàn đội'});repairLineup(g);}

export function validateGame(g){
  const fail=()=>{throw Error('File lưu không hợp lệ hoặc không tương thích với Touchline.');};
  if(!g||![1,2,SCHEMA].includes(g.schema)||typeof g.id!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(g.id)||!g.clubs||!g.clubs[g.clubId]||!g.players||!Array.isArray(g.leagues)||g.leagues.length<8||g.leagues.length>60||!Array.isArray(g.fixtures)||!Array.isArray(g.lineup)||g.lineup.length!==11||!FORMATIONS[g.formation]||!Number.isInteger(g.rng)||!Number.isInteger(g.round)||!Number.isInteger(g.year)||g.round<0||g.round>400||!/^\d{4}-\d{2}-\d{2}$/.test(g.date))fail();
  for(const key of ['messages','transfers','history','ledger','editorLog','shortlist'])if(!Array.isArray(g[key]))fail();
  validateSaveMetadata(g);validateRecruitmentPlan(g);
  const players=Object.values(g.players);if(players.length<88||players.length>50000)fail();
  for(const p of players){if(!p||g.players[p.id]!==p||!g.clubs[p.clubId]||!KEYS[p.position]||typeof p.name!=='string'||!p.attributes||!Array.isArray(p.form))fail();for(const k of Object.keys(ATTRS))if(!Number.isInteger(p.attributes[k])||p.attributes[k]<1||p.attributes[k]>20)fail();for(const k of ['fitness','morale','age','potential','wage','value','injury','suspension','goals','assists','appearances','seasonMinutes','contractUntil'])if(!Number.isFinite(p[k])||p[k]<0)fail();}
  for(const c of Object.values(g.clubs))if(!c||typeof c.name!=='string'||!g.leagues.some(l=>l.id===c.leagueId)||!['budget','cash','wageBudget','reputation'].every(k=>Number.isFinite(c[k])))fail();
  if(g.lineup.some(id=>id&&(!g.players[id]||g.players[id].clubId!==g.clubId))||new Set(g.lineup.filter(Boolean)).size!==g.lineup.filter(Boolean).length)fail();
  if(g.schema===SCHEMA){
    if(!validTactics(g.tactics)||!['balanced','attacking','defensive'].includes(g.mentality))fail();
    if(g.phaseTactics!==undefined&&!validPhaseTactics(g.phaseTactics))fail();
    for(const p of players){for(const k of ['naturalPositions','otherPositions'])if(p[k]!==undefined&&(!Array.isArray(p[k])||p[k].length>14||new Set(p[k]).size!==p[k].length||p[k].some(x=>!POSITION_DETAIL[x])))fail();if(p.preferredFoot!==undefined&&!FOOT[p.preferredFoot])fail();}
    if(g.liveMatch){const m=g.liveMatch;
      if(m.phaseTactics!==undefined&&(!Array.isArray(m.phaseTactics)||m.phaseTactics.length!==2||m.phaseTactics.some(t=>t!==null&&!validPhaseTactics(t))))fail();
      if(!Array.isArray(m.tactics)||m.tactics.length!==2||!m.tactics.every(validTactics)||!Array.isArray(m.formation)||m.formation.length!==2||m.formation.some(f=>!FORMATIONS[f])||!Array.isArray(m.mentality)||m.mentality.length!==2||m.mentality.some(v=>!['balanced','attacking','defensive'].includes(v))||!m.workload||Object.entries(m.workload).some(([id,v])=>!g.players[id]||!Number.isFinite(v)||v<0))fail();
      if(!Array.isArray(m.subs)||m.subs.length!==2||m.subs.some(n=>!Number.isInteger(n)||n<0||n>matchSubLimit(m))||!Array.isArray(m.bench)||m.bench.length!==2)fail();
      for(const side of [0,1]){const ids=[...(m.lineups?.[side]||[]),...(m.bench[side]||[])].filter(Boolean);if(new Set(ids).size!==ids.length||ids.some(id=>g.players[id]?.clubId!==[m.home,m.away][side]))fail();}
    }
  }
  if(g.schema>=2){
    if(!Array.isArray(g.cups)||g.cups.length>3||!g.registrations||typeof g.registrations!=='object')fail();
    const ids=new Set(g.leagues.map(l=>l.id));if(ids.size!==g.leagues.length)fail();const participants=new Set();
    for(const cup of g.cups){if(!cup||ids.has(cup.id)||!Array.isArray(cup.participants)||cup.participants.length!==36||![6,8].includes(cup.matchdays))fail();ids.add(cup.id);for(const id of cup.participants){if(!g.clubs[id]||participants.has(id))fail();participants.add(id);}}
    if(g.calendar!=null&&(!Array.isArray(g.calendar)||g.calendar.length>400||g.round>g.calendar.length||g.calendar.some((s,i)=>!s||!/^\d{4}-\d{2}-\d{2}$/.test(s.date)||!['domestic','uefa','international','catchup'].includes(s.kind)||(i>0&&s.date<=g.calendar[i-1].date))))fail();
    for(const [cid,lists]of Object.entries(g.registrations)){if(!ids.has(cid)||!lists||typeof lists!=='object')fail();for(const [clubId,list]of Object.entries(lists))if(!g.clubs[clubId]||!Array.isArray(list)||list.length>200||new Set(list).size!==list.length||list.some(id=>!g.players[id]))fail();}
    for(const m of g.messages)if(!m||typeof m.id!=='string'||typeof m.title!=='string'||typeof m.body!=='string'||(m.paragraphs&&(!Array.isArray(m.paragraphs)||m.paragraphs.some(p=>typeof p!=='string'))))fail();
  }
  validateStaff(g);validateTransferMarket(g);validateMatchday(g);validateInternational(g);validatePlayerDynamics(g);
  const fixtureIds=new Set();for(const f of [...g.fixtures,...(g.friendlies||[])]){if(fixtureIds.has(f.id)||!g.clubs[f.home]||!g.clubs[f.away]||f.home===f.away||!Number.isInteger(f.round)||f.round<0||f.round>400)fail();fixtureIds.add(f.id);if(f.result&&(!Array.isArray(f.result.score)||f.result.score.length!==2||f.result.score.some(n=>!Number.isInteger(n)||n<0||n>100)||!Array.isArray(f.result.events)))fail();}
  if(g.liveMatch){const m=g.liveMatch,f=fixtureById(g,m.fixtureId);if(!f||f.cancelled||m.home!==f.home||m.away!==f.away||!!m.friendly!==(f.leagueId==='friendly'))fail();}
  if(g.liveMatch){const m=g.liveMatch;if(![...g.fixtures,...(g.friendlies||[])].some(f=>f.id===m.fixtureId&&f.round===g.round&&!f.result&&(f.leagueId!=='friendly'||f.year===g.year))||!Array.isArray(m.lineups)||m.lineups.length!==2||m.lineups.some(l=>!Array.isArray(l)||l.length!==11||l.some(id=>id&&!g.players[id]))||!Array.isArray(m.events)||!Number.isInteger(m.minute)||m.minute<0||m.minute>120||!Number.isInteger(m.rng))fail();}
  return true;
}
