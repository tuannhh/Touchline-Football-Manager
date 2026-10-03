// Positions are independent from ability ratings. Unknown detailed positions
// keep the original broad role; they are never presented as verified facts.
export const POSITION_DETAIL={GK:'Thủ môn',LB:'Hậu vệ trái',CB:'Trung vệ',RB:'Hậu vệ phải',LWB:'Hậu vệ biên trái',RWB:'Hậu vệ biên phải',DM:'Tiền vệ phòng ngự',CM:'Tiền vệ trung tâm',LM:'Tiền vệ trái',RM:'Tiền vệ phải',AM:'Tiền vệ tấn công',LW:'Tiền đạo trái',RW:'Tiền đạo phải',ST:'Tiền đạo cắm'};
export const FOOT={right:'Phải',left:'Trái',both:'Hai chân',unknown:'Chưa có nguồn'};
export const broadPosition=role=>role==='GK'?'GK':['LB','CB','RB','LWB','RWB'].includes(role)?'DF':['DM','CM','LM','RM','AM'].includes(role)?'MF':'FW';
const layouts={
 '4-3-3':[['GK',50,89],['LB',16,68],['CB',39,73],['CB',61,73],['RB',84,68],['DM',50,55],['CM',30,39],['CM',70,39],['LW',16,18],['ST',50,12],['RW',84,18]],
 '4-2-3-1':[['GK',50,89],['LB',16,68],['CB',39,73],['CB',61,73],['RB',84,68],['DM',34,52],['DM',66,52],['LW',18,29],['AM',50,33],['RW',82,29],['ST',50,12]],
 '4-4-2':[['GK',50,89],['LB',16,68],['CB',39,73],['CB',61,73],['RB',84,68],['LM',15,39],['CM',38,46],['CM',62,46],['RM',85,39],['ST',35,15],['ST',65,15]],
 '4-1-4-1':[['GK',50,89],['LB',16,71],['CB',39,76],['CB',61,76],['RB',84,71],['DM',50,59],['LM',15,39],['CM',38,43],['CM',62,43],['RM',85,39],['ST',50,15]],
 '5-4-1':[['GK',50,91],['LWB',10,66],['CB',29,77],['CB',50,81],['CB',71,77],['RWB',90,66],['LM',15,43],['CM',38,48],['CM',62,48],['RM',85,43],['ST',50,17]],
 '3-5-2':[['GK',50,89],['CB',27,72],['CB',50,76],['CB',73,72],['LWB',11,45],['CM',33,40],['DM',50,56],['CM',67,40],['RWB',89,45],['ST',35,15],['ST',65,15]],
 '3-4-2-1':[['GK',50,91],['CB',24,73],['CB',50,77],['CB',76,73],['LWB',10,47],['CM',36,53],['CM',64,53],['RWB',90,47],['AM',32,29],['AM',68,29],['ST',50,11]],
 '3-2-4-1':[['GK',50,91],['CB',24,76],['CB',50,79],['CB',76,76],['DM',35,56],['DM',65,56],['LW',10,31],['AM',36,34],['AM',64,34],['RW',90,31],['ST',50,11]],
 '3-4-3':[['GK',50,91],['CB',25,75],['CB',50,79],['CB',75,75],['LWB',10,49],['CM',36,53],['CM',64,53],['RWB',90,49],['LW',23,23],['ST',50,12],['RW',77,23]],
 '5-3-2':[['GK',50,91],['LWB',10,65],['CB',29,76],['CB',50,80],['CB',71,76],['RWB',90,65],['CM',27,45],['DM',50,52],['CM',73,45],['ST',36,19],['ST',64,19]],
 '4-1-2-1-2':[['GK',50,91],['LB',12,66],['CB',37,76],['CB',63,76],['RB',88,66],['DM',50,58],['CM',28,43],['CM',72,43],['AM',50,29],['ST',34,12],['ST',66,12]],
};
export const FORMATION_SLOTS=layouts;
export const FORMATIONS=Object.fromEntries(Object.entries(layouts).map(([id,slots])=>[id,slots.map(([role,x,y])=>[broadPosition(role),x,y])]));
export const DEFAULT_TACTICS={presetId:'custom',tempo:3,width:3,pressing:3,line:3,passing:'mixed',transition:'balanced'};
export const TACTIC_OPTIONS={tempo:['Rất chậm','Chậm','Vừa','Nhanh','Rất nhanh'],width:['Rất hẹp','Hẹp','Vừa','Rộng','Rất rộng'],pressing:['Rất ít','Ít','Vừa','Cao','Rất cao'],line:['Rất thấp','Thấp','Vừa','Cao','Rất cao']};
export const PASSING={short:'Ngắn',mixed:'Phối hợp',direct:'Trực diện'};
export const TRANSITION={balanced:'Cân bằng',counterpress:'Đoạt lại bóng ngay',counter:'Phản công nhanh',regroup:'Lùi về tổ chức'};
const preset=(id,coach,team,period,formation,mentality,settings,description,strength,risk,source)=>({id,coach,team,period,formation,mentality,settings:{...DEFAULT_TACTICS,...settings,presetId:id},description,strength,risk,source});
export const TACTICAL_PRESETS=[
 preset('pep-city','Pep Guardiola','Manchester City','2022–2024','3-2-4-1','attacking',{tempo:2,width:5,pressing:4,line:4,passing:'short',transition:'counterpress'},'Kiểm soát vị trí với hai trụ, hai số 10 và cầu thủ biên giữ chiều rộng.','Cầu thủ chuyền tốt, đọc tình huống và trung vệ đủ nhanh.','Mất bóng khi dâng cao dễ để lộ khoảng trống phía sau.','https://www.premierleague.com/en/news/4171827'),
 preset('klopp-liverpool','Jürgen Klopp','Liverpool','2019/20','4-3-3','attacking',{tempo:5,width:4,pressing:5,line:4,passing:'mixed',transition:'counterpress'},'Gegenpressing: đoạt bóng sớm, đẩy nhịp độ và khai thác chiều rộng.','Thể lực, phối hợp, tốc độ và khả năng tạt bóng.','Pressing liên tục khiến cầu thủ xuống sức nhanh.','https://www.premierleague.com/en/news/1697253'),
 preset('flick-barca','Hansi Flick','Barcelona','2024/25','4-2-3-1','attacking',{tempo:4,width:4,pressing:5,line:5,passing:'short',transition:'counterpress'},'Đẩy đội hình lên cao, phối hợp nhanh và gây áp lực ngay khi mất bóng.','Hậu vệ nhanh, phối hợp và chọn vị trí tốt.','Hàng thủ cao dễ bị khai thác bởi chuyền dài và tiền đạo tốc độ.','https://www.uefa.com/uefachampionsleague/news/0299-1db7aad3c91c-255987cfa940-1000--champions-league-performance-insights-how-inter-breached-b/'),
 preset('arteta-arsenal','Mikel Arteta','Arsenal','2024/25','4-3-3','balanced',{tempo:3,width:4,pressing:4,line:4,passing:'short',transition:'counterpress'},'Giữ cấu trúc quanh trục giữa, luân chuyển bóng và tạo ưu thế ở hai cánh.','Tiền vệ chuyền và phối hợp tốt, hậu vệ biết triển khai bóng.','Đòi hỏi kỹ thuật để thoát áp lực; có thể thiếu trực diện trước khối thấp.','https://www.premierleague.com/en/news/4090560'),
 preset('alonso-leverkusen','Xabi Alonso','Bayer Leverkusen','2023/24','3-4-2-1','balanced',{tempo:3,width:5,pressing:4,line:4,passing:'short',transition:'counterpress'},'Ba trung vệ, hai cầu thủ biên dâng cao, hai số 10 giữa các tuyến.','Trung vệ chuyền tốt, hậu vệ biên bền bỉ và tiền vệ sáng tạo.','Khoảng trống hai biên khi wing-back chưa kịp lùi về.','https://www.bundesliga.com/en/bundesliga/news/xabi-alonso-bayer-leverkusen-tactics-25350'),
 preset('inzaghi-inter','Simone Inzaghi','Inter','2024/25','3-5-2','balanced',{tempo:3,width:4,pressing:3,line:2,passing:'mixed',transition:'counter'},'Ba trung vệ và ba tiền vệ bảo vệ trung lộ, hai tiền đạo phối hợp khi chuyển trạng thái.','Trung vệ chắc chắn, tiền vệ kỷ luật và cầu thủ biên cơ động.','Hai biên cần người bọc lót khi đối phương kéo giãn.','https://www.uefa.com/uefachampionsleague/news/0293-1c474051fa77-c7968b76082c-1000--in-the-zone-how-inter-shut-out-arsenal/'),
 preset('ancelotti-madrid','Carlo Ancelotti','Real Madrid','2024/25','4-4-2','balanced',{tempo:4,width:3,pressing:2,line:2,passing:'direct',transition:'counter'},'Khối phòng ngự trung bình, giữ cự ly và tăng tốc ngay khi giành bóng.','Tiền đạo nhanh, bình tĩnh; hàng tiền vệ phối hợp và giữ vị trí.','Nhường quyền kiểm soát bóng, cần tận dụng tốt các pha chuyển trạng thái.','https://www.uefa.com/uefachampionsleague/news/0296-1d0e53af7590-620ae8ae1fb8-1000--champions-league-performance-insights-real-madrid-s-tact/'),
 preset('enrique-paris','Luis Enrique','Paris Saint-Germain','2024/25','4-3-3','attacking',{tempo:4,width:4,pressing:5,line:4,passing:'short',transition:'counterpress'},'Luân chuyển linh hoạt, phối hợp ngắn và pressing quyết liệt từ tuyến đầu.','Rê bóng, phối hợp, thể lực và khả năng ra quyết định.','Cần cường độ vận động cao; sai phối hợp có thể mở đường phản công.','https://www.uefa.com/uefachampionsleague/news/029a-1de9d126962d-87e708b9adaf-1000--champions-league-performance-insights-paris-pressing-and/'),
 preset('simeone-atleti','Diego Simeone','Atlético Madrid','2016/17','4-4-2','defensive',{tempo:4,width:2,pressing:2,line:1,passing:'direct',transition:'counter'},'Hai tuyến bốn người giữ khối hẹp, chờ cơ hội phản công cho cặp tiền đạo.','Chọn vị trí, tắc bóng, sức mạnh và phối hợp.','Ít giữ bóng; khó tạo sức ép liên tục khi cần đuổi tỷ số.','https://www.uefa.com/uefachampionsleague/news/0233-0e95bab7f874-fe21fab97a5b-1000--simeone-u-turn-pays-dividends-for-atletico/'),
 preset('conte-chelsea','Antonio Conte','Chelsea','2016/17','3-4-3','balanced',{tempo:4,width:5,pressing:3,line:3,passing:'direct',transition:'counter'},'Ba trung vệ giữ nền, hai cầu thủ biên hỗ trợ bộ ba tấn công.','Sức bền ở biên, trung vệ mạnh và tiền đạo biết phối hợp.','Nếu cầu thủ biên mệt, đội dễ bị ghim thấp và tách rời các tuyến.','https://www.premierleague.com/en/news/418708'),
];
export function normalizeTactics(value){const t={...DEFAULT_TACTICS,...value};for(const k of Object.keys(TACTIC_OPTIONS))t[k]=Math.max(1,Math.min(5,Math.round(Number(t[k])||3)));if(!PASSING[t.passing])t.passing='mixed';if(!TRANSITION[t.transition])t.transition='balanced';if(t.presetId!=='custom'&&!TACTICAL_PRESETS.some(p=>p.id===t.presetId))t.presetId='custom';return t;}
export function validTactics(t){return t&&Object.keys(TACTIC_OPTIONS).every(k=>Number.isInteger(t[k])&&t[k]>=1&&t[k]<=5)&&!!PASSING[t.passing]&&!!TRANSITION[t.transition]&&(t.presetId==='custom'||TACTICAL_PRESETS.some(p=>p.id===t.presetId));}
export function roleFit(p,role){
 if(!p)return 0;const primary=p.naturalPositions||[],secondary=p.otherPositions||[];
 if(primary.includes(role))return 1;if(secondary.includes(role))return .95;
 const broad=broadPosition(role);if(role==='GK')return p.position==='GK'?1:.32;if(p.position==='GK')return .32;
 if(!primary.length)return p.position===broad?.95:.76;
 const groups=[['LB','LWB','LM'],['RB','RWB','RM'],['CB','DM'],['DM','CM','AM'],['LM','LW'],['RM','RW'],['AM','LW','RW','ST']];
 if(groups.some(xs=>xs.includes(role)&&primary.some(x=>xs.includes(x))))return .84;
 return p.position===broad?.74:.60;
}
export function fitLabel(p,role){const fit=roleFit(p,role);return fit>=.98?'Sở trường':fit>=.93?(p.naturalPositions?.length?'Vị trí phụ':'Đúng tuyến · chưa rõ vị trí'):fit>=.8?'Có thể thích nghi':'Trái vị trí';}
const mean=xs=>xs.length?xs.reduce((s,n)=>s+n,0)/xs.length:10;
// These are bounded gameplay parameters, not measured effectiveness of real coaches.
export function tacticalEffects(settings,players,opponentSettings,opponents){
 const t=normalizeTactics(settings),o=normalizeTactics(opponentSettings),ps=players.filter(p=>p.position!=='GK'),opp=opponents.filter(p=>p.position!=='GK');
 const skill=k=>mean(ps.map(p=>p.attributes[k]));const def=opp.filter(p=>p.position==='DF');
 const technical=(skill('passing')+skill('decisions'))/40;
 const pressWork=(skill('stamina')+skill('teamwork'))/40;
 const direct=t.passing==='direct',short=t.passing==='short';
 const paceGap=skill('pace')-mean((def.length?def:opp).map(p=>p.attributes.pace));
 const counter=(t.transition==='counter'?.055:0)+(direct?.025:0);
 const exposure=Math.max(0,o.line-3)*(counter+.008*Math.max(0,paceGap));
 return {
  possession:(short?.045*technical:direct?-.04:0)+(t.pressing-3)*.012*pressWork+(t.line-3)*.006-(t.tempo-3)*.006,
  attack:Math.max(.75,Math.min(1.30,1+(t.tempo-3)*.045+(t.pressing-3)*.025*pressWork+(t.transition==='counterpress'?.035:0)+(t.transition==='regroup'?-.055:0)+exposure+(t.width-3)*.012)),
  xg:Math.max(.8,Math.min(1.22,1+(short?(technical-.5)*.12:0)+exposure+(t.width-3)*(skill('crossing')-10)/600)),
  allowed:1+(t.line-3)*.025-(t.pressing-3)*.018*pressWork+(t.transition==='counterpress'?.035:t.transition==='regroup'?-.045:0)-(3-t.width)*.008,
  fatigue:Math.max(.72,1+(t.pressing-3)*.095+(t.tempo-3)*.04+(t.transition==='counterpress'?.10:t.transition==='regroup'?-.06:0)),
 };
}
export const fatigueRate=t=>{const v=normalizeTactics(t);return Math.max(.72,1+(v.pressing-3)*.095+(v.tempo-3)*.04+(v.transition==='counterpress'?.10:v.transition==='regroup'?-.06:0));};
export function positionSummary(p){return p.naturalPositions?.length?[...p.naturalPositions,...(p.otherPositions||[])].join(' / '):({GK:'Thủ môn',DF:'Hậu vệ',MF:'Tiền vệ',FW:'Tiền đạo'}[p.position]+' · chưa rõ vị trí chi tiết');}

export const TACTICAL_PHASES={inPossession:'Khi có bóng',outOfPossession:'Khi không có bóng'};
export const PHASE_TACTICS_SOURCE='https://www.footballmanager.com/fm26/features/possession-out-possession-fm26s-new-tactical-evolution';
const seats=()=>Array.from({length:11},(_,i)=>i);
// Positions refer to seats in the current XI, never to a historical player ID.
// A substitution therefore inherits both positions and cannot revive the outgoing player.
export function createPhaseTactics(formation='4-3-3'){
 if(!FORMATION_SLOTS[formation])throw Error('Sơ đồ không hợp lệ.');
 return {enabled:true,inPossession:{formation,slots:seats()},outOfPossession:{formation,slots:seats()}};
}
export function validPhaseTactics(value){
 return !!value&&typeof value.enabled==='boolean'&&Object.keys(TACTICAL_PHASES).every(phase=>{
  const p=value[phase];return !!p&&!!FORMATION_SLOTS[p.formation]&&Array.isArray(p.slots)&&p.slots.length===11&&new Set(p.slots).size===11&&p.slots.every(i=>Number.isInteger(i)&&i>=0&&i<11);
 });
}
export function phaseShape(config,phase,fallback='4-3-3'){
 return config?.enabled&&TACTICAL_PHASES[phase]?config[phase]:{formation:fallback,slots:seats()};
}
export function phaseLineup(lineup,config,phase,fallback='4-3-3'){
 return phaseShape(config,phase,fallback).slots.map(i=>lineup[i]||null);
}
export function phaseSlot(config,phase,seat,fallback='4-3-3'){
 const shape=phaseShape(config,phase,fallback);return FORMATION_SLOTS[shape.formation][shape.slots.indexOf(seat)];
}
export function remapPhaseFormation(config,phase,formation,lineup,players){
 if(!validPhaseTactics(config)||!TACTICAL_PHASES[phase]||!FORMATION_SLOTS[formation])throw Error('Sơ đồ theo pha không hợp lệ.');
 const previous=config[phase],scores=new Float64Array(1<<11).fill(-Infinity),chosen=new Int8Array(1<<11).fill(-1);scores[0]=0;
 for(let mask=0;mask<(1<<11)-1;mask++){
  let index=0;for(let n=mask;n;n&=n-1)index++;
  const [role,x,y]=FORMATION_SLOTS[formation][index];
  for(let seat=0;seat<11;seat++)if(!(mask&(1<<seat))){
   const old=FORMATION_SLOTS[previous.formation][previous.slots.indexOf(seat)],next=mask|(1<<seat);
   const score=scores[mask]+roleFit(players[lineup[seat]],role)*100-Math.hypot(x-old[1],y-old[2])*.002;
   if(score>scores[next]){scores[next]=score;chosen[next]=seat;}
  }
 }
 const slots=seats();let mask=(1<<11)-1;for(let i=10;i>=0;i--){const seat=chosen[mask];slots[i]=seat;mask^=1<<seat;}
 config[phase]={formation,slots};return config;
}
export function swapPhaseSeats(config,phase,index,seat){
 if(!validPhaseTactics(config)||!TACTICAL_PHASES[phase]||!Number.isInteger(index)||index<0||index>10||!Number.isInteger(seat)||seat<0||seat>10)throw Error('Vị trí theo pha không hợp lệ.');
 const slots=config[phase].slots,old=slots.indexOf(seat);[slots[index],slots[old]]=[slots[old],slots[index]];
}
export function phaseTransitionEffort(config,seat){
 if(!config?.enabled)return 0;
 const a=phaseSlot(config,'inPossession',seat),b=phaseSlot(config,'outOfPossession',seat);
 return Math.min(.15,Math.hypot(a[1]-b[1],a[2]-b[2])*.0012);
}
// Deliberately small game modifiers. Role suitability remains the main effect.
export function phaseShapeEffects(config,phase){
 if(!config?.enabled)return {attack:1,allowed:1};
 const shape=phaseShape(config,phase),depth=mean(FORMATION_SLOTS[shape.formation].slice(1).map(s=>s[2]));
 return {attack:Math.max(.94,Math.min(1.06,1+(50-depth)*.003)),allowed:Math.max(.94,Math.min(1.06,1+(50-depth)*.003))};
}
