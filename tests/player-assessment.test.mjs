import test from 'node:test';
import assert from 'node:assert/strict';
import {assessPlayer,applyAbilityAssessment,validatePlayerAssessments} from '../src/playerAssessment.mjs';
import {ABILITY_MODEL,abilityWeights,playerAbility,adjustAbility} from '../src/playerAbility.mjs';
import {ASSESSMENT_EVIDENCE} from '../src/data/ability-evidence.mjs';

const raw={id:'generic-review-player',name:'William Saliba',position:'DF',naturalPositions:['CB'],birthDate:'2001-03-24',age:25};
const club={id:'test-club',name:'Test Club',reputation:85};
const attrs=n=>Object.fromEntries(['pace','stamina','strength','finishing','passing','dribbling','tackling','positioning','vision','composure','reflexes','handling','heading','crossing','teamwork','decisions'].map(key=>[key,n]));
const observation=patch=>({playerId:raw.id,observedAt:'2026-10-05T00:00:00Z',sourceUrl:'https://www.fotmob.com/players/1',...patch});
const source=patch=>({...raw,realWorld:observation(patch)});

test('stable identity and birth date govern reviewed anchors, never a famous name alone',()=>{
 const known=ASSESSMENT_EVIDENCE.players.e277385,p={...raw,id:known.playerId,birthDate:known.birthDate};
 assert.equal(assessPlayer(p,club).target,known.target);
 const namesake=assessPlayer(raw,club);assert.equal(namesake.basis,'limited_estimate');assert.ok(namesake.target<known.target);
 const wrongBirth=assessPlayer({...p,birthDate:'1995-01-01'},club);assert.equal(wrongBirth.basis,'limited_estimate');
 const wrongObservation=assessPlayer({...raw,realWorld:{...observation({marketValue:{eur:2e8}}),playerId:'different-id'}},club);assert.deepEqual(wrongObservation,namesake);
});

test('unknown players with equivalent evidence retain the same ability, low confidence and separate potential',()=>{
 const a=applyAbilityAssessment({...raw},raw,club),b=applyAbilityAssessment({...raw,id:'other-unobserved-id'},{...raw,id:'other-unobserved-id',name:'Other Player'},club);
 assert.equal(a.abilityAssessment.basis,'limited_estimate');assert.equal(a.abilityAssessment.confidence,'low');assert.equal(playerAbility(a),playerAbility(b));assert.equal(playerAbility(a),a.abilityAssessment.target);
 const young=assessPlayer({...raw,age:19},club);assert.ok(young.potential>young.target);assert.ok(young.target<assessPlayer(raw,club).target);
 assert.deepEqual(applyAbilityAssessment({...raw},raw,club),a);
 const injuredOnly=assessPlayer(source({availability:{status:'injured'}}),club);assert.equal(injuredOnly.basis,'limited_estimate');assert.equal(injuredOnly.target,assessPlayer(raw,club).target);
});

test('detailed winger ability ignores heading while centre-back ability responds to defending',()=>{
 const winger={...raw,position:'FW',naturalPositions:['RW'],abilityModel:ABILITY_MODEL,attributes:attrs(17)};
 const before=playerAbility(winger);winger.attributes.heading=1;assert.equal(playerAbility(winger),before);assert.equal(abilityWeights(winger).heading,undefined);
 const defender={...raw,abilityModel:ABILITY_MODEL,attributes:attrs(17)},old=playerAbility(defender);defender.attributes.positioning=9;assert.ok(playerAbility(defender)<old-5);
 const legacy={...winger};delete legacy.abilityModel;assert.ok(playerAbility(legacy)<before,'legacy saves retain their historical broad-position formula');
 for(const role of ['GK','CB','RB','LB','DM','CM','AM','RW','LW','ST']){
  const p={...raw,position:role==='GK'?'GK':raw.position,naturalPositions:[role],abilityModel:ABILITY_MODEL,attributes:attrs(12)};
  for(const target of [45,75,89,94,98]){const actual=adjustAbility(p,target);assert.equal(actual,target,`${role} ${target}`);assert.ok(Object.values(p.attributes).every(n=>Number.isInteger(n)&&n>=1&&n<=20));}
 }
});

test('small samples are shrunk and duplicate or future season rows do not manufacture confidence',()=>{
 const row={season:'2026/27',competitionId:'league',rating:9,minutes:90};
 const small=assessPlayer(source({performance:row}),club),large=assessPlayer(source({performance:{...row,minutes:2500}}),club);
 assert.ok(large.target>small.target);assert.ok(small.target-assessPlayer(raw,club).target<=1);
 const duplicate=assessPlayer(source({performance:row,performanceHistory:[row,row,{...row,season:'2030/31',minutes:3000}]}),club);
 assert.deepEqual(duplicate.components,small.components);assert.equal(duplicate.target,small.target);
 const mixed=assessPlayer(source({performance:row,performanceHistory:[{...row,season:'2026/2027',minutes:2500},{...row,season:'2025',minutes:1800},{...row,season:'2025/26',minutes:1800}]}),club);
 assert.equal(mixed.components.historySeasons,2);assert.equal(validatePlayerAssessments({players:{x:{abilityModel:ABILITY_MODEL,abilityAssessment:mixed}}}),true);
 const sustained=assessPlayer(source({performance:{...row,rating:6,minutes:60},performanceHistory:[{...row,season:'2025/26',rating:8,minutes:2800}]}),club);
 assert.ok(sustained.components.performance>7.5);assert.equal(sustained.components.historySeasons,2);
});

test('assessment provenance never predates evidence used and explicit historical cutoffs reject future observations',()=>{
 const known=ASSESSMENT_EVIDENCE.players.e277385,p={...raw,id:known.playerId,birthDate:known.birthDate,realWorld:{...observation({marketValue:{eur:120e6}}),playerId:known.playerId,observedAt:'2026-10-02T12:00:00Z'}};
 assert.ok(assessPlayer(p,club).asOf>=known.reviewedAt);
 const future=source({observedAt:'2027-01-01T00:00:00Z',marketValue:{eur:200e6},performance:{season:'2026/27',rating:9,minutes:2500}});
 const historical=assessPlayer(future,club,{asOf:'2026-10-05'});assert.equal(historical.components.market,null);assert.equal(historical.basis,'limited_estimate');
});

test('assessment save validation rejects impossible dates, malformed source metadata and contradictory ratings',()=>{
 const p=applyAbilityAssessment({...raw},raw,club),g={players:{[raw.id]:p}};assert.equal(validatePlayerAssessments(g),true);
 for(const change of [
  a=>{a.asOf='2026-02-31';},a=>{a.asOf='2026-10-05junk';},a=>{a.target=0;},a=>{a.potential=a.target-1;},a=>{a.influence=Infinity;},
  a=>{a.sourceUrls=['https://'];},a=>{a.components={...a.components,performance:Infinity};},a=>{a.evidence=[{url:'javascript:alert(1)',fact:'untrusted',title:'untrusted'}];},
 ]){const copy=structuredClone(g);change(copy.players[raw.id].abilityAssessment);assert.throws(()=>validatePlayerAssessments(copy),change.toString());}
});

