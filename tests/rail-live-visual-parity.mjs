import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
import {PNG} from 'pngjs';

/* Compare the production site against the refactored CSS within ONE rendered
   page, without changing any server files. Actual character data and images
   stay mounted; only the CSS text changes in the same stylesheet position.
   This test is read-only for https://mazimuri.github.io/. */
const url='https://mazimuri.github.io/';
const baseline=execFileSync('git',['show','origin/main:cast-side-rail.css'],{encoding:'utf8',maxBuffer:2_000_000});
const candidate=readFileSync('cast-side-rail.css','utf8');

const properties=['display','position','left','right','top','bottom','width','height','opacity','zIndex',
 'transform','filter','backgroundColor','backgroundImage','color','fontSize','border','borderRadius',
 'outline','boxShadow','padding','clipPath','objectPosition','transformOrigin'];
function imageDiff(first,second){
 const a=PNG.sync.read(first),b=PNG.sync.read(second);
 assert.equal(a.width,b.width);assert.equal(a.height,b.height);
 let pixels=0,maxDiff=0,x1=a.width,y1=a.height,x2=0,y2=0;
 for(let y=0;y<a.height;y++)for(let x=0;x<a.width;x++){
  const p=(y*a.width+x)*4;
  const d=Math.max(...[0,1,2,3].map(c=>Math.abs(a.data[p+c]-b.data[p+c])));
  if(d){pixels++;maxDiff=Math.max(maxDiff,d);x1=Math.min(x1,x);y1=Math.min(y1,y);x2=Math.max(x2,x);y2=Math.max(y2,y);}
 }
 return {pixels,maxDiff,ratio:Math.round(pixels/(a.width*a.height)*100000)/1000,
   bbox:pixels?[x1,y1,x2,y2]:null};
}
const selectors=['#v5Rail','.v5-control-head','.v5-batch-pair','#v5BatchPrev','#v5BatchNext',
 '.v5-batch-label','#v5Stack','.v5-readout'];
for(let slot=0;slot<4;slot++){
 const base='#v5Stack .v5-item[data-slot="'+slot+'"]';
 for(const suffix of ['','.v5-card','.v5-card-outer','.v5-card-inner','.v5-card-inner img',
   '.v5-card-name','.v5-badges','.v5-badges b','.v5-badges .is-new']){
  selectors.push(base+(suffix?' '+suffix:''));
 }
}
selectors.push('#v5Stack .v5-item[data-slot="3"] .v5-allcast');

async function snapshot(page,style,css){
 await style.evaluate((el,text)=>{el.textContent=text;},css);
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const computed=await page.evaluate(({selectors,properties})=>selectors.map(selector=>{
  const e=document.querySelector(selector);
  if(!e)return {selector,missing:true};
  const cs=getComputedStyle(e),r=e.getBoundingClientRect();
  const out={selector,rect:[r.left,r.top,r.width,r.height].map(n=>Math.round(n*100)/100)};
  for(const k of properties)out[k]=cs[k];
  return out;
 }),{selectors,properties});
 const fullComputed=await page.evaluate(()=>{
  const root=document.getElementById('v5Rail');
  if(!root)throw Error('Rail root missing');
  return [root,...root.querySelectorAll('*')].map((el,i)=>({
   i,tag:el.tagName,classes:el.className?.baseVal??el.className,
   css:['','::before','::after'].map(pseudo=>{
    const cs=getComputedStyle(el,pseudo||null);
    return Array.from(cs).map(name=>[name,cs.getPropertyValue(name)]);
   })
  }));
 });
 const png=await page.screenshot({animations:'disabled'});
 return {computed,fullComputed,png};
}

const browser=await chromium.launch();
const tests=[[1024,768],[1920,1080],[2048,1080],[2560,1440]];
let count=0;
try{
 for(const [width,height] of tests){
  const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
  page.setDefaultTimeout(30000);
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
  await page.locator('#v5Stack .v5-item[data-slot="3"] .v5-card').waitFor({state:'attached'});
  await page.evaluate(async()=>{
   await document.fonts.ready;
   await Promise.all([...document.querySelectorAll('#v5Stack img')].map(i=>
     i.decode?.().catch(()=>{}) ?? Promise.resolve()));
  });
  await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}'});
  const style=await page.evaluateHandle(text=>{
   const link=[...document.querySelectorAll('link[rel=stylesheet]')].find(x=>(x.getAttribute('href')||'').includes('cast-side-rail.css'));
   if(!link)throw Error('Production rail CSS link was not found');
   const el=document.createElement('style');el.id='rail-parity-live-css';el.textContent=text;link.replaceWith(el);return el;
  },baseline);
  for(const state of ['normal','hover','focus']){
   if(state==='hover')await page.locator('#v5Stack .v5-item[data-slot="3"] .v5-card').hover({force:true});
   if(state==='focus')await page.locator('#v5BatchNext').focus();
   if(state==='normal')await page.mouse.move(0,0);
   const before=await snapshot(page,style,baseline);
   const repeat=await snapshot(page,style,baseline);
   const after=await snapshot(page,style,candidate);
   assert.deepEqual(repeat.computed,before.computed,'Baseline itself changed at '+width+'×'+height+' / '+state);
   assert.deepEqual(after.computed,before.computed,'Real page computed styles differ at '+width+'×'+height+' / '+state);
   assert.deepEqual(repeat.fullComputed,before.fullComputed,'Baseline full DOM style drift at '+width+'×'+height+' / '+state);
   assert.deepEqual(after.fullComputed,before.fullComputed,'Full computed styles including pseudos differ at '+width+'×'+height+' / '+state);
   const baselineDrift=imageDiff(before.png,repeat.png);
   const cleanupDrift=imageDiff(repeat.png,after.png);
   console.log('DIFF '+width+'x'+height+' '+state+' baseline-repeat='+JSON.stringify(baselineDrift)+' css-change='+JSON.stringify(cleanupDrift));
   assert.equal(baselineDrift.pixels,0,'Unstable screenshot baseline; stop for investigation');
   // Tiny subpixel paint variance is acceptable only when every actual CSS value
   // in the rail, including pseudo-elements, is proven identical.
   const railRect=await page.locator('#v5Rail').boundingBox();
   const bbox=cleanupDrift.bbox;
   const withinRail=!bbox || (bbox[0]>=railRect.x-120 && bbox[2]<=railRect.x+railRect.width+120 &&
     bbox[1]>=railRect.y-25 && bbox[3]<=railRect.y+railRect.height+25);
   assert.ok(withinRail,'Pixel change occurred outside the rail at '+width+'×'+height+' / '+state);
   assert.ok(cleanupDrift.ratio<=0.5 && cleanupDrift.maxDiff<=32,
      'Meaningful visual change at '+width+'×'+height+' / '+state);
   console.log('PASS real page '+width+'x'+height+' '+state);
   count++;
  }
  await page.close();
 }
 console.log('LIVE PARITY PASS '+count+' scenarios with real published content.');
}finally{await browser.close();}
