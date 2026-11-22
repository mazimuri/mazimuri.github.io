import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
const SITE='https://mazimuri.github.io/';
const css=readFileSync('tests/worlds-persona-zzz-v3.css','utf8');
const folder='worlds-persona-zzz-v3-review';
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
 // Preview-only structural adaptation. Keep real world text, story links, and
 // character data; move the existing one-sentence summary into a dedicated
 // reading panel. No changes to app.js, user data, or public website.
 await page.evaluate(()=>{
   const root=document.getElementById('worldDetailContent');
   const hero=root.querySelector('.world-detail-hero');
   const text=hero.querySelector('.world-detail-hero-content > p');
   const stats=hero.querySelector('.world-detail-stats');
   const intro=document.createElement('section');
   intro.className='w3-world-intro';
   const label=document.createElement('div');
   label.className='w3-intro-lead';
   label.textContent='WORLD BRIEF / 世界観の説明';
   const prose=document.createElement('div');
   prose.className='w3-intro-summary';
   prose.textContent=text?.textContent||'';
   const measures=document.createElement('div');
   measures.className='w3-intro-stats';
   if(stats)measures.innerHTML=stats.innerHTML;
   intro.append(label,prose,measures);
   hero.after(intro);
 });
 await page.mouse.move(5,5);
 await page.screenshot({path:folder+'/'+width+'x'+height+'-DETAIL-after-hero.png',animations:'disabled'});
 const detail=await page.evaluate(()=>{
  const content=document.getElementById('worldDetailContent');
  return {stories:content.querySelectorAll('.world-story-entry').length,
   cast:content.querySelectorAll('.world-cast-card').length,
   viewWidth:content.clientWidth,scrollWidth:content.scrollWidth,
   heroHeight:content.querySelector('.world-detail-hero')?.getBoundingClientRect().height};
 });
 assert.ok(detail.scrollWidth<=detail.viewWidth+5,'World detail content overflows horizontally');
 const introText=await page.locator('.w3-intro-summary').textContent();
 assert.ok(introText.trim().length>20,'World description missing from reading panel');
 const ctaContent=await page.locator('.world-story-entry:first-child .world-story-arrow').evaluate(e=>getComputedStyle(e,'::before').content);
 assert.ok(ctaContent.includes('zeta'),'Main story zeta CTA not explicit '+ctaContent);
 const mainHref=await page.locator('.world-story-entry:first-child .world-story-item').getAttribute('href');
 assert.ok(mainHref?.startsWith('https://zeta-ai.io/'),'Main story link changed or lost');
 const castVisible=await page.locator('.world-story-entry:first-child .world-story-cast-caption').evaluate(e=>getComputedStyle(e,'::before').content);
 assert.ok(castVisible.includes('登場キャラ'),'Characters label not visible');
 const storyOrder=await page.locator('.world-story-entry:first-child').evaluate(el=>{
   const title=el.querySelector('.world-story-item').getBoundingClientRect();
   const cast=el.querySelector('.world-story-cast').getBoundingClientRect();
   const arrow=el.querySelector('.world-story-arrow').getBoundingClientRect();
   return {titleBottom:title.bottom,castTop:cast.top,arrowBottom:arrow.bottom};
 });
 assert.ok(storyOrder.titleBottom<=storyOrder.castTop+4,
   'Title or play action must precede appearing cast: '+JSON.stringify(storyOrder));
 assert.ok(storyOrder.arrowBottom<=storyOrder.castTop+4,
   'Play button overlaps cast footer: '+JSON.stringify(storyOrder));

 if(width===1920){assert.ok(detail.heroHeight<height*.45,'Full HD WORLD detail hero consumes too much vertical space: '+detail.heroHeight);}
 if(width===2560){assert.ok(detail.heroHeight<height*.40,'2K WORLD detail hero consumes too much vertical space: '+detail.heroHeight);}
 if(width>=1900){
   const firstStoryTop=await page.locator('#worldDetailContent .world-story-entry').first().evaluate(el=>el.getBoundingClientRect().top);
   assert.ok(firstStoryTop<height-35,'No story visible in first viewport: '+firstStoryTop);
 }
 await page.evaluate(()=>document.getElementById('worldDetailContent').scrollTop=325);
 await page.waitForTimeout(200);
 await page.mouse.move(5,5);
 await page.screenshot({path:folder+'/'+width+'x'+height+'-DETAIL-after-stories.png',animations:'disabled'});
 // Future-proof: a separate long-copy stress test uses only the already
 // published summary repeated, explicitly marked as dummy layout text.
 await page.evaluate(()=>{
  const prose=document.querySelector('.w3-intro-summary');
  prose.dataset.saved=prose.textContent;
  prose.textContent='【レイアウト検証用・仮の長文】 '+(prose.textContent+'　').repeat(7);
  document.getElementById('worldDetailContent').scrollTop=0;
 });
 await page.waitForTimeout(100);
 await page.screenshot({path:folder+'/'+width+'x'+height+'-DETAIL-long-text-demo.png',animations:'disabled'});
 await page.evaluate(()=>{
   const root=document.getElementById('worldDetailContent');
   const intro=root.querySelector('.w3-world-intro');
   const text=root.querySelector('.world-detail-hero-content');
   const p=document.createElement('p');
   p.textContent=intro.querySelector('.w3-intro-summary').dataset.saved;
   const stats=document.createElement('div');
   stats.className='world-detail-stats mono';
   stats.innerHTML=intro.querySelector('.w3-intro-stats').innerHTML;
   text.append(p,stats);intro.remove();
 });
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
 console.log('WORLD PERSONA x ZZZ V3 VISUAL STUDY PASS');
}finally{await browser.close();}
