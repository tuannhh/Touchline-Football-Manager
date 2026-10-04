import {makeMessage} from './mail.mjs';
import {playerReadiness,injuryRiskMultiplier,recoverPlayerPhysical,recordPhysicalMatch} from './playerPhysical.mjs';
import {staffEffects} from './staff.mjs';
import {isoCountry} from './locale.mjs';
import {internationalWindows,addInternationalDays,INTERNATIONAL_SOURCES} from './international-data.mjs';
export {internationalWindows,INTERNATIONAL_SOURCES} from './international-data.mjs';

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const hash=s=>{let n=2166136261;for(const c of String(s)){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return n>>>0;};
const random=s=>{s.rng=(Math.imul(s.rng,1664525)+1013904223)>>>0;return s.rng/4294967296;};
const normalized=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replaceAll('đ','d').replace(/[^a-z0-9]/g,'');
const EU=new Set('AL AD AT BY BE BA BG HR CY CZ DK ENG EE FO FI FR GE DE GI GR HU IS IE IL IT KZ XK LV LI LT LU MT MD MC ME NL MK NIR NO PL PT RO RU SM SCO RS SK SI ES SE CH TR UA WAL AM AZ'.split(' '));
const AFC=new Set('AF AU BH BD BT BN KH CN TW HK IN ID IR IQ JP JO KP KR KW KG LA LB MO MY MV MN MM NP OM PK PS PH QA SA SG LK SY TJ TH TL TM AE UZ VN YE'.split(' '));
const NAM=new Set('US CA MX CR PA HN GT SV NI BZ JM HT DO CU TT BB GD GY SR CW AW PR AG LC KN VC BM MQ GP GF BQ SX MS VI KY TC AI'.split(' '));
const SAM=new Set('AR BO BR CL CO EC PY PE UY VE'.split(' '));
const OFC=new Set('NZ FJ NC PF PG SB VU WS TO'.split(' '));
const aliases={SBA:'RS',MOR:'MA',RDC:'CD',CRM:'CM',KORS:'KR',GAM:'GM',XKX:'XK',KVX:'XK',MTG:'ME',ROM:'RO',MARQ:'MQ',CTA:'CF',MTN:'MR',NIG:'NE',LIB:'LB',OMA:'OM',PAL:'PS',EQG:'GQ',TAN:'TZ',RSA:'ZA',KSA:'SA',UAE:'AE',GUF:'GF',BOE:'BQ',SMA:'SX',SRI:'LK',MAD:'MG',CHA:'TD',COM:'KM',CPV:'CV',IRL:'IE'};
const names=new Map(),vi=new Intl.DisplayNames(['vi'],{type:'region'}),en=new Intl.DisplayNames(['en'],{type:'region'});
for(let a=65;a<91;a++)for(let b=65;b<91;b++){const id=String.fromCharCode(a,b),name=en.of(id);if(name!==id){names.set(normalized(name),id);names.set(normalized(vi.of(id)),id);}}
for(const [name,id]of Object.entries({England:'ENG',Anh:'ENG',Scotland:'SCO',Wales:'WAL','Northern Ireland':'NIR','Republic of Ireland':'IE','South Korea':'KR','North Korea':'KP','Congo DR':'CD','DR Congo':'CD','Ivory Coast':'CI','Cape Verde Islands':'CV','Vietnam':'VN','USA':'US','Türkiye':'TR','UAE':'AE','Viet Nam':'VN','Bỉ':'BE','Pháp':'FR','Đức':'DE','Tây Ban Nha':'ES','Bồ Đào Nha':'PT','Hà Lan':'NL','Ý':'IT','Việt Nam':'VN'}))names.set(normalized(name),id);
/** GB alone is ambiguous: never silently turn Scottish/Welsh/NI players into England players. */
export function nationalTeamId(p){
 const code=String(p.countryCode||'').toUpperCase(),byName=names.get(normalized(p.nationality));
 if(['ENG','SCO','WAL','NIR'].includes(code))return code;
 if(code==='GB'||code==='GBR')return ['ENG','SCO','WAL','NIR'].includes(byName)?byName:null;
 const iso=aliases[code]||isoCountry(p);return iso&&iso!=='GB'?iso:byName&&byName!=='GB'?byName:null;
}
export function nationalTeamName(id){return ({ENG:'Anh',SCO:'Scotland',WAL:'Wales',NIR:'Bắc Ireland',XK:'Kosovo'})[id]||vi.of(id)||id;}
const confederation=id=>EU.has(id)?'UEFA':AFC.has(id)?'AFC':NAM.has(id)?'CONCACAF':SAM.has(id)?'CONMEBOL':OFC.has(id)?'OFC':'CAF';
const keys={GK:['reflexes','handling','positioning','composure'],DF:['tackling','positioning','heading','strength'],MF:['passing','vision','teamwork','dribbling'],FW:['finishing','dribbling','pace','composure']};
export const internationalAbility=p=>Math.round((keys[p.position]||keys.MF).reduce((s,k)=>s+(p.attributes?.[k]||10),0)/4*5);
const byAbility=(a,b)=>internationalAbility(b)-internationalAbility(a)||a.id.localeCompare(b.id);
const pool=(g,id)=>Object.values(g.players).filter(p=>nationalTeamId(p)===id).sort(byAbility);
export function nationalRoster(g,id){const s=g.international;if(!s)return [];const active=s.callups.filter(c=>c.teamId===id&&['announced','pending','released'].includes(c.status)).map(c=>g.players[c.playerId]).filter(Boolean);return active.length?active:selectSquad(pool(g,id));}
function selectSquad(players){const selected=[];for(const [position,count]of [['GK',3],['DF',8],['MF',8],['FW',4]])selected.push(...players.filter(p=>p.position===position).slice(0,count));for(const p of players)if(selected.length<23&&!selected.some(x=>x.id===p.id))selected.push(p);return selected.slice(0,23);}
function teamCatalog(g){const grouped={};for(const p of Object.values(g.players)){const id=nationalTeamId(p);if(id)(grouped[id]||=[]).push(p);}return Object.fromEntries(Object.entries(grouped).map(([id,ps])=>[id,{id,name:nationalTeamName(id),confederation:confederation(id),poolCount:ps.length,playable:ps.length>=11&&ps.some(p=>p.position==='GK'),sourceKind:'database-nationality',simulated:true}]));}
function addWindows(g,year){const s=g.international;for(const w of [...internationalWindows(year),...internationalWindows(year+1)])if(w.returnDate>=`${year}-08-01`&&w.noticeDate<=`${year+1}-07-31`&&w.returnDate>=s.startedAt&&!s.windows.some(x=>x.id===w.id))s.windows.push({...w,announced:false,started:false,finished:false});s.windows.sort((a,b)=>a.start.localeCompare(b.start));}
export function initializeInternational(g){
 if(g.international)return g;
 g.international={version:1,rng:hash(`${g.simulationId||g.id}:international`),startedAt:g.date,lastProcessedDate:null,teams:teamCatalog(g),windows:[],callups:[],matches:[],competitions:[]};addWindows(g,g.year);return g;
}
/** Pure calendar proposal. Root merges these with club slots; this module never changes club rounds. */
export function internationalCalendarEntries(g,year=g.year){
 const windows=[...internationalWindows(year),...internationalWindows(year+1)],dates=new Map();
 for(const w of windows)for(const date of [w.noticeDate,w.start,...w.matchDates,w.returnDate])if(date>=`${year}-08-01`&&date<=`${year+1}-07-31`&&date>=g.date){const slot=dates.get(date)||{kind:'international',type:'international',date,eventIds:[],label:'Hoạt động đội tuyển'};if(!slot.eventIds.includes(w.id))slot.eventIds.push(w.id);dates.set(date,slot);}
 return [...dates.values()].sort((a,b)=>a.date.localeCompare(b.date));
}
function send(g,title,paragraphs,date){const m=makeMessage(g,title,paragraphs.join('\n\n'),'news',{date,paragraphs:[`Kính gửi HLV ${g.manager},`,...paragraphs,'Trân trọng,','Bộ phận liên lạc đội tuyển'],sender:'Bộ phận liên lạc đội tuyển',action:{page:'international',label:'Xem đội tuyển và lệnh triệu tập'}});g.messages.unshift(m);g.messages=g.messages.slice(0,250);}
function eligibleTeams(g,scope){return Object.values(g.international.teams).filter(t=>t.playable&&(!scope||scope==='all'||t.confederation===scope)).map(t=>t.id).sort();}
function getCompetition(g,id,name,teams,format='league'){
 const s=g.international;let c=s.competitions.find(x=>x.id===id);if(c)return c;
 const shuffled=[...teams].sort((a,b)=>hash(id+a)-hash(id+b)),groups=[];for(let i=0;i<shuffled.length;i+=4)groups.push(shuffled.slice(i,i+4));if(groups.at(-1)?.length===1&&groups.length>1)groups.at(-2).push(...groups.pop());
 c={id,name,teamIds:[...teams],groups,format,simulated:true,champion:null,sourceKey:id.startsWith('nations')?'nations':id.startsWith('euro')?'euro':id.startsWith('asian')?'asian':'fifa'};s.competitions.push(c);return c;
}
function roundPairs(ids,round){if(ids.length<2)return [];const a=[...ids];if(a.length%2)a.push(null);const n=a.length;for(let j=0;j<round%(n-1);j++)a.splice(1,0,a.pop());const pairs=[];for(let i=0;i<n/2;i++){const pair=[a[i],a[n-1-i]];if(pair.every(Boolean))pairs.push(round>=n-1?pair.reverse():pair);}return pairs;}
function fixture(g,w,date,competitionId,home,away,stage='league',group=null){if(date<g.international.startedAt)return;const s=g.international,id=`national-${w.id}-${date}-${home}-${away}-${stage}`;if(s.matches.some(f=>f.id===id))return;s.matches.push({id,windowId:w.id,date,competitionId,home,away,stage,group,simulated:true,result:null});}
export function internationalTable(g,competitionId,group=null){const s=g.international,c=s?.competitions.find(x=>x.id===competitionId);if(!c)return [];const ids=group===null?c.teamIds:c.groups[group]||[],rows=Object.fromEntries(ids.map(id=>[id,{teamId:id,played:0,won:0,drawn:0,lost:0,gf:0,ga:0,points:0}]));for(const f of s.matches.filter(f=>f.competitionId===competitionId&&f.result&&!f.result.cancelled&&f.stage==='league'))for(let side=0;side<2;side++){const id=side?f.away:f.home,r=rows[id];if(!r)continue;const a=f.result.score[side],b=f.result.score[1-side];r.played++;r.gf+=a;r.ga+=b;if(a>b){r.won++;r.points+=3;}else if(a===b){r.drawn++;r.points++;}else r.lost++;}return Object.values(rows).sort((a,b)=>b.points-a.points||(b.gf-b.ga)-(a.gf-a.ga)||b.gf-a.gf||a.teamId.localeCompare(b.teamId));}
function scheduleWindow(g,w){
 const s=g.international,teams=eligibleTeams(g,w.scope);if(teams.length<2)return;
 if(w.kind==='asian'){
  const c=getCompetition(g,'asian-2027','AFC Asian Cup 2027 · mô phỏng',teams,'groups-knockout');
  // Restricted database edition: every sufficiently represented Asian team is included, not a claimed qualification list.
  c.limitation='Giải rút gọn từ các quốc tịch châu Á đủ cầu thủ trong database; không phải danh sách 24 đội vượt qua vòng loại thật.';
  for(let i=0;i<3;i++)for(let j=0;j<c.groups.length;j++)for(const [h,a]of roundPairs(c.groups[j],i))fixture(g,w,w.matchDates[i],c.id,h,a,'league',j);return;
 }
 const europe=teams.filter(id=>s.teams[id].confederation==='UEFA'&&id!=='RU'),other=teams.filter(id=>!europe.includes(id));
 const month=Number(w.start.slice(5,7)),cycle=w.year-w.year%2;
 if(w.kind==='window'&&w.year%2===0&&month>=9){const c=getCompetition(g,`nations-${cycle}`,`UEFA Nations League ${cycle}/${String(cycle+1).slice(-2)} · mô phỏng`,europe,'groups-knockout');const offset=month===11?4:0;for(let i=0;i<w.matchDates.length;i++)for(let j=0;j<c.groups.length;j++)for(const [h,a]of roundPairs(c.groups[j],offset+i))fixture(g,w,w.matchDates[i],c.id,h,a,'league',j);}
 else if(w.kind==='window'&&w.year%2===1&&(month===3||month===6)){
  const c=s.competitions.find(c=>c.id===`nations-${w.year-1}`);let finalists=[];
  if(c&&month===3){const ranking=internationalTable(g,c.id);finalists=ranking.slice(0,Math.min(8,2**Math.floor(Math.log2(ranking.length||1)))).map(r=>r.teamId);if(finalists.length>=2)for(let i=0;i<finalists.length/2;i++)fixture(g,w,w.matchDates[0],c.id,finalists[i],finalists.at(-1-i),'qf');}
  if(c&&month===6){finalists=s.matches.filter(f=>f.competitionId===c.id&&f.stage==='qf'&&f.result?.winner).map(f=>f.result.winner);if(finalists.length===1)c.champion=finalists[0];for(let i=0;i+1<finalists.length;i+=2)fixture(g,w,w.matchDates[finalists.length===2?1:0],c.id,finalists[i],finalists[i+1],finalists.length===2?'final':'sf');}
  const qualifiers=europe.filter(id=>!finalists.includes(id));if(w.year===2027)scheduleEuro(g,w,qualifiers);else other.push(...qualifiers);other.push(...finalists.filter(id=>!s.matches.some(f=>f.windowId===w.id&&(f.home===id||f.away===id))));
 }
 else if(w.kind==='window'&&w.year===2027)scheduleEuro(g,w,europe);
 else other.push(...europe);
 if(other.length){const c=getCompetition(g,`friendly-${w.year}`,`Giao hữu đội tuyển ${w.year} · mô phỏng`,eligibleTeams(g,'all'),'friendly');for(let i=0;i<w.matchDates.length;i++)for(const [h,a]of roundPairs(other,i+(month===11?4:0)))fixture(g,w,w.matchDates[i],c.id,h,a,'friendly');}
}
function scheduleEuro(g,w,teams){if(teams.length<2)return;const c=getCompetition(g,'euro-2028','Vòng loại EURO 2028 · mô phỏng',eligibleTeams(g,'UEFA').filter(id=>id!=='RU'));c.limitation='Bảng và cặp đấu rút gọn theo database; đội đang dự vòng cuối Nations League không đá đồng thời. Chưa tái tạo đầy đủ hệ thống 12 bảng và vé play-off.';const month=Number(w.start.slice(5,7)),offset=month===3?0:month===6?2:month===9?4:8;for(let i=0;i<w.matchDates.length;i++)for(let j=0;j<c.groups.length;j++)for(const [h,a]of roundPairs(c.groups[j],offset+i))if(teams.includes(h)&&teams.includes(a))fixture(g,w,w.matchDates[i],c.id,h,a,'league',j);}
function optionalClubReason(g,w,p){
 if(g.fixtures?.some(f=>!f.result&&!f.cancelled&&(f.home===p.clubId||f.away===p.clubId)&&f.date>=w.start&&f.date<w.returnDate))return 'CLB từ chối giao hữu ngoài lịch vì trùng trận đấu của CLB.';
 const departing=new Set(g.international.callups.filter(c=>c.windowId===w.id&&c.clubId===p.clubId&&['announced','released'].includes(c.status)).map(c=>c.playerId));departing.add(p.id);
 const eligible=Object.values(g.players).filter(x=>x.clubId===p.clubId&&x.injury===0&&x.suspension===0&&!x.internationalDuty?.active&&!departing.has(x.id));
 if(eligible.length<11||!eligible.some(x=>x.position==='GK'))return 'CLB giữ cầu thủ để bảo đảm đủ đội hình và thủ môn.';return null;
}
function announce(g,w,date){
 const s=g.international;w.announced=true;scheduleWindow(g,w);const teams=[...new Set(s.matches.filter(f=>f.windowId===w.id).flatMap(f=>[f.home,f.away]))];
 for(const teamId of teams)for(const p of selectSquad(pool(g,teamId))){const own=p.clubId===g.clubId,refusal=!w.mandatory&&!own?optionalClubReason(g,w,p):null,status=p.injury>0?'exempt':refusal?'declined':w.mandatory?'announced':own?'pending':'announced';s.callups.push({id:`call-${w.id}-${p.id}`,windowId:w.id,teamId,playerId:p.id,clubId:p.clubId,noticeDate:date,from:w.start,to:w.returnDate,mandatory:w.mandatory,status,reason:status==='exempt'?'Liên đoàn chấp thuận hồ sơ chấn thương hiện tại (mô phỏng).':refusal,injuryAtNotice:p.injury||0,appearances:0,goals:0,minutes:0});}
 const own=s.callups.filter(c=>c.windowId===w.id&&c.clubId===g.clubId);if(own.length)send(g,`${w.label} · ${own.length} lệnh triệu tập`,[`Đợt tập trung từ ${w.start} đến ${w.end}, dự kiến trở lại CLB ngày ${w.returnDate}.`,...own.map(c=>`${g.players[c.playerId].name} → ${nationalTeamName(c.teamId)}${c.status==='exempt'?' · miễn do chấn thương':''}.`),w.mandatory?'Đợt thuộc lịch nhả quân bắt buộc. CLB có thể gửi đề nghị miễn vì chấn thương đang có; không thể từ chối chỉ vì cần cầu thủ.':'Giao hữu do game tạo ngoài lịch FIFA. Bạn có thể đồng ý hoặc từ chối từng cầu thủ. Không trả lời trước ngày tập trung được hiểu là không đồng ý.','Danh sách triệu tập do mô phỏng chọn từ dữ liệu quốc tịch có sẵn; không phải danh sách tuyển quốc gia thật.'],date);
}
function startWindow(g,w){const s=g.international;w.started=true;for(const c of s.callups.filter(c=>c.windowId===w.id)){const p=g.players[c.playerId];if(c.status==='pending'){c.status='declined';c.reason='CLB không xác nhận nhả quân trước ngày tập trung.';}if(c.status!=='announced')continue;if(!w.mandatory&&p.clubId!==g.clubId){const reason=optionalClubReason(g,w,p);if(reason){c.status='declined';c.reason=reason;continue;}}if(p.injury>0){c.status='exempt';c.reason='Hồ sơ chấn thương được liên đoàn chấp thuận (mô phỏng).';continue;}if(p.internationalDuty?.active){c.status='exempt';c.reason='Đã có đợt đội tuyển khác trùng thời gian.';continue;}c.status='released';p.internationalDuty={active:true,callUpId:c.id,windowId:w.id,teamId:c.teamId,from:c.from,to:c.to,recoveredThrough:c.from>s.startedAt?c.from:s.startedAt};}}
export function respondToCallUp(g,id,{accept,reason=''}={}){
 if(g.liveMatch)throw Error('Hãy hoàn tất trận đấu trước khi trả lời triệu tập.');const s=g.international,c=s?.callups.find(c=>c.id===id),p=g.players[c?.playerId];if(!c||!p||p.clubId!==g.clubId)throw Error('Lệnh triệu tập không thuộc cầu thủ của CLB bạn.');
 if(!['pending','announced','released'].includes(c.status))throw Error('Lệnh triệu tập đã được giải quyết.');if(g.date>=c.to)throw Error('Đợt tập trung đã kết thúc.');
 if(accept){if(g.date>=c.from)throw Error('Đã qua thời hạn xác nhận nhả quân.');if(c.status!=='pending')throw Error('Cầu thủ đã được xác nhận nhả quân.');c.status='announced';c.reason='CLB đồng ý cho dự giao hữu ngoài lịch.';return {ok:true,message:c.reason};}
 if(c.mandatory){if(!(p.injury>0)||String(reason).trim().length<5)throw Error('Đợt bắt buộc chỉ miễn khi cầu thủ đang chấn thương và có lý do y tế.');c.status='exempt';c.reason='Liên đoàn chấp thuận đề nghị y tế (mô phỏng): '+String(reason).trim().slice(0,400);}
 else {if(c.status==='released'||g.date>=c.from)throw Error('Cầu thủ đã lên tuyển; không thể rút lại đồng ý ngoài lịch.');c.status='declined';c.reason=String(reason).trim().slice(0,400)||'CLB cần cầu thủ cho kế hoạch thi đấu.';p.morale=clamp(p.morale-1,0,100);}
 if(p.internationalDuty?.callUpId===c.id)delete p.internationalDuty;return {ok:true,message:c.reason};
}
export function internationalAvailability(g,p){const d=p?.internationalDuty;return !d?.active||!!g?.date&&g.date>=d.to;}
function nationalXI(g,w,teamId,date=g.date){
 const rank=p=>{if(!g.physical)return internationalAbility(p)+p.fitness*.2;const r=playerReadiness(g,p,{date});return internationalAbility(p)+r.fitness*.35-r.fatigue*.35-(r.needsRest?12:0)-(r.risk==='high'?25:0);};
 const ps=g.international.callups.filter(c=>c.windowId===w.id&&c.teamId===teamId&&c.status==='released').map(c=>g.players[c.playerId]).filter(p=>p.injury===0&&p.fitness>=25).sort((a,b)=>rank(b)-rank(a)||a.id.localeCompare(b.id));
 const out=[];for(const [position,count]of [['GK',1],['DF',4],['MF',3],['FW',3]])out.push(...ps.filter(p=>p.position===position).slice(0,count));for(const p of ps)if(out.length<11&&!out.includes(p))out.push(p);return out.slice(0,11);
}
function score(s,power){let n=0;for(let j=0;j<6;j++)if(random(s)<clamp(power,.08,.5))n++;return n;}
function playNational(g,w,f){
 const s=g.international,teams=[nationalXI(g,w,f.home,f.date),nationalXI(g,w,f.away,f.date)];
 if(teams.some(ps=>ps.length<11||!ps.some(p=>p.position==='GK'))){f.result={cancelled:true,reason:'Không đủ 11 cầu thủ được nhả quân và khỏe mạnh trong database.',score:[0,0],events:[]};return;}
 const strength=teams.map(ps=>ps.reduce((v,p)=>{const r=g.physical?playerReadiness(g,p,{date:f.date}):null;return v+internationalAbility(p)*(r?(.7+r.fitness*.003)*(1-r.fatigue*.001):1);},0)/11),goals=[score(s,.2+(strength[0]-strength[1])/180),score(s,.2+(strength[1]-strength[0])/180)],events=[],statistics=[];
 for(let side=0;side<2;side++){
  const scorers=teams[side].filter(p=>p.position!=='GK'),scored={};for(let i=0;i<goals[side];i++){const p=scorers[Math.floor(random(s)*scorers.length)];scored[p.id]=(scored[p.id]||0)+1;events.push({type:'goal',minute:1+Math.floor(random(s)*90),playerId:p.id,teamId:side?f.away:f.home,text:p.name+' ghi bàn.'});}
  for(const p of teams[side]){
   const c=s.callups.find(c=>c.windowId===w.id&&c.playerId===p.id),newGoals=scored[p.id]||0;let minutes=90;
   // Keep minimal legacy simulation's recovery and RNG order unchanged.
   if(!g.physical)p.fitness=clamp(p.fitness-(p.position==='GK'?5:12+random(s)*5),0,100);
   const risk=g.physical?injuryRiskMultiplier(g,p,{date:f.date,minutes:{[p.id]:90},workload:{[p.id]:90}}):1;
   if(random(s)<.008*risk){
    p.injury=Math.max(p.injury,1+Math.floor(random(s)*3));const injuryMinute=45+Math.floor(random(s)*44);
    events.push({type:'injury',minute:injuryMinute,playerId:p.id,teamId:side?f.away:f.home,text:p.name+' chấn thương khi lên tuyển.'});
    if(g.physical){minutes=injuryMinute;for(const e of events)if(e.type==='goal'&&e.playerId===p.id&&e.minute>=injuryMinute)e.minute=injuryMinute-1;}
    c.status='injured';c.reason='Trở lại CLB điều trị chấn thương khi lên tuyển.';delete p.internationalDuty;
   }
   p.nationalStats||={appearances:0,goals:0,minutes:0};p.nationalStats.appearances++;p.nationalStats.goals+=newGoals;p.nationalStats.minutes+=minutes;c.appearances++;c.goals+=newGoals;c.minutes+=minutes;
   p.morale=clamp(p.morale+(goals[side]>goals[1-side]?2:goals[side]<goals[1-side]?-1:0),0,100);
   statistics.push({playerId:p.id,minutes,goals:newGoals});
  }
 }
 if(g.physical){const minutes=Object.fromEntries(statistics.map(stat=>[stat.playerId,stat.minutes]));recordPhysicalMatch(g,{fixtureId:f.id,date:f.date,kind:'international',minutes,workload:minutes});}
 f.result={score:goals,events:events.sort((a,b)=>a.minute-b.minute),statistics};
 if(['qf','sf','final'].includes(f.stage)){if(goals[0]===goals[1]){const side=random(s)<.5?0:1;f.result.penalties=side===0?[5,4]:[4,5];f.result.winner=side===0?f.home:f.away;}else f.result.winner=goals[0]>goals[1]?f.home:f.away;}
 const own=statistics.filter(x=>g.players[x.playerId].clubId===g.clubId);if(own.length)send(g,`${nationalTeamName(f.home)} ${goals.join(' – ')} ${nationalTeamName(f.away)}`,[`${s.competitions.find(c=>c.id===f.competitionId)?.name}. Kết quả mô phỏng ngày ${f.date}.`,...own.map(x=>`${g.players[x.playerId].name}: ${x.minutes} phút, ${x.goals} bàn; thể lực còn ${Math.round(g.players[x.playerId].fitness)}%.`),...events.filter(e=>e.type==='injury'&&g.players[e.playerId].clubId===g.clubId).map(e=>e.text),'Số trận và bàn thắng đội tuyển được lưu riêng, không cộng vào thành tích hoặc thưởng thi đấu của CLB.'],f.date);
 if(f.stage==='final'){const c=s.competitions.find(c=>c.id===f.competitionId);c.champion=f.result.winner;}
}
function advanceTournament(g,w,date){const s=g.international,c=s.competitions.find(c=>c.id===(w.kind==='asian'?'asian-2027':`nations-${w.year-1}`));if(!c)return;
 if(w.kind==='asian'&&date===w.matchDates[3]){const ids=internationalTable(g,c.id).slice(0,Math.min(8,2**Math.floor(Math.log2(c.teamIds.length)))).map(r=>r.teamId);for(let i=0;i<ids.length/2;i++)fixture(g,w,date,c.id,ids[i],ids.at(-1-i),ids.length<=2?'final':ids.length<=4?'sf':'qf');}
 if(w.kind==='asian'&&date===w.matchDates[4]){const ids=s.matches.filter(f=>f.competitionId===c.id&&f.stage==='qf'&&f.result?.winner).map(f=>f.result.winner);for(let i=0;i+1<ids.length;i+=2)fixture(g,w,date,c.id,ids[i],ids[i+1],'sf');}
 if((w.kind==='asian'&&date===w.matchDates[5])||(w.year%2===1&&w.kind==='window'&&Number(w.start.slice(5,7))===6&&date===w.matchDates[1])){const ids=s.matches.filter(f=>f.competitionId===c.id&&f.stage==='sf'&&f.result?.winner).map(f=>f.result.winner);if(ids.length===2)fixture(g,w,date,c.id,ids[0],ids[1],'final');}
}
function finishWindow(g,w,date){const s=g.international;w.finished=true;const own=[];for(const c of s.callups.filter(c=>c.windowId===w.id)){const p=g.players[c.playerId];if(p.internationalDuty?.callUpId===c.id)delete p.internationalDuty;if(c.status==='released'){c.status='returned';if(p.clubId===g.clubId)own.push(c);}}if(own.length)send(g,`${w.label} · cầu thủ trở lại CLB`,own.map(c=>`${g.players[c.playerId].name}: ${c.appearances} trận, ${c.minutes} phút, ${c.goals} bàn cho ${nationalTeamName(c.teamId)}. Thể lực ${Math.round(g.players[c.playerId].fitness)}%, chấn thương ${g.players[c.playerId].injury} tuần.`),date);}
function shortenTournamentDuty(g,w,date){
 if(w.kind!=='asian')return;const s=g.international,c=s.competitions.find(c=>c.id==='asian-2027');if(!c)return;const returning=new Set();
 if(date===w.matchDates[2]){const qualified=new Set(internationalTable(g,c.id).slice(0,Math.min(8,2**Math.floor(Math.log2(c.teamIds.length)))).map(r=>r.teamId));for(const id of c.teamIds)if(!qualified.has(id))returning.add(id);}
 for(const f of s.matches.filter(f=>f.windowId===w.id&&f.date===date&&['qf','sf','final'].includes(f.stage)&&f.result?.winner)){returning.add(f.home===f.result.winner?f.away:f.home);if(f.stage==='final')returning.add(f.result.winner);}
 for(const call of s.callups)if(call.windowId===w.id&&call.status==='released'&&returning.has(call.teamId)){call.to=addInternationalDays(date,1);const p=g.players[call.playerId];if(p.internationalDuty?.callUpId===call.id)p.internationalDuty.to=call.to;}
}
/** Handles all intervening national dates. Does not advance the club clock, calendar, RNG or finances. */
export function processInternationalDate(g,date=g.date){
 if(g.liveMatch)return {ok:false,message:'Đợi trận đang diễn ra kết thúc.',matches:0};initializeInternational(g);const s=g.international;if(s.lastProcessedDate&&date<=s.lastProcessedDate)return {ok:true,matches:0};addWindows(g,g.year);
 const lower=s.lastProcessedDate||addInternationalDays(s.startedAt,-1),dates=new Set([date]);for(const w of s.windows)for(const d of [w.noticeDate,w.start,...w.matchDates,w.returnDate])if(d>lower&&d<=date&&d>=s.startedAt&&(!g.physical||d>=g.physical.startedAt))dates.add(d);let matches=0;
 // The physical system owns all elapsed-time recovery here. Moving every player
 // through event dates in order prevents club recovery from jumping past a
 // national appearance, and lets returned players resume their club schedule.
 const recoverySupport=g.physical?Object.fromEntries(Object.keys(g.clubs).map(id=>[id,staffEffects(g,id).recoveryBonus])):null;
 for(const current of [...dates].sort()){
  for(const p of Object.values(g.players)){
   const d=p.internationalDuty;
   if(g.physical){recoverPlayerPhysical(g,p,current,{intensity:d?.active?'normal':p.clubId===g.clubId?(g.intensity||'normal'):'normal',recoveryBonus:d?.active?0:recoverySupport[p.clubId]||0});if(d?.active)d.recoveredThrough=current;}
   else if(d?.active){const from=d.recoveredThrough||d.from,elapsed=Math.max(0,(Date.parse(current)-Date.parse(from))/86400000);p.fitness=clamp(p.fitness+elapsed*3,0,100);d.recoveredThrough=current;}
  }
  for(const w of s.windows){if(current<w.noticeDate||current>w.returnDate)continue;if(!w.announced)announce(g,w,current);if(current>=w.start&&!w.started)startWindow(g,w);advanceTournament(g,w,current);for(const f of s.matches.filter(f=>f.windowId===w.id&&f.date===current&&!f.result)){playNational(g,w,f);matches++;}shortenTournamentDuty(g,w,current);if(current>=w.returnDate&&!w.finished)finishWindow(g,w,current);}
  const returned=[];for(const c of s.callups)if(c.status==='released'&&c.to<=current){c.status='returned';const p=g.players[c.playerId];if(p.internationalDuty?.callUpId===c.id)delete p.internationalDuty;if(p.clubId===g.clubId)returned.push(c);}
  if(returned.length)send(g,'Cầu thủ trở lại sau khi kết thúc hành trình đội tuyển',returned.map(c=>`${g.players[c.playerId].name} trở lại từ ${nationalTeamName(c.teamId)}: ${c.appearances} trận, ${c.minutes} phút, ${c.goals} bàn; thể lực ${Math.round(g.players[c.playerId].fitness)}%.`),current);
 }
 for(const p of Object.values(g.players))if(p.internationalDuty?.active&&p.internationalDuty.to<=date)delete p.internationalDuty;s.lastProcessedDate=date;return {ok:true,matches};
}
export function validateInternational(g){
 const s=g.international,fail=()=>{throw Error('Dữ liệu đội tuyển hoặc lệnh triệu tập không hợp lệ.');};if(!s){if(Object.values(g.players).some(p=>p.internationalDuty!==undefined||p.nationalStats!==undefined))fail();return true;}
 const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v+'T12:00:00Z'))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;
 if(s.version!==1||!Number.isInteger(s.rng)||s.rng<0||s.rng>4294967295||!date(s.startedAt)||(s.lastProcessedDate!==null&&!date(s.lastProcessedDate))||!s.teams||!Array.isArray(s.windows)||!Array.isArray(s.callups)||!Array.isArray(s.matches)||!Array.isArray(s.competitions)||s.windows.length>2000||s.callups.length>300000||s.matches.length>100000)fail();
 const wins=new Set(),calls=new Set(),fixtures=new Set(),comps=new Set();
 for(const [id,t]of Object.entries(s.teams))if(!t||t.id!==id||typeof t.name!=='string'||!['UEFA','AFC','CAF','CONCACAF','CONMEBOL','OFC'].includes(t.confederation)||!Number.isInteger(t.poolCount)||t.poolCount<1||typeof t.playable!=='boolean')fail();
 for(const c of s.competitions){if(!c||typeof c.id!=='string'||comps.has(c.id)||typeof c.name!=='string'||!Array.isArray(c.teamIds)||new Set(c.teamIds).size!==c.teamIds.length||c.teamIds.some(id=>!s.teams[id])||!Array.isArray(c.groups)||c.groups.some(group=>!Array.isArray(group)||group.some(id=>!c.teamIds.includes(id)))||!['league','friendly','groups-knockout'].includes(c.format)||(c.champion!==null&&!c.teamIds.includes(c.champion)))fail();comps.add(c.id);}
 for(const w of s.windows){if(!w||typeof w.id!=='string'||wins.has(w.id)||![w.start,w.end,w.noticeDate,w.returnDate].every(date)||w.start>w.end||w.noticeDate>w.start||w.returnDate<=w.end||!Array.isArray(w.matchDates)||w.matchDates.length>10||new Set(w.matchDates).size!==w.matchDates.length||w.matchDates.some(d=>!date(d)||d<w.start||d>w.end)||typeof w.mandatory!=='boolean'||!['all','AFC'].includes(w.scope)||!['window','asian','friendly'].includes(w.kind))fail();wins.add(w.id);}
 for(const c of s.callups){if(!c||typeof c.id!=='string'||calls.has(c.id)||!wins.has(c.windowId)||!s.teams[c.teamId]||!g.players[c.playerId]||!g.clubs[c.clubId]||![c.from,c.to,c.noticeDate].every(date)||c.to<=c.from||!['announced','pending','released','exempt','declined','returned','injured'].includes(c.status)||typeof c.mandatory!=='boolean'||![c.appearances,c.goals,c.minutes].every(n=>Number.isInteger(n)&&n>=0))fail();calls.add(c.id);}
 for(const f of s.matches){if(!f||typeof f.id!=='string'||fixtures.has(f.id)||!wins.has(f.windowId)||!comps.has(f.competitionId)||!s.teams[f.home]||!s.teams[f.away]||f.home===f.away||!date(f.date))fail();fixtures.add(f.id);if(f.result){const r=f.result;if(!Array.isArray(r.score)||r.score.length!==2||!r.score.every(n=>Number.isInteger(n)&&n>=0&&n<=20)||!Array.isArray(r.events)||r.events.some(e=>!e||typeof e.text!=='string'||!g.players[e.playerId]||!Number.isInteger(e.minute)||e.minute<0||e.minute>120)||(r.winner!==undefined&&![f.home,f.away].includes(r.winner)))fail();if(!r.cancelled&&(!Array.isArray(r.statistics)||r.statistics.some(x=>!g.players[x.playerId]||!Number.isInteger(x.minutes)||x.minutes<0||x.minutes>120||!Number.isInteger(x.goals)||x.goals<0||x.goals>20)))fail();}}
 for(const p of Object.values(g.players)){const d=p.internationalDuty;if(d&&(!d.active||!calls.has(d.callUpId)||!wins.has(d.windowId)||!s.teams[d.teamId]||![d.from,d.to].every(date)||(d.recoveredThrough!==undefined&&!date(d.recoveredThrough))||!s.callups.some(c=>c.id===d.callUpId&&c.playerId===p.id&&c.status==='released')))fail();if(p.nationalStats&&!['appearances','goals','minutes'].every(k=>Number.isSafeInteger(p.nationalStats[k])&&p.nationalStats[k]>=0))fail();}
 return true;
}
