import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
const base='https://mazimuri.github.io/',dir='selection-ux-v18-review';
mkdirSync(dir,{recursive:true});
const assets={};
for(const path of ['index.html','app.js','cast-side-rail.js','cast-rail-current.css','cast-navigation-current.css','cast-allcast-current.css'])assets[path]=readFileSync(path,'utf8');
const browser=await chromium.launch();
const findings=[];
async function pageFor(w,h,{moreCast=false}={}){
 const page=await browser.newPage({viewport:{width:w,height:h},deviceScaleFactor:1,reducedMotion:'no-preference'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route(base,r=>r.fulfill({status:200,contentType:'text/html; charset=utf-8',body:assets['index.html']}));
 for(const name of Object.keys(assets).filter(x=>x!=='index.html')){
  await page.route('**/'+name+'*',r=>r.fulfill({status:200,contentType:name.endsWith('.css')?'text/css':'text/javascript',body:assets[name]}));
 }
 await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
 const appReady=()=>window.CAST_PUBLIC&&document.querySelectorAll('#v5Stack .v5-item:not(.v6-rail-ghost)').length===4;
 try{await page.waitForFunction(appReady,null,{timeout:25000})}
 catch{
   // Published data is fetched from the public endpoint; one transient network
   // error should not be confused with a JavaScript regression.
   const diagnostic=await page.evaluate(()=>({
     publicApi:!!window.CAST_PUBLIC,
     dataBridge:!!window.CAST_DATA,
     portraits:document.querySelectorAll('#v5Stack .v5-item').length,
     alert:document.querySelector('[role="alert"]')?.textContent?.slice(0,150),
     url:location.href
   }));
   console.warn('INITIAL LOAD RETRY',JSON.stringify({diagnostic,errors}));
   await page.reload({waitUntil:'domcontentloaded',timeout:60000});
   try{await page.waitForFunction(appReady,null,{timeout:25000})}
   catch{
     const diagnostics=await page.evaluate(()=>({
       publicApi:!!window.CAST_PUBLIC,portraits:document.querySelectorAll('#v5Stack .v5-item').length,
       alert:document.querySelector('[role="alert"]')?.textContent?.slice(0,150)
     }));
     throw Error('PUBLIC DATA OR APP FAILED TO INITIALIZE '+JSON.stringify({diagnostics,errors}));
   }
 }
 if(moreCast){
  await page.evaluate(()=>{
   const api=window.CAST_DATA, original=api.getPublished();
   if(original.characters.filter(c=>c.published!==false).length<32){
    const first=original.characters.find(c=>c.published!==false)||original.characters[0];
    const clones=Array.from({length:32-original.characters.filter(c=>c.published!==false).length},(_,i)=>({...first,id:'v18-fixture-'+i,name:'テスト選択 '+(i+1),roman:'TEST FILE '+i,published:true,firstPublishedAt:''}));
    const augmented={...original,characters:[...original.characters,...clones]};
    api.getPublished=()=>JSON.parse(JSON.stringify(augmented));
    window.CAST_PUBLIC.refresh('published');
   }
  });
  await page.waitForFunction(()=>document.querySelectorAll('#pickerStrip [data-person]').length>=32,null,{timeout:20000});
 }
 await page.evaluate(async()=>{await document.fonts.ready;});
 return {page,errors};
}
async function selected(page){return page.locator('#pickerStrip [data-person][aria-selected="true"]').getAttribute('data-person')}
async function waitIndex(page,i){await page.waitForFunction(n=>document.querySelector('#v5Count')?.textContent?.trim().startsWith(String(n).padStart(2,'0')+' /'),i,{timeout:10000})}
async function runRail(w,h){
 const {page,errors}=await pageFor(w,h,{moreCast:true});
 const tag=w+'x'+h;
 const count=await page.locator('#pickerStrip [data-person]').count();
 assert.ok(count>=32);
 const c0=await selected(page);
 await page.screenshot({path:dir+'/'+tag+'-RAIL-REST.png',animations:'disabled'});
 const allCast=page.locator('#v5Stack .v5-allcast');
 const bgRest=await allCast.evaluate(el=>getComputedStyle(el).backgroundColor);
 await allCast.hover();
 await page.waitForTimeout(90);
 const bgHover=await allCast.evaluate(el=>getComputedStyle(el).backgroundColor);
 assert.equal(bgHover,'rgb(20, 29, 33)','ALL CAST should invert to charcoal');
 assert.notEqual(bgHover,bgRest,'ALL CAST hover must change color');
 const labelHover=await allCast.locator('.v155-action-text strong').evaluate(el=>getComputedStyle(el).color);
 const smallHover=await allCast.locator('.v155-action-text small').evaluate(el=>getComputedStyle(el).color);
 assert.equal(labelHover,'rgb(234, 255, 85)','ALL CAST hover label must be readable yellow');
 assert.equal(smallHover,'rgb(234, 255, 85)','ALL CAST hover sublabel must be readable yellow');
 await page.screenshot({path:dir+'/'+tag+'-ALLCAST-HOVER.png',animations:'disabled'});
 await page.mouse.move(1,1);
 await page.locator('#v5BatchNext').click();
 await waitIndex(page,2);
 await page.waitForTimeout(90);
 const stepMotion=await page.locator('#v5Stack .v5-item[data-slot="3"]:not(.v6-rail-ghost)').evaluate(el=>el.getAnimations().length);
 assert.ok(stepMotion>0,'Single-step upper arrow did not animate');
 await page.waitForTimeout(460);
 await page.locator('#v5BatchNext').click({modifiers:['Shift']});
 await waitIndex(page,6);
 await page.waitForTimeout(90);
 const jumpMotion=await page.locator('#v5Stack .v5-item[data-slot="3"]:not(.v6-rail-ghost)').evaluate(el=>el.getAnimations().length);
 assert.ok(jumpMotion>0,'Shift+upper arrow (4 files) did not animate');
 await page.waitForTimeout(470);
 // Top card is 3 places ahead. A direct click must select it in one action.
 const topId=await page.locator('#v5Stack .v5-item[data-slot="0"]').getAttribute('data-person');
 await page.evaluate(()=>{
   window.__selectionHistory=[];
   const strip=document.getElementById('pickerStrip');
   new MutationObserver(()=>{
    const x=strip.querySelector('[aria-selected="true"]');
    if(x)window.__selectionHistory.push(x.dataset.person);
   }).observe(strip,{childList:true});
 });
 await page.locator('#v5Stack .v5-item[data-slot="0"] .v5-card').click();
 await page.waitForFunction(id=>document.querySelector('#pickerStrip [aria-selected="true"]')?.dataset.person===id,topId,{timeout:10000});
 await page.waitForTimeout(100);
 const direct=await page.evaluate(()=>window.__selectionHistory);
 assert.deepEqual([...new Set(direct)],[topId],'Top-card click must not tour intermediate portraits');
 const directMotion=await page.locator('#v5Stack .v5-item[data-slot="3"]:not(.v6-rail-ghost)').evaluate(el=>el.getAnimations().length);
 assert.ok(directMotion>0,'One-shot selected card animation missing');
 await page.screenshot({path:dir+'/'+tag+'-DIRECT-CLICK.png',animations:'disabled'});
 await page.waitForTimeout(470);
 // Keyboard now follows vertical card arrangement, with Shift+↑ as four.
 const before=await selected(page);
 await page.keyboard.press('ArrowDown');
 await page.waitForFunction(x=>document.querySelector('#pickerStrip [aria-selected="true"]')?.dataset.person!==x,before,{timeout:10000});
 await page.waitForTimeout(390);
 const beforeShift=await page.locator('#v5Count').textContent();
 await page.keyboard.press('Shift+ArrowUp');
 await page.waitForFunction(x=>document.querySelector('#v5Count')?.textContent!==x,beforeShift,{timeout:10000});
 // Select a character near the bottom of a large roster to exercise automatic
 // scrolling. Temporary test characters live only inside this browser.
 const lastId=await page.locator('#pickerStrip [data-person]').last().getAttribute('data-person');
 await page.evaluate(id=>window.CAST_PUBLIC.openCharacter(id),lastId);
 await page.locator('#dossier.open').waitFor();
 await page.locator('#dossier .panel-close').click();
 const marked=await selected(page);
 assert.equal(marked,lastId);
 await page.waitForTimeout(450);
 await page.locator('#v5Stack .v5-allcast').click();
 await page.locator('#directory.open').waitFor();
 await page.waitForTimeout(150);
 const active=await page.locator('#directoryItems .is-current-cast[aria-current="true"]').count();
 assert.equal(active,1,'ALL CAST should have one selected-current marker');
 const activeId=await page.locator('#directoryItems .is-current-cast').getAttribute('data-pick');
 assert.equal(activeId,marked);
 const visible=await page.locator('#directoryItems .is-current-cast').evaluate(el=>{
  const r=el.getBoundingClientRect(),view=document.getElementById('directoryItems').getBoundingClientRect();
  return r.top>=view.top-10&&r.bottom<=view.bottom+10;
 });
 assert.ok(visible,'Current ALL CAST card should be scrolled into view');
 const rosterScroll=await page.locator('#directoryItems').evaluate(el=>el.scrollTop);
 assert.ok(rosterScroll>100,'Large ALL CAST roster did not scroll to current character: '+rosterScroll);
 await page.screenshot({path:dir+'/'+tag+'-ALLCAST-CURRENT.png',animations:'disabled'});
 assert.deepEqual(errors,[],'Unexpected page JS exceptions');
 findings.push({tag,count,c0,bgRest,bgHover,stepMotion,jumpMotion,directMotion,directHistory:direct,activeId,visible,rosterScroll,errors});
 await page.close();
 console.log('PASS RAIL '+tag+' '+JSON.stringify({count,stepMotion,jumpMotion,directMotion,bgHover,activeId}));
}
async function runWorld(w,h){
 const {page,errors}=await pageFor(w,h);
 const tag=w+'x'+h;
 if(w<=800){
   await page.locator('#mobileMenuToggle').click();
   await page.locator('#mobileNav [data-nav="worlds"]').click();
 }else await page.locator('#nav-worlds').click();
 await page.locator('#worldsPanel.open #worldCards .ws5-card').first().click();
 await page.locator('#worldDetailPanel.open .wd4-center').waitFor();
 await page.locator('#worldDetailContent .world-cast-card').first().scrollIntoViewIfNeeded();
 const scroll=await page.locator('#worldDetailContent').evaluate(el=>el.scrollTop);
 const worldTitle=await page.locator('#worldDetailPanel .world-detail-hero h2').textContent();
 await page.locator('#worldDetailContent .world-cast-card').first().click();
 await page.locator('#dossier.open').waitFor();
 const btn=page.locator('#dossier .dossier-head .panel-close');
 await btn.waitFor({state:'visible'});
 assert.equal(await page.locator('#dossier .dossier-head button').count(),1,'PROFILE must have only one BACK action');
 assert.ok((await btn.textContent()).includes(worldTitle),'Single BACK action should name originating WORLD');
 assert.ok((await btn.getAttribute('aria-label')).includes('世界観詳細'),'WORLD return needs a clear accessible label');
 await page.screenshot({path:dir+'/'+tag+'-WORLD-RETURN.png',animations:'disabled'});
 await btn.click();
 await page.locator('#worldDetailPanel.open').waitFor();
 await page.waitForTimeout(150);
 const after=await page.locator('#worldDetailContent').evaluate(el=>el.scrollTop);
 assert.ok(Math.abs(after-scroll)<4,'WORLD scroll location was not restored: '+scroll+' -> '+after);
 // The same contextual return must work with Escape after reopening.
 await page.locator('#worldDetailContent .world-cast-card').first().scrollIntoViewIfNeeded();
 await page.locator('#worldDetailContent .world-cast-card').first().click();
 await page.locator('#dossier.open').waitFor();
 await page.keyboard.press('Escape');
 await page.locator('#worldDetailPanel.open').waitFor();
 // A normal, direct SELECT route must keep the original BACK TO SELECT label.
 const firstId=await page.locator('#pickerStrip [data-person]').first().getAttribute('data-person');
 await page.evaluate(id=>window.CAST_PUBLIC.openCharacter(id),firstId);
 await page.locator('#dossier.open').waitFor();
 assert.ok((await btn.textContent()).includes('BACK TO SELECT'),'Normal PROFILE must return to SELECT');
 assert.equal(await page.locator('#dossier .dossier-head button').count(),1,'Normal PROFILE has one BACK action too');
 await btn.click();
 await page.waitForFunction(()=>document.getElementById('dossier').getAttribute('aria-hidden')==='true');
 assert.deepEqual(errors,[]);
 findings.push({tag,worldTitle,scroll,after,returnVisible:true});
 await page.close();
 console.log('PASS WORLD '+tag+' '+JSON.stringify({worldTitle,scroll,after}));
}
try{
 await runRail(1920,911);
 await runRail(2560,1271);
 await runWorld(1920,911);
 await runWorld(390,844);
 writeFileSync(dir+'/metrics.json',JSON.stringify(findings,null,2));
 console.log('ALL V18 UX TESTS PASSED');
}finally{await browser.close()}
