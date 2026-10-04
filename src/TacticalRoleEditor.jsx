import React from 'react';
import {POSITION_DETAIL,TACTICAL_PHASES,fitLabel} from './tactics.mjs';
import {rolesForPosition,playerRoleDefinition} from './playerRoles.mjs';
import {positionCode} from './playerPositions.mjs';

export default function TacticalRoleEditor({player,index,position,roleId,phase,onPosition,onRole,onReset,disabled,dualEnabled}){
 const role=playerRoleDefinition(roleId),options=rolesForPosition(position,phase);
 return <section className="tactical-role-editor" aria-label="Chỉnh vị trí và vai trò"><header><div><span className="eyebrow">VỊ TRÍ & VAI TRÒ</span><h3>{player?.name||`Vị trí ${index+1}`}</h3></div><span className="tag">{TACTICAL_PHASES[phase]}</span></header>
  <div className="tactical-role-fields"><label>Vị trí trên sân<select aria-label="Vị trí trên sân" value={position} disabled={disabled||position==='GK'} onChange={e=>onPosition(index,{position:e.target.value})}>{Object.entries(POSITION_DETAIL).filter(([p])=>position==='GK'?p==='GK':p!=='GK').map(([p,label])=><option key={p} value={p}>{positionCode(p)} · {label}</option>)}</select></label>
  <label>Vai trò cầu thủ<select aria-label="Vai trò cầu thủ" value={roleId} disabled={disabled} onChange={e=>onRole(index,e.target.value)}>{options.map(r=><option key={r.id} value={r.id} translate="no">{r.label}</option>)}</select></label></div>
  {role&&<div className="tactical-role-description"><strong translate="no">{role.label}</strong><p>{role.description}</p></div>}
  {player&&<p className="fine-print">Phù hợp vị trí: <strong>{fitLabel(player,position)}</strong>. Chỉnh trên sân không đổi vị trí sở trường trong hồ sơ.</p>}
  {!dualEnabled&&<p className="fine-print">Lần chỉnh đầu sẽ bật hai pha; pha còn lại giữ sơ đồ hiện tại.</p>}
  <button className="text-button" disabled={disabled} onClick={onReset}>Đặt lại vị trí và role của pha này</button>
 </section>;
}
