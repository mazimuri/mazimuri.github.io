import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
const SITE='https://mazimuri.github.io/';
const assets={
  'index.html':readFileSync('index.html','utf8'),
  'app.js':readFileSync('app.js','utf8'),
  'cast-worlds-current.css':readFileSync('cast-worlds-current.css','utf8'),
};
const out='worlds-v5-v4-implementation-review';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch();
const results=[];
const geom=el=>{const x=el.getBoundingClientRect();return {x:+x.x.toFixed(1),y:+x.y.toFixed(1),w:+x.width.toFixed(1),h:+x.height.toFixed(1)}};
async function prepare(width,height){
 const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,reducedMotion:'reduce'});
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route(SITE,r=>r.fulfill({status:200,contentType:'text/html; charset=utf-8',body:assets['index.html']}));
 for(const name of ['app.js','cast-worlds-current.css']){
   await page.route('**/'+name+'*',r=>r.fulfill({status:200,contentType:name.endsWith('.css')?'text/css':'text/javascript',body:assets[name]}));
 }
 await page.goto(SITE,{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>document.getElementById('heroBio')?.textContent?.trim().length>15&&document.querySelector('#v5Stack .v5-item'),null,{timeout:40000});
 if(width>800)await page.locator('#nav-worlds').click();
 else {
  await page.locator('#mobileMenuToggle').click();
  await page.locator('#mobileNav [data-nav="worlds"]').click();
 }
 await page.waitForFunction(()=>document.querySelector('#worldsPanel.open #worldCards .ws5-card')!==null,null,{timeout:20000});
 await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.querySelectorAll('#worldCards img')].map(img=>img.decode().catch(()=>{})))});
 return {page,errors};
}
async function run(width,height){
 const {page,errors}=await prepare(width,height);
 const tag=width+'x'+height;
 const world=await page.evaluate(()=>{
   const panel=document.querySelector('#worldsPanel .directory-content');
   const grid=document.getElementById('worldCards');
   const cards=[...grid.querySelectorAll('.ws5-card')];
   const g=grid.getBoundingClientRect();
   return {
    count:cards.length,
    columns:getComputedStyle(grid).gridTemplateColumns.split(' ').length,
    grid:{x:g.x,y:g.y,w:g.width,h:g.height},
    cards:cards.map(el=>{const x=el.getBoundingClientRect();return {title:el.querySelector('.ws5-name').textContent,w:x.width,h:x.height,visible:x.top<innerHeight&&x.bottom>0,action:el.querySelector('.ws5-action').textContent.trim()}}),
    contentWidth:panel.scrollWidth,innerWidth:panel.clientWidth,
    windowWidth:document.documentElement.scrollWidth
   };
 });
 assert.ok(world.count>=3,'Expected three published worlds, found '+world.count);
 assert.ok(world.cards.every(c=>c.action.includes('OPEN WORLD FILE')),'Missing world action');
 assert.ok(world.contentWidth<=world.innerWidth+3,'WORLD SELECT horizontal overflow '+tag);
 if(width>=1900){
   assert.equal(world.columns,3,'WORLD SELECT must remain three columns '+tag);
   assert.ok(world.cards.slice(0,3).every(c=>c.visible),'Three world cards should be visible initially '+tag);
 }
 if(width<=800)assert.equal(world.columns,1,'Mobile WORLD SELECT should be one column');
 await page.screenshot({path:out+'/'+tag+'-SELECT.png',animations:'disabled'});
 await page.locator('#worldCards .ws5-card').first().hover();
 const hover=await page.locator('#worldCards .ws5-card').first().evaluate(el=>getComputedStyle(el).borderTopColor);
 assert.match(hover,/rgb\(234, 255, 85\)/,'WORLD selected hover outline should be yellow '+tag);
 await page.mouse.move(2,2);
 await page.locator('#worldCards .ws5-card').first().click();
 await page.locator('#worldDetailPanel.open .wd4-dossier').waitFor({timeout:20000});
 await page.evaluate(async()=>{await Promise.all([...document.querySelectorAll('#worldDetailContent img')].map(img=>img.decode().catch(()=>{})))});
 const detail=await page.evaluate(()=>{
   const root=document.getElementById('worldDetailContent');
   const hero=root.querySelector('.wd4-hero').getBoundingClientRect();
   const title=root.querySelector('.world-detail-hero h2').textContent;
   const desc=root.querySelector('.wd4-description').textContent;
   const main=root.querySelector('.wd4-main-story');
   const list=root.querySelector('.world-story-list');
   const descBox=root.querySelector('.wd4-brief').getBoundingClientRect();
   const scrollWidth=root.scrollWidth;
   return {title,descriptionLength:desc.length,heroHeight:hero.height,briefHeight:descBox.height,storyCount:list.children.length,
    mainCount:root.querySelectorAll('.wd4-main-story').length,
    sideCount:root.querySelectorAll('.wd4-side-story').length,castCount:root.querySelectorAll('.world-cast-card').length,
    visibleStoryTitle:!!main?.querySelector('.world-story-info b'),
    storyButtons:[...root.querySelectorAll('.wd4-side-play.clickable')].length,
    directMainLinks:root.querySelectorAll('.world-primary-link').length,
    mainLink:main?.querySelector('a.world-story-item')?.getAttribute('href'),
    scrollWidth,clientWidth:root.clientWidth,
    mainTop:main?.getBoundingClientRect().top};
 });
 assert.equal(detail.title,'ロジエ邸','Expected correct WORLD Detail selected '+tag);
 assert.ok(detail.descriptionLength>15,'World briefing was lost '+tag);
 assert.equal(detail.storyCount,4,'Should preserve all four stories '+tag);
 assert.equal(detail.mainCount,1,'Main story lost '+tag);
 assert.equal(detail.sideCount,3,'Side story lost '+tag);
 assert.equal(detail.castCount,4,'Connected cast lost '+tag);
 assert.equal(detail.storyButtons,3,'Side story links missing '+tag);
 assert.equal(detail.directMainLinks,0,'Duplicate main link on differing share ID '+tag);
 assert.ok(detail.mainLink?.includes('zeta-ai.io'),'Main story external URL missing '+tag);
 assert.ok(detail.scrollWidth<=detail.clientWidth+3,'WORLD detail has horizontal overflow '+tag);
 if(width>=1900)assert.ok(detail.mainTop<height+60,'Main story not discoverable near first viewport '+tag);
 await page.screenshot({path:out+'/'+tag+'-DETAIL-TOP.png',animations:'disabled'});
 await page.locator('#worldDetailContent [data-world-story-jump]').click();
 await page.waitForTimeout(850);
 const afterJump=await page.locator('#wd4Stories').evaluate(el=>el.getBoundingClientRect().top);
 assert.ok(afterJump<230,'VIEW STORIES failed to scroll '+tag+': '+afterJump);
 await page.screenshot({path:out+'/'+tag+'-STORIES.png',animations:'disabled'});
 // Preserve exact links and character navigation without leaving the website.
 const exact=await page.locator('.wd4-side-play.clickable').first().getAttribute('href');
 assert.ok(exact.startsWith('https://zeta-ai.io/'),'Side plot URL missing '+tag);
 const cast=page.locator('#worldDetailContent .world-cast-card').first();
 await cast.scrollIntoViewIfNeeded();
 await cast.click();
 await page.locator('#dossier.open').waitFor({timeout:15000});
 const chosen=await page.locator('#dossierContent').textContent();
 assert.ok(chosen.includes('オルフェ'),'Linked character dossier not opened');
 results.push({tag,world,detail,jumpTop:afterJump,castNavigation:true,errors});
 assert.deepEqual(errors,[], 'Unexpected page JS error: '+JSON.stringify(errors));
 await page.close();
 console.log('PASS '+tag+' '+JSON.stringify({worldCards:world.count,cols:world.columns,storyCount:detail.storyCount,castCount:detail.castCount,heroH:detail.heroHeight,briefH:detail.briefHeight,overflow:detail.scrollWidth-detail.clientWidth}));
}
try{
  for(const [w,h] of [[1920,911],[2560,1271],[390,844]])await run(w,h);
  writeFileSync(out+'/metrics.json',JSON.stringify(results,null,2));
  console.log('ALL WORLD V5/V4 IMPLEMENTATION TESTS PASSED');
}finally{await browser.close();}
