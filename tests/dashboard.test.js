import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeProject} from '../store.js';
import {calculateModel} from '../model.js';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('executive dashboard is a separate read-only entrypoint linked to the workbench',()=>{
  const dashboard=read('dashboard.html'), workbench=read('index.html');
  assert.match(dashboard,/dashboard\.js\?v=1\.4\.3/);
  assert.match(dashboard,/dashboard\.css\?v=1\.4\.3/);
  assert.match(dashboard,/href="\.\/">[\s\S]*?承辦工作台[\s\S]*?<\/a>/);
  assert.match(workbench,/href="dashboard\.html">長官儀表板<\/a>/);
  assert.doesNotMatch(dashboard,/<input\b|<textarea\b|<select\b/);
});

test('executive dashboard provides one-frame detail switching and return-to-overview control',()=>{
  const html=read('dashboard.html'),js=read('dashboard.js');
  for(const view of ['overview','progress','attention','review','payment']) assert.match(html,new RegExp(`data-view="${view}"`));
  assert.match(html,/id="backButton"/);
  assert.match(js,/function setView\(view\)/);
  assert.match(js,/setView\('overview'\)/);
  assert.match(js,/renderProgress/);
  assert.match(js,/renderAttention/);
  assert.match(js,/renderReview/);
  assert.match(js,/renderPayment/);
});

test('executive dashboard shares the production project model instead of duplicating calculations',()=>{
  const js=read('dashboard.js');
  assert.match(js,/import \{normalizeProject\} from '\.\/store\.js'/);
  assert.match(js,/import \{calculateModel\} from '\.\/model\.js'/);
  assert.doesNotMatch(js,/function calculateSchedule|function calculatePayments/);
});

test('north award is 2026-09-18 and its pre-sign risk plan is due 60 days later',()=>{
  const p=normalizeProject(JSON.parse(read('data/north.json')),'north');
  const m=calculateModel(p,'2026-09-23');
  assert.equal(p.milestones.awardDate,'2026-09-18');
  assert.equal(m.dashboard.phase,'awaiting-sign');
  assert.equal(m.dashboard.started,0);
  assert.equal(m.dashboard.preSignSpecialItems.length,1);
  assert.equal(m.dashboard.preSignSpecialItems[0].id,'designRiskPlan');
  assert.equal(m.dashboard.preSignSpecialItems[0].contractDue,'2026-11-17');
});


test('executive progress view contains planned actual variance bars and signed day difference',()=>{
  const html=read('dashboard.html'),js=read('dashboard.js'),css=read('dashboard.css');
  assert.match(html,/設計進度／差異/);
  assert.match(js,/function progressComparison\(m\)/);
  assert.match(js,/daysBetween\(x\.planned,x\.actual\)/);
  assert.match(js,/差異＝實際－預定/);
  assert.match(css,/\.variance-chart/);
  assert.match(css,/\.variance-bar\.planned/);
  assert.match(css,/\.variance-bar\.actual/);
  assert.match(css,/\.variance-late/);
  assert.match(css,/\.variance-early/);
});


test('v1.4.2 executive visual hierarchy is presentation-oriented without changing data inputs',()=>{
  const html=read('dashboard.html'),css=read('dashboard.css'),js=read('dashboard.js');
  assert.match(html,/YILAN–LUODONG RAIL ELEVATION PROGRAM/);
  assert.match(html,/class="brand-block"/);
  assert.match(html,/class="date-chip"/);
  assert.match(css,/\.segment-south:before/);
  assert.match(css,/\.segment-north:before/);
  assert.match(css,/radial-gradient/);
  assert.match(css,/\.view-frame/);
  assert.match(js,/segment-\$\{esc\(p\.id\)\}/);
  assert.doesNotMatch(html,/<input\b|<textarea\b|<select\b/);
});


test('v1.4.3 overview shows compact cross-segment milestone snapshot with drill-through',()=>{
  const js=read('dashboard.js'),css=read('dashboard.css');
  assert.match(js,/function overviewMilestones\(m\)/);
  assert.match(js,/關鍵里程碑/);
  assert.match(js,/data-view="progress"/);
  assert.match(js,/designRiskPlan','execPlan','basic','final/);
  assert.match(css,/\.overview-milestone-grid/);
  assert.match(css,/\.overview-milestone-row/);
  assert.match(css,/\.milestone-diff\.late/);
});
