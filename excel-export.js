import {validDate} from './dates.js';
import {loadExcelLibrary} from './excel-library.js';

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const SHEET_NAMES = Object.freeze(['履約總覽','設計主時程','前後置關聯','付款預測','年度資金需求','契約時限主檔','基準資料','延誤影響']);
const dueNames = {contract:'契約期限',management:'管理預估期限',external:'外部／條件式'};
const tierNames = {ready:'已達請款條件',forecast:'管理預估付款',external:'尚待外部條件'};
const formats = {date:'yyyy/mm/dd',money:'#,##0',percent:'0.00%'};
const date = value => validDate(value) ? new Date(`${value}T00:00:00Z`) : null;
const pred = (item,model) => model.schedule.model[item.predecessor]?.name || (item.triggerType === 'externalNotice' ? '甲方通知' : '—');
const status = item => item.status.text;
const percentage = value => value == null ? null : value / 100;

export function excelFilename(model) {
  if (!validDate(model.today)) throw new Error('匯出資料日期無效');
  const segment = {north:'北段',south:'南段'}[model.project.id];
  if (!segment) throw new Error('匯出標段無效');
  return `宜蘭高架_${segment}_履約管制_${model.today.replaceAll('-','')}.xlsx`;
}

// Projection only: dates and percentages are converted for Excel presentation.
// All schedule, payment, status, KPI and annual totals come from the supplied model.
export function buildWorkbook(model, ExcelJS) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = '宜蘭高架履約管制系統';
  workbook.title = `${model.project.name}履約管制`;
  const add = (name,headers,rows,kinds={}) => {
    const sheet = workbook.addWorksheet(name,{views:[{state:'frozen',ySplit:1}]});
    sheet.addRow(headers);
    sheet.addRows(rows);
    sheet.getRow(1).font = {bold:true};
    sheet.getRow(1).alignment = {vertical:'middle',wrapText:true};
    sheet.getRow(1).height = 30;
    headers.forEach((header,i) => {
      const col = sheet.getColumn(i+1), kind = kinds[i+1];
      col.width = kind === 'date' ? 16 : kind === 'money' ? 20 : kind === 'percent' ? 14 : Math.min(48,Math.max(14,header.length*2+2,...rows.map(row => Math.min(48,String(row[i] ?? '').length*2+2))));
      col.alignment = {vertical:'top',wrapText:true};
      if (formats[kind]) col.numFmt = formats[kind];
    });
    return sheet;
  };
  const keyValues = (name,entries) => {
    const sheet = add(name,['項目','內容'],entries.map(([label,value])=>[label,value]));
    sheet.getColumn(1).width = 36; sheet.getColumn(2).width = 72;
    entries.forEach((entry,i)=>{if(formats[entry[2]])sheet.getCell(i+2,2).numFmt=formats[entry[2]];});
    return sheet;
  };
  const p = model.project, d = model.dashboard, totals = model.payments.totals;
  const milestones = [
    ['決標日',date(p.milestones.awardDate),'date'],
    ['評選日',date(p.milestones.evaluationDate),'date'],
    ['議價日',date(p.milestones.negotiationDate),'date'],
    ['簽約基準日',date(p.milestones.signDate),'date'],
    ['實際簽約日',date(p.milestones.actualSignDate),'date']
  ];
  keyValues('履約總覽',[
    ['計畫名稱',p.title],['標段',p.name],['今日',date(model.today),'date'],...milestones,
    ['整體狀態',d.overall],['已逾期',d.overdue],['14日內到期',d.due14],['30日內到期',d.due30],
    ['待核定',d.pending],['已完成',d.completed],['設計成果完成度',percentage(d.progress),'percent'],
    ['已達請款金額',totals.ready.amount,'money'],['管理預估付款金額',totals.forecast.amount,'money'],
    ['尚待外部條件金額',totals.external.amount,'money'],
    ['說明','管理預估日期不等同契約明定期限。'],
    ['付款範圍','沿用目前畫面；用地及監造付款未納入本版年度彙整。'],
    ['資料提醒',model.summary.warnings.join('；')]
  ]);
  add('設計主時程',['階段','成果／工作','期限性質','起算基準','契約日數','起算日','契約期限','管理預估期限','實際提送日','實際核定日','狀態','說明'],
    model.schedule.list.map(x=>[x.group,x.name,dueNames[x.dueType],pred(x,model),x.days ?? null,date(x.forecastStart),date(x.contractDue),date(x.managementForecast),date(x.actualSubmit),date(x.actualApproval),status(x),
      `${x.note || ''}；預估核定：${validDate(x.forecastApproval) ? x.forecastApproval.replaceAll('-','/') : '—'}${x.holiday ? '；期限逢假日，不順延' : ''}`]),
    {6:'date',7:'date',8:'date',9:'date',10:'date'});
  add('前後置關聯',['類別','工作／成果','契約文字／規則摘要','前置節點','期限性質','契約日數','管理基準日期','目前提送預估／實際','延誤判讀','付款連動'],
    model.schedule.list.map(x=>[x.group,x.name,x.note,pred(x,model),dueNames[x.dueType],x.days ?? null,date(x.baselineDue),date(x.forecastDue),`基準偏移 ${x.forecastShift} 日；${status(x)}`,x.payment || '—']),{7:'date',8:'date'});
  add('付款預測',['類別','付款條件','付款性質','比例','條件日期','預估付款日','預估金額','設計累計','年度','備註'],
    model.payments.list.map(x=>[x.category,x.name,tierNames[x.tier],percentage(x.ratio),date(x.triggerDate),date(x.payDate),x.amount,percentage(x.designCumulative),x.year ? Number(x.year) : null,x.note]),
    {4:'percent',5:'date',6:'date',7:'money',8:'percent'});
  add('年度資金需求',['年度','已達條件金額','管理預估金額','合計','筆數'],
    model.payments.years.map(x=>[Number(x.year),x.ready,x.forecast,x.amount,x.count]),{2:'money',3:'money',4:'money'});
  add('契約時限主檔',['類別','工作／成果','前置節點','期限性質','起算日','契約期限','管理預估期限','實際提送','實際核定','狀態','付款連動'],
    model.schedule.list.map(x=>[x.group,x.name,pred(x,model),x.dueType === 'contract' ? '已起算契約期限' : dueNames[x.dueType],date(x.forecastStart),date(x.contractDue),date(x.managementForecast),date(x.actualSubmit),date(x.actualApproval),status(x),x.payment || '—']),
    {5:'date',6:'date',7:'date',8:'date',9:'date'});
  keyValues('基準資料',[
    ...milestones,['PCM 管理預估審查日數',p.settings.pcmDays],['付款行政作業估算（工作天）',p.settings.payWorkdays],
    ['估算模式',p.settings.forecastMode === 'contract' ? '依契約/決標分項' : '依預算書'],
    ...[['期末設計甲方通知日','noticeDate'],['工程會核定日','pccDate'],['招標文件核定日','tenderApprovalDate'],['各分標工程全部決標日','allWorksAwardDate'],['全部工程驗收結算完成日','allWorksCloseDate']].map(([label,key])=>[label,date(p.dates[key]),'date']),
    ['自訂非工作日',p.settings.holidays.join(', ')],
    ...model.schedule.list.filter(x=>x.triggerType === 'externalNotice').map(x=>[`${x.name}：甲方通知日`,date(p.notices[x.id]),'date']),
    ['說明','管理預估日期不等同契約明定期限。'],
    ['起算日欄說明','沿用畫面 forecastStart，可能為管理預估；是否已起算契約期限請依期限性質及契約期限欄判讀。']
  ]);
  add('延誤影響',['類別','工作／成果','提送逾期（日）','審查超過管理目標（日）','基準偏移（日）','管理基準日期','目前提送預估／實際','狀態'],
    model.summary.affected.map(x=>[x.group,x.name,x.submitDelay,x.reviewDelay,x.forecastShift,date(x.baselineDue),date(x.forecastDue),status(x)]),{6:'date',7:'date'});
  return workbook;
}

export async function createExcelExport(model) {
  // Capture the model and filename before awaiting: switching projects during
  // serialization cannot mix one project's data with the other project's name.
  const filename = excelFilename(model);
  const ExcelJS = await loadExcelLibrary();
  const workbook = buildWorkbook(model,ExcelJS);
  return {filename,buffer:await workbook.xlsx.writeBuffer(),mime:XLSX_MIME};
}
