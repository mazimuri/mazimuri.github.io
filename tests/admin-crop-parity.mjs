/* Regression checks for edit-only crop parity. Run with:
   node tests/admin-crop-parity.mjs           (static)
   node tests/admin-crop-parity.mjs --browser (Chromium via Playwright)
*/
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const js=read('admin.js'),css=read('admin-v15-studio.css'),html=read('admin.html');
const prod=read('cast-rail-current.css'),mobile=read('mobile.css'),all=read('cast-allcast-current.css');
new Function(js); // Syntax only; do not execute browser code in Node.
assert.match(js,/mode==='choose'\?frame\.querySelector\('\.v15-rail-inner'\):frame/);
assert.match(js,/centerOrigin=mode==='mobile'/);
assert.match(js,/--v15-live-card-ratio/);
assert.match(css,/\.crop-canvas\.crop-picker-mode \.v15-rail-inner img\[data-crop-render\]/);
assert.match(css,/\.crop-rail-frame \.v15-rail-inner img\[data-crop-render\]/);
assert.match(css,/transform:skewX\(11deg\) scale\(1\.15\) scale\(var\(--crop-zoom,1\)\)!important/);
assert.match(prod,/transform:skewX\(11deg\) scale\(1\.15\) scale\(var\(--crop-zoom,1\)\)!important/);
assert.match(css,/transform-origin:50% 50%!important/);
assert.match(mobile,/\.mobile-portrait img\{/);
assert.match(css,/\.crop-gallery-frame\{aspect-ratio:1!important\}/);
assert.match(all,/--allcast-portrait-h:/);
assert.match(html,/admin-v15-studio\.css\?v=16\.0\.0/);
assert.match(html,/admin\.js\?v=16\.1\.0/);
assert.equal((css.match(/\{/g)||[]).length,(css.match(/\}/g)||[]).length);
assert.doesNotMatch(css,/V15\.2: fix distorted editor crop/);
console.log('PASS: static crop parity, code syntax and admin asset revisions');
if(process.argv.includes('--browser')){
  const {chromium}=await import('playwright');
  const browser=await chromium.launch({headless:true});
  try {
    const styleFiles=['style.css','mobile.css','cast-side-rail.css','cast-view-adjustments.css',
      'cast-rail-current.css','cast-allcast-current.css','admin-v15-studio.css'];
    const styles=styleFiles.map(read).join('\n');
    const artwork='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="800"><rect width="640" height="800" fill="#e7a0aa"/><path d="M0 0L640 800M640 0L0 800" stroke="#131d24" stroke-width="35"/><circle cx="310" cy="320" r="110" fill="#82d0df"/></svg>');
    const attr='style="--crop-x:35%;--crop-y:64%;--crop-zoom:1.65"';
    const img=id=>'<img id="'+id+'" data-crop-render src="'+artwork+'" '+attr+'>';
    const fixture=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${styles}</style>
    <style>body{margin:0}#main{width:100%;height:1250px;position:relative}
    #main .v5-rail{position:relative!important;right:auto!important;top:0!important}
    #admin{position:absolute;top:20px;left:560px;width:510px}
    #admin .v15-icon-studio{display:block}
    #admin .crop-canvas.crop-picker-mode{display:block}
    #admin .crop-rail-frame{display:block}
    </style></head><body>
    <div id="main"><div class="v5-rail" id="v5Rail"><div class="v5-stack" id="v5Stack">
    <div class="v5-item" data-slot="3"><button class="v5-card"><span class="v5-card-outer">
    <span class="v5-card-inner">${img('publicPC')}</span></span></button></div>
    </div></div></div>
    <div id="admin"><div class="v15-icon-studio">
    <div class="crop-canvas crop-picker-mode" id="cropCanvas"><span class="v15-rail-shell"><span class="v15-rail-inner">${img('editPC')}</span></span></div>
    <div class="crop-rail-frame"><span class="v15-rail-shell"><span class="v15-rail-inner">${img('livePC')}</span></span></div>
    <div class="crop-canvas crop-mobile-mode">${img('editMobile')}</div>
    <div class="crop-phone-frame">${img('liveMobile')}</div>
    <div class="crop-canvas crop-gallery-mode">${img('editGallery')}</div>
    <div class="crop-gallery-frame">${img('liveGallery')}</div>
    </div></div>
    <div class="mobile-portrait"><span>${img('publicMobile')}</span></div>
    </body></html>`;
    const page=await browser.newPage();
    for(const width of [1280,1920,2560]){
      await page.setViewportSize({width,height:1271});
      await page.setContent(fixture,{waitUntil:'load'});
      const result=await page.evaluate(()=>{
        const get=s=>document.querySelector(s),style=s=>getComputedStyle(get(s));
        const pub=get('#main .v5-card-inner'),editor=get('#cropCanvas');
        const ratio=pub.offsetWidth/pub.offsetHeight;
        get('#admin .v15-icon-studio').style.setProperty('--v15-live-card-ratio',String(ratio));
        const edRatio=editor.offsetWidth/editor.offsetHeight;
        const px=s=>{const el=get(s),sp=style(s).transformOrigin.split(' ').map(parseFloat);
          return [sp[0]/el.offsetWidth,sp[1]/el.offsetHeight]};
        return {ratio,edRatio,pc:style('#publicPC').transform,
          edit:style('#editPC').transform,live:style('#livePC').transform,
          pos:[style('#publicPC').objectPosition,style('#editPC').objectPosition,style('#livePC').objectPosition],
          origin:[px('#publicPC'),px('#editPC'),px('#livePC')],
          square:style('.crop-canvas.crop-gallery-mode').aspectRatio};
      });
      assert.ok(Number.isFinite(result.ratio)&&result.ratio>1,`missing V16 picture bay at ${width}`);
      assert.ok(Math.abs(result.ratio-result.edRatio)<.025,`V16/editor aspect difference at ${width}`);
      assert.equal(result.pc,result.edit,`V16/editor skew+scale mismatch at ${width}`);
      assert.equal(result.pc,result.live,`V16/LIVE skew+scale mismatch at ${width}`);
      assert.ok(result.pos.every(p=>p===result.pos[0]),`focal point mismatch at ${width}`);
      for(const o of result.origin)for(let j=0;j<2;j++)
        assert.ok(Math.abs(o[j]-result.origin[0][j])<.002,`transform origin mismatch at ${width}`);
      assert.equal(result.square,'1 / 1',`ALL CAST aspect at ${width}`);
    }
    await page.setViewportSize({width:390,height:844});
    await page.setContent(fixture,{waitUntil:'load'});
    const mob=await page.evaluate(()=>{
      const cs=q=>getComputedStyle(document.querySelector(q));
      const normalized=q=>{
        const el=document.querySelector(q),raw=cs(q).transformOrigin.split(' ').map(parseFloat);
        return [raw[0]/el.offsetWidth,raw[1]/el.offsetHeight];
      };
      return {pub:cs('#publicMobile').transform,edit:cs('#editMobile').transform,
        live:cs('#liveMobile').transform,
        origin:[normalized('#publicMobile'),normalized('#editMobile'),normalized('#liveMobile')],
        all:cs('.crop-canvas.crop-gallery-mode').aspectRatio};
    });
    console.log('DEBUG mobile origin',JSON.stringify(mob));
    assert.equal(mob.pub,mob.edit,'MOBILE editor scale mismatch');
    assert.equal(mob.pub,mob.live,'MOBILE LIVE scale mismatch');
    for(const origin of mob.origin)for(const axis of origin)
      assert.ok(Math.abs(axis-.5)<.002,'MOBILE centered zoom origin mismatch');
    assert.equal(mob.all,'1 / 1.08');
    await page.close();
    console.log('PASS: Chromium desktop V16 picture-bay transforms and mobile/gallery previews');
  } finally {await browser.close()}
}
