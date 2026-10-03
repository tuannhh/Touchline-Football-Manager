import test,{afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {getPreferences,updatePreferences,resetPreferences,normalizePreferences,subscribePreferences,PREFERENCES_STORAGE_KEY} from '../src/preferences.mjs';
import {number,parseNumber,formatInput,numberSeparators,money,displayMoneyValue,fromDisplayMoneyValue,formatHeight,formatWeight,formatDistance,nationality,dateLabel,getCurrencySymbol} from '../src/locale.mjs';
afterEach(()=>resetPreferences());
test('all five locale formats round-trip grouped decimal money and reject malformed input',()=>{
 for(const language of ['vi','en','fr','es','pt']){
  updatePreferences({language});
  for(const value of [0,1,1000,144437842,-124000,1234567.89])assert.equal(parseNumber(number(value,2)),value,language);
  const {group,decimal}=numberSeparators();
  assert.equal(formatInput(`1234567${decimal}89`),number(1234567.89,2));
  assert.equal(formatInput(`1${group}234${decimal}`),`1${group}234${decimal}`);
  for(const value of ['',`1${group}2`,`1${decimal}2${decimal}3`,`12${group}34${group}567`,'1e6','NaN','Infinity','--10'])assert.ok(Number.isNaN(parseNumber(value)),`${language}: ${value}`);
  assert.equal(formatInput('12oops'),null);
 }
 updatePreferences({language:'fr'});assert.equal(parseNumber('1 234 567,89'),1234567.89);assert.equal(parseNumber('1\u00a0234\u00a0567,89'),1234567.89);
 updatePreferences({language:'en'});assert.equal(number(1234567.89,2),'1,234,567.89');assert.equal(parseNumber('1.234'),1.234);
 updatePreferences({language:'vi'});assert.equal(number(1234567.89,2),'1.234.567,89');assert.equal(parseNumber('1.234'),1234);
});
test('currency conversion is reversible and changing preferences never changes canonical amounts',()=>{
 const career=Object.freeze({balance:144437842,wage:1234.56});
 updatePreferences({currency:'USD',exchangeRates:{USD:1.125}});
 assert.equal(displayMoneyValue(800),900);assert.equal(fromDisplayMoneyValue(900),800);assert.equal(money(800),'900 $');
 for(const currency of ['EUR','USD','GBP']){updatePreferences({currency});assert.ok(Math.abs(fromDisplayMoneyValue(displayMoneyValue(career.wage))-career.wage)<1e-9);}
 assert.equal(career.balance,144437842);assert.equal(getCurrencySymbol(),'£');
 updatePreferences({currency:'EUR'});assert.equal(money(career.balance),'144.437.842 €');
});
test('height rounding carries inches, physical units and nationality follow preferences',()=>{
 assert.equal(formatHeight(180),'180 cm');assert.equal(formatDistance(105,{short:true}),'105 m');assert.equal(formatDistance(10000),'10,0 km');assert.equal(formatWeight(75),'75,0 kg');
 updatePreferences({language:'en',heightUnit:'ft',weightUnit:'lb',distanceUnit:'imperial'});
 assert.equal(formatHeight(182),'6′ 0″');assert.equal(formatHeight(180),'5′ 11″');assert.equal(formatWeight(75),'165.3 lb');assert.equal(formatDistance(914.4,{short:true}),'1,000 yd');assert.equal(formatDistance(1609.344),'1.0 mi');assert.equal(nationality({countryCode:'ESP'}),'Spain');assert.equal(dateLabel('2026-09-05'),'05/09/2026');assert.equal(formatHeight(null),'—');
 updatePreferences({language:'fr'});assert.equal(nationality({countryCode:'ESP'}),'Espagne');
});
test('preferences persist independently, reject malformed rates and notify only on effective changes',async()=>{
 const savedLocalStorage=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),values=new Map();
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)}});
 let notifications=0;const unsubscribe=subscribePreferences(()=>notifications++);
 try{
  updatePreferences({language:'pt',currency:'GBP',exchangeRates:{GBP:0.9}});assert.equal(notifications,1);
  updatePreferences({language:'pt'});assert.equal(notifications,1);
  const saved=JSON.parse(values.get(PREFERENCES_STORAGE_KEY));assert.equal(saved.language,'pt');assert.equal(saved.exchangeRates.GBP,0.9);
  const reloaded=await import('../src/preferences.mjs?reload-storage-test');assert.deepEqual(reloaded.getPreferences(),getPreferences());
  const sanitized=normalizePreferences({language:'xx',currency:'BTC',exchangeRates:{USD:0,GBP:Infinity}});assert.equal(sanitized.language,'vi');assert.equal(sanitized.currency,'EUR');assert.equal(sanitized.exchangeRates.USD,1.1);assert.equal(sanitized.exchangeRates.GBP,0.85);
  assert.throws(()=>{getPreferences().exchangeRates.GBP=999;},TypeError);
 }finally{unsubscribe();if(savedLocalStorage)Object.defineProperty(globalThis,'localStorage',savedLocalStorage);else delete globalThis.localStorage;}
});
