import i18next from 'i18next';
import {initReactI18next} from 'react-i18next';
import {getPreferences,subscribePreferences,LANGUAGE_OPTIONS} from './preferences.mjs';
import {settingsCatalog} from './settings-catalog.mjs';
import vi from './locales/vi.json' with {type:'json'};
import en from './locales/en.json' with {type:'json'};
import fr from './locales/fr.json' with {type:'json'};
import es from './locales/es.json' with {type:'json'};
import pt from './locales/pt.json' with {type:'json'};
import enDomain from './locales/domain/en.json' with {type:'json'};
import frDomain from './locales/domain/fr.json' with {type:'json'};
import esDomain from './locales/domain/es.json' with {type:'json'};
import ptDomain from './locales/domain/pt.json' with {type:'json'};
import enReports from './locales/domain-reports/en.json' with {type:'json'};
import frReports from './locales/domain-reports/fr.json' with {type:'json'};
import esReports from './locales/domain-reports/es.json' with {type:'json'};
import ptReports from './locales/domain-reports/pt.json' with {type:'json'};
const catalogs={vi,en:{...enDomain,...enReports,...en},fr:{...frDomain,...frReports,...fr},es:{...esDomain,...esReports,...es},pt:{...ptDomain,...ptReports,...pt}};
export const i18n=i18next.createInstance();
i18n.use(initReactI18next).init({
 resources:Object.fromEntries(LANGUAGE_OPTIONS.map(({value})=>[value,{translation:catalogs[value],settings:settingsCatalog[value]}])),
 lng:getPreferences().language,fallbackLng:'vi',supportedLngs:LANGUAGE_OPTIONS.map(x=>x.value),
 defaultNS:'translation',ns:['translation','settings'],keySeparator:false,nsSeparator:false,
 interpolation:{escapeValue:false},returnNull:false,initAsync:false,react:{useSuspense:false},
});
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const patterns=Object.fromEntries(Object.entries(catalogs).map(([lang,catalog])=>[lang,Object.keys(catalog).filter(k=>/\{\{\d+\}\}/.test(k)).map(key=>{
 const captures=[];let cursor=0,pattern='^';
 for(const part of key.matchAll(/\{\{(\d+)\}\}/g)){pattern+=escape(key.slice(cursor,part.index))+'(.*?)';captures.push(part[1]);cursor=part.index+part[0].length;}
 return {key,captures,specificity:key.replace(/\{\{\d+\}\}/g,'').length,regex:new RegExp(pattern+escape(key.slice(cursor))+'$','s')};
}).sort((a,b)=>b.specificity-a.specificity)]));
const cache=new Map();
const positionPrefix=/^(?:GK|LB|CB|RB|LWB|RWB|CDM|CM|LM|RM|CAM|LW|RW|ST) (?:· |\()/;
function positionList(text){
 const parts=text.split(', ');
 return parts.length>1&&parts.every(part=>positionPrefix.test(part)&&i18n.exists(part,{ns:'translation'}))?parts.map(part=>i18n.t(part,{ns:'translation'})).join(', '):null;
}
function syncLanguage(){
 const lang=getPreferences().language;
 if(i18n.language!==lang){cache.clear();void i18n.changeLanguage(lang);}
 if(typeof document!=='undefined')document.documentElement.lang=lang;
}
subscribePreferences(syncLanguage);syncLanguage();
/** Translate presentation text only; never pass names, identifiers or persisted world data here. */
export function translate(text,options,depth=0){
 if(typeof text!=='string'||!text)return text;
 const key=text.trim();if(!key)return text;
 const cacheKey=i18n.language+'\0'+depth+'\0'+text;
 if(!options&&cache.has(cacheKey))return cache.get(cacheKey);
 let result=key;
 if(i18n.exists(key,{ns:'translation'}))result=i18n.t(key,{...options,ns:'translation'});
 else if(positionPrefix.test(key)&&positionList(key)!==null)result=positionList(key);
 else if(depth<2)for(const pattern of patterns[i18n.language]||[]){
  const match=pattern.regex.exec(key);if(!match)continue;
  const args=Object.fromEntries(pattern.captures.map((name,i)=>[name,translate(match[i+1],undefined,depth+1)]));
  result=i18n.t(pattern.key,{...args,...options,ns:'translation'});break;
 }
 const start=text.indexOf(key),output=text.slice(0,start)+result+text.slice(start+key.length);
 if(!options){if(cache.size>=5000)cache.clear();cache.set(cacheKey,output);}
 return output;
}
export default i18n;
