import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../src/transfers.mjs';
import {initializeStaff,staffMembers,assignStaffTask} from '../src/staff.mjs';

function fresh(){
 const clubs={},players={};
 for(let c=0;c<8;c++){
  const id=`c${c}`;clubs[id]={id,name:`Club ${c}`,reputation:c?72+c:90,cash:250000000,budget:150000000,wageBudget:2000000,leagueId:`league${c%3}`};
  for(let i=0;i<24;i++){
   const position=i<2?'GK':i<10?'DF':i<18?'MF':'FW',pid=`${id}-p${i}`;
   players[pid]={id:pid,clubId:id,name:`Player ${c}-${i}`,position,number:String(i+1),age:20+i%13,wage:5000+i*100,value:1000000+i*50000,contractUntil:2029,listed:i===20,injury:0,morale:80,fitness:99,appearances:7,goals:3,assists:2,seasonMinutes:580,form:[7.1,6.9],attributes:Object.fromEntries(['pace','stamina','strength','finishing','passing','dribbling','tackling','positioning','vision','composure','reflexes','handling','heading','crossing','teamwork','decisions'].map(k=>[k,12+(i+c)%4]))};
  }
 }
 return {id:'market-test',year:2026,date:'2026-08-15',round:0,rng:1357,clubId:'c0',manager:'Test',clubs,players,messages:[],transfers:[],ledger:[],lineup:Object.keys(players).slice(0,11),liveMatch:null};
}
function agreed(g,pid='c1-p14'){
 const {deal}=T.beginNegotiation(g,pid);assert.equal(deal.stage,'club');
 assert.equal(T.submitClubOffer(g,deal.id,{...deal.clubDemand}).ok,true);assert.equal(deal.stage,'contract');
 assert.equal(T.submitContractOffer(g,deal.id,{...deal.playerDemand}).ok,true);assert.equal(deal.stage,'agreed');return deal;
}
const totalCash=g=>Object.values(g.clubs).reduce((s,c)=>s+c.cash,0);

test('market migration is additive, deterministic and never rewrites a live career',()=>{
 const g=fresh();g.liveMatch={minute:37,rng:9001};const before=structuredClone(g);
 assert.equal(T.validateTransferMarket(g),true);T.initializeTransferMarket(g);
 for(const [key,value]of Object.entries(before))assert.deepEqual(g[key],value,key);
 assert.equal(g.marketVersion,1);assert.equal(T.validateTransferMarket(g),true);
 const loaded=JSON.parse(JSON.stringify(g));T.initializeTransferMarket(loaded);assert.deepEqual(loaded,g);
 const same=fresh();T.initializeTransferMarket(same);assert.equal(same.transferMarket.rng,g.transferMarket.rng);
});

test('club and player counteroffers persist; explicit final signing is the only money/identity movement',()=>{
 const g=fresh(),p=g.players['c1-p14'],before=structuredClone(g),opened=T.beginNegotiation(g,p.id),d=opened.deal;
 assert.equal(opened.ok,true);assert.equal(d.stage,'club');assert.equal(T.finalizeNegotiation(g,d.id).ok,false);
 let result=T.submitClubOffer(g,d.id,{fee:Math.floor(d.clubDemand.fee*.85),sellOnPercent:d.clubDemand.sellOnPercent});
 assert.equal(result.ok,true);assert.equal(d.stage,'club');assert.equal(d.clubRounds,1);assert.ok(d.history.some(h=>h.side==='club'&&h.text.includes('trả giá')));
 const loaded=JSON.parse(JSON.stringify(g));T.initializeTransferMarket(loaded);assert.deepEqual(T.getNegotiation(loaded,p.id),d);assert.equal(T.beginNegotiation(loaded,p.id).deal.id,d.id);
 T.submitClubOffer(g,d.id,{...d.clubDemand});assert.equal(d.stage,'contract');
 result=T.submitContractOffer(g,d.id,{...d.playerDemand,wage:Math.floor(d.playerDemand.wage*.8)});assert.equal(result.ok,true);assert.equal(d.stage,'contract');
 T.submitContractOffer(g,d.id,{...d.playerDemand});assert.equal(d.stage,'agreed');assert.deepEqual(g.clubs,before.clubs);assert.deepEqual(g.players,before.players);assert.equal(g.rng,before.rng);
 const hooks=[],sellerCash=g.clubs.c1.cash,budget=g.clubs.c0.budget,total=d.clubAgreement.fee+d.contractAgreement.signingBonus+d.contractAgreement.agentFee;
 result=T.finalizeNegotiation(g,d.id,{invalidateRosters:()=>hooks.push('cache'),onTransfer:()=>hooks.push('registration'),repairLineup:()=>hooks.push('lineup')});
 assert.equal(result.ok,true);assert.equal(d.stage,'completed');assert.equal(p.clubId,'c0');assert.equal(g.clubs.c0.budget,budget-total);assert.equal(g.clubs.c1.cash,sellerCash+d.clubAgreement.fee);assert.deepEqual(hooks,['cache','registration','lineup']);
 assert.equal(p.wage,d.contractAgreement.wage);assert.equal(p.contractUntil,g.year+d.contractAgreement.years);assert.equal(p.contractTerms.sellOnClubId,'c1');assert.equal(p.appearances,before.players[p.id].appearances);assert.equal(p.goals,before.players[p.id].goals);assert.deepEqual(p.form,before.players[p.id].form);
 assert.equal(Object.values(g.players).filter(x=>x.clubId==='c0'&&x.number===p.number).length,1);assert.equal(g.transfers.length,1);assert.equal(g.messages[0].paragraphs.length>=6,true);assert.equal(T.finalizeNegotiation(g,d.id).ok,false);assert.equal(g.transfers.length,1);assert.equal(T.validateTransferMarket(g),true);
});

test('invalid numbers, funds, wage budgets and active matches cannot partially finalize a deal',()=>{
 const g=fresh(),d=agreed(g),copy=structuredClone(g);
 for(const terms of [{fee:NaN,sellOnPercent:0},{fee:1,sellOnPercent:31},{fee:-1,sellOnPercent:0}])assert.equal(T.submitClubOffer(g,d.id,terms).ok,false);
 assert.deepEqual(g,copy);
 g.clubs.c0.cash=0;const cashBefore=structuredClone(g);assert.equal(T.finalizeNegotiation(g,d.id).ok,false);assert.deepEqual(g,cashBefore);
 g.clubs.c0.cash=250000000;g.clubs.c0.wageBudget=0;assert.equal(T.finalizeNegotiation(g,d.id).ok,false);assert.equal(d.stage,'agreed');assert.equal(g.players[d.playerId].clubId,'c1');
 g.clubs.c0.wageBudget=2000000;g.liveMatch={minute:12};const liveBefore=structuredClone(g);assert.equal(T.finalizeNegotiation(g,d.id).ok,false);assert.equal(T.withdrawNegotiation(g,d.id).ok,false);assert.equal(T.runAITransfers(g).ok,false);assert.deepEqual(g,liveBefore);
});

test('unreasonable offers are durable refusals with cooldown and low reputation also matters',()=>{
 const g=fresh(),{deal:d}=T.beginNegotiation(g,'c1-p14');
 assert.equal(T.submitClubOffer(g,d.id,{fee:1,sellOnPercent:0}).ok,true);assert.equal(d.stage,'rejected');assert.ok(d.cooldownUntil>g.date);assert.equal(T.beginNegotiation(g,d.playerId).ok,false);
 const loaded=JSON.parse(JSON.stringify(g));assert.equal(T.getNegotiation(loaded,d.playerId).stage,'rejected');loaded.date='2026-08-30';assert.equal(T.beginNegotiation(loaded,d.playerId).deal.stage,'club');
 const poor=fresh();poor.clubs.c0.reputation=30;const refused=T.beginNegotiation(poor,'c1-p14');assert.equal(refused.ok,true);assert.equal(refused.deal.stage,'rejected');assert.match(refused.message,/danh tiếng/);
});

test('sellers retain sixteen players and never sell their only goalkeeper',()=>{
 const g=fresh();delete g.players['c1-p1'];const answer=T.beginNegotiation(g,'c1-p0');assert.equal(answer.ok,true);assert.equal(answer.deal.stage,'rejected');assert.match(answer.message,/thủ môn/);
 const small=fresh();for(let i=16;i<24;i++)delete small.players[`c1-p${i}`];assert.equal(T.beginNegotiation(small,'c1-p14').deal.stage,'rejected');
});

test('release clauses unlock the seller price and prior sell-on payments reach the former club',()=>{
 assert.equal(T.minimumReleaseClause(97158000),106873800);
 const g=fresh(),p=g.players['c1-p14'];p.contractTerms={wage:p.wage,signingBonus:0,agentFee:0,appearanceBonus:0,goalBonus:0,years:3,releaseClause:100000,annualRise:0,squadRole:'starter',sellOnClubId:'c2',sellOnPercent:20,signedAt:'2025-08-01',signedYear:2025};
 const {deal:d}=T.beginNegotiation(g,p.id);assert.equal(d.clubDemand.fee,100000);T.submitClubOffer(g,d.id,{fee:100000,sellOnPercent:10});assert.equal(d.stage,'contract');T.submitContractOffer(g,d.id,{...d.playerDemand});
 const oldOwner=g.clubs.c2.cash,seller=g.clubs.c1.cash;T.finalizeNegotiation(g,d.id);assert.equal(g.clubs.c2.cash,oldOwner+20000);assert.equal(g.clubs.c1.cash,seller+80000);assert.equal(g.transfers[0].sellOnPayment,20000);
 const prior=g.clubs.c1.cash,bank=totalCash(g);const result=T.sellToAI(g,p.id);assert.equal(result.ok,true);assert.equal(result.transfer.sellOnPayment,Math.round(result.transfer.fee*.1));assert.equal(g.clubs.c1.cash,prior+result.transfer.sellOnPayment-(result.transfer.to==='c1'?result.transfer.upfrontCost:0));assert.equal(totalCash(g),bank-result.transfer.terms.signingBonus-result.transfer.terms.agentFee);assert.equal(T.validateTransferMarket(g),true);
 const edited=fresh();edited.players['c0-p15'].wage=0;assert.equal(T.sellToAI(edited,'c0-p15').ok,true);assert.ok(edited.players['c0-p15'].wage>=100);assert.equal(T.validateTransferMarket(edited),true);
});

test('stale or expired agreements terminate safely and cannot sign a player who already moved',()=>{
 const g=fresh(),d=agreed(g);g.players[d.playerId].clubId='c3';const funds=structuredClone(g.clubs);const result=T.finalizeNegotiation(g,d.id);assert.equal(result.ok,true);assert.equal(d.stage,'expired');assert.deepEqual(g.clubs,funds);assert.equal(g.transfers.length,0);
 const expired=fresh(),de=agreed(expired);expired.date='2026-09-13';assert.equal(T.finalizeNegotiation(expired,de.id).deal.stage,'expired');assert.equal(T.beginNegotiation(expired,de.playerId).deal.stage,'club');
});

test('AI clubs trade deterministically with each other once per date without altering managed players or match RNG',()=>{
 const g=fresh(),other=structuredClone(g),own=Object.values(g.players).filter(p=>p.clubId===g.clubId).map(p=>structuredClone(p)),originalClub=structuredClone(g.clubs.c0),cash=totalCash(g),original=g.rng,seen=[];
 const result=T.runAITransfers(g,{onTransfer:(state,t)=>seen.push(t.eventId)}),repeat=T.runAITransfers(other);
 assert.equal(result.ok,true);assert.ok(result.transfers.length>=2&&result.transfers.length<=6);assert.deepEqual(result,repeat);assert.deepEqual(g.transfers,other.transfers);assert.equal(g.rng,original);assert.deepEqual(g.clubs.c0,originalClub);assert.deepEqual(Object.values(g.players).filter(p=>p.clubId===g.clubId),own);assert.equal(seen.length,result.transfers.length);
 assert.ok(result.transfers.every(t=>t.from!==g.clubId&&t.to!==g.clubId&&t.isAI));assert.equal(totalCash(g),cash-result.transfers.reduce((s,t)=>s+t.terms.signingBonus+t.terms.agentFee,0));
 const snapshot=structuredClone(g);assert.deepEqual(T.runAITransfers(g).transfers,[]);assert.deepEqual(g,snapshot);
 for(const c of Object.values(g.clubs))assert.ok(Object.values(g.players).filter(p=>p.clubId===c.id).length>=16);
 const moved=new Set(result.transfers.map(t=>t.id));g.date='2026-08-22';const week2=T.runAITransfers(g);assert.ok(week2.transfers.every(t=>!moved.has(t.id)));assert.equal(T.validateTransferMarket(g),true);
});

test('AI transfer fee rounding never exceeds an existing low-value release clause',()=>{
 const g=fresh(),releaseClause=1520;
 for(const p of Object.values(g.players))if(p.clubId!==g.clubId){p.value=2000;p.contractTerms={wage:p.wage,signingBonus:0,agentFee:0,appearanceBonus:0,goalBonus:0,years:3,releaseClause,annualRise:0,squadRole:'rotation',sellOnClubId:'c0',sellOnPercent:0,signedAt:'2025-08-01',signedYear:2025};}
 const result=T.runAITransfers(g);assert.ok(result.transfers.length>=2);assert.ok(result.transfers.every(t=>t.fee<=releaseClause));assert.equal(T.validateTransferMarket(g),true);
});

test('contract validation rejects malformed financial terms, market state and missing agreed terms',()=>{
 const source=fresh();agreed(source);assert.equal(T.validateTransferMarket(source),true);
 const bad=change=>{const g=structuredClone(source);change(g);assert.throws(()=>T.validateTransferMarket(g));};
 bad(g=>g.transferMarket.rng=-1);bad(g=>g.transferMarket.processedDates=['2026-08-15','2026-08-15']);bad(g=>g.negotiations[0].contractAgreement.wage=Infinity);bad(g=>g.negotiations[0].contractAgreement.years=9);bad(g=>delete g.negotiations[0].clubAgreement);bad(g=>g.negotiations[0].stage='invented');
 T.finalizeNegotiation(source,source.negotiations[0].id);const invalid=structuredClone(source);invalid.players['c1-p14'].contractTerms.sellOnPercent=100;assert.throws(()=>T.validateTransferMarket(invalid));
 const legacy=structuredClone(source);delete legacy.marketVersion;delete legacy.negotiations;delete legacy.transferMarket;
 assert.throws(()=>T.validateTransferMarket(legacy));
 delete legacy.players['c1-p14'].contractTerms;assert.equal(T.validateTransferMarket(legacy),true);
 legacy.players['c1-p14'].contractTerms={wage:-1};assert.throws(()=>T.validateTransferMarket(legacy));
 for(const change of [t=>t.bonusPaidFixtures='wrong',t=>t.bonusPaidFixtures=['match','match'],t=>t.promiseStartMinutes=NaN,t=>t.promiseFrom='2026-02-31',t=>t.lastPromiseReview=4,t=>t.promiseWarned=1]){const g=structuredClone(source);change(g.players['c1-p14'].contractTerms);assert.throws(()=>T.validateTransferMarket(g));}
});

test('assigned negotiating expertise changes the actual seller ask and every visible counter can be accepted',()=>{
 const noDirector=fresh(),expert=fresh();initializeStaff(expert);
 const director=staffMembers(expert).find(s=>s.role==='sportingDirector');for(const key of Object.keys(director.attributes))director.attributes[key]=20;assignStaffTask(expert,'transfers',director.id);
 const a=T.beginNegotiation(noDirector,'c1-p14').deal,b=T.beginNegotiation(expert,'c1-p14').deal;assert.ok(b.clubDemand.fee<a.clubDemand.fee*.96);
 T.submitClubOffer(noDirector,a.id,{fee:Math.floor(a.clubDemand.fee*.8),sellOnPercent:3});
 T.submitClubOffer(noDirector,a.id,{fee:Math.floor(a.clubDemand.fee*.8),sellOnPercent:3});
 T.submitClubOffer(noDirector,a.id,{fee:Math.floor(a.clubDemand.fee*.8),sellOnPercent:3});
 assert.equal(a.stage,'club');assert.equal(a.clubPatience,1);assert.equal(T.submitClubOffer(noDirector,a.id,{...a.clubDemand}).ok,true);assert.equal(a.stage,'contract');
});

test('unlimited money cannot force a content long-contract cornerstone to leave, but an actual transfer request changes availability',()=>{
 const g=fresh(),p=g.players['c1-p14'];g.clubs.c1.reputation=90;g.clubs.c0.reputation=90;g.clubs.c0.cash=1e12;g.clubs.c0.budget=1e12;p.contractUntil=2031;
 for(const key of Object.keys(p.attributes))p.attributes[key]=19;
 const rejected=T.beginNegotiation(g,p.id).deal;assert.equal(rejected.stage,'rejected');assert.equal(rejected.assessment.cornerstone,true);assert.match(rejected.reason,/nền tảng/);
 const snapshot=structuredClone(g);assert.equal(T.submitClubOffer(g,rejected.id,{fee:1e12,sellOnPercent:30}).ok,false);assert.deepEqual(g,snapshot);
 p.dynamics={wantsToLeave:true};g.date='2026-08-30';assert.equal(T.beginNegotiation(g,p.id).deal.stage,'club');
});

test('direct competitors and scarce natural positions are priced differently; a release clause still permits talks',()=>{
 const g=fresh(),p=g.players['c1-p14'];g.clubs.c0.reputation=86;g.clubs.c1.reputation=86;g.clubs.c1.leagueId=g.clubs.c0.leagueId;p.naturalPositions=['DM'];
 for(const key of Object.keys(p.attributes))p.attributes[key]=17;
 for(const mate of Object.values(g.players).filter(x=>x.clubId===p.clubId&&x.id!==p.id))mate.naturalPositions=['CM'];
 const blocked=T.beginNegotiation(g,p.id).deal;assert.equal(blocked.stage,'rejected');assert.equal(blocked.assessment.replacements,0);assert.match(blocked.reason,/đối thủ/);
 const open=fresh(),target=open.players['c1-p14'];Object.assign(open.clubs.c1,{reputation:86,leagueId:open.clubs.c0.leagueId});for(const key of Object.keys(target.attributes))target.attributes[key]=17;
 target.contractTerms={releaseClause:4000000};const deal=T.beginNegotiation(open,target.id).deal;assert.equal(deal.stage,'club');assert.ok(deal.clubDemand.fee<=4000000);T.submitClubOffer(open,deal.id,{fee:4000000,sellOnPercent:0});assert.equal(deal.stage,'contract');
});

test('market value is separate from asking price and contract duration, injury and listing influence the quote',()=>{
 const base=fresh(),long=structuredClone(base),short=structuredClone(base),injured=structuredClone(base),listed=structuredClone(base),id='c1-p14';
 long.players[id].contractUntil=2031;short.players[id].contractUntil=2027;injured.players[id].injury=10;listed.players[id].listed=true;
 const standard=T.beginNegotiation(base,id).deal.clubDemand.fee;
 assert.notEqual(standard,base.players[id].value);
 assert.ok(T.beginNegotiation(long,id).deal.clubDemand.fee>standard);
 assert.ok(T.beginNegotiation(short,id).deal.clubDemand.fee<standard);
 assert.ok(T.beginNegotiation(injured,id).deal.clubDemand.fee<standard);
 assert.ok(T.beginNegotiation(listed,id).deal.clubDemand.fee<standard);
 assert.ok([base,long,short,injured,listed].every(g=>g.players[id].value===base.players[id].value));
});

test('promised playing role cannot be bought out with an excessive salary; the published counteroffer remains reachable',()=>{
 const g=fresh(),p=g.players['c1-p14'];g.clubs.c0.reputation=75;
 const d=T.beginNegotiation(g,p.id).deal;T.submitClubOffer(g,d.id,{...d.clubDemand});assert.equal(d.playerDemand.squadRole,'star');
 T.submitContractOffer(g,d.id,{...d.playerDemand,wage:d.playerDemand.wage*5,squadRole:'prospect'});assert.equal(d.stage,'contract');assert.match(d.history.at(-1).text,/thời gian thi đấu/);
 T.submitContractOffer(g,d.id,{...d.playerDemand});assert.equal(d.stage,'agreed');
});

test('selling requires sporting need, acceptable wages and health even when other clubs have unlimited money',()=>{
 for(const reason of ['position','salary','injury']){
  const g=fresh(),p=g.players['c0-p14'];
  for(const c of Object.values(g.clubs))if(c.id!==g.clubId){c.cash=1e12;c.budget=1e12;c.wageBudget=1e10;}
  if(reason==='position')for(const mate of Object.values(g.players).filter(x=>x.clubId!==g.clubId))for(const key of Object.keys(mate.attributes))mate.attributes[key]=20;
  if(reason==='salary')p.wage=1000000;
  if(reason==='injury')p.injury=12;
  const before=structuredClone(g),result=T.sellToAI(g,p.id);assert.equal(result.ok,false,reason);assert.deepEqual(g,before,reason);
 }
 const g=fresh(),p=g.players['c0-p15'];p.listed=true;const quote=T.saleQuote(g,p),result=T.sellToAI(g,p.id);assert.equal(result.ok,true);assert.equal(result.transfer.fee,quote);assert.ok(quote<p.value);assert.equal(p.clubId,result.transfer.to);
});

test('AI clubs honor cornerstone refusals and older saved negotiations require no assessment migration',()=>{
 const g=fresh();for(const c of Object.values(g.clubs))c.reputation=90;
 for(const p of Object.values(g.players)){p.listed=false;p.contractUntil=2031;for(const key of Object.keys(p.attributes))p.attributes[key]=19;}
 const before=g.rng;assert.deepEqual(T.runAITransfers(g).transfers,[]);assert.equal(g.rng,before);
 const legacy=fresh(),d=agreed(legacy);delete d.assessment;assert.equal(T.validateTransferMarket(legacy),true);const restored=JSON.parse(JSON.stringify(legacy));assert.equal(T.finalizeNegotiation(restored,d.id).ok,true);
});
