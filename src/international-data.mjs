// Verified public calendar dates; pairings, selection and match results are simulated.
export const INTERNATIONAL_SOURCES={
 fifa:{label:'FIFA · International Match Calendar',url:'https://vod.fifa.com/tournament-organisation/international-match-calendars',checkedAt:'2026-10-03'},
 calendar:{label:'FIFA 2023–2030 calendar · annex to UEFA/ECA agreement, pp. 20–24',url:'https://editorial.uefa.com/resources/0286-193a153f3660-f29fc244130b-1000/uefa-eca_mou_2024-30_signed_6_september_2023_.pdf',checkedAt:'2026-10-03'},
 release:{label:'FIFA RSTP July 2025 · Annexe 1, articles 1, 3–5 (BFU official copy)',url:'https://bfunion.bg/uploads/2026-01-19/fifa-statusandtransferofplayers-july-2025-en-v6-1.pdf',checkedAt:'2026-10-03'},
 nations:{label:'UEFA · Nations League 2026/27 dates',url:'https://www.uefa.com/uefanationsleague/news/0298-1d6ef1acfaef-b54fcf1da859-1000--2026-27-uefa-nations-league-all-you-need-to-know/',checkedAt:'2026-10-03'},
 euro:{label:'UEFA · EURO 2028 qualifying, March–November 2027',url:'https://fr.uefa.com/euro2028/news/028f-1b59a4693df6-40a119d90cd4-1000--euro-2028-tout-ce-qu-il-faut-savoir/',checkedAt:'2026-10-03'},
 asian:{label:'AFC · Asian Cup 2027, 7 January–5 February',url:'https://www.the-afc.com/en/national/afc_asian_cup.html/news/dates-for-afc-asian-cup-saudi-arabia-2027%E2%84%A2-recommended',checkedAt:'2026-10-03'}
};
export const addInternationalDays=(date,n)=>new Date(Date.parse(date+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
const DATES={
 2026:[['03-23','03-31'],['06-01','06-09'],['09-21','10-06'],['11-09','11-17']],
 2027:[['03-22','03-30'],['06-07','06-15'],['09-20','10-05'],['11-08','11-16']],
 2028:[['03-20','03-28'],['05-29','06-06'],['09-18','10-03'],['11-13','11-21']],
 2029:[['03-19','03-27'],['06-04','06-12'],['09-24','10-09'],['11-12','11-20']],
 2030:[['03-18','03-26'],['06-03','06-11'],['09-23','10-08'],['11-11','11-19']]
};
// Beyond the published range retain a clearly labelled game calendar, never a claimed FIFA date.
function projected(year){return [2,5,8,10].map((month,i)=>{const day=new Date(Date.UTC(year,month,i===2?20:i===0?18:i===1?1:8));while(day.getUTCDay()!==1)day.setUTCDate(day.getUTCDate()+1);const start=day.toISOString().slice(0,10);return [start.slice(5),addInternationalDays(start,i===2?15:8).slice(5)];});}
/** Windows by calendar year, not club season. start includes release/preparation days. */
export function internationalWindows(year){
 const source=DATES[year],dates=source||projected(year);
 const windows=dates.map(([a,b],index)=>{const start=`${year}-${a}`,end=`${year}-${b}`,four=index===2;return {id:`int-${year}-${index}`,year,start,end,noticeDate:addInternationalDays(start,-7),returnDate:addInternationalDays(end,1),matchDates:(four?[3,6,10,15]:[3,8]).map(n=>addInternationalDays(start,n)),mandatory:true,scope:'all',kind:'window',label:four?'Đợt FIFA tháng 9–10':'Đợt FIFA tháng '+Number(a.slice(0,2)),sourceKey:'calendar',officialDates:!!source};});
 if(year===2027){windows[1].matchDates=['2027-06-09','2027-06-13'];windows.push({id:'asian-2027',year,start:'2026-12-28',end:'2027-02-05',noticeDate:'2026-12-13',returnDate:'2027-02-06',matchDates:['2027-01-07','2027-01-12','2027-01-17','2027-01-23','2027-01-29','2027-02-05'],mandatory:true,scope:'AFC',kind:'asian',label:'AFC Asian Cup 2027',sourceKey:'asian',officialDates:true,matchDatesSimulated:true});}
 windows.push({id:`optional-${year}`,year,start:`${year}-12-02`,end:`${year}-12-05`,noticeDate:`${year}-11-25`,returnDate:`${year}-12-06`,matchDates:[`${year}-12-05`],mandatory:false,scope:'all',kind:'friendly',label:'Giao hữu ngoài đợt FIFA · mô phỏng',officialDates:false});
 return windows.sort((a,b)=>a.start.localeCompare(b.start));
}
export const NATIONAL_RULES_NOTE='Trong đợt FIFA và giải vô địch châu lục: CLB phải nhả quân, kể cả giao hữu trong đợt. Giao hữu ngoài lịch: CLB có quyền từ chối. Chấn thương cần xác nhận y tế; game mô phỏng liên đoàn chấp thuận miễn tập trung khi có chấn thương hiện tại và lý do. Di chuyển về CLB được giản lược còn một ngày; không mô phỏng chế tài hoặc tranh chấp pháp lý.';
