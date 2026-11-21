import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {chromium} from 'playwright';

const source='https://mazimuri.github.io/';
const css={
 core:readFileSync('cast-side-rail.css','utf8'),
 rail:readFileSync('cast-rail-current.css','utf8'),
 js:readFileSync('cast-side-rail.js','utf8')
};
const browser=await chromium.launch({headless:true});
mkdirSync('hero-wide-implementation',{recursive:true});
const sizes=[[800,900],[1024,768],[1440,900],[1849,1000],[1920,1080],[2048,1080],[2560,1440]];
const result=[];
try{
 for(const [width,height] of sizes){
  const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
  let coreUsed=false,railUsed=false,jsUsed=false;
  await page.route('**/cast-side-rail.css*',r=>{coreUsed=true;return r.fulfill({status:200,contentType:'text/css',body:css.core})});
  await page.route('**/cast-rail-current.css*',r=>{railUsed=true;return r.fulfill({status:200,contentType:'text/css',body:css.rail})});
  await page.route('**/cast-side-rail.js*',r=>{jsUsed=true;return r.fulfill({status:200,contentType:'application/javascript',body:css.js})});
  await page.goto(source,{waitUntil:'domcontentloaded',timeout:45000});
  await page.locator('#heroJapanese').waitFor({state:'attached'});
  await page.evaluate(async()=>await document.fonts.ready);
  if(width>800)await page.locator('#v5Stack .v5-item[data-slot="3"]').waitFor();
  assert.ok(coreUsed&&railUsed&&jsUsed,'V16 branch assets not loaded');

  const metrics=await page.evaluate(()=>{
   const el=id=>document.getElementById(id),comp=e=>getComputedStyle(e);
   const rr=e=>{const r=e.getBoundingClientRect();return{x:Math.round(r.x),y:Math.round(r.y),right:Math.round(r.right),bottom:Math.round(r.bottom),width:Math.round(r.width),height:Math.round(r.height)}};
   const roman=el('heroRoman'),jp=el('heroJapanese'),voice=el('heroVoice'),bio=el('heroBio'),button=el('openDetail');
   return {romanSize:parseFloat(comp(roman).fontSize),jpSize:parseFloat(comp(jp).fontSize),
     voiceSize:parseFloat(comp(voice).fontSize),bioSize:parseFloat(comp(bio).fontSize),
     roman:rr(roman),jp:rr(jp),cta:rr(button),art:rr(el('heroArt')),hero:rr(el('hero')),
     copy:rr(el('heroCopy')),railWidth:el('v5Rail').getBoundingClientRect().width,
     titleText:roman.textContent.trim(),jpText:jp.textContent.trim(),
     scrollWidth:roman.scrollWidth,clientWidth:roman.clientWidth};
  });
  if(width>=1850){
   assert.ok(metrics.jpSize>=34,'Japanese name still too small at '+width+': '+metrics.jpSize);
   assert.ok(metrics.voiceSize>=19,'Voice line still too small at '+width+': '+metrics.voiceSize);
   assert.ok(metrics.bioSize>=14,'Bio still too small at '+width+': '+metrics.bioSize);
   assert.ok(metrics.roman.x>=120,'Editorial block did not move toward portrait');
  }
  assert.ok(metrics.cta.bottom<=metrics.hero.bottom-12,'PROFILE cut off at '+width);
  assert.ok(metrics.scrollWidth<=metrics.clientWidth+2,'Roman title clipped at '+width);
  if(width>800)assert.ok(metrics.railWidth>0,'Desktop rail disappeared at '+width);
  result.push({width,height,...metrics});
  console.log('HERO FOCUS PASS '+width+'x'+height+' '+JSON.stringify({
   jp:metrics.jpSize,voice:metrics.voiceSize,bio:metrics.bioSize,roman:metrics.romanSize,
   left:metrics.copy.x,ctaBottom:metrics.cta.bottom}));
  if([1920,2560].includes(width)){
    await page.evaluate(async()=>{
      const imgs=[...document.querySelectorAll('#heroArt,#v5Stack img')];
      await Promise.all(imgs.map(x=>x.decode?.().catch(()=>{})??Promise.resolve()));
    });
    await page.waitForTimeout(900);
    await page.screenshot({path:'hero-wide-implementation/focus-'+width+'.png',fullPage:true});
  }
  await page.close();
 }
 console.log('V16 HERO FOCUS INTEGRATION PASS: '+sizes.length+' responsive widths');
}finally{await browser.close()}
