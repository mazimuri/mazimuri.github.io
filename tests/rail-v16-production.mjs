import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {chromium} from 'playwright';

const site='https://mazimuri.github.io/';
const css=readFileSync('cast-rail-current.css','utf8');
const js=readFileSync('cast-side-rail.js','utf8');
const folder='v16-review';
mkdirSync(folder,{recursive:true});
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const browser=await chromium.launch({headless:true});
const desktopSizes=[[801,740],[850,740],[1024,768],[1440,900],[1920,1080],[2048,1080],[2560,1440]];
let scenarios=0;

try{
 for(const [width,height] of desktopSizes){
  const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
  let cssRequests=0,jsRequests=0;
  await page.route('**/cast-rail-current.css*',r=>{
    cssRequests++;return r.fulfill({status:200,contentType:'text/css',body:css});
  });
  await page.route('**/cast-side-rail.js*',r=>{
    jsRequests++;return r.fulfill({status:200,contentType:'application/javascript',body:js});
  });
  await page.goto(site,{waitUntil:'domcontentloaded',timeout:45000});
  await page.locator('#v5Stack .v5-item[data-slot="3"] .v5-card').waitFor({timeout:20000});
  assert.ok(cssRequests>0 && jsRequests>0,'Local V16 CSS+JS must have been substituted');
  // A screenshot cannot count as visually reviewed if a portrait failed to load.
  // GitHub-hosted assets can sometimes race the initial page render; reload
  // a bounded number of times instead of silently capturing a blank card.
  let loaded=[];
  for(let attempt=0;attempt<3;attempt++){
    loaded=await page.evaluate(async()=>{
      await document.fonts.ready;
      const imgs=[...document.querySelectorAll('#v5Stack .v5-item:not(.v6-rail-ghost) img')];
      await Promise.all(imgs.map(img=>img.decode?.().catch(()=>{})??Promise.resolve()));
      return imgs.map(img=>({src:img.getAttribute('src'),ok:img.complete&&img.naturalWidth>0}));
    });
    if(loaded.length===4&&loaded.every(x=>x.ok))break;
    if(attempt<2){
      console.log('RETRY image load '+width+'x'+height+' attempt '+(attempt+1)+': '+JSON.stringify(loaded));
      await page.reload({waitUntil:'domcontentloaded',timeout:45000});
      await page.locator('#v5Stack .v5-item[data-slot="3"] .v5-card').waitFor();
    }
  }
  assert.equal(loaded.length,4,'Exactly 4 real portraits expected');
  assert.ok(loaded.every(x=>x.ok),'Missing real image(s) after retries: '+JSON.stringify(loaded));
  const rail=page.locator('#v5Rail');
  assert.equal(await rail.evaluate(el=>getComputedStyle(el).display),'block','Desktop rail must remain visible');
  const info=await page.evaluate(()=>{
    const cards=[...document.querySelectorAll('#v5Stack .v5-item:not(.v6-rail-ghost)')];
    const r=cards.map(el=>el.getBoundingClientRect());
    const front=cards.find(el=>el.dataset.slot==='3');
    const card=front.querySelector('.v5-card-outer').getBoundingClientRect();
    const all=front.querySelector('.v5-allcast').getBoundingClientRect();
    const image=front.querySelector('.v5-card-inner img');
    const st=getComputedStyle(image);
    return {
      cards:cards.length,slots:cards.map(x=>Number(x.dataset.slot)),
      widths:r.map(x=>x.width),heights:r.map(x=>x.height),
      allCastDeltaBottom:Math.abs(all.bottom-card.bottom),
      allCastToLeft:all.right-card.left,
      imageFilter:st.filter,
      imageTransform:st.transform,
      statusCount:cards.map(x=>Number(x.dataset.statusCount)),
      indicator:cards.some(x=>getComputedStyle(x.querySelector('.v5-card-outer'),'::before').content!=='none')
    };
  });
  assert.equal(info.cards,4,'There must be exactly 4 live cast cards');
  assert.deepEqual(info.slots,[0,1,2,3],'Perspective card slots must keep their order');
  assert.ok(info.widths.every((x,i)=>!i||x>info.widths[i-1]),'Cards must enlarge toward foreground');
  assert.ok(info.heights.every((x,i)=>!i||x>info.heights[i-1]),'Card height must increase toward foreground');
  assert.ok(info.allCastDeltaBottom<=2,'ALL CAST baseline differs from nearest card: '+info.allCastDeltaBottom);
  assert.ok(info.allCastToLeft<=12,'ALL CAST dock overlaps portrait: '+info.allCastToLeft);
  assert.equal(info.indicator,false,'Removed LED indicator has reappeared');
  assert.ok(info.imageTransform!=='none','Image crop skew/zoom transform missing');

  const selected=page.locator('#v5Stack .v5-item[data-slot="3"] .v5-card');
  const before=await selected.locator('.v5-card-inner img').evaluate(el=>getComputedStyle(el).filter);
  await selected.hover({force:true});
  await sleep(240);
  const hovered=await selected.evaluate(el=>({
    filter:getComputedStyle(el.querySelector('.v5-card-inner img')).filter,
    translate:getComputedStyle(el.querySelector('.v5-card-outer')).translate,
    shellFilter:getComputedStyle(el.querySelector('.v5-card-outer')).filter
  }));
  assert.equal(hovered.filter,before,'Hover must not alter portrait filter (blur prevention)');
  assert.equal(hovered.shellFilter,'none','Whole card must not apply filter on hover');
  assert.ok(hovered.translate.includes('-2px'),'Tactile lift missing');

  // Actual authored picker records (not hardcoded character fixtures).
  const live=await page.evaluate(()=>{
    const items=[...document.querySelectorAll('#v5Stack .v5-item:not(.v6-rail-ghost)')];
    const source=[...document.querySelectorAll('#pickerStrip [data-person]')];
    return items.map(item=>{
      const original=source.find(x=>x.dataset.person===item.dataset.person);
      const sourceImg=original?.querySelector('img');
      const img=item.querySelector('img');
      return {
        id:item.dataset.person,
        originalFound:!!original,
        statusCount:Number(item.dataset.statusCount),
        expectedCount:Number(!!original?.querySelector('.zeta-badge'))+Number(!!original?.querySelector('.cast-new')),
        cropSame:(sourceImg?.getAttribute('style')??'')===(img?.getAttribute('style')??''),
        imageSame:(sourceImg?.getAttribute('src')??'')===(img?.getAttribute('src')??'')
      };
    });
  });
  assert.ok(live.every(x=>x.originalFound&&x.cropSame&&x.imageSame&&x.statusCount===x.expectedCount),
    'Source character crop/status/portrait data was not preserved: '+JSON.stringify(live));

  // Screenshot real content; hold all animation only during capture.
  if([1024,1920,2048,2560].includes(width)){
    await page.mouse.move(0,0);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await page.waitForTimeout(350);
    await page.screenshot({path:folder+'/v16-real-'+width+'.png',fullPage:true,animations:'disabled'});
  }

  // Simulate each real-world status state with temporary badges in the picker.
  // The snapshot is not shipped as production data.
  await page.evaluate(()=>{
    const ids=[...document.querySelectorAll('#v5Stack .v5-item:not(.v6-rail-ghost)')].map(x=>x.dataset.person);
    const picker=[...document.querySelectorAll('#pickerStrip [data-person]')];
    ids.forEach((id,slot)=>{
      const btn=picker.find(x=>x.dataset.person===id);
      if(!btn)return;
      btn.querySelectorAll('.zeta-badge,.cast-new').forEach(x=>x.remove());
      if(slot===0||slot===1){const b=document.createElement('span');b.className='zeta-badge';b.hidden=true;btn.appendChild(b);}
      if(slot===0||slot===2){const b=document.createElement('span');b.className='cast-new';b.hidden=true;btn.appendChild(b);}
    });
    window.dispatchEvent(new Event('resize'));
  });
  await page.waitForFunction(()=>[...document.querySelectorAll('#v5Stack .v5-item:not(.v6-rail-ghost)')]
     .map(x=>Number(x.dataset.statusCount)).join(',')==='2,1,1,0');
  const badges=await page.evaluate(()=>{
    const items=[...document.querySelectorAll('#v5Stack .v5-item:not(.v6-rail-ghost)')];
    return items.map(item=>({
      slot:Number(item.dataset.slot),
      statusCount:Number(item.dataset.statusCount),
      chipCount:item.querySelectorAll('.v5-status-chip').length,
      chips:[...item.querySelectorAll('.v5-status-chip')].map(chip=>{
        const style=getComputedStyle(chip);
        return {backgroundImage:style.backgroundImage,backgroundColor:style.backgroundColor,
          color:style.color,line:getComputedStyle(chip,'::before').backgroundColor,
          text:chip.querySelector('.long')?.textContent,
          shortDisplay:getComputedStyle(chip.querySelector('.short')).display,
          longDisplay:getComputedStyle(chip.querySelector('.long')).display
        };
      })
    }));
  });
  assert.deepEqual(badges.map(x=>x.statusCount),[2,1,1,0]);
  for(const badge of badges){
    assert.equal(badge.chipCount,badge.statusCount);
    for(const chip of badge.chips){
      assert.equal(chip.backgroundImage,'none','Old gradient chip has returned');
      assert.ok(chip.backgroundColor==='rgba(0, 0, 0, 0)'||chip.backgroundColor==='transparent',
        'Old bright-background status has returned: '+chip.backgroundColor);
      assert.ok(chip.line.startsWith('rgb('));
      if(badge.slot<2){assert.equal(chip.longDisplay,'none');assert.notEqual(chip.shortDisplay,'none')}
      else{assert.equal(chip.shortDisplay,'none');assert.notEqual(chip.longDisplay,'none')}
    }
  }
  if(width===1920){
    await page.waitForTimeout(220);
    await page.screenshot({path:folder+'/v16-status-matrix-1920.png',fullPage:true,animations:'disabled'});
  }

  // Jump ±04 and ALL CAST must still be connected to the main site's actions.
  const pickerBefore=await page.locator('#pickerStrip [data-person]').evaluateAll(e=>e.map(x=>({
    id:x.dataset.person,selected:x.getAttribute('aria-selected')==='true'
  })));
  if(pickerBefore.length>=2){
    const from=pickerBefore.findIndex(x=>x.selected);
    const target=pickerBefore[(from+(pickerBefore.length<=4?1:4))%pickerBefore.length].id;
    await page.locator('#v5BatchNext').click({force:true});
    await page.waitForFunction(id=>document.querySelector('#pickerStrip [aria-selected="true"]')?.dataset.person===id,target);
    await page.waitForTimeout(500);
    assert.equal(await page.locator('#v5Stack .v5-item[data-slot="3"]').getAttribute('data-person'),target);
  }
  const opened=await page.evaluate(()=>{
    const button=document.getElementById('openIndex');
    if(!button)return 'missing';
    window.__v16OpenHit=false;
    button.addEventListener('click',()=>window.__v16OpenHit=true,{once:true});
    return 'ready';
  });
  assert.equal(opened,'ready','Missing main site ALL CAST action');
  await page.locator('#v5Stack .v5-item[data-slot="3"] .v5-allcast').click({force:true});
  assert.equal(await page.evaluate(()=>window.__v16OpenHit),true,'ALL CAST button did not activate directory');
  console.log('PASS V16 '+width+'x'+height+' : live crops, depth, dark status, hover, nav and ALL CAST');
  await page.close();
  scenarios++;
 }
 // Mobile design intentionally untouched.
 const mobile=await browser.newPage({viewport:{width:800,height:900}});
 await mobile.route('**/cast-rail-current.css*',r=>r.fulfill({contentType:'text/css',body:css}));
 await mobile.route('**/cast-side-rail.js*',r=>r.fulfill({contentType:'application/javascript',body:js}));
 await mobile.goto(site,{waitUntil:'domcontentloaded',timeout:45000});
 assert.equal(await mobile.locator('#v5Rail').evaluate(el=>getComputedStyle(el).display),'none',
   'Mobile must not show desktop perspective rail');
 await mobile.close();
 console.log('PASS V16 mobile 800px remains in existing mobile mode');
 console.log('V16 PRODUCTION INTEGRATION PASS: '+scenarios+' desktop sizes plus mobile');
}finally{await browser.close();}
