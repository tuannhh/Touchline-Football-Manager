import {jsx as reactJsx,jsxs as reactJsxs,Fragment} from 'react/jsx-runtime';
import {translate} from './i18n.mjs';

// Translate at the React boundary, including labels coming from data dictionaries.
// Values, identities, handlers and DOM nodes remain untouched. No DOM observer is
// used: changing language follows ordinary React reconciliation.
const textProps=['title','subtitle','description','label','placeholder','aria-label','alt','hint','eyebrow'];
export function localizedChildren(value){
 if(typeof value==='string')return translate(value);
 if(Array.isArray(value)){
  const out=[];
  for(let i=0;i<value.length;){
   if(typeof value[i]==='string'||typeof value[i]==='number'){
    let end=i+1;while(end<value.length&&(typeof value[end]==='string'||typeof value[end]==='number'))end++;
    const group=value.slice(i,end),source=group.join(''),translated=translate(source);
    if(translated!==source)out.push(translated);else out.push(...group.map(localizedChildren));
    i=end;
   }else{out.push(localizedChildren(value[i]));i++;}
  }
  return out.length===value.length&&out.every((child,index)=>child===value[index])?value:out;
 }
 return value;
}
export function localizedProps(props){
 if(!props||props.translate==='no')return props;
 let out=props;
 const set=(key,value)=>{if(value!==props[key]){if(out===props)out={...props};out[key]=value;}};
 if('children'in props)set('children',localizedChildren(props.children));
 for(const key of textProps)if(typeof props[key]==='string')set(key,translate(props[key]));
 return out;
}
export function jsx(type,props,key){return reactJsx(type,localizedProps(props),key);}
export function jsxs(type,props,key){return reactJsxs(type,localizedProps(props),key);}
export {Fragment};
