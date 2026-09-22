import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
test('homepage has one module entrypoint, local assets exist and legacy handlers are absent',()=>{
  const html=read('index.html');
  assert.deepEqual([...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map(x=>x[1]),['app.js']);
  assert.match(html,/<script type="module" src="app.js"/);
  assert.doesNotMatch(html,/\bon(?:click|change)=/);
  for(const [,path] of html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g))assert.ok(existsSync(new URL(`../${path}`,import.meta.url)),path);
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);assert.equal(ids.length,new Set(ids).size);
});
test('all production modules resolve and contain no observer/timer patch or global state',()=>{
  const visited=new Set();
  function visit(path){if(visited.has(path))return;visited.add(path);const src=read(path);
    assert.doesNotMatch(src,/MutationObserver|setInterval\s*\(|setTimeout\s*\(|window\.(?:rows|current|computeSchedule)/,path);
    for(const [,file] of src.matchAll(/from\s+['"]\.\/([^'"]+)['"]/g)){assert.ok(existsSync(new URL(`../${file}`,import.meta.url)));visit(file);}
  }
  visit('app.js');assert.ok(visited.has('rules.js'));assert.ok(visited.has('payment-engine.js'));assert.ok(visited.has('schedule-engine.js'));
  for(const file of visited)assert.doesNotMatch(file,/stable|fix|stage2|stage3/);
});
test('all literal DOM ids referenced by production views/controller exist in homepage',()=>{
  const html=read('index.html'),ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]));
  for(const file of ['app.js','views.js'])for(const [,id]of read(file).matchAll(/\$\('([^']+)'\)/g))assert.ok(ids.has(id),`${file}: ${id}`);
});


test('milestone assignments tolerate cached HTML without new field',()=>{
  const views=readFileSync(new URL('../views.js',import.meta.url),'utf8');
  assert.match(views,/const el=\$\(key\);\s*if \(el\) el\.value=/);
});
test('production entrypoint cache-busts v1.3 assets',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(html,/app\.js\?v=1\.3\.1/);
});
