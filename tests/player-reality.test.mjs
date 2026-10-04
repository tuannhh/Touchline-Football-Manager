import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSourcePerformance,normalizeSourceAvailability,calibratePerformance,applyPlayerRealitySnapshot,applyPlayerReality} from '../src/playerReality.mjs';

test('season card totals remain dated performance, not active suspensions',()=>{
  const performance=normalizeSourcePerformance({leagueId:47,leagueName:'Premier League',season:'2026/2027',stats:[{localizedTitleId:'yellow_cards',value:5},{localizedTitleId:'red_cards',value:1},{localizedTitleId:'rating',value:7.8},{localizedTitleId:'minutes_played',value:800}]});
  assert.equal(performance.yellowCards,5);
  assert.equal(performance.competitionId,'47');
  const player={id:'one',value:5,injury:0,suspension:0,position:'MF',realWorld:{playerId:'one',performance}};
  assert.equal(applyPlayerReality(player).suspension,0);
  assert.equal(player.realWorld.performance.season,'2026/2027');
});

test('null and unavailable source observations are not invented zeros',()=>{
  const performance=normalizeSourcePerformance({leagueId:47,season:'2026/2027',stats:[{localizedTitleId:'rating',value:null},{localizedTitleId:'goals',value:0},{localizedTitleId:'yellow_cards',value:-1}]});
  assert.equal(performance.rating,null);
  assert.equal(performance.minutes,null);
  assert.equal(performance.goals,0);
  assert.equal(performance.yellowCards,null);
  assert.equal(normalizeSourceAvailability(null,{observedAt:'2026-10-04'}).status,'not_reported');
  assert.equal(calibratePerformance(performance),null);
});

test('calibration shrinks sparse samples and preserves its estimated basis',()=>{
  assert.equal(calibratePerformance({rating:9,minutes:45}),null);
  const short=calibratePerformance({season:'2026/2027',rating:8,minutes:300});
  const long=calibratePerformance({season:'2026/2027',rating:8,minutes:2000});
  assert.equal(short.basis,'performance_estimate');
  assert.ok(short.overallDelta<long.overallDelta);
  assert.ok(long.overallDelta<=3);
});

test('database overlay uses exact stable IDs and does not mutate source release',()=>{
  const db={meta:{season:'2026/27'},players:[{id:'one',name:'Same Name'},{id:'two',name:'Same Name'}]};
  const snapshot={version:1,asOf:'2026-10-04',players:{one:{playerId:'one',marketValue:{eur:500000}},two:{playerId:'wrong',marketValue:{eur:900000}}}};
  const copy=applyPlayerRealitySnapshot(db,snapshot);
  assert.equal(copy.players[0].realWorld.marketValue.eur,500000);
  assert.equal(copy.players[1].realWorld,undefined);
  copy.players[0].realWorld.marketValue.eur=1;
  assert.equal(snapshot.players.one.marketValue.eur,500000);
  assert.equal(db.players[0].realWorld,undefined);
});

test('new-career market value and source contract preserve existing injury and wages',()=>{
  const p={id:'one',value:500,wage:100,position:'MF',contractUntil:2028,injury:0,suspension:0};
  const raw={realWorld:{playerId:'one',marketValue:{eur:50_123_456},contractUntil:'2030-06-30',availability:{status:'injured',observedAt:'2026-10-04',expectedReturnText:'Late November 2026'}}};
  const result=applyPlayerReality(p,raw,'2026-08-01');
  assert.equal(result.value,50_123_456);
  assert.equal(result.contractUntil,2030);
  assert.equal(result.contractEndDate,'2030-06-30');
  assert.equal(result.wage,100);
  assert.equal(result.injury,0);
  assert.equal(p.value,500);
});

test('past injuries and doubtful returns keep source uncertainty and ban scope',()=>{
  assert.equal(normalizeSourceAvailability({name:'Knee injury',expectedReturnDate:'2026-09-20'},{observedAt:'2026-10-04',confirmedCurrent:true}).status,'historical');
  assert.equal(normalizeSourceAvailability({name:'Knee injury',expectedReturn:'Late September 2026'},{observedAt:'2026-10-04',confirmedCurrent:true}).status,'historical');
  const doubtful=normalizeSourceAvailability({name:'Knock',expectedReturn:{expectedReturnFallback:'Doubtful'},lastUpdated:{utcTime:'2026-10-02T00:00:00Z'}},{observedAt:'2026-10-04',confirmedCurrent:true});
  assert.equal(doubtful.status,'doubtful');
  assert.equal(doubtful.expectedReturnDate,null);
  assert.equal(doubtful.reportedAt,'2026-10-02');
  const ban=normalizeSourceAvailability({name:'Suspension'},{observedAt:'2026-10-04',confirmedCurrent:true});
  assert.equal(ban.status,'reported_suspended');
  assert.equal(ban.competitionId,null);
});

test('calibration changes only game estimates and keeps full attributes inside bounds',()=>{
  const p={id:'one',position:'MF',potential:80,attributes:{passing:20,vision:19,teamwork:15,dribbling:16,stamina:17,decisions:15,pace:12},realWorld:{playerId:'one',calibration:{basis:'performance_estimate',overallDelta:3}}};
  const result=applyPlayerReality(p);
  assert.equal(result.attributes.pace,12);
  assert.ok(Object.values(result.attributes).every(v=>v<=20&&v>=1));
  assert.equal(p.attributes.vision,19);
  assert.ok(result.potential>=80);
});
