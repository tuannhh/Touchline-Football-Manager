const word=c=>!!c&&/[\p{L}\p{N}\p{M}_]/u.test(c);
/** A shared prefix tree avoids a huge regex and scans each letter of a mail only once per candidate. */
export function buildMailEntityIndex(g){
 const root=new Map();
 const add=(label,entity)=>{
  if(typeof label!=='string'||label.length<3)return;
  let node=root;for(const char of label){if(!node.has(char))node.set(char,new Map());node=node.get(char);}
  const list=node.get(null)||[];if(!list.some(e=>e.kind===entity.kind&&e.id===entity.id))list.push(entity);node.set(null,list);
 };
 for(const [kind,items] of [['player',Object.values(g.players)],['club',Object.values(g.clubs)],['competition',[...(g.leagues||[]),...(g.cups||[])]]])for(const item of items){
  const entity={kind,id:item.id,name:item.name};add(item.name,entity);
  if(item.shortName?.length>=(kind==='player'?5:4))add(item.shortName,entity);
 }
 return root;
}
function resolve(candidates,message){
 if(candidates.length===1)return candidates[0];
 const explicit=candidates.filter(e=>(message[e.kind==='player'?'playerIds':e.kind==='club'?'clubIds':'competitionIds']||[]).includes(e.id));
 return explicit.length===1?explicit[0]:null;
}
export function linkMailText(text,index,message={}){
 const chars=Array.from(String(text||'')),parts=[];let plain='';
 for(let i=0;i<chars.length;){
  let node=index,match=null;
  if(!word(chars[i-1]))for(let end=i;end<chars.length;end++){
   node=node.get(chars[end]);if(!node)break;
   if(node.has(null)&&!word(chars[end+1])){const entity=resolve(node.get(null),message);if(entity)match={entity,end:end+1};}
  }
  if(match){if(plain){parts.push({text:plain});plain='';}parts.push({text:chars.slice(i,match.end).join(''),entity:match.entity});i=match.end;}
  else plain+=chars[i++];
 }
 if(plain)parts.push({text:plain});return parts;
}
export function mailPlayerIds(message,index,g,paragraphs=[]){
 return [...new Set([...(message.playerIds||[]),...linkMailText([message.title,message.body,...paragraphs].join('\n'),index,message).filter(p=>p.entity?.kind==='player').map(p=>p.entity.id)])].filter(id=>g.players[id]);
}
