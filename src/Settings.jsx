import React,{useSyncExternalStore} from 'react';
import {useTranslation} from 'react-i18next';
import './i18n.mjs';
import {getPreferences,subscribePreferences,updatePreferences,resetPreferences,LANGUAGE_OPTIONS} from './preferences.mjs';
import {money,formatHeight,formatWeight,formatDistance,dateLabel} from './locale.mjs';
import NumberInput from './NumberInput.jsx';
import './settings.css';
export default function Settings(){
 const {t}=useTranslation('settings');
 const preferences=useSyncExternalStore(subscribePreferences,getPreferences,getPreferences);
 const field=(key,label,options)=><label className="settings-field"><span>{t(label)}</span><select value={preferences[key]} onChange={e=>updatePreferences({[key]:e.target.value})}>{options.map(([value,name])=><option key={value} value={value}>{t(name)}</option>)}</select></label>;
 return <section className="settings-page" aria-labelledby="settings-title">
  <header><span className="eyebrow">TOUCHLINE</span><h1 id="settings-title">{t('title')}</h1><p>{t('subtitle')}</p></header>
  <div className="settings-grid"><div className="settings-sections">
   <section className="panel settings-panel"><h2>{t('language')}</h2><label className="settings-field"><span>{t('language')}</span><select value={preferences.language} onChange={e=>updatePreferences({language:e.target.value})}>{LANGUAGE_OPTIONS.map(({value,label})=><option key={value} value={value} lang={value}>{label}</option>)}</select></label><p className="settings-help">{t('languageHelp')}</p></section>
   <section className="panel settings-panel"><h2>{t('units')}</h2><div className="settings-fields">
    {field('currency','currency',['EUR','USD','GBP'].map(x=>[x,x]))}
    {field('distanceUnit','distance',[['metric','metric'],['imperial','imperial']])}
    {field('heightUnit','height',[['cm','cm'],['ft','ft']])}
    {field('weightUnit','weight',[['kg','kg'],['lb','lb']])}
   </div></section>
   <section className="panel settings-panel"><h2>{t('fx')}</h2><p className="settings-help">{t('fxHelp')}</p><div className="settings-fields">{['USD','GBP'].map(currency=><label className="settings-field" key={currency}><span>{t('rate')} {currency}</span><NumberInput value={preferences.exchangeRates[currency]} min={0.0001} max={10000} decimals={4} onChange={value=>updatePreferences({exchangeRates:{[currency]:value}})}/></label>)}</div></section>
  </div><aside className="panel settings-panel settings-preview"><h2>{t('preview')}</h2><dl>
   <div><dt>{t('budget')}</dt><dd>{money(1234567.89,2)}</dd></div>
   <div><dt>{t('height')}</dt><dd>{formatHeight(180)}</dd></div>
   <div><dt>{t('weight')}</dt><dd>{formatWeight(75)}</dd></div>
   <div><dt>{t('pitch')}</dt><dd>{formatDistance(105,{short:true})}</dd></div>
   <div><dt>{t('travel')}</dt><dd>{formatDistance(10000)}</dd></div>
   <div><dt>{t('date')}</dt><dd>{dateLabel('2026-09-05')}</dd></div>
  </dl></aside></div>
  <footer className="settings-footer"><p>{t('saved')}</p><button className="secondary" onClick={resetPreferences}>{t('reset')}</button></footer>
 </section>;
}
