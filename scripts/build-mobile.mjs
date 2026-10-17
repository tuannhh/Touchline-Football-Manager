import {spawnSync} from 'node:child_process';
import {readFile,writeFile,rm,readdir,stat} from 'node:fs/promises';
import {listRosterReleases} from '../src/rosterReleases.mjs';
const run=(cmd,args)=>{const r=spawnSync(cmd,args,{stdio:'inherit',env:{...process.env,VITE_OFFLINE_APP:'true'}});if(r.status!==0)process.exit(r.status||1);};
run('npx',['vite','build','--outDir','dist-mobile']);
await writeFile('dist-mobile/data/mobile-releases.json',JSON.stringify(await listRosterReleases()));
// The old AI atlas is unused; real photographs remain byte-for-byte intact.
await rm('dist-mobile/portraits/ai-atlas.png',{force:true});
const config=JSON.parse(await readFile('capacitor.config.json','utf8'));
if(config.server?.url)throw Error('Offline APK must not point to a remote server');
run('npx',['cap','sync','android']);
let bytes=0,files=0;async function visit(dir){for(const name of await readdir(dir)){const path=dir+'/'+name,s=await stat(path);if(s.isDirectory())await visit(path);else{bytes+=s.size;files++;}}}await visit('dist-mobile');
console.log(JSON.stringify({offline:true,files,megabytes:Math.round(bytes/1048576)}));
