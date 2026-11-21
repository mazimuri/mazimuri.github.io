import assert from 'node:assert/strict';
import {readFileSync, mkdirSync, writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';

const SITE='https://mazimuri.github.io/';
const ART_DIR='visual-preview-review';
const local={
  style:readFileSync('style.css','utf8'),
  rail:readFileSync('cast-side-rail.css','utf8')
};
const original={
  style:execFileSync('git',['show','origin/main:style.css'],{encoding:'utf8',maxBuffer:4000000}),
  rail:execFileSync('git',['show','origin/main:cast-side-rail.css'],{encoding:'utf8',maxBuffer:4000000})
};
mkdirSync(ART_DIR,{recursive:true});
const browser=await chromium.launch();
const results=[];

async function render(width,height,kind,css){
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,reducedMotion:'reduce'});
  page.on('pageerror',e=>console.log('PAGE JS ERROR '+e.message.slice(0,170)));
  await page.route('**/style.css*',r=>r.fulfill({status:200,contentType:'text/css',body:css.style}));
  await page.route('**/cast-side-rail.css*',r=>r.fulfill({status:200,contentType:'text/css',body:css.rail}));
  await page.goto(SITE,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>{
    const intro=document.getElementById('heroIntel'),bio=document.getElementById('heroBio');
    return intro && !intro.hidden && bio && bio.textContent.trim().length>15;
  },null,{timeout:30000});
  await page.locator('#v5Stack .v5-item[data-slot="3"] .v5-card').waitFor();
  await page.evaluate(async()=>{
    await document.fonts.ready;
    const img=document.getElementById('heroArt');
    await img?.decode?.().catch(()=>{});
  });
  await page.waitForTimeout(600);
  const geometry=await page.evaluate(()=>{
    const b=id=>{const r=document.getElementById(id).getBoundingClientRect();return {left:+r.left.toFixed(1),top:+r.top.toFixed(1),bottom:+r.bottom.toFixed(1),height:+r.height.toFixed(1)}};
    return {viewport:[innerWidth,innerHeight], copy:b('heroCopy'),title:b('heroRoman'),jp:b('heroJapanese'),
      intro:b('heroIntel'),cta:b('openDetail'),hero:b('hero'),art:b('artWrap'),
      titleFont:getComputedStyle(document.getElementById('heroRoman')).fontSize};
  });
  assert.ok(geometry.cta.bottom<geometry.hero.bottom-12,'PROFILE is clipped: '+kind+' '+width+'x'+height);
  await page.screenshot({path:ART_DIR+'/'+width+'x'+height+'-SELECT-'+kind+'.png',fullPage:true,animations:'disabled'});
  // Open the real WORLD panel; don't modify content or publication state.
  await page.locator('#nav-worlds').click();
  await page.locator('#worldCards [data-world]').first().waitFor({timeout:15000});
  const choices=page.locator('#worldCards [data-world]');
  let count=await choices.count(), portraits=0, chosen=-1;
  for(let i=0;i<count;i++){
    await choices.nth(i).click();
    await page.locator('#worldDetailPanel.open').waitFor();
    portraits=await page.locator('#worldDetailPanel .world-story-avatar-portrait img[data-crop-render]').count();
    if(portraits){chosen=i;break;}
    await page.locator('#worldDetailBack').click();
  }
  if(portraits){
    const img=page.locator('#worldDetailPanel .world-story-avatar-portrait img[data-crop-render]').first();
    await img.scrollIntoViewIfNeeded();
    await img.evaluate(async i=>i.decode?.().catch(()=>{}));
    await page.waitForTimeout(300);
    const dims=await img.evaluate(el=>({fit:getComputedStyle(el).objectFit,natural:[el.naturalWidth,el.naturalHeight],rendered:[el.clientWidth,el.clientHeight]}));
    if(kind==='after')assert.equal(dims.fit,'cover','WORLD icon has invalid image stretching');
    await page.screenshot({path:ART_DIR+'/'+width+'x'+height+'-WORLD-'+kind+'.png',fullPage:false,animations:'disabled'});
    results.push({kind,width,height,geometry,world:{index:chosen,portraitCount:portraits,...dims}});
  }else{
    results.push({kind,width,height,geometry,world:{portraitCount:0}});
  }
  await page.close();
}

try{
  for(const [width,height] of [[1920,911],[2560,1271]]){
    await render(width,height,'before',original);
    await render(width,height,'after',local);
  }
  const g=(w,kind)=>results.find(x=>x.width===w&&x.kind===kind).geometry;
  console.log('FULLHD BEFORE CTA',g(1920,'before').cta);
  console.log('FULLHD AFTER CTA',g(1920,'after').cta);
  console.log('2K BEFORE CTA',g(2560,'before').cta);
  console.log('2K AFTER CTA',g(2560,'after').cta);
  console.log('WORLD OBJECT FIT',results.map(x=>x.width+' '+x.kind+' '+JSON.stringify(x.world)).join('\n'));
  writeFileSync(ART_DIR+'/metrics.json',JSON.stringify(results,null,2));
  console.log('VISUAL PREVIEW COMPLETE (branch only, main unchanged)');
}finally{
  await browser.close();
}
