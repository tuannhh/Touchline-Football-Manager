import test from 'node:test';
import assert from 'node:assert/strict';
import {createPhaseTactics,FORMATION_SLOTS,phasePlayerRole} from '../src/tactics.mjs';
import {buildMatchScene,restingMatchFrame,tacticalTargets,rankPassingOptions,passingLaneRisk,dribbleSpace} from '../src/matchMotion.mjs';
import {sceneGamePayload,planMatchScene} from '../src/matchScenePlan.mjs';
import {PLAYER_ROLES} from '../src/playerRoles.mjs';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function fixture(){
 const game={players:{}},lineups=[0,1].map(side=>Array.from({length:11},(_,seat)=>{
  const id=`${side}-${seat}`,position=FORMATION_SLOTS['4-3-3'][seat][0];
  game.players[id]={id,position:seat===0?'GK':seat<5?'DF':seat<8?'MF':'FW',naturalPositions:[position],attributes:{pace:15,stamina:14,decisions:15,teamwork:14,positioning:14,passing:15}};
  return id;
 }));
 game.players.sub={...game.players['0-1'],id:'sub'};
 const match={fixtureId:'roles',minute:17,rng:731,formation:['4-3-3','4-3-3'],phaseTactics:[createPhaseTactics(),createPhaseTactics()],lineups,tactics:[{pressing:4,width:4},{pressing:4,width:4}],attack:0,score:[0,0],shots:[0,0],onTarget:[0,0],red:[],injured:[],off:[],events:[],assists:{},ball:{x:62,y:22}};
 return {game,match};
}
function setRole(match,side,phase,seat,id){
 const config=match.phaseTactics[side],shape=config[phase];
 shape.roles??=shape.slots.map(s=>phasePlayerRole(config,phase,s,shape.formation));
 shape.roles[shape.slots.indexOf(seat)]=id;
}
function shapePlayers(game,match,ownerId='0-6',point={x:64,y:22}){
 const players=restingMatchFrame(game,match).players,owner=players.find(p=>p.id===ownerId);
 owner.x=point.x;owner.y=point.y;
 return {players,owner};
}
function target(game,match,seat,roleId,{side=0,phase='inPossession',ownerId='0-6',point={x:64,y:22}}={}){
 setRole(match,side,phase,seat,roleId);
 const {players,owner}=shapePlayers(game,match,ownerId,point);
 return tacticalTargets(game,match,players,0,owner,ownerId).get(`${side}-${seat}`);
}

test('custom 4-3-3 moves the same midfield seat from CDM to CAM in possession and restores its defensive position',()=>{
 const {game,match}=fixture(),original=restingMatchFrame(game,match).players.find(p=>p.id==='0-5');
 match.phaseTactics[0].inPossession.positions=FORMATION_SLOTS['4-3-3'].map(p=>[...p]);
 match.phaseTactics[0].inPossession.positions[5]=['AM',50,27];
 setRole(match,0,'inPossession',5,'attacking-midfielder');
 const moved=restingMatchFrame(game,match).players.find(p=>p.id==='0-5');
 assert.equal(moved.role,'AM');assert.equal(moved.playerRole,'attacking-midfielder');assert.ok(moved.x>original.x+15);
 const {players,owner}=shapePlayers(game,match),attacking=tacticalTargets(game,match,players,0,owner,owner.id).get('0-5');
 const other=players.find(p=>p.id==='1-6');other.x=60;other.y=50;
 const defending=tacticalTargets(game,match,players,1,other,other.id).get('0-5');
 assert.equal(attacking.role,'AM');assert.equal(defending.role,'DM');assert.ok(attacking.x>defending.x+15);
});

test('full back, wing back, inside full back and inside wing back have separate width and depth objectives',()=>{
 const {game,match}=fixture();
 const full=target(game,match,1,'full-back'),wing=target(game,match,1,'wing-back'),inside=target(game,match,1,'inside-full-back'),pivot=target(game,match,1,'inside-wing-back');
 assert.ok(wing.x>full.x+15,'wing back overlaps beyond the holding full back');assert.equal(wing.task,'overlap');
 assert.ok(Math.abs(inside.y-50)<Math.abs(full.y-50)-10,'inside full back tucks into the centre-back line');
 assert.ok(pivot.x>inside.x+10,'inside wing back joins midfield, not the centre-back line');
 assert.equal(inside.task,'cover');assert.equal(pivot.task,'support');
 const {players,owner}=shapePlayers(game,match),a=tacticalTargets(game,match,players,0,owner,owner.id);
 const mirror={...match,phaseTactics:[match.phaseTactics[1],match.phaseTactics[0]]};
 const reflected=players.map(p=>({...p,side:1-p.side,x:100-p.x})),other=reflected.find(p=>p.id===owner.id),b=tacticalTargets(game,mirror,reflected,1,other,other.id);
 for(const p of players){assert.ok(Math.abs(a.get(p.id).x+b.get(p.id).x-100)<.001);assert.ok(Math.abs(a.get(p.id).y-b.get(p.id).y)<.001);}
});

test('inside forwards attack the half space while wingers maintain width',()=>{
 const {game,match}=fixture(),winger=target(game,match,8,'winger'),inside=target(game,match,8,'inside-forward');
 assert.ok(Math.abs(inside.y-50)<Math.abs(winger.y-50)-15);assert.equal(inside.task,'run');assert.equal(winger.task,'support');
 assert.ok(inside.x>=winger.x);
 const carrier={id:'0-8',side:0,seat:8,role:'LW',x:55,y:15};
 const cutIn=dribbleSpace(game,[carrier],carrier,'inside-forward'),wide=dribbleSpace(game,[carrier],carrier,'winger');
 assert.ok(cutIn.y>wide.y+5,'carrier behavior agrees with the off-ball role');
});

test('advanced playmaker shows for a pass instead of duplicating the attacking midfielder run',()=>{
 const {game,match}=fixture();
 match.phaseTactics[0].inPossession.positions=FORMATION_SLOTS['4-3-3'].map(p=>[...p]);match.phaseTactics[0].inPossession.positions[5]=['AM',50,27];
 const runner=target(game,match,5,'attacking-midfielder',{point:{x:48,y:22}}),maker=target(game,match,5,'advanced-playmaker',{point:{x:48,y:22}});
 assert.equal(maker.task,'support');assert.ok(maker.x<runner.x-5);
 // A role never makes a screened passing lane safe. Compare an open maker
 // with the same player as a runner, then put a defender in that lane.
 const {players,owner}=shapePlayers(game,match,'0-6',{x:50,y:50}),receiver=players.find(p=>p.id==='0-5');receiver.x=53;receiver.y=72;
 for(const p of players.filter(p=>p.side===1)){p.x=90;p.y=90;}
 const open=rankPassingOptions(game,match,players,owner).find(p=>p.player.id===receiver.id);
 setRole(match,0,'inPossession',5,'attacking-midfielder');
 const generic=rankPassingOptions(game,match,players,owner).find(p=>p.player.id===receiver.id);assert.ok(open.value<generic.value);
 setRole(match,0,'inPossession',5,'advanced-playmaker');const blocker=players.find(p=>p.id==='1-2');blocker.x=51.5;blocker.y=61;
 assert.ok(passingLaneRisk(game,owner,receiver,[blocker])>.9);
 assert.ok(rankPassingOptions(game,match,players,owner).find(p=>p.player.id===receiver.id).value>generic.value+20);
});

test('pressing and holding midfielders choose different jobs without sending multiple players to the ball',()=>{
 const {game,match}=fixture(),{players,owner}=shapePlayers(game,match,'0-6',{x:61,y:38});
 const midfielder=players.find(p=>p.id==='1-6');midfielder.x=69;midfielder.y=38;
 setRole(match,1,'outOfPossession',6,'pressing-central-midfielder');
 const pressing=tacticalTargets(game,match,players,0,owner,owner.id);assert.equal(pressing.get(midfielder.id).task,'press');
 assert.equal([...pressing.values()].filter(p=>p.task==='press').length,1);
 setRole(match,1,'outOfPossession',6,'holding-central-midfielder');
 const holding=tacticalTargets(game,match,players,0,owner,owner.id).get(midfielder.id);assert.equal(holding.task,'screen');assert.ok(distance(holding,owner)>8);
});

test('covering defenders retain depth and outlet forwards stay higher than tracking forwards',()=>{
 const {game,match}=fixture(),normal=target(game,match,2,'centre-back-oop',{side:1,phase:'outOfPossession'}),cover=target(game,match,2,'covering-centre-back',{side:1,phase:'outOfPossession'});
 assert.equal(cover.task,'cover');assert.ok(cover.x>normal.x+3,'away cover stays closer to its own goal');
 const tracking=target(game,match,8,'tracking-winger',{side:1,phase:'outOfPossession'}),outlet=target(game,match,8,'outlet-winger',{side:1,phase:'outOfPossession'});
 assert.ok(outlet.x<tracking.x-10,'outlet waits upfield for the turnover');assert.equal(outlet.task,'support');assert.equal(outlet.markId,undefined);
});

test('keeper roles alter starting depth without running outside safe goalkeeper bounds',()=>{
 const {game,match}=fixture(),passing=target(game,match,0,'ball-playing-goalkeeper'),direct=target(game,match,0,'no-nonsense-goalkeeper');
 assert.ok(passing.x>direct.x+3);assert.ok(passing.x<=15);
 const keeper=target(game,match,0,'goalkeeper-oop',{side:1,phase:'outOfPossession'}),sweeper=target(game,match,0,'sweeper-keeper-oop',{side:1,phase:'outOfPossession'});
 assert.ok(sweeper.x<keeper.x);assert.ok(sweeper.x>=87);
});

test('live position and role edits keep physical continuity and cannot mutate the simulation',()=>{
 const {game,match}=fixture(),previous=restingMatchFrame(game,match);
 match.phaseTactics[0].inPossession.positions=FORMATION_SLOTS['4-3-3'].map(p=>[...p]);match.phaseTactics[0].inPossession.positions[5]=['AM',50,27];setRole(match,0,'inPossession',5,'advanced-playmaker');setRole(match,0,'inPossession',1,'inside-wing-back');
 const after={...structuredClone(match),minute:18},saved=JSON.stringify({game,match,after,previous}),scene=buildMatchScene(game,match,after,previous);
 assert.equal(JSON.stringify({game,match,after,previous}),saved);
 for(const p of scene.frames[0].players){assert.equal(distance(p,previous.players.find(q=>q.id===p.id)),0);}
 assert.ok(scene.frames.some(f=>f.players.find(p=>p.id==='0-5')?.playerRole==='advanced-playmaker'));
 for(let i=1;i<scene.frames.length;i++){
  const frame=scene.frames[i],prior=scene.frames[i-1],dt=frame.at-prior.at;
  for(const p of frame.players){const old=prior.players.find(q=>q.id===p.id);assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=2&&p.x<=98&&p.y>=3&&p.y<=97);if(old)assert.ok(distance(p,old)<=7.5*dt+.001);}
  assert.ok(distance(frame.ball,prior.ball)<=42*dt+.001,'role changes cannot teleport the ball');
 }
});

test('substitutes inherit the remapped seat role and worker plans preserve customized tactics',()=>{
 const {game,match}=fixture();
 [match.phaseTactics[0].inPossession.slots[1],match.phaseTactics[0].inPossession.slots[4]]=[4,1];
 setRole(match,0,'inPossession',1,'inside-wing-back');
 const after=structuredClone(match);after.minute++;after.lineups[0][1]='sub';after.off.push('0-1');after.events.push({type:'sub',side:0,minute:18,playerId:'sub'});
 const compact=sceneGamePayload(game,match,after),scene=planMatchScene({game:compact,before:match,after});
 assert.ok(JSON.stringify(compact).length<12000);assert.deepEqual(scene,buildMatchScene(game,match,after));
 const last=scene.frames.at(-1).players,incoming=last.find(p=>p.id==='sub');assert.equal(incoming.seat,1);assert.equal(incoming.playerRole,'inside-wing-back');assert.equal(incoming.role,'RB');assert.ok(!last.some(p=>p.id==='0-1'));
});

test('every catalogue role produces finite, bounded targets for both teams and possession phases',()=>{
 for(const role of PLAYER_ROLES){
  const {game,match}=fixture(),phase=role.phase,side=phase==='inPossession'?0:1,position=role.positions[0];
  let index=FORMATION_SLOTS['4-3-3'].findIndex(p=>p[0]===position);
  if(index<0){index=6;match.phaseTactics[side][phase].positions=FORMATION_SLOTS['4-3-3'].map(p=>[...p]);match.phaseTactics[side][phase].positions[index]=[position,35,40];}
  setRole(match,side,phase,index,role.id);
  const ownerId=index===6&&side===0?'0-7':'0-6',{players,owner}=shapePlayers(game,match,ownerId),targets=tacticalTargets(game,match,players,0,owner,ownerId),actual=targets.get(`${side}-${index}`);
  assert.equal(actual.playerRole,role.id);
  for(const point of targets.values())assert.ok(Number.isFinite(point.x)&&Number.isFinite(point.y)&&point.x>=2&&point.x<=98&&point.y>=3&&point.y<=97,role.id);
 }
});
