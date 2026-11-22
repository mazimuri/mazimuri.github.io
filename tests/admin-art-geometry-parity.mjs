/* EDIT MAIN VISUAL: source of truth is the already-approved public SELECT.
   Run: node tests/admin-art-geometry-parity.mjs
   Uses only synthetic images and CSS; no cloud writes or authentication. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const styles=['style.css','mobile.css','cast-side-rail.css','cast-view-adjustments.css',
 'cast-rail-current.css','admin-v15-studio.css'].map(read).join('\n');
const visual=read('visual-engine.js'),admin=read('admin.js'),html=read('admin.html');
new Function(visual);new Function(admin);
assert.match(html,/visual-engine\.js\?v=16\.3\.0/);
assert.match(admin,/vstudio-mobile-note/);
assert.match(styles,/#admin #artPreviewScene \.hero-art-wrap/);
const artwork='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="1000"><rect width="600" height="1000" fill="#f35c70"/><circle cx="280" cy="390" r="140" fill="#111"/></svg>');
const stamp=(id)=>`<div class="hero-art-stamp" id="${id}" style="--badge-right:21%;--badge-top:19%;--badge-mobile-right:8%;--badge-mobile-top:66%">
 <span class="v7-stamp-original">FILE<br><b>001</b></span>
 <span class="v7-stamp-detail" aria-hidden="true"><span class="v7-stamp-inner"><small>FILE</small><strong>001</strong><i></i></span></span></div>`;
const frame=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
 <style>${styles}</style><style>
 #artStage{width:min(570px,calc(100vw - 36px));margin:26px auto!important}
 #admin{display:block!important}
 #admin .v594-art-editor{display:block!important}
 #main{height:auto}
 </style></head><body>
 <main id="main"><section class="hero theme-rov" id="hero" style="--accent:#f35c70;--deep:#17191e;--soft:#edece6;--bright:#eaff54">
  <div class="hero-surface"></div><div class="hero-dark-panel"></div><div class="hero-accent-slab"></div>
  <div class="hero-art-wrap" id="artWrap"><img id="heroArt" class="hero-art" alt="" src="${artwork}" style="--art-x:12%;--art-y:-8%;--art-zoom:1.35"></div>
  ${stamp('artStamp')}
 </section></main>
 <div class="admin-root" id="admin"><div class="admin-top">EDIT MODE / GEOMETRY TEST</div>
 <div class="admin-frame"><div class="admin-workspace"><div class="admin-content">
 <div class="art-editor v594-art-editor">
 <div class="art-stage" id="artStage">
  <div class="art-preview-scene hero theme-orphe" id="artPreviewScene" style="--accent:#e84758;--deep:#17191e;--soft:#edece6;--bright:#eaff54">
    <div class="hero-surface"></div><div class="hero-dark-panel"></div><div class="hero-accent-slab"></div>
    <div class="hero-art-wrap" id="artPreviewWrap"><img id="artStageImg" class="hero-art" alt="" src="${artwork}" style="--art-x:12%;--art-y:-8%;--art-zoom:1.35"></div>
    ${stamp('artPreviewBadge')}
  </div><span class="art-stage-top mono">SELECT EDIT</span>
 </div></div>
 <p class="vstudio-mobile-note">Mobile: FILE is hidden</p></div></div></div></div>
 </body></html>`;
const browser=await chromium.launch({headless:true});
try{
  for(const [width,height] of [[1024,740],[1440,900],[1920,1080],[2560,1440],[760,900],[390,844]]){
    const page=await browser.newPage({viewport:{width,height}});
    await page.setContent(frame,{waitUntil:'load'});
    await page.addScriptTag({content:visual});
    const result=await page.evaluate(()=>{
      window.CAST_VISUAL.layout();
      const q=id=>document.getElementById(id);
      const metrics=el=>({x:el.offsetLeft,y:el.offsetTop,w:el.offsetWidth,h:el.offsetHeight,
        transform:getComputedStyle(el).transform,display:getComputedStyle(el).display});
      const img=el=>({transform:getComputedStyle(el).transform,origin:getComputedStyle(el).transformOrigin,
        fit:getComputedStyle(el).objectFit,position:getComputedStyle(el).objectPosition});
      const scene=q('artPreviewScene'),main=q('hero');
      // Compare against how SELECT would actually render the draft character,
      // not the different published character currently behind EDIT.
      main.classList.remove('theme-rov');
      main.classList.add('theme-orphe');
      const realArt=metrics(q('artWrap')),realImage=img(q('heroArt')),
        realBadge=metrics(q('artStamp'));
      main.classList.remove('theme-orphe');
      main.classList.add('theme-rov');
      return {
       realArt,previewArt:metrics(q('artPreviewWrap')),
       realImage,previewImage:img(q('artStageImg')),
       realBadge,previewBadge:metrics(q('artPreviewBadge')),
       realTheme:main.className,
       width:main.clientWidth,stageWidth:scene.offsetWidth,
       scaledScene:scene.getBoundingClientRect().width,
       note:getComputedStyle(document.querySelector('.vstudio-mobile-note')).display,
       artStampPreviewCss:q('artPreviewBadge').style.cssText
      };
    });
    assert.equal(result.width,result.stageWidth,`Hero/scene source width mismatch at ${width}`);
    for(const key of ['x','y','w','h']){
      assert.ok(Math.abs(result.realArt[key]-result.previewArt[key])<=2,
        `Artwork ${key} mismatch at ${width}: ${JSON.stringify(result)}`);
    }
    // CSS resolves percentages with subpixel rounding (about 0.03px at 1024).
    const almostSame=(a,b,tolerance=.3)=>{
      if(a===b)return true;
      const nums=v=>[...v.matchAll(/-?\\d+(?:\\.\\d+)?/g)].map(m=>Number(m[0]));
      const aa=nums(a),bb=nums(b);
      return aa.length>0&&aa.length===bb.length&&aa.every((v,i)=>Math.abs(v-bb[i])<=tolerance);
    };
    assert.equal(result.realImage.fit,result.previewImage.fit,`Artwork fit at ${width}`);
    assert.equal(result.realImage.position,result.previewImage.position,`Artwork position at ${width}`);
    assert.ok(almostSame(result.realImage.transform,result.previewImage.transform),`Artwork image transform at ${width}: ${JSON.stringify(result)}`);
    assert.ok(almostSame(result.realArt.transform,result.previewArt.transform),`Artwork wrapper transform at ${width}`);
    assert.ok(almostSame(result.realImage.origin,result.previewImage.origin),`Artwork origin at ${width}`);
    assert.ok(result.realTheme.includes('theme-rov')&&!result.realTheme.includes('theme-orphe'),
      'Public character theme must be restored after measuring draft geometry');
    if(width>800){
      assert.notEqual(result.previewBadge.display,'none',`Badge must show on desktop ${width}`);
      for(const key of ['x','y','w','h']){
        assert.ok(Math.abs(result.realBadge[key]-result.previewBadge[key])<=2,
          `FILE badge ${key} mismatch at ${width}: ${JSON.stringify(result)}`);
      }
    }else{
      assert.equal(result.realBadge.display,'none',`Public badge mobile hidden at ${width}`);
      assert.equal(result.previewBadge.display,'none',`Editor badge mobile hidden at ${width}`);
      assert.equal(result.realImage.transform,'none',`Public mobile art transform disabled at ${width}`);
      assert.notEqual(result.note,'none','Editor mobile limitation must be explained');
    }
    await page.close();
  }
  console.log('PASS: live hero/editor artwork + FILE badge geometry at 1024/1440/1920/2560/760/390');
} finally {await browser.close()}
