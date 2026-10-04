import {tourStadium} from './friendlyInvitations.mjs';
import stadiumSnapshot from './stadium-data.mjs';
// Venue capacities are a dated source snapshot, never a promise that future
// building work is complete. Weather, attendances and ticket prices are game
// simulations. This module deliberately has no dependency on the match RNG.
const CHECKED_AT='2026-10-04';
const PL_SOURCE='https://www.premierleague.com/en/news/4725666/all-you-need-to-know-about-the-20-premier-league-stadiums/';
const pl=(name,city,capacity,capacityNote='')=>({name,city,capacity,countryCode:'EN',sourceName:'Premier League',sourceUrl:PL_SOURCE,sourceDate:'2026-09-26',capacityNote});
const venue=(name,city,countryCode,capacity,sourceName,sourceUrl,sourceDate=CHECKED_AT,capacityNote='')=>({name,city,countryCode,capacity,sourceName,sourceUrl,sourceDate,capacityNote});
export const STADIUM_SOURCES=Object.freeze({
 'Arsenal':pl('Emirates Stadium','London',60704),
 'Aston Villa':pl('Villa Park','Birmingham',36887,'Sức chứa trong giai đoạn cải tạo khán đài, theo nguồn mùa 2026/27.'),
 'AFC Bournemouth':pl('Vitality Stadium','Bournemouth',12357),
 'Bournemouth':pl('Vitality Stadium','Bournemouth',12357),
 'Brentford':pl('Gtech Community Stadium','London',17250),
 'Brighton & Hove Albion':pl('American Express Stadium','Brighton',32176),
 'Chelsea':pl('Stamford Bridge','London',40044),
 'Coventry City':pl('Coventry Building Society Arena','Coventry',32609),
 'Crystal Palace':pl('Selhurst Park','London',25194),
 'Everton':pl('Hill Dickinson Stadium','Liverpool',52769),
 'Fulham':pl('Craven Cottage','London',28107),
 'Hull City':pl('MKM Stadium','Hull',24983),
 'Ipswich Town':pl('Portman Road','Ipswich',30294),
 'Leeds United':pl('Elland Road','Leeds',37633),
 'Liverpool':venue('Anfield','Liverpool','EN',61276,'Liverpool FC','https://www.liverpoolfc.com/news/new-anfield-capacity-confirmed-ahead-2024-25','2024-08-09'),
 'Manchester City':pl('Etihad Stadium','Manchester',61038),
 'Manchester United':pl('Old Trafford','Manchester',74158),
 'Newcastle United':pl('St James’ Park','Newcastle',52729),
 'Nottingham Forest':pl('City Ground','Nottingham',31212),
 'Sunderland':pl('Stadium of Light','Sunderland',48095),
 'Tottenham Hotspur':pl('Tottenham Hotspur Stadium','London',62850),
 'Barcelona':venue('Spotify Camp Nou','Barcelona','ES',62652,'FC Barcelona','https://www.fcbarcelona.es/es/noticias/4465846/comunicado-del-fc-barcelona/amp','2026-03-10','Sức chứa được cấp phép giai đoạn 1C; chưa tính khán đài đang xây dựng.'),
 'Bayern Munich':venue('Allianz Arena','München','DE',75024,'Allianz Arena','https://allianz-arena.com/en/arena/facts/general-information'),
 'Paris Saint-Germain':venue('Parc des Princes','Paris','FR',47929,'Paris Saint-Germain','https://www.psg.fr/en/the-club/facilities/parc-des-princes/overview'),
 'Juventus':venue('Allianz Stadium','Torino','IT',41507,'Lega Serie A','https://www.legaseriea.it/team/juventus/stadium'),
 'AC Milan':venue('Giuseppe Meazza','Milano','IT',75725,'Lega Serie A','https://www.legaseriea.it/team/milan/stadium'),
 'Internazionale':venue('Giuseppe Meazza','Milano','IT',75725,'Lega Serie A','https://www.legaseriea.it/team/milan/stadium'),
 'Benfica':venue('Estádio da Luz','Lisboa','PT',68100,'SL Benfica','https://www.slbenfica.pt/pt-pt/agora/bnews/2025/07/12','2025-07-12'),
 'FC Porto':venue('Estádio do Dragão','Porto','PT',50033,'Liga Portugal / FC Porto','https://ligaportugalstorage.blob.core.windows.net/backoffice/assets/FC_Porto_Guia_do_Adepto_2025_26_b06a1c43ad.pdf','2025-08-01'),
 'Ajax Amsterdam':{...venue('Johan Cruijff ArenA','Amsterdam','NL',55865,'SKIDATA (stadium access supplier)','https://www.skidata.com/nl-nl/references/johan-cruijff-arena-amsterdam-nederland'),sourceKind:'venue-supplier'},
});
const MY_DINH=venue('SVĐ Mỹ Đình','Hà Nội','VN',40000,'VPF','https://vpf.vn/venue/svd-my-dinh/','2019-01-02');
// Names whose identity is sourced, but whose present usable capacity has not
// been verified. Keep that distinction visible instead of inventing precision.
const NAMED_VENUES={
 'Real Madrid':{name:'Santiago Bernabéu',city:'Madrid',capacity:83000,sourceName:'Real Madrid',sourceUrl:'https://www.realmadrid.com/en-US/the-club/history/stadium/santiago-bernabeu'},
 'Sporting CP':{name:'Estádio José Alvalade',city:'Lisboa',capacity:50000,sourceName:'Sporting CP',sourceUrl:'https://www.sporting.pt/pt/ajuda'},
};
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const hash=text=>{let n=2166136261;for(const char of String(text)){n^=char.charCodeAt(0);n=Math.imul(n,16777619);}return n>>>0;};
const generator=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const COUNTRY_BY_PREFIX={eng:'EN',ger:'DE',fra:'FR',ita:'IT',esp:'ES',por:'PT',ned:'NL',vie:'VN'};
const leagueFor=(g,club)=>g.leagues?.find(l=>l.id===club?.leagueId);
const countryFor=(g,club)=>leagueFor(g,club)?.countryCode||COUNTRY_BY_PREFIX[String(club?.leagueId).split('.')[0]]||'EU';
const tierFor=(g,club)=>clamp(Number(leagueFor(g,club)?.tier)||1,1,5);
const reputation=club=>clamp(Number(club?.reputation)||65,1,100);

export function stadiumForClub(g,clubId){
 if(g.stadiums?.[clubId])return structuredClone(g.stadiums[clubId]);
 const club=g.clubs?.[clubId];if(!club)throw Error('CLB không tồn tại.');
 const countryCode=countryFor(g,club),tier=tierFor(g,club),known=STADIUM_SOURCES[club.name]||(club.stadium==='SVĐ Mỹ Đình'?MY_DINH:null),named=NAMED_VENUES[club.name],fixtureVenue=stadiumSnapshot.venues[clubId];
 const estimatedCapacity=Math.round(clamp((countryCode==='VN'?14000:36000)*Math.pow(reputation(club)/72,2)/(1+(tier-1)*.7),1000,85000)/100)*100;
 const fromDatabase=typeof club.stadium==='string'&&club.stadium.trim();
 const result={id:`stadium-${clubId}`,clubId,name:fromDatabase||`SVĐ ${club.name||clubId}`,city:club.city||'',countryCode,capacity:estimatedCapacity,capacityEstimated:true,nameEstimated:!fromDatabase,estimated:true,sourceName:fromDatabase?club.source||'Database':'Touchline',sourceUrl:fromDatabase?club.sourceUrl||'':'',sourceDate:'',checkedAt:CHECKED_AT,capacityNote:'Sức chứa ước tính phục vụ mô phỏng.',pitchLength:105,pitchWidth:68,pitchDimensionsEstimated:true};
 if(known)Object.assign(result,known,{capacityEstimated:false,nameEstimated:false,estimated:false});
 else if(fixtureVenue)Object.assign(result,fixtureVenue,named?{capacity:named.capacity}:{});
 else if(named)Object.assign(result,named,{nameEstimated:false});
 return result;
}

export function initializeMatchEnvironment(g){
 g.environmentVersion??=1;
 g.stadiums??={};
 for(const id of Object.keys(g.clubs||{}))if(!g.stadiums[id])g.stadiums[id]=stadiumForClub(g,id);
 return g;
}

function fixtureDate(g,fixture){
 if(fixture.date)return fixture.date;
 const scheduled=g.calendar?.[fixture.round]?.date;if(scheduled)return scheduled;
 const year=Number.isInteger(g.year)?g.year:2026,round=Number.isInteger(fixture.round)?fixture.round:0;
 return new Date(Date.UTC(year,7,15+round*7)).toISOString().slice(0,10);
}

function neutralStadium(g,fixture){
 const home=g.clubs[fixture.home],away=g.clubs[fixture.away];
 const countryCode=String(fixture.leagueId).startsWith('uefa.')?'EU':countryFor(g,home);
 const capacity=Math.round(clamp((reputation(home)+reputation(away))*350,20000,80000)/1000)*1000;
 return {id:`neutral-${fixture.leagueId||'cup'}-${g.year||2026}`,clubId:null,name:'SVĐ trung lập (mô phỏng)',city:'',countryCode,capacity,capacityEstimated:true,nameEstimated:true,estimated:true,sourceName:'Touchline',sourceUrl:'',sourceDate:'',checkedAt:CHECKED_AT,capacityNote:'Địa điểm trung lập do game mô phỏng; không phải sân chủ nhà.',pitchLength:105,pitchWidth:68,pitchDimensionsEstimated:true};
}

// Approximate seasonal envelopes for fictional match days, not observations or
// a climate database. Northern and southern Vietnam use different winter curves.
const TEMPERATURES={
 US:[16,17,18,20,22,25,28,29,27,24,20,17],JP:[6,7,11,17,22,25,29,30,26,20,14,9],AU:[27,27,25,22,19,17,16,18,21,23,25,26],
 EN:[6,7,9,12,16,19,22,21,18,14,10,7],DE:[2,4,9,14,18,22,24,24,19,13,7,3],
 FR:[6,8,11,15,19,23,26,26,22,16,10,7],IT:[8,10,13,17,22,27,30,30,25,20,14,10],
 ES:[12,13,16,18,22,27,30,30,26,22,16,13],PT:[14,15,17,19,22,25,28,28,26,22,18,15],
 NL:[5,6,9,13,17,20,23,22,19,14,9,6],VN:[19,20,23,27,30,31,31,30,29,27,24,21],
 EU:[5,7,10,15,19,23,26,25,21,16,10,6],
};
const SOUTH_VN=/Hồ Chí Minh|Ho Chi Minh|Đồng Nai|Bình Dương|Bình Phước|Đồng Tháp|Long An|Vĩnh Long|Cần Thơ|An Giang|Bà Rịa/i;
function weatherFor(stadium,date,rand,home){
 const month=clamp(Number(date.slice(5,7))-1,0,11),country=stadium.countryCode;
 let curve=TEMPERATURES[country]||TEMPERATURES.EU;
 if(country==='VN'&&SOUTH_VN.test(home?.name||stadium.city))curve=[28,29,31,32,32,30,30,30,29,29,28,28];
 const temperatureC=Math.round(clamp(curve[month]+(rand()-.5)*11,-10,40));
 const wetSeason=country==='VN'?month>=4&&month<=9:['ES','PT','IT'].includes(country)?month<=2||month>=9:month<=3||month>=9;
 const rainChance=country==='VN'?(wetSeason?.58:.20):(['ES','PT'].includes(country)?wetSeason?.32:.12:wetSeason?.43:.26);
 const weatherRoll=rand(),rain=weatherRoll<rainChance;
 const condition=rain?(temperatureC<=0&&country!=='VN'?'snow':weatherRoll<rainChance*.20?'heavy-rain':'rain'):(rand()<.45?'cloudy':'clear');
 const windKmh=Math.round(2+rand()*22+(rain?rand()*10:0));
 const humidity=Math.round(clamp((rain?78:49)+rand()*19+(country==='VN'?5:0),35,98));
 const pitch=condition==='heavy-rain'||condition==='snow'?'heavy':condition==='rain'?'wet':temperatureC>=27?'dry':'good';
 return {condition,temperatureC,windKmh,humidity,pitch,simulated:true};
}

export function matchEnvironment(g,fixture){
 if(!fixture||!g.clubs?.[fixture.home]||!g.clubs?.[fixture.away])throw Error('Trận đấu không hợp lệ.');
 const saved=fixture.environment||fixture.result?.environment||(g.liveMatch?.fixtureId===fixture.id?g.liveMatch.environment:null);
 if(saved)return structuredClone(saved);
 const date=fixtureDate(g,fixture),home=g.clubs[fixture.home],away=g.clubs[fixture.away],stadium=tourStadium(fixture,date)||(fixture.neutral?neutralStadium(g,fixture):stadiumForClub(g,fixture.home));
 const rand=generator(hash(`${g.year||2026}|${fixture.id||'fixture'}|${fixture.home}|${fixture.away}|${date}|environment-v1`));
 const weather=weatherFor(stadium,date,rand,home),friendly=fixture.friendly===true||fixture.leagueId==='friendly',europe=String(fixture.leagueId).startsWith('uefa.');
 const weatherFactor=weather.condition==='heavy-rain'||weather.condition==='snow'?.86:weather.condition==='rain'?.96:1;
 const attraction=.49+(reputation(home)-45)*.0075+(reputation(away)-60)*.0017+(europe?.065:0)+(fixture.stage==='final'?.1:0)+(rand()-.5)*.12;
 const occupied=clamp((fixture.neutral?Math.max(attraction,.87):attraction)*(friendly?.63:1)*weatherFactor,.13,.997);
 const attendance=clamp(Math.round(stadium.capacity*occupied),0,stadium.capacity);
 const awayFans=Math.round(attendance*(fixture.neutral?.47+rand()*.06:.035+rand()*.055));
 const baseline={EN:42,DE:25,FR:25,IT:28,ES:35,PT:18,NL:23,VN:2.5,EU:28}[stadium.countryCode]||25;
 const ticketPrice=Math.round(baseline*(.65+reputation(home)/180)/(1+(tierFor(g,home)-1)*.27)*(friendly?.60:europe?1.2:1)*100)/100;
 return {version:1,fixtureId:fixture.id||`${fixture.home}-${fixture.away}-${date}`,date,neutral:!!fixture.neutral,stadium,weather,attendance,homeFans:attendance-awayFans,awayFans,occupancy:attendance/stadium.capacity,ticketPrice,gateReceipts:Math.round(attendance*ticketPrice),simulated:true};
}

const int=(value,min,max)=>Number.isInteger(value)&&value>=min&&value<=max;
const finite=(value,min,max)=>Number.isFinite(value)&&value>=min&&value<=max;
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
function validStadium(s){
 return object(s)&&typeof s.id==='string'&&typeof s.name==='string'&&s.name.length>0&&s.name.length<=250&&typeof s.city==='string'&&typeof s.countryCode==='string'&&int(s.capacity,100,200000)&&typeof s.capacityEstimated==='boolean'&&typeof s.nameEstimated==='boolean'&&typeof s.estimated==='boolean'&&typeof s.sourceName==='string'&&typeof s.sourceUrl==='string'&&(!s.sourceUrl||/^https:\/\//.test(s.sourceUrl))&&typeof s.sourceDate==='string'&&(!s.sourceDate||validDate(s.sourceDate))&&validDate(s.checkedAt)&&typeof s.capacityNote==='string'&&finite(s.pitchLength,90,120)&&finite(s.pitchWidth,45,90)&&typeof s.pitchDimensionsEstimated==='boolean';
}
function validContext(context,fixtureId){
 const c=context,w=c?.weather;
 return object(c)&&c.version===1&&c.fixtureId===fixtureId&&validDate(c.date)&&typeof c.neutral==='boolean'&&c.simulated===true&&validStadium(c.stadium)&&object(w)&&w.simulated===true&&['clear','cloudy','rain','heavy-rain','snow'].includes(w.condition)&&finite(w.temperatureC,-30,55)&&finite(w.windKmh,0,150)&&finite(w.humidity,0,100)&&['dry','good','wet','heavy'].includes(w.pitch)&&int(c.attendance,0,c.stadium.capacity)&&int(c.homeFans,0,c.attendance)&&int(c.awayFans,0,c.attendance)&&c.homeFans+c.awayFans===c.attendance&&finite(c.occupancy,0,1)&&Math.abs(c.occupancy-c.attendance/c.stadium.capacity)<1e-8&&finite(c.ticketPrice,0,1000)&&int(c.gateReceipts,0,200000000)&&c.gateReceipts===Math.round(c.attendance*c.ticketPrice);
}

export function validateMatchEnvironment(g){
 if(g.environmentVersion!==undefined&&g.environmentVersion!==1)throw Error('Phiên bản thông tin sân vận động không hợp lệ.');
 if(g.stadiums!==undefined){
  if(!object(g.stadiums))throw Error('Thông tin sân vận động không hợp lệ.');
  for(const [id,stadium]of Object.entries(g.stadiums))if(!g.clubs?.[id]||!validStadium(stadium)||stadium.clubId!==id)throw Error('Thông tin sân vận động không hợp lệ.');
 }
 if(g.environmentVersion===1&&(!g.stadiums||Object.keys(g.clubs||{}).some(id=>!g.stadiums[id])))throw Error('Thiếu thông tin sân vận động.');
 for(const fixture of [...(g.fixtures||[]),...(g.friendlies||[])])for(const context of [fixture.environment,fixture.result?.environment])if(context!==undefined&&!validContext(context,fixture.id))throw Error('Thông tin điều kiện trận đấu không hợp lệ.');
 if(g.liveMatch?.environment!==undefined&&!validContext(g.liveMatch.environment,g.liveMatch.fixtureId))throw Error('Thông tin điều kiện trận đấu không hợp lệ.');
 return true;
}
