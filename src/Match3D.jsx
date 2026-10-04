import React,{useEffect,useRef} from 'react';
import * as THREE from 'three';
import {buildMatchScene,positionCamera} from './match3dScene.mjs';
import {translate} from './i18n.mjs';

export default function Match3D({g,m,names,frameRef,showMovement,cameraView,onUnavailable}){
 const canvas=useRef(null),latest=useRef(null);latest.current={g,m,names,showMovement,cameraView,onUnavailable};
 useEffect(()=>{
  let renderer,world,observer,animation,disposed=false,width=0,height=0,lastFrame,lastKey;
  const el=canvas.current,camera=new THREE.PerspectiveCamera(48,1,.1,600);
  const failed=()=>{if(!disposed){disposed=true;cancelAnimationFrame(animation);latest.current.onUnavailable();}};
  const lost=e=>{e.preventDefault();failed();};el.addEventListener('webglcontextlost',lost);
  try{
   renderer=new THREE.WebGLRenderer({canvas:el,antialias:true,alpha:false,powerPreference:'high-performance'});
   renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;
   world=buildMatchScene(g,m,{makeLabel:(p,actor)=>{
    const image=document.createElement('canvas');image.width=384;image.height=88;
    const ctx=image.getContext('2d');ctx.fillStyle='rgba(9,25,20,.85)';ctx.fillRect(0,0,384,88);
    ctx.font='600 28px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#eef3e5';
    const name=p?.shortName||p?.name||'';ctx.fillText(`${p?.number||actor.seat+1} · ${name.length>20?name.slice(0,19)+'…':name}`,192,44,370);
    const texture=new THREE.CanvasTexture(image);texture.colorSpace=THREE.SRGBColorSpace;return texture;
   }});
   observer=new ResizeObserver(entries=>{width=entries[0].contentRect.width;height=entries[0].contentRect.height;});observer.observe(el);
   width=el.clientWidth;height=el.clientHeight;
   const draw=()=>{
    if(disposed)return;
    const frame=frameRef.current,options=latest.current,key=[width,height,options.names,options.showMovement,options.cameraView].join(':');
    if(!document.hidden&&frame&&width>50&&height>50&&(frame!==lastFrame||key!==lastKey)){
     try{
      if(key!==lastKey)renderer.setSize(width,height,false);
      positionCamera(camera,options.cameraView,width/height,frame.ball);
      world.update(frame,options);renderer.render(world.scene,camera);lastFrame=frame;lastKey=key;
     }catch{failed();return;}
    }
    animation=requestAnimationFrame(draw);
   };
   animation=requestAnimationFrame(draw);
  }catch{failed();}
  return()=>{disposed=true;cancelAnimationFrame(animation);observer?.disconnect();el.removeEventListener('webglcontextlost',lost);world?.dispose();renderer?.dispose();};
 },[]);
 return <canvas ref={canvas} className="match-canvas match-canvas-3d" role="img" aria-label={translate('Sân bóng 3D thử nghiệm')}/>;
}
