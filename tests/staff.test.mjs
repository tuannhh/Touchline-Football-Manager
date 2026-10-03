import test from 'node:test';
import assert from 'node:assert/strict';
import {STAFF_ROLES,STAFF_SKILLS,STAFF_TASKS,initializeStaff,staffMembers,eligibleStaff,assignedStaff,assignStaffTask,workload,staffTaskQuality,staffEffects,staffWeeklyWages,validateStaff,runStaffWeek,handlePress} from '../src/staff.mjs';

function legacy(){
 const clubs={e83:{id:'e83',name:'Barcelona',leagueId:'esp.1',reputation:90,budget:10000000,cash:20000000},e359:{id:'e359',name:'Arsenal',leagueId:'eng.1',reputation:88,budget:20000000,cash:40000000},testclub:{id:'testclub',name:'Test United',leagueId:'eng.3',reputation:51,budget:1000000,cash:2000000}};
 const players={};for(const [clubId,club]of Object.entries(clubs))for(let i=0;i<7;i++){const id=`${clubId}-p${i}`;players[id]={id,clubId,name:`${club.name} Player ${i}`,position:i===0?'GK':i<3?'DF':i<5?'MF':'FW',age:18+i,value:500000+i*100000,attributes:{passing:12,finishing:10,stamina:14},potential:75+i,injury:i===6?2:0,fitness:i===5?65:100,morale:80};}
 return {id:'staff-test',clubId:'e83',manager:'Staff QA',clubs,players,rng:41451,date:'2026-08-15',year:2026,round:0,fixtures:[],messages:[],ledger:[],transfers:[],history:[],lineup:Object.keys(players).slice(0,7),liveMatch:null};
}
const fresh=()=>initializeStaff(legacy());
const assistant=g=>staffMembers(g).find(s=>s.role==='assistant');

test('deterministic staffing covers ten roles for every club and preserves existing gameplay',()=>{
 const g=legacy(),before=structuredClone(g);assert.equal(validateStaff(g),true);initializeStaff(g);
 assert.equal(Object.keys(STAFF_ROLES).length,10);assert.equal(Object.keys(STAFF_TASKS).length,10);
 for(const club of Object.values(g.clubs)){const people=staffMembers(g,club.id);assert.equal(new Set(people.map(s=>s.role)).size,10);assert.ok(people.length>=10);assert.equal(g.staffAssignments[club.id].friendlies,'manager');assert.equal(g.staffAssignments[club.id].press,'manager');}
 for(const [key,value]of Object.entries(before))assert.deepEqual(g[key],value,key);
 assert.deepEqual(g.staff,fresh().staff);assert.ok(staffMembers(g).some(s=>s.sourceKind==='official'));assert.ok(staffMembers(g,'testclub').every(s=>s.sourceKind==='simulated'));
 assert.equal(validateStaff(g),true);
});

test('repeated initialization and save reload preserve custom skill, pay, assignments and match RNG',()=>{
 const g=fresh(),s=assistant(g);s.wage=1234;s.attributes.communication=20;assignStaffTask(g,'press',s.id);g.liveMatch={minute:37,rng:9021};
 const before=structuredClone(g);initializeStaff(g);assert.deepEqual(g,before);
 const loaded=JSON.parse(JSON.stringify(g));initializeStaff(loaded);assert.deepEqual(loaded,g);assert.equal(staffWeeklyWages(g),staffMembers(g).reduce((sum,s)=>sum+s.wage,0));
});

test('responsibilities reject foreign personnel, unsuitable specialists, other clubs and live match edits',()=>{
 const g=fresh(),s=assistant(g),cash=g.clubs[g.clubId].cash,rng=g.rng;
 assert.ok(eligibleStaff(g,'friendlies').some(p=>p.id===s.id));assignStaffTask(g,'friendlies',s.id);assignStaffTask(g,'press',s.id);assert.equal(assignedStaff(g,'press'),s);
 assert.throws(()=>assignStaffTask(g,'medical',s.id));assert.throws(()=>assignStaffTask(g,'press',staffMembers(g,'e359').find(p=>p.role==='assistant').id));assert.throws(()=>assignStaffTask(g,'press','manager','e359'));assert.throws(()=>assignStaffTask(g,'invented','manager'));
 g.liveMatch={minute:12};assert.throws(()=>assignStaffTask(g,'press','manager'));g.liveMatch=null;assignStaffTask(g,'press','manager');assert.equal(assignedStaff(g,'press'),null);assert.equal(g.clubs[g.clubId].cash,cash);assert.equal(g.rng,rng);
});

test('overloading reduces the same person’s effective expertise while all effects stay bounded',()=>{
 const g=fresh(),s=assistant(g);for(const key of Object.keys(STAFF_SKILLS))s.attributes[key]=20;
 for(const task of ['training','friendlies','press'])assignStaffTask(g,task,s.id);assert.equal(workload(g,s.id).count,3);assert.equal(staffTaskQuality(g,'training'),1);
 assignStaffTask(g,'youth',s.id);assert.equal(workload(g,s.id).overloaded,true);assert.equal(workload(g,s.id).penalty,.15);assert.equal(staffTaskQuality(g,'training'),.85);
 const effects=staffEffects(g);for(const key of ['trainingMultiplier','goalkeepingMultiplier','fitnessMultiplier','youthMultiplier'])assert.ok(effects[key]>=.8&&effects[key]<=1.2+Number.EPSILON);assert.ok(effects.recoveryBonus>=0&&effects.recoveryBonus<=3);assert.ok(effects.medicalRecoveryChance>=0&&effects.medicalRecoveryChance<=.15);assert.ok(effects.transferDiscount>=0&&effects.transferDiscount<=.06);
 for(const task of Object.keys(STAFF_TASKS))assignStaffTask(g,task,'manager');const manager=staffEffects(g);assert.equal(manager.trainingMultiplier,1);assert.equal(manager.recoveryBonus,0);assert.equal(manager.medicalRecoveryChance,0);assert.equal(manager.transferDiscount,0);
});

test('weekly reports contain linked recommendations, medical details and youth advice without transactions',()=>{
 const g=fresh(),before=structuredClone(g),reports=runStaffWeek(g);assert.equal(reports.length,3);assert.deepEqual(g.players,before.players);assert.deepEqual(g.clubs,before.clubs);assert.deepEqual(g.transfers,[]);assert.equal(g.rng,before.rng);
 const scouting=reports.find(r=>r.type==='scouting');assert.equal(scouting.playerIds.length,3);assert.ok(scouting.playerIds.every(id=>g.players[id].clubId!==g.clubId));
 for(const report of reports){const mail=g.messages.find(m=>m.id===report.messageId);assert.ok(mail.paragraphs.length>=5);assert.match(mail.sender,/ · /);assert.ok(report.playerIds.every(id=>g.players[id]));}
 assert.deepEqual(runStaffWeek(g),[]);g.date='2026-08-22';assert.equal(runStaffWeek(g).length,3);assert.equal(validateStaff(g),true);
});

test('delegated press uses the actual speaker and grants bounded morale change only once per match',()=>{
 const g=fresh(),s=assistant(g);assignStaffTask(g,'press',s.id);for(const key of Object.keys(STAFF_SKILLS))s.attributes[key]=20;
 const f={id:'league-match-1',home:g.clubId,away:'e359',result:{score:[0,1]}};g.fixtures.push(f);const rng=g.rng;
 const result=handlePress(g,{fixture:f,tone:'encourage'});assert.equal(result.staffId,s.id);assert.equal(result.moraleChange,2);assert.ok(g.messages[0].paragraphs.some(p=>p.includes(s.name)));assert.equal(g.players['e83-p1'].morale,82);assert.equal(g.players['e359-p1'].morale,80);assert.equal(g.rng,rng);
 assert.deepEqual(handlePress(g,{fixture:f,tone:'demanding'}),result);assert.equal(g.players['e83-p1'].morale,82);assert.equal(g.messages.length,1);
 // Fixture marker keeps old results protected even after the rolling history expires.
 g.pressHistory=[];assert.equal(handlePress(g,{fixture:f,tone:'encourage'}),null);assert.equal(g.players['e83-p1'].morale,82);assert.equal(validateStaff(g),true);
});

test('press rejects unplayed, invented or unrelated fixtures and invalid tones',()=>{
 const g=fresh(),f={id:'pending',home:g.clubId,away:'e359',result:null};g.fixtures.push(f);
 assert.throws(()=>handlePress(g,{fixture:f}));assert.throws(()=>handlePress(g,{fixture:f,result:{completed:true,score:[2,1]}}));assert.throws(()=>handlePress(g,{fixture:{...f,id:'fake'},result:{completed:true,score:[2,1]}}));assert.throws(()=>handlePress(g,{fixture:f,tone:'hostile'}));
 g.fixtures.push({id:'other',home:'e359',away:'testclub',result:{score:[2,1]}});assert.throws(()=>handlePress(g,{fixture:g.fixtures[1]}));assert.equal(g.players['e83-p1'].morale,80);
});

test('save validation rejects corrupt skills, cross-club assignments, malformed friendly dates and cancelled live games',()=>{
 const original=fresh(),bad=change=>{const g=structuredClone(original);change(g);assert.throws(()=>validateStaff(g));};
 bad(g=>{assistant(g).attributes.coaching=21;});bad(g=>{assistant(g).wage=-1;});bad(g=>{g.staffAssignments.e83.press=staffMembers(g,'e359').find(s=>s.role==='assistant').id;});bad(g=>{g.staffAssignments.e83.medical=assistant(g).id;});bad(g=>{g.pressTone='nonsense';});
 const f={id:'friendly-1',home:'e83',away:'e359',leagueId:'friendly',stage:'friendly',year:2026,round:0,date:'2026-08-15',result:null};
 bad(g=>{g.friendlies.push({...f,date:'not-a-date'});});bad(g=>{g.friendlies.push({...f,cancelled:true});g.liveMatch={fixtureId:f.id,home:f.home,away:f.away,friendly:true};});bad(g=>{g.friendlies.push({...f}, {...f});});
 original.friendlies.push(f);original.liveMatch={fixtureId:f.id,home:f.home,away:f.away,friendly:true};assert.equal(validateStaff(original),true);
});
