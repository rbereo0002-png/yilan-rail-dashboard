import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeProject} from '../store.js';
import {calculateModel} from '../model.js';
import {tableMarkup} from '../views.js';

const source=()=>JSON.parse(readFileSync(new URL('../data/north.json',import.meta.url),'utf8'));
const model=(date='2026-11-25')=>calculateModel(normalizeProject(source(),'north'),date);
const ids=['execPlan','surveyPlan','geoPlan','utilityPlan','north-adjacent-building-plan','north-value-engineering-plan','north-runoff-control-work-plan'];

test('Nov25 seven A-version work plans remain independent, and risk study stays on its previous separate review',()=>{
 const m=model();
 assert.equal(m.currentReviews.filter(x=>ids.includes(x.id)).length,7);
 assert.equal(m.currentReviews.filter(x=>x.id==='designRiskPlan').length,1);
 for(const id of ids){
   const x=m.currentReviews.find(x=>x.id===id);
   assert.ok(x,id);assert.equal(x.version,'A');assert.equal(x.submitted,'2026-11-25');
   assert.equal(x.actionDue,'2026-12-03');
   assert.equal(x.actionDeadlineConfirmed,false);
   assert.equal(x.actionEvidenceStatus,'draft');
   assert.match(x.label,/擬稿|待核發/);
   assert.equal(x.actionOverdueDays,0);
   assert.equal(x.approval,'');
 }
});

test('four original contract plan deadlines remain separate from draft opinion reply target',()=>{
 const m=model();
 for(const id of ids.slice(0,4)){
   const x=m.currentReviews.find(y=>y.id===id);
   assert.equal(x.contractDue,'2026-11-26');
   assert.equal(m.project.rows[id+'_submit'],'2026-11-25');
 }
 for(const id of ids.slice(4)){
   const x=m.currentReviews.find(y=>y.id===id);
   assert.equal(x.contractDue,'');
 }
 const old=m.currentReviews.find(x=>x.id==='designRiskPlan');
 assert.equal(old.actionDue,'2026-11-26');
 assert.equal(old.actionDeadlineConfirmed,true);
});

test('after Dec3 unissued draft due is displayed but never treated as formal overdue',()=>{
 const m=model('2026-12-04');
 for(const id of ids){
   const review=m.currentReviews.find(x=>x.id===id);
   assert.equal(review.actionOverdueDays,0);
   const attention=m.dashboard.reviewAttention.find(x=>x.reviewId===id);
   assert.equal(attention.label,'暫定審查期限（函待核發）');
   assert.equal(attention.actionDeadlineConfirmed,false);
   assert.equal(attention.attentionPriority,5);
 }
 assert.ok(!m.dashboard.workViews.today.some(x=>ids.includes(x.reviewId)));
});

test('each work plan shows proper title in operator review table, and draft letter is traceable',()=>{
 const m=model();
 const table=tableMarkup(m,false).revisionTrackingTable;
 for(const name of ['工程設計執行服務計畫書','補充測量工作計畫書','補充地質調查工作計畫書',
 '管線調查工作計畫書','鄰近建物及結構物調查工作計畫書','價值工程研析工作計畫書','出流管制計畫工作計畫書']){
   assert.ok(table.includes(name),name);
 }
 assert.match(table,/2026\/12\/03/);
 assert.match(table,/待核發確認/);
 const letters=m.project.correspondenceRecords;
 assert.ok(letters.some(x=>x.id==='north-ceci-1150051845-seven-plans'&&x.documentDate==='2026-11-25'));
 assert.ok(letters.some(x=>x.id==='north-seven-work-plans-review-1150005464-draft'&&x.documentDate===''&&x.direction==='outgoing-draft'));
});
