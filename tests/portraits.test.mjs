import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PORTRAIT_FIELDS,samePortraitIdentity,localPortraitPath,portraitPriority,portraitUpdate,portraitIndex,resolvePortrait,mergePortraits,portraitFrame} from '../src/portraits.mjs';
import {newGame,migrateGame,createMatch,currentFixture,tickMatch,validateGame} from '../src/engine.mjs';

const person={id:'e123',name:'João García',sourceId:'123',birthDate:'2001-05-04',clubId:'transferred-club',photo:''};
const candidate={...person,clubId:'original-club',photo:'/portraits/e123-new.webp',photoUrl:'https://example.com/joao.webp',photoSource:'Club official website',photoSourceUrl:'https://example.com/players/joao',photoVerified:true,photoUpdatedAt:'2026-10-03T01:00:00Z',photoDigest:'new123',photoPriority:100};
const withoutPhotos=g=>{const copy=structuredClone(g);for(const p of Object.values(copy.players))for(const k of PORTRAIT_FIELDS)delete p[k];return copy;};

test('photo identity uses player identity rather than a changing career club',()=>{
 assert.ok(samePortraitIdentity(person,candidate));assert.ok(samePortraitIdentity(person,{...candidate,name:'Joao Garcia'}));
 assert.ok(samePortraitIdentity(person,{...candidate,name:'João Pedro García'}));
 assert.equal(samePortraitIdentity(person,{...candidate,birthDate:'1998-05-04'}),false);
 assert.equal(samePortraitIdentity(person,{...candidate,sourceId:'999'}),false);
 assert.equal(samePortraitIdentity(person,{...candidate,id:'e999'}),false);
 assert.equal(samePortraitIdentity(person,{...candidate,name:'Different player',birthDate:undefined,sourceId:undefined}),false);
});

test('only verified, attributed local portraits may enter a saved career',()=>{
 assert.ok(localPortraitPath('/portraits/e123-new.webp'));
 for(const path of ['https://example.com/a.jpg','//example.com/a.jpg','/portraits/../private.jpg','/portraits/%2e%2e/a.jpg','/portraits/avatar.svg','/portraits/name.png?remote=1'])assert.equal(localPortraitPath(path),false,path);
 for(const patch of [{photoVerified:false},{photo:'https://example.com/a.jpg'},{photoSource:''},{photoSourceUrl:'javascript:alert(1)'},{name:'Different player',birthDate:undefined,sourceId:undefined}])assert.equal(portraitUpdate(person,{...candidate,...patch}),null);
 assert.equal(portraitUpdate(person,undefined),null);
 assert.equal(portraitUpdate(person,candidate).photo,candidate.photo);
});

test('source priority honours official legacy photos and never downgrades them to feeds',()=>{
 const official={...person,photo:'/portraits/old.jpg',photoSource:'FC Barcelona official website'};
 assert.equal(portraitPriority(official),100);
 assert.equal(portraitPriority({...candidate,photoSource:'League official website',photoPriority:90}),90);
 assert.equal(portraitUpdate(official,{...candidate,photoSource:'FotMob',photoPriority:70}),null);
 assert.equal(portraitUpdate(official,{...candidate,photoSource:'ESPN',photoPriority:60}),null);
 assert.equal(portraitUpdate({...person,photo:'/portraits/old.jpg',source:'ESPN'},candidate).photo,candidate.photo);
 assert.equal(portraitUpdate(official,candidate).photo,candidate.photo);
});

test('a stale photo index cannot overwrite a newer verified photo',()=>{
 const saved={...candidate};
 assert.equal(portraitUpdate(saved,{...candidate,photo:'/portraits/older.jpg',photoDigest:'older',photoUpdatedAt:'2026-09-01T00:00:00Z'}),null);
 assert.equal(portraitUpdate(saved,{...candidate,photo:'/portraits/older.jpg',photoDigest:'older',photoUpdatedAt:undefined}),null);
 assert.equal(portraitUpdate(saved,{...candidate,photo:'/portraits/latest.jpg',photoDigest:'latest',photoUpdatedAt:'2026-10-04T00:00:00Z'}).photo,'/portraits/latest.jpg');
 assert.equal(portraitUpdate(saved,candidate),null);
});

test('older metadata for the same asset cannot roll back its timestamp or clear a newer crop',()=>{
 const saved={...candidate,photoUpdatedAt:'2026-10-04T00:00:00Z',photoFraming:{x:.2,y:.1,w:.3,h:.4}};
 const older={...candidate,photoUpdatedAt:'2026-10-01T00:00:00Z',photoSourceUrl:'https://example.com/players/old',photoDigest:saved.photoDigest};
 assert.equal(portraitUpdate(saved,older),null);
 const missingAttribution={...saved};delete missingAttribution.photoUrl;
 const enriched={...missingAttribution,...portraitUpdate(missingAttribution,older)};
 assert.equal(enriched.photoUrl,candidate.photoUrl);assert.equal(enriched.photoUpdatedAt,saved.photoUpdatedAt);assert.equal(enriched.photoSourceUrl,saved.photoSourceUrl);assert.deepEqual(enriched.photoFraming,saved.photoFraming);
 assert.equal(portraitUpdate(enriched,{...candidate,photo:'/portraits/intermediate.jpg',photoDigest:'intermediate',photoUpdatedAt:'2026-10-02T00:00:00Z'}),null);
});

test('portrait display frames are bounded, idempotent and cleared for a newer unframed photo',()=>{
 const frame={x:.2,y:.1,w:.3,h:.4};assert.deepEqual(portraitFrame({...frame,unexpected:'ignored'}),frame);
 for(const invalid of [null,{},'crop',{...frame,x:-.1},{...frame,y:-.1},{...frame,w:.01},{...frame,h:0},{...frame,x:.8},{...frame,y:.9},{...frame,h:Infinity},{...frame,w:'0.3'}])assert.equal(portraitFrame(invalid),null);
 const framed={...person,...portraitUpdate(person,{...candidate,photoFraming:frame})};assert.deepEqual(framed.photoFraming,frame);
 assert.equal(portraitUpdate(framed,JSON.parse(JSON.stringify({...candidate,photoFraming:frame}))),null);
 const newer={...candidate,photo:'/portraits/new-headshot.png',photoDigest:'new-headshot',photoUpdatedAt:'2026-10-04T00:00:00Z'};
 assert.equal(portraitUpdate(framed,newer).photoFraming,null);
 const cleared={...framed,...portraitUpdate(framed,newer)};assert.equal(portraitUpdate(cleared,newer),null);
 const invalidPatch=portraitUpdate(person,{...candidate,photoFraming:{x:-1,y:0,w:1,h:1}});assert.equal(invalidPatch.photoFraming,undefined);
});

test('manual-photo markers are preserved for custom and imported careers',()=>{
 for(const marker of [{photoLocked:true},{photoCustom:true},{photoManual:true},{photoSource:'Người chơi chỉnh trong Editor'},{photoSource:'Custom portrait'}])assert.equal(portraitUpdate({...person,...marker},candidate),null);
});

test('index resolution is immutable and copies only portrait fields',()=>{
 const original=structuredClone(person),index=portraitIndex({players:[{...candidate,attributes:{finishing:1},wage:0,name:'Joao Garcia'}]});
 const resolved=resolvePortrait(person,index);assert.equal(resolved.photo,candidate.photo);assert.equal(resolved.name,person.name);assert.equal(resolved.clubId,person.clubId);assert.equal(resolved.wage,undefined);assert.equal(resolved.attributes,undefined);assert.deepEqual(person,original);
 assert.equal(resolvePortrait(person,portraitIndex({players:[]})),person);
 assert.equal(portraitIndex({players:{[candidate.id]:candidate}})[candidate.id],candidate);
});

test('server-side photo merge preserves all gameplay including active match, edits and RNG',()=>{
 const game={players:{[person.id]:{...person,attributes:{finishing:20},wage:543210,value:987654321,fitness:72,clubId:'user-purchased-club'}},clubs:{club:{cash:5555555,budget:6666666}},lineup:[person.id],rng:876543,liveMatch:{minute:63,rng:12345,score:[4,1],lineups:[[person.id],[]],events:[{type:'goal',text:'Saved event'}]},editorLog:[{text:'User edit'}]};
 const before=withoutPhotos(game);assert.equal(mergePortraits(game,{players:[candidate]}),1);assert.deepEqual(withoutPhotos(game),before);assert.equal(game.players[person.id].photo,candidate.photo);assert.equal(mergePortraits(game,{players:[candidate]}),0);
});

test('all supported save schemas acquire matching photos without disturbing a live match',()=>{
 const db=JSON.parse(fs.readFileSync(new URL('../public/data/database.json',import.meta.url),'utf8'));
 const original=newGame(db,'e83','Portrait QA',947);let live=createMatch(original,currentFixture(original));for(let i=0;i<12;i++)live=tickMatch(original,live);original.liveMatch=live;
 const id=original.lineup[0],raw=db.players.find(p=>p.id===id);Object.assign(raw,{photo:'/portraits/verified-update.webp',photoSource:'Club official website',photoSourceUrl:'https://example.com/players/verified',photoVerified:true,photoUpdatedAt:'2099-01-01T00:00:00Z',photoDigest:'verification123',photoPriority:100});
 original.clubs[original.clubId].cash=76543210;original.players[id].attributes.finishing=20;
 for(const schema of [1,2,3]){
  const input=structuredClone(original);input.schema=schema;const before=structuredClone(input),loaded=migrateGame(input,db);
  assert.equal(loaded.players[id].photo,raw.photo);assert.deepEqual(input,before,'migration never mutates input');
  for(const key of ['rng','round','date','clubs','lineup','fixtures','transfers','ledger','history','liveMatch'])assert.deepEqual(loaded[key],before[key],`schema ${schema}: ${key}`);
  assert.deepEqual(loaded.players[id].attributes,before.players[id].attributes);assert.ok(validateGame(loaded));
  if(schema===3)assert.deepEqual(withoutPhotos(loaded),withoutPhotos(before));
 }
});
