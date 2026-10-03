import {internationalCalendarEntries} from './international.mjs';
import {internationalWindows} from './international-data.mjs';
const addDays=(d,n)=>new Date(Date.parse(d)+n*86400000).toISOString().slice(0,10);
/** Preserve played slots and the current clock; insert and reschedule only future dates. */
export function mergeInternationalCalendar(g,{fresh=false}={}){
 if(!g.calendar)return false;
 if(!fresh&&g.internationalCalendarYear===g.year)return false;
 const original=g.calendar,cut=fresh?0:Math.min(original.length,g.round+1),past=original.slice(0,cut);
 const windows=[...internationalWindows(g.year),...internationalWindows(g.year+1)].filter(w=>w.scope==='all'&&w.mandatory);
 let previous=past.at(-1)?.date;const mapping=new Map(past.map((s,i)=>[i,i]));
 const future=original.slice(cut).filter(s=>s.kind!=='international').map((s,offset)=>{
  const oldIndex=original.indexOf(s);let date=s.date;if(previous&&date<addDays(previous,3))date=addDays(previous,3);
  let block;while((block=windows.find(w=>date>=w.start&&date<=w.end)))date=addDays(block.end,1);
  previous=date;return {...s,date,oldIndex};
 });
 const byDate=new Map(future.map(s=>[s.date,s]));
 for(const entry of internationalCalendarEntries(g,g.year)){
  if(entry.date<(fresh?g.date:addDays(g.date,1)))continue;
  const existing=byDate.get(entry.date);
  if(existing)existing.eventIds=[...new Set([...(existing.eventIds||[]),...(entry.eventIds||[])])];
  else byDate.set(entry.date,{...entry,kind:'international'});
 }
 const combined=[...past,...[...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date))];
 combined.forEach((slot,i)=>{if(slot.oldIndex!==undefined){mapping.set(slot.oldIndex,i);delete slot.oldIndex;}});
 for(const f of [...g.fixtures,...(g.friendlies||[])]){
  if(f.result||f.round<cut||f.year&&f.year!==g.year)continue;
  const next=mapping.get(f.round);if(next!==undefined){f.round=next;f.date=combined[next].date;}
 }
 g.calendar=combined;g.internationalCalendarYear=g.year;return true;
}
