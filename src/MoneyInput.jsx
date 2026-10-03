import React,{useSyncExternalStore} from 'react';
import NumberInput from './NumberInput.jsx';
import {getPreferences,subscribePreferences} from './preferences.mjs';
import {displayMoneyValue,getCurrencySymbol} from './locale.mjs';
import {editedMoneyValue} from './moneyInput.mjs';
import {translate} from './i18n.mjs';

export const moneyLabel=label=>translate(label).replaceAll('€',getCurrencySymbol());

// All game amounts remain EUR. Convert only at the input boundary, and avoid
// changing a canonical amount when an unchanged rounded display is blurred.
export default function MoneyInput({value,onChange,min=0,max=1e12,decimals=2,wholeEuro=false,...props}){
 const preferences=useSyncExternalStore(subscribePreferences,getPreferences,getPreferences);
 const displayed=displayMoneyValue(value),rounded=Number(displayed.toFixed(decimals));
 return <NumberInput {...props} key={preferences.currency+':'+preferences.exchangeRates[preferences.currency]} value={rounded} min={Number(displayMoneyValue(min).toFixed(decimals))} max={Number(displayMoneyValue(max).toFixed(decimals))} decimals={decimals} onChange={amount=>{if(amount!==rounded)onChange(editedMoneyValue(amount,{wholeEuro,min,max}));}}/>;
}
