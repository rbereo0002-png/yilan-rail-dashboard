import test from 'node:test';
import assert from 'node:assert/strict';
import {sharedTopicKey,uniqueControlKey,groupSharedControls,countUniqueControls} from '../shared-controls.js';

const control=(id,scope='全案')=>({id,name:id,scope,category:'會議追蹤（非KPI）',due:'2026-11-23'});
const models=[
 {project:{id:'north'},kpiControls:[control('north-pcm-1151102-network'),control('north-pcm-1151102-station','宜蘭站')]},
 {project:{id:'south'},kpiControls:[control('south-pcm-1151102-network'),control('south-pcm-1151102-station','羅東站')]}
];
test('programme-wide topic is counted once but keeps separately accountable segment records',()=>{
 assert.equal(countUniqueControls(models),2);
 const group=groupSharedControls(models);
 assert.equal(group.length,2);
 const station=group.find(x=>x.key==='pcm-1151102-station');
 assert.equal(station.segments.length,2);
 assert.notEqual(station.segments[0].scope,station.segments[1].scope);
 assert.equal(new Set(station.segments.map(x=>x.id)).size,2);
});
test('north-only same-platform transfer is never collapsed into a south item',()=>{
 assert.equal(sharedTopicKey('north-yilan-hsr-same-platform-meeting'),null);
 assert.notEqual(uniqueControlKey(control('north-yilan-hsr-same-platform-meeting'),'north'),
                 uniqueControlKey(control('south-other-control'),'south'));
});
