import {getPreferences,LANGUAGE_OPTIONS} from './preferences.mjs';
export const getLocale=()=>LANGUAGE_OPTIONS.find(x=>x.value===getPreferences().language)?.locale||'vi-VN';
const numberFormats=new Map(),countryFormats=new Map(),separatorCache=new Map();
function numberFormatter(digits=0){
 const d=Math.max(0,Math.min(20,Number.isInteger(digits)?digits:0)),key=getLocale()+':'+d;
 if(!numberFormats.has(key))numberFormats.set(key,new Intl.NumberFormat(getLocale(),{useGrouping:'always',minimumFractionDigits:d,maximumFractionDigits:d}));
 return numberFormats.get(key);
}
export function number(n,digits=0){return numberFormatter(digits).format(Number(n||0));}
export function numberSeparators(){
 const locale=getLocale();if(!separatorCache.has(locale)){
  const parts=numberFormatter(1).formatToParts(12345.6);
  separatorCache.set(locale,{group:parts.find(x=>x.type==='group')?.value||',',decimal:parts.find(x=>x.type==='decimal')?.value||'.'});
 }return separatorCache.get(locale);
}
const escapeRegExp=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function normalizeSpaces(text,group){return /\s/.test(group)?text.replace(/[ \u00a0\u202f]/g,group):text;}
export function parseNumber(text){
 const {group,decimal}=numberSeparators(),s=normalizeSpaces(String(text).trim(),group);
 const pattern=new RegExp('^-?(?:\\d+|\\d{1,3}(?:'+escapeRegExp(group)+'\\d{3})+)(?:'+escapeRegExp(decimal)+'\\d+)?$');
 if(!pattern.test(s))return NaN;
 return Number(s.split(group).join('').replace(decimal,'.'));
}
export function formatInput(text){
 const {group,decimal}=numberSeparators();
 const s=normalizeSpaces(String(text),group).split(group).join('');
 if(!new RegExp('^-?\\d*(?:'+escapeRegExp(decimal)+'\\d*)?$').test(s))return null;
 const [integer,fraction]=s.split(decimal);
 return integer.replace(/\B(?=(\d{3})+(?!\d))/g,group)+(fraction===undefined?'':decimal+fraction);
}
export function getCurrencySymbol(){return {EUR:'€',USD:'$',GBP:'£'}[getPreferences().currency];}
export function currencyRate(){const p=getPreferences();return p.currency==='EUR'?1:p.exchangeRates[p.currency];}
export function displayMoneyValue(euro){return Number(euro)*currencyRate();}
export function fromDisplayMoneyValue(display){return Number(display)/currencyRate();}
export function money(euro,digits=0){return number(displayMoneyValue(euro),digits)+' '+getCurrencySymbol();}
export function dateLabel(date){
 const d=date instanceof Date?date:new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(date))?date+'T12:00:00':date);
 return Number.isFinite(d.getTime())?d.toLocaleDateString(getLocale(),{day:'2-digit',month:'2-digit',year:'numeric'}):'—';
}
export function dateTimeLabel(date){const d=new Date(date);return Number.isFinite(d.getTime())?d.toLocaleString(getLocale()):'—';}
export function formatHeight(cm){
 if(cm===null||cm===undefined||!Number.isFinite(Number(cm))||Number(cm)<=0)return '—';
 if(getPreferences().heightUnit==='cm')return number(cm)+' cm';
 const inches=Math.round(Number(cm)/2.54);return `${Math.floor(inches/12)}′ ${inches%12}″`;
}
export function formatWeight(kg,digits=1){
 if(kg===null||kg===undefined||!Number.isFinite(Number(kg))||Number(kg)<=0)return '—';
 return getPreferences().weightUnit==='lb'?number(Number(kg)*2.2046226218,digits)+' lb':number(kg,digits)+' kg';
}
export function formatDistance(metres,{short=false,digits}={}){
 const m=Number(metres);if(!Number.isFinite(m))return '—';
 const imperial=getPreferences().distanceUnit==='imperial';
 const long=!short&&Math.abs(m)>=1000;
 const unit=imperial?(long?'mi':'yd'):(long?'km':'m');
 const value=m/(unit==='mi'?1609.344:unit==='yd'?0.9144:unit==='km'?1000:1);
 return number(value,digits??(long?1:0))+' '+unit;
}
export function distanceUnitLabel(long=false){return getPreferences().distanceUnit==='imperial'?(long?'mi':'yd'):(long?'km':'m');}
const codes={ENG:'GB',SCO:'GB',WAL:'GB',NIR:'GB',ESP:'ES',GER:'DE',DEU:'DE',FRA:'FR',ITA:'IT',POR:'PT',PRT:'PT',NED:'NL',NLD:'NL',VIE:'VN',VNM:'VN',BRA:'BR',ARG:'AR',URU:'UY',COL:'CO',CHI:'CL',CHL:'CL',ECU:'EC',PAR:'PY',PRY:'PY',PER:'PE',MEX:'MX',USA:'US',CAN:'CA',JAM:'JM',CRC:'CR',JPN:'JP',KOR:'KR',AUS:'AU',NZL:'NZ',IRN:'IR',MAR:'MA',ALG:'DZ',DZA:'DZ',TUN:'TN',EGY:'EG',SEN:'SN',CIV:'CI',NGA:'NG',GHA:'GH',CMR:'CM',CGO:'CG',COD:'CD',MLI:'ML',GUI:'GN',GIN:'GN',GNB:'GW',CPV:'CV',ANG:'AO',MOZ:'MZ',ZAM:'ZM',ZIM:'ZW',RSA:'ZA',ZAF:'ZA',DEN:'DK',DNK:'DK',SWE:'SE',NOR:'NO',FIN:'FI',ISL:'IS',IRL:'IE',BEL:'BE',SUI:'CH',CHE:'CH',AUT:'AT',POL:'PL',CZE:'CZ',SVK:'SK',SVN:'SI',CRO:'HR',HRV:'HR',SRB:'RS',BIH:'BA',MNE:'ME',MKD:'MK',ALB:'AL',KOS:'XK',ROU:'RO',BUL:'BG',BGR:'BG',HUN:'HU',GRE:'GR',GRC:'GR',TUR:'TR',UKR:'UA',RUS:'RU',GEO:'GE',ARM:'AM',AZE:'AZ',CYP:'CY',ISR:'IL',UZB:'UZ',THA:'TH',IDN:'ID',PHI:'PH',PHL:'PH',MAS:'MY',MYS:'MY',CHN:'CN',BOL:'BO',VEN:'VE',PAN:'PA',HON:'HN',HND:'HN',HAI:'HT',HTI:'HT'};
export function isoCountry(p){const code=(p.countryCode||'').toUpperCase();return code.length===2?code:codes[code]||'';}
export function nationality(p){
 const c=isoCountry(p),language=getPreferences().language;
 if(c){if(!countryFormats.has(language))countryFormats.set(language,new Intl.DisplayNames([language],{type:'region'}));try{return countryFormats.get(language).of(c);}catch{}}
 return p.nationality||{vi:'Chưa rõ quốc tịch',en:'Nationality unknown',fr:'Nationalité inconnue',es:'Nacionalidad desconocida',pt:'Nacionalidade desconhecida'}[language];
}
export function flag(p){const c=isoCountry(p);return /^[A-Z]{2}$/.test(c)?[...c].map(x=>String.fromCodePoint(x.charCodeAt(0)+127397)).join(''):'◇';}
