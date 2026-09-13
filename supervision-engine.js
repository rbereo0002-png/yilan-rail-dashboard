// Retained opt-in simulation. Not called by the production homepage/model/export.
import {supervisionPaymentRules as rules} from './rules.js';
import {addWorkdays} from './dates.js';
export function calculateSupervision(project) {
  const {supervisionStart:start,constructionStart:cs,constructionEnd:ce,constructionClose:close} = project.dates;
  const total = project.settings.forecastMode === 'contract' ? project.contract.supervision : project.budget.supervision;
  const list = []; let cumulative = 0;
  if (start) { cumulative = rules.advance; list.push({name:'進駐款',ratio:rules.advance,triggerDate:start,cumulative}); }
  if (cs && ce && ce > cs) {
    const points = []; let cursor = cs;
    while (cursor < ce) {
      const d = new Date(`${cursor}T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + rules.intervalMonths);
      cursor = d.toISOString().slice(0,10); if (cursor > ce) cursor = ce; points.push(cursor);
    }
    points.forEach((date,i) => {const ratio = rules.progress / points.length; cumulative += ratio;
      list.push({name:`估驗${i + 1}`,ratio,triggerDate:date,cumulative});});
  }
  if (close) list.push({name:'尾款',ratio:rules.retention,triggerDate:close,cumulative:100});
  return list.map(x => ({...x,amount:total*x.ratio/100,payDate:addWorkdays(x.triggerDate,project.settings.payWorkdays,project.settings.holidays)}));
}
