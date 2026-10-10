export const SHORTLIST_MONTHS=[3,6,12];
const activeStages=new Set(['club','contract','agreed']);
export function addMonths(date,months){
 const [year,month,day]=date.split('-').map(Number),target=new Date(Date.UTC(year,month-1+months,1));
 target.setUTCDate(Math.min(day,new Date(Date.UTC(target.getUTCFullYear(),target.getUTCMonth()+1,0)).getUTCDate()));
 return target.toISOString().slice(0,10);
}
export function shortlistDeal(g,id){return g.negotiations?.find(d=>d.playerId===id&&d.buyerId===g.clubId&&activeStages.has(d.stage))||g.negotiations?.find(d=>d.playerId===id&&d.buyerId===g.clubId)||null;}
export function initializeShortlist(g){
 if(g.shortlistVersion===1)return;
 g.shortlistVersion=1;g.shortlistEntries={};g.shortlist=[...new Set(g.shortlist||[])].filter(id=>g.players[id]);
 for(const id of g.shortlist)g.shortlistEntries[id]={addedOn:g.date,expiresOn:addMonths(g.date,6),months:6,reason:'watch'};
 for(const id of new Set((g.negotiations||[]).map(d=>d.playerId))){const d=shortlistDeal(g,id);if(d&&d.buyerId===g.clubId&&g.players[d.playerId]?.clubId!==g.clubId&&g.players[d.playerId]&&!g.shortlist.includes(d.playerId)){
  const date=d.closedAt||d.createdAt||g.date;
  if(activeStages.has(d.stage)||(['rejected','withdrawn','expired'].includes(d.stage)&&addMonths(date,6)>g.date))trackPlayer(g,d.playerId,{reason:'negotiation',date}); }}
}
export function trackPlayer(g,id,{months,reason='watch',date=g.date}={}){
 if(!g.players[id])throw Error('Cầu thủ không tồn tại.');
 if(months!==undefined&&!SHORTLIST_MONTHS.includes(months))throw Error('Thời hạn theo dõi phải là 3, 6 hoặc 12 tháng.');
 initializeShortlist(g);
 const previous=g.shortlistEntries[id],duration=months??previous?.months??6;
 if(!g.shortlist.includes(id))g.shortlist.push(id);
 g.shortlistEntries[id]={addedOn:previous?.addedOn||date,months:duration,expiresOn:addMonths(date,duration),reason};
 return g.shortlistEntries[id];
}
export function untrackPlayer(g,id){initializeShortlist(g);g.shortlist=g.shortlist.filter(pid=>pid!==id);delete g.shortlistEntries[id];}
export function toggleShortlist(g,id){if(g.shortlist?.includes(id))untrackPlayer(g,id);else trackPlayer(g,id);}
export function refreshShortlist(g){
 initializeShortlist(g);
 for(const id of [...g.shortlist]){
  const entry=g.shortlistEntries[id],deal=shortlistDeal(g,id);
  if(!g.players[id]||(entry?.expiresOn<=g.date&&!(activeStages.has(deal?.stage)&&deal.expiresOn>=g.date&&g.players[id]?.clubId===deal.sellerId)))untrackPlayer(g,id);
 }
}
export function shortlistStatus(g,id){
 const d=shortlistDeal(g,id);
 if(d&&activeStages.has(d.stage)&&d.expiresOn<g.date)return 'expired';
 return d?.pendingOffer?'pending':d?.stage||'watch';
}
export function validateShortlist(g){
 if(g.shortlistVersion===undefined)return;
 const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'));
 if(g.shortlistVersion!==1||!g.shortlistEntries||Array.isArray(g.shortlistEntries)||new Set(g.shortlist).size!==g.shortlist.length)throw Error('Shortlist không hợp lệ.');
 for(const id of g.shortlist){const e=g.shortlistEntries[id];if(!g.players[id]||!e||!SHORTLIST_MONTHS.includes(e.months)||!validDate(e.addedOn)||!validDate(e.expiresOn)||!['watch','negotiation'].includes(e.reason))throw Error('Shortlist không hợp lệ.');}
}
