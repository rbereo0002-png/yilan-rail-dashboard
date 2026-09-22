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
  if (packages.length) source.dates.allWorksAwardDate = derivedAllWorksAwardDate || '';
  const schedule = calculateSchedule(source,today);
  const payments = calculatePayments(source,schedule);
  // Fixed deliverable population; changing an estimate to a contract date must not change progress.
  const deliverables = schedule.list.filter(x => x.contractRule);
  const completed = deliverables.filter(x => x.effectiveApproval).length;
  const pending = deliverables.filter(x => x.effectiveSubmit && !x.effectiveApproval).length;
  const open = deliverables.filter(x => !x.effectiveSubmit && !x.effectiveApproval && x.contractDue);
  const overdue = open.filter(x => x.overdueDays > 0).length;
  const due14 = open.filter(x => {const n = daysBetween(today,x.contractDue); return n >= 0 && n <= 14;}).length;
  const due30 = open.filter(x => {const n = daysBetween(today,x.contractDue); return n >= 0 && n <= 30;}).length;
  const signedEffective = schedule.signing.effective;
  const phase = !schedule.awardEffective ? 'pre-award' : signedEffective ? 'active-performance' : 'effective-pre-sign';
  const phaseLabel = phase === 'pre-award' ? '尚未決標' : phase === 'effective-pre-sign' ? '契約已生效／待簽約' : '實際履約中';
  const started = deliverables.filter(x => x.contractDue).length;
  const notStarted = deliverables.length - started;
  const reviewOverdue = deliverables.filter(x => x.effectiveSubmit && !x.effectiveApproval && x.reviewOverdueDays > 0).length;
  const overall = !schedule.awardEffective ? '尚未決標／契約尚未生效' : overdue ? '有逾期事項' : reviewOverdue ? '審查列管中' : signedEffective ? '實際履約中' : '契約已生效／待簽約';
  const important = deliverables.filter(x => (x.effectiveSubmit && !x.effectiveApproval) || open.includes(x) && daysBetween(today,x.contractDue) <= 30)
    .sort((a,b) => (b.overdueDays - a.overdueDays) || (a.contractDue || '9999').localeCompare(b.contractDue || '9999')).slice(0,8);
  const stages = Object.values(deliverables.reduce((acc,item) => {
    const stage = acc[item.group] ||= {name:item.group,total:0,completed:0};
    stage.total++; if (item.effectiveApproval) stage.completed++; return acc;
  },{}));
  const dashboard = {completed,pending,overdue,due14,due30,reviewOverdue,started,notStarted,phase,phaseLabel,overall,total:deliverables.length,
    progress:deliverables.length ? Math.round(completed / deliverables.length * 100) : 0, important, stages};
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
