import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';

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
 const png=await page.screenshot({animations:'disabled'});
 return {computed,png};
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
   const after=await snapshot(page,style,candidate);
   assert.deepEqual(after.computed,before.computed,'Real page computed styles differ at '+width+'×'+height+' / '+state);
   assert.ok(after.png.equals(before.png),'Real page rendered pixels differ at '+width+'×'+height+' / '+state);
   console.log('PASS real page '+width+'x'+height+' '+state);
   count++;
  }
  await page.close();
 }
 console.log('LIVE PARITY PASS '+count+' scenarios with real published content.');
}finally{await browser.close();}
