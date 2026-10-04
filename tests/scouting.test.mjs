import test from 'node:test';
import assert from 'node:assert/strict';
import {initializeStaff,assignStaffTask} from '../src/staff.mjs';
import {initializeFinancials} from '../src/financialSustainability.mjs';
import {initializeScouting,scoutingStaff,createScoutingAssignment,cancelScoutingAssignment,runScoutingWeek,validateScouting} from '../src/scouting.mjs';
import {matchesPosition} from '../src/playerPositions.mjs';

const ATTRS=['pace','stamina','strength','finishing','passing','dribbling','tackling','positioning','vision','composure','reflexes','handling','heading','crossing','teamwork','decisions'];
function career(){
 const clubs=Object.fromEntries(['home','other','third'].map((id,i)=>[id,{id,name:id,leagueId:'esp.1',reputation:80-i*5,budget:30000000,cash:80000000,wageBudget:200000}]));
 const positions=[['GK','GK'],['DF','LB'],['DF','CB'],['DF','RB'],['MF','DM'],['MF','CM'],['MF','AM'],['FW','LW'],['FW','RW'],['FW','ST']];
 const players={};
 for(const clubId of Object.keys(clubs))for(let n=0;n<30;n++){
  const [position,role]=positions[n%positions.length],id=`${clubId}-p${n}`;
  players[id]={id,clubId,name:`Player ${id}`,position,naturalPositions:[role],otherPositions:role==='RW'?['LW']:[],age:clubId==='home'?27:18+n%6,value:500000+n*10000,wage:1500+n*25,attributes:Object.fromEntries(ATTRS.map(k=>[k,12+n%3])),potential:82+n%10,injury:0,suspension:0,fitness:100,morale:80,contractUntil:2028,listed:n%4===0};
 }
 const g={id:'scout-test',clubId:'home',manager:'QA',clubs,players,date:'2026-08-15',year:2026,round:0,formation:'4-3-3',rng:456,fixtures:[],messages:[],ledger:[],transfers:[],history:[],shortlist:[],liveMatch:null};
 initializeStaff(g);initializeScouting(g);return g;
}
const scout=g=>scoutingStaff(g).find(s=>s.role==='scout');
const brief=(g,changes={})=>({kind:'position',position:'LW',maxAge:24,maxFee:3000000,maxWage:8000,scoutId:scout(g)?.id,durationWeeks:1,...changes});
const advance=(g,date)=>{g.date=date;return runScoutingWeek(g);};

test('migration creates an empty scouting log without changing personnel, assignments, money or RNG',()=>{
 const g=career();delete g.scouting;const before=structuredClone(g);
 assert.equal(validateScouting(g),true);initializeScouting(g);
 assert.deepEqual(g.scouting,{version:1,assignments:[],reports:[],lastRunDate:g.date,sequence:0});
 const cloned=structuredClone(g);delete cloned.scouting;assert.deepEqual(cloned,before);
 const initial=structuredClone(g);initializeScouting(g);assert.deepEqual(g,initial);assert.equal(validateScouting(g),true);
 assert.deepEqual(runScoutingWeek(g),[]);assert.equal(g.messages.length,0);
});

test('manager can assign a detailed position, gets a complete scout letter after elapsed week, and nothing is purchased',()=>{
 const g=career(),before=structuredClone(g),a=createScoutingAssignment(g,brief(g));
 assert.equal(a.status,'active');assert.deepEqual(advance(g,'2026-08-21'),[]);assert.equal(a.progressWeeks,0);
 const reports=advance(g,'2026-08-22');assert.equal(reports.length,1);assert.equal(a.status,'completed');assert.equal(a.progressWeeks,1);
 const r=reports[0];assert.equal(r.assignmentId,a.id);assert.equal(r.candidates.length,5);
 for(const c of r.candidates){const p=g.players[c.playerId];assert.ok(matchesPosition(p,'LW'));assert.notEqual(p.clubId,g.clubId);assert.ok(p.age<=24);assert.ok(c.feeHigh<=a.maxFee);assert.ok(c.wage<=a.maxWage);assert.ok(c.abilityLow<=c.abilityHigh);assert.ok(c.potentialLow<=c.potentialHigh);assert.ok(c.reasons.length);}
 const mail=g.messages.find(m=>m.id===r.messageId);assert.deepEqual(mail.action,{page:'scouting',label:'Mở trung tâm tuyển trạch'});assert.ok(mail.paragraphs.length>=20);assert.ok(mail.paragraphs.some(s=>s.includes(g.players[r.candidates[0].playerId].name)));assert.ok(mail.sender.includes(scout(g).name));
 for(const key of ['players','clubs','transfers','shortlist','rng','staffAssignments'])assert.deepEqual(g[key],before[key],key);
 assert.equal(validateScouting(g),true);
});

test('midweek assignment deadline is independent of routine weekly report date and survive reload',()=>{
 const g=career();g.date='2026-08-18';const a=createScoutingAssignment(g,brief(g));
 assert.deepEqual(advance(g,'2026-08-22'),[]);assert.equal(g.scouting.lastRunDate,'2026-08-22');
 const loaded=JSON.parse(JSON.stringify(g));const r=advance(loaded,'2026-08-25');assert.equal(r.length,1);assert.equal(r[0].assignmentId,a.id);assert.equal(loaded.scouting.lastRunDate,'2026-08-25');
 assert.deepEqual(runScoutingWeek(loaded),[]);assert.deepEqual(advance(loaded,'2026-08-31'),[]);assert.equal(advance(loaded,'2026-09-01').length,1);assert.equal(validateScouting(loaded),true);
});

test('zero budgets return an honest empty report and unknown broad positions do not match a detailed request',()=>{
 const g=career();for(const p of Object.values(g.players))if(p.clubId!==g.clubId){p.naturalPositions=['ST'];p.otherPositions=[];}
 g.players['other-p7'].naturalPositions=[];g.players['other-p7'].position='FW';
 createScoutingAssignment(g,brief(g));assert.equal(advance(g,'2026-08-22')[0].candidates.length,0);assert.match(g.messages[0].body,/Chưa tìm thấy/);
 g.date='2026-08-23';createScoutingAssignment(g,brief(g,{kind:'prospect',position:'ANY',maxFee:0,maxWage:0}));assert.equal(advance(g,'2026-08-30')[0].candidates.length,0);assert.equal(validateScouting(g),true);
});

test('secondary positions match and CAM / CDM aliases are stored as detailed internal positions',()=>{
 const g=career();for(const p of Object.values(g.players))if(p.clubId!==g.clubId){p.naturalPositions=['RW'];p.otherPositions=['LW'];}
 createScoutingAssignment(g,brief(g));const report=advance(g,'2026-08-22')[0];assert.equal(report.candidates.length,5);assert.ok(report.candidates.every(c=>c.reasons.some(s=>s.includes('vị trí phụ'))));
 const a=createScoutingAssignment(g,brief(g,{position:'CAM'}));assert.equal(a.position,'AM');cancelScoutingAssignment(g,a.id);
 assert.equal(createScoutingAssignment(g,brief(g,{position:'CDM'})).position,'DM');assert.equal(validateScouting(g),true);
});

test('stronger scouts and longer observations improve confidence and narrow ability and potential uncertainty',()=>{
 const observations=[];
 for(const [skill,weeks]of [[1,1],[20,1],[20,4]]){
  const g=career(),s=scout(g);s.attributes.judgingAbility=skill;s.attributes.judgingPotential=skill;
  // One matching target isolates accuracy from differing rankings.
  for(const p of Object.values(g.players))if(p.clubId!==g.clubId){p.naturalPositions=['CB'];p.otherPositions=[];}
  g.players['other-p7'].naturalPositions=['LW'];
  createScoutingAssignment(g,brief(g,{durationWeeks:weeks}));observations.push(advance(g,weeks===4?'2026-09-12':'2026-08-22')[0].candidates[0]);
 }
 assert.ok(observations.every(Boolean));assert.ok(observations[1].confidence>observations[0].confidence);assert.ok(observations[2].confidence>observations[1].confidence);
 for(const key of ['ability','potential']){const span=c=>c[`${key}High`]-c[`${key}Low`];assert.ok(span(observations[1])<span(observations[0]));assert.ok(span(observations[2])<span(observations[1]));}
});

test('routine delegated scouting respects youth criteria, elapsed days and avoids the previous report when alternatives exist',()=>{
 const g=career();const first=advance(g,'2026-08-22');assert.equal(first.length,1);assert.equal(first[0].kind,'prospect');assert.equal(first[0].assignmentId,null);assert.ok(first[0].candidates.every(c=>g.players[c.playerId].age<=23));
 assert.deepEqual(runScoutingWeek(g),[]);assert.deepEqual(advance(g,'2026-08-28'),[]);
 const second=advance(g,'2026-08-29');assert.equal(second.length,1);const old=new Set(first[0].candidates.map(c=>c.playerId));assert.ok(second[0].candidates.every(c=>!old.has(c.playerId)));
 const loaded=JSON.parse(JSON.stringify(g));assert.deepEqual(runScoutingWeek(loaded),[]);assert.equal(validateScouting(loaded),true);
});

test('manager-owned responsibility suppresses routine letters but explicit assignments still execute',()=>{
 const g=career();assignStaffTask(g,'scouting','manager');assert.deepEqual(advance(g,'2026-08-22'),[]);
 const staffId=scoutingStaff(g).find(s=>s.role==='assistant').id;createScoutingAssignment(g,brief(g,{scoutId:staffId}));
 const report=advance(g,'2026-08-29');assert.equal(report.length,1);assert.equal(report[0].scoutId,staffId);assert.equal(g.staffAssignments[g.clubId].scouting,'manager');assert.equal(validateScouting(g),true);
});

test('cancellation, missing personnel and long calendar gaps do not produce phantom or duplicate reports',()=>{
 const g=career(),a=createScoutingAssignment(g,brief(g,{durationWeeks:4}));
 cancelScoutingAssignment(g,a.id);assignStaffTask(g,'scouting','manager');assert.deepEqual(advance(g,'2026-09-20'),[]);assert.equal(a.status,'cancelled');
 const b=createScoutingAssignment(g,brief(g));delete g.staff[b.scoutId];assert.deepEqual(advance(g,'2026-09-27'),[]);assert.equal(b.status,'cancelled');assert.equal(validateScouting(g),true);
 const id=scoutingStaff(g)[0].id,c=createScoutingAssignment(g,brief(g,{scoutId:id,durationWeeks:4}));assert.equal(advance(g,'2027-01-01').length,1);assert.equal(c.progressWeeks,4);assert.equal(g.scouting.reports.length,1);assert.deepEqual(runScoutingWeek(g),[]);assert.equal(validateScouting(g),true);
});

test('assignment limits, specialist eligibility, live-match guards and malformed criteria are enforced',()=>{
 const g=career(),eligible=scoutingStaff(g);assert.equal(eligible.length,3);
 for(const changes of [{position:'FW'},{kind:'position',position:'ANY'},{maxAge:15},{maxAge:51},{maxAge:20.5},{maxFee:-1},{maxFee:Infinity},{maxWage:1e9},{durationWeeks:0},{durationWeeks:5},{scoutId:'missing'},{scoutId:Object.values(g.staff).find(s=>s.clubId==='other'&&s.role==='scout').id},{scoutId:Object.values(g.staff).find(s=>s.clubId==='home'&&s.role==='doctor').id}])assert.throws(()=>createScoutingAssignment(g,brief(g,changes)));
 const a=createScoutingAssignment(g,brief(g));assert.throws(()=>createScoutingAssignment(g,brief(g)));
 for(const s of eligible.filter(s=>s.id!==a.scoutId))createScoutingAssignment(g,brief(g,{scoutId:s.id}));assert.equal(g.scouting.assignments.length,3);assert.throws(()=>createScoutingAssignment(g,brief(g)));
 g.liveMatch={minute:1};assert.throws(()=>cancelScoutingAssignment(g,a.id));assert.throws(()=>createScoutingAssignment(g,brief(g)));assert.deepEqual(runScoutingWeek(g),[]);g.liveMatch=null;
 cancelScoutingAssignment(g,a.id);assert.throws(()=>cancelScoutingAssignment(g,a.id));assert.equal(validateScouting(g),true);
});

test('feasibility uses real negotiation refusal, payroll and financial controls without spending funds',()=>{
 const g=career();initializeFinancials(g);g.financials.clubs.home.squadBudget=1;
 createScoutingAssignment(g,brief(g));const report=advance(g,'2026-08-22')[0];assert.equal(report.candidates.length,5);assert.ok(report.candidates.every(c=>c.feasibility==='unlikely'));assert.ok(report.candidates.every(c=>c.reasons.some(s=>s.includes('giới hạn tài chính'))));assert.equal(g.financials.clubs.home.purchases,0);
});

test('recommendations prefer a viable natural winger over a similar secondary winger and unavailable stars',()=>{
 const g=career();
 for(const p of Object.values(g.players))if(p.clubId!==g.clubId){p.naturalPositions=['CB'];p.otherPositions=[];}
 const natural=g.players['other-p7'],secondary=g.players['other-p8'],unavailable=g.players['other-p17'];
 natural.naturalPositions=['LW'];natural.age=20;natural.listed=true;
 Object.assign(secondary,{naturalPositions:['RW'],otherPositions:['LW'],attributes:{...natural.attributes},potential:natural.potential,age:natural.age,listed:true});
 Object.assign(unavailable,{naturalPositions:['LW'],attributes:Object.fromEntries(ATTRS.map(k=>[k,20])),potential:100,listed:false,contractUntil:2031});g.clubs.other.reputation=90;g.clubs.other.leagueId='fra.1';
 createScoutingAssignment(g,brief(g));const candidates=advance(g,'2026-08-22')[0].candidates;
 assert.equal(candidates.length,3);assert.equal(candidates[0].playerId,natural.id);assert.equal(candidates[0].feasibility,'likely');assert.equal(candidates.at(-1).playerId,unavailable.id);assert.equal(candidates.at(-1).feasibility,'unlikely');
});

test('historical report snapshots stay valid after a player joins the managed club and survives JSON reload',()=>{
 const g=career();createScoutingAssignment(g,brief(g));const report=advance(g,'2026-08-22')[0],candidate=report.candidates[0],snapshot=structuredClone(candidate);
 g.players[candidate.playerId].clubId=g.clubId;g.players[candidate.playerId].wage*=2;assert.deepEqual(candidate,snapshot);assert.equal(validateScouting(JSON.parse(JSON.stringify(g))),true);
});

test('strict save validation rejects corrupt logs, duplicate players, invalid ranges and broken assignment references',()=>{
 const g=career();createScoutingAssignment(g,brief(g));advance(g,'2026-08-22');const bad=change=>{const copy=structuredClone(g);change(copy);assert.throws(()=>validateScouting(copy));};
 bad(g=>g.scouting=null);bad(g=>g.scouting.version=2);bad(g=>g.scouting.sequence=-1);bad(g=>g.scouting.lastRunDate='2026-02-30');bad(g=>g.scouting.lastRunDate='2099-01-01');
 bad(g=>g.scouting.assignments[0].completedDate='2026-08-16');bad(g=>g.scouting.assignments[0].maxFee=NaN);bad(g=>g.scouting.assignments[0].status='nonsense');
 bad(g=>g.scouting.reports[0].assignmentId='scout-assignment-999');bad(g=>g.scouting.reports[0].candidates[0].confidence=101);bad(g=>g.scouting.reports[0].candidates[0].feeLow=1e13);bad(g=>g.scouting.reports[0].candidates[0].abilityLow=100);bad(g=>g.scouting.reports[0].candidates[1]=structuredClone(g.scouting.reports[0].candidates[0]));bad(g=>g.scouting.reports[0].candidates[0].reasons=['']);bad(g=>g.scouting.reports[0].candidates[0].playerId='not-found');
});

test('many seasons of assignments retain bounded logs and all surviving report references',()=>{
 const g=career();assignStaffTask(g,'scouting','manager');
 for(let n=0;n<130;n++){createScoutingAssignment(g,brief(g));g.date=new Date(Date.parse(`${g.date}T12:00:00Z`)+7*86400000).toISOString().slice(0,10);runScoutingWeek(g);}
 assert.equal(g.scouting.reports.length,80);assert.equal(g.scouting.assignments.length,120);assert.equal(validateScouting(g),true);
});
