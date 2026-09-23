import {normalizeProject} from './store.js';
import {calculateModel} from './model.js';
import {formatDate as fmt,todayLocal,daysBetween} from './dates.js';

const $=id=>document.getElementById(id);
const money=n=>Number(n||0).toLocaleString('zh-TW',{maximumFractionDigits:0});
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct=(a,b)=>b?Math.round(a/b*100):0;

let models={}, currentView='overview';
const FONT_KEY='yilan-executive-font-size';
function applyFontSize(size='standard'){
  const value=['standard','large','xlarge'].includes(size)?size:'standard';
  document.body.classList.toggle('font-large',value==='large');
  document.body.classList.toggle('font-xlarge',value==='xlarge');
  document.querySelectorAll('[data-font-size]').forEach(btn=>btn.setAttribute('aria-pressed',String(btn.dataset.fontSize===value)));
  try{localStorage.setItem(FONT_KEY,value);}catch{}
}
function restoreFontSize(){
  let size='standard';
  try{size=localStorage.getItem(FONT_KEY)||'standard';}catch{}
  applyFontSize(size);
}

async function loadJSON(path){
  const r=await fetch(path,{cache:'no-store'});
  if(!r.ok) throw new Error(`${path} 載入失敗（${r.status}）`);
  return r.json();
}

function projectFocus(m){
  const special=m.dashboard.preSignSpecialItems[0];
  if(special) return `${special.name}：期限 ${fmt(special.contractDue)}`;
  const att=m.dashboard.attention[0];
  if(att) return `${att.name}：${att.attentionReason}`;
  if(m.dashboard.phase==='awaiting-sign') return `目前待完成實際簽約；一般履約於簽約後正式起算。`;
  if(m.dashboard.phase==='pre-award') return '目前待完成決標程序。';
  return '目前無重大逾期或需主管立即處理事項。';
}

function segmentCard(m){
  const p=m.project,d=m.dashboard;
  return `<article class="segment-card segment-${esc(p.id)}">
    <div class="segment-head"><div><h3>${esc(p.name)}</h3><small>${esc(p.title)}</small></div><span class="phase">${esc(d.phaseLabel)}</span></div>
    <div class="key-dates">
      <div class="date-box"><span>決標／契約生效</span><b>${fmt(p.milestones.awardDate)}</b></div>
      <div class="date-box"><span>預定簽約</span><b>${fmt(p.milestones.signDate)}</b></div>
      <div class="date-box"><span>實際簽約</span><b>${fmt(p.milestones.actualSignDate)}</b></div>
    </div>
    <div class="segment-stats">
      <div class="stat-box"><span>逾期</span><b>${d.overdue}</b></div>
      <div class="stat-box"><span>14日內</span><b>${d.due14}</b></div>
      <div class="stat-box"><span>審查中</span><b>${d.underReview}</b></div>
      <div class="stat-box"><span>完成</span><b>${d.completed}/${d.total}</b></div>
    </div>
    <div class="focus-box"><strong>目前重點</strong><p>${esc(projectFocus(m))}</p></div>
  </article>`;
}

function row(label,desc,date,tag='',tagClass='tag-info'){
  return `<div class="list-row"><div>${tag?`<span class="tag ${tagClass}">${esc(tag)}</span>`:''}<b>${esc(label)}</b><small>${esc(desc||'')}</small></div><time>${fmt(date)}</time></div>`;
}
function projectListCard(title,m,items){
  return `<section class="detail-card"><h3>${esc(m.project.name)}｜${esc(title)}</h3><div class="list">${items.length?items.join(''):'<div class="empty">目前無列管事項</div>'}</div></section>`;
}
function nextMilestone(m){
  const candidates=[
    ...m.dashboard.preSignSpecialItems,
    ...m.schedule.list.filter(x=>!x.effectiveApproval && (x.contractDue || x.managementForecast || x.forecastDue))
  ].map(x=>({
    id:x.id,name:x.name,
    date:x.contractDue || x.managementForecast || x.forecastDue || null
  })).filter(x=>x.date && x.date>=m.today)
    .sort((a,b)=>a.date.localeCompare(b.date));
  return candidates[0] || null;
}
function managementBrief(){
  const ms=[models.south,models.north];
  const overdue=ms.reduce((n,m)=>n+m.dashboard.overdue,0);
  const reviewOverdue=ms.reduce((n,m)=>n+m.dashboard.reviewOverdue,0);
  const overall=overdue>0
    ? {label:'有逾期事項',cls:'brief-danger',desc:`目前共有 ${overdue} 項契約逾期，請優先處理。`,view:'attention'}
    : reviewOverdue>0
      ? {label:'審查需催辦',cls:'brief-warning',desc:`目前共有 ${reviewOverdue} 項審查超過期限／管理目標。`,view:'review'}
      : {label:'目前無重大逾期',cls:'brief-ok',desc:'南、北段目前無契約逾期事項；請持續注意近期關鍵節點。',view:'overview'};
  const segment=(m)=>{
    const next=nextMilestone(m);
    if(!next) return `<button type="button" class="brief-segment brief-action" data-view="progress"><span>${esc(m.project.name)}</span><b>目前無近期關鍵節點</b><small>${esc(m.dashboard.phaseLabel)}</small><em>查看進度 →</em></button>`;
    const days=daysBetween(m.today,next.date);
    return `<button type="button" class="brief-segment brief-action" data-view="progress"><span>${esc(m.project.name)}｜下一關鍵</span><b>${esc(next.name)}</b><small>${fmt(next.date)}・距今 ${days} 日</small><em>查看進度 →</em></button>`;
  };
  return `<section class="management-brief">
    <button type="button" class="brief-status brief-action ${overall.cls}" data-view="${overall.view}"><span>主管摘要</span><b>${overall.label}</b><small>${overall.desc}</small><em>${overall.view==='review'?'查看審查':'查看待辦'} →</em></button>
    ${segment(models.south)}
    ${segment(models.north)}
  </section>`;
}
function overviewMilestones(m){
  const ids=['designRiskPlan','execPlan','basic','final'];
  const items=ids.map(id=>m.schedule.model[id]).filter(Boolean).map(x=>{
    const planned=x.contractDue || x.managementForecast || null;
    const actual=x.effectiveApproval || null;
    const diff=planned&&actual ? daysBetween(planned,actual) : null;
    const status=actual ? (diff>0?'較預定晚':diff<0?'較預定早':'符合預定') : planned ? '待完成' : '尚未起算';
    const cls=actual ? (diff>0?'late':diff<0?'early':'on') : planned ? 'pending' : 'idle';
    return `<div class="overview-milestone-row">
      <div class="milestone-name"><b>${esc(x.name)}</b><small>${status}</small></div>
      <div class="milestone-dates"><span>預定 ${fmt(planned)}</span><span>實際 ${fmt(actual)}</span></div>
      <div class="milestone-diff ${cls}">${varianceLabel(diff)}</div>
    </div>`;
  }).join('');
  return `<section class="overview-milestones segment-${esc(m.project.id)}">
    <div class="overview-milestone-head"><div><b>${esc(m.project.name)}｜關鍵里程碑</b><small>${esc(m.dashboard.phaseLabel)}</small></div><button type="button" class="mini-link" data-view="progress">看完整進度 →</button></div>
    <div class="overview-milestone-list">${items || '<div class="empty">目前尚無關鍵里程碑資料</div>'}</div>
  </section>`;
}
function renderOverview(){
  $('viewTitle').textContent='南北段總覽';
  $('viewHint').textContent='先看整體狀態與關鍵里程碑；點選上方大項或「看完整進度」查看細項。';
  $('viewBody').innerHTML=`<div class="overview-dashboard">
    ${managementBrief()}
    <div class="segment-grid">${segmentCard(models.south)}${segmentCard(models.north)}</div>
    <div class="overview-milestone-grid">${overviewMilestones(models.south)}${overviewMilestones(models.north)}</div>
  </div>`;
}
function varianceClass(diff){
  if(diff == null) return 'variance-none';
  if(diff > 0) return 'variance-late';
  if(diff < 0) return 'variance-early';
  return 'variance-on';
}
function varianceLabel(diff){
  if(diff == null) return '尚無實際';
  if(diff > 0) return `+${diff}日`;
  if(diff < 0) return `${diff}日`;
  return '0日';
}
function progressComparison(m){
  const preferred=['designRiskPlan','execPlan','basic','final','tender','worksAward'];
  const rows=preferred.map(id=>m.schedule.model[id]).filter(Boolean)
    .map(x=>({
      id:x.id,name:x.name,
      start:x.forecastStart || x.baselineStart || null,
      planned:x.contractDue || x.managementForecast || x.forecastDue || null,
      actual:x.effectiveApproval || null
    }))
    .filter(x=>x.start || x.planned || x.actual);
  if(!rows.length) return '<div class="empty">目前尚無可比較之預定／實際日期。</div>';
  const allDates=rows.flatMap(x=>[x.start,x.planned,x.actual]).filter(Boolean).sort();
  const base=allDates[0] || m.today;
  const end=allDates.at(-1) || base;
  const maxDays=Math.max(1,daysBetween(base,end) || 1);
  const pos=date=>date ? Math.max(0,Math.min(100,(daysBetween(base,date)||0)/maxDays*100)) : 0;
  const chart=rows.map(x=>{
    const diff=x.planned&&x.actual ? daysBetween(x.planned,x.actual) : null;
    const startPos=pos(x.start || x.planned);
    const plannedPos=pos(x.planned);
    const actualPos=pos(x.actual);
    const plannedWidth=x.planned ? Math.max(2,plannedPos-startPos) : 0;
    const actualWidth=x.actual ? Math.max(2,actualPos-startPos) : 0;
    return `<div class="variance-row">
      <div class="variance-label"><b>${esc(x.name)}</b><small>起算 ${fmt(x.start)}｜預定 ${fmt(x.planned)}｜實際 ${fmt(x.actual)}</small></div>
      <div class="variance-bars range-bars">
        <div class="variance-track"><span class="variance-range planned" style="left:${startPos}%;width:${plannedWidth}%"></span></div>
        <div class="variance-track"><span class="variance-range actual" style="left:${startPos}%;width:${actualWidth}%"></span></div>
      </div>
      <div class="variance-diff ${varianceClass(diff)}">${varianceLabel(diff)}</div>
    </div>`;
  }).join('');
  return `<div class="variance-legend"><span><i class="start-dot"></i>起算</span><span><i class="planned-dot"></i>預定區間</span><span><i class="actual-dot"></i>實際完成</span><span>差異＝實際－預定</span></div><div class="variance-chart">${chart}</div>`;
}
function renderProgress(){
  $('viewTitle').textContent='設計進度｜預定・實際・差異';
  $('viewHint').textContent='以「起算日→預定完成」呈現預定區間，再比較實際完成與差異；可直接看出各工作起算先後。';
  const cards=['south','north'].map(id=>{
    const m=models[id];
    const stages=m.dashboard.stages.map(s=>`<div class="stage-row"><span>${esc(s.name)}</span><div class="stage-track"><div class="stage-fill" style="width:${pct(s.completed,s.total)}%"></div></div><b>${s.completed}/${s.total}</b></div>`).join('');
    return `<section class="detail-card progress-detail-card">
      <h3>${m.project.name}｜${esc(m.dashboard.phaseLabel)}</h3>
      <div class="progress-split">
        <div class="stage-block"><h4>成果完成度</h4>${stages}</div>
        <div class="variance-block"><h4>主要里程碑預定／實際差異</h4>${progressComparison(m)}</div>
      </div>
    </section>`;
  }).join('');
  $('viewBody').innerHTML=`<div class="detail-grid">${cards}</div>`;
}
function renderAttention(){
  $('viewTitle').textContent='重要待辦';
  $('viewHint').textContent='優先顯示逾期、審查催辦、14日及30日內事項；簽約前特殊事項另列。';
  const cards=['south','north'].map(id=>{
    const m=models[id],d=m.dashboard;
    const pre=d.preSignSpecialItems.map(x=>row(x.name,x.note,x.contractDue,'簽約前特別列管','tag-warn'));
    const active=d.attention.slice(0,8).map(x=>row(x.name,x.attentionReason,x.effectiveSubmit&&!x.effectiveApproval?x.reviewTarget:x.contractDue,x.attentionLabel,x.attentionPriority===0?'tag-danger':x.attentionPriority===1?'tag-warn':'tag-info'));
    return projectListCard('重要事項',m,[...pre,...active]);
  }).join('');
  $('viewBody').innerHTML=`<div class="detail-grid">${cards}</div>`;
}
function renderReview(){
  $('viewTitle').textContent='審查狀況';
  $('viewHint').textContent='顯示已提送但尚未核定之成果及審查期限／管理目標。';
  const cards=['south','north'].map(id=>{
    const m=models[id];
    const items=m.dashboard.underReviewItems.map(x=>row(x.name,`${x.pcmReviewContract?'PCM契約':'管理預估'} ${x.reviewDays}日；${x.reviewOverdueDays>0?`逾期 ${x.reviewOverdueDays}日`:'審查中'}`,x.reviewTarget,x.reviewOverdueDays>0?'催辦':'審查中',x.reviewOverdueDays>0?'tag-danger':'tag-info'));
    return projectListCard('審查中',m,items);
  }).join('');
  $('viewBody').innerHTML=`<div class="detail-grid">${cards}</div>`;
}
function renderPayment(){
  $('viewTitle').textContent='經費／付款';
  $('viewHint').textContent='顯示已達條件、管理預估與尚待外部條件之設計／調查付款摘要。';
  const cards=['south','north'].map(id=>{
    const m=models[id],t=m.payments.totals;
    return `<section class="detail-card"><h3>${m.project.name}｜付款概況</h3>
      <div class="payment-grid">
        <div class="money-box"><span>已達請款條件</span><b>${money(t.ready.amount)} 元</b><small>${t.ready.count} 項</small></div>
        <div class="money-box"><span>管理預估付款</span><b>${money(t.forecast.amount)} 元</b><small>${t.forecast.count} 項</small></div>
        <div class="money-box"><span>尚待外部條件</span><b>${money(t.external.amount)} 元</b><small>${t.external.count} 項</small></div>
      </div>
      <div class="focus-box"><strong>最近預估付款日</strong><p>${fmt(m.payments.nextPayDate)}</p></div>
    </section>`;
  }).join('');
  $('viewBody').innerHTML=`<div class="detail-grid">${cards}</div>`;
}
const renders={overview:renderOverview,progress:renderProgress,attention:renderAttention,review:renderReview,payment:renderPayment};

function setView(view){
  currentView=view;
  document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view && b.classList.contains('nav-btn')));
  $('backButton').hidden=view==='overview';
  renders[view]?.();
}
function updateTop(){
  const ms=Object.values(models);
  $('dashboardDate').textContent=fmt(todayLocal());
  $('kpiOverdue').textContent=ms.reduce((n,m)=>n+m.dashboard.overdue,0);
  $('kpiDue14').textContent=ms.reduce((n,m)=>n+m.dashboard.due14,0);
  $('kpiReview').textContent=ms.reduce((n,m)=>n+m.dashboard.underReview,0);
  $('kpiCompleted').textContent=ms.reduce((n,m)=>n+m.dashboard.completed,0);
}

async function init(){
  const catalog=await loadJSON('projects.json');
  const today=todayLocal();
  for(const p of catalog.projects){
    const data=normalizeProject(await loadJSON(p.data),p.id);
    models[p.id]=calculateModel(data,today);
  }
  restoreFontSize();
  updateTop();setView('overview');
  $('dashboardStatus').textContent='資料已更新';
  document.addEventListener('click',e=>{
    const font=e.target.closest('[data-font-size]');
    if(font){applyFontSize(font.dataset.fontSize);return;}
    const btn=e.target.closest('[data-view]');
    if(btn){setView(btn.dataset.view);return;}
    if(e.target.closest('#backButton')) setView('overview');
  });
}
init().catch(err=>{
  $('dashboardStatus').textContent=`載入失敗：${err.message}`;
  $('viewBody').innerHTML=`<div class="empty">無法載入儀表板資料：${esc(err.message)}</div>`;
});
