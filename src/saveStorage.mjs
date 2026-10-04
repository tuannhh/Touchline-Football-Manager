import {copyFile,lstat,readFile,rename,unlink,writeFile} from 'node:fs/promises';
import path from 'node:path';

export const DELETED_SAVE_MESSAGE='Bản lưu này đã bị xóa. Hãy dùng Lưu thành bản mới để tiếp tục.';
const failure=(message,status=400)=>Object.assign(Error(message),{status});

export function saveStoragePaths(directory,id){
 if(typeof id!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(id))throw failure('Mã bản lưu không hợp lệ.');
 const file=path.join(directory,id+'.json');
 return {file,backup:file+'.bak',temp:file+'.tmp',deleted:path.join(directory,id+'.deleted')};
}

// Never follow a symbolic link supplied in place of a save or its backup.
async function regularFile(file){
 let info;try{info=await lstat(file);}catch(error){if(error.code==='ENOENT')return null;throw error;}
 if(!info.isFile()||info.isSymbolicLink())throw failure('Không thể thao tác bản lưu: đường dẫn không phải tệp thông thường.');
 return info;
}

export async function assertSaveWritable(directory,id){
 const files=saveStoragePaths(directory,id);
 if(await regularFile(files.deleted))throw failure(DELETED_SAVE_MESSAGE,410);
 return files;
}

/** Includes only this slot's primary, backup and interrupted-write files. */
export async function saveStorageBytes(directory,id){
 const files=saveStoragePaths(directory,id);let bytes=0;
 for(const file of [files.file,files.backup,files.temp])bytes+=(await regularFile(file))?.size||0;
 return bytes;
}

export async function readSaveSnapshot(directory,id){
 const files=await assertSaveWritable(directory,id),info=await regularFile(files.file);
 if(!info)throw failure('Không tìm thấy file lưu.',404);
 return {game:JSON.parse(await readFile(files.file,'utf8')),updatedAt:info.mtime.toISOString()};
}

/** Call inside the server's write queue, after parsing and validating the request. */
export async function writeSaveSnapshot(directory,id,serialized,{exclusive=false}={}){
 const files=await assertSaveWritable(directory,id),existing=await regularFile(files.file);
 if(exclusive&&existing)throw failure('Bản lưu này đã tồn tại; hãy lưu thành một bản mới.',409);
 await regularFile(files.backup);await regularFile(files.temp);
 if(existing)await copyFile(files.file,files.backup);
 await writeFile(files.temp,serialized,{mode:0o600});await rename(files.temp,files.file);
}

/**
 * Mark the id before removing files, so a delayed autosave cannot recreate it.
 * A retry after interruption removes any remaining files and reuses the marker.
 * No directory traversal, wildcard deletion or recursive removal is used.
 */
export async function deleteSaveSnapshot(directory,id){
 const files=saveStoragePaths(directory,id),targets=[files.file,files.backup,files.temp];
 // Refuse unexpected filesystem entries before changing any part of the slot.
 for(const file of [...targets,files.deleted])await regularFile(file);
 try{await writeFile(files.deleted,JSON.stringify({deletedAt:new Date().toISOString()}),{flag:'wx',mode:0o600});}
 catch(error){if(error.code!=='EEXIST')throw error;await regularFile(files.deleted);}
 let freedBytes=0;
 for(const file of targets){const info=await regularFile(file);if(!info)continue;try{await unlink(file);freedBytes+=info.size;}catch(error){if(error.code!=='ENOENT')throw error;}}
 return {ok:true,deletedId:id,freedBytes};
}
