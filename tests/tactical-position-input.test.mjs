import test from 'node:test';
import assert from 'node:assert/strict';
import {positionAtPoint,pitchPoint} from '../src/tacticalPositionInput.mjs';

test('dragging a holding midfielder forward resolves CM then CAM while keeping wide lanes distinct',()=>{
 assert.equal(positionAtPoint(50,55),'DM');assert.equal(positionAtPoint(50,43),'CM');assert.equal(positionAtPoint(50,29),'AM');
 assert.equal(positionAtPoint(16,29),'LW');assert.equal(positionAtPoint(84,29),'RW');assert.equal(positionAtPoint(50,12),'ST');
 assert.equal(positionAtPoint(16,68),'LB');assert.equal(positionAtPoint(50,73),'CB');assert.equal(positionAtPoint(84,68),'RB');
 assert.equal(positionAtPoint(16,54),'LWB');assert.equal(positionAtPoint(84,54),'RWB');
});
test('pointer coordinates use actual pitch bounds at any scroll/size and never produce an outside outfield seat',()=>{
 const rect={left:240,top:500,width:500,height:600};
 assert.deepEqual(pitchPoint(490,674,rect),{position:'AM',x:50,y:29});
 assert.deepEqual(pitchPoint(0,0,rect),{position:'LW',x:8,y:10});
 assert.deepEqual(pitchPoint(1500,1900,rect),{position:'RB',x:92,y:80});
 assert.equal(pitchPoint(490,674,{...rect,width:0}),null);assert.equal(pitchPoint(NaN,674,rect),null);
});
