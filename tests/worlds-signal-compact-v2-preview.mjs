import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
const SITE='https://mazimuri.github.io/';
const css=readFileSync('tests/worlds-signal-compact-v2.css','utf8');
const folder='worlds-signal-compact-v2-review';
mkdirSync(folder,{recursive:true});
const browser=await chromium.launch();
const metrics=[];
const openPanel=async(page)=>page.waitForFunction(()=>{
  return document.querySelector('#worldCards .world-card')!==null
    && document.getElementById('worldsPanel')?.classList.contains('open');
},null,{timeout:20000});
async function capture(width,height){
 const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,reducedMotion:'reduce'});
 page.on('pageerror',err=>console.log('PAGE ERROR '+err.message.slice(0,160)));
 await page.goto(SITE,{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>document.getElementById('heroIntel')?.hidden===false&&document.getElementById('heroBio')?.textContent?.trim().length>15,null,{timeout:35000});
 if(width>800){
  await page.locator('#nav-worlds').click();
 }else{
  await page.locator('#mobileMenuToggle').click();
  await page.locator('#mobileNav [data-nav="worlds"]').click();
 }
 await openPanel(page);
 await page.waitForFunction(()=>[...document.querySelectorAll('#worldCards .world-card img')].every(img=>img.complete&&img.naturalWidth>0),null,{timeout:25000});
 await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.querySelectorAll('#worldCards img')].map(i=>i.decode().catch(()=>{})))});
 await page.waitForTimeout(350);
 await page.screenshot({path:folder+'/'+width+'x'+height+'-INDEX-before.png',animations:'disabled'});
 const style=await page.addStyleTag({content:css});
 await page.waitForTimeout(200);
 await page.screenshot({path:folder+'/'+width+'x'+height+'-INDEX-after.png',animations:'disabled'});
 const info=await page.evaluate(()=>{
  const panel=document.getElementById('worldsPanel'),worlds=[...document.querySelectorAll('#worldCards .world-card')];
  return {worlds:worlds.length,title:worlds[0]?.querySelector('strong')?.textContent,viewport:[innerWidth,innerHeight],
   firstRect:(r=>({x:r.x,y:r.y,w:r.width,h:r.height}))(worlds[0].getBoundingClientRect()),
   scrollWidth:panel.querySelector('.directory-content').scrollWidth,clientWidth:panel.querySelector('.directory-content').clientWidth};
 });
 assert.ok(info.worlds>=1,'No real WORLD found');
 if(width>=1900){
   const colCount=await page.evaluate(()=>getComputedStyle(document.getElementById('worldCards')).gridTemplateColumns.split(' ').length);
   assert.equal(colCount,3,'WORLD SELECT must show three columns at desktop viewport');
 }

 assert.ok(info.scrollWidth<=info.clientWidth+5,'World index content overflows horizontally');
 await page.locator('#worldCards .world-card').first().click();
 await page.locator('#worldDetailPanel.open').waitFor();
 await page.waitForFunction(()=>{
  const p=document.getElementById('worldDetailContent');
  return p?.querySelectorAll('.world-story-entry').length>=1&&p.querySelectorAll('.world-cast-card').length>=1;
 },null,{timeout:22000});
 await page.evaluate(async()=>{
   await Promise.all([...document.querySelectorAll('#worldDetailContent img')].map(i=>i.decode().catch(()=>{})));
 });
 await page.waitForTimeout(200);
 await page.screenshot({path:folder+'/'+width+'x'+height+'-DETAIL-after-hero.png',animations:'disabled'});
 const detail=await page.evaluate(()=>{
  const content=document.getElementById('worldDetailContent');
  return {stories:content.querySelectorAll('.world-story-entry').length,
   cast:content.querySelectorAll('.world-cast-card').length,
   viewWidth:content.clientWidth,scrollWidth:content.scrollWidth,
   heroHeight:content.querySelector('.world-detail-hero')?.getBoundingClientRect().height};
 });
 assert.ok(detail.scrollWidth<=detail.viewWidth+5,'World detail content overflows horizontally');
 if(width===1920){assert.ok(detail.heroHeight<345,'Full HD WORLD detail hero too tall: '+detail.heroHeight);}
 if(width===2560){assert.ok(detail.heroHeight<425,'2K WORLD detail hero too tall: '+detail.heroHeight);}
 await page.evaluate(()=>document.getElementById('worldDetailContent').scrollTop=325);
 await page.waitForTimeout(200);
 await page.screenshot({path:folder+'/'+width+'x'+height+'-DETAIL-after-stories.png',animations:'disabled'});
 await style.evaluate(e=>e.remove());
 await page.evaluate(()=>document.getElementById('worldDetailContent').scrollTop=0);
 await page.waitForTimeout(180);
 await page.screenshot({path:folder+'/'+width+'x'+height+'-DETAIL-before-hero.png',animations:'disabled'});
 await page.evaluate(()=>document.getElementById('worldDetailContent').scrollTop=325);
 await page.waitForTimeout(180);
 await page.screenshot({path:folder+'/'+width+'x'+height+'-DETAIL-before-stories.png',animations:'disabled'});
 metrics.push({width,height,index:info,detail});
 console.log('WORLD PAGE '+width+'x'+height+' '+JSON.stringify({index:info,detail}));
 await page.close();
}
try{
 for(const [w,h] of [[1920,911],[2560,1271],[390,844]])await capture(w,h);
 writeFileSync(folder+'/metrics.json',JSON.stringify(metrics,null,2));
 console.log('WORLD COMPACT 3-COLUMN V2 VISUAL STUDY PASS');
}finally{await browser.close();}
