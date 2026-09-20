import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeProject} from '../store.js';
import {calculateModel} from '../model.js';
import {YilanRules,paymentRules} from '../rules.js';
import {calculateSchedule} from '../schedule-engine.js';
import {calculateSupervision} from '../supervision-engine.js';
import {addDays,addWorkdays,validDate} from '../dates.js';
import {tableMarkup,exportHTML} from '../views.js';
const fixture = id => normalizeProject(JSON.parse(readFileSync(new URL(`../data/${id}.json`,import.meta.url))));
const model = (p,today='2026-12-01') => calculateModel(p,today);
function signed(id='south') {const p=fixture(id);p.milestones.actualSignDate=p.milestones.signDate;return p;}

test('all original contract rules are byte-value equivalent',()=>{
  const old=JSON.parse(readFileSync(new URL('./fixtures/legacy-business.json',import.meta.url)));
  for (const [key,value] of Object.entries(old)) assert.deepEqual(YilanRules[key],value,key);
});
test('all 14 payment ratios, categories, triggers and design cumulative values retained',()=>{
  assert.equal(paymentRules.length,14);
  assert.deepEqual(paymentRules.map(p=>p.ratio),[10,10,10,10,10,90,90,90,20,5,40,5,5,5]);
  assert.deepEqual(paymentRules.map(p=>p.triggerRef),['sign','surveyPlan','geoPlan','utilityPlan','execPlan','surveyResult','geoResult','utilityResult','basic','pcc','final','tender','worksAward','close']);
  for(const key of ['design','survey','geo','utility']) assert.equal(paymentRules.filter(p=>p.budgetKey===key).reduce((n,p)=>n+p.ratio,0),100);
  assert.deepEqual(paymentRules.filter(p=>p.budgetKey==='design').map(p=>p.designCumulative),[10,20,40,45,85,90,95,100]);
  assert.equal(new Set(paymentRules.map(p=>p.paymentId)).size,14);
});
test('legacy north/south load without losing original fields',()=>{
  for(const id of ['north','south']) {
    const raw=JSON.parse(readFileSync(new URL(`../data/${id}.json`,import.meta.url)));
    const p=normalizeProject(raw);assert.deepEqual(p.budget,raw.budget);assert.deepEqual(p.contract,raw.contract);
    for(const [k,v]of Object.entries(raw.milestones))assert.equal(p.milestones[k],v);
    assert.equal(model(p).schedule.list.length,id==='south'?23:25);
  }
});
test('award date is the contract-effective start even before signing',()=>{
  const m=model(fixture('south'),'2026-09-19');
  assert.equal(m.payments.byId['design-sign'].tier,'forecast');
  assert.equal(m.schedule.awardDate,'2026-09-04');
  assert.equal(m.schedule.model.execPlan.contractDue,'2026-10-04');
  assert.equal(m.schedule.model.execPlan.managementForecast,null);
});
test('signing affects signing payment but not award-based contract deadline',()=>{
  const m=model(signed(),'2026-10-02');assert.equal(m.schedule.model.execPlan.contractDue,'2026-10-04');
  assert.equal(m.payments.byId['design-sign'].tier,'ready');
});
test('actual approval activates downstream contract deadline with unchanged day count',()=>{
  const p=signed();p.rows.execPlan_approval='2026-11-15';const m=model(p);
  assert.equal(m.schedule.model.basic.contractDue,addDays('2026-11-15',150));
  assert.equal(m.schedule.model.basic.dueType,'contract');
  assert.equal(m.payments.byId['design-exec'].tier,'ready');
  assert.equal(m.payments.byId['design-exec'].triggerDate,'2026-11-15');
});
test('normal PCM review is not a contractor delay',()=>{
  const p=signed();p.rows.execPlan_submit='2026-10-31';p.rows.execPlan_approval='2026-11-30';
  const n=model(p).schedule.model.execPlan;
  assert.equal(n.submitDelay,0);assert.equal(n.reviewDelay,0);assert.equal(n.forecastShift,0);
});
test('late submission and review delay are distinct and propagate through approval',()=>{
  const p=signed();p.rows.execPlan_submit='2026-11-10';p.rows.execPlan_approval='2026-12-20';
  const m=model(p,'2026-12-21'),n=m.schedule.model.execPlan;
  assert.equal(n.submitDelay,10);assert.equal(n.reviewDelay,10);
  assert.equal(m.schedule.model.basic.forecastShift,20);
  assert.match(n.status.text,/提送逾期 10 日/);
});
test('future actual approval does not count as ready/completed or establish an actual base',()=>{
  const p=signed();p.rows.execPlan_approval='2027-01-01';const m=model(p);
  assert.equal(m.payments.byId['design-exec'].tier,'forecast');assert.equal(m.dashboard.completed,0);
  assert.equal(m.schedule.model.basic.contractDue,null);assert.ok(m.summary.warnings.length);
});
test('progress denominator stays fixed when estimates become contract dates',()=>{
  const p=signed();const a=model(p);p.rows.execPlan_approval='2026-11-15';const b=model(p);
  assert.equal(a.dashboard.total,b.dashboard.total);assert.equal(b.dashboard.completed,1);
  assert.notEqual(a.summary.counts.contract,b.summary.counts.contract);
});
test('external legacy date and row approval use the same payment trigger',()=>{
  const a=fixture('south');a.dates.pccDate='2026-11-15';
  const b=fixture('south');b.rows.pcc_approval='2026-11-15';
  const ma=model(normalizeProject(a)),mb=model(normalizeProject(b));
  assert.deepEqual(ma.payments.byId['design-pcc'],mb.payments.byId['design-pcc']);
  assert.equal(mb.payments.byId['design-pcc'].tier,'ready');assert.ok(mb.payments.byId['design-pcc'].year);
});
test('conflicting legacy dates are preserved and surfaced',()=>{
  const p=fixture('south');p.dates.pccDate='2026-10-10';p.rows.pcc_approval='2026-11-15';
  const n=normalizeProject(p);assert.equal(n.dates.pccDate,'2026-11-15');
  assert.equal(n.legacyDateConflicts.pccDate,'2026-10-10');assert.equal(n.migrationWarnings.length,1);
});
test('construction packages derive all-works award only when every package is awarded',()=>{
  const p=fixture('south');
  p.constructionPackages=[
    {id:'s1',code:'S1',name:'第一標',scope:'',plannedTenderDate:'',actualAwardDate:'2027-01-10'},
    {id:'s2',code:'S2',name:'第二標',scope:'',plannedTenderDate:'',actualAwardDate:''}
  ];
  let m=model(normalizeProject(p),'2027-01-20');
  assert.equal(m.construction.allPackagesAwarded,false);
  assert.equal(m.schedule.model.worksAward.actualApproval,null);
  assert.equal(m.payments.byId['design-award'].tier,'external');
  p.constructionPackages[1].actualAwardDate='2027-02-05';
  m=model(normalizeProject(p),'2027-02-06');
  assert.equal(m.construction.allPackagesAwarded,true);
  assert.equal(m.construction.allWorksAwardDate,'2027-02-05');
  assert.equal(m.schedule.model.worksAward.actualApproval,'2027-02-05');
  assert.equal(m.payments.byId['design-award'].tier,'ready');
});
test('north common-platform study inherits basic-design deadline without adding a contract rule',()=>{
  const p=fixture('north');p.milestones.awardDate='2026-09-14';p.rows.execPlan_approval='2026-10-15';
  const m=model(normalizeProject(p),'2026-10-20');
  const item=m.specialDeliverables.find(x=>x.id==='yilan-hsr-transfer-study');
  assert.ok(item);assert.equal(item.parentRule,'basic');
  assert.equal(item.parentDue,m.schedule.model.basic.contractDue);
  assert.equal(m.schedule.list.some(x=>x.id==='yilan-hsr-transfer-study'),false);
});
test('south has no north-only common-platform study',()=>{
  const m=model(fixture('south'));
  assert.equal(m.specialDeliverables.some(x=>x.id==='yilan-hsr-transfer-study'),false);
});
test('PCM contract review periods override the 30-day management default',()=>{
  const p=fixture('south');
  p.rows.basic_submit='2027-01-10';
  p.rows.final_submit='2027-06-01';
  p.rows.tender_submit='2027-07-01';
  const m=model(normalizeProject(p),'2027-07-05');
  assert.equal(m.schedule.model.basic.reviewDays,14);
  assert.equal(m.schedule.model.basic.reviewBasis,'pcm-contract');
  assert.equal(m.schedule.model.basic.reviewTarget,'2027-01-24');
  assert.equal(m.schedule.model.final.reviewDays,14);
  assert.equal(m.schedule.model.final.reviewTarget,'2027-06-15');
  assert.equal(m.schedule.model.tender.reviewDays,10);
  assert.equal(m.schedule.model.tender.reviewTarget,'2027-07-11');
});
test('other deliverables continue to use configurable PCM management estimate',()=>{
  const p=fixture('south');p.settings.pcmDays=45;p.rows.execPlan_submit='2026-10-04';
  const n=model(normalizeProject(p),'2026-10-10').schedule.model.execPlan;
  assert.equal(n.reviewDays,45);assert.equal(n.reviewBasis,'management');assert.equal(n.reviewTarget,'2026-11-18');
});
test('south confirmed final-design subdeliverables inherit final-design deadline',()=>{
  const p=fixture('south');p.rows.basic_approval='2027-01-01';
  const m=model(normalizeProject(p),'2027-01-02');
  for (const id of ['south-track-switch-plan','south-bim-model','south-supervision-work-plan','south-supervision-plan']) {
    const item=m.specialDeliverables.find(x=>x.id===id);
    assert.ok(item,id);assert.equal(item.parentRule,'final');assert.equal(item.parentDue,m.schedule.model.final.contractDue);
  }
});
test('external conditions without dates remain undated and excluded from years',()=>{
  const m=model(fixture('south'));const payment=m.payments.byId['design-pcc'];
  assert.equal(payment.tier,'external');assert.equal(payment.year,null);
  assert.equal(m.schedule.model.riskUpdate.forecastDue,null);
  assert.equal(m.schedule.model.runoffFinal.contractDue,null);
});
test('soil water remains opt-in and data survives disabling',()=>{
  const p=fixture('north');p.rows.soilWaterPlan_approval='2026-11-01';
  assert.equal(model(p).schedule.model.soilWaterPlan,undefined);
  p.settings.enabledRules.soilWaterPlan=true;assert.equal(model(p).schedule.model.soilWaterPlan.actualApproval,'2026-11-01');
  p.settings.enabledRules.soilWaterPlan=false;assert.equal(p.rows.soilWaterPlan_approval,'2026-11-01');
});
test('notifications establish only the corresponding configured deadline',()=>{
  const p=signed();p.notices.tempBoundary='2026-11-01';const m=model(p);
  assert.equal(m.schedule.model.tempBoundary.contractDue,'2026-12-01');
  assert.equal(m.schedule.model.permBoundary.contractDue,null);
});
test('rowDrawing stays management-only even after final approval',()=>{
  const p=signed();p.rows.final_approval='2026-11-01';const n=model(p).schedule.model.rowDrawing;
  assert.equal(n.dueType,'management');assert.equal(n.contractDue,null);assert.equal(n.managementForecast,'2026-12-01');
});
test('changing PCM days affects estimates but not award-based contract days',()=>{
  const p=signed();const before=model(p);p.settings.pcmDays=60;const after=model(p);
  assert.equal(before.schedule.model.execPlan.contractDue,after.schedule.model.execPlan.contractDue);
  assert.equal(daysDiff(before.schedule.model.basic.managementForecast,after.schedule.model.basic.managementForecast),30);
});
function daysDiff(a,b){return (Date.parse(b)-Date.parse(a))/86400000;}
test('zero administrative days survives save normalization and holidays affect payment only',()=>{
  const p=signed();p.settings.payWorkdays=0;const n=normalizeProject(p),m=model(n);
  assert.equal(m.payments.byId['design-sign'].payDate,'2026-10-01');assert.equal(n.settings.payWorkdays,0);
  assert.equal(addWorkdays('2026-10-02',1,['2026-10-05']),'2026-10-06');
});
test('amounts and annual totals follow contract mode from source values',()=>{
  const p=signed();p.settings.forecastMode='contract';p.contract.design=1000;const m=model(p);
  assert.equal(m.payments.byId['design-sign'].amount,100);
  assert.equal(m.payments.list.filter(x=>x.budgetKey==='design').reduce((s,x)=>s+x.amount,0),1000);
  assert.equal(m.payments.years.reduce((s,x)=>s+x.amount,0),m.payments.list.filter(x=>x.year).reduce((s,x)=>s+x.amount,0));
});
test('model immutable and deterministic; no mutation of input',()=>{
  const p=signed(),copy=structuredClone(p);const a=model(p),b=model(p);
  assert.deepEqual(a,b);assert.deepEqual(p,copy);assert.throws(()=>a.project.rows.execPlan_submit='2026-10-01',TypeError);
});
test('actual dates are rendered from model and export has no inputs or supervision',()=>{
  const p=signed();p.rows.execPlan_approval='2026-11-15';const m=model(p);
  assert.match(tableMarkup(m,true).scheduleTable,/value="2026-11-15"/);
  const out=exportHTML(m);assert.match(out,/2026\/11\/15/);assert.doesNotMatch(out,/<input/);
  assert.doesNotMatch(out,/<h2>施工監造/);
});
test('payment and dependency table column counts stay equal after repeated renders',()=>{
  const m=model(signed());for(let i=0;i<3;i++)for(const key of ['paymentTable','dependencyTable']){
    const s=tableMarkup(m,true)[key],head=(s.match(/<th>/g)||[]).length;
    for(const row of s.matchAll(/<tr [^>]*>(.*?)<\/tr>/gs))assert.equal((row[1].match(/<td>/g)||[]).length,head);
  }
});
test('imported text is escaped in export',()=>{
  const p=signed();p.name='<img src=x onerror=alert(1)>';
  assert.doesNotMatch(exportHTML(model(p)),/<img/);
});
test('invalid JSON dates amounts and cross-project data are rejected',()=>{
  const p=fixture('south');assert.throws(()=>normalizeProject(p,'north'));
  p.rows.execPlan_submit='2026-02-30';assert.throws(()=>normalizeProject(p));
  p.rows.execPlan_submit='';p.contract.design=-1;assert.throws(()=>normalizeProject(p));
  assert.equal(validDate('2026-02-30'),false);assert.equal(validDate('2028-02-29'),true);
});
test('rule dependency order does not determine calculation',()=>{
  const original=YilanRules.getRules;const p=signed();const before=model(p);
  try {YilanRules.getRules=function(...args){return original.apply(this,args).reverse();};
    const after=model(p);assert.deepEqual(after.schedule.model.basic,before.schedule.model.basic);
    assert.deepEqual(after.payments.byId,before.payments.byId);
  }finally{YilanRules.getRules=original;}
});
test('cycle detection fails explicitly rather than silently returning wrong dates',()=>{
  const original=YilanRules.getRules;
  try {YilanRules.getRules=()=>[{id:'a',triggerRef:'b'},{id:'b',triggerRef:'a'}];assert.throws(()=>calculateSchedule(signed(),'2026-12-01'),/循環/);}
  finally{YilanRules.getRules=original;}
});
test('supervision program retains 5/93/2 ratios but is absent from homepage model',()=>{
  const p=signed();Object.assign(p.dates,{supervisionStart:'2026-10-01',constructionStart:'2026-10-01',constructionEnd:'2027-02-01',constructionClose:'2027-03-01'});
  const s=calculateSupervision(p);assert.deepEqual(s.map(x=>x.ratio),[5,46.5,46.5,2]);
  assert.deepEqual(model(p).payments,model(signed()).payments);
});
