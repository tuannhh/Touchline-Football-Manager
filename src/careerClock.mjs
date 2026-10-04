export const dailyCareer=g=>g.careerClock?.version===1;
export const addCareerDays=(date,n)=>new Date(Date.parse(date+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
export const daysBetween=(a,b)=>Math.round((Date.parse(a)-Date.parse(b))/86400000);
export const validCareerDate=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
export function upcomingClubFixtures(g){return [...g.fixtures,...(g.friendlies||[])].filter(f=>!f.result&&!f.cancelled&&(f.home===g.clubId||f.away===g.clubId)&&f.date>=g.date).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));}
export const nextClubFixture=g=>upcomingClubFixtures(g)[0]||null;
export function validateCareerClock(g){
 if(g.careerClock===undefined)return true;
 const c=g.careerClock,fail=()=>{throw Error('Lịch từng ngày của sự nghiệp không hợp lệ.');};
 if(c.version!==1||![c.startedAt,c.lastProcessedDate,c.lastWeeklyDate].every(validCareerDate)||c.startedAt>c.lastProcessedDate||c.lastProcessedDate!==g.date||c.lastWeeklyDate>g.date)fail();
 if(c.lastRumourDate!==null&&(!validCareerDate(c.lastRumourDate)||c.lastRumourDate>g.date))fail();
 if(c.seasonReadyDate!==null&&!validCareerDate(c.seasonReadyDate))fail();
 if(g.liveMatch?.autoManage!==undefined&&typeof g.liveMatch.autoManage!=='boolean')fail();
 return true;
}
