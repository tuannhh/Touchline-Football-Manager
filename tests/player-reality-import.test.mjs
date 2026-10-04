import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {verifiedProfileIdentity,normalizeVerifiedProfileFacts,normalizePerformanceHistory,normalizeMarketHistory,sourceGameClubId} from '../scripts/player-reality-data.mjs';
import {ASSESSMENT_EVIDENCE} from '../src/data/ability-evidence.mjs';

test('cross-provider mapping requires the exact provider ID and birth date as well as name',()=>{
  const player={name:'Mohamed Salah',birthDate:'1992-06-15'},profile={id:292462,name:'Mohamed Salah',birthDate:{utcTime:'1992-06-15T00:00:00Z'}};
  assert.equal(verifiedProfileIdentity(player,profile,292462),true);
  assert.equal(verifiedProfileIdentity({...player,birthDate:'2004-01-01'},profile,292462),false);
  assert.equal(verifiedProfileIdentity({...player,name:'Mohamed Salah El Boukammiri'},profile,292462),false);
  assert.equal(verifiedProfileIdentity(player,profile,999),false);
});

test('missing position and foot facts use verified identity and observed secondary positions',()=>{
  const player={name:'Mohamed Salah',birthDate:'1992-06-15'};
  const position=(label,isMainPosition,occurences)=>({strPosShort:{label},isMainPosition,occurences});
  const profile={id:292462,name:'Mohamed Salah',birthDate:{utcTime:'1992-06-15T00:00:00Z'},positionDescription:{positions:[position('RW',true,29),position('AM',false,6),position('ST',false,12),position('LB',false,1),position('invalid',true,20)]},playerInformation:[{translationKey:'preferred_foot',value:{key:'left'}}]};
  const options={expectedId:292462,observedAt:'2026-10-04T22:32:06.904Z'};
  assert.deepEqual(normalizeVerifiedProfileFacts(player,profile,options),{naturalPositions:['RW'],otherPositions:['AM','ST'],preferredFoot:'left',sourceUrl:'https://www.fotmob.com/players/292462',observedAt:options.observedAt});
  assert.equal(normalizeVerifiedProfileFacts({...player,birthDate:'2004-01-01'},profile,options),null);
  assert.equal(normalizeVerifiedProfileFacts(player,profile,{...options,expectedId:123}),null);
});

test('history separates teams/competitions, preserves source dates, and never invents minutes',()=>{
  const row=(seasonName,teamId,leagueId,extra={})=>({seasonName,teamId,team:'Example',tournamentStats:[{leagueId,leagueName:'League',appearances:'20',goals:'0',assists:'undefined',rating:{rating:'7.2'},...extra}]});
  const profile={primaryTeam:{teamId:2},mainLeague:{season:'2026/2027',leagueId:47,stats:[{localizedTitleId:'minutes_played',value:169},{localizedTitleId:'started',value:2}]},careerHistory:{careerItems:{senior:{seasonEntries:[row('2026/2027',2,47),row('2025/2026',1,47),row('2025/2026',2,47),row('2025/2026',2,47),row('2025/2026',2,42),row('2023/2024',2,47),row('2027/2028',2,47),row('2026/2027',2,114,{isFriendly:true}),row('2026/2027',2,55,{appearances:'undefined'})]},'national team':{seasonEntries:[row('2026',555,77)]}}}};
  const rows=normalizePerformanceHistory(profile,{asOf:'2026-10-05',observedAt:'2026-10-02'});
  assert.equal(rows.length,4);
  assert.equal(rows[0].minutes,169);assert.equal(rows[0].starts,2);
  assert.ok(rows.slice(1).every(row=>row.minutes===null&&row.starts===null));
  assert.ok(rows.every(row=>row.observedAt==='2026-10-02'&&row.goals===0&&row.assists===null));
  assert.deepEqual(rows.filter(row=>row.competitionId==='47'&&row.season==='2025/2026').map(row=>row.sourceClubId),[1,2]);
});

test('market history excludes future/invalid values, preserves provider estimates and bounds storage',()=>{
  const rows=Array.from({length:10},(_,i)=>({date:`2026-${String(i+1).padStart(2,'0')}-01`,value:10_000_000+i,currency:'EUR',source:'scisports'}));
  rows.push({date:'2026-09-02',value:-10,currency:'EUR'},{date:'2026-09-03',value:500,currency:'USD'});
  const history=normalizeMarketHistory(rows,'2026-09-30');
  assert.equal(history.length,6);assert.equal(history.at(-1).asOf,'2026-09-01');
  assert.equal(history[0].asOf,'2026-04-01');assert.equal(history[0].kind,'provider_estimate');
});

test('club cross-provider matching does not silently assign an ambiguous or former club',()=>{
  const clubs=[{id:'e1',name:'Arsenal'},{id:'e2',name:'Trabzonspor'},{id:'f25',name:'Distinct'},{id:'e3',name:'United'},{id:'e4',name:'United'}];
  assert.equal(sourceGameClubId(clubs,9752,'Trabzonspor'),'e2');
  assert.equal(sourceGameClubId(clubs,25,'Different provider spelling'),'f25');
  assert.equal(sourceGameClubId(clubs,99,'United'),null);
  assert.equal(sourceGameClubId(clubs,99,'Unknown'),null);
});

test('reviewed ability evidence remains dated, identity-safe and explicitly estimated',()=>{
  const db=JSON.parse(fs.readFileSync(new URL('../public/data/database.json',import.meta.url),'utf8'));
  assert.equal(ASSESSMENT_EVIDENCE.kind,'editorial_game_estimate');
  assert.ok(Object.keys(ASSESSMENT_EVIDENCE.players).length>=30);
  for(const [id,anchor] of Object.entries(ASSESSMENT_EVIDENCE.players)){
    const player=db.players.find(player=>player.id===id);
    assert.equal(anchor.playerId,id);assert.equal(anchor.birthDate,player.birthDate);assert.equal(anchor.name,player.name);
    assert.ok(anchor.target<=anchor.potential&&anchor.potential<=99);
    assert.ok(anchor.evidence.length&&anchor.evidence.every(source=>source.url.startsWith('https://')&&source.observedAt<=ASSESSMENT_EVIDENCE.asOf));
    assert.ok(anchor.evidence.every(source=>!source.publishedAt||source.publishedAt<=ASSESSMENT_EVIDENCE.asOf));
  }
  const p=ASSESSMENT_EVIDENCE.players;
  assert.ok(p.e277385.target>p.e328497.target);assert.ok(p.e362150.target>p.e173896.target);
});
