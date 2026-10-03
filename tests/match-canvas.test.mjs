import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {transformSync} from 'esbuild';

// Run the actual JSX component/effect. Testing only the motion sampler would not
// catch a drawing-loop exception that leaves the entire match canvas blank.
const source=readFileSync(new URL('../src/MatchCanvas.jsx',import.meta.url),'utf8');
const compiled=transformSync(source,{loader:'jsx',format:'cjs',jsx:'transform',target:'es2022'}).code;

function context2d(){
 const calls=[];
 const ctx={calls,measureText:text=>({width:String(text).length*6})};
 for(const method of ['setTransform','clearRect','fillRect','strokeRect','beginPath','moveTo','lineTo','stroke','ellipse','arc','fill','drawImage','save','translate','rotate','closePath','restore','fillText']){
  ctx[method]=(...args)=>{
   for(const arg of args)if(typeof arg==='number')assert.ok(Number.isFinite(arg),`${method} received a non-finite coordinate`);
   calls.push({method,args});
  };
 }
 return ctx;
}

function mountCanvas(){
 const foreground=context2d(),background=context2d();
 const canvas={clientWidth:960,clientHeight:620,width:0,height:0,getContext:()=>foreground};
 const pitch={width:0,height:0,getContext:()=>background};
 const refs=[],effects=[],observers=[],pendingFrames=new Map();let cursor=0,nextFrame=0,mounted=false;
 const document={hidden:false,createElement:tag=>{assert.equal(tag,'canvas');return pitch;}};
 const window={devicePixelRatio:1};
 const react={
  useRef(initial){const index=cursor++;return refs[index]??(refs[index]={current:initial});},
  useEffect(effect){if(!mounted)effects.push(effect);},
  createElement(type,props){assert.equal(type,'canvas');props.ref.current=canvas;return {type,props};}
 };
 const module={exports:{}};
 const i18n={language:'vi'};
 runInNewContext(compiled,{
  module,exports:module.exports,
  require(name){if(name==='react')return react;if(name==='./i18n.mjs')return {__esModule:true,default:i18n,translate:text=>text};throw Error(`Unexpected renderer dependency: ${name}`);},
  document,window,
  ResizeObserver:class{
   constructor(callback){this.callback=callback;this.disconnected=false;observers.push(this);}
   observe(element){assert.equal(element,canvas);}
   disconnect(){this.disconnected=true;}
  },
  requestAnimationFrame(callback){const id=++nextFrame;pendingFrames.set(id,callback);return id;},
  cancelAnimationFrame(id){pendingFrames.delete(id);}
 });
 const players=Array.from({length:22},(_,index)=>({id:`p${index}`,side:index<11?0:1,seat:index%11,role:index%11===0?'GK':'CM',task:'support',x:10+(index%11)*7,y:15+Math.floor(index/11)*45+(index%5)*3}));
 const g={players:Object.fromEntries(players.map((p,index)=>[p.id,{id:p.id,number:index+1,name:`Player ${index+1}`}])) ,clubs:{home:{color:'#a32130',abbreviation:'HOM'},away:{abbreviation:'AWY'}}};
 const m={home:'home',away:'away',minute:0,score:[0,0],paused:true};
 const frameRef={current:{players,ball:{x:50,y:50,z:0,ownerId:'p4'},action:{type:'dribble'}}};
 const props={g,m,names:true,frameRef};
 function renderProps(updates={}){Object.assign(props,updates);cursor=0;return module.exports.default(props);}
 const element=renderProps(),cleanups=effects.map(effect=>effect());mounted=true;
 function tick(){
  assert.equal(pendingFrames.size,1,'exactly one animation frame must be scheduled');
  const [id,callback]=pendingFrames.entries().next().value;pendingFrames.delete(id);callback(16*id);
 }
 return {foreground,background,canvas,pitch,frameRef,props,document,window,i18n,element,pendingFrames,renderProps,tick,
  resize(width,height){observers[0].callback([{contentRect:{width,height}}]);},
  cleanup(){cleanups.forEach(cleanup=>cleanup());assert.ok(observers.every(observer=>observer.disconnected));assert.equal(pendingFrames.size,0,'unmount must cancel the render loop');}
 };
}

const callsFor=(ctx,method)=>ctx.calls.filter(call=>call.method===method);
const shirtNumbers=ctx=>callsFor(ctx,'fillText').filter(call=>typeof call.args[0]==='number');

test('actual match canvas paints the pitch, ball and all 22 players on its first paused frame',()=>{
 const view=mountCanvas();
 try{
  assert.doesNotThrow(()=>view.tick(),'the renderer must not throw before painting the first frame');
  assert.equal(view.canvas.width,960);assert.equal(view.canvas.height,620);
  assert.equal(callsFor(view.foreground,'drawImage').length,1,'the cached pitch is copied onto the visible canvas');
  assert.ok(callsFor(view.background,'strokeRect').length>=5,'pitch boundaries and penalty areas are drawn');
  assert.deepEqual(shirtNumbers(view.foreground).map(call=>call.args[0]).sort((a,b)=>a-b),Array.from({length:22},(_,i)=>i+1));
  assert.equal(callsFor(view.foreground,'fillText').filter(call=>String(call.args[0]).startsWith('Player ')).length,22);
  assert.equal(callsFor(view.foreground,'arc').length,24,'22 players and both layers of the ball are visible');
  assert.equal(view.element.props.role,'img');
  const count=view.foreground.calls.length;view.tick();
  assert.equal(view.foreground.calls.length,count,'an unchanged paused frame does not repaint');
 }finally{view.cleanup();}
});

test('running frames update individual players and an elevated ball while reusing the pitch',()=>{
 const view=mountCanvas();
 try{
  view.tick();const pitchCalls=view.background.calls.length;
  const original=shirtNumbers(view.foreground).find(call=>call.args[0]===5).args;
  view.foreground.calls.length=0;
  view.frameRef.current={...view.frameRef.current,players:view.frameRef.current.players.map(p=>p.id==='p4'?{...p,x:p.x+6,y:p.y+2}:p),ball:{x:55,y:45,z:1.4},action:{type:'cross',receiverId:'p7'}};
  view.renderProps({m:{...view.props.m,paused:false,minute:1}});
  assert.doesNotThrow(()=>view.tick());
  assert.equal(shirtNumbers(view.foreground).length,22);
  const moved=shirtNumbers(view.foreground).find(call=>call.args[0]===5).args;
  assert.ok(moved[1]>original[1]);assert.ok(moved[2]>original[2]);
  const ball=callsFor(view.foreground,'arc').at(-2).args;
  assert.equal(ball[0],30+55/100*900);assert.equal(ball[1],30+45/100*560-1.4*22);
  assert.equal(view.background.calls.length,pitchCalls,'motion does not redraw the pitch texture');
 }finally{view.cleanup();}
});

test('resize, device-pixel ratio and language/name settings invalidate a paused canvas',()=>{
 const view=mountCanvas();
 try{
  view.tick();view.foreground.calls.length=0;
  view.resize(480,360);view.window.devicePixelRatio=3;view.tick();
  assert.equal(view.canvas.width,960);assert.equal(view.canvas.height,720,'pixel density is capped at 2');
  assert.equal(shirtNumbers(view.foreground).length,22);
  assert.equal(callsFor(view.foreground,'drawImage').at(-1).args[7],480);
  const count=view.foreground.calls.length;view.tick();assert.equal(view.foreground.calls.length,count);
  view.renderProps({names:false});view.tick();assert.ok(view.foreground.calls.length>count);
  const afterNames=view.foreground.calls.length;view.i18n.language='en';view.tick();assert.ok(view.foreground.calls.length>afterNames);
 }finally{view.cleanup();}
});

test('hidden and temporarily zero-size canvases resume drawing without losing the render loop',()=>{
 const view=mountCanvas();
 try{
  view.document.hidden=true;view.tick();assert.equal(view.foreground.calls.length,0);
  view.document.hidden=false;view.resize(0,0);view.tick();assert.equal(view.foreground.calls.length,0);
  view.resize(960,620);view.tick();assert.equal(shirtNumbers(view.foreground).length,22);
 }finally{view.cleanup();}
});
