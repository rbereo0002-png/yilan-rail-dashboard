import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeProject} from '../store.js';
import {calculateModel} from '../model.js';
import {tableMarkup,exportHTML} from '../views.js';
import {isTransferControl} from '../transfer-controls.js';
test('transfer topic includes all five meeting/interface records and contractual study without losing history',()=>{
 const p=normalizeProject(JSON.parse(readFileSync(new URL('../data/north.json',import.meta.url))));
 const before=JSON.stringify(p),m=calculateModel(p,'2026-10-27'),tables=tableMarkup(m,true);
 const items=m.kpiControls.filter(isTransferControl);
 assert.equal(items.length,5);
 for(const x of items){
  assert.ok(tables.transferControlTable.includes('data-kpi-id="'+x.id+'"'));
  for(const key of ['meetingTaskTable','interfaceControlTable','kpiControlTable']) assert.ok(!tables[key].includes('data-kpi-id="'+x.id+'"'));
 }
 assert.match(tables.transferControlTable,/已提送待審查/);
 assert.match(tables.transferControlTable,/1153201806/);
 assert.match(tables.transferStudyTable,/共月台轉乘專案研究報告/);
 assert.match(exportHTML(m),/<h2>同月台轉乘<\/h2>/);
 assert.equal(JSON.stringify(p),before);
});
test('south does not duplicate the north-only transfer controls',()=>{
 const p=normalizeProject(JSON.parse(readFileSync(new URL('../data/south.json',import.meta.url))));
 const m=calculateModel(p,'2026-10-27');
 assert.equal(m.kpiControls.filter(isTransferControl).length,0);
 assert.equal((m.specialDeliverables||[]).filter(isTransferControl).length,0);
});
