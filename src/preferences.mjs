export const PREFERENCES_STORAGE_KEY = 'touchline.preferences.v1';
export const LANGUAGE_OPTIONS = Object.freeze([
 {value:'vi',label:'Tiếng Việt',locale:'vi-VN'},
 {value:'en',label:'English',locale:'en-GB'},
 {value:'fr',label:'Français',locale:'fr-FR'},
 {value:'es',label:'Español',locale:'es-ES'},
 {value:'pt',label:'Português',locale:'pt-PT'},
]);
export const DEFAULT_PREFERENCES = Object.freeze({
 language:'vi',currency:'EUR',distanceUnit:'metric',heightUnit:'cm',weightUnit:'kg',
 exchangeRates:Object.freeze({USD:1.1,GBP:0.85}),
});
const choices={language:LANGUAGE_OPTIONS.map(x=>x.value),currency:['EUR','USD','GBP'],distanceUnit:['metric','imperial'],heightUnit:['cm','ft'],weightUnit:['kg','lb']};
const listeners=new Set();
export function normalizePreferences(input={}){
 const next={...DEFAULT_PREFERENCES,exchangeRates:{...DEFAULT_PREFERENCES.exchangeRates}};
 for(const [key,values] of Object.entries(choices))if(values.includes(input?.[key]))next[key]=input[key];
 for(const currency of ['USD','GBP']){const value=input?.exchangeRates?.[currency];if(typeof value==='number'&&Number.isFinite(value)&&value>=0.0001&&value<=10000)next.exchangeRates[currency]=value;}
 return Object.freeze({...next,exchangeRates:Object.freeze(next.exchangeRates)});
}
function readPreferences(){try{return normalizePreferences(JSON.parse(globalThis.localStorage?.getItem(PREFERENCES_STORAGE_KEY)||'{}'));}catch{return normalizePreferences();}}
let preferences=readPreferences();
export const getPreferences=()=>preferences;
export const subscribePreferences=listener=>{listeners.add(listener);return()=>listeners.delete(listener);};
export function updatePreferences(patch={}){
 const next=normalizePreferences({...preferences,...patch,exchangeRates:{...preferences.exchangeRates,...patch.exchangeRates}});
 if(JSON.stringify(next)===JSON.stringify(preferences))return preferences;
 preferences=next;
 try{globalThis.localStorage?.setItem(PREFERENCES_STORAGE_KEY,JSON.stringify(preferences));}catch{/* Keep preferences in memory when storage is unavailable. */}
 for(const listener of [...listeners])listener();
 return preferences;
}
export function resetPreferences(){return updatePreferences(DEFAULT_PREFERENCES);}
if(typeof window!=='undefined')window.addEventListener('storage',event=>{
 if(event.key!==PREFERENCES_STORAGE_KEY&&event.key!==null)return;
 const next=readPreferences();if(JSON.stringify(next)===JSON.stringify(preferences))return;
 preferences=next;for(const listener of [...listeners])listener();
});
