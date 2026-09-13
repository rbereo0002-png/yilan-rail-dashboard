import {YilanRules, calculationPolicy} from './rules.js';
import {addDays, daysBetween, isHoliday, todayLocal, signingState} from './dates.js';

export function calculateSchedule(project, today = todayLocal()) {
  const rules = YilanRules.getRules(project.id, project.settings);
  const byRule = new Map(rules.map(rule => [rule.id, rule]));
  const rows = project.rows || {}, dates = project.dates || {};
  const pcm = project.settings.pcmDays;
  const baselineSign = project.milestones.signDate || null;
  const actualSign = project.milestones.actualSignDate || null;
  const hasOccurred = date => !!date && date <= today;
  const signing = signingState(actualSign, today);
  const sign = signing.effective ? actualSign : baselineSign;
  const model = {
    sign: {id:'sign', name:'契約簽訂', baselineDue:baselineSign, baselineApproval:baselineSign,
      forecastDue:sign, forecastApproval:sign, actualApproval:signing.effective ? actualSign : null,
      effectiveApproval:signing.effective ? actualSign : null},
    award: {id:'award', name:'決標', actualApproval:project.milestones.awardDate || null}
  };
  const visiting = new Set();
  function resolve(id) {
    if (model[id]) return model[id];
    const rule = byRule.get(id);
    if (!rule) throw new Error(`找不到前置規則：${id}`);
    if (visiting.has(id)) throw new Error(`規則前後置形成循環：${id}`);
    visiting.add(id);
    const ref = rule.triggerRef ? resolve(rule.triggerRef) : null;
    const actualSubmit = rows[`${id}_submit`] || null;
    const actualApproval = rows[`${id}_approval`] || null;
    let baselineStart = null, forecastStart = null, actualBase = null;
    let baselineDue = null, plannedDue = null, externalCondition = false;
    switch (rule.triggerType) {
      case 'signDate':
        baselineStart = baselineSign; forecastStart = sign;
        actualBase = signing.effective ? actualSign : null;
        break;
      case 'awardDate':
        baselineStart = forecastStart = project.milestones.awardDate || null;
        actualBase = hasOccurred(forecastStart) ? forecastStart : null;
        break;
      case 'approvalOf':
        baselineStart = ref.baselineApproval;
        forecastStart = ref.forecastApproval;
        actualBase = ref.effectiveApproval;
        break;
      case 'basicApprovalOrNotice': {
        const notice = dates.noticeDate || null;
        baselineStart = notice || ref.baselineApproval;
        forecastStart = notice || ref.forecastApproval;
        actualBase = notice ? (hasOccurred(notice) ? notice : null) : ref.effectiveApproval;
        break;
      }
      case 'sameAs':
        baselineStart = ref.baselineStart; forecastStart = ref.forecastStart;
        baselineDue = ref.baselineDue; plannedDue = ref.targetDue;
        actualBase = ref.contractDue ? ref.forecastStart : null;
        break;
      case 'externalDate':
        externalCondition = true;
        plannedDue = actualApproval; // normalized legacy dates and row inputs share this value
        break;
      case 'eventAfter':
        baselineStart = ref.baselineDue;
        forecastStart = ref.actualApproval || ref.actualSubmit || ref.forecastDue;
        actualBase = ref.effectiveApproval || (hasOccurred(ref.actualSubmit) ? ref.actualSubmit : null);
        externalCondition = rule.days == null;
        break;
      case 'externalNotice':
        baselineStart = forecastStart = project.notices?.[id] || null;
        actualBase = hasOccurred(forecastStart) ? forecastStart : null;
        externalCondition = !forecastStart;
        break;
      case 'conditional':
        forecastStart = ref?.forecastApproval || null;
        externalCondition = true;
        break;
      default: throw new Error(`不支援的起算規則：${rule.triggerType}`);
    }
    if (rule.days != null) {
      baselineDue = addDays(baselineStart, rule.days);
      plannedDue = addDays(forecastStart, rule.days);
    }
    const managementOnly = calculationPolicy.managementOnly.includes(id);
    const contractDue = rule.contractRule && actualBase && !managementOnly
      ? (rule.triggerType === 'sameAs' ? ref.contractDue : addDays(actualBase, rule.days)) : null;
    const dueType = externalCondition || !plannedDue ? 'external' : contractDue ? 'contract' : 'management';
    const effectiveSubmit = hasOccurred(actualSubmit) ? actualSubmit : null;
    const effectiveApproval = hasOccurred(actualApproval) ? actualApproval : null;
    const forecastDue = actualSubmit || plannedDue;
    const baselineApproval = rule.contractRule ? addDays(baselineDue, pcm) : baselineDue;
    const forecastApproval = actualApproval || (rule.contractRule ? addDays(forecastDue, pcm) : forecastDue);
    const submitDelay = contractDue && effectiveSubmit ? Math.max(0, daysBetween(contractDue, effectiveSubmit)) : 0;
    const forecastShift = baselineDue && forecastDue ? Math.max(0, daysBetween(baselineDue, forecastDue)) : 0;
    const reviewTarget = effectiveSubmit ? addDays(effectiveSubmit, pcm) : null;
    const reviewDelay = reviewTarget && effectiveApproval ? Math.max(0, daysBetween(reviewTarget, effectiveApproval)) : 0;
    const overdueDays = !effectiveSubmit && !effectiveApproval && contractDue
      ? Math.max(0, daysBetween(contractDue, today)) : 0;
    const item = {...rule, baselineStart, baselineDue, baselineApproval, forecastStart,
      contractDue, managementForecast:dueType === 'management' ? plannedDue : null,
      externalCondition:dueType === 'external', dueType, targetDue:plannedDue,
      forecastDue, forecastApproval, actualSubmit, actualApproval, effectiveSubmit, effectiveApproval,
      submitDelay, forecastShift, reviewTarget, reviewDelay, overdueDays,
      holiday:isHoliday(contractDue || plannedDue, project.settings.holidays),
      warnings:[]};
    if ((actualSubmit && !effectiveSubmit) || (actualApproval && !effectiveApproval)) item.warnings.push('實際日期在未來，尚不計為完成／達成');
    if (actualApproval && actualSubmit && actualApproval < actualSubmit) item.warnings.push('核定日早於提送日，請核對');
    item.status = statusOf(item, today);
    model[id] = item;
    visiting.delete(id);
    return item;
  }
  const list = rules.map(rule => resolve(rule.id));
  return {projectId:project.id, today, pcm, sign, actualSign, signing, model, list};
}

function statusOf(item, today) {
  if (item.effectiveApproval) return {text:item.submitDelay ? `已核定；提送逾期 ${item.submitDelay} 日` : '已核定', cls:item.submitDelay ? 'tl-warning' : 'tl-done'};
  if (item.effectiveSubmit) return {text:item.submitDelay ? `待核定；提送逾期 ${item.submitDelay} 日` : '已提送待核定', cls:'tl-warning'};
  if (item.conditional) return {text:'條件式／待確認', cls:'tl-external'};
  if (item.dueType === 'external') return {text:'待通知／外部條件', cls:'tl-external'};
  if (item.dueType === 'management') return {text:item.targetDue < today ? '管理預估已過，請更新' : '管理預估', cls:'tl-normal'};
  if (item.overdueDays) return {text:`契約逾期 ${item.overdueDays} 日`, cls:'tl-danger'};
  const remain = daysBetween(today, item.contractDue);
  return {text:remain <= 14 ? `${remain} 日內到期` : '管制中', cls:remain <= 14 ? 'tl-warning' : 'tl-normal'};
}
