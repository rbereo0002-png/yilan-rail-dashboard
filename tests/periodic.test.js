import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {normalizeProject} from '../store.js';import {calculateModel} from '../model.js';import {tableMarkup} from '../views.js';
const fixture=()=>normalizeProject(JSON.parse(readFileSync(new URL('../data/north.json',import.meta.url))));
test('monthly due handles weekends, declared holidays and compensating workdays',()=>{
 const p=fixture();p.monthlyReportConfig.lastMonth='2026-10';p.monthlyReportConfig.calendarConfirmedThrough='2026-11';
 p.settings.holidays=['2026-11-10','2026-11-11'];assert.equal(calculateModel(p,'2026-10-08').monthlyReports[0].due,'2026-11-12');
 p.monthlyReportConfig.firstMonth='2027-03';p.monthlyReportConfig.lastMonth='2027-03';p.settings.holidays=[];
 assert.equal(calculateModel(p,'2027-04-01').monthlyReports[0].due,'2027-04-12');
 p.settings.workingDates=['2027-04-10'];assert.equal(calculateModel(p,'2027-04-01').monthlyReports[0].due,'2027-04-10');
});
test('monthly submission revision and approval persist separately and do not alter contract payments',()=>{
 const p=fixture();const before=calculateModel(p,'2026-11-20');p.monthlyReports['2026-10']={submitDate:'2026-11-09',revisionRequestDate:'2026-11-12',documentRef:'收文123',note:'待補附件'};
 let m=calculateModel(normalizeProject(JSON.parse(JSON.stringify(p))),'2026-11-20');assert.equal(m.monthlyReports[0].status,'待修正');
 p.monthlyReports['2026-10'].resubmitDate='2026-11-18';assert.equal(calculateModel(p,'2026-11-20').monthlyReports[0].status,'已修正待審查');
 p.monthlyReports['2026-10'].approvalDate='2026-11-20';m=calculateModel(p,'2026-11-20');assert.equal(m.monthlyReports[0].status,'已核定／結案');assert.deepEqual(m.payments,before.payments);
 assert.match(tableMarkup(m,true).monthlyReportTable,/收文123/);
});
test('unknown holiday calendar does not assert contractual overdue; confirmed calendar does',()=>{
 const p=fixture();assert.equal(calculateModel(p,'2026-11-20').monthlyReports[0].status,'超過暫定日期／假日待核');p.monthlyReportConfig.calendarConfirmedThrough='2026-11';assert.equal(calculateModel(p,'2026-11-20').monthlyReports[0].status,'逾期未提送');
});
test('insurance keeps expiry reminders after approval and rejects backwards policy period',()=>{
 const p=fixture();p.insuranceRecords[0].approvalDate='2026-10-08';p.insuranceRecords[0].coverageEnd='2026-11-01';assert.equal(calculateModel(p,'2026-10-20').insuranceControls[0].status,'30日內須確認續保');assert.equal(calculateModel(p,'2026-11-02').insuranceControls[0].status,'保期已屆滿');p.insuranceRecords[0].coverageEnd='2026-01-01';assert.throws(()=>normalizeProject(p),/截止日/);
});

test('legacy local drafts receive insurance controls without losing saved dates',()=>{const p=fixture();delete p.insuranceRecords;delete p.monthlyReports;delete p.monthlyReportConfig;p.rows.basic_submit='2026-10-01';const restored=normalizeProject(p);assert.equal(restored.insuranceRecords.length,2);assert.equal(restored.rows.basic_submit,'2026-10-01');});
