import {calculateSchedule} from './schedule-engine.js';
import {calculatePayments} from './payment-engine.js';
import {daysBetween} from './dates.js';

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze); Object.freeze(value);
  }
  return value;
}
export function calculateModel(project, today) {
  const source = structuredClone(project);
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
  const signed = schedule.actualSign && schedule.actualSign <= today;
  const overall = !signed ? '尚未登錄實際簽約' : overdue ? '有逾期事項' : due14 ? '有近期到期事項' : pending ? '有成果待核定' : '正常管制';
  const important = deliverables.filter(x => (x.effectiveSubmit && !x.effectiveApproval) || open.includes(x) && daysBetween(today,x.contractDue) <= 30)
    .sort((a,b) => (b.overdueDays - a.overdueDays) || (a.contractDue || '9999').localeCompare(b.contractDue || '9999')).slice(0,8);
  const stages = Object.values(deliverables.reduce((acc,item) => {
    const stage = acc[item.group] ||= {name:item.group,total:0,completed:0};
    stage.total++; if (item.effectiveApproval) stage.completed++; return acc;
  },{}));
  const dashboard = {completed,pending,overdue,due14,due30,overall,total:deliverables.length,
    progress:deliverables.length ? Math.round(completed / deliverables.length * 100) : 0, important, stages};
  const counts = {contract:0,management:0,external:0};
  schedule.list.forEach(x => counts[x.dueType]++);
  const latest = values => values.filter(Boolean).sort().at(-1) || null;
  const affected = schedule.list.filter(x => x.forecastShift > 0 || x.reviewDelay > 0 || x.submitDelay > 0);
  const summary = {counts,lastContract:latest(schedule.list.map(x => x.contractDue)),
    lastForecast:latest(schedule.list.map(x => x.forecastDue)),affected,
    maxShift:Math.max(0,...schedule.list.map(x => x.forecastShift)),
    warnings:[...(source.migrationWarnings || []),...schedule.list.flatMap(x => x.warnings.map(w => `${x.name}：${w}`))]};
  return freeze({project:source,today,schedule,payments,dashboard,summary});
}
