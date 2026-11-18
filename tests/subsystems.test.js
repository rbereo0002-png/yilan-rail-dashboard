import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('operator subsystems have isolated navigation but share one model',()=>{
 const html=read('index.html'),app=read('app.js');
 for(const type of ['overview','schedule','review','kpi','payment','transfer']){
   assert.match(html,new RegExp('data-module="'+type+'"'));
   assert.match(html,new RegExp('data-subsystem="'+type+'"'));
 }
 assert.match(app,/function setSubsystem\(next\)/);
 assert.match(app,/section\[data-subsystem\]/);
 assert.match(app,/calculateModel\(store\.project,todayLocal\(\)\)/);
 assert.match(app,/renderModel\(model/);
 assert.doesNotMatch(app,/localStorage\.setItem/);
});
test('north-only same-platform subsystem is hidden when showing south',()=>{
 const src=read('app.js');
 assert.match(src,/next==='transfer' && store\?\.project\?\.id!=='north'/);
 assert.match(src,/button\.dataset\.module==='transfer' && store\?\.project\?\.id!=='north'/);
});
test('operator and executive load the same approved online JSON without writing browser data',()=>{
 const app=read('app.js'),dash=read('dashboard.js');
 assert.match(app,/loader:loadJSON,storage:null,readOnly:true/);
 assert.match(dash,/normalizeProject\(await loadJSON\(p\.data\),p\.id\)/);
 assert.doesNotMatch(dash,/localStorage\.setItem/);
});
