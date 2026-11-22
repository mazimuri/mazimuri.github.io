import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';

const SITE='https://mazimuri.github.io/';
const html=readFileSync('index.html','utf8');
const branchAssets={
  'app.js':readFileSync('app.js','utf8'),
  'cast-side-rail.css':readFileSync('cast-side-rail.css','utf8'),
  'cast-allcast-current.css':readFileSync('cast-allcast-current.css','utf8'),
  'style.css':readFileSync('style.css','utf8')
};
mkdirSync('allcast-zzz-implementation-review',{recursive:true});
const browser=await chromium.launch();
const metrics=[];
async function pageAt(width,height){
 const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,reducedMotion:'reduce'});
 await page.route(SITE,r=>r.fulfill({status:200,contentType:'text/html; charset=utf-8',body:html}));
 for(const [file,content] of Object.entries(branchAssets)){
   await page.route('**/'+file+'*',r=>r.fulfill({status:200,contentType:file.endsWith('.css')?'text/css':'text/javascript',body:content}));
 }
 await page.goto(SITE,{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>{
   return document.getElementById('heroIntel')?.hidden===false
     && (document.getElementById('heroBio')?.textContent?.trim()?.length||0)>15
     && document.querySelector('#v5Stack .v5-item');
 },null,{timeout:35000});
 if(width<=800){
   await page.locator('#mobileMenuToggle').click();
   await page.locator('#mobileNav [data-nav="index"]').click();
 }else{
   await page.locator('#nav-index').click();
 }
 await page.waitForFunction(()=>document.querySelector('#directory.open .cast-gallery-card')!==null,null,{timeout:15000});
 await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.querySelectorAll('#directoryItems .cast-gallery-card img')].map(i=>i.decode().catch(()=>{})))});
 return page;
}
const geom=()=>{};
async function values(page,label,expectedCount){
 await page.waitForTimeout(200);
 const m=await page.evaluate(()=>{
  const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom}};
  const gallery=document.getElementById('directoryItems'),shell=document.getElementById('allcastRosterShell'),footer=document.getElementById('allcastRosterFooter'),first=gallery.querySelector('.cast-gallery-card'),img=first?.querySelector('img'),badge=gallery.querySelector('.cast-gallery-badges .zeta-badge');
  return {viewport:[innerWidth,innerHeight],gallery:rect(gallery),shell:rect(shell),first:first?rect(first):null,
   count:gallery.querySelectorAll('.cast-gallery-card').length,
   columns:getComputedStyle(gallery).gridTemplateColumns.split(' ').length,
   scrollHeight:gallery.scrollHeight,clientHeight:gallery.clientHeight,
   scrollWidth:gallery.scrollWidth,clientWidth:gallery.clientWidth,
   footerHidden:footer.hidden,scrollReadout:document.getElementById('allcastScrollReadout').textContent,
   imgFit:img&&getComputedStyle(img).objectFit,imgLoaded:img?.naturalWidth>0,
   badgeFont:badge&&getComputedStyle(badge).fontSize,
   shellDisplay:getComputedStyle(shell).display,
   bodyWidth:document.documentElement.scrollWidth};
 });
 assert.equal(m.count,expectedCount,'Unexpected count '+label);
 assert.ok(m.first&&m.first.width>80,'Missing gallery cards '+label);
 assert.ok(m.imgLoaded,'Main portrait not loaded '+label);
 assert.equal(m.imgFit,'cover','Portrait not cover '+label);
 assert.ok(m.bodyWidth<=m.viewport[0]+2,'Page overflows horizontally '+label);
 if(m.viewport[0]>=1500){
   assert.equal(m.columns,6,'6 column density lost '+label);
   const size=Math.min(202,Math.max(151,m.viewport[0]*.078646));
   assert.ok(Math.abs(m.first.width-size)<2,'Card size incorrect '+label+': '+m.first.width);
   assert.ok(parseFloat(m.badgeFont)>=9,'Badge unreadable '+label);
 }
 if(expectedCount===48 && m.viewport[0]>=801){
   assert.ok(m.scrollHeight>m.clientHeight+10,'48 cards should scroll inside frame '+label);
   assert.ok(!m.footerHidden,'Scroll footer missing '+label);
 }
 metrics.push({label,...m});console.log('RENDER '+label+' '+JSON.stringify(m));
 return m;
}
try{
 for(const [width,height] of [[1920,911],[2560,1271],[390,844]]){
  const page=await pageAt(width,height);
  const prefix=width+'x'+height;
  const before=await values(page,prefix+'-published',4);
  await page.screenshot({path:'allcast-zzz-implementation-review/'+prefix+'-4.png',fullPage:false,animations:'disabled'});
  if(width>=801){
    const card=page.locator('#directoryItems .cast-gallery-card').first();
    await card.hover();
    const hover=await card.evaluate(el=>getComputedStyle(el).borderTopColor);
    assert.ok(/rgb\(237, 255, 85\)/.test(hover)||/rgb\(234, 255, 82\)/.test(hover),'Yellow hover border absent: '+hover);
    await page.mouse.move(5,5);
    await page.evaluate(()=>{
      const grid=document.getElementById('directoryItems');
      const cards=[...grid.querySelectorAll('.cast-gallery-card')].map(c=>c.cloneNode(true));
      for(let i=4;i<48;i++){
        const c=cards[i%cards.length].cloneNode(true);
        const num=c.querySelector('.cast-gallery-number');
        if(num)num.textContent='FILE / '+String(i+1).padStart(3,'0');
        grid.appendChild(c);
      }
      document.getElementById('directoryCount').textContent='48 FILES MATCH';
      window.dispatchEvent(new Event('resize'));
    });
    const after=await values(page,prefix+'-48demo',48);
    await page.screenshot({path:'allcast-zzz-implementation-review/'+prefix+'-48.png',fullPage:false,animations:'disabled'});
    await page.locator('#directoryItems').evaluate(e=>e.scrollTop=e.scrollHeight);
    await page.waitForTimeout(200);
    const end=await page.locator('#allcastScrollReadout').textContent();
    assert.equal(end,'SCROLL 100%','Scroll progress incorrect '+prefix);
  }
  // Restore official render via filter event; ensure normal navigation unchanged.
  await page.locator('[data-directory-view="detail"]').click();
  await page.waitForFunction(()=>document.querySelector('#directoryItems.directory-detail .directory-item')!==null);
  await page.locator('[data-directory-view="gallery"]').click();
  await page.waitForFunction(()=>document.querySelectorAll('#directoryItems .cast-gallery-card').length===4);
  const first=page.locator('#directoryItems .cast-gallery-card').first();
  await first.click();
  // Original ALL CAST click chooses the character and returns to its SELECT
  // page; it does not open the PROFILE drawer immediately.
  await page.waitForFunction(()=>{
    return !document.getElementById('directory').classList.contains('open')
      && location.hash.startsWith('#char/');
  },null,{timeout:15000});
  console.log('NAVIGATION PASS '+prefix);
  await page.close();
 }
 writeFileSync('allcast-zzz-implementation-review/metrics.json',JSON.stringify(metrics,null,2));
 console.log('ALL CAST ZZZ REAL DATA RESPONSIVE TEST PASS');
}finally{await browser.close();}
