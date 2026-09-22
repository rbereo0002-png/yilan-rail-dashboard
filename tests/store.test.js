import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ProjectStore} from '../store.js';
const data=id=>JSON.parse(readFileSync(new URL(`../data/${id}.json`,import.meta.url)));
const catalog={defaultProject:'south',projects:[{id:'north',data:'north'},{id:'south',data:'south'}]};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
function storage(){const m=new Map();return{getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};}

test('last selection wins even when old fetch resolves after new selection',async()=>{
  const north=deferred(),south=deferred();
  const store=new ProjectStore({catalog,loader:id=>({north,south})[id].promise,storage:storage()});
  const a=store.select('north'),b=store.select('south');south.resolve(data('south'));await b;
  north.resolve(data('north'));assert.equal(await a,false);assert.equal(store.project.id,'south');assert.equal(store.loading,false);
});
test('stale rejection does not overwrite latest successful state',async()=>{
  const north=deferred();const store=new ProjectStore({catalog,loader:id=>id==='north'?north.promise:Promise.resolve(data(id)),storage:storage()});
  const a=store.select('north');await store.select('south');north.reject(new Error('old failure'));await a;
  assert.equal(store.error,'');assert.equal(store.project.id,'south');
});
test('draft retained separately for both segments and imported ID selects matching project',async()=>{
  const store=new ProjectStore({catalog,loader:async id=>data(id),storage:storage()});
  await store.select('south');store.edit(p=>p.rows.execPlan_submit='2026-10-15');
  await store.select('north');assert.equal(store.project.rows.execPlan_submit,undefined);
  store.edit(p=>p.contract.design=123);await store.select('south');assert.equal(store.project.rows.execPlan_submit,'2026-10-15');
  await store.select('north');assert.equal(store.project.contract.design,123);
  store.importProject(data('south'));assert.equal(store.project.id,'south');assert.equal(store.dirty.size,2);
});
test('edits blocked during fetch and in readonly mode',async()=>{
  const pending=deferred();const store=new ProjectStore({catalog,loader:id=>id==='north'?pending.promise:Promise.resolve(data(id)),storage:storage()});
  await store.select('south');const request=store.select('north');assert.equal(store.edit(p=>p.name='wrong'),false);
  pending.resolve(data('north'));await request;store.readOnly=true;assert.equal(store.edit(p=>p.name='wrong'),false);
});
test('read only loads remote data and never reads the saved editing draft',async()=>{
  const cache=storage(),local=data('south');local.contract.design=999;cache.setItem('yilan-dashboard-south',JSON.stringify(local));
  const store=new ProjectStore({catalog,loader:async id=>data(id),storage:cache,readOnly:true});
  await store.select('south');assert.notEqual(store.project.contract.design,999);
  store.readOnly=false;await store.select('south');assert.equal(store.project.contract.design,999);
});
test('invalid local data falls back to remote with visible notice',async()=>{
  const cache=storage();cache.setItem('yilan-dashboard-south','bad json');
  const store=new ProjectStore({catalog,loader:async id=>data(id),storage:cache});
  assert.equal(await store.select('south'),true);assert.match(store.notice,/本機資料未套用/);assert.equal(store.project.id,'south');
});
test('save/restore retains actual rows and zero administrative workdays',async()=>{
  const cache=storage(),store=new ProjectStore({catalog,loader:async id=>data(id),storage:cache});
  await store.select('south');store.edit(p=>{p.settings.payWorkdays=0;p.rows.execPlan_approval='2026-11-15';});store.save();
  const restored=new ProjectStore({catalog,loader:async id=>data(id),storage:cache});await restored.select('south');
  assert.equal(restored.project.settings.payWorkdays,0);assert.equal(restored.project.rows.execPlan_approval,'2026-11-15');assert.equal(store.dirty.size,0);
});
test('remote reset does not erase local data if fetch fails',async()=>{
  const cache=storage(),store=new ProjectStore({catalog,loader:async id=>data(id),storage:cache});
  await store.select('south');store.edit(p=>p.contract.design=321);store.save();
  store.loader=async()=>{throw new Error('offline');};await store.reset();
  assert.equal(JSON.parse(cache.getItem('yilan-dashboard-south')).contract.design,321);assert.equal(store.project.contract.design,321);
});
test('external date cleared from both legacy alias and rows stays cleared after saving',async()=>{
  const store=new ProjectStore({catalog,loader:async id=>data(id),storage:storage()});await store.select('south');
  store.edit(p=>{p.rows.pcc_approval='2026-11-15';p.dates.pccDate='2026-11-15';});
  store.edit(p=>{p.rows.pcc_approval='';p.dates.pccDate='';});store.save();
  assert.equal(store.project.rows.pcc_approval,'');assert.equal(store.project.dates.pccDate,'');
});
test('failed public-mode fetch never presents the editing draft as remote data',async()=>{
  const store=new ProjectStore({catalog,loader:async id=>data(id),storage:storage()});
  await store.select('south');store.edit(p=>p.contract.design=999);
  store.loader=async()=>{throw new Error('offline');};await store.setReadOnly(true);
  assert.equal(store.project,null);assert.match(store.error,/offline/);
  await store.setReadOnly(false);assert.equal(store.project.contract.design,999);
});
test('legacy conflict warning survives repeated normalization and loading',async()=>{
  const input=data('south');input.rows.pcc_approval='2026-11-15';input.dates.pccDate='2026-10-10';
  const store=new ProjectStore({catalog,loader:async()=>input,storage:storage()});await store.select('south');
  assert.equal(store.project.migrationWarnings.length,1);store.edit(p=>p.settings.payWorkdays=0);
  assert.equal(store.project.migrationWarnings.length,1);
});

test('construction packages remain isolated by segment and validate dates',async()=>{
  const store=new ProjectStore({catalog,loader:async id=>data(id),storage:storage()});
  await store.select('south');store.edit(p=>p.constructionPackages.push({id:'s1',code:'S1',name:'南段一標',scope:'',plannedTenderDate:'2027-01-01',actualAwardDate:''}));
  await store.select('north');assert.equal(store.project.constructionPackages.length,0);
  await store.select('south');assert.equal(store.project.constructionPackages[0].code,'S1');
  assert.throws(()=>store.edit(p=>p.constructionPackages[0].actualAwardDate='2027-02-30'));
});
