import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

/* Real-browser parity test for CSS-only cleanup.
   Source of truth: origin/main, NOT a manually reproduced mock stylesheet.
   The fixture covers the live v5 class structure; this does not replace
   manual checks with real portraits or other pages. */
const baseline = execFileSync('git', ['show','origin/main:cast-side-rail.css'], {encoding:'utf8',maxBuffer:2_000_000});
const candidate = readFileSync('cast-side-rail.css','utf8');
const foundation = readFileSync('style.css','utf8');

function fixture(css) {
  const items = [0,1,2,3].map(slot => {
    const active = slot === 3;
    const badge = '<span class="v5-badges"><b>zeta</b><b class="is-new">NEW</b></span>';
    const all = active ? '<button class="v5-allcast"><span>ALL CAST</span></button>' : '';
    const image = '<img alt="" src="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22200%22 viewBox=%220 0 300 200%22%3E%3Crect width=%22300%22 height=%22200%22 fill=%22%238c9199%22/%3E%3Ccircle cx=%22150%22 cy=%2295%22 r=%2256%22 fill=%22%23eff3ee%22/%3E%3C/svg%3E" style="--crop-x:45%;--crop-y:35%;--crop-zoom:1.07">';
    return '<div class="v5-item" data-slot="'+slot+'"><button class="v5-card"><span class="v5-card-outer"><span class="v5-card-inner">'+image+'</span><span class="v5-card-name">キャラクター '+slot+'</span></span>'+badge+'</button>'+all+'</div>';
  }).join('');
  return '<!doctype html><html lang="ja"><head><meta charset="utf-8"><style>'+foundation+'</style><style>'+css+'</style>'+
    '<style>:root{--v2-stage:900px;--accent:#eaff54;--acid:#eaff54;--soft:#a8b9c1;--deep:#17222a;--bright:#fff}'+
    'body{margin:0} #main{position:relative;min-height:900px} #hero{position:relative;height:900px} '+
    '*{animation:none!important;transition:none!important;caret-color:transparent!important}</style></head>'+
    '<body><main id="main"><section id="hero" class="hero"><div class="hero-pattern"></div>'+
    '<div class="hero-circles"></div><div class="hero-accent-slab"></div><div class="hero-dark-panel"></div>'+
    '<aside id="v5Rail" class="v5-rail"><div class="v5-control-head">'+
    '<div class="v5-batch-pair"><button id="v5BatchPrev" class="v5-batch"><svg viewBox="0 0 32 21"><path d="M5 16 L16 4 L27 16" stroke="currentColor" fill="none"/></svg></button>'+
    '<button id="v5BatchNext" class="v5-batch"><svg viewBox="0 0 32 21"><path d="M5 5 L16 17 L27 5" stroke="currentColor" fill="none"/></svg></button></div>'+
    '<span class="v5-batch-label">JUMP ±04</span></div><div id="v5Stack" class="v5-stack">'+items+'</div>'+
    '<div class="v5-readout"><span>01/04</span><span>SCROLL / SELECT</span></div></aside></section></main></body></html>';
}

const props = ['display','position','top','left','right','bottom','width','height','opacity','zIndex',
  'transform','filter','overflow','backgroundColor','backgroundImage','color','fontSize','fontFamily',
  'border','borderRadius','boxShadow','outline','outlineOffset','padding','gap','flexDirection','clipPath'];
const targets = ['#v5Rail','#v5Stack','.v5-control-head','.v5-batch-pair','#v5BatchPrev',
  '#v5BatchNext','.v5-batch-label','.v5-readout'];
for(let i=0;i<4;i++){
  targets.push('.v5-item[data-slot="'+i+'"]');
  for(const child of ['.v5-card','.v5-card-outer','.v5-card-inner','.v5-card-inner img',
    '.v5-card-name','.v5-badges','.v5-badges b','.v5-badges .is-new']){
    targets.push('.v5-item[data-slot="'+i+'"] '+child);
  }
}
targets.push('.v5-item[data-slot="3"] .v5-allcast');

async function capture(page,css,width,height,state) {
  await page.setViewportSize({width,height});
  await page.setContent(fixture(css),{waitUntil:'domcontentloaded'});
  if(state==='hover')await page.locator('.v5-item[data-slot="3"] .v5-card').hover({force:true});
  if(state==='focus')await page.locator('#v5BatchNext').focus();
  if(state==='detail')await page.locator('body').evaluate(el=>el.classList.add('detail-open'));
  const computed = await page.evaluate(({targets,props}) => targets.map(selector => {
    const el=document.querySelector(selector);
    if(!el)return {selector,missing:true};
    const st=getComputedStyle(el),rect=el.getBoundingClientRect();
    const rule={selector,rect:[rect.x,rect.y,rect.width,rect.height].map(n=>Math.round(n*100)/100)};
    for(const p of props)rule[p]=st[p];
    return rule;
  }),{targets,props});
  const png=await page.screenshot({fullPage:true,animations:'disabled'});
  return {computed,png};
}

const browser=await chromium.launch({headless:true});
let checks=0;
try{
  const sizes=[[801,740],[850,740],[1024,768],[1280,900],[1440,900],[1920,1080],[2048,1080],[2560,1440]];
  for(const [width,height] of sizes){
    for(const state of ['normal','hover','focus','detail']){
      const a=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
      const b=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
      await a.route('**/*', route=>route.abort());
      await b.route('**/*', route=>route.abort());
      const before=await capture(a,baseline,width,height,state);
      const after=await capture(b,candidate,width,height,state);
      assert.deepEqual(after.computed,before.computed,'Computed styles changed: '+width+'x'+height+' '+state);
      assert.ok(after.png.equals(before.png),'Rendered pixels changed: '+width+'x'+height+' '+state);
      await a.close();await b.close();checks++;
      console.log('PASS '+width+'x'+height+' '+state);
    }
  }
  console.log('PARITY PASS: '+checks+' scenarios; no computed-style or screenshot differences.');
}finally{await browser.close();}
