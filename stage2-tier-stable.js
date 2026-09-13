/* =========================================================
   Stage2 防跳穩定版
   目的：
   1. 修正「整體狀態」尚未簽約 ↔ 正常管制跳動
   2. 修正「二、前後置關聯與延誤傳遞」整區跳動
   3. 修正契約時限主檔 KPI「管理預估/外部條件、11/9項」跳動
   原則：
   - 移除自我監聽 dependencyTable DOM 的 MutationObserver 迴圈
   - 只在 load / change / 專案切換後一次更新
   - KPI 固定以 r3Build() 統一資料來源重畫
   ========================================================= */

(function(){

  let refreshing=false;
  let timer=null;

  function scheduleRefresh(delay=120){
    clearTimeout(timer);
    timer=setTimeout(refreshAll,delay);
  }

  function tierLabel(item){
    if(item?.conditional || item?.dueType==='external'){
      return '<span class="timeline-pill deadline-external">外部／條件式</span>';
    }
    if(item?.dueType==='management'){
      return '<span class="timeline-pill deadline-management">管理預估期限</span>';
    }
    if(item?.dueType==='contract'){
      return '<span class="timeline-pill deadline-contract">契約期限</span>';
    }
    return '<span class="timeline-pill deadline-external">外部／條件式</span>';
  }

  function contractDays(item){
    if(item?.conditional) return '—';
    if(item?.days!=null) return `${item.days}日曆天`;
    return '—';
  }

  function fmt(d){
    if(typeof r3Fmt==='function') return r3Fmt(d);
    if(!d) return '-';
    return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
  }

  function pred(id,model){
    if(typeof r3HumanName==='function') return r3HumanName(id,model);
    if(!id) return '—';
    if(id==='sign') return '契約簽訂';
    if(id==='award') return '決標';
    return model?.[id]?.name || id;
  }

  function status(item){
    if(typeof r3Status==='function'){
      const s=r3Status(item);
      return `<span class="timeline-pill ${s.cls}">${s.text}</span>`;
    }
    return '—';
  }

  function refreshDependency(data){
    const table=document.getElementById('dependencyTable');
    if(!table) return;

    const thead=table.querySelector('thead');
    const tbody=table.querySelector('tbody');

    if(thead){
      thead.innerHTML=`
        <tr>
          <th>類別</th>
          <th>工作／成果</th>
          <th>前置節點</th>
          <th>期限性質</th>
          <th>契約日數</th>
          <th>基準日期</th>
          <th>目前日期</th>
          <th>延誤判讀</th>
          <th>付款連動</th>
        </tr>
      `;
    }

    if(!tbody) return;

    tbody.innerHTML=data.list.map(item=>{
      let note=item.note||'';

      if(item.dueType==='management'){
        note += '<br>前置節點尚未實際核定，目前日期屬管理預估。';
      }

      if(item.conditional){
        note += '<br>條件式節點，不自行推算契約期限。';
      }

      return `
        <tr>
          <td>${item.group||''}</td>
          <td><b>${item.name}</b><div class="small">${note}</div></td>
          <td>${pred(item.predecessor,data.model)}</td>
          <td>${tierLabel(item)}</td>
          <td>${contractDays(item)}</td>
          <td>${fmt(item.due)}</td>
          <td>${fmt(item.due)}</td>
          <td>${status(item)}</td>
          <td>${item.payment||'—'}</td>
        </tr>
      `;
    }).join('');
  }

  function refreshContractKpi(data){
    const kpis=document.querySelector('#contractRuleControl .timeline-kpis');
    if(!kpis) return;

    const contractCount=data.list.filter(x=>x.dueType==='contract').length;
    const managementCount=data.list.filter(x=>x.dueType==='management').length;
    const externalCount=data.list.filter(x=>x.dueType==='external').length;

    const dates=data.list
      .filter(x=>x.dueType==='contract' && x.due)
      .map(x=>x.due);

    const lastDate=dates.length
      ?new Date(Math.max(...dates.map(d=>d.getTime())))
      :null;

    const projectName=
      document.getElementById('projectSelect')?.selectedOptions?.[0]?.textContent ||
      data.projectId ||
      '-';

    kpis.innerHTML=`
      <div>
        <span>目前標段</span>
        <b>${projectName}</b>
      </div>
      <div>
        <span>契約期限節點</span>
        <b>${contractCount} 項</b>
      </div>
      <div>
        <span>管理預估節點</span>
        <b>${managementCount} 項</b>
      </div>
      <div>
        <span>外部／條件式節點</span>
        <b>${externalCount} 項</b>
      </div>
      <div>
        <span>目前可確定之最末契約期限</span>
        <b>${lastDate?fmt(lastDate):'-'}</b>
      </div>
    `;
  }

  function refreshOverallStatus(){
    const el=document.getElementById('ovOverallStatus');
    const signInput=document.getElementById('signDate');

    if(!el || !signInput?.value) return;

    const sign=new Date(signInput.value+'T12:00:00');
    const now=new Date();
    now.setHours(12,0,0,0);

    if(now<sign){
      el.textContent='尚未簽約';
      return;
    }

    /*
      簽約後的狀態沿用 KPI 判讀，
      但只在真正進入履約期後才允許顯示其他狀態。
    */
    const overdue=Number(document.getElementById('ovOverdue')?.textContent||0);
    const due14=Number(document.getElementById('ovDue14')?.textContent||0);
    const pending=Number(document.getElementById('ovPendingApproval')?.textContent||0);

    if(overdue>0) el.textContent='有逾期事項';
    else if(due14>0) el.textContent='有近期到期事項';
    else if(pending>0) el.textContent='有成果待核定';
    else el.textContent='正常管制';
  }

  function refreshAll(){
    if(refreshing) return;
    if(typeof r3Build!=='function') return;

    refreshing=true;

    try{
      const data=r3Build();
      refreshDependency(data);
      refreshContractKpi(data);
      refreshOverallStatus();
    }finally{
      refreshing=false;
    }
  }

  function install(){
    /*
      關鍵：不再觀察 dependencyTable / contractRuleControl 的 DOM，
      避免「自己重畫 → observer 再觸發 → 再重畫」。
    */
    [250,700,1400].forEach(ms=>setTimeout(refreshAll,ms));

    document.addEventListener('change',e=>{
      const ids=[
        'signDate','awardDate','noticeDate','pccDate',
        'tenderApprovalDate','allWorksAwardDate',
        'allWorksCloseDate','pcmDays','projectSelect'
      ];

      if(ids.includes(e.target.id) || e.target.closest?.('#scheduleTable')){
        scheduleRefresh(120);
      }
    });

    /*
      若 app.js 切換標段後異步載入 JSON，
      以 click/change 後延遲補刷新，不監聽 DOM。
    */
    document.addEventListener('click',e=>{
      if(e.target.closest?.('.segment-btn')){
        [180,500,900].forEach(ms=>setTimeout(refreshAll,ms));
      }
    });

    /*
      最後一道保險：簽約前每2秒校正一次「尚未簽約」，
      只改文字，不重畫整頁，因此不會造成跳動。
    */
    setInterval(()=>{
      const signInput=document.getElementById('signDate');
      const el=document.getElementById('ovOverallStatus');
      if(!signInput?.value || !el) return;

      const sign=new Date(signInput.value+'T12:00:00');
      const now=new Date();
      now.setHours(12,0,0,0);

      if(now<sign && el.textContent!=='尚未簽約'){
        el.textContent='尚未簽約';
      }
    },2000);
  }

  window.addEventListener('load',install);

})();
