import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeProject} from '../store.js';
import {calculateModel} from '../model.js';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('executive dashboard is a separate standalone read-only entrypoint',()=>{
  const dashboard=read('dashboard.html'), workbench=read('index.html');
  assert.match(dashboard,/dashboard\.js\?v=1\.4\.8/);
  assert.match(dashboard,/dashboard\.css\?v=1\.4\.8/);
  assert.doesNotMatch(dashboard,/href="\.\/"|承辦工作台/);
  assert.match(workbench,/href="dashboard\.html">長官儀表板<\/a>/);
  assert.doesNotMatch(dashboard,/<input\b|<textarea\b|<select\b/);
});

test('south default data records evaluation and actual signing dates',()=>{
  const p=normalizeProject(JSON.parse(read('data/south.json')),'south');
  const m=calculateModel(p,'2026-10-02');
  assert.equal(p.milestones.evaluationDate,'2026-08-24');
  assert.equal(p.milestones.actualSignDate,'2026-10-01');
  assert.equal(m.dashboard.phase,'active-performance');
});

test('executive dashboard provides one-frame detail switching and return-to-overview control',()=>{
  const html=read('dashboard.html'),js=read('dashboard.js');
  for(const view of ['overview','progress','attention','kpi','review','payment']) assert.match(html,new RegExp(`data-view="${view}"`));
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


test('v1.4.4 executive timeline uses start-to-due ranges so award-triggered work visibly starts earlier',()=>{
  const js=read('dashboard.js'),css=read('dashboard.css');
  assert.match(js,/start:x\.forecastStart \|\| x\.baselineStart/);
  assert.match(js,/起算 \$\{fmt\(x\.start\)\}/);
  assert.match(js,/variance-range planned/);
  assert.match(js,/left:\$\{startPos\}%/);
  assert.match(css,/\.variance-range/);
  assert.match(css,/\.range-bars \.variance-track/);
});
test('v1.4.4 executive dashboard has larger accessible typography and tablet phone layouts',()=>{
  const css=read('dashboard.css');
  assert.match(css,/body\{font-size:16px\}/);
  assert.match(css,/\.exec-header h1\{font-size:30px\}/);
  assert.match(css,/\.top-kpi span\{font-size:15px\}/);
  assert.match(css,/@media\(max-width:1180px\)/);
  assert.match(css,/@media\(max-width:700px\)/);
});


test('v1.4.5 executive font controls persist large-text preference',()=>{
  const html=read('dashboard.html'),js=read('dashboard.js'),css=read('dashboard.css');
  assert.match(html,/data-font-size="standard"/);
  assert.match(html,/data-font-size="large"/);
  assert.match(html,/data-font-size="xlarge"/);
  assert.match(js,/FONT_KEY='yilan-executive-font-size'/);
  assert.match(js,/function applyFontSize\(size='standard'\)/);
  assert.match(js,/localStorage\.setItem\(FONT_KEY,value\)/);
  assert.match(css,/body\.font-large/);
  assert.match(css,/body\.font-xlarge/);
});
test('v1.4.5 executive tablet navigation stays reachable while scrolling',()=>{
  const css=read('dashboard.css');
  assert.match(css,/@media\(max-width:1180px\)/);
  assert.match(css,/\.exec-nav\{position:sticky;top:0;z-index:20/);
});


test('v1.4.6 executive overview includes deterministic management brief and next milestones',()=>{
  const js=read('dashboard.js'),css=read('dashboard.css');
  assert.match(js,/function nextMilestone\(m\)/);
  assert.match(js,/function managementBrief\(\)/);
  assert.match(js,/主管摘要/);
  assert.match(js,/下一關鍵/);
  assert.match(js,/距今 \$\{days\} 日/);
  assert.match(css,/\.management-brief/);
  assert.match(css,/\.brief-status\.brief-ok/);
  assert.match(css,/\.brief-status\.brief-danger/);
});


test('v1.4.7 management brief cards drill down without leaving executive page',()=>{
  const js=read('dashboard.js'),css=read('dashboard.css');
  assert.match(js,/class="brief-status brief-action/);
  assert.match(js,/class="brief-segment brief-action"/);
  assert.match(js,/data-view="progress"/);
  assert.match(js,/view:'attention'/);
  assert.match(js,/view:'review'/);
  assert.match(css,/\.brief-action/);
  assert.match(css,/\.brief-action:hover/);
});

test('v1.4.8 adds non-contract KPI controls without changing contract schedule counts',()=>{
  const north=normalizeProject(JSON.parse(read('data/north.json')),'north');
  const south=normalizeProject(JSON.parse(read('data/south.json')),'south');
  const northModel=calculateModel(north,'2026-10-02');
  const southModel=calculateModel(south,'2026-10-02');
  assert.equal(northModel.kpiSummary.total,5);
  assert.equal(southModel.kpiSummary.total,2);
  assert.equal(northModel.kpiSummary.unclear,0);
  assert.equal(southModel.kpiSummary.unclear,0);
  assert.equal(northModel.kpiControls.find(x=>x.id==='north-yilan-hsr-same-platform-meeting').due,'2026-10-12');
  assert.equal(southModel.kpiControls.find(x=>x.id==='south-yilan-hsr-same-platform-meeting').due,'2026-10-12');
  assert.equal(northModel.dashboard.total,northModel.schedule.list.filter(x=>x.contractRule).length);
  assert.equal(southModel.dashboard.total,southModel.schedule.list.filter(x=>x.contractRule).length);
});

test('v1.4.8 executive and workbench expose editable KPI control tables',()=>{
  const html=read('dashboard.html'),js=read('dashboard.js'),index=read('index.html'),views=read('views.js'),css=read('dashboard.css'),app=read('app.js'),store=read('store.js');
  assert.match(html,/KPI／外部管制/);
  assert.match(js,/function renderKpi\(\)/);
  assert.match(js,/kpiMiniCard/);
  assert.match(index,/id="kpiControlTable"/);
  assert.match(views,/kpiControlTable/);
  assert.match(views,/data-kpi-field="actualDate"/);
  assert.match(views,/data-kpi-field="actualNote"/);
  assert.match(app,/input\.dataset\.kpiId/);
  assert.match(store,/actualDate/);
  assert.match(css,/\.kpi-mini-card/);
});
