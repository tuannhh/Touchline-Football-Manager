import test from 'node:test';
import assert from 'node:assert/strict';
import * as F from '../src/financialSustainability.mjs';
import * as T from '../src/transfers.mjs';

function fresh(){
 const clubs={},players={};
 for(let c=0;c<8;c++){
  const id=`c${c}`;clubs[id]={id,name:`Club ${c}`,reputation:c?72+c:90,cash:250000000,budget:150000000,wageBudget:2000000,leagueId:c===0?'eng.1':'ger.1'};
  for(let i=0;i<24;i++){
   const position=i<2?'GK':i<10?'DF':i<18?'MF':'FW',pid=`${id}-p${i}`;
   players[pid]={id:pid,clubId:id,name:`Player ${c}-${i}`,position,number:String(i+1),age:20+i%13,wage:5000+i*100,value:1000000+i*50000,contractUntil:2029,listed:i===20,injury:0,morale:80,fitness:99,attributes:Object.fromEntries(['pace','stamina','strength','finishing','passing','dribbling','tackling','positioning','vision','composure','reflexes','handling','heading','crossing','teamwork','decisions'].map(k=>[k,12+(i+c)%4]))};
  }
 }
 return {id:'finance-test',year:2026,date:'2026-08-15',round:0,rng:1357,clubId:'c0',manager:'Test',clubs,players,messages:[],transfers:[],ledger:[],lineup:Object.keys(players).slice(0,11),liveMatch:null,cups:[]};
}
function agreed(g){const {deal}=T.beginNegotiation(g,'c1-p14');assert.equal(deal.stage,'club');T.submitClubOffer(g,deal.id,deal.clubDemand);T.submitContractOffer(g,deal.id,deal.playerDemand);assert.equal(deal.stage,'agreed');return deal;}

test('financial migration estimates opening accounts once without changing cash, players or match RNG',()=>{
 const g=fresh(),before=structuredClone(g);F.initializeFinancials(g);
 for(const [key,value]of Object.entries(before))assert.deepEqual(g[key],value,key);
 const saved=JSON.parse(JSON.stringify(g));F.initializeFinancials(saved);assert.deepEqual(saved,g);assert.equal(F.validateFinancials(saved),true);
 const r=F.financeReport(g);assert.ok(r.headroom>0);assert.equal(r.policy.id,'eng');assert.equal(r.policy.ratioLimit,.85);
 const baseline=r.revenue;g.players['c0-p0'].wage*=20;assert.equal(F.financeReport(g).revenue,baseline,'wage inflation must not create guaranteed revenue');
});

test('national rules select the appropriate cost basis and UEFA only applies to participants',()=>{
 const g=fresh();F.initializeFinancials(g);g.cups=[{id:'uefa.champions',kind:'uefa',participants:['c0']}];
 assert.equal(F.financeReport(g).policy.id,'uefa');assert.equal(F.financeReport(g,'c1').policy.id,'ger');
 g.clubs.c0.leagueId='por.1';g.cups=[];const row=g.financials.clubs.c0;row.squadBudget=1e10;row.baseRevenue=10000000;row.matchdayForecast=0;
 const report=F.financeReport(g);assert.equal(report.policy.id,'por');assert.equal(report.measuredCost,report.annualWages+report.annualStaffCost+report.annualBonuses);assert.equal(report.limit,7000000);
 row.transferProfit=9000000;assert.equal(F.financeReport(g).limit,7000000,'player-sale profits do not inflate ordinary salary-budget income');
 g.clubs.c0.leagueId='esp.1';assert.equal(F.financeReport(g).policy.kind,'budget');
 g.clubs.c0.leagueId='eng.3';assert.equal(F.financeReport(g).policy.id,'leagueOne','no false PL rule in the third division');
 g.clubs.c0.leagueId='eng.2';const champ=F.financeReport(g);assert.equal(champ.policy.id,'championship');assert.equal(champ.calculationRevenue,champ.revenue);
 const offer={wage:100,years:5,signingBonus:0,agentFee:0,appearanceBonus:0,goalBonus:0},preview=F.assessTransferFinancials(g,g.players['c1-p0'],'c0',1000000,offer);
 assert.equal(preview.projected.calculationRevenue,champ.calculationRevenue-1000000);assert.equal(preview.projected.limit,champ.limit-850000);
});

test('signing is blocked before any mutation when projected costs exceed the financial threshold despite abundant cash',()=>{
 const g=fresh();F.initializeFinancials(g);const deal=agreed(g),r=F.financeReport(g);g.financials.clubs.c0.baseRevenue=Math.floor(r.annualCost/.85);g.financials.clubs.c0.matchdayForecast=0;
 const before=structuredClone(g),result=T.finalizeNegotiation(g,deal.id);assert.equal(result.ok,false);assert.match(result.message,/Kiểm soát tài chính/);assert.deepEqual(g,before);
});

test('completed trades capitalize acquisition costs and recognize the seller net book profit exactly once',()=>{
 const g=fresh();F.initializeFinancials(g);const deal=agreed(g),id=deal.playerId,book=F.financialBookValue(g.financials.assets[id],g.date),r=F.financeReport(g);
 const result=T.finalizeNegotiation(g,deal.id);assert.equal(result.ok,true);const record=result.transfer;
 assert.equal(g.financials.assets[id].cost,record.upfrontCost);assert.equal(g.financials.clubs.c1.transferProfit,record.fee-book-record.sellOnPayment);
 assert.ok(F.financeReport(g).annualCost>r.annualCost);assert.equal(g.financials.clubs.c0.purchases,1);
 const snapshot=structuredClone(g.financials);F.recordTransferFinancials(g,record);assert.deepEqual(g.financials,snapshot);assert.equal(F.validateFinancials(g),true);
 const owned=g.financials.assets[id];assert.equal(F.financialBookValue(owned,g.date),record.upfrontCost);assert.equal(F.financialBookValue(owned,'2040-08-15'),0);
});

test('amortization is capped at five years and cash reserve is distinct from an annual cost limit',()=>{
 const g=fresh();F.initializeFinancials(g);const p=g.players['c1-p14'],terms={wage:100,years:99,signingBonus:100000,agentFee:100000,appearanceBonus:0,goalBonus:0};
 const result=F.assessTransferFinancials(g,p,'c0',1000000,terms);assert.equal(result.annualAddedCost,245200);
 g.clubs.c0.cash=1200001;const reserve=F.assessTransferFinancials(g,p,'c0',1000000,terms);assert.equal(reserve.ok,false);assert.match(reserve.message,/dự trữ/);
});

test('AI clubs continue completing needs-based deals and honor the same financial checks',()=>{
 const g=fresh();F.initializeFinancials(g);const rng=g.rng,result=T.runAITransfers(g);assert.ok(result.transfers.length>=2);assert.ok(result.transfers.every(t=>t.isAI&&t.from!=='c0'&&t.to!=='c0'));assert.equal(g.rng,rng);assert.equal(F.validateFinancials(g),true);
 const blocked=fresh();F.initializeFinancials(blocked);for(const row of Object.values(blocked.financials.clubs)){row.baseRevenue=1;row.matchdayForecast=0;row.squadBudget=1;}
 const original=structuredClone(blocked.clubs),answer=T.runAITransfers(blocked);assert.equal(answer.transfers.length,0);assert.deepEqual(blocked.clubs,original);assert.ok(blocked.transferMarket.lastActivity.financiallyLimitedClubs>0);
});

test('weekly revenue is fixed, accrues across schedule gaps and is never charged twice on the same date',()=>{
 const g=fresh();F.initializeFinancials(g);const cash=g.clubs.c0.cash,first=F.settleWeeklyFinancials(g).find(e=>e.clubId==='c0');assert.equal(first.days,7);assert.equal(g.clubs.c0.cash,cash+first.income-first.expense);
 assert.deepEqual(F.settleWeeklyFinancials(g),[]);g.date='2026-09-05';const next=F.settleWeeklyFinancials(g).find(e=>e.clubId==='c0');assert.equal(next.days,21);assert.equal(next.expense,first.expense*3);assert.ok(Math.abs(next.income-first.income*3)<=1);
});

test('attendance revenue settles once for home grounds and is split at neutral venues',()=>{
 const g=fresh();F.initializeFinancials(g);const home=g.clubs.c0.cash,away=g.clubs.c1.cash,f={id:'match1',home:'c0',away:'c1',date:g.date};
 const env={gateReceipts:100001,attendance:20000};F.settleMatchFinancials(g,f,env);assert.equal(g.clubs.c0.cash,home+100001);assert.equal(g.clubs.c1.cash,away);assert.deepEqual(F.settleMatchFinancials(g,f,env),[]);
 F.settleMatchFinancials(g,{...f,id:'neutral',neutral:true},env);assert.equal(g.clubs.c0.cash,home+150002);assert.equal(g.clubs.c1.cash,away+50000);assert.equal(g.financials.clubs.c0.actualMatchdayIncome,150002);
});

test('season rollover pays off-season wages, retains asset books and archives at most three seasons',()=>{
 const g=fresh();F.initializeFinancials(g);F.settleWeeklyFinancials(g);const original=structuredClone(g.financials.assets),cash=g.clubs.c0.cash;
 const oldLimit=F.financeReport(g).limit;g.cups=[{id:'uefa.champions',participants:['c0']}];g.year=2027;g.date='2027-08-15';F.rollFinancialSeason(g);assert.equal(g.financials.year,2027);assert.deepEqual(g.financials.assets,original);assert.equal(F.financeReport(g).history.length,1);assert.equal(F.financeReport(g).history[0].limit,oldLimit,'new UEFA qualification must not rewrite last-season limits');assert.equal(F.financeReport(g).policy.id,'uefa');assert.notEqual(g.clubs.c0.cash,cash);assert.deepEqual(F.settleWeeklyFinancials(g),[]);assert.equal(F.validateFinancials(g),true);
 for(let year=2028;year<=2032;year++){g.year=year;g.date=`${year}-08-15`;F.rollFinancialSeason(g);}assert.equal(F.financeReport(g).history.length,3);assert.equal(F.validateFinancials(g),true);
});

test('saved financial state rejects invalid assets, duplicate settlement IDs and nonfinite accounts',()=>{
 const g=fresh();F.initializeFinancials(g);
 for(const mutate of [s=>s.financials.clubs.c0.baseRevenue=Infinity,s=>s.financials.assets['c0-p0'].clubId='c1',s=>s.financials.assets['c0-p0'].years=6,s=>s.financials.processedFixtures=['x','x'],s=>delete s.financials.assets['c0-p0'],s=>s.financials.lastWeeklyDate='2026-02-31']){const bad=structuredClone(g);mutate(bad);assert.throws(()=>F.validateFinancials(bad));}
});

test('batched season-close reports match uncached reports and later payroll edits remain visible',()=>{
 const g=fresh();F.initializeFinancials(g);
 g.players['c0-p0'].wage+=1777;g.financials.assets['c1-p0'].cost+=345678;
 g.financials.clubs.c2.transferProfit=123456;g.financials.clubs.c3.actualMatchdayIncome=987654;
 const reports=Object.fromEntries(Object.keys(g.clubs).map(id=>[id,F.financeReport(g,id)]));
 g.year=2027;g.date='2027-08-15';F.rollFinancialSeason(g);
 for(const history of g.financials.history){const previous=reports[history.clubId];assert.deepEqual(history,{clubId:history.clubId,year:2026,revenue:previous.revenue,annualCost:previous.annualCost,limit:previous.limit,transferProfit:previous.transferProfit,matchdayIncome:previous.actualMatchdayIncome});}
 const wages=F.financeReport(g).annualWages;g.players['c0-p0'].wage+=101;
 assert.equal(F.financeReport(g).annualWages,wages+101*52,'the rollover snapshot must not persist after the operation');
});
