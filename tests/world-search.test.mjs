import test from 'node:test';
import assert from 'node:assert/strict';
import {createSearchIndex,searchWorld} from '../src/worldSearch.mjs';
const world={players:{p1:{id:'p1',name:'Nguyễn Văn Đạt',clubId:'c1'},p2:{id:'p2',name:'Lamine Yamal',clubId:'c1'},p3:{id:'p3',name:'Yamal Junior',clubId:'c2'}},clubs:{c1:{id:'c1',name:'FC Barcelona',shortName:'Barcelona',abbreviation:'BAR'},c2:{id:'c2',name:'Đông Á Thanh Hóa',shortName:'Thanh Hóa'}}};
test('matches accents, Vietnamese đ, partial names and names in a different order',()=>{
 const index=createSearchIndex(world);
 for(const q of ['nguyen van dat','ĐẠT nguyễn','nguy dat'])assert.equal(searchWorld(index,q).results[0].id,'p1');
 assert.equal(searchWorld(index,'thanh hoa').results[0].id,'c2');
 assert.equal(searchWorld(index,'BAR').results[0].id,'c1');
 assert.equal(searchWorld(index,'YAM').total,2);
 assert.equal(searchWorld(index,'[.*]').total,0);
});
test('ranks exact names first, filters entity types and paginates without losing results',()=>{
 const g=structuredClone(world);g.players.p4={id:'p4',name:'Barcelona'};const index=createSearchIndex(g);
 const all=searchWorld(index,'barcelona');assert.equal(all.results[0].rank,0);assert.equal(all.total,2);assert.deepEqual(all.counts,{player:1,club:1});
 assert.equal(searchWorld(index,'barcelona',{type:'club'}).results[0].id,'c1');
 const first=searchWorld(index,'yam',{pageSize:1}),last=searchWorld(index,'yam',{page:999,pageSize:1});assert.equal(first.pages,2);assert.equal(last.page,1);assert.notEqual(first.results[0].id,last.results[0].id);
});
test('searches only the loaded career and neither invents nor changes records',()=>{
 const before=structuredClone(world),index=createSearchIndex(world);
 assert.equal(searchWorld(index,'   ').total,0);assert.equal(searchWorld(index,'unavailable').total,0);
 delete world.players.p2;assert.equal(searchWorld(createSearchIndex(world),'lamine').total,0);world.players.p2=before.players.p2;
 assert.deepEqual(world,before);
});
