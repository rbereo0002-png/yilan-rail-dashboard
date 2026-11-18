import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ProjectStore} from '../store.js';
const fixture=id=>JSON.parse(readFileSync(new URL('../data/'+id+'.json',import.meta.url),'utf8'));
const catalog={defaultProject:'south',projects:[{id:'north',data:'north'},{id:'south',data:'south'}]};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const poisonedStorage=()=>({getItem:()=>{throw Error('local read attempted');},setItem:()=>{throw Error('local write attempted');},removeItem:()=>{throw Error('local delete attempted');}});
const make=(options={})=>new ProjectStore({catalog,loader:async id=>fixture(id),storage:poisonedStorage(),...options});

test('out-of-order segment loads cannot overwrite the latest selected segment',async()=>{
 const north=deferred(),south=deferred();
 const store=make({loader:id=>({north,south})[id].promise});
 const a=store.select('north'),b=store.select('south');
 south.resolve(fixture('south'));await b;north.resolve(fixture('north'));
 assert.equal(await a,false);assert.equal(store.project.id,'south');
});
test('failed stale request does not overwrite success or errors',async()=>{
 const north=deferred();const store=make({loader:id=>id==='north'?north.promise:fixture(id)});
 const a=store.select('north');await store.select('south');north.reject(new Error('stale'));await a;
 assert.equal(store.project.id,'south');assert.equal(store.error,'');
});
test('read only loads remote source and never reads local browser data',async()=>{
 const store=make({readOnly:true});
 assert.equal(await store.select('south'),true);
 assert.equal(store.project.id,'south');
 assert.equal(store.edit(p=>{p.name='fake';}),false);
});
test('local browser cache is always ignored in both reading and editing modes',async()=>{
 const store=make();
 assert.equal(await store.select('south'),true);
 assert.equal(store.project.contract.design,fixture('south').contract.design);
 assert.equal(store.error,'');
});
test('central save uses configured asynchronous backend and never uses browser storage',async()=>{
 let saved;
 const store=make({saver:async p=>{saved=structuredClone(p);return 2;}});
 await store.select('south');
 store.edit(p=>{p.rows.execPlan_approval='2026-11-15';p.settings.payWorkdays=0;});
 assert.equal(await store.save(),true);
 assert.equal(saved.rows.execPlan_approval,'2026-11-15');
 assert.equal(saved.settings.payWorkdays,0);
 assert.equal(store.dirty.size,0);
 assert.match(store.notice,/中央資料庫已更新/);
});
test('save is rejected without a central database writer',async()=>{
 const store=make();await store.select('south');
 store.edit(p=>{p.rows.execPlan_submit='2026-11-01';});
 await assert.rejects(store.save(),/中央資料庫未啟用/);
 assert.equal(store.dirty.size,1);
});
test('reset re-fetches remote source instead of local cache',async()=>{
 const store=make();await store.select('south');
 store.edit(p=>{p.name='local-only';});
 await store.reset();
 assert.equal(store.project.name,fixture('south').name);
 assert.equal(store.dirty.size,0);
});
test('failure to reload remote source cannot claim successful replacement',async()=>{
 const store=make();await store.select('south');
 store.edit(p=>{p.name='pending edit';});
 store.loader=async()=>{throw new Error('offline');};
 await store.reset();
 assert.match(store.error,/offline/);
 assert.equal(store.project.name,'pending edit');
 assert.equal(store.dirty.has('south'),true);
});
test('cleared external dates remain cleared after normalization',async()=>{
 const store=make();await store.select('south');
 store.edit(p=>{p.rows.pcc_approval='2026-11-15';p.dates.pccDate='2026-11-15';});
 store.edit(p=>{p.rows.pcc_approval='';p.dates.pccDate='';});
 assert.equal(store.project.rows.pcc_approval,'');
 assert.equal(store.project.dates.pccDate,'');
});
test('in-memory drafts are separated by segment and never persisted',async()=>{
 const store=make();await store.select('south');
 store.edit(p=>{p.rows.uniqueSouth='2026-11-01';});
 await store.select('north');assert.equal(store.project.rows.uniqueSouth,undefined);
 await store.select('south');assert.equal(store.project.rows.uniqueSouth,'2026-11-01');
 const fresh=make();await fresh.select('south');
 assert.equal(fresh.project.rows.uniqueSouth,undefined);
});
test('amounts confirmed in master cannot be overwritten by a local edit or imported file',async()=>{
 for(const id of ['north','south']){
   const store=make();await store.select(id);
   const baseline=structuredClone(store.project.contract),budget=structuredClone(store.project.budget);
   store.edit(p=>{p.contract.design=3;p.budget.total=4;});
   assert.deepEqual(store.project.contract,baseline);
   assert.deepEqual(store.project.budget,budget);
   const altered=fixture(id);altered.contract.design=999;altered.budget.total=999;
   await store.importProject(altered);
   assert.deepEqual(store.project.contract,baseline);
   assert.deepEqual(store.project.budget,budget);
 }
});
test('the north-only transfer topic never appears in south data',async()=>{
 const store=make();await store.select('south');
 assert.equal(store.project.kpiControls.some(x=>x.id.includes('same-platform')),false);
});
