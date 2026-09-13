(function(){
let refreshing=false,timer=null;
const paymentMap=['sign','surveyPlan','geoPlan','utilityPlan','execPlan','surveyResult','geoResult','utilityResult','basic','pcc','final','tender','worksAward','close'];
function scheduleRefresh(d=140){clearTimeout(timer);timer=setTimeout(refreshAll,d)}
function today(){const d=new Date();d.setHours(12,0,0,0);return d}
function parseDate(t){if(!t)return null;const m=String(t).match(/(\d{4})[\/-](\d{2})[\/-](\d{2})/);return m?new Date(+m[1],+m[2]-1,+m[3],12,0,0,0):null}
function moneyNumber(t){const n=Number(String(t||'').replace(/[^\d.-]/g,''));return Number.isFinite(n)?n:0}
function money(n){return Number(n||0).toLocaleString('zh-TW',{maximumFractionDigits:0})}
function fmt(d){return typeof r3Fmt==='function'?r3Fmt(d):(d?`${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`:'-')}
function classify(item,key){
 const now=today();
 if(key==='sign'){const d=parseDate(document.getElementById('signDate')?.value);if(!d)return{type:'external',text:'尚待外部條件'};return d<=now?{type:'ready',text:'已達請款條件'}:{type:'forecast',text:'管理預估付款'}}
 if(!item)return{type:'external',text:'尚待外部條件'};
 if(item.actualApproval)return{type:'ready',text:'已達請款條件'};
 if(['pcc','tender','worksAward','close'].includes(key)){const d=item.due||item.actual||null;if(!d)return{type:'external',text:'尚待外部條件'};return d<=now?{type:'ready',text:'已達請款條件'}:{type:'forecast',text:'管理預估付款'}}
 if(item.approval)return{type:'forecast',text:'管理預估付款'};
 return{type:'external',text:'尚待外部條件'};
}
function pill(i){return `<span class="payment-tier-pill payment-tier-${i.type}">${i.text}</span>`}
function ensureHeader(table){
 const head=table.querySelector('thead tr');if(!head)return;
 if([...head.children].some(th=>th.textContent.trim()==='付款性質'))return;
 const th=document.createElement('th');th.textContent='付款性質';th.dataset.paymentTier='1';
 head.insertBefore(th,[...head.children][2]||null);
}
function patchPaymentTable(data){
 const table=document.getElementById('paymentTable');if(!table)return[];
 ensureHeader(table);
 const rows=[...table.querySelectorAll('tbody tr')];
 rows.forEach((tr,i)=>{
   const key=paymentMap[i];if(!key)return;
   const info=classify(data.model?.[key]||null,key);tr.dataset.paymentTier=info.type;
   let cell=tr.querySelector('td[data-payment-tier="1"]');
   if(!cell){cell=document.createElement('td');cell.dataset.paymentTier='1';tr.insertBefore(cell,[...tr.children][2]||null)}
   cell.innerHTML=pill(info);
   const note=tr.lastElementChild;if(note){
     const original=note.dataset.originalNote||note.textContent.trim();note.dataset.originalNote=original;
     const extra=info.type==='ready'?'付款條件已達成；實際請款仍依契約及行政程序辦理。':info.type==='forecast'?'依目前時程及PCM管理假設推估，尚非實際可請款。':'尚待外部條件成立或實際日期登錄。';
     note.innerHTML=`${original}<div class="small payment-tier-note">${extra}</div>`;
   }
 });
 return rows;
}
function amountFromRow(tr){return moneyNumber([...tr.querySelectorAll('td')][6]?.textContent)}
function payDateFromRow(tr){return parseDate([...tr.querySelectorAll('td')][5]?.textContent)}
function patchDashboard(rows){
 let rc=0,ra=0,fc=0,fa=0,ec=0,ea=0,next=null;
 rows.forEach(tr=>{const type=tr.dataset.paymentTier,amt=amountFromRow(tr),d=payDateFromRow(tr);if(type==='ready'){rc++;ra+=amt}else if(type==='forecast'){fc++;fa+=amt;if(d&&(!next||d<next))next=d}else{ec++;ea+=amt}});
 const box=document.querySelector('.payment-kpis');
 if(box)box.innerHTML=`<div class="payment-kpi"><span>已達請款條件</span><b>${rc} 項</b><small>${money(ra)} 元</small></div><div class="payment-kpi"><span>管理預估付款</span><b>${fc} 項</b><small>${money(fa)} 元</small></div><div class="payment-kpi"><span>尚待外部條件</span><b>${ec} 項</b><small>${money(ea)} 元</small></div><div class="payment-kpi"><span>最近管理預估付款日</span><b>${next?fmt(next):'-'}</b><small>非實際付款承諾日</small></div>`;
}
function patchStrip(rows){
 [...document.querySelectorAll('.payment-strip .pay-node')].forEach((node,i)=>{const tr=rows[i];if(!tr)return;const type=tr.dataset.paymentTier;node.classList.remove('payment-ready','payment-forecast','payment-external');node.classList.add(type==='ready'?'payment-ready':type==='forecast'?'payment-forecast':'payment-external');let tag=node.querySelector('.payment-tier-strip-tag');if(!tag){tag=document.createElement('em');tag.className='payment-tier-strip-tag';node.appendChild(tag)}tag.textContent=type==='ready'?'已達請款條件':type==='forecast'?'管理預估付款':'尚待外部條件'})
}
function refreshAll(){if(refreshing||typeof r3Build!=='function')return;refreshing=true;try{const data=r3Build(),rows=patchPaymentTable(data);patchDashboard(rows);patchStrip(rows)}finally{refreshing=false}}
window.addEventListener('load',()=>{[300,700,1400].forEach(ms=>setTimeout(refreshAll,ms));document.addEventListener('change',e=>{const ids=['signDate','awardDate','noticeDate','pccDate','tenderApprovalDate','allWorksAwardDate','allWorksCloseDate','pcmDays','payMode','forecastMode','projectSelect'];if(ids.includes(e.target.id)||e.target.closest?.('#scheduleTable'))scheduleRefresh(150)});document.addEventListener('click',e=>{if(e.target.closest?.('.segment-btn'))[180,500,900].forEach(ms=>setTimeout(refreshAll,ms))})});
})();