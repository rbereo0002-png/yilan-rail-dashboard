import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeProject} from '../store.js';
import {calculateModel} from '../model.js';
import {tableMarkup} from '../views.js';
const project=()=>normalizeProject(JSON.parse(readFileSync(new URL('../data/north.json',import.meta.url))));
test('meeting regrouping preserves all 41 source IDs without duplicating graphic requests',()=>{
 const p=project();const meeting=p.kpiControls.filter(x=>x.id.startsWith('north-kickoff-1151006-'));
 assert.equal(meeting.length,36);const ids=meeting.flatMap(x=>[x.id,...x.children.map(c=>c.id)]);
 assert.equal(ids.length,41);assert.equal(new Set(ids).size,41);
 const parent=meeting.find(x=>x.children.length);parent.children[0].actualDate='2026-10-08';parent.children[0].actualNote='收到PDF，CAD待補';
 const restored=normalizeProject(JSON.parse(JSON.stringify(p)));assert.equal(restored.kpiControls.find(x=>x.id===parent.id).children[0].actualNote,'收到PDF，CAD待補');
});
test('checklist is not overdue without date and completed item moves into archive',()=>{
 const p=project();const item=p.kpiControls.find(x=>x.category==='設計查核');
 const original=calculateModel(p,'2026-10-08');assert.equal(original.kpiControls.find(x=>x.id===item.id).computedStatus,'待審查確認');
 item.actualDate='2026-10-08';const result=calculateModel(p,'2026-10-08');const tables=tableMarkup(result,true);
 assert.ok(!tables.designChecklistTable.includes(`data-kpi-id="${item.id}"`));assert.ok(tables.completedControlTable.includes(`data-kpi-id="${item.id}"`));
 assert.equal(result.dashboard.total,original.dashboard.total);assert.deepEqual(result.payments.totals,original.payments.totals);
});
