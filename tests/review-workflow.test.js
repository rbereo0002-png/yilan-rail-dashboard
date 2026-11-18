import test from 'node:test';
import assert from 'node:assert/strict';
import {currentReviewState, latestReviewItems} from '../review-workflow.js';

test('A版如期提送退回後，主畫面只列 B 版當前待辦，歷史 A 版仍保留',()=>{
  const record={currentVersion:'B',currentDue:'2026-11-23',history:[{version:'A',submittedDate:'2026-10-30',reviewLetterDate:'2026-11-12',outcome:'審查後須修正'}]};
  const state=currentReviewState(record,{contractDue:'2026-10-31',actualSubmit:'2026-10-30'},'2026-11-18');
  assert.equal(state.label,'待提送B版');
  assert.equal(state.returnDate,'2026-11-12');
  assert.equal(state.initialSubmit,'2026-10-30');
  assert.equal(state.contractDue,'2026-10-31');
  assert.equal(state.history.length,1);
});

test('修正逾期只計入修正提送逾期，不覆蓋原契約首次提送',()=>{
  const state=currentReviewState({currentVersion:'B',currentDue:'2026-11-17',deadlineConfirmed:true,history:[{version:'A',submittedDate:'2026-10-30'}]},{contractDue:'2026-10-31',actualSubmit:'2026-10-30'},'2026-11-18');
  assert.equal(state.overdueDays,1);
  assert.equal(state.code,'revision-overdue');
  assert.equal(state.initialSubmit,'2026-10-30');
});

test('B版提送後不再催提 B 版',()=>{
  const state=currentReviewState({currentVersion:'B',currentDue:'2026-11-17',currentSubmittedDate:'2026-11-18',history:[{version:'A',submittedDate:'2026-10-30'}]},{},'2026-11-20');
  assert.equal(state.code,'under-review');
  assert.equal(state.overdueDays,0);
});

test('每一主成果有且只有一個目前審查事項',()=>{
  const results=latestReviewItems({versionTracking:{execPlan:{currentVersion:'B',currentDue:'2026-11-23',history:[{version:'A',submittedDate:'2026-10-30'}]}}},{model:{execPlan:{name:'執行服務計畫書'}}},'2026-11-18');
  assert.equal(results.length,1);
  assert.equal(results[0].name,'執行服務計畫書');
});

test('未核實發文的函稿只能標為待確認，不直接推定逾期',()=>{
  const review=currentReviewState({currentVersion:'B',currentDue:'2026-11-23',history:[{
    version:'A',submittedDate:'2026-10-30',reviewLetterDate:'2026-11-12',
    reviewLetterNumber:'1153201957-002函稿（正式發文字號待確認）'
  }]},{contractDue:'2026-10-31',actualSubmit:'2026-10-30'},'2026-11-30');
  assert.equal(review.evidenceStatus,'draft');
  assert.equal(review.deadlineConfirmed,false);
  assert.equal(review.overdueDays,0);
  assert.match(review.label,/待正式確認/);
});
