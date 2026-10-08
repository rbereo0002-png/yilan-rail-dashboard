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
  const kpiControls = (source.kpiControls || []).map(item => {
    const due = item.internalTargetDate || item.targetDate || null;
    const remaining = due ? daysBetween(today,due) : null;
    const completed = Boolean(item.actualDate);
    const computedStatus = completed ? '已完成' : item.status || (remaining == null ? (item.category === '設計查核' ? '待審查確認' : item.category === '介面決策' ? '待協調／決策' : item.category === '交辦待辦' ? '待確認期限' : '待釐清') : remaining < 0 ? '逾期' : remaining <= 30 ? '30日內到期' : '列管中');
    const priority = computedStatus === '逾期' ? 0 : computedStatus === '30日內到期' ? 1 : computedStatus === '待釐清' ? 2 : computedStatus === '已完成' ? 10 : 9;
    return {...item,due,remainingDays:remaining,computedStatus,priority};
  }).sort((a,b)=>a.priority-b.priority || (a.due || '9999').localeCompare(b.due || '9999') || a.name.localeCompare(b.name));
  const kpiSummary = {
    total:kpiControls.length,
    overdue:kpiControls.filter(x=>x.computedStatus === '逾期').length,
    due30:kpiControls.filter(x=>x.computedStatus === '30日內到期').length,
    unclear:kpiControls.filter(x=>x.computedStatus === '待釐清').length,
    completed:kpiControls.filter(x=>x.computedStatus === '已完成').length
  };
  const actual = date => date && date <= today ? date : '';
  const insuranceControls=(source.insuranceRecords || []).map(item=>{
    const daysToExpiry=item.coverageEnd ? daysBetween(today,item.coverageEnd) : null;
    const status=daysToExpiry!=null && daysToExpiry<0 ? '保期已屆滿' : daysToExpiry!=null && daysToExpiry<=30 ? '30日內須確認續保' : actual(item.approvalDate) ? '已審查／持續保期追蹤' : actual(item.submitDate) ? '已提送待審查' : '待提送／核對投保';
    return {...item,daysToExpiry,status};
  });
  const monthlyReports=[];
  const config=source.monthlyReportConfig || {};
  const monthOffset=(month,offset)=>{const [y,m]=month.split('-').map(Number);const d=new Date(Date.UTC(y,m-1+offset,1));return d.toISOString().slice(0,7);};
  const start=config.firstMonth || source.milestones.workStartDate?.slice(0,7);
  const horizon=config.lastMonth || monthOffset(today.slice(0,7),2);
  const holidays=new Set(source.settings.holidays || []),working=new Set(source.settings.workingDates || []);
  if(start) for(let month=start;month<=horizon;month=monthOffset(month,1)) {
    const record=source.monthlyReports?.[month] || {};
    const baseDue=monthOffset(month,1)+'-10';let adjustedDue=baseDue;
    const isHoliday=date=>{if(working.has(date))return false;const day=new Date(date+'T12:00:00Z').getUTCDay();return holidays.has(date)||day===0||day===6;};
    let shifts=0;while(isHoliday(adjustedDue) && shifts++<60){const d=new Date(adjustedDue+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1);adjustedDue=d.toISOString().slice(0,10);}
    const calendarVerified=Boolean(config.calendarConfirmedThrough && adjustedDue.slice(0,7)<=config.calendarConfirmedThrough);
    const due=record.dueOverride || adjustedDue;
    const status=actual(record.approvalDate) ? '已核定／結案' : actual(record.resubmitDate) ? '已修正待審查' : actual(record.revisionRequestDate) ? '待修正' : actual(record.submitDate) ? '已提送待審查' : due<today ? (calendarVerified || record.dueOverride ? '逾期未提送' : '超過暫定日期／假日待核') : '待提送';
    monthlyReports.push({...record,month,baseDue,adjustedDue,due,calendarVerified,status,remainingDays:daysBetween(today,due)});
  }
  return freeze({project:source,today,schedule,payments,dashboard,summary,construction,specialDeliverables,kpiControls,kpiSummary,insuranceControls,monthlyReports});
}
