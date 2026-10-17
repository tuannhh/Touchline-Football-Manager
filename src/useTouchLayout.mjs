import {useEffect,useState} from 'react';
import {OFFLINE_APP} from './platform.mjs';
export default function useTouchLayout(){
 const [touch,setTouch]=useState(()=>OFFLINE_APP||matchMedia('(pointer: coarse), (max-width: 1000px)').matches);
 useEffect(()=>{const media=matchMedia('(pointer: coarse), (max-width: 1000px)'),update=()=>setTouch(OFFLINE_APP||media.matches);media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
 return touch;
}
