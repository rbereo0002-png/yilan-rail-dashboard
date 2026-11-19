import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeProject} from '../store.js';
import {calculateModel} from '../model.js';
import {tableMarkup} from '../views.js';
const get=id=>normalizeProject(JSON.parse(readFileSync(new URL('../data/'+id+'.json',import.meta.url),'utf8')),id);
const m=(id,date='2026-11-19')=>calculateModel(get(id),date);

test('north A-version risk: 11/16 received, 11/17 contract deadline, 11/26 opinions are three distinct fields',()=>{
 const model=m('north');
 const review=model.currentReviews.find(x=>x.id==='designRiskPlan');
 assert.ok(review);
 assert.equal(review.version,'A');
 assert.equal(review.submitted,'2026-11-16');
 assert.equal(review.contractDue,'2026-11-17');
 assert.equal(review.actionDue,'2026-11-26');
 assert.match(review.label,/已函送各單位審查/);
 assert.equal(review.overdueDays,0);
 assert.equal(review.actionOverdueDays,0);
 assert.equal(review.actionSource.includes('正式發文日期及文號待補'),true);
 assert.ok(model.dashboard.reviewActionItems.some(x=>x.id==='designRiskPlan'));
 const legacy=model.kpiControls.find(x=>x.id==='north-risk-plan-A-review-1151126');
 assert.equal(legacy.linkedReview,true);
 assert.equal(model.kpiSummary.total,model.kpiControls.length-1);
 assert.ok(!model.dashboard.executiveItems.some(x=>x.id===legacy.id));
 const table=tableMarkup(model,false).revisionTrackingTable;
 assert.match(table,/2026\/11\/26/);
 assert.match(table,/2026\/11\/16/);
 assert.match(table,/2026\/11\/17/);
});

test('once north review opinion is due, expiry counts only as review, not contract or management KPI',()=>{
 const model=m('north','2026-11-27');
 const x=model.currentReviews.find(x=>x.id==='designRiskPlan');
 assert.equal(x.actionOverdueDays,1);
 assert.equal(x.overdueDays,0);
 assert.equal(model.dashboard.currentReviewActionOverdueItems.filter(y=>y.id==='designRiskPlan').length,1);
 assert.ok(model.kpiControls.find(y=>y.linkedReview).computedStatus==='逾期');
 assert.ok(model.kpiSummary.overdue<=model.kpiControls.filter(y=>y.computedStatus==='逾期').length-1);
});

test('the submission of an unresolved transfer study or held meeting is not prematurely marked closed',()=>{
 const north=m('north');
 const transfer=north.kpiControls.find(x=>x.id==='north-yilan-hsr-transfer-revised-analysis-1151106');
 assert.ok(transfer.actualMilestoneReached);
 assert.equal(transfer.followUpOpen,true);
 assert.equal(transfer.computedStatus,'後續列管');
 assert.ok(north.dashboard.executiveItems.some(x=>x.id===transfer.id));
 const meeting=north.kpiControls.find(x=>x.id==='north-pcm-1151102-meeting');
 assert.equal(meeting.followUpOpen,true);
 assert.notEqual(meeting.computedStatus,'已完成');
});

test('south review B histories retain their current B submission deadline without fabricating agency response deadline',()=>{
 const south=m('south');
 assert.equal(south.currentReviews.length,5);
 for(const review of south.currentReviews){
   assert.equal(review.version,'B');
   assert.equal(review.actionDue,'');
   assert.equal(review.history.length,1);
   assert.equal(review.due,'2026-11-23');
 }
});
