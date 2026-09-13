import {paymentRules} from './rules.js';
import {addWorkdays} from './dates.js';

export function calculatePayments(project, schedule) {
  const list = paymentRules.map(rule => {
    const trigger = schedule.model[rule.triggerRef];
    if (!trigger) throw new Error(`付款規則缺少節點：${rule.paymentId}`);
    const actualTrigger = trigger.effectiveApproval || null;
    const forecastTrigger = trigger.actualApproval || trigger.forecastApproval || null;
    const tier = actualTrigger ? 'ready' : forecastTrigger ? 'forecast' : 'external';
    const base = project.settings.forecastMode === 'contract' ? project.contract[rule.budgetKey] : project.budget[rule.budgetKey];
    const triggerDate = actualTrigger || forecastTrigger;
    const payDate = addWorkdays(triggerDate, project.settings.payWorkdays, project.settings.holidays);
    return {...rule, tier, triggerDate, actualTrigger, payDate, amount:Number(base || 0) * rule.ratio / 100,
      year:payDate ? payDate.slice(0, 4) : null};
  });
  const totals = {ready:{count:0,amount:0},forecast:{count:0,amount:0},external:{count:0,amount:0}};
  const years = {};
  for (const payment of list) {
    totals[payment.tier].count++;
    totals[payment.tier].amount += payment.amount;
    if (payment.year) {
      const year = years[payment.year] ||= {year:payment.year, amount:0, count:0, ready:0, forecast:0, external:0};
      year.amount += payment.amount; year.count++; year[payment.tier] += payment.amount;
    }
  }
  const nextPayDate = list.filter(p => p.payDate && p.payDate >= schedule.today).map(p => p.payDate).sort()[0] || null;
  return {list, byId:Object.fromEntries(list.map(p => [p.paymentId,p])), totals, years:Object.values(years), nextPayDate};
}
