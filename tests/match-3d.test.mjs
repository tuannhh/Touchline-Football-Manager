import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {pitchPosition,actorPose,buildMatchScene,positionCamera,cameraViews} from '../src/match3dScene.mjs';

test('3D uses the same pitch orientation and ball elevation as match frames',()=>{
 assert.deepEqual(pitchPosition(0,0),[-52.5,0,-34]);assert.deepEqual(pitchPosition(100,100,2),[52.5,2,34]);
 const g={players:{a:{name:'A'},b:{name:'B'}},clubs:{h:{color:'#ff0000'},a:{}}};
 const world=buildMatchScene(g,{home:'h',away:'a'});
 const frame={players:[{id:'a',x:20,y:30,side:0,role:'LW'},{id:'b',x:80,y:70,side:1,role:'GK'}],ball:{x:20,y:30,z:1,ownerId:'a'},action:{type:'cross',playerId:'a'}};
 const before=JSON.stringify(frame);world.update(frame);
 assert.equal(world.actors.size,2);assert.deepEqual(world.actors.get('a').root.position.toArray(),pitchPosition(20,30));
 assert.equal(world.ball.position.y,3.34);assert.ok(world.actors.get('a').ring.visible);assert.ok(!world.actors.get('b').ring.visible);
 assert.equal(JSON.stringify(frame),before,'rendering must not mutate authoritative playback');
 const pose=structuredClone(world.actors.get('a').pose);world.update(frame,{names:false});assert.deepEqual(world.actors.get('a').pose,pose,'paused frame must not advance running or kicking animations');
 world.update({...frame,players:[frame.players[0]]});assert.equal(world.actors.get('b').root.visible,false,'sent-off and substituted actors disappear');world.dispose();assert.equal(world.scene.children.length,0);
});
test('articulated running follows travel distance and direction, not wall clock time',()=>{
 const actor={id:'a',side:0,x:10,y:40},ball={x:70,y:10};
 const idle=actorPose(null,actor,ball,{});assert.equal(idle.stride,0);
 const run=actorPose(idle,{...actor,x:10.2},ball,{});assert.ok(run.stride>0);assert.equal(run.angle,Math.PI/2);
 const shot=actorPose(run,{...actor,x:10.2},{x:11,y:40},{type:'shot',playerId:'a'});assert.ok(shot.kick);
 assert.equal(actorPose(run,{...actor,x:10.2},ball,{type:'shot',playerId:'b'}).kick,false);
});
test('all 3D camera views frame the pitch with finite projection at narrow and desktop sizes',()=>{
 for(const view of cameraViews)for(const aspect of [.5,1,1.6,2.4]){
  const camera=new THREE.PerspectiveCamera();positionCamera(camera,view,aspect);camera.updateMatrixWorld();
  assert.equal(camera.aspect,aspect);assert.ok(camera.projectionMatrix.elements.every(Number.isFinite));
  for(const x of [-52.5,52.5])for(const z of [-34,34]){
   const point=new THREE.Vector3(x,0,z).project(camera);if(view!=='broadcast')assert.ok(Math.abs(point.x)<1.03&&Math.abs(point.y)<1.03,`${view} ${aspect}: pitch is clipped`);
  }
 }
});
test('broadcast camera tracks the ball without moving the actors or clipping the action',()=>{
 const camera=new THREE.PerspectiveCamera(48,1.6,.1,600);
 for(const ball of [{x:0,y:0},{x:100,y:100},{x:50,y:50}]){
  positionCamera(camera,'broadcast',1.6,ball);camera.updateMatrixWorld();
  const point=new THREE.Vector3(...pitchPosition(ball.x,ball.y)).project(camera);
  assert.ok(Math.abs(point.x)<.9&&Math.abs(point.y)<.9);
 }
});
