import test,{afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {i18n,translate} from '../src/i18n.mjs';
import {updatePreferences,resetPreferences} from '../src/preferences.mjs';
afterEach(()=>resetPreferences());
const slots=value=>[...value.matchAll(/\{\{(\d+)\}\}/g)].map(match=>match[1]).sort();
for(const language of ['en','fr','es','pt'])test(`${language}: every dynamic template preserves placeholders and matches its instantiated presentation text`,()=>{
 updatePreferences({language});
 const templates=Object.entries(i18n.getResourceBundle(language,'translation')).filter(([key])=>/\{\{\d+\}\}/.test(key));
 assert.ok(templates.length>100,'Domain and report templates must be included');
 for(const [key,translated] of templates){
  assert.deepEqual(slots(translated),slots(key),`Placeholder mismatch in ${key}`);
  for(const sentinel of [id=>`ZXQ_SENTINEL_${id}_QXZ`,id=>`ZXQ sentinel ${id} QXZ`]){
   const args=Object.fromEntries(slots(key).map(id=>[id,sentinel(id)]));
   const source=key.replace(/\{\{(\d+)\}\}/g,(_,id)=>args[id]);
   assert.equal(translate(source),i18n.t(key,{...args,ns:'translation'}),`Template precedence or capture mismatch in ${key}`);
  }
 }
});

test('bounded nested translation does not pollute subsequent top-level lookups',()=>{
 updatePreferences({language:'en'});
 translate('Chỉnh cầu thủ Chỉnh cầu thủ Pedri nhận thẻ vàng.');
 assert.equal(translate('Chỉnh cầu thủ Pedri'),'Edit player Pedri');
 assert.equal(translate('Pedri nhận thẻ vàng.'),'Pedri receives a yellow card.');
});
