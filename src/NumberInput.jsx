import React,{useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {formatInput,number,parseNumber,numberSeparators} from './locale.mjs';
import {getPreferences,subscribePreferences} from './preferences.mjs';
const validation={
 vi:(min,max,decimal)=>`Nhập số từ ${min} đến ${max}; dấu thập phân: ${decimal}.`,
 en:(min,max,decimal)=>`Enter a number from ${min} to ${max}; decimal separator: ${decimal}.`,
 fr:(min,max,decimal)=>`Saisissez un nombre de ${min} à ${max} ; séparateur décimal : ${decimal}.`,
 es:(min,max,decimal)=>`Introduce un número de ${min} a ${max}; separador decimal: ${decimal}.`,
 pt:(min,max,decimal)=>`Introduza um número de ${min} a ${max}; separador decimal: ${decimal}.`,
};
export default function NumberInput({value,onChange,min=0,max=1e12,decimals=0,...props}){
 const {language}=useSyncExternalStore(subscribePreferences,getPreferences,getPreferences);
 const [text,setText]=useState(()=>number(value,decimals));
 const emitted=useRef(null),input=useRef(null),previousLanguage=useRef(language);
 useEffect(()=>{if(value!==emitted.current||previousLanguage.current!==language){setText(number(value,decimals));input.current?.setCustomValidity('');}previousLanguage.current=language;},[value,decimals,language]);
 const valid=s=>{const n=parseNumber(s);return Number.isFinite(n)&&n>=min&&n<=max&&(decimals>0||Number.isInteger(n));};
 return <input {...props} ref={input} type="text" inputMode={decimals?'decimal':'numeric'} value={text} onChange={e=>{
  const before=e.target.value,caret=e.target.selectionStart,formatted=formatInput(before);if(formatted===null)return;
  setText(formatted);e.target.setCustomValidity(valid(formatted)?'':validation[language](number(min,decimals),number(max,decimals),numberSeparators().decimal));
  if(valid(formatted)){emitted.current=parseNumber(formatted);onChange(emitted.current);}
  const tail=before.length-caret;requestAnimationFrame(()=>{if(document.activeElement===e.target)e.target.setSelectionRange(Math.max(0,formatted.length-tail),Math.max(0,formatted.length-tail));});
 }} onBlur={e=>{if(valid(text)){const n=Number(parseNumber(text).toFixed(decimals));emitted.current=n;setText(number(n,decimals));onChange(n);}else e.target.reportValidity();}}/>;
}
