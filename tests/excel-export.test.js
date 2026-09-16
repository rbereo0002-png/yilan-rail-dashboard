import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {normalizeProject,ProjectStore} from '../store.js';
import {calculateModel} from '../model.js';
import {createExcelExport,buildWorkbook,excelFilename,SHEET_NAMES,XLSX_MIME} from '../excel-export.js';
import {loadExcelLibrary} from '../excel-library.js';

const read = path => readFileSync(new URL(`../${path}`,import.meta.url));
const project = id => normalizeProject(JSON.parse(read(`data/${id}.json`)));
const ExcelJS = await loadExcelLibrary();
const names = ['履約總覽','設計主時程','前後置關聯','付款預測','年度資金需求','契約時限主檔','基準資料','延誤影響'];
const roundTrip = async model => {
  const file = await createExcelExport(model);
  assert.equal(Buffer.from(file.buffer).subarray(0,4).toString('hex'),'504b0304','real ZIP/OOXML, not HTML');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(file.buffer);
  return {file,workbook};
};
const kv = (book,sheet,label) => {
  let cell;
  book.getWorksheet(sheet).eachRow(row=>{if(row.getCell(1).value === label)cell=row.getCell(2);});
  assert.ok(cell,label);return cell;
};
for (const id of ['south','north']) {
  test(`${id}: genuine .xlsx round trip retains Chinese sheets, header styles and frozen panes`,async()=>{
    const model = calculateModel(project(id),'2026-09-16');
    const {file,workbook} = await roundTrip(model);
    assert.equal(file.filename,`宜蘭高架_${id === 'south' ? '南段' : '北段'}_履約管制_20260916.xlsx`);
    assert.equal(file.mime,XLSX_MIME);
    assert.deepEqual(workbook.worksheets.map(x=>x.name),names);
    assert.deepEqual(SHEET_NAMES,names);
    for(const sheet of workbook.worksheets){
      assert.equal(sheet.getRow(1).font.bold,true);
      assert.equal(sheet.views[0].state,'frozen');assert.equal(sheet.views[0].ySplit,1);
      assert.ok(sheet.getColumn(1).width >= 14);
      sheet.eachRow(row=>row.eachCell(cell=>assert.doesNotMatch(String(cell.value),/Invalid Date|�/)));
    }
    assert.equal(kv(workbook,'履約總覽','計畫名稱').value,model.project.title);
    assert.equal(workbook.getWorksheet('設計主時程').rowCount,model.schedule.list.length+1);
  });
  test(`${id}: payment numbers, percentages and annual totals match model in both estimate modes`,async()=>{
    for(const mode of ['budget','contract']){
      const p=project(id);p.settings.forecastMode=mode;p.contract.design=123456789.5;
      p.milestones.actualSignDate='2026-10-01';p.rows.execPlan_approval='2026-11-15';
      const model=calculateModel(p,'2026-12-01'),{workbook}=await roundTrip(model);
      const sheet=workbook.getWorksheet('付款預測');
      model.payments.list.forEach((x,i)=>{
        const row=sheet.getRow(i+2);
        assert.equal(typeof row.getCell(7).value,'number');assert.equal(row.getCell(7).value,x.amount);
        assert.equal(row.getCell(7).numFmt,'#,##0');
        assert.equal(row.getCell(4).value,x.ratio/100);assert.equal(row.getCell(4).numFmt,'0.00%');
        assert.equal(row.getCell(8).value,x.designCumulative == null ? null : x.designCumulative/100);
        assert.equal(row.getCell(8).numFmt,'0.00%');
      });
      const years=workbook.getWorksheet('年度資金需求');
      model.payments.years.forEach((x,i)=>assert.deepEqual(years.getRow(i+2).values.slice(1),[Number(x.year),x.ready,x.forecast,x.amount,x.count]));
      assert.equal(kv(workbook,'履約總覽','已達請款金額').value,model.payments.totals.ready.amount);
      assert.equal(kv(workbook,'履約總覽','管理預估付款金額').value,model.payments.totals.forecast.amount);
      assert.equal(kv(workbook,'履約總覽','尚待外部條件金額').value,model.payments.totals.external.amount);
      assert.equal(kv(workbook,'履約總覽','設計成果完成度').value,model.dashboard.progress/100);
    }
  });
}

test('blank and invalid dates are empty; valid dates are native Excel dates',async()=>{
  const model=structuredClone(calculateModel(project('south'),'2026-09-16'));
  model.project.milestones.evaluationDate='invalid';model.project.milestones.negotiationDate='2026-02-30';
  const {workbook}=await roundTrip(model);
  for(const label of ['評選日','議價日','實際簽約日'])assert.equal(kv(workbook,'基準資料',label).value,null);
  const cell=kv(workbook,'基準資料','簽約基準日');
  assert.ok(cell.value instanceof Date);assert.equal(cell.value.toISOString(),'2026-10-01T00:00:00.000Z');assert.equal(cell.numFmt,'yyyy/mm/dd');
  for(const sheet of workbook.worksheets)sheet.eachRow(row=>row.eachCell(c=>{
    assert.doesNotMatch(String(c.value),/Invalid Date/);
    if(c.value instanceof Date)assert.ok(Number.isFinite(+c.value));
  }));
});

test('schedule, dependencies, contract tiers and delay rows retain engine results',async()=>{
  const p=project('south');p.milestones.actualSignDate='2026-10-01';
  p.rows.execPlan_submit='2026-11-12';p.rows.execPlan_approval='2026-12-20';
  const model=calculateModel(p,'2027-01-01'),{workbook}=await roundTrip(model);
  assert.ok(model.summary.affected.length>0);
  const dateValue=v=>v ? new Date(v+'T00:00:00Z') : null;
  model.schedule.list.forEach((x,i)=>{
    const row=workbook.getWorksheet('設計主時程').getRow(i+2);
    assert.equal(row.getCell(2).value,x.name);
    for(const [col,key] of [[6,'forecastStart'],[7,'contractDue'],[8,'managementForecast'],[9,'actualSubmit'],[10,'actualApproval']])assert.deepEqual(row.getCell(col).value,dateValue(x[key]));
    assert.equal(row.getCell(11).value,x.status.text);
    const dep=workbook.getWorksheet('前後置關聯').getRow(i+2);
    assert.equal(dep.getCell(3).value,x.note);assert.deepEqual(dep.getCell(7).value,dateValue(x.baselineDue));assert.deepEqual(dep.getCell(8).value,dateValue(x.forecastDue));
    assert.equal(workbook.getWorksheet('契約時限主檔').getRow(i+2).getCell(4).value,{contract:'已起算契約期限',management:'管理預估期限',external:'外部／條件式'}[x.dueType]);
  });
  model.summary.affected.forEach((x,i)=>assert.deepEqual(workbook.getWorksheet('延誤影響').getRow(i+2).values.slice(1),[x.group,x.name,x.submitDelay,x.reviewDelay,x.forecastShift,dateValue(x.baselineDue),dateValue(x.forecastDue),x.status.text]));
});

test('baseline exports all editable requested settings and three land notices',async()=>{
  const p=project('north');p.settings.pcmDays=45;p.settings.payWorkdays=0;p.settings.forecastMode='contract';p.settings.holidays=['2026-10-10'];
  p.notices={tempBoundary:'2026-10-20',permBoundaryPlan:'2026-11-01',permBoundary:'2026-11-02'};
  const model=calculateModel(p,'2026-12-01'),{workbook}=await roundTrip(model);
  assert.equal(kv(workbook,'基準資料','PCM 管理預估審查日數').value,45);
  assert.equal(kv(workbook,'基準資料','付款行政作業估算（工作天）').value,0);
  assert.equal(kv(workbook,'基準資料','估算模式').value,'依契約/決標分項');
  assert.equal(kv(workbook,'基準資料','自訂非工作日').value,'2026-10-10');
  for(const x of model.schedule.list.filter(x=>x.triggerType==='externalNotice'))assert.equal(kv(workbook,'基準資料',`${x.name}：甲方通知日`).value.toISOString().slice(0,10),p.notices[x.id]);
  for(const label of ['期末設計甲方通知日','工程會核定日','招標文件核定日','各分標工程全部決標日','全部工程驗收結算完成日'])assert.equal(kv(workbook,'基準資料',label).value,null);
  assert.equal(kv(workbook,'基準資料','說明').value,'管理預估日期不等同契約明定期限。');
});

test('export does not mutate frozen model, input project, store drafts or business JSON',async()=>{
  const files=['data/north.json','data/south.json','projects.json'];
  const hashes=()=>files.map(f=>createHash('sha256').update(read(f)).digest('hex'));
  const beforeHashes=hashes();
  const catalog=JSON.parse(read('projects.json'));
  for(const readOnly of [false,true]){
    const store=new ProjectStore({catalog,readOnly,loader:async path=>JSON.parse(read(path)),storage:null});
    await store.select('south');
    const before=structuredClone(store.project),drafts=structuredClone([...store.drafts]),dirty=[...store.dirty],request=store.request;
    const model=calculateModel(store.project,'2026-09-16'),snapshot=structuredClone(model);
    assert.ok(Object.isFrozen(model));await createExcelExport(model);
    assert.deepEqual(model,snapshot);assert.deepEqual(store.project,before);
    assert.deepEqual([...store.drafts],drafts);assert.deepEqual([...store.dirty],dirty);assert.equal(store.request,request);
  }
  assert.deepEqual(hashes(),beforeHashes);
});

test('switching the selected model while serialization is pending cannot mix filename and data',async()=>{
  let selected=calculateModel(project('south'),'2026-09-16');
  const pending=createExcelExport(selected);
  selected=calculateModel(project('north'),'2026-09-16');
  const file=await pending,book=new ExcelJS.Workbook();await book.xlsx.load(file.buffer);
  assert.match(file.filename,/_南段_/);assert.equal(kv(book,'履約總覽','標段').value,'南段');
  assert.equal(selected.project.id,'north');
});

test('text beginning with formula characters remains literal, never an Excel formula',async()=>{
  const p=project('south');p.title='=HYPERLINK("https://example.com","文字")';
  const {workbook}=await roundTrip(calculateModel(p,'2026-09-16'));
  const cell=kv(workbook,'履約總覽','計畫名稱');assert.equal(cell.value,p.title);assert.equal(cell.formula,undefined);
});

test('empty forecast yields header-only annual and delay sheets without made-up values',async()=>{
  const p=project('south');p.milestones.signDate='';p.milestones.awardDate='';
  const {workbook}=await roundTrip(calculateModel(p,'2026-09-16'));
  assert.equal(workbook.getWorksheet('年度資金需求').rowCount,1);
  assert.equal(workbook.getWorksheet('延誤影響').rowCount,1);
});

test('export consumes model only: no DOM parsing, business calculation or store writes',()=>{
  const src=String(read('excel-export.js'));
  assert.doesNotMatch(src,/\bdocument\.|querySelector|\btd\[|calculateModel|calculateSchedule|calculatePayments|localStorage|\.edit\(|\.save\(/);
  const app=String(read('app.js'));
  const excelAction=app.split("name === 'excel'")[1].split("name === 'print'")[0];
  assert.doesNotMatch(excelAction,/refresh\(|exportHTML|\.xls[`'"]|store\.project/);
  assert.match(excelAction,/createExcelExport\(snapshot\)/);
  assert.match(String(read('index.html')),/匯出 Excel \(\.xlsx\)/);
});

test('filename rejects invalid date or unexpected project instead of misleading download',()=>{
  const model=structuredClone(calculateModel(project('south'),'2026-09-16'));
  model.today='invalid';assert.throws(()=>excelFilename(model),/日期/);
  model.today='2026-09-16';model.project.id='unknown';assert.throws(()=>excelFilename(model),/標段/);
  assert.equal(typeof buildWorkbook,'function');
});
