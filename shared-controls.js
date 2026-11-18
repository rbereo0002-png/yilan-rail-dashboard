// Cross-segment controls are one programme-level topic with segment-specific work.
// This mapping is presentation-only. Existing evidence and contract-specific IDs
// remain in the source documents until an audited data migration is approved.
export const sharedTopics=Object.freeze({
 '2027-key-main-basic-submit':'116年度主體工程基本設計成果',
 'pcm-1151102-meeting':'115/11/2整體研討會',
 'pcm-1151102-schedule':'整體時程及經費審議',
 'pcm-1151102-packages':'工程分標策略',
 'pcm-1151102-system':'系統機電及土建介面',
 'pcm-1151102-switch':'臨時軌切換整體協調',
 'pcm-1151102-bridge':'蘭陽溪橋協調及定線',
 'pcm-1151102-station':'車站月台出入口整合',
 'pcm-1151102-inspection':'軌道切換測試節點',
 'pcm-1151102-network':'PCM綱要時程網圖'
});
export function sharedTopicKey(id=''){
 const key=String(id).replace(/^(north|south)-/,'');
 return Object.prototype.hasOwnProperty.call(sharedTopics,key)?key:null;
}
export function uniqueControlKey(control,segment){
 const shared=sharedTopicKey(control?.id);
 return shared?'shared:'+shared:segment+':'+String(control?.id||'');
}
export function groupSharedControls(models){
 const grouped=new Map();
 for(const m of models){
   if(!m)continue;
   for(const c of m.kpiControls||[]){
     const shared=sharedTopicKey(c.id);
     if(!shared)continue;
     let item=grouped.get(shared);
     if(!item){item={key:shared,title:sharedTopics[shared],segments:[]};grouped.set(shared,item);}
     item.segments.push({segment:m.project.id,id:c.id,name:c.name,scope:c.scope||'',
       category:c.category||'',due:c.due||c.targetDate||'',actualDate:c.actualDate||'',
       status:c.computedStatus||c.status||'',note:c.actualNote||c.note||''});
   }
 }
 return [...grouped.values()];
}
export function countUniqueControls(models,filter=()=>true){
 const seen=new Set();
 for(const m of models){
   if(!m)continue;
   for(const c of m.kpiControls||[]){
     if(!filter(c,m))continue;
     seen.add(uniqueControlKey(c,m.project.id));
   }
 }
 return seen.size;
}
