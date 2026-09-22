import {calculateSchedule} from './schedule-engine.js';
import {calculatePayments} from './payment-engine.js';
import {daysBetween, todayLocal, SIGN_DATE_WARNING} from './dates.js';

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze); Object.freeze(value);
  }
  return value;
}
export function calculateModel(project, today = todayLocal()) {
  const source = structuredClone(project);
  const packages = source.constructionPackages || [];
  const packageAwardDates = packages.map(x => x.actualAwardDate).filter(Boolean);
  const allPackagesAwarded = packages.length > 0 && packageAwardDates.length === packages.length;
  const derivedAllWorksAwardDate = allPackagesAwarded ? [...packageAwardDates].sort().at(-1) : null;
  if (packages.length) {
    source.dates.allWorksAwardDate = derivedAllWorksAwardDate || '';
    source.rows ||= {};
    source.rows.worksAward_approval = derivedAllWorksAwardDate || '';
  }
  const schedule = calculateSchedule(source,today);
  const payments = calculatePayments(source,schedule);
  // Fixed deliverable population; changing an estimate to a contract date must not change progress.
  const deliverables = schedule.list.filter(x => x.contractRule);
  const completed = deliverables.filter(x => x.effectiveApproval).length;
  const pending = deliverables.filter(x => x.effectiveSubmit && !x.effectiveApproval).length;
  const signedEffective = schedule.signing.effective;
  const preSignSpecialItems = !signedEffective
    ? deliverables.filter(x => x.triggerType === 'awardDate' && x.contractDue)
    : [];
  const formalDeliverables = signedEffective ? deliverables : [];
  const open = formalDeliverables.filter(x => !x.effectiveSubmit && !x.effectiveApproval && x.contractDue);
  const overdue = open.filter(x => x.overdueDays > 0).length;
  const due14 = open.filter(x => {const n = daysBetween(today,x.contractDue); return n >= 0 && n <= 14;}).length;
  const due30 = open.filter(x => {const n = daysBetween(today,x.contractDue); return n >= 0 && n <= 30;}).length;
  const phase = !schedule.awardEffective ? 'pre-award' : signedEffective ? 'active-performance' : 'awaiting-sign';
  const phaseLabel = phase === 'pre-award' ? '尚未決標' : phase === 'awaiting-sign' ? '已決標／待簽約（履約尚未起算）' : '實際履約中';
  const started = formalDeliverables.filter(x => x.contractDue).length;
  const notStarted = deliverables.length - started;
  const underReviewItems = formalDeliverables.filter(x => x.effectiveSubmit && !x.effectiveApproval);
  const reviewOverdueItems = underReviewItems.filter(x => x.reviewOverdueDays > 0);
  const reviewOverdue = reviewOverdueItems.length;
  const underReview = underReviewItems.length;
  const overall = !schedule.awardEffective ? '尚未決標' : !signedEffective ? '已決標／待簽約' : overdue ? '有逾期事項' : reviewOverdue ? '審查列管中' : '實際履約中';
  const attention = formalDeliverables.map(x => {
    const remaining = x.contractDue ? daysBetween(today,x.contractDue) : null;
    let priority = 99, priorityLabel = '', reason = '';
    if (x.overdueDays > 0) {priority=0;priorityLabel='立即處理';reason=`尚未提送，契約逾期 ${x.overdueDays} 日`;}
    else if (x.reviewOverdueDays > 0) {priority=1;priorityLabel='審查催辦';reason=`${x.pcmReviewContract ? 'PCM契約審查' : '審查管理目標'}逾期 ${x.reviewOverdueDays} 日`;}
    else if (x.effectiveSubmit && !x.effectiveApproval) {priority=2;priorityLabel='審查中';reason=x.reviewTarget ? `審查期限／目標 ${x.reviewTarget}` : '已提送待核定';}
    else if (remaining != null && remaining >= 0 && remaining <= 14) {priority=3;priorityLabel='14日內到期';reason=`距契約期限 ${remaining} 日`;}
    else if (remaining != null && remaining > 14 && remaining <= 30) {priority=4;priorityLabel='30日內到期';reason=`距契約期限 ${remaining} 日`;}
    return {...x,attentionPriority:priority,attentionLabel:priorityLabel,attentionReason:reason,remainingDays:remaining};
  }).filter(x=>x.attentionPriority<99)
    .sort((a,b)=>a.attentionPriority-b.attentionPriority || (b.overdueDays-a.overdueDays) || (b.reviewOverdueDays-a.reviewOverdueDays) || (a.contractDue || '9999').localeCompare(b.contractDue || '9999'));
  const important = attention.slice(0,8);
  const workViews = {
    today: attention.filter(x => x.attentionPriority <= 2),
    due14: attention.filter(x => x.attentionPriority === 3),
    due30: attention.filter(x => x.attentionPriority === 4)
  };
  const stages = Object.values(deliverables.reduce((acc,item) => {
    const stage = acc[item.group] ||= {name:item.group,total:0,completed:0};
    stage.total++; if (item.effectiveApproval) stage.completed++; return acc;
  },{}));
  const quickEntryItems = deliverables
    .filter(x => (signedEffective && x.contractDue) || x.effectiveSubmit || x.effectiveApproval)
    .sort((a,b) => {
      const ar = a.attentionPriority ?? 99, br = b.attentionPriority ?? 99;
      return ar-br || (a.contractDue || '9999').localeCompare(b.contractDue || '9999');
    });
  const workbenchCounts = {
    urgent: quickEntryItems.filter(x => x.attentionPriority <= 2).length,
    due14: quickEntryItems.filter(x => x.attentionPriority === 3).length,
    due30: quickEntryItems.filter(x => x.attentionPriority === 4).length,
    review: quickEntryItems.filter(x => x.effectiveSubmit && !x.effectiveApproval).length,
    open: quickEntryItems.filter(x => !x.effectiveApproval).length,
    completed: quickEntryItems.filter(x => x.effectiveApproval).length
  };
  const dashboard = {completed,pending,underReview,reviewOverdue,underReviewItems,reviewOverdueItems,overdue,due14,due30,started,notStarted,phase,phaseLabel,overall,preSignSpecialItems,total:deliverables.length,
    progress:deliverables.length ? Math.round(completed / deliverables.length * 100) : 0, important, attention, workViews, quickEntryItems, workbenchCounts, stages};
  const counts = {contract:0,management:0,external:0};
  schedule.list.forEach(x => counts[x.dueType]++);
  const latest = values => values.filter(Boolean).sort().at(-1) || null;
  const affected = schedule.list.filter(x => x.forecastShift > 0 || x.reviewDelay > 0 || x.submitDelay > 0);
  const summary = {counts,lastContract:latest(schedule.list.map(x => x.contractDue)),
    lastForecast:latest(schedule.list.map(x => x.forecastDue)),affected,
    maxShift:Math.max(0,...schedule.list.map(x => x.forecastShift)),
    warnings:[...(schedule.signing.future ? [SIGN_DATE_WARNING] : []),...(source.migrationWarnings || []),...schedule.list.flatMap(x => x.warnings.map(w => `${x.name}：${w}`))]};
  const construction = {
    packages,
    total:packages.length,
    awarded:packageAwardDates.length,
    allPackagesAwarded,
    allWorksAwardDate:source.dates.allWorksAwardDate || null
  };
  const specialDeliverables = (source.specialDeliverables || []).map(item => {
    const parent = schedule.model[item.parentRule] || null;
    const parentDue = parent?.contractDue || parent?.managementForecast || parent?.targetDue || null;
    const status = item.actualApprovalDate ? '已核定' : item.actualSubmitDate ? '已提送待核定' : '待辦';
    return {...item,parentName:parent?.name || item.parentRule,parentDue,status};
  });
  return freeze({project:source,today,schedule,payments,dashboard,summary,construction,specialDeliverables});
}
