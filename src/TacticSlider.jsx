import React,{useEffect,useId,useRef,useState} from 'react';

// Keep the drag local: updating the career clones thousands of player records.
// Pointer release commits once; cancelled gestures revert to the current setting.
export default function TacticSlider({label,choices,value,onCommit,disabled}){
 const id=useId(),[preview,setPreview]=useState(value),draft=useRef(value),dragging=useRef(false);
 const show=n=>{draft.current=n;setPreview(n);};
 useEffect(()=>{if(disabled)dragging.current=false;if(!dragging.current)show(value);},[value,disabled]);
 const commit=n=>{dragging.current=false;const next=Math.max(1,Math.min(choices.length,n));show(next);if(next!==value&&onCommit(next)===false)show(value);};
 const finish=e=>{if(dragging.current)commit(Number(e.currentTarget.value));};
 return <div className="tactic-slider"><label htmlFor={id}><span>{label}<b>{choices[preview-1]}</b></span></label><div className="tactic-slider-control">
  <button type="button" aria-label={'Giảm '+label} disabled={disabled||preview<=1} onClick={()=>commit(draft.current-1)}>−</button>
  <input id={id} aria-label={label} aria-valuetext={choices[preview-1]} type="range" min="1" max={choices.length} step="1" disabled={disabled} value={preview}
   onPointerDown={()=>{dragging.current=true;}}
   onChange={e=>{const n=Number(e.target.value);if(dragging.current)show(n);else commit(n);}}
   onPointerUp={finish} onLostPointerCapture={finish} onBlur={finish}
   onPointerCancel={()=>{dragging.current=false;show(value);}}/>
  <button type="button" aria-label={'Tăng '+label} disabled={disabled||preview>=choices.length} onClick={()=>commit(draft.current+1)}>+</button>
 </div></div>;
}
