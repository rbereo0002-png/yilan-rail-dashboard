import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const base='http://127.0.0.1:8765/';
const server=spawn('python3',['-m','http.server','8765','--bind','127.0.0.1'],{stdio:'ignore'});
const browser=await chromium.launch({headless:true});
const errors=[];
async function navigate(page,path){
 let response;
 for(let i=0;i<20;i++){
   try{response=await page.goto(base+path,{waitUntil:'networkidle',timeout:15000});break;}
   catch(e){if(i===19)throw e;await sleep(250);}
 }
 assert.equal(response.status(),200);
}
async function operator(width,height){
 const page=await browser.newPage({viewport:{width,height}});
 page.on('pageerror',e=>errors.push('operator '+width+': '+e.message));
 await navigate(page,'index.html');
 await page.waitForFunction(()=>document.querySelector('#appStatus')?.textContent?.includes('唯讀快照'),{timeout:15000});
 for(const module of ['overview','schedule','review','kpi','payment']){
   const button=page.locator('[data-module="'+module+'"]');
   await button.click();
   assert.equal(await button.getAttribute('aria-pressed'),'true');
   assert.ok(await page.locator('section[data-subsystem="'+module+'"]:visible').count()>0,module+' is visible');
   for(const other of ['overview','schedule','review','kpi','payment','transfer'].filter(x=>x!==module)){
     assert.equal(await page.locator('section[data-subsystem="'+other+'"]:visible').count(),0,other+' should be hidden');
   }
 }
 await page.locator('#projectSelect').selectOption('south');
 assert.equal(await page.locator('[data-module="transfer"]').isHidden(),true);
 await page.locator('#projectSelect').selectOption('north');
 await page.locator('[data-module="transfer"]').click();
 assert.ok(await page.locator('#transferControl').isVisible());
 const transferCurrent=await page.locator('#transferControlTable').textContent();
 assert.match(transferCurrent,/2026\/11\/27/,'new Nov27 deadline visible in operator');
 assert.match(transferCurrent,/同高程方案/,'new current action visible in operator');
 const transferHistory=await page.locator('#transferHistoryTable').textContent();
 assert.match(transferHistory,/2026\/11\/20/,'Nov20 meeting recorded in chronological history');
 assert.match(transferHistory,/1153202038/,'draft letter reference retained in history');
 await page.locator('[data-module="review"]').click();
 assert.ok(await page.locator('#revisionTrackingControl').isVisible());
 const reviewText=await page.locator('#revisionTrackingControl').innerText();
 assert.match(reviewText,/11\/26/,'north risk review due date visible in operator page');
 assert.match(reviewText,/已函送/,'north actual review stage visible in operator page');
 for(const name of ['工程設計執行服務計畫書','補充測量工作計畫書','補充地質調查工作計畫書','管線調查工作計畫書','鄰近建物及結構物調查工作計畫書','價值工程研析工作計畫書','出流管制計畫工作計畫書']) assert.ok(reviewText.includes(name),name+' present in review');
 assert.match(reviewText,/12\/03/,'provisional Dec3 reply date visible');
 assert.match(reviewText,/待核發|擬稿/,'provisional letter is not reported as issued');
 await page.screenshot({path:'browser-qa-workbench-'+width+'.png',fullPage:true});
 assert.equal(await page.evaluate(()=>Object.keys(localStorage).some(k=>k.startsWith('yilan-dashboard-'))),false);
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+4);
 if(overflow)console.log('LAYOUT WARNING: horizontal overflow '+width);
 await page.close();
}
async function executive(width,height){
 const page=await browser.newPage({viewport:{width,height}});
 page.on('pageerror',e=>errors.push('executive '+width+': '+e.message));
 await navigate(page,'dashboard.html');
 await page.waitForFunction(()=>document.querySelector('#dashboardStatus')?.textContent?.includes('資料已更新'),{timeout:15000});
 for(const view of ['overview','progress','attention','kpi','review','payment','meeting','transfer']){
   await page.locator('.exec-nav [data-view="'+view+'"]').click();
   assert.ok((await page.locator('#viewBody').innerText()).length>30,view+' should render content');
 }
 await page.locator('.exec-nav [data-view="transfer"]').click();
 const transferText=await page.locator('#viewBody').textContent();
 assert.match(transferText,/11\/27/,'executive has Nov27 due date');
 assert.match(transferText,/1153202038/,'executive history can query draft-letter reference');
 await page.locator('.exec-nav [data-view="review"]').click();
 const reviewText=await page.locator('#viewBody').innerText();
 assert.match(reviewText,/11\/26/,'north risk review due date visible in executive page');
 assert.match(reviewText,/已函送/,'north risk review stage visible in executive page');
 for(const name of ['工程設計執行服務計畫書','補充測量工作計畫書','補充地質調查工作計畫書','管線調查工作計畫書','鄰近建物及結構物調查工作計畫書','價值工程研析工作計畫書','出流管制計畫工作計畫書']) assert.ok(reviewText.includes(name),name+' present in review');
 assert.match(reviewText,/12\/03/,'provisional Dec3 reply date visible');
 assert.match(reviewText,/待核發|擬稿/,'provisional letter is not reported as issued');
 await page.locator('.exec-nav [data-view="overview"]').click();
 await page.screenshot({path:'browser-qa-executive-'+width+'.png',fullPage:true});
 await page.close();
}
try{
 for(const [w,h] of [[1440,900],[834,1112],[390,844]])await operator(w,h);
 for(const [w,h] of [[1440,900],[390,844]])await executive(w,h);
 assert.deepEqual(errors,[],'no browser runtime errors');
 console.log('PASS: workbench desktop/tablet/phone, executive desktop/phone');
}finally{
 await browser.close();server.kill('SIGTERM');
}
