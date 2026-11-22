import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';

const BASE='https://mazimuri.github.io/';
const assets=Object.fromEntries(['index.html','app.js','cast-allcast-current.css','cast-rail-current.css'].map(f=>[f,readFileSync(f,'utf8')]));
const admin=readFileSync('admin.js','utf8');
const output='allcast-v2-character-deck-review';
mkdirSync(output,{recursive:true});
const browser=await chromium.launch();
const report=[];
const EXPECT={right:9.051756007393713,top:14.186685998241362};

function near(a,b,t=.03){return Math.abs(a-b)<=t}
for(const file of ['app.js','admin.js']){
 const source=readFileSync(file,'utf8');
 assert.ok(source.includes('9.051756007393713') && source.includes('14.186685998241362'),'Orphe desktop badge default missing in '+file);
}
assert.ok(admin.includes("c.fileBadgePosition?.right??BADGE_DESKTOP_DEFAULT.right"),'Editor badge preview must honor default');
assert.ok(admin.includes("fileBadgePosition:{...BADGE_DESKTOP_DEFAULT}"),'New character should use approved default');

async function inspect(width,height){
 const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,reducedMotion:'reduce'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route(BASE,r=>r.fulfill({status:200,contentType:'text/html; charset=utf-8',body:assets['index.html']}));
 for(const [file,source] of Object.entries(assets).filter(([file])=>file!=='index.html')){
   await page.route('**/'+file+'*',r=>r.fulfill({status:200,contentType:file.endsWith('.css')?'text/css':'text/javascript',body:source}));
 }
 await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>window.CAST_PUBLIC&&document.querySelectorAll('#v5Stack .v5-item:not(.v6-rail-ghost)').length===4,null,{timeout:40000});
 await page.evaluate(async()=>{await document.fonts.ready});
 if(width<=800){
   await page.locator('#mobileMenuToggle').click();
   await page.locator('#mobileNav [data-nav="index"]').click();
 }else await page.locator('#nav-index').click();
 await page.waitForFunction(()=>document.querySelector('#directory.open .cast-gallery-card')!==null,null,{timeout:14000});
 await page.evaluate(async()=>await Promise.all([...document.querySelectorAll('#directoryItems img')].map(el=>el.decode().catch(()=>{}))));
 await page.waitForFunction(()=>{
   const img=document.querySelector('#directoryItems .cast-gallery-card img');
   return img?.naturalWidth>0;
 },null,{timeout:20000});
 const tag=width+'x'+height;
 const read=()=>page.evaluate(()=>{
   const gallery=document.getElementById('directoryItems');
   const shell=document.getElementById('allcastRosterShell');
   const cards=[...gallery.querySelectorAll('.cast-gallery-card')];
   const first=cards[0],plate=first?.querySelector('.cast-gallery-nameplate');
   const photo=first?.querySelector('img'),role=first?.querySelector('.cast-gallery-role');
   const badge=first?.querySelector('.zeta-badge');
   const rect=first?.getBoundingClientRect();
   const deck=document.querySelector('.allcast-deck-top');
   return {
     count:cards.length,
     cols:getComputedStyle(gallery).gridTemplateColumns.split(' ').length,
     card:rect?{width:rect.width,height:rect.height}:null,
     plate:plate?getComputedStyle(plate).backgroundColor:null,
     text:first?getComputedStyle(first.querySelector('.cast-gallery-name')).color:null,
     role:role?getComputedStyle(role).color:null,
     roleVisible:role?getComputedStyle(role).display!=='none':false,
     badge:badge?{display:getComputedStyle(badge).display,font:parseFloat(getComputedStyle(badge).fontSize)}:null,
     loaded:photo?.naturalWidth>0,
     crop:photo?{objectFit:getComputedStyle(photo).objectFit,transform:getComputedStyle(photo).transform}:null,
     overflow:gallery.scrollWidth-gallery.clientWidth,
     shellWidth:shell.getBoundingClientRect().width,
     directoryWidth:document.querySelector('.cast-directory-content').scrollWidth,
     winWidth:document.querySelector('.cast-directory-content').clientWidth,
     selectedCount:gallery.querySelectorAll('.is-current-cast').length,
     deckBarVisible:getComputedStyle(deck).display!=='none',
     countText:document.getElementById('allcastDeckTotal').textContent,
     pageOverflow:document.documentElement.scrollWidth-innerWidth
   };
 });
 const base=await read();
 assert.equal(base.count,4,'Expected four current public characters');
 assert.ok(base.loaded,'Character image failed to load');
 assert.equal(base.plate,'rgb(240, 240, 232)','PAPER plate not applied '+tag);
 assert.equal(base.text,'rgb(20, 25, 28)','Name not dark enough '+tag);
 assert.ok(base.roleVisible,'Character role hidden under PAPER plate');
 assert.ok(base.selectedCount===1,'Current cast indicator missing');
 assert.ok(base.pageOverflow<=3,'Document horizontal overflow '+tag);
 assert.ok(base.overflow<=3,'Gallery overflow horizontally '+tag);
 if(width>=1500){
   assert.equal(base.cols,6,'Desktop six-column gallery changed '+tag);
   const expect=Math.min(202,Math.max(151,width*.078646));
   assert.ok(near(base.card.width,expect,2),'Card width no longer matches established size '+tag+': '+base.card.width);
   assert.ok(base.deckBarVisible,'Character deck status bar missing '+tag);
   assert.ok(base.badge?.font>=9,'Status badge illegible '+tag);
 }else if(width<=800) assert.equal(base.cols,2,'Mobile two-column grid changed '+tag);
 await page.screenshot({path:output+'/'+tag+'-FOUR.png',animations:'disabled'});
 // Current SELECT remains immediately findable.
 assert.ok((await page.locator('#directoryItems .is-current-cast .cast-gallery-current').count())===1);
 if(width>=801){
  const first=page.locator('#directoryItems .cast-gallery-card').first();
  await first.hover();
  const hover=await first.evaluate(el=>getComputedStyle(el).borderTopColor);
  assert.equal(hover,'rgb(237, 255, 85)','Yellow hover lost '+tag);
  await page.mouse.move(4,4);
 }
 // The DETAIL view is intentionally unchanged.
 await page.locator('[data-directory-view="detail"]').click();
 const detail=await page.locator('#directoryItems').evaluate(el=>({className:el.className,cards:el.querySelectorAll('.directory-item').length,deckBar:getComputedStyle(document.querySelector('.allcast-deck-top')).display}));
 assert.equal(detail.cards,4);
 assert.equal(detail.deckBar,'none','Deck header must not leak into DETAIL');
 await page.locator('[data-directory-view="gallery"]').click();
 await page.waitForTimeout(100);
 // Search and filters remain active.
 if(width<=800)await page.locator('#mobileFilterToggle').click();
 await page.locator('#search').fill('オルフェ');
 await page.waitForTimeout(90);
 assert.equal(await page.locator('#directoryItems .cast-gallery-card').count(),1,'Search stopped working');
 await page.locator('#search').fill('');
 await page.waitForTimeout(90);
 assert.equal(await page.locator('#directoryItems .cast-gallery-card').count(),4);
 if(width>=801){
  await page.evaluate(()=>{
   const gallery=document.getElementById('directoryItems');
   const nodes=[...gallery.querySelectorAll('.cast-gallery-card')];
   for(let i=4;i<48;i++){
     const el=nodes[i%nodes.length].cloneNode(true);
     el.dataset.pick='mock-'+String(i);
     el.removeAttribute('aria-current');
     el.classList.remove('is-current-cast');
     el.querySelector('.cast-gallery-current')?.remove();
     el.querySelector('.cast-gallery-number').textContent='FILE / '+String(i+1).padStart(3,'0');
     el.querySelectorAll('img').forEach(img=>img.loading='eager');
     gallery.appendChild(el);
   }
   document.getElementById('allcastDeckTotal').textContent='48 / CHARACTER FILES (LAYOUT TEST)';
   document.getElementById('directoryCount').textContent='48 FILES MATCH';
 });
  await page.evaluate(async()=>await Promise.all([...document.querySelectorAll('#directoryItems img')].slice(0,14).map(el=>el.decode().catch(()=>{}))));
  const many=await read();
  assert.equal(many.count,48,'48 file stress fixture failed');
  assert.ok(many.cols===6,'Density changed with more files');
  assert.ok((await page.locator('#directoryItems').evaluate(el=>el.scrollHeight-el.clientHeight))>50,'48 should scroll inside deck');
  await page.screenshot({path:output+'/'+tag+'-FORTYEIGHT.png',animations:'disabled'});
  await page.locator('#directoryItems').evaluate(el=>el.scrollTop=el.scrollHeight);
  await page.screenshot({path:output+'/'+tag+'-FORTYEIGHT-BOTTOM.png',animations:'disabled'});
 }
 assert.deepEqual(errors,[],'Browser exceptions '+tag+' '+JSON.stringify(errors));
 report.push({tag,base,errors});
 console.log('PASS ALL CAST V2 '+tag+' '+JSON.stringify({cols:base.cols,width:base.card.width,plate:base.plate,role:base.role,deckBar:base.deckBarVisible}));
 await page.close();
}
try{
 for(const [w,h] of [[1920,911],[2560,1271],[390,844]])await inspect(w,h);
 writeFileSync(output+'/metrics.json',JSON.stringify(report,null,2));
 console.log('ALL CHARACTER DECK V2 VISUAL TESTS PASSED');
}finally{await browser.close()}
