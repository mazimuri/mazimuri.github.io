import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {chromium} from 'playwright';

const site='https://mazimuri.github.io/';
const candidate=readFileSync('cast-rail-current.css','utf8');
const output='rail-frame-review';
mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true});
const sizes=[[1024,768],[1920,1080],[2560,1440]];
let ok=0;
try{
 for(const [width,height] of sizes){
  const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
  let intercepted=false;
  await page.route('**/cast-rail-current.css*',route=>{
    intercepted=true; return route.fulfill({status:200,contentType:'text/css',body:candidate});
  });
  await page.goto(site,{waitUntil:'domcontentloaded',timeout:45000});
  await page.locator('#v5Stack .v5-item[data-slot="3"] .v5-card-outer').waitFor({timeout:20000});
  assert.ok(intercepted,'Polished stylesheet was not applied');

  await page.evaluate(async()=>{
    await document.fonts.ready;
    await Promise.all([...document.querySelectorAll('#v5Stack .v5-item:not(.v6-rail-ghost) img')]
       .map(img=>img.decode?.().catch(()=>{})??Promise.resolve()));
  });
  const front=page.locator('#v5Stack .v5-item[data-slot="3"] .v5-card');
  const all=page.locator('#v5Stack .v5-item[data-slot="3"] .v5-allcast');
  await page.mouse.move(0,0);
  const idle=await page.evaluate(()=>{
    const items=[...document.querySelectorAll('#v5Stack .v5-item:not(.v6-rail-ghost)')];
    if(items.length!==4)throw Error('Expected 4 cards, got '+items.length);
    return items.map(item=>{
      const outer=item.querySelector('.v5-card-outer'),
        inner=item.querySelector('.v5-card-inner'),
        img=item.querySelector('img');
      const sh=getComputedStyle(outer),photo=getComputedStyle(img),
        right=getComputedStyle(outer,'::after'),
        gloss=getComputedStyle(inner,'::before');
      return {outline:sh.outlineStyle,shadow:sh.boxShadow,filter:sh.filter,
        translate:sh.translate,rightDisplay:right.display,rightContent:right.content,
        glossDisplay:gloss.display,glossContent:gloss.content,
        imageFilter:photo.filter,crop:img.getAttribute('style')};
    });
  });
  assert.ok(idle.every(x=>x.outline==='none'),'Legacy outline still wraps a card');
  assert.ok(idle.every(x=>x.rightDisplay==='none'&&x.glossDisplay==='none'),
    'An extra bright highlight remains in card shell');
  assert.ok(idle.every(x=>x.shadow.includes('inset')&&x.filter==='none'),
    'Card baseline shadow lost its inset/3D construction');

  await page.waitForTimeout(240);
  if(width>=1920){
    await page.screenshot({path:output+'/polished-'+width+'-rest.png',fullPage:true,animations:'disabled'});
  }
  await front.hover({force:true});
  await page.waitForTimeout(100);
  const hover=await front.evaluate(card=>{
    const outer=card.querySelector('.v5-card-outer');
    const img=card.querySelector('.v5-card-inner img');
    const st=getComputedStyle(outer);
    return {shadow:st.boxShadow,filter:st.filter,translate:st.translate,
      imageFilter:getComputedStyle(img).filter};
  });
  assert.equal(hover.shadow,idle[3].shadow,'Card loses its resting bevel/shadow when hovered');
  assert.equal(hover.imageFilter,idle[3].imageFilter,'Image changes filter when hovered');
  assert.equal(hover.filter,'none','Whole card image is filtered on hover');
  assert.ok(hover.translate.includes('-2px'),'Card did not retain tactile lift');
  if(width>=1920){
    await page.screenshot({path:output+'/polished-'+width+'-hover.png',fullPage:true,animations:'disabled'});
  }
  await page.mouse.move(0,0);
  const buttonIdle=await all.evaluate(el=>{
    const s=getComputedStyle(el),b=getComputedStyle(el,'::before');
    return {outline:s.outlineStyle,background:s.backgroundImage,shadow:s.boxShadow,
      before:b.display,beforeContent:b.content,transform:s.transform};
  });
  assert.equal(buttonIdle.outline,'none','Legacy focus/hover ring still present at rest');
  assert.equal(buttonIdle.before,'none','White reflection bar remains at top of ALL CAST');
  assert.ok(!buttonIdle.background.includes('247, 255, 174')&&!buttonIdle.background.includes('#f7ffae'),
    'Old near-white ALL CAST glare gradient remains');

  await all.hover({force:true});
  const buttonHovered=await all.evaluate(el=>{
    const s=getComputedStyle(el);
    return {outline:s.outlineStyle,filter:s.filter,translate:s.translate};
  });
  assert.equal(buttonHovered.outline,'none','ALL CAST draws the old outline on hover');
  assert.equal(buttonHovered.filter,'none','ALL CAST becomes washed-out during hover');
  assert.ok(buttonHovered.translate.includes('-3px'),'ALL CAST hover movement lost');

  await page.mouse.move(0,0);
  await all.focus();
  const focus=await all.evaluate(el=>getComputedStyle(el).outlineStyle);
  assert.equal(focus,'solid','Keyboard focus indication must remain visible');

  const images=await page.evaluate(()=>[...document.querySelectorAll('#v5Stack .v5-item:not(.v6-rail-ghost) img')]
    .map(x=>({ok:x.complete&&x.naturalWidth>0,src:x.getAttribute('src')})));
  assert.ok(images.every(x=>x.ok),'Source image did not load');
  console.log('PASS frame polish '+width+'x'+height+': 4 shells, shadows, unfiltered hover, ALL CAST + focus');
  ok++;
  await page.close();
 }
 console.log('FRAME POLISH QA PASS: '+ok+' live-page sizes');
}finally{await browser.close()}
