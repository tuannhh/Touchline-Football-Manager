/** Optional new-career scenario seeded from dated source reports.
 * Source calendar dates are retained as provenance; recovery is simulated from
 * the career's opening date. This module is never a save-migration hook.
 */
const DAY = 86_400_000;
const MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];

function day(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value)) return null;
  const text=value.slice(0,10),time=Date.parse(`${text}T00:00:00Z`);
  return Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===text?{text,time}:null;
}

function recovery(availability, sourceDay) {
  let returnDay=day(availability.expectedReturnDate);
  let basis=returnDay?'source_expected_date':null;
  if(!returnDay){
    const text=typeof availability.expectedReturnText==='string'?availability.expectedReturnText.trim():'';
    returnDay=day(text);
    if(returnDay)basis='source_expected_date';
    if(!returnDay){
      const match=text.match(/^(?:(early|mid|late)\s+)?([a-z]+)\s+(\d{4})$/i);
      const month=match?MONTHS.indexOf(match[2].toLowerCase()):-1;
      if(month>=0){
        const year=Number(match[3]),part=match[1]?.toLowerCase();
        const end=part==='early'?10:part==='mid'?20:new Date(Date.UTC(year,month+1,0)).getUTCDate();
        const time=Date.UTC(year,month,end);
        if(Number.isFinite(time)){returnDay={text:new Date(time).toISOString().slice(0,10),time};basis='source_approximate_window';}
      }
    }
  }
  if(returnDay&&returnDay.time<sourceDay.time)return null;
  const weeks=returnDay?Math.ceil((returnDay.time-sourceDay.time)/(7*DAY)):2;
  return {weeks:Math.max(1,Math.min(52,weeks)),basis:basis||'default_two_weeks'};
}

export function initializeSnapshotInjuries(g,{enabled=false}={}) {
  if(enabled!==true||!g?.players||g.snapshotInjuries?.initialized)return 0;
  const sourceDay=day(g.dbMeta?.playerReality?.asOf);
  if(!sourceDay||!day(g.date))return 0;
  let applied=0;
  for(const player of Object.values(g.players)){
    const observation=player?.realWorld,availability=observation?.availability;
    if(observation?.playerId!==player.id||availability?.status!=='injured'||availability.currentConfirmed!==true||player.injury>0)continue;
    const observed=day(availability.observedAt);
    if(!observed||observed.text!==sourceDay.text)continue;
    const estimate=recovery(availability,sourceDay);
    if(!estimate)continue;
    player.injury=estimate.weeks;
    player.injuryDetail={
      kind:typeof availability.description==='string'&&availability.description.trim()?availability.description:'Injury reported',
      context:'source_snapshot',active:true,since:g.date,initialWeeks:estimate.weeks,lastWeeks:estimate.weeks,
      sourceDate:sourceDay.text,recoveryEstimated:true,recoveryBasis:estimate.basis,
      sourceUrl:availability.sourceUrl||observation.sourceUrl||null,
    };
    applied++;
  }
  g.snapshotInjuries={initialized:true,enabled:true,sourceDate:sourceDay.text,seededAt:g.date,applied,recoveryEstimated:true};
  return applied;
}
