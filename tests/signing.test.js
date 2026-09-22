import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {normalizeProject} from '../store.js';
import {calculateModel} from '../model.js';
const today='2026-09-13';
const fixture=()=>normalizeProject(JSON.parse(readFileSync(new URL('../data/south.json',import.meta.url))));
for (const [date,effective,status] of [['',false,'已決標／待簽約'],['2026-09-12',true,'實際履約中'],[today,true,'實際履約中'],['2026-09-14',false,'已決標／待簽約']]) {
  test(`actual signing ${date || 'blank'} validity`,()=>{
    const p=fixture();p.milestones.actualSignDate=date;
    const m=calculateModel(p,today);
    assert.equal(m.schedule.signing.effective,effective);
    assert.equal(m.dashboard.overall,status);
    for(const node of m.schedule.list.filter(n=>n.triggerType==='signDate' && n.contractRule)) assert.equal(!!node.contractDue,effective);
    assert.equal(m.payments.list.find(n=>n.triggerRef==='sign').tier==='ready',effective);
  });
}
test('future planned sign with blank actual remains management only',()=>{
  const p=fixture();p.milestones.signDate='2027-01-01';p.milestones.actualSignDate='';
  const m=calculateModel(p,today);
  assert.equal(m.schedule.sign,'2027-01-01');
  assert.equal(m.dashboard.started,0);
  assert.equal(m.dashboard.preSignSpecialItems.length,1);
  assert.equal(m.schedule.model.designRiskPlan.contractDue,'2026-11-03');
  assert.equal(m.dashboard.overdue,0);
});
test('future actual from stored data cannot create ready, deadlines or overdue',()=>{
  const p=fixture();p.milestones.signDate='2025-01-01';p.milestones.actualSignDate='2026-10-01';
  const m=calculateModel(normalizeProject(JSON.parse(JSON.stringify(p))),today);
  assert.equal(m.schedule.sign,p.milestones.signDate);
  assert.equal(m.payments.totals.ready.count,0);
  assert.equal(m.dashboard.started,0);
  assert.equal(m.dashboard.overdue,0);
  assert.equal(m.schedule.model.designRiskPlan.contractDue,'2026-11-03');
  assert(m.schedule.list.filter(n=>n.triggerType==='signDate' && n.contractRule).every(n=>!n.contractDue && !n.overdueDays));
  assert(m.summary.warnings.includes('實際簽約日不可晚於今日；目前仍以簽約基準日作管理預估。'));
  assert.equal(m.project.milestones.actualSignDate,'2026-10-01');
});
test('today follows system timezone on both sides of UTC date boundary',()=>{
  for(const [TZ,expected] of [['Asia/Taipei','2026-09-14'],['America/Los_Angeles','2026-09-13']]) {
    const value=execFileSync(process.execPath,['--input-type=module','-e',"import {todayLocal} from './dates.js';console.log(todayLocal(new Date('2026-09-13T17:00:00Z')));"],{cwd:new URL('..',import.meta.url),env:{...process.env,TZ},encoding:'utf8'}).trim();
    assert.equal(value,expected);
  }
});
