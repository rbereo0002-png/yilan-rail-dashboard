import {normalizeProject} from './store.js';
import {calculateModel} from './model.js';
import {formatDate as fmt,todayLocal} from './dates.js';

const $=id=>document.getElementById(id);
const money=n=>Number(n||0).toLocaleString('zh-TW',{maximumFractionDigits:0});
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct=(a,b)=>b?Math.round(a/b*100):0;

let models={}, currentView='overview';

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
  return `<article class="segment-card">
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
function renderOverview(){
  $('viewTitle').textContent='南北段總覽';
  $('viewHint').textContent='點選上方大項查看細項，內容於本區切換。';
  $('viewBody').innerHTML=`<div class="segment-grid">${segmentCard(models.south)}${segmentCard(models.north)}</div>`;
}
function renderProgress(){
  $('viewTitle').textContent='設計進度';
  $('viewHint').textContent='各段依契約成果群組彙整；點「回總覽」返回主畫面。';
  const cards=['south','north'].map(id=>{
    const m=models[id];
    const rows=m.dashboard.stages.map(s=>`<div class="stage-row"><span>${esc(s.name)}</span><div class="stage-track"><div class="stage-fill" style="width:${pct(s.completed,s.total)}%"></div></div><b>${s.completed}/${s.total}</b></div>`).join('');
    return `<section class="detail-card"><h3>${m.project.name}｜${esc(m.dashboard.phaseLabel)}</h3>${rows}</section>`;
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
  $('dashboardDate').textContent=`資料日 ${fmt(todayLocal())}`;
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
  updateTop();setView('overview');
  $('dashboardStatus').textContent='資料已更新';
  document.addEventListener('click',e=>{
    const btn=e.target.closest('[data-view]');
    if(btn){setView(btn.dataset.view);return;}
    if(e.target.closest('#backButton')) setView('overview');
  });
}
init().catch(err=>{
  $('dashboardStatus').textContent=`載入失敗：${err.message}`;
  $('viewBody').innerHTML=`<div class="empty">無法載入儀表板資料：${esc(err.message)}</div>`;
});
