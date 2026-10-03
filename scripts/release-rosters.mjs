#!/usr/bin/env node
import {publishRosterRelease,prepareRosterRelease,listRosterReleases,loadRosterRelease,stageRosterRefresh} from '../src/rosterReleases.mjs';

const HELP=`Touchline immutable roster releases

Publish the validated current local source files:
  node scripts/release-rosters.mjs --id roster-2026-27-20261003 \\
    --name "Đội hình 2026/27 · 03/10/2026" --season 2026/27 --as-of 2026-10-03

Candidate files (publication never overwrites public/data/database.json or saves):
  --database PATH --homegrown PATH --note TEXT
  --check                 Validate metadata, hashes and roster-loss checks without writing.
  --acknowledge-risk CODE Repeat for every exact risk returned by --check.
  --review-note TEXT      Required with risk acknowledgements; explain the reviewed loss.

Read offline:
  --list
  --verify RELEASE_ID     Verify immutable bytes against hashes and validate the snapshot.

Prepare a separate import workspace (copies scripts, data and image assets, never saves):
  --stage NEW_DIRECTORY [--season 2026/27] [--refresh] [--python python3]
  --refresh              Run the existing refresh-data.py then refresh-homegrown.py only
                         inside staging. Failure cannot write to the live database.

Source adapters currently pin 2026/27. For a later season, first review/change those
copied adapters and official source URLs in staging, then collect and publish separately.
Do not merely relabel an old roster with a new season or transfer-window date.
Snapshot asOf is the source coverage day (Asia/Ho_Chi_Minh); publishedAt is generated
separately as the actual UTC publication instant. Portrait assets remain independent.
Existing release IDs cannot be overwritten. A crashed publisher leaves a lock which
must be inspected before manual removal. There is no --force or automatic lock stealing.
`;
const options={},values={'--id':'id','--name':'name','--label':'label','--season':'season','--as-of':'asOf','--database':'databasePath','--homegrown':'homegrownPath','--note':'notes','--review-note':'reviewNote','--root':'rootDir','--stage':'stageDir','--python':'python'},modes=[];let check=false,refresh=false,verify=null,list=false;
try{
 const args=process.argv.slice(2);if(!args.length||args.includes('--help')||args.includes('-h')){console.log(HELP);process.exit(0);}
 for(let i=0;i<args.length;i++){const flag=args[i];if(values[flag]){if(!args[i+1]||args[i+1].startsWith('--'))throw Error('Missing value for '+flag);if(options[values[flag]]!==undefined)throw Error('Repeated option '+flag);options[values[flag]]=args[++i];}else if(flag==='--acknowledge-risk'){if(!args[i+1]||args[i+1].startsWith('--'))throw Error('Missing risk code.');(options.acknowledgeRisks||=[]).push(args[++i]);}else if(flag==='--check'||flag==='--dry-run')check=true;else if(flag==='--refresh')refresh=true;else if(flag==='--list')list=true;else if(flag==='--verify'){if(!args[i+1]||args[i+1].startsWith('--'))throw Error('Missing release ID.');verify=args[++i];}else throw Error('Unknown option: '+flag);}
 if(options.stageDir)modes.push('stage');if(list)modes.push('list');if(verify)modes.push('verify');if(modes.length>1)throw Error('Choose exactly one of --stage, --list, --verify.');if(refresh&&!options.stageDir)throw Error('--refresh requires --stage.');
 let result;if(options.stageDir){if(check||options.id||options.databasePath||options.homegrownPath||options.asOf)throw Error('Staging and publication are separate commands.');result=await stageRosterRefresh({...options,refresh});}
 else if(list)result=await listRosterReleases(options);
 else if(verify)result=(await loadRosterRelease(verify,options)).release;
 else if(check){const prepared=await prepareRosterRelease(options);result={ok:true,dryRun:true,release:prepared.release};}
 else result=await publishRosterRelease(options);
 console.log(JSON.stringify(result,null,2));
}catch(e){console.error(JSON.stringify({ok:false,code:e.code||'ROSTER_RELEASE_ERROR',error:e.message,...(e.risks?{risks:e.risks}:{})},null,2));process.exitCode=e.code==='ROSTER_REVIEW_REQUIRED'?2:1;}
