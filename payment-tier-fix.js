/* =========================================================
   付款三級化補丁
   分類：
   1. 已達請款條件
   2. 管理預估付款
   3. 尚待外部條件

   原則：
   - 有實際核定/條件達成日，且日期已到：已達請款條件
   - 目前僅依簽約預定日、PCM管理預估核定日或既有時程推估：管理預估付款
   - 工程會核定、招標文件核定、各分標決標、全部工程完成等尚無日期：尚待外部條件
   ========================================================= */

(function(){

  const paymentMap = [
    {key:'sign', label:'契約簽訂'},
    {key:'surveyPlan', label:'補充測量工作計畫核定'},
    {key:'geoPlan', label:'補充地質工作計畫核定'},
    {key:'utilityPlan', label:'管線調查工作計畫核定'},
    {key:'execPlan', label:'執行服務計畫核定'},
    {key:'surveyResult', label:'補充測量成果核可'},
    {key:'geoResult', label:'補充地質成果核可'},
    {key:'utilityResult', label:'管線調查成果核可'},
    {key:'basic', label:'基本設計成果核可'},
    {key:'pcc', label:'工程會經費審議核定'},
    {key:'final', label:'期末設計成果核可'},
    {key:'tender', label:'招標文件成果核定'},
    {key:'worksAward', label:'各分標工程全部決標'},
    {key:'close', label:'全部工程竣工驗收結算完成'}
  ];

  function today(){
    const d=new Date();
    d.setHours(12,0,0,0);
    return d;
  }

  function parseDate(text){
    if(!text) return null;
    const m=String(text).match(/(\d{4})[\/-](\d{2})[\/-](\d{2})/);
    if(!m) return null;
    return new Date(Number(m[1]),Number(m[2])-1,Number(m[3]),12,0,0,0);
  }

  function moneyNumber(text){
    const n=Number(String(text||'').replace(/[^\d.-]/g,''));
    return Number.isFinite(n)?n:0;
  }

  function money(n){
    return Number(n||0).toLocaleString('zh-TW',{maximumFractionDigits:0});
  }

  function statusInfo(item,key){
    const now=today();

    if(key==='sign'){
      const d=parseDate(document.getElementById('signDate')?.value);
      if(!d) return {type:'external',text:'尚待外部條件'};
      if(d<=now) return {type:'ready',text:'已達請款條件'};
      return {type:'forecast',text:'管理預估付款'};
    }

    if(!item){
      return {type:'external',text:'尚待外部條件'};
    }

    if(item.actualApproval){
      return {type:'ready',text:'已達請款條件'};
    }

    if(['pcc','tender','worksAward','close'].includes(key)){
      const d=item.due || item.actual || null;
      if(!d) return {type:'external',text:'尚待外部條件'};
      if(d<=now) return {type:'ready',text:'已達請款條件'};
      return {type:'forecast',text:'管理預估付款'};
    }

    if(item.approval){
      return {type:'forecast',text:'管理預估付款'};
    }

    return {type:'external',text:'尚待外部條件'};
  }

  function pill(info){
    return `<span class="payment-tier-pill payment-tier-${info.type}">${info.text}</span>`;
  }

  function ensureHeader(table){
    const head=table.querySelector('thead tr');
    if(!head) return;

    const cells=[...head.children];
    const exists=cells.some(th=>th.dataset.paymentTier==='1' || th.textContent.trim()==='付款性質');

    if(!exists){
      const th=document.createElement('th');
      th.dataset.paymentTier='1';
      th.textContent='付款性質';
      head.insertBefore(th,cells[2] || null);
    }
  }

  function patchPaymentTable(){
    if(typeof r3Build!=='function') return;

    const table=document.getElementById('paymentTable');
    if(!table) return;

    const data=r3Build();
    ensureHeader(table);

    const rows=[...table.querySelectorAll('tbody tr')];

    rows.forEach((tr,index)=>{
      const map=paymentMap[index];
      if(!map) return;

      const item=data.model?.[map.key] || null;
      const info=statusInfo(item,map.key);

      tr.dataset.paymentTier=info.type;

      let tierCell=tr.querySelector('td[data-payment-tier="1"]');

      if(!tierCell){
        tierCell=document.createElement('td');
        tierCell.dataset.paymentTier='1';

        const cells=[...tr.children];
        tr.insertBefore(tierCell,cells[2] || null);
      }

      tierCell.innerHTML=pill(info);

      const noteCell=tr.lastElementChild;

      if(noteCell){
        const base=noteCell.dataset.originalNote || noteCell.textContent.trim();
        noteCell.dataset.originalNote=base;

        let extra='';

        if(info.type==='forecast'){
          extra='<div class="small payment-tier-note">依目前時程／PCM管理假設推估，尚非實際可請款。</div>';
        }

        if(info.type==='external'){
          extra='<div class="small payment-tier-note">尚待外部條件成立或實際日期登錄。</div>';
        }

        if(info.type==='ready'){
          extra='<div class="small payment-tier-note">付款條件已達成；實際請款仍依契約文件及行政程序辦理。</div>';
        }

        noteCell.innerHTML=`${base}${extra}`;
      }
    });

    patchDashboard(rows);
    patchPaymentStrip(rows);
  }

  function rowAmount(tr){
    /*
      原表新增「付款性質」後：
      類別0、付款條件1、付款性質2、比例3、條件達成日4、
      預估付款日5、預估金額6...
    */
    const td=[...tr.querySelectorAll('td')];
    return moneyNumber(td[6]?.textContent);
  }

  function rowPayDate(tr){
    const td=[...tr.querySelectorAll('td')];
    return parseDate(td[5]?.textContent);
  }

  function patchDashboard(rows){
    let readyCount=0,readyAmount=0;
    let forecastCount=0,forecastAmount=0;
    let externalCount=0,externalAmount=0;
    let nextForecast=null;

    rows.forEach(tr=>{
      const amt=rowAmount(tr);
      const type=tr.dataset.paymentTier;
      const payDate=rowPayDate(tr);

      if(type==='ready'){
        readyCount++;
        readyAmount+=amt;
      }else if(type==='forecast'){
        forecastCount++;
        forecastAmount+=amt;
        if(payDate && (!nextForecast || payDate<nextForecast)){
          nextForecast=payDate;
        }
      }else if(type==='external'){
        externalCount++;
        externalAmount+=amt;
      }
    });

    const box=document.querySelector('.payment-kpis');

    if(box){
      box.innerHTML=`
        <div class="payment-kpi">
          <span>已達請款條件</span>
          <b>${readyCount} 項</b>
          <small>${money(readyAmount)} 元</small>
        </div>

        <div class="payment-kpi">
          <span>管理預估付款</span>
          <b>${forecastCount} 項</b>
          <small>${money(forecastAmount)} 元</small>
        </div>

        <div class="payment-kpi">
          <span>尚待外部條件</span>
          <b>${externalCount} 項</b>
          <small>${money(externalAmount)} 元</small>
        </div>

        <div class="payment-kpi">
          <span>最近管理預估付款日</span>
          <b>${nextForecast ? r3Fmt(nextForecast) : '-'}</b>
          <small>非實際付款承諾日</small>
        </div>
      `;
    }

    const panel=document.querySelector('.overview-payment');

    if(panel){
      let note=panel.querySelector('.payment-tier-summary-note');

      if(!note){
        note=document.createElement('div');
        note.className='payment-tier-summary-note';
        panel.appendChild(note);
      }

      note.innerHTML='付款三級化：<b>已達請款條件</b>＝已有實際條件達成；<b>管理預估付款</b>＝依目前時程及管理假設推估；<b>尚待外部條件</b>＝尚無可推估之條件達成日。';
    }
  }

  function patchPaymentStrip(rows){
    const nodes=[...document.querySelectorAll('.payment-strip .pay-node')];

    nodes.forEach((node,index)=>{
      const tr=rows[index];
      if(!tr) return;

      const type=tr.dataset.paymentTier;

      node.classList.remove('payment-ready','payment-forecast','payment-external');
      node.classList.add(
        type==='ready'
          ?'payment-ready'
          :type==='forecast'
            ?'payment-forecast'
            :'payment-external'
      );

      let tag=node.querySelector('.payment-tier-strip-tag');

      if(!tag){
        tag=document.createElement('em');
        tag.className='payment-tier-strip-tag';
        node.appendChild(tag);
      }

      tag.textContent=
        type==='ready'
          ?'已達請款條件'
          :type==='forecast'
            ?'管理預估付款'
            :'尚待外部條件';
    });
  }

  function install(){
    [300,700,1400].forEach(ms=>setTimeout(patchPaymentTable,ms));

    const table=document.getElementById('paymentTable');

    if(table){
      const observer=new MutationObserver(()=>{
        clearTimeout(window.__paymentTierTimer);
        window.__paymentTierTimer=setTimeout(patchPaymentTable,120);
      });

      observer.observe(table,{childList:true,subtree:true});
    }

    document.addEventListener('change',e=>{
      const ids=[
        'signDate','awardDate','noticeDate','pccDate',
        'tenderApprovalDate','allWorksAwardDate',
        'allWorksCloseDate','pcmDays','payMode','forecastMode',
        'projectSelect'
      ];

      if(ids.includes(e.target.id) || e.target.closest?.('#scheduleTable')){
        setTimeout(patchPaymentTable,150);
      }
    });
  }

  window.addEventListener('load',install);

})();
