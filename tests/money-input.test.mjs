import test,{afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {updatePreferences,resetPreferences} from '../src/preferences.mjs';
import {editedMoneyValue} from '../src/moneyInput.mjs';
afterEach(resetPreferences);
test('editing a displayed currency produces canonical cents without binary floating-point residue',()=>{
 updatePreferences({currency:'USD'});
 assert.equal(editedMoneyValue(1100000),1000000);
 assert.equal(editedMoneyValue(11.01),10.01);
 updatePreferences({currency:'GBP'});assert.equal(editedMoneyValue(850),1000);
});
test('negotiation amounts remain whole euros and obey canonical wage/budget limits in all currencies',()=>{
 for(const currency of ['EUR','USD','GBP']){
  updatePreferences({currency});
  assert.equal(Number.isSafeInteger(editedMoneyValue(123456.78,{wholeEuro:true})),true);
  assert.equal(editedMoneyValue(0,{wholeEuro:true,min:100}),100);
  assert.equal(editedMoneyValue(1e10,{wholeEuro:true,max:1e6}),1e6);
 }
});
