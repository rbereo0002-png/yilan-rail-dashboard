import {formatDate as fmt, daysBetween, addDays} from './dates.js';

export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const e = escapeHTML;
const money = n => Number(n || 0).toLocaleString('zh-TW',{maximumFractionDigits:0});
const percent = n => `${Number(n).toFixed(2)}%`;
const $ = id => document.getElementById(id);
const text = (id,value) => {const el=$(id); if(el) el.textContent=value;};
const html = (id,value) => {const el=$(id); if(el) el.innerHTML=value;};
const tierNames = {ready:'已達請款條件',forecast:'管理預估付款',external:'尚待外部條件'};
const dueNames = {contract:'契約期限',management:'管理預估期限',external:'外部／條件式'};
const duePill = item => `<span class="timeline-pill deadline-${item.dueType}">${dueNames[item.dueType]}</span>`;
const statusPill = item => `<span class="timeline-pill ${item.status.cls}">${e(item.status.text)}</span>`;
const pred = (item,model) => model.schedule.model[item.predecessor]?.name || (item.triggerType === 'externalNotice' ? '甲方通知' : '—');
const inputDate = (item,kind,editable) => {
  const value = kind === 'submit' ? item.actualSubmit : item.actualApproval;
  return editable ? `<input type="date" data-row="${e(item.id)}" data-kind="${kind}" value="${e(value || '')}" aria-label="${e(item.name)}${kind === 'submit' ? '實際提送日' : '實際核定日'}">` : fmt(value);
};
const tableHTML = (headers,rows) => `<thead><tr>${headers.map(x=>`<th>${e(x)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody>`;
const tr = (cells,attrs='') => `<tr ${attrs}>${cells.map(x=>`<td>${x}</td>`).join('')}</tr>`;

// Used by the screen and Excel export. No DOM reads, no positional data parsing.
export function tableMarkup(model, editable = false) {
  const scheduleRows = model.schedule.list.map(item => tr([
    e(item.group),e(item.name),duePill(item),e(pred(item,model)),
    item.days == null ? '—' : `${item.days}日`,fmt(item.contractDue),fmt(item.managementForecast),
    inputDate(item,'submit',editable),
    `${fmt(item.reviewTarget)}<div class="small">${item.pcmReviewContract ? `PCM契約 ${item.reviewDays}日` : `管理預估 ${item.reviewDays}日`}</div>`,
    inputDate(item,'approval',editable),
    `${statusPill(item)}${item.holiday ? '<div class="small">期限逢假日，不順延</div>' : ''}`,
    e(item.note)
  ],`data-node-id="${e(item.id)}"`));
  const ruleRows = model.schedule.list.map(item => tr([
    e(item.group),e(item.name),e(pred(item,model)),duePill(item),fmt(item.forecastStart),
    fmt(item.contractDue),fmt(item.managementForecast),fmt(item.actualSubmit),fmt(item.actualApproval),statusPill(item),e(item.payment || '—')
  ],`data-node-id="${e(item.id)}"`));
  const dependencyRows = model.schedule.list.map(item => tr([
    e(item.group),`${e(item.name)}<div class="small">${e(item.note)}</div>`,e(pred(item,model)),duePill(item),
    item.days == null ? '—' : `${item.days}日`,fmt(item.baselineDue),fmt(item.forecastDue),
    `基準偏移 ${item.forecastShift} 日<br>${statusPill(item)}`,e(item.payment || '—')
  ],`data-node-id="${e(item.id)}"`));
  const paymentRows = model.payments.list.map(payment => tr([
    e(payment.category),e(payment.name),`<span class="payment-tier-pill payment-tier-${payment.tier}">${tierNames[payment.tier]}</span>`,
    percent(payment.ratio),fmt(payment.triggerDate),fmt(payment.payDate),money(payment.amount),
    payment.designCumulative == null ? '—' : percent(payment.designCumulative),payment.year || '—',e(payment.note)
  ],`data-payment-id="${e(payment.paymentId)}" data-payment-tier="${payment.tier}"`));
  const yearRows = model.payments.years.map(year => tr([`${year.year}（民國${Number(year.year)-1911}年）`,money(year.ready),money(year.forecast),money(year.amount),year.count]));
  return {
    scheduleTable:tableHTML(['階段','成果／工作','期限性質','起算基準','契約日數','契約期限','管理預估期限','實際提送日','PCM審查期限／目標','實際核定日','狀態','說明'],scheduleRows),
    contractRuleTable:tableHTML(['類別','工作／成果','前置節點','期限性質','起算日','契約期限','管理預估期限','實際提送','實際核定','狀態','付款連動'],ruleRows),
    dependencyTable:tableHTML(['類別','工作／成果','前置節點','期限性質','契約日數','管理基準日期','目前提送預估／實際','延誤判讀','付款連動'],dependencyRows),
    paymentTable:tableHTML(['類別','付款條件','付款性質','比例','條件日期（實際／預估）','預估付款日','預估金額','設計累計','年度','備註'],paymentRows),
    yearSummary:tableHTML(['年度','已達條件金額','管理預估金額','合計','筆數'],yearRows.length ? yearRows : [tr(['目前沒有可推估付款日之資料','—','—','—','—'])])
  };
}

export function exportHTML(model) {
  const names = {scheduleTable:'履約主時程',contractRuleTable:'契約時限主檔',dependencyTable:'前後置關聯',paymentTable:'付款預測',yearSummary:'年度資金需求'};
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><title>${e(model.project.name)}履約管制</title></head><body><h1>${e(model.project.name)}履約與付款管制</h1><p>資料日期：${fmt(model.today)}；用地及監造付款未納入本版年度彙整。</p>${Object.entries(tableMarkup(model)).map(([id,markup])=>`<h2>${names[id]}</h2><table border="1">${markup}</table>`).join('')}</body></html>`;
}

export function renderNavigation(catalog,activeId) {
  $('projectSelect').innerHTML = catalog.projects.map(x=>`<option value="${e(x.id)}" ${x.id === activeId ? 'selected' : ''}>${e(x.name)}</option>`).join('');
  html('segmentButtons',catalog.projects.map(x=>`<button type="button" class="segment-btn ${x.id === activeId ? 'active' : ''}" data-project="${e(x.id)}">${e(x.name)}</button>`).join(''));
}
function renderForms(model,readOnly,catalog) {
  const p = model.project;
  text('heroTitle',`宜蘭至羅東鐵路高架化計畫｜${p.name}履約＋付款管制`);
  text('heroSub',p.title);
  renderNavigation(catalog,p.id);
  for (const key of ['awardDate','evaluationDate','workStartDate','signDate','actualSignDate']) $(key).value=p.milestones[key] || '';
  $('actualSignDate').max=model.today;
  for (const [key,value] of Object.entries(p.dates)) if ($(key)) $(key).value=value || '';
  if ($('allWorksAwardDate')) {
    $('allWorksAwardDate').readOnly = model.construction.total > 0;
    $('allWorksAwardDate').title = model.construction.total > 0 ? '由施工分標實際決標日自動計算' : '';
  }
  text('allWorksAwardHint',model.construction.total > 0
    ? `已建立 ${model.construction.total} 個施工分標；全部決標日由系統自動計算。`
    : '未建立施工分標清單時可手動登錄；建立後由各分標實際決標日自動判定。');
  $('pcmDays').value=p.settings.pcmDays;
  $('payMode').value=String(p.settings.payWorkdays);
  // Preserve imported nonstandard administrative estimates rather than silently resetting them.
  if (!$('payMode').value) {const option=document.createElement('option');option.value=String(p.settings.payWorkdays);option.textContent=`自訂 ${p.settings.payWorkdays} 工作天`;$('payMode').append(option);$('payMode').value=option.value;}
  $('forecastMode').value=p.settings.forecastMode;
  $('holidays').value=p.settings.holidays.join(', ');
  $('soilWaterEnabled').checked=p.settings.enabledRules.soilWaterPlan === true;
  const milestones = [['決標／契約生效',p.milestones.awardDate],['評選',p.milestones.evaluationDate],['工作啟始',p.milestones.workStartDate],['簽約預定',p.milestones.signDate],[model.schedule.signing.effective ? '實際簽約' : '待確認實際簽約',p.milestones.actualSignDate]];
  html('badges',milestones.filter(([,d])=>d).map(([label,date])=>`<span class="badge">${label} ${fmt(date)}</span>`).join(''));
  text('budgetNote',`${p.name}預算總額 ${money(p.budget.total)} 元；發包技術服務費 ${money(p.budget.serviceTotal)} 元。${p.notes || ''}`);
  const labels = {survey:'補充測量',geo:'補充地質調查',utility:'管線調查',land:'用地及地上物相關作業',design:'工程設計',supervision:'施工監造'};
  $('budgetTable').querySelector('tbody').innerHTML=Object.entries(labels).map(([key,label])=>tr([
    label,money(p.budget[key]),readOnly ? money(p.contract[key]) : `<input type="number" min="0" step="any" class="contractAmt" data-budget="${key}" value="${p.contract[key]}" aria-label="${label}契約分項金額">`,
    money(p.settings.forecastMode === 'contract' ? p.contract[key] : p.budget[key]),key === 'supervision' ? '保留資料，暫不納入本版管制' : '依原預算／契約基準'
  ])).join('');
  html('noticeInputs',model.schedule.list.filter(x=>x.triggerType === 'externalNotice').map(x=>`<div class="field"><label>${e(x.name)}：甲方通知日<input type="date" data-notice="${e(x.id)}" value="${e(p.notices[x.id] || '')}"></label></div>`).join(''));

  const packageRows = model.construction.packages.map(pkg => tr([
    readOnly ? e(pkg.code || '—') : `<input type="text" data-package-id="${e(pkg.id)}" data-package-field="code" value="${e(pkg.code)}" aria-label="施工分標標號">`,
    readOnly ? e(pkg.name || '—') : `<input type="text" data-package-id="${e(pkg.id)}" data-package-field="name" value="${e(pkg.name)}" aria-label="施工分標標名">`,
    readOnly ? e(pkg.scope || '—') : `<input type="text" data-package-id="${e(pkg.id)}" data-package-field="scope" value="${e(pkg.scope)}" aria-label="施工分標工程範圍">`,
    readOnly ? fmt(pkg.plannedTenderDate) : `<input type="date" data-package-id="${e(pkg.id)}" data-package-field="plannedTenderDate" value="${e(pkg.plannedTenderDate)}">`,
    readOnly ? fmt(pkg.actualAwardDate) : `<input type="date" data-package-id="${e(pkg.id)}" data-package-field="actualAwardDate" value="${e(pkg.actualAwardDate)}">`,
    readOnly ? '' : `<button type="button" class="mini-btn" data-remove-package="${e(pkg.id)}">刪除</button>`
  ],`data-package-row="${e(pkg.id)}"`));
  $('packageTable').querySelector('tbody').innerHTML = packageRows.join('') || `<tr><td colspan="6" class="center">尚未建立施工分標；待基本設計採購策略／甲方指示確認後再登錄。</td></tr>`;
  html('packageSummary',`<div class="note">目前 ${model.construction.total} 標；已決標 ${model.construction.awarded} 標；各分標工程全部決標日：<b>${fmt(model.construction.allWorksAwardDate)}</b></div>`);

  const specialRows = model.specialDeliverables.map(item => tr([
    e(item.parentName),e(item.name),fmt(item.parentDue),
    readOnly ? fmt(item.actualSubmitDate) : `<input type="date" data-special-id="${e(item.id)}" data-special-field="actualSubmitDate" value="${e(item.actualSubmitDate || '')}">`,
    readOnly ? fmt(item.actualApprovalDate) : `<input type="date" data-special-id="${e(item.id)}" data-special-field="actualApprovalDate" value="${e(item.actualApprovalDate || '')}">`,
    `${e(item.note)}<div class="small">狀態：${e(item.status)}</div>`
  ]));
  $('specialDeliverableTable').querySelector('tbody').innerHTML = specialRows.join('') || `<tr><td colspan="6" class="center">目前無標段特有子成果。</td></tr>`;
}

function renderDashboard(model) {
  const d=model.dashboard;
  text('overviewToday',fmt(model.today));text('ovProject',model.project.name);
  text('ovSignDate',fmt(model.schedule.awardDate));
  text('ovOverallStatus',d.overall);text('ovProgress',`${d.progress}%`);text('ovProgressText',`${d.completed} / ${d.total}`);
  $('ovProgressBar').style.width=`${d.progress}%`;
  for (const [id,key] of Object.entries({ovOverdue:'overdue',ovDue14:'due14',ovDue30:'due30',ovPendingApproval:'underReview',ovCompleted:'completed'})) text(id,d[key]);
  text('overviewSub',`目前階段：${d.phaseLabel}。廠商提送期限、PCM審查期限／管理目標、甲方實際核定分開列管；未到起算事件的成果不列逾期。`);
  html('ovImportantWorks',d.important.length ? d.important.map(x=>`<div class="work-item"><div class="work-status"><span class="timeline-pill attention-${x.attentionPriority}">${e(x.attentionLabel)}</span></div><div class="work-name"><b>${e(x.name)}</b><span>${e(x.attentionReason)}</span></div><div class="work-date">${x.effectiveSubmit && !x.effectiveApproval ? 'PCM審查期限／目標' : '契約期限'}<br>${fmt(x.effectiveSubmit && !x.effectiveApproval ? x.reviewTarget : x.contractDue)}</div></div>`).join('') : '<div class="overview-empty">目前無契約逾期、審查催辦或30日內到期事項</div>');
  html('ovStageList',d.stages.map(x=>`<div class="stage-item"><span>${e(x.name)}</span><b>${x.completed}/${x.total}</b></div>`).join(''));
  document.querySelector('.payment-kpis').innerHTML=Object.entries(model.payments.totals).map(([tier,t])=>`<div class="payment-kpi"><span>${tierNames[tier]}</span><b>${t.count} 項</b><small>${money(t.amount)} 元</small></div>`).join('')+`<div class="payment-kpi"><span>最近預估付款日</span><b>${fmt(model.payments.nextPayDate)}</b></div>`;
  const c=model.summary.counts;
  document.querySelector('#contractRuleControl .timeline-kpis').innerHTML=[['目前標段',e(model.project.name)],['履約階段',e(d.phaseLabel)],['已正式起算成果',`${d.started} 項`],['尚待起算成果',`${d.notStarted} 項`],['已起算契約期限節點',`${c.contract} 項`],['管理預估節點',`${c.management} 項`],['外部／條件式節點',`${c.external} 項`],['目前已起算之最末契約期限',fmt(model.summary.lastContract)]].map(([label,value])=>`<div><span>${label}</span><b>${value}</b></div>`).join('');
}

function renderTimeline(model) {
  text('tlStartDate',fmt(model.schedule.awardDate));text('tlForecastFinish',fmt(model.summary.lastForecast));
  text('tlDelayDays',`${model.summary.maxShift} 日`);text('tlAffectedCount',`${model.summary.affected.length} 項`);
  html('delayImpactBox',model.summary.affected.length ? model.summary.affected.map(x=>`<div class="delay-item"><div><b>${e(x.name)}</b><span>提送逾期 ${x.submitDelay} 日；${x.pcmReviewContract ? 'PCM契約審查逾期' : '審查超過管理目標'} ${Math.max(x.reviewDelay,x.reviewOverdueDays || 0)} 日</span></div><strong>+${x.forecastShift} 日</strong><small>管理基準 ${fmt(x.baselineDue)} → 目前 ${fmt(x.forecastDue)}</small></div>`).join('') : '<div class="delay-ok">目前沒有已登錄日期造成的基準偏移或審查超時；未提送之契約逾期請見總覽。</div>');
  html('paymentMilestoneStrip',model.payments.list.map(p=>`<div class="pay-node payment-${p.tier}" data-payment-id="${e(p.paymentId)}"><div class="pay-dot"></div><b>${e(p.category)}｜${e(p.name)}</b><span>${percent(p.ratio)}｜${money(p.amount)} 元</span><small>條件：${fmt(p.triggerDate)}<br>付款：${fmt(p.payDate)}</small><em class="payment-tier-strip-tag">${tierNames[p.tier]}</em></div>`).join(''));
  const items=model.schedule.list.filter(x=>x.baselineDue || x.forecastDue || x.actualApproval);
  const dates=items.flatMap(x=>[x.baselineStart,x.baselineDue,x.forecastStart,x.forecastDue,x.actualApproval]).filter(Boolean).sort();
  if (!dates.length) {html('ganttChart','<div class="timeline-empty">尚無足夠日期可繪製甘特圖。</div>');return;}
  const min=addDays(dates[0],-10),max=addDays(dates.at(-1),20),total=Math.max(1,daysBetween(min,max));
  const pos=d=>Math.max(0,Math.min(100,daysBetween(min,d)/total*100));
  const bar=(start,end,cls)=>start && end ? `<div class="gantt-bar ${cls}" style="left:${pos(start)}%;width:${Math.max(.6,pos(end)-pos(start))}%"></div>` : '';
  html('ganttChart',`<div class="gantt-axis"><div class="gantt-label-head">工作／成果</div><div class="gantt-range">${fmt(min)} — ${fmt(max)}</div></div>${items.map(x=>`<div class="gantt-row" data-node-id="${e(x.id)}"><div class="gantt-label"><small>${e(x.group)}</small><b>${e(x.name)}</b><span>${e(x.status.text)}｜${dueNames[x.dueType]}</span></div><div class="gantt-track">${bar(x.baselineStart,x.baselineDue,'baseline')}${bar(x.forecastStart,x.forecastDue,`forecast ${x.status.cls}`)}${x.actualApproval ? `<span class="gantt-milestone ${x.effectiveApproval ? 'tl-done' : 'tl-normal'}" title="核定 ${fmt(x.actualApproval)}" style="left:${pos(x.actualApproval)}%"></span>` : ''}</div></div>`).join('')}<div class="gantt-legend"><span><i class="legend-base"></i>管理基準</span><span><i class="legend-forecast"></i>目前提送預估／實際</span><span>菱形：登錄核定日；提送期限與審查目標分開判讀。</span></div>`);
}

export function renderModel(model,{readOnly,catalog}) {
  renderForms(model,readOnly,catalog);
  for (const [id,markup] of Object.entries(tableMarkup(model,!readOnly))) html(id,markup);
  renderDashboard(model);renderTimeline(model);
  text('dataWarnings',model.summary.warnings.join('；'));
  document.body.classList.toggle('view-mode',readOnly);
  document.querySelectorAll('input,textarea,select').forEach(input=>{input.disabled=readOnly && input.id !== 'projectSelect';});
}
