// Search the current career, so transfers and saved worlds stay authoritative.
export const normalizeSearch=text=>String(text||'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/đ/g,'d').replace(/ł/g,'l').replace(/ø/g,'o').replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
export function createSearchIndex(g){
 const rows=[];
 for(const [type,records] of [['player',g.players],['club',g.clubs]])for(const entity of Object.values(records||{})){
  const aliases=[entity.name,entity.shortName,...(type==='club'?[entity.abbreviation]:[])].map(normalizeSearch).filter(Boolean);
  rows.push({id:entity.id,type,name:entity.name,aliases:[...new Set(aliases)]});
 }
 return rows;
}
export function searchWorld(index,query,{type='all',page=0,pageSize=24}={}){
 const q=normalizeSearch(query).slice(0,120),tokens=q.split(' ');
 if(!q)return {results:[],total:0,counts:{player:0,club:0},page:0,pages:0};
 const matches=[],counts={player:0,club:0};
 for(const row of index){
  const ranks=row.aliases.map(name=>name===q?0:name.startsWith(q)?1:tokens.every(token=>name.split(' ').some(word=>word.startsWith(token)))?2:name.includes(q)?3:tokens.every(token=>name.includes(token))?4:Infinity);
  const rank=Math.min(...ranks);if(!Number.isFinite(rank))continue;
  counts[row.type]++;if(type==='all'||row.type===type)matches.push({...row,rank});
 }
 matches.sort((a,b)=>a.rank-b.rank||a.name.localeCompare(b.name)||a.type.localeCompare(b.type)||String(a.id).localeCompare(String(b.id)));
 const size=Math.max(1,Math.min(100,Math.floor(pageSize)||24)),pages=Math.ceil(matches.length/size),current=Math.max(0,Math.min(Math.floor(page)||0,pages-1));
 return {results:matches.slice(current*size,(current+1)*size),total:matches.length,counts,page:current,pages};
}
