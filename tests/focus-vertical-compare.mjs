import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';

const site='https://mazimuri.github.io/';
const candidate=readFileSync('cast-side-rail.css','utf8');
const baseline=execFileSync('git',['show','origin/main:cast-side-rail.css'],{encoding:'utf8',maxBuffer:2_000_000});
assert.ok(candidate.includes('(max-height:1130px)')&&candidate.includes('calc(904px - 80svh)'));
mkdirSync('fullhd-hero-review',{recursive:true});
const browser=await chromium.launch();
const sizes=[[1440,900],[1920,900],[1919,1079],[1920,1080],[2048,1149],[2560,1440]];
async function render(width,height,css,label){
 const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
 await page.route('**/cast-side-rail.css*',r=>r.fulfill({status:200,contentType:'text/css',body:css}));
 await page.goto(site,{waitUntil:'domcontentloaded',timeout:45000});
 await page.locator('#openDetail').waitFor();
 await page.evaluate(async()=>{
   await document.fonts.ready;
   const img=document.getElementById('heroArt');
   await img?.decode?.().catch(()=>{});
 });
 await page.waitForTimeout(300);
 const m=await page.evaluate(()=>{
  const rect=id=>{const r=document.getElementById(id).getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height}};
  const copy=document.getElementById('heroCopy');
  const roman=document.getElementById('heroRoman');
  return {copy:rect('heroCopy'),name:rect('heroJapanese'),cta:rect('openDetail'),hero:rect('hero'),
     romanClipped:roman.scrollWidth>roman.clientWidth+2,
     font:getComputedStyle(document.getElementById('heroJapanese')).fontSize};
 });
 assert.ok(m.cta.bottom<m.hero.bottom-15,'PROFILE control clipped for '+width+'/'+height+' '+label);
 assert.ok(!m.romanClipped,'Roman headline clipped at '+width+'/'+height+' '+label);
 if(width>=1850&&[1920,2560].includes(width)){
   await page.screenshot({path:'fullhd-hero-review/'+width+'x'+height+'-'+label+'.png',
     fullPage:true,animations:'disabled'});
 }
 await page.close();
 return m;
}
try{
 for(const [width,height] of sizes){
  const before=await render(width,height,baseline,'before');
  const after=await render(width,height,candidate,'after');
  const shift=before.copy.top-after.copy.top;
  const nameShift=before.name.top-after.name.top;
  const ctaShift=before.cta.top-after.cta.top;
  console.log('FOCUS HEIGHT METRICS '+width+'x'+height+
    ' copyUp='+shift.toFixed(1)+'px nameUp='+nameShift.toFixed(1)+'px ctaUp='+ctaShift.toFixed(1)+
    ' copyBefore='+before.copy.top.toFixed(1)+' copyAfter='+after.copy.top.toFixed(1));
  if(width>=1850&&height<=1100){
   assert.ok(shift>=20&&shift<=50,'Full HD editorial lift outside 20-50px range: '+shift);
   assert.ok(nameShift>0&&ctaShift>0,'Headline and PROFILE should both rise');
  }else{
   assert.ok(Math.abs(shift)<4,'Tall 2K / standard layouts should barely move: '+shift);
  }
  assert.ok(after.cta.bottom<after.hero.bottom-15,'CTA out of hero after shift');
  console.log('FOCUS HEIGHT PASS '+width+'x'+height);
 }
 console.log('FOCUS SHORT-SCREEN PREVIEW PASS: fullHD raised, tall 2K unchanged.');
}finally{await browser.close()}
