import {fromDisplayMoneyValue} from './locale.mjs';
export function editedMoneyValue(display,{wholeEuro=false,min=0,max=1e12}={}){
 const euro=fromDisplayMoneyValue(display),rounded=wholeEuro?Math.round(euro):Math.round(euro*100)/100;
 return Math.max(min,Math.min(max,rounded));
}
