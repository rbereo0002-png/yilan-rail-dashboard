/* =========================================================
   宜蘭高架履約管制系統 Stage 2
   甘特圖 / 前後置關聯 / 延誤影響 / 付款里程碑
   單一規則來源：rules.js
   ========================================================= */

function s2ParseDate(text){
  if(!text) return null;
  const m=String(text).match(/(\d{4})[\/-](\d{2})[\/-](\d{2})/);
  if(!m) return null;
  return new Date(Number(m[1]),Number(m[2])-1,Number(m[3]),12,0,0,0);
}

function s2Fmt(d){
  if(!d) return '-';
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
}

function s2AddDays(d,n){
  if(!d || n==null) return null;
  const x=new Date(d);
  x.setDate(x.getDate()+Number(n));
  x.setHours(12,0,0,0);
  return x;
}

function s2Days(a,b){
  if(!a||!b) return null;
  const x=new Date(a),y=new Date(b);
  x.setHours(12,0,0,0);
  y.setHours(12,0,0,0);
  return Math.round((y-x)/86400000);
}

function s2FieldDate(id){
  const el=document.getElementById(id);
  return el?.value ? s2ParseDate(el.value) : null;
}

function s2Today(){
  const d=new Date();
  d.setHours(12,0,0,0);
  return d;
}

function s2Actual(id,kind){
  return typeof actual==='function' ? actual(id,kind) : null;
}

function s2CurrentProject(){
  return document.getElementById('projectSelect')?.value || window.current?.id || 'south';
}

function s2HumanName(id,model){
  if(!id) return '—';
  if(id==='sign') return '契約簽訂';
  if(id==='award') return '決標';
  if(id==='noticeDate') return '甲方通知';
  return model[id]?.name || id;
}

function s2BuildTimeline(){
  if(!window.YilanRules){
    return {list:[],model:{},pcm:30,projectId:s2CurrentProject()};
  }

  const projectId=s2CurrentProject();
  const rules=window.YilanRules.getRules(projectId);
  const pcm=Number(document.getElementById('pcmDays')?.value||30);
  const sign=s2FieldDate('signDate');
  const award=s2FieldDate('awardDate');
  const notice=s2FieldDate('noticeDate');

  const model={
    sign:{
      id:'sign',group:'契約',name:'契約簽訂',
      baselineStart:sign,baselineDue:sign,
      forecastStart:sign,forecastDue:sign,
      baselineApproval:sign,forecastApproval:sign,
      actual:sign,actualApproval:sign,
      predecessor:null,contractRule:true,
      payment:'工程設計10%（累計10%）'
    }
  };

  const list=[model.sign];

  for(const rule of rules){
    let baselineBase=null;
    let forecastBase=null;
    let baselineDue=null;
    let forecastDue=null;

    const actualSubmit=s2Actual(rule.id,'submit');
    const actualApproval=s2Actual(rule.id,'approval');

    if(rule.triggerType==='signDate'){
      baselineBase=sign;
      forecastBase=sign;
      baselineDue=s2AddDays(sign,rule.days);
      forecastDue=actualSubmit || s2AddDays(sign,rule.days);
    }

    else if(rule.triggerType==='awardDate'){
      baselineBase=award;
      forecastBase=award;
      baselineDue=s2AddDays(award,rule.days);
      forecastDue=actualSubmit || s2AddDays(award,rule.days);
    }

    else if(rule.triggerType==='approvalOf'){
      const ref=model[rule.triggerRef];
      baselineBase=ref?.baselineApproval || null;
      forecastBase=ref?.actualApproval || ref?.forecastApproval || null;
      baselineDue=s2AddDays(baselineBase,rule.days);
      forecastDue=actualSubmit || s2AddDays(forecastBase,rule.days);
    }

    else if(rule.triggerType==='basicApprovalOrNotice'){
      const ref=model[rule.triggerRef];
      baselineBase=notice || ref?.baselineApproval || null;
      forecastBase=notice || ref?.actualApproval || ref?.forecastApproval || null;
      baselineDue=s2AddDays(baselineBase,rule.days);
      forecastDue=actualSubmit || s2AddDays(forecastBase,rule.days);
    }

    else if(rule.triggerType==='sameAs'){
      const ref=model[rule.triggerRef];
      baselineBase=ref?.baselineStart || null;
      forecastBase=ref?.forecastStart || null;
      baselineDue=ref?.baselineDue || null;
      forecastDue=ref?.actual || ref?.forecastDue || null;
    }

    else if(rule.triggerType==='externalDate'){
      const d=s2FieldDate(rule.dateField);
      forecastDue=d;
    }

    else if(rule.triggerType==='eventAfter'){
      const ref=model[rule.triggerRef];
      baselineBase=ref?.baselineDue || null;
      forecastBase=ref?.actual || ref?.forecastDue || null;
      baselineDue=rule.days!=null ? s2AddDays(baselineBase,rule.days) : baselineBase;
      forecastDue=rule.days!=null ? s2AddDays(forecastBase,rule.days) : forecastBase;
    }

    else if(rule.triggerType==='externalNotice'){
      baselineBase=null;
      forecastBase=null;
      baselineDue=null;
      forecastDue=null;
    }

    else if(rule.triggerType==='conditionalAfterBasic'){
      const ref=model[rule.triggerRef];
      baselineBase=ref?.baselineApproval || null;
      forecastBase=ref?.actualApproval || ref?.forecastApproval || null;
      /* 契約僅規定「基本設計成果核定後或經甲方通知期限內提送」，未訂固定日數 */
      baselineDue=null;
      forecastDue=actualSubmit || null;
    }

    const baselineApproval=(rule.contractRule && baselineDue)
      ?s2AddDays(baselineDue,pcm)
      :baselineDue;

    const forecastApproval=actualApproval || (
      rule.contractRule && forecastDue
        ?s2AddDays(actualSubmit || forecastDue,pcm)
        :forecastDue
    );

    const item={
      ...rule,
      baselineStart:baselineBase,
      baselineDue,
      baselineApproval,
      forecastStart:forecastBase,
      forecastDue,
      forecastApproval,
      actualSubmit,
      actualApproval,
      actual:actualApproval || actualSubmit || null
    };

    model[rule.id]=item;
    list.push(item);
  }

  return {list,model,pcm,projectId};
}

function s2Status(item){
  const today=s2Today();

  if(item.actualApproval){
    if(item.baselineDue){
      const delay=s2Days(item.baselineDue,item.actualApproval);
      if(delay>0) return {text:`核定晚 ${delay} 日`,cls:'tl-danger',delay};
    }
    return {text:'已核定',cls:'tl-done',delay:0};
  }

  if(item.actualSubmit){
    if(item.baselineDue){
      const delay=s2Days(item.baselineDue,item.actualSubmit);
      if(delay>0) return {text:`提送晚 ${delay} 日`,cls:'tl-danger',delay};
    }
    return {text:'已提送待核定',cls:'tl-warning',delay:0};
  }

  if(item.conditional && !item.forecastDue){
    return {text:item.applicability==='pending'?'條件式／待確認':'條件式',cls:'tl-external',delay:null};
  }

  if(!item.forecastDue){
    return {text:'待通知／外部日期',cls:'tl-external',delay:null};
  }

  if(item.baselineDue){
    const delay=s2Days(item.baselineDue,item.forecastDue);
    if(delay>0) return {text:`預估延後 ${delay} 日`,cls:'tl-danger',delay};

    const remain=s2Days(today,item.forecastDue);
    if(remain<0) return {text:`逾期 ${Math.abs(remain)} 日`,cls:'tl-danger',delay:0};
    if(remain<=14) return {text:`${remain} 日內到期`,cls:'tl-warning',delay:0};
    if(remain<=30) return {text:`${remain} 日內到期`,cls:'tl-normal',delay:0};

    return {text:'依基準推估',cls:'tl-normal',delay:0};
  }

  return {text:'外部／事件節點',cls:'tl-external',delay:null};
}

function s2Set(id,text){
  const el=document.getElementById(id);
  if(el) el.textContent=text;
}

function s2RenderSummary(data){
  const sign=data.model.sign?.forecastDue || null;
  const contractDues=data.list.filter(x=>x.contractRule && x.forecastDue).map(x=>x.forecastDue);
  const lastDue=contractDues.length?new Date(Math.max(...contractDues.map(d=>d.getTime()))):null;
  const delayed=data.list.filter(x=>(s2Status(x).delay||0)>0);
  const maxDelay=delayed.length?Math.max(...delayed.map(x=>s2Status(x).delay||0)):0;

  s2Set('tlStartDate',s2Fmt(sign));
  s2Set('tlForecastFinish',s2Fmt(lastDue));
  s2Set('tlDelayDays',`${maxDelay} 日`);
  s2Set('tlAffectedCount',`${delayed.length} 項`);
}

function s2RenderGantt(data){
  const box=document.getElementById('ganttChart');
  if(!box) return;

  const items=data.list.filter(x=>x.id!=='sign' && (x.baselineDue || x.forecastDue));
  const dates=[];

  items.forEach(x=>{
    [x.baselineStart,x.baselineDue,x.forecastStart,x.forecastDue].forEach(d=>{
      if(d) dates.push(d.getTime());
    });
  });

  if(!dates.length){
    box.innerHTML='<div class="timeline-empty">尚無足夠日期可繪製甘特圖。</div>';
    return;
  }

  let min=new Date(Math.min(...dates));
  let max=new Date(Math.max(...dates));
  min.setDate(min.getDate()-10);
  max.setDate(max.getDate()+20);

  const total=Math.max(1,s2Days(min,max));
  const pos=d=>d?Math.max(0,Math.min(100,s2Days(min,d)/total*100)):null;

  const ticks=[];
  let tick=new Date(min.getFullYear(),min.getMonth(),1,12);
  if(tick<min) tick.setMonth(tick.getMonth()+1);

  while(tick<=max){
    ticks.push({left:pos(tick),label:`${tick.getFullYear()}/${String(tick.getMonth()+1).padStart(2,'0')}`});
    tick.setMonth(tick.getMonth()+1);
  }

  box.innerHTML=`
    <div class="gantt-axis">
      <div class="gantt-label-head">工作／成果</div>
      <div class="gantt-axis-track">
        ${ticks.map(t=>`<span class="gantt-tick" style="left:${t.left}%"><i></i><b>${t.label}</b></span>`).join('')}
      </div>
    </div>
    ${items.map(item=>{
      const bs=pos(item.baselineStart),be=pos(item.baselineDue),fs=pos(item.forecastStart||item.baselineStart),fe=pos(item.forecastDue),st=s2Status(item);
      const base=(bs!==null&&be!==null)?`<div class="gantt-bar baseline" style="left:${bs}%;width:${Math.max(.6,be-bs)}%"></div>`:'';
      const forecast=(fs!==null&&fe!==null)?`<div class="gantt-bar forecast ${st.cls}" style="left:${fs}%;width:${Math.max(.6,fe-fs)}%"></div>`:'';
      const milestone=(fe!==null&&(!item.forecastStart||fe===fs))?`<span class="gantt-milestone ${st.cls}" style="left:${fe}%"></span>`:'';
      return `<div class="gantt-row"><div class="gantt-label"><small>${item.group||''}</small><b>${item.name}</b><span>${st.text}</span></div><div class="gantt-track">${ticks.map(t=>`<i class="gantt-gridline" style="left:${t.left}%"></i>`).join('')}${base}${forecast}${milestone}</div></div>`;
    }).join('')}
    <div class="gantt-legend">
      <span><i class="legend-base"></i>契約／管理基準</span>
      <span><i class="legend-forecast"></i>目前預估／實際</span>
      <span class="small">前置成果核定日未填時，採 PCM ${data.pcm} 日作管理預估，不視為契約明定審查期限。</span>
    </div>`;
}

function s2RenderDependency(data){
  const tbody=document.querySelector('#dependencyTable tbody');
  if(!tbody) return;

  tbody.innerHTML=data.list.filter(x=>x.id!=='sign').map(item=>{
    const pred=s2HumanName(item.predecessor,data.model);
    const st=s2Status(item);
    let nature='外部／事件節點';
    if(item.conditional) nature='條件式';
    else if(item.contractRule) nature=item.days!=null?`${item.days}日曆天`:'契約節點';

    return `<tr>
      <td>${item.group||''}</td>
      <td><b>${item.name}</b><div class="small">${item.note||''}</div></td>
      <td>${pred}</td>
      <td>${nature}</td>
      <td>${s2Fmt(item.baselineDue)}</td>
      <td>${s2Fmt(item.forecastDue)}</td>
      <td><span class="timeline-pill ${st.cls}">${st.text}</span></td>
      <td>${item.payment||'—'}</td>
    </tr>`;
  }).join('');
}

function s2RenderDelay(data){
  const box=document.getElementById('delayImpactBox');
  if(!box) return;

  const affected=data.list.filter(x=>(s2Status(x).delay||0)>0).sort((a,b)=>(s2Status(b).delay||0)-(s2Status(a).delay||0));

  if(!affected.length){
    box.innerHTML='<div class="delay-ok"><b>目前未偵測到由已登錄日期造成的後續延誤。</b><span>後續若輸入實際提送／核定日晚於原基準，系統會依前後置關係重新推估受影響節點。</span></div>';
    return;
  }

  box.innerHTML=affected.map(x=>{
    const st=s2Status(x);
    return `<div class="delay-item"><div><b>${x.name}</b><span>${x.group||''}</span></div><strong>+${st.delay} 日</strong><small>基準 ${s2Fmt(x.baselineDue)} → 目前 ${s2Fmt(x.forecastDue)}</small></div>`;
  }).join('');
}

function s2RenderPayment(){
  const box=document.getElementById('paymentMilestoneStrip');
  if(!box) return;

  const milestones=[...document.querySelectorAll('#paymentTable tbody tr')].map(tr=>{
    const td=tr.querySelectorAll('td');
    if(td.length<6) return null;
    return {
      name:td[1].innerText.trim(),
      ratio:td[2].innerText.trim(),
      trigger:s2ParseDate(td[3].innerText),
      payDate:s2ParseDate(td[4].innerText),
      amount:Number(String(td[5].innerText||'').replace(/[^\d.-]/g,''))||0
    };
  }).filter(Boolean);

  box.innerHTML=milestones.map(m=>{
    const reached=m.trigger&&m.trigger<=s2Today();
    return `<div class="pay-node ${reached?'reached':''}"><div class="pay-dot"></div><b>${m.name}</b><span>${m.ratio}｜${Number(m.amount).toLocaleString('zh-TW')} 元</span><small>條件：${s2Fmt(m.trigger)}<br>付款：${s2Fmt(m.payDate)}</small></div>`;
  }).join('');
}

function s2HideSupervision(){
  document.querySelectorAll('.supervision-details').forEach(el=>el.style.display='none');
  document.querySelectorAll('section.card').forEach(sec=>{
    const h2=sec.querySelector('.hd h2');
    if(h2 && h2.textContent.trim().startsWith('六、施工監造')) sec.style.display='none';
  });
}

function renderScheduleControl(){
  if(!document.getElementById('scheduleControl')) return;
  s2HideSupervision();
  const data=s2BuildTimeline();
  s2RenderSummary(data);
  s2RenderGantt(data);
  s2RenderDependency(data);
  s2RenderDelay(data);
  s2RenderPayment();
}

const s2Observer=new MutationObserver(()=>{
  clearTimeout(window.__s2Timer);
  window.__s2Timer=setTimeout(renderScheduleControl,120);
});

window.addEventListener('load',()=>{
  s2HideSupervision();
  [250,600,1200,2000].forEach(ms=>setTimeout(renderScheduleControl,ms));

  const schedule=document.getElementById('scheduleTable');
  const payment=document.getElementById('paymentTable');
  if(schedule) s2Observer.observe(schedule,{childList:true,subtree:true});
  if(payment) s2Observer.observe(payment,{childList:true,subtree:true});

  document.addEventListener('change',e=>{
    const ids=['signDate','awardDate','noticeDate','pccDate','tenderApprovalDate','allWorksAwardDate','allWorksCloseDate','pcmDays','projectSelect'];
    if(ids.includes(e.target.id)||e.target.closest?.('#scheduleTable')) setTimeout(renderScheduleControl,150);
  });
});
