/** Import the reviewed UEFA page observations, never infer home-grown from List A. */
import fs from 'node:fs/promises';
import {normalizeIdentity as norm} from './player-reality-data.mjs';
const db=JSON.parse(await fs.readFile(new URL('../public/data/database.json',import.meta.url))),index=JSON.parse(await fs.readFile(new URL('../public/data/homegrown.json',import.meta.url)));
const docs=JSON.parse(await fs.readFile(new URL('../docs/data/uefa-squads-2026-10-05.json',import.meta.url)));
// Reviewed identity mapping between UEFA club IDs and the roster provider.
const clubs={50129:'e887',52280:'e359',52683:'e362',50124:'e1068',52758:'e124',50080:'e83',50037:'e132',59333:'e2980',50043:'e570',79946:'e2572',52692:'e436',52749:'e142',50067:'e432',50138:'e110',63405:'e4411',2603790:'e11420',52277:'e175',75797:'e166',7889:'e364',52919:'e382',52682:'e360',50136:'e114',52747:'e160',50064:'e437',50062:'e148',52265:'e244',50051:'e86',50137:'e104',52797:'e521',2609356:'e21922',52707:'e493',52498:'e494',50149:'e2250',50107:'e134',52319:'e510',70691:'e102'};
const unmatched=[];let matched=0,listB=0;
// Display-name differences verified on the UEFA player pages, including DOB.
const aliases={'250131901':{id:'e236322',birthDate:'1997-12-19'},'250162325':{name:'Kim Min-Jae',birthDate:'1996-11-15'}};
const associations={ENG:'EN',GER:'DE',ESP:'ES',ITA:'IT',FRA:'FR',POR:'PT',NED:'NL',GRE:'GR',NOR:'NO',BEL:'BE',TUR:'TR',AUT:'AT',SVK:'SK',AZE:'AZ',UKR:'UA',CZE:'CZ'};
index.meta.uefaClubs=[];
for(const d of docs){
 const uefaClubId=d.source.match(/\/clubs\/(\d+)/)?.[1],clubId=clubs[uefaClubId];
 if(!db.clubs.some(c=>c.id===clubId))throw Error('Unmapped UEFA club '+d.clubName);
 index.meta.uefaClubs.push({clubId,uefaClubId,association:associations[d.association]||(clubId==='e359'?'EN':null),competitionId:d.competitionId,season:d.season,source:d.source,observedAt:d.observedAt,total:d.players.length});
 for(const s of d.players){
  const alias=aliases[s.uefaId];
  const hits=db.players.filter(p=>p.clubId===clubId&&(norm(p.name)===norm(s.name)||alias&&p.birthDate===alias.birthDate&&(p.id===alias.id||p.name===alias.name)));
  if(hits.length!==1){unmatched.push({clubId,club:d.clubName,...s});continue;}
  const p=hits[0],row=index.players[p.id]||{id:p.id,name:p.name,birthDate:p.birthDate};
  row.asOf=[row.asOf||'',d.observedAt].sort().at(-1);
  row.uefaSquads=[...(row.uefaSquads||[]).filter(x=>x.season!==d.season||x.clubId!==clubId),{clubId,competitionId:d.competitionId,season:d.season,list:s.list,source:d.source,observedAt:d.observedAt,uefaId:s.uefaId,sourcePlayerName:s.name,profileUrl:s.profileUrl,matchEvidence:alias?'Reviewed UEFA profile display name, DOB and current club':'Unique exact normalized full/display name within the same reviewed club'}];
  index.players[p.id]=row;matched++;if(s.list==='B')listB++;
 }
}
index.meta.uefaMatched=matched;index.meta.uefaListB=listB;index.meta.uefaUnmatched=unmatched.length;
await fs.writeFile(new URL('../public/data/homegrown.json',import.meta.url),JSON.stringify(index,null,2)+'\n');
await fs.writeFile(new URL('../.cache/uefa-homegrown-unmatched.json',import.meta.url),JSON.stringify(unmatched,null,2));
console.log(JSON.stringify({clubs:docs.length,matched,listB,unmatched:unmatched.length}));
