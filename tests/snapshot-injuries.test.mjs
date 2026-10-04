import test from 'node:test';
import assert from 'node:assert/strict';
import {initializeSnapshotInjuries} from '../src/snapshotInjuries.mjs';

function player(id,patch={}){return {id,injury:0,suspension:0,realWorld:{playerId:id,sourceUrl:'https://www.fotmob.com/players/1',performance:{yellowCards:6,redCards:1},availability:{status:'injured',currentConfirmed:true,observedAt:'2026-10-04T09:15:24.656Z',description:'Back injury',expectedReturnText:'Early November 2026',sourceUrl:'https://www.fotmob.com/teams/9825/squad',...patch}}};}
function game(players={one:player('one')}){return {date:'2026-08-15',dbMeta:{playerReality:{asOf:'2026-10-04'}},players};}

test('source-injury scenario requires explicit opt-in and does not alter disabled careers',()=>{
  const g=game(),original=structuredClone(g);
  assert.equal(initializeSnapshotInjuries(g),0);
  assert.equal(initializeSnapshotInjuries(g,{enabled:false}),0);
  assert.deepEqual(g,original);
});

test('new-career scenario retains actual source date while starting simulated recovery in August',()=>{
  const g=game();
  assert.equal(initializeSnapshotInjuries(g,{enabled:true}),1);
  const p=g.players.one;
  assert.equal(p.injury,6);
  assert.equal(p.injuryDetail.since,'2026-08-15');
  assert.equal(p.injuryDetail.sourceDate,'2026-10-04');
  assert.equal(p.injuryDetail.recoveryEstimated,true);
  assert.equal(p.injuryDetail.recoveryBasis,'source_approximate_window');
  assert.equal(p.injuryDetail.context,'source_snapshot');
  assert.equal(p.injuryDetail.sourceUrl,'https://www.fotmob.com/teams/9825/squad');
  assert.equal(p.suspension,0);
});

test('only confirmed injuries observed on the snapshot date seed the scenario',()=>{
  const g=game({doubtful:player('doubtful',{status:'doubtful'}),historical:player('historical',{status:'historical'}),unknown:player('unknown',{status:'unknown'}),old:player('old',{observedAt:'2026-10-02'}),unconfirmed:player('unconfirmed',{currentConfirmed:false}),suspended:player('suspended',{status:'reported_suspended'}),injured:player('injured')});
  assert.equal(initializeSnapshotInjuries(g,{enabled:true}),1);
  assert.equal(g.players.injured.injury,6);
  for(const [id,p]of Object.entries(g.players))if(id!=='injured'){assert.equal(p.injury,0);assert.equal(p.suspension,0);}
});

test('recovery durations use exact expected dates or explicitly estimated fallback and remain bounded',()=>{
  const g=game({exact:player('exact',{expectedReturnDate:'2026-10-18'}),short:player('short',{expectedReturnDate:'2026-10-04'}),long:player('long',{expectedReturnDate:'2030-01-01'}),missing:player('missing',{expectedReturnText:null}),past:player('past',{expectedReturnDate:'2026-09-20'}),pastMonth:player('pastMonth',{expectedReturnText:'Late September 2026'}),mid:player('mid',{expectedReturnText:'Mid October 2026'}),late:player('late',{expectedReturnText:'Late October 2026'})});
  assert.equal(initializeSnapshotInjuries(g,{enabled:true}),6);
  assert.equal(g.players.exact.injury,2);
  assert.equal(g.players.exact.injuryDetail.recoveryBasis,'source_expected_date');
  assert.equal(g.players.short.injury,1);
  assert.equal(g.players.long.injury,52);
  assert.equal(g.players.missing.injury,2);
  assert.equal(g.players.missing.injuryDetail.recoveryBasis,'default_two_weeks');
  assert.equal(g.players.past.injury,0);
  assert.equal(g.players.pastMonth.injury,0);
  assert.equal(g.players.mid.injury,3);
  assert.equal(g.players.late.injury,4);
});

test('initialized scenarios are idempotent and do not re-injure recovered players',()=>{
  const g=game();
  initializeSnapshotInjuries(g,{enabled:true});
  g.players.one.injury=0;
  g.players.one.injuryDetail.active=false;
  const before=structuredClone(g);
  assert.equal(initializeSnapshotInjuries(g,{enabled:true}),0);
  assert.deepEqual(g,before);
});

test('missing metadata, invalid dates, identity mismatch and existing injuries are preserved',()=>{
  const g=game({one:player('one'),two:player('two'),three:player('three',{observedAt:'2026-02-31'}),four:player('four',{observedAt:null})});
  g.players.one.injury=8;
  g.players.one.injuryDetail={context:'training'};
  g.players.two.realWorld.playerId='different';
  assert.equal(initializeSnapshotInjuries(g,{enabled:true}),0);
  assert.equal(g.players.one.injury,8);
  assert.equal(g.players.one.injuryDetail.context,'training');
  const legacy=game();delete legacy.dbMeta.playerReality;
  assert.equal(initializeSnapshotInjuries(legacy,{enabled:true}),0);
  assert.equal(legacy.players.one.injury,0);
});
