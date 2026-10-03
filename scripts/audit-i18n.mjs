/** Audit actual JSX literals and dynamic templates against the shipped catalogs.
 * Run: node scripts/audit-i18n.mjs [--strict]
 * Player/club records and source documents are deliberately outside this UI audit.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {transformSync} from 'esbuild';
import {parseAst} from 'rollup/parseAst';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const languages=['en','fr','es','pt'];
const catalogs=Object.fromEntries(languages.map(language=>{
 const catalog={};
 for(const directory of ['','domain','domain-reports']){
  const filename=path.join(root,'src/locales',directory,`${language}.json`);
  if(fs.existsSync(filename))Object.assign(catalog,JSON.parse(fs.readFileSync(filename,'utf8')));
 }
 return [language,catalog];
}));
const candidates=new Map();
const inlineLocaleMaps=[];
// These are Vietnamese controls or intentionally English UI labels, not names,
// identifiers or football position/country codes. Diacritic detection misses them.
const unaccentedUi=new Set(['Sau','Trang','Thu','Chi','BHL','BHL:','CLB','NL','HLV','New Game','NEW GAME','Load Game','Saved Games','Save as']);
const add=(text,file,explicitUi=false)=>{
 const key=text.trim();
 if(key.length<2||(!explicitUi&&!unaccentedUi.has(key)&&!/[À-ỹĐđ]/u.test(key)))return;
 if(!candidates.has(key))candidates.set(key,new Set());
 candidates.get(key).add(file);
};
for(const file of fs.readdirSync(path.join(root,'src')).filter(name=>name.endsWith('.jsx'))){
 const {code}=transformSync(fs.readFileSync(path.join(root,'src',file),'utf8'),{loader:'jsx'});
 const walk=(node,parent)=>{
  if(!node||typeof node!=='object')return;
  // Native browser validation is selected directly from a complete locale map,
  // so its already-translated sentences must not become Vietnamese source keys.
  if(node.type==='ObjectExpression'){
   const keys=node.properties.map(property=>property.key?.name??property.key?.value);
   if(['vi',...languages].every(language=>keys.includes(language))){inlineLocaleMaps.push(file);return;}
  }
  if(node.type==='Literal'&&typeof node.value==='string')add(node.value,file);
  if(node.type==='TemplateLiteral')add(node.quasis.map((part,index)=>part.value.cooked+(index<node.expressions.length?`{{${index}}}`:'')).join(''),file);
  if(node.type==='BinaryExpression'&&node.operator==='+'&&!(parent?.type==='BinaryExpression'&&parent.operator==='+')){
   let index=0;const parts=[];
   const flatten=part=>{
    if(part.type==='BinaryExpression'&&part.operator==='+'){flatten(part.left);flatten(part.right);}
    else if(part.type==='Literal'&&typeof part.value==='string')parts.push(part.value);
    else parts.push(`{{${index++}}}`);
   };
   flatten(node);const key=parts.join('');add(key,file,key.includes('Xem CLB'));
  }
  for(const value of Object.values(node)){
   if(Array.isArray(value))value.forEach(child=>walk(child,node));
   else if(value&&typeof value==='object')walk(value,node);
  }
 };
 walk(parseAst(code));
}

const missing=[];
for(const [key,files] of candidates){
 const absent=languages.filter(language=>!Object.hasOwn(catalogs[language],key));
 if(absent.length)missing.push({key,languages:absent,files:[...files]});
}
const invalid=[];
const slots=text=>[...text.matchAll(/\{\{(\d+)\}\}/g)].map(match=>match[1]).sort().join(',');
for(const language of languages)for(const [key,value] of Object.entries(catalogs[language])){
 if(typeof value!=='string'||!value.trim())invalid.push({language,key,reason:'Empty or non-string translation'});
 else if(slots(key)!==slots(value))invalid.push({language,key,reason:'Interpolation placeholders differ'});
}
const report={uiSourceKeys:candidates.size,fullyCovered:candidates.size-missing.length,inlineLocaleMaps,catalogKeys:Object.fromEntries(languages.map(language=>[language,Object.keys(catalogs[language]).length])),missing,invalid};
console.log(JSON.stringify(report,null,2));
if(invalid.length||(process.argv.includes('--strict')&&missing.length))process.exitCode=1;
