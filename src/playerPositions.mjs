import {POSITION_DETAIL,broadPosition} from './tactics.mjs';

const GROUPS={GK:'Thủ môn',DF:'Hậu vệ',MF:'Tiền vệ',FW:'Tiền đạo'};
const internalCode=role=>({CAM:'AM',CDM:'DM'})[role]||role;
export const positionCode=role=>({AM:'CAM',DM:'CDM'})[role]||role;
const uniqueRoles=roles=>[...new Set((Array.isArray(roles)?roles:[]).map(internalCode).filter(role=>Object.hasOwn(POSITION_DETAIL,role)))];
export const naturalRoles=p=>uniqueRoles(p?.naturalPositions);
export const secondaryRoles=p=>uniqueRoles(p?.otherPositions).filter(role=>!naturalRoles(p).includes(role));
export const detailedPositionOptions=Object.entries(POSITION_DETAIL).map(([role,name])=>[role,`${positionCode(role)} · ${name}`]);

// Presentation only: keep the original groups and tactical role IDs in saves.
export function positionLabel(p){
 const natural=naturalRoles(p);
 if(natural.length)return natural.map(positionCode).join(' / ');
 if(p?.position==='GK')return 'GK';
 return p?.positionKnown===false||!GROUPS[p?.position]?'Chưa rõ':`${p.position} · Chưa rõ chi tiết`;
}
export function positionDescription(p){
 const natural=naturalRoles(p),secondary=secondaryRoles(p);
 const describe=roles=>roles.map(role=>`${positionCode(role)} · ${POSITION_DETAIL[role]}`).join(', ');
 const main=natural.length?`Sở trường: ${describe(natural)}`:p?.position==='GK'?'GK · Thủ môn':`${GROUPS[p?.position]||'Vị trí'} · Chưa có nguồn cho vị trí chi tiết`;
 return main+(secondary.length?` · Vị trí phụ: ${describe(secondary)}`:'');
}
export function matchesPosition(p,filter){
 if(!filter)return true;
 const roles=[...naturalRoles(p),...secondaryRoles(p)],role=internalCode(filter);
 if(['DF','MF','FW'].includes(role))return p.position===role||roles.some(r=>broadPosition(r)===role);
 return roles.includes(role)||(role==='GK'&&p.position==='GK');
}
