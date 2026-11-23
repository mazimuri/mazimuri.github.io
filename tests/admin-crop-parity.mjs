/* Regression checks for edit-only crop parity. Run with:
   node tests/admin-crop-parity.mjs           (static)
   node tests/admin-crop-parity.mjs --browser (Chromium via Playwright)
*/
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const js=read('admin.js'),css=read('admin-v15-studio.css'),html=read('admin.html');
const prod=read('cast-rail-current.css'),mobile=read('mobile.css'),all=read('cast-allcast-current.css');
const worldCss=read('cast-worlds-current.css'),publicJs=read('app.js');
new Function(js); // Syntax only; do not execute browser code in Node.
assert.match(js,/mode==='choose'\?frame\?\.querySelector\('\.v15-rail-inner'\):frame/);
assert.match(js,/function cropMetrics\(mode,zoom\)/);
assert.match(js,/Math\.max\(1\.3,Number\(p\.zoom\)\|\|1\)/);
assert.match(js,/edit-prev/);assert.match(js,/edit-next/);
assert.match(js,/preview\(id=state\.section==='characters'/);
assert.match(js,/--v15-live-card-ratio/);
assert.match(css,/\.crop-canvas\.crop-picker-mode \.v15-rail-inner img\[data-crop-render\]/);
assert.match(css,/\.crop-rail-frame \.v15-rail-inner img\[data-crop-render\]/);
assert.match(css,/transform:skewX\(11deg\) scale\(1\.15\) scale\(var\(--crop-zoom,1\)\)!important/);
assert.match(prod,/transform:skewX\(11deg\) scale\(1\.15\) scale\(var\(--crop-zoom,1\)\)!important/);
assert.match(css,/transform-origin:var\(--crop-x,50%\) var\(--crop-y,50%\)!important/);
assert.match(css,/crop-guide-corner/);
assert.match(mobile,/\.mobile-portrait img\{[^\n]*transform-origin:var\(--crop-x,50%\) var\(--crop-y,50%\)!important/);
assert.match(mobile,/\.mobile-portrait img\{/);
assert.match(css,/\.crop-gallery-frame\{aspect-ratio:1!important\}/);
assert.match(all,/--allcast-portrait-h:/);
assert.match(html,/admin-v15-studio\.css\?v=16\.2\.0/);
assert.match(html,/admin\.js\?v=16\.3\.8/);
assert.match(html,/cast-worlds-current\.css\?v=1\.0\.6/);
assert.match(js,/cast-worlds-current\.css\?v=1\.0\.6/);
assert.match(js,/function worldImageFrameDoc\(w,view,idx\)/);
assert.match(js,/function worldImageFit\(frame=/);
assert.match(js,/function worldImageFrameReady\(frame\)/);
assert.match(js,/data-world-preview-anchor/);
assert.match(js,/sandbox="allow-same-origin"/);
assert.match(js,/data-world-image-frame/);
assert.match(js,/function worldImageToggleExpand\(\)/);
assert.match(worldCss,/#admin \.world-image-frame-shell iframe/);
assert.match(worldCss,/#admin \.world-image-studio\.is-expanded/);
assert.match(worldCss,/#worldDetailPanel \.wd4-description\{[^}]*width:min\(100%,800px\);/,'WORLD DETAIL PC description must use max 800px width');
assert.match(worldCss,/#worldDetailPanel \.wd4-description\{[^}]*text-align:center/,'WORLD DETAIL PC description must be centered');
assert.match(worldCss,/@media\(max-width:800px\)\{[\s\S]*?#worldDetailPanel \.wd4-description\{[^}]*text-align:left/,'WORLD DETAIL mobile description must remain left aligned');
assert.match(js,/function worldImageStudio\(w\)/);
assert.match(js,/function worldImageDragStart\(e\)/);
assert.match(js,/function worldImageDragMove\(e\)/);
assert.match(js,/data-world-image-axis/);
assert.match(js,/world-image-reset/);
assert.match(publicJs,/function worldImageStyle\(w,view\)/);
assert.match(publicJs,/worldImageStyle\(w,'select'\)/);
assert.match(publicJs,/worldImageStyle\(w,'detail'\)/);
assert.match(worldCss,/#admin \.world-image-studio \.ws5-art/);
const worldCardArt=worldCss.match(/#worldsPanel \.ws5-art,\s*#admin \.world-image-studio \.ws5-art\{([^}]*)\}/)?.[1];
assert.ok(worldCardArt,'WORLD SELECT foreground art rule exists');
assert.match(worldCardArt,/z-index:3/,'WORLD SELECT character art must render in front of overlays');
assert.match(worldCss,/#worldsPanel \.ws5-visual:before\{[^}]*z-index:2/,'grid and dark overlay must stay behind character');
assert.match(worldCss,/#worldsPanel \.ws5-file-mark\{[^}]*z-index:5/,'top FILE label must remain visible above character');
assert.match(worldCss,/#worldsPanel \.ws5-huge\{[^}]*z-index:2/,'large translucent FILE number stays behind character');
assert.match(worldCss,/#admin \.world-image-detail-stage \.world-detail-art/);
assert.equal((worldCss.match(/\{/g)||[]).length,(worldCss.match(/\}/g)||[]).length);
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
    #testMobile{display:block!important;position:relative!important;width:53px!important;height:54px!important}
    #testMobile>span{display:block!important;position:relative!important;width:100%!important;height:100%!important}
    #testMobile img{display:block!important;width:100%!important;height:100%!important}
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
    <div class="mobile-portrait" id="testMobile"><span>${img('publicMobile')}</span></div>
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
        return {width:el.offsetWidth,height:el.offsetHeight,computed:cs(q).transformOrigin,
          normalized:el.offsetWidth&&el.offsetHeight?[raw[0]/el.offsetWidth,raw[1]/el.offsetHeight]:null};
      };
      return {pub:cs('#publicMobile').transform,edit:cs('#editMobile').transform,
        live:cs('#liveMobile').transform,
        origin:[normalized('#publicMobile'),normalized('#editMobile'),normalized('#liveMobile')],
        all:cs('.crop-canvas.crop-gallery-mode').aspectRatio};
    });
    assert.equal(mob.pub,mob.edit,'MOBILE editor scale mismatch');
    assert.equal(mob.pub,mob.live,'MOBILE LIVE scale mismatch');
    for(const entry of mob.origin){
      assert.ok(entry.normalized,'Mobile preview must have measurable image dimensions');
      assert.ok(Math.abs(entry.normalized[0]-.35)<.002&&Math.abs(entry.normalized[1]-.64)<.002,
        'MOBILE focal-origin mismatch: '+JSON.stringify(mob.origin));
    }
    const motion=await page.evaluate(()=>{
      const results=[];
      for(const id of ['publicMobile','editMobile','liveMobile']){
        const el=document.querySelector('#'+id);
        el.style.setProperty('--crop-x','20%');
        const left=el.getBoundingClientRect().left;
        el.style.setProperty('--crop-x','80%');
        results.push({id,dx:el.getBoundingClientRect().left-left});
      }
      return results;
    });
    for(const item of motion)assert.ok(Math.abs(item.dx)>5,
      'X position must physically move square icons at zoom > 1: '+JSON.stringify(motion));
    assert.equal(mob.all,'1 / 1.08');

    // WORLD IMAGE STUDIO: render the real editor iframe markup at the public
    // responsive viewport widths, and confirm the editor can crop it precisely.
    const frameGeneratorSource=js.slice(js.indexOf('function worldImageFrameDoc(w,view,idx){'),
      js.indexOf('function worldImageStudio(w){'));
    const imageEsc=x=>String(x??'').replace(/[&<>"']/g,c=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const generator=new Function('esc','worldImageCss','worldImageValues',
      frameGeneratorSource+';return worldImageFrameDoc;')(
      imageEsc,v=>'--wi-x:'+v.x+'%;--wi-y:'+v.y+'%;--wi-z:'+v.zoom,
      ()=>({x:15,y:-20,zoom:1.4}));
    const worldSample={title:'TEST WORLD',category:'FANTASY / ROMANCE',cardTeaser:'Two-line world introduction',
      image:artwork,stories:[{title:'MAIN STORY'}],accent:'#eafa42'};
    const stylesForFrame=[read('style.css'),read('mobile.css'),worldCss].join('\n');
    const sourceFor=(view)=>{
      const doc=generator(worldSample,view,1);
      return doc.replace(/<link rel="stylesheet" href="[^"]+">/g,'')
        .replace('</head>','<style>'+stylesForFrame+'</style></head>');
    };
    for(const view of ['select','detail','mobile']){
      const naturalWidth=view==='mobile'?390:1280;
      const frameHtml=sourceFor(view);
      const encoded=imageEsc(frameHtml);
      await page.setViewportSize({width:1280,height:900});
      await page.setContent(`<!doctype html><html><head><style>${worldCss}</style></head><body style="margin:0">
        <div id="admin"><div id="worldImageStudio" class="world-image-studio">
          <div class="world-image-canvas" style="width:570px;box-sizing:border-box">
            <div class="world-image-frame-shell" data-world-image-drag>
              <iframe data-world-image-frame sandbox="allow-same-origin" style="width:${naturalWidth}px;height:1400px"
                srcdoc="${encoded}"></iframe>
            </div>
          </div>
        </div></div></body></html>`,{waitUntil:'load'});
      const outcome=await page.evaluate(()=>{
        const iframe=document.querySelector('[data-world-image-frame]');
        const inner=iframe.contentDocument;
        const anchor=inner?.querySelector('[data-world-preview-anchor]');
        if(!anchor)return null;
        const rect=anchor.getBoundingClientRect();
        const outer=document.querySelector('.world-image-frame-shell');
        const canvas=document.querySelector('.world-image-canvas');
        const css=getComputedStyle(canvas);
        const avail=canvas.clientWidth-(parseFloat(css.paddingLeft)||0)-(parseFloat(css.paddingRight)||0)-4;
        const scale=Math.min(1,Math.max(120,avail)/rect.width);
        outer.style.width=Math.ceil(rect.width*scale)+'px';
        outer.style.height=Math.ceil(rect.height*scale)+'px';
        iframe.style.transform=`translate(${-rect.left*scale}px,${-rect.top*scale}px) scale(${scale})`;
        return {width:rect.width,height:rect.height,scale,shell:outer.getBoundingClientRect().width,
          visual:getComputedStyle(inner.querySelector('[data-world-preview-img]')).transform};
      });
      assert.ok(outcome&&outcome.width>150,'WORLD '+view+' iframe should load real public CSS and card markup');
      assert.ok(outcome.shell>100&&Math.abs(outcome.shell-outcome.width*outcome.scale)<3,
        'WORLD '+view+' fitted preview must preserve correct aspect: '+JSON.stringify(outcome));
      if(view==='select')assert.ok(outcome.height>400,'WORLD SELECT should use real responsive card height');
      if(view==='mobile')assert.ok(Math.abs(outcome.height-145)<1,'WORLD MOBILE should use real 145px detail header');
    }
    await page.close();
    console.log('PASS: Chromium V16 crop parity and true WORLD preview viewport layout');
  } finally {await browser.close()}
}
