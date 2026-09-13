(function(){
  function patchDeadlineSummary(){
    if(typeof r3Build!=='function') return;
    const data=r3Build();
    const kpis=document.querySelector('#contractRuleControl .timeline-kpis');
    if(!kpis) return;

    const contractCount=data.list.filter(x=>x.dueType==='contract').length;
    const managementCount=data.list.filter(x=>x.dueType==='management').length;
    const externalCount=data.list.filter(x=>x.dueType==='external').length;
    const contractDates=data.list.filter(x=>x.dueType==='contract'&&x.due).map(x=>x.due);
    const lastContractDate=contractDates.length?new Date(Math.max(...contractDates.map(d=>d.getTime()))):null;

    kpis.innerHTML=`
      <div><span>目前標段</span><b id="r3ProjectName">${document.getElementById('projectSelect')?.selectedOptions?.[0]?.textContent||data.projectId}</b></div>
      <div><span>契約期限節點</span><b id="r3RuleCount">${contractCount} 項</b></div>
      <div><span>管理預估節點</span><b id="r3ManagementCount">${managementCount} 項</b></div>
      <div><span>外部／條件式節點</span><b id="r3ExternalCount">${externalCount} 項</b></div>
      <div><span>目前可確定之最末契約期限</span><b id="r3LastDue">${lastContractDate?r3Fmt(lastContractDate):'-'}</b></div>
    `;
  }

  window.addEventListener('load',()=>{
    [350,800,1500].forEach(ms=>setTimeout(patchDeadlineSummary,ms));
    const target=document.getElementById('contractRuleControl');
    if(target){
      const observer=new MutationObserver(()=>{
        clearTimeout(window.__deadlineSummaryPatchTimer);
        window.__deadlineSummaryPatchTimer=setTimeout(patchDeadlineSummary,120);
      });
      observer.observe(target,{childList:true,subtree:true});
    }
  });

  document.addEventListener('change',e=>{
    const ids=['signDate','awardDate','noticeDate','pccDate','tenderApprovalDate','allWorksAwardDate','allWorksCloseDate','pcmDays','projectSelect'];
    if(ids.includes(e.target.id)||e.target.closest?.('#scheduleTable')){
      setTimeout(patchDeadlineSummary,150);
    }
  });
})();