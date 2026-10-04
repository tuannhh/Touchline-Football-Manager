import * as THREE from 'three';

// This renderer consumes the same immutable presentation frames as the 2D view.
// It never advances match time, consumes RNG or changes a player's records.
export const cameraViews=['broadcast','tactical','goal'];
export function pitchPosition(x,y,elevation=0){return [(x-50)*1.05,elevation,(y-50)*.68];}
const kicking=new Set(['pass','one-two','throughball','cross','shot']);
export function actorPose(previous,actor,ball,action){
 const dx=previous?actor.x-previous.x:0,dz=previous?actor.y-previous.y:0;
 const travelled=Math.min(3,Math.hypot(dx*1.05,dz*.68));
 const phase=(previous?.phase||0)+travelled*2.7;
 const moving=travelled>.001;
 const angle=moving?Math.atan2(dx*1.05,dz*.68):(previous?.angle??(actor.side===0?Math.PI/2:-Math.PI/2));
 const kick=kicking.has(action?.type)&&action.playerId===actor.id&&Math.hypot(ball.x-actor.x,ball.y-actor.y)<4;
 return {x:actor.x,y:actor.y,phase,angle,stride:moving?Math.sin(phase)*.60:0,kick};
}

export function buildMatchScene(g,m,{makeLabel}={}){
 const scene=new THREE.Scene();scene.background=new THREE.Color('#12251f');
 const materials=[],geometries=[],textures=[];
 const material=(color,options={})=>{const value=new THREE.MeshLambertMaterial({color,...options});materials.push(value);return value;};
 const geometry=g=>{geometries.push(g);return g;};
 const box=geometry(new THREE.BoxGeometry(1,1,1)),sphere=geometry(new THREE.SphereGeometry(1,8,6));
 const cylinder=geometry(new THREE.CylinderGeometry(1,1,1,8));
 const shadowGeo=geometry(new THREE.CircleGeometry(1,16));
 const white=material('#e8eee1'),black=material('#182527'),skin=material('#bc8d67');
 const turf=[material('#2e6246'),material('#326b4b')],base=material('#1d422e');
 const shadowMat=new THREE.MeshBasicMaterial({color:'#06180b',transparent:true,opacity:.3,depthWrite:false});materials.push(shadowMat);
 const mesh=(parent,geo,mat,position,scale)=>{const obj=new THREE.Mesh(geo,mat);obj.position.set(...position);obj.scale.set(...scale);parent.add(obj);return obj;};
 scene.add(new THREE.HemisphereLight('#e5f4ff','#355139',2.8));
 const sunlight=new THREE.DirectionalLight('#ffeacc',2.1);sunlight.position.set(-30,60,30);scene.add(sunlight);
 mesh(scene,box,base,[0,-.3,0],[127,.5,87]);
 for(let i=0;i<10;i++)mesh(scene,box,turf[i%2],[-47.25+i*10.5,-.015,0],[10.5,.05,68]);
 const lineMat=new THREE.LineBasicMaterial({color:'#d4e6cf'});materials.push(lineMat);
 const line=points=>{const geo=geometry(new THREE.BufferGeometry().setFromPoints(points.map(([x,z])=>new THREE.Vector3(x,.05,z))));scene.add(new THREE.Line(geo,lineMat));};
 const rect=(x1,z1,x2,z2)=>line([[x1,z1],[x1,z2],[x2,z2],[x2,z1],[x1,z1]]);
 rect(-52.5,-34,52.5,34);line([[0,-34],[0,34]]);
 line(Array.from({length:65},(_,i)=>[Math.sin(i/64*Math.PI*2)*9.15,Math.cos(i/64*Math.PI*2)*9.15]));
 const net=material('#e0ece1',{transparent:true,opacity:.12,side:THREE.DoubleSide});
 for(const sign of [-1,1]){
  rect(sign*52.5,-20.16,sign*36,20.16);rect(sign*52.5,-9.16,sign*47,9.16);
  mesh(scene,cylinder,white,[sign*41.5,.07,0],[.16,.03,.16]);
  for(const z of [-3.66,3.66])mesh(scene,cylinder,white,[sign*52.5,1.22,z],[.09,2.44,.09]);
  mesh(scene,box,white,[sign*52.5,2.44,0],[.15,.15,7.47]);
  mesh(scene,box,net,[sign*53.6,1.22,0],[2.2,2.44,7.32]);
  for(let z=-3.66;z<=3.67;z+=.61)mesh(scene,box,white,[sign*54.7,1.22,z],[.025,2.44,.025]);
  for(let y=.4;y<2.5;y+=.4)mesh(scene,box,white,[sign*54.7,y,0],[.025,.025,7.32]);
 }
 mesh(scene,cylinder,white,[0,.07,0],[.18,.03,.18]);
 // Simple stands and boards give depth without animated crowds or live shadows.
 const stand=material('#243e36'),seats=material('#496352'),boards=material('#bed878');
 for(const sign of [-1,1]){
  for(let tier=0;tier<3;tier++)mesh(scene,box,tier%2?seats:stand,[0,1+tier*1.5,sign*(40+tier*2.8)],[116,2.5,2.7]);
  mesh(scene,box,boards,[0,.6,sign*37],[108,1.2,.2]);
 }
 const shirt=[material(g.clubs[m.home]?.color||'#a52d45'),material('#e9edf3')];
 const shorts=[material('#142637'),material('#35434d')],keepers=[material('#e5b640'),material('#6cc7c1')];
 const actors=new Map();
 function createActor(actor){
  const root=new THREE.Group();root.scale.setScalar(2);scene.add(root);
  const kit=actor.role==='GK'?keepers[actor.side]:shirt[actor.side];
  const body=mesh(root,box,kit,[0,1.19,0],[.55,.66,.3]);
  mesh(root,sphere,skin,[0,1.73,0],[.2,.24,.2]);
  mesh(root,box,shorts[actor.side],[0,.8,0],[.53,.23,.32]);
  const legs=[],arms=[];
  for(const side of [-1,1]){
   const leg=new THREE.Group();leg.position.set(side*.16,.73,0);root.add(leg);legs.push(leg);
   mesh(leg,cylinder,skin,[0,-.22,0],[.095,.43,.095]);
   mesh(leg,cylinder,white,[0,-.49,0],[.10,.25,.10]);
   mesh(leg,box,black,[0,-.66,.065],[.2,.14,.33]);
   const arm=new THREE.Group();arm.position.set(side*.35,1.43,0);root.add(arm);arms.push(arm);
   mesh(arm,cylinder,kit,[0,-.13,0],[.10,.27,.10]);
   mesh(arm,cylinder,skin,[0,-.4,0],[.075,.29,.075]);
  }
  const shadow=mesh(scene,shadowGeo,shadowMat,[0,.08,0],[.7,.5,1]);shadow.rotation.x=-Math.PI/2;
  const ringGeo=geometry(new THREE.RingGeometry(.85,1,24));
  const ringMat=new THREE.MeshBasicMaterial({color:'#d6f177',side:THREE.DoubleSide,transparent:true,opacity:.9,depthWrite:false});materials.push(ringMat);
  const ring=mesh(scene,ringGeo,ringMat,[0,.09,0],[1,1,1]);ring.rotation.x=-Math.PI/2;
  let label=null;
  if(makeLabel){
   const player=g.players[actor.id],texture=makeLabel(player,actor);textures.push(texture);
   const mat=new THREE.SpriteMaterial({map:texture,depthTest:false,transparent:true});materials.push(mat);
   label=new THREE.Sprite(mat);label.scale.set(11,2.55,1);scene.add(label);
  }
  const record={root,body,legs,arms,shadow,ring,label,pose:null};actors.set(actor.id,record);return record;
 }
 const ball=mesh(scene,sphere,white,[0,.3,0],[.33,.33,.33]);
 for(const sign of [-1,1])mesh(ball,sphere,black,[sign*.75,.12,0],[.25,.4,.4]);
 const ballShadow=mesh(scene,shadowGeo,shadowMat,[0,.09,0],[.4,.4,1]);ballShadow.rotation.x=-Math.PI/2;
 let previousFrame;
 function update(frame,{names=true,showMovement=false}={}){
  const advanced=previousFrame!==frame,ids=new Set();
  for(const actor of frame.players){
   ids.add(actor.id);const model=actors.get(actor.id)||createActor(actor);
   if(advanced||!model.pose)model.pose=actorPose(model.pose,actor,frame.ball,frame.action);
   const pose=model.pose,position=pitchPosition(actor.x,actor.y);
   model.root.visible=model.shadow.visible=true;model.root.position.set(...position);model.root.rotation.y=pose.angle;
   model.body.position.y=1.19+Math.abs(pose.stride)*.06;
   model.legs[0].rotation.x=pose.kick?-.95:pose.stride;model.legs[1].rotation.x=-pose.stride;
   model.arms[0].rotation.x=-pose.stride*.7;model.arms[1].rotation.x=pose.stride*.7;
   model.shadow.position.set(position[0],.08,position[2]);
   const owner=frame.ball.ownerId===actor.id,receiver=frame.action?.receiverId===actor.id;
   model.ring.position.set(position[0],.09,position[2]);model.ring.visible=owner||receiver;
   model.ring.material.opacity=owner?.95:.35;
   if(model.label){model.label.visible=names||showMovement&&(owner||receiver);model.label.position.set(position[0],5,position[2]);}
  }
  for(const [id,model]of actors)if(!ids.has(id)){model.root.visible=model.shadow.visible=model.ring.visible=false;if(model.label)model.label.visible=false;}
  const [x,,z]=pitchPosition(frame.ball.x,frame.ball.y);ball.position.set(x,.34+Math.max(0,frame.ball.z||0)*3,z);ballShadow.position.set(x,.09,z);
  previousFrame=frame;
 }
 function dispose(){for(const texture of textures)texture.dispose();for(const geo of geometries)geo.dispose();for(const mat of materials)mat.dispose();scene.clear();}
 return {scene,actors,ball,update,dispose};
}

export function positionCamera(camera,view,aspect,ball={x:50,y:50}){
 camera.aspect=aspect;camera.fov=48;camera.zoom=view==='broadcast'?1.45:1;
 const scale=Math.max(1,1.55/Math.max(.4,aspect));
 const positions={broadcast:[0,85,87],tactical:[0,128,.1],goal:[-103,58,0]};
 const [x,,z]=pitchPosition(ball.x,ball.y),targetX=view==='broadcast'?x*.6:0,targetZ=view==='broadcast'?z*.25:0;
 camera.position.set(...(positions[view]||positions.broadcast).map(x=>x*scale));camera.position.x+=targetX;camera.position.z+=targetZ;camera.lookAt(targetX,0,targetZ);camera.updateProjectionMatrix();
}
