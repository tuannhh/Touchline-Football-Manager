// Save slots identify snapshots. Changing a slot never regenerates a career.
const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9-]{1,100}$/.test(id);
const validTime=value=>typeof value==='string'&&value.length<=40&&Number.isFinite(Date.parse(value));

export function normalizeSlotName(name){
 if(typeof name!=='string')throw Error('Hãy nhập tên bản lưu.');
 const value=name.replace(/\s+/g,' ').trim();
 if(!value||value.length>80||/[\u0000-\u001f\u007f]/.test(value))throw Error('Tên bản lưu cần từ 1 đến 80 ký tự.');
 return value;
}

/** Legacy saves may have neither field. Validation does not mutate the save. */
export function validateSaveMetadata(g){
 if(g.simulationId!==undefined&&!validId(g.simulationId))throw Error('Mã mô phỏng của sự nghiệp không hợp lệ.');
 if(g.saveName!==undefined&&normalizeSlotName(g.saveName)!==g.saveName)throw Error('Tên bản lưu không hợp lệ.');
 if(g.saveSlot!==undefined){const slot=g.saveSlot;if(!slot||typeof slot!=='object'||Array.isArray(slot)||!validTime(slot.createdAt)||slot.parentId!==undefined&&!validId(slot.parentId)||Object.keys(slot).some(key=>!['createdAt','parentId'].includes(key)))throw Error('Thông tin bản lưu không hợp lệ.');}
 return true;
}

/** id/now are supplied by the caller so cloning never consumes the game's RNG. */
export function cloneAsSlot(g,name,{id,now}={}){
 if(!g||!validId(g.id)||!validId(id)||id===g.id)throw Error('Bản lưu mới cần một mã riêng hợp lệ.');
 if(!validTime(now))throw Error('Thời điểm lưu không hợp lệ.');
 const copy=structuredClone(g);copy.simulationId=g.simulationId||g.id;copy.id=id;copy.saveName=normalizeSlotName(name);copy.saveSlot={createdAt:now,parentId:g.id};return copy;
}

export function saveSummary(g,updatedAt){
 const metadata=g.dbMeta||{},release=g.dbRelease||g.rosterRelease||g.databaseRelease||metadata.rosterRelease||metadata.release||{};
 const club=typeof g.club==='string'?g.club:g.clubs?.[g.clubId]?.name||'CLB chưa rõ';
 const dbReleaseId=g.dbReleaseId||g.rosterReleaseId||metadata.releaseId||(typeof release==='string'?release:release.id)||'';
 const dbReleaseLabel=g.dbReleaseLabel||metadata.releaseLabel||(typeof release==='object'&&release.label)||'';
 const year=Number.isInteger(g.year)?g.year:null;
 return {id:g.id,name:g.saveName||g.name||g.slotName||`${club} · ${g.manager||'HLV'}`,club,manager:g.manager||'HLV',date:g.date||'',year,round:Number.isInteger(g.round)?g.round:0,season:g.season||(year?`${year}/${String(year+1).slice(-2)}`:''),updatedAt:updatedAt||g.updatedAt||'',dbReleaseId,dbReleaseLabel,dbAsOf:g.dbAsOf||(typeof release==='object'&&release.asOf)||metadata.asOf||metadata.expandedAt||metadata.importedAt||'',dbSeason:g.dbSeason||(typeof release==='object'&&release.season)||metadata.season||'',liveMinute:Number.isInteger(g.liveMinute)?g.liveMinute:Number.isInteger(g.liveMatch?.minute)?g.liveMatch.minute:null,liveCompleted:g.liveCompleted??g.liveMatch?.completed??false};
}

const searchText=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('vi').replaceAll('đ','d');
export function filterSortSaves(saves,{query='',sort='updated'}={}){
 const needle=searchText(query).trim();
 const rows=saves.map(save=>saveSummary(save,save.updatedAt)).filter(s=>!needle||searchText([s.name,s.club,s.manager,s.date,s.season,s.dbReleaseLabel,s.dbReleaseId].join(' ')).includes(needle));
 const textOrder=(a,b)=>a.localeCompare(b,'vi',{numeric:true,sensitivity:'base'});
 const time=value=>{const parsed=Date.parse(value);return Number.isFinite(parsed)?parsed:0;};
 return rows.sort((a,b)=>{const result=sort==='name'?textOrder(a.name,b.name):sort==='club'?textOrder(a.club,b.club)||textOrder(a.name,b.name):sort==='date'?textOrder(b.date,a.date):time(b.updatedAt)-time(a.updatedAt);return result||textOrder(a.id,b.id);});
}
