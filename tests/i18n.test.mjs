import test,{afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {i18n,translate} from '../src/i18n.mjs';
import {updatePreferences,resetPreferences} from '../src/preferences.mjs';
afterEach(()=>resetPreferences());
test('language changes update the i18next instance, settings and whitespace-preserving UI translation',()=>{
 const settings={en:'Settings',fr:'Paramètres',es:'Ajustes',pt:'Definições'};
 assert.equal(translate(' Tổng quan '),' Tổng quan ');
 for(const [language,label] of Object.entries(settings)){
  updatePreferences({language});assert.equal(i18n.language,language);assert.equal(i18n.t('title',{ns:'settings'}),label);
  assert.notEqual(translate('Tổng quan'),'Tổng quan');assert.equal(translate('  Tổng quan \n'),'  '+translate('Tổng quan')+' \n');
  assert.equal(translate('Lamine Yamal'),'Lamine Yamal');assert.equal(translate(4),4);
 }
 updatePreferences({language:'vi'});assert.equal(translate('Tổng quan'),'Tổng quan');
});
test('dynamic presentation text translates without changing names, amounts or competing template matches',()=>{
 updatePreferences({language:'en'});
 assert.equal(translate('Pedri nhận thẻ vàng.'),'Pedri receives a yellow card.');
 assert.equal(translate('Barcelona đổi vị trí trong đội hình.'),'Barcelona changed a lineup position.');
 assert.equal(translate('Barcelona đổi vị trí Raphinha.'),'Barcelona changed the position of Raphinha.');
 assert.equal(translate('Số dư 1.234 €; ngân sách chuyển nhượng 900 €.'),'Balance 1.234 €; transfer budget 900 €.');
 assert.equal(translate('Sút bóng!'),'Shot!');
 updatePreferences({language:'fr'});assert.equal(translate('Pedri nhận thẻ vàng.'),'Pedri reçoit un carton jaune.');
 updatePreferences({language:'en'});assert.equal(translate('Pedri nhận thẻ vàng.'),'Pedri receives a yellow card.');
});

test('match commentary covers conditional shots, assists and quick-simulation event variants in every language',()=>{
 const examples=[
  ['Pedri dứt điểm, thủ môn cản phá!','Pedri shoots, the goalkeeper saves!'],
  ['Pedri sút bóng chệch khung thành.','Pedri shoots wide.'],
  ['Gabriel Jesus ghi bàn! Kiến tạo: Pedri.','Gabriel Jesus scores! Assist: Pedri.'],
  ['Gabriel Jesus ghi bàn!','Gabriel Jesus scores!'],
  ['Pedri ghi bàn.','Pedri scores.'],
  ['Pedri ghi bàn trong hiệp phụ.','Pedri scores in extra time.'],
  ['Pedri rời sân vì chấn thương.','Pedri leaves the pitch injured.'],
  ['Pedri nhận thẻ đỏ.','Pedri is sent off.'],
  ['Pedri nhận thẻ vàng thứ hai và rời sân.','Pedri receives a second yellow and is sent off.'],
  ['Pedri bị đau và không thể tiếp tục.','Pedri is injured and cannot continue.'],
  ['Pedri vào sân thay Gabriel Jesus.','Pedri comes on for Gabriel Jesus.'],
 ];
 for(const language of ['en','fr','es','pt']){
  updatePreferences({language});
  for(const [source,english] of examples){
   const output=translate(source);if(language==='en')assert.equal(output,english);
   assert.notEqual(output,source,`${language}: ${source}`);
   assert.doesNotMatch(output,/dứt điểm|cản phá|chệch khung thành|ghi bàn|Kiến tạo|rời sân|nhận thẻ|vào sân|hiệp phụ/);
   for(const name of ['Pedri','Gabriel Jesus'])if(source.includes(name))assert.ok(output.includes(name));
  }
 }
});

test('composed natural and secondary position lists translate while preserving role codes',async()=>{
 const {positionDescription}=await import('../src/playerPositions.mjs');
 const source=positionDescription({position:'FW',naturalPositions:['LW','ST'],otherPositions:['RW']});
 updatePreferences({language:'en'});
 assert.equal(translate(source),'Natural: LW · Left winger, ST · Striker · Secondary positions: RW · Right winger');
 assert.equal(translate('LW (Tiền đạo trái), ST (Tiền đạo cắm)'),'LW (Left winger), ST (Striker)');
 for(const language of ['fr','es','pt']){
  updatePreferences({language});const output=translate(source);assert.doesNotMatch(output,/Sở trường|Vị trí phụ|Tiền đạo/);for(const code of ['LW','ST','RW'])assert.ok(output.includes(code));
 }
});
