import test from 'node:test';
import assert from 'node:assert/strict';
import {createCentralStore} from '../central-store.js';
const response=(value,status=200)=>({ok:status>=200&&status<300,status,json:async()=>value});
function mock(events,{conflict=false}={}){
  return async (url,options={})=>{
    events.push({url,method:options.method||'GET',body:options.body&&JSON.parse(options.body)});
    if(url.includes('/auth/v1/token'))return response({access_token:'TEST_ACCESS_TOKEN',refresh_token:'TEST_REFRESH_TOKEN',expires_in:3600});
    if(url.includes('/rail_control_members'))return response([{project_key:'south',role:'editor'}]);
    if(options.method==='PATCH')return response(conflict?[]:[{project_key:'south',revision:2}]);
    if(url.includes('/rail_control_snapshots'))return response([{project_key:'south',revision:1,document:{id:'south',rows:{}}}]);
    return response({},404);
  };
}
test('central store loads and writes a versioned project without browser persistence',async()=>{
  const events=[];const store=createCentralStore({api:'https://test.invalid',key:'sb_publishable_test',transport:mock(events)});
  await store.login('test@example.com','not-a-real-password');
  const roles=await store.memberships();
  assert.equal(roles[0].role,'editor');
  const row=await store.load('south');
  assert.equal(row.revision,1);
  const version=await store.save('south',{id:'south',rows:{execPlan_submit:'2026-10-30'}},1);
  assert.equal(version,2);
  assert.equal(events.find(x=>x.method==='PATCH').body.revision,2);
  store.logout();assert.equal(store.isLoggedIn(),false);
  await assert.rejects(()=>store.load('south'),/登入/);
});
test('concurrent edit conflict fails closed',async()=>{
  const store=createCentralStore({api:'https://test.invalid',key:'sb_publishable_test',transport:mock([],{conflict:true})});
  await store.login('test@example.com','pw');
  await assert.rejects(()=>store.save('south',{id:'south'},1),/其他使用者已更新/);
});
test('cross-segment writes are not accepted',async()=>{
  const store=createCentralStore({api:'https://test.invalid',key:'sb_publishable_test',transport:mock([])});
  await store.login('test@example.com','pw');
  await assert.rejects(()=>store.save('south',{id:'north'},1),/識別碼不符/);
});
