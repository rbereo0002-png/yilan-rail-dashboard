function r3ParseDate(text){if(!text)return null;const m=String(text).match(/(\d{4})[\/-](\d{2})[\/-](\d{2})/);if(!m)return null;return new Date(+m[1],+m[2]-1,+m[3],12,0,0,0)}
function r3Fmt(d){if(!d)return '-';return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`}
function r3Add(d,n){if(!d)return null;const x=new Date(d);x.setDate(x.getDate()+Number(n||0));x.setHours(12,0,0,0);return x}
function r3Days(a,b){if(!a||!b)return null;const x=new Date(a),y=new Date(b);x.setHours(12,0,0,0);y.setHours(12,0,0,0);return Math.round((y-x)/86400000)}
function r3Field(id){const e=document.getElementById(id);return e?.value?r3ParseDate(e.value):null}
function r3Project(){return document.getElementById('projectSelect')?.value||window.current?.id||'south'}
function r3Actual(id,k){return typeof actual==='function'?actual(id,k):null}
function r3HumanName(id,model){if(!id)return '—';if(id==='sign')return '契約簽訂';if(id==='award')return '決標';if(id==='noticeDate')return '甲方通知';return model[id]?.name||id}

function r3Build(){
 if(!window.YilanRules)return{list:[],model:{},pcm:30,projectId:r3Project()};
 const rules=window.YilanRules.getRules(r3Project()),pcm=Number(document.getElementById('pcmDays')?.value||30),sign=r3Field('signDate'),award=r3Field('awardDate'),notice=r3Field('noticeDate');
 const model={sign:{id:'sign',name:'契約簽訂',base:sign,due:sign,approval:sign,actualApproval:sign,dueType:'contract'},award:{id:'award',name:'決標',base:award,due:award,approval:award,actualApproval:award,dueType:'contract'}},list=[];
 for(const rule of rules){
  let base=null,due=null,dueType='external',basisActual=false;
  const actualSubmit=r3Actual(rule.id,'submit'),actualApproval=r3Actual(rule.id,'approval');
  if(rule.triggerType==='signDate'){base=sign;due=r3Add(base,rule.days);dueType=base?'contract':'external';basisActual=!!base}
  else if(rule.triggerType==='awardDate'){base=award;due=r3Add(base,rule.days);dueType=base?'contract':'external';basisActual=!!base}
  else if(rule.triggerType==='approvalOf'){
    const ref=model[rule.triggerRef];
    if(ref?.actualApproval){base=ref.actualApproval;dueType='contract';basisActual=true}
    else if(ref?.approval){base=ref.approval;dueType='management'}
    due=r3Add(base,rule.days)
  } else if(rule.triggerType==='basicApprovalOrNotice'){
    const ref=model[rule.triggerRef];
    if(notice){base=notice;dueType='contract';basisActual=true}
    else if(ref?.actualApproval){base=ref.actualApproval;dueType='contract';basisActual=true}
    else if(ref?.approval){base=ref.approval;dueType='management'}
    due=r3Add(base,rule.days)
  } else if(rule.triggerType==='sameAs'){
    const ref=model[rule.triggerRef];base=ref?.base||null;due=ref?.due||null;dueType=ref?.dueType||'external';basisActual=!!ref?.basisActual
  } else if(rule.triggerType==='externalDate'){due=r3Field(rule.dateField);dueType='external';basisActual=!!due}
  else if(rule.triggerType==='eventAfter'){
    const ref=model[rule.triggerRef];
    if(ref?.actualApproval||ref?.actual){base=ref.actualApproval||ref.actual;dueType=rule.days!=null?'contract':'external';basisActual=true}
    else if(ref?.due){base=ref.due;dueType=rule.days!=null?'management':'external'}
    due=rule.days!=null?r3Add(base,rule.days):null
  } else if(rule.triggerType==='externalNotice'){base=null;due=null;dueType='external'}
  else if(rule.triggerType==='conditional'){const ref=model[rule.triggerRef];base=ref?.actualApproval||ref?.approval||null;due=null;dueType='external'}
  let approval=null,approvalType='external';
  if(actualApproval){approval=actualApproval;approvalType='actual'}
  else if(due&&rule.contractRule){approval=r3Add(actualSubmit||due,pcm);approvalType='management'}
  else {approval=due;approvalType=dueType}
  if(rule.id==='rowDrawing'&&due){dueType='management';basisActual=false}
  const item={...rule,base,due,dueType,basisActual,approval,approvalType,actualSubmit,actualApproval,actual:actualApproval||actualSubmit||null};
  model[rule.id]=item;list.push(item)
 }
 return{list,model,pcm,projectId:r3Project()}
}

function r3TypeLabel(item){if(item.conditional)return{text:'外部／條件式',cls:'deadline-external'};if(item.dueType==='contract')return{text:'契約期限',cls:'deadline-contract'};if(item.dueType==='management')return{text:'管理預估期限',cls:'deadline-management'};return{text:'外部／條件式',cls:'deadline-external'}}
function r3Status(item){
 const today=new Date();today.setHours(12,0,0,0);
 if(item.conditional)return{text:'條件式／待確認',cls:'tl-external'};
 if(item.actualApproval)return{text:'已核定',cls:'tl-done'};
 if(item.actualSubmit)return{text:'已提送待核定',cls:'tl-warning'};
 if(!item.due)return{text:'待通知／外部日期',cls:'tl-external'};
 const remain=r3Days(today,item.due);
 if(item.dueType==='management'){if(remain<0)return{text:`管理預估已過 ${Math.abs(remain)} 日`,cls:'tl-warning'};return{text:'管理預估',cls:'tl-normal'}}
 if(item.dueType==='external')return{text:'外部／條件式',cls:'tl-external'};
 if(remain<0)return{text:`契約逾期 ${Math.abs(remain)} 日`,cls:'tl-danger'};
 if(remain<=14)return{text:`${remain} 日內到期`,cls:'tl-warning'};
 if(remain<=30)return{text:`${remain} 日內到期`,cls:'tl-normal'};
 return{text:'管制中',cls:'tl-normal'}
}

function r3ActualField(id,kind){const key=id+'_'+kind;return `<input type="date" value="${window.rows?.[key]||''}" onchange="rows['${key}']=this.value;recalc()">`}

function r3RenderMainSchedule(data){
 const tbody=document.querySelector('#scheduleTable tbody');if(!tbody)return{};
 const c={};
 tbody.innerHTML=data.list.map(item=>{
  c[item.id+'Deadline']=item.due;c[item.id+'Submit']=item.actualSubmit||item.due;c[item.id+'Approval']=item.approval;
  const pred=r3HumanName(item.predecessor,data.model),st=r3Status(item),type=r3TypeLabel(item),allowInputs=item.contractRule||item.triggerType==='externalDate'||item.conditional;
  const submitCell=allowInputs?r3ActualField(item.id,'submit'):'-';
  const approvalCell=allowInputs?r3ActualField(item.id,'approval')+(item.approval&&!item.actualApproval?`<div class="small">管理預估核定：${r3Fmt(item.approval)}</div>`:''):'-';
  let note=item.note||'';if(item.dueType==='management')note+=`<br><span class="small">此日期由前置成果之管理預估核定日推算，非契約直接明定日期。</span>`;if(item.conditional)note+=`<br><span class="small">條件式節點，不自動推算契約期限。</span>`;
  return `<tr><td class="center"><span class="pill p-blue">${item.group||''}</span></td><td>${item.name}<div><span class="timeline-pill ${type.cls}">${type.text}</span></div></td><td>${pred}<br><span class="small">${r3Fmt(item.base)}</span></td><td class="center">${item.days!=null?item.days+'日':(item.conditional?'條件式':'—')}</td><td class="center"><b>${r3Fmt(item.due)}</b></td><td>${submitCell}</td><td>${approvalCell}</td><td class="center"><span class="timeline-pill ${st.cls}">${st.text}</span></td><td>${note}</td></tr>`
 }).join('');
 return c
}

function r3RenderRuleTable(data){
 const tbody=document.querySelector('#contractRuleTable tbody');if(!tbody)return;
 tbody.innerHTML=data.list.map(item=>{const st=r3Status(item),type=r3TypeLabel(item),pred=r3HumanName(item.predecessor,data.model);return `<tr><td>${item.group||''}</td><td><b>${item.name}</b><div class="small">${item.note||''}</div></td><td>${pred}</td><td><span class="timeline-pill ${type.cls}">${type.text}</span></td><td>${r3Fmt(item.base)}</td><td>${r3Fmt(item.due)}</td><td>${item.actualSubmit?r3Fmt(item.actualSubmit):'-'}</td><td>${item.actualApproval?r3Fmt(item.actualApproval):'-'}</td><td><span class="timeline-pill ${st.cls}">${st.text}</span></td><td>${item.payment||'—'}</td></tr>`}).join('')
}

function r3RenderSummary(data){
 const set=(id,t)=>{const e=document.getElementById(id);if(e)e.textContent=t};
 set('r3ProjectName',document.getElementById('projectSelect')?.selectedOptions?.[0]?.textContent||data.projectId);
 set('r3RuleCount',`${data.list.filter(x=>x.dueType==='contract').length} 項`);
 const mgmt=data.list.filter(x=>x.dueType==='management').length,ext=data.list.filter(x=>x.dueType==='external').length;
 const box=document.querySelector('#contractRuleControl .timeline-kpis > div:nth-child(3)');if(box)box.innerHTML=`<span>管理預估／外部條件</span><b>${mgmt} / ${ext} 項</b>`;
 const dates=data.list.filter(x=>x.dueType==='contract'&&x.due).map(x=>x.due);set('r3LastDue',dates.length?r3Fmt(new Date(Math.max(...dates.map(d=>d.getTime())))):'-')
}

function r3Dashboard(data){
 if(!document.getElementById('overview'))return;
 const today=new Date();today.setHours(12,0,0,0);const set=(id,t)=>{const e=document.getElementById(id);if(e)e.textContent=t},sign=r3Field('signDate');
 set('overviewToday',r3Fmt(today));set('ovProject',document.getElementById('projectSelect')?.selectedOptions?.[0]?.textContent||'-');set('ovSignDate',document.getElementById('signDate')?.value?document.getElementById('signDate').value.replaceAll('-','/'):'-');
 if(sign&&today<sign)set('ovOverallStatus','尚未簽約');
 const items=data.list.filter(x=>x.dueType==='contract');let overdue=0,due14=0,due30=0,pending=0,completed=0;
 for(const item of items){if(item.actualApproval){completed++;continue}if(item.actualSubmit&&!item.actualApproval){pending++;continue}if(!item.due)continue;const diff=r3Days(today,item.due);if(diff<0)overdue++;else if(diff<=14)due14++;else if(diff<=30)due30++}
 if(sign&&today<sign){overdue=due14=due30=pending=completed=0}
 set('ovOverdue',overdue);set('ovDue14',due14);set('ovDue30',due30);set('ovPendingApproval',pending);set('ovCompleted',completed)
}

function r3HideSupervision(){document.querySelectorAll('.supervision-details').forEach(el=>el.style.display='none');document.querySelectorAll('section.card').forEach(sec=>{const h2=sec.querySelector('.hd h2');if(h2&&h2.textContent.trim().startsWith('六、施工監造'))sec.style.display='none'})}
function r3InstallUnifiedSchedule(){if(typeof window.computeSchedule!=='function')return;window.computeSchedule=function(){const data=r3Build();return r3RenderMainSchedule(data)}}
function renderStage3Unified(){r3HideSupervision();const data=r3Build();r3RenderSummary(data);r3RenderRuleTable(data);r3Dashboard(data)}
const r3Observer=new MutationObserver(()=>{clearTimeout(window.__r3UnifiedTimer);window.__r3UnifiedTimer=setTimeout(renderStage3Unified,100)});
window.addEventListener('load',()=>{r3HideSupervision();r3InstallUnifiedSchedule();setTimeout(()=>{r3InstallUnifiedSchedule();if(typeof window.recalc==='function')window.recalc();renderStage3Unified()},250);[600,1200].forEach(ms=>setTimeout(()=>{r3InstallUnifiedSchedule();renderStage3Unified()},ms));const schedule=document.getElementById('scheduleTable'),payment=document.getElementById('paymentTable');if(schedule)r3Observer.observe(schedule,{childList:true,subtree:true});if(payment)r3Observer.observe(payment,{childList:true,subtree:true});document.addEventListener('change',e=>{const ids=['signDate','awardDate','noticeDate','pccDate','tenderApprovalDate','allWorksAwardDate','allWorksCloseDate','pcmDays','projectSelect'];if(ids.includes(e.target.id)||e.target.closest?.('#scheduleTable'))setTimeout(()=>{r3InstallUnifiedSchedule();if(typeof window.recalc==='function')window.recalc();renderStage3Unified()},100)})});
