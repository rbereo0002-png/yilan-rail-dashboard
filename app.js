import {ProjectStore} from './store.js';
import {calculateModel} from './model.js';
import {todayLocal, signingState, SIGN_DATE_WARNING} from './dates.js';
import {renderModel, renderNavigation, exportHTML} from './views.js';

const $ = id => document.getElementById(id);
let store, model, lastDownloadURL;
const dateKeys = new Set(['noticeDate','pccDate','tenderApprovalDate','allWorksAwardDate','allWorksCloseDate']);
const milestoneKeys = new Set(['awardDate','evaluationDate','negotiationDate','signDate','actualSignDate']);
async function loadJSON(path) {
  const response = await fetch(path,{cache:'no-store'});
  if (!response.ok) throw new Error(`HTTP ${response.status}：${path}`);
  return response.json();
}
function showState() {
  document.querySelector('.grid').hidden = !store.project;
  $('appStatus').textContent = store.loading ? '載入標段中…' : [store.error,store.notice,store.project && store.dirty.has(store.project.id) ? '目前標段有未儲存修改；切換標段時保留本次工作草稿。' : ''].filter(Boolean).join(' ');
  document.querySelectorAll('input,textarea,select').forEach(input=>{
    input.disabled = input.id !== 'projectSelect' && (store.loading || store.readOnly);
  });
  document.querySelectorAll('[data-action]').forEach(button=>{
    button.disabled = store.loading && !['view'].includes(button.dataset.action);
  });
}
function refresh() {
  if (store.project && !store.loading) {
    model = calculateModel(store.project,todayLocal());
    renderModel(model,{readOnly:store.readOnly,catalog:store.catalog});
  }
  showState();
}
function fail(error) {
  store.error=error.message;
  if (model) renderModel(model,{readOnly:store.readOnly,catalog:store.catalog});
  showState();
}
function download(content,name,type) {
  if (lastDownloadURL) URL.revokeObjectURL(lastDownloadURL);
  lastDownloadURL=URL.createObjectURL(new Blob([content],{type}));
  const anchor=document.createElement('a');anchor.href=lastDownloadURL;anchor.download=name;
  document.body.append(anchor);anchor.click();anchor.remove();
}
async function action(name) {
  if (!store) return;
  if (store.loading && name !== 'view') return;
  if (name === 'view') {
    const readOnly=!store.readOnly;
    const query=new URLSearchParams(location.search);
    if (readOnly) query.set('view','1'); else query.delete('view');
    history.replaceState(null,'',`${location.pathname}${query.size ? `?${query}` : ''}`);
    await store.setReadOnly(readOnly);
    return;
  }
  if (!store.project) return;
  if (name === 'recalc') refresh();
  else if (name === 'save' && !store.readOnly) store.save();
  else if (name === 'reset' && !store.readOnly && confirm('放棄目前標段本機修改並重新載入 GitHub 資料？')) await store.reset();
  else if (name === 'json' && !store.readOnly) download(JSON.stringify(store.project,null,2),`${store.project.id}.json`,'application/json;charset=utf-8');
  else if (name === 'import' && !store.readOnly) $('importFile').click();
  else if (name === 'excel') {
    refresh();
    download('\ufeff'+exportHTML(model),`宜蘭高架_${store.project.name}_履約付款管制_${model.today}.xls`,'application/vnd.ms-excel;charset=utf-8');
  } else if (name === 'print') {refresh();window.print();}
  else if (name === 'schedule') $('scheduleTable').scrollIntoView({behavior:'smooth'});
  else if (name === 'payment') $('paymentTable').scrollIntoView({behavior:'smooth'});
}
async function init() {
  const catalog=await loadJSON('projects.json');
  let storage;
  try {storage=window.localStorage;} catch {storage=null;}
  store=new ProjectStore({catalog,loader:loadJSON,storage,onChange:refresh,readOnly:new URLSearchParams(location.search).get('view') === '1'});
  renderNavigation(catalog,catalog.defaultProject);
  document.addEventListener('click',event=>{
    const project=event.target.closest('[data-project]');
    if (project) {void store.select(project.dataset.project);return;}
    const button=event.target.closest('[data-action]');
    if (button) void action(button.dataset.action).catch(fail);
  });
  document.addEventListener('change',event=>{
    const input=event.target;
    if (input.id === 'projectSelect') {void store.select(input.value);return;}
    if (input.id === 'importFile') {
      const file=input.files?.[0];input.value='';
      const request=store.request;
      if (file) void file.text().then(text=>{if (request===store.request)store.importProject(JSON.parse(text));}).catch(fail);
      return;
    }
    if (store.readOnly || store.loading) return;
    if (input.id === 'actualSignDate') {
      input.max=todayLocal();
      if (signingState(input.value,input.max).future) {
        input.setCustomValidity(SIGN_DATE_WARNING);input.reportValidity();
        input.setCustomValidity('');
        fail(new Error(SIGN_DATE_WARNING));return;
      }
    }
    try {
      store.edit(p=>{
        if (input.dataset.row) {
          const {row,kind}=input.dataset;p.rows[`${row}_${kind}`]=input.value;
          const node=model.schedule.model[row];
          if (kind === 'approval' && node.dateField) p.dates[node.dateField]=input.value;
        } else if (input.dataset.budget) p.contract[input.dataset.budget]=Number(input.value);
        else if (input.dataset.notice) p.notices[input.dataset.notice]=input.value;
        else if (milestoneKeys.has(input.id)) p.milestones[input.id]=input.value;
        else if (dateKeys.has(input.id)) {
          p.dates[input.id]=input.value;
          const node=model.schedule.list.find(x=>x.dateField === input.id);
          if (node) p.rows[`${node.id}_approval`]=input.value;
        } else if (input.id === 'pcmDays') p.settings.pcmDays=Number(input.value);
        else if (input.id === 'payMode') p.settings.payWorkdays=Number(input.value);
        else if (input.id === 'forecastMode') p.settings.forecastMode=input.value;
        else if (input.id === 'holidays') p.settings.holidays=input.value.split(/[\s,;]+/).filter(Boolean);
        else if (input.id === 'soilWaterEnabled') p.settings.enabledRules.soilWaterPlan=input.checked;
      });
    } catch (error) {fail(error);}
  });
  window.addEventListener('beforeunload',event=>{if (store.dirty.size) {event.preventDefault();event.returnValue='';}});
  window.addEventListener('pagehide',()=>{if(lastDownloadURL)URL.revokeObjectURL(lastDownloadURL);});
  window.addEventListener('focus',()=>{if(model && model.today !== todayLocal() && !store.loading)refresh();});
  let last;
  try {last=storage?.getItem('yilan-dashboard-last-project');} catch { /* remote defaults remain usable */ }
  await store.select(catalog.projects.some(p=>p.id === last) ? last : catalog.defaultProject);
}
init().catch(error=>{$('appStatus').textContent=`無法載入資料：${error.message}。請透過 HTTP／GitHub Pages 開啟本頁。`;});
