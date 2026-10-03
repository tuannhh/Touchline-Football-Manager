import test,{afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {createElement as rawCreateElement} from 'react';
import {jsx,jsxs,localizedProps,localizedChildren} from '../src/localized-jsx-runtime.mjs';
import {createElement} from '../src/localized-react.mjs';
import {updatePreferences,resetPreferences} from '../src/preferences.mjs';
afterEach(()=>resetPreferences());
test('localized props preserve machine values, handlers and input objects',()=>{
 updatePreferences({language:'en'});
 const onClick=()=>{},game={id:'Tổng quan'},props=Object.freeze({children:'Tổng quan',title:'Đội hình',onClick,value:'Tổng quan',id:'Đội hình',href:'/Tổng quan',name:'Đội hình',className:'Đội hình','data-state':'Tổng quan',style:{width:'100%'},game});
 const result=localizedProps(props);
 assert.equal(result.children,'Overview');assert.notEqual(result.title,props.title);
 for(const key of ['onClick','value','id','href','name','className','data-state','style','game'])assert.equal(result[key],props[key],key);
 assert.equal(props.children,'Tổng quan');
});
test('adjacent text and numbers form one translated message while React elements retain identity',()=>{
 updatePreferences({language:'en'});
 const badge=rawCreateElement('strong',{key:'badge'},'Barcelona');
 const children=['  Mùa giải ',2026,'/',2027,'  ',badge,' · ','Tổng quan'];
 const output=localizedChildren(children);
 assert.equal(output[0],'  Season 2026/2027  ');assert.equal(output[1],badge);assert.equal(output.slice(2).join(''),' · Overview');
 assert.equal(badge.key,'badge');assert.equal(badge.props.children,'Barcelona');
 const jsxResult=jsxs('div',{children:['Pedri',' nhận thẻ vàng.',badge]});assert.equal(jsxResult.props.children[0],'Pedri receives a yellow card.');assert.equal(jsxResult.props.children[1],badge);
 const spreadResult=createElement('div',{key:'x'},'Mùa giải ',2026,'/',2027);assert.equal(spreadResult.props.children,'Season 2026/2027');
});
test('translate=no protects both JSX and createElement text without altering props',()=>{
 updatePreferences({language:'en'});
 const props=Object.freeze({translate:'no',children:['Tổng quan',1],title:'Đội hình'});
 assert.equal(localizedProps(props),props);assert.equal(jsx('span',props).props.children,props.children);
 const result=createElement('span',{translate:'no',title:'Đội hình'},'Tổng quan',1);
 assert.deepEqual(result.props.children,['Tổng quan',1]);assert.equal(result.props.title,'Đội hình');
});
test('unchanged children retain references and can translate again after a language switch',()=>{
 const children=['Tổng quan',rawCreateElement('i',{key:'icon'}),12],props={children};
 assert.equal(localizedChildren(children),children);assert.equal(localizedProps(props),props);
 updatePreferences({language:'en'});assert.equal(localizedChildren(children)[0],'Overview');
 updatePreferences({language:'fr'});assert.notEqual(localizedChildren(children)[0],'Overview');
 assert.equal(children[0],'Tổng quan');
});
