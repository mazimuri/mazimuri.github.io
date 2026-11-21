import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {chromium} from 'playwright';

const site='https://mazimuri.github.io/';
const railCss=readFileSync('cast-rail-current.css','utf8');
const railJs=readFileSync('cast-side-rail.js','utf8');
const out='hero-wide-review';
mkdirSync(out,{recursive:true});
const variants={
 baseline:'',
 balanced:'@media (min-width:1850px){ #hero .hero-copy{left:clamp(120px,7.5vw,200px)!important;width:min(47%,740px)!important} #hero .hero-copy .title-stack h1{font-size:clamp(180px,8.25vw,205px)!important} #hero .hero-copy .title-outline{font-size:clamp(113px,5.1vw,130px)!important} #hero .hero-copy .hero-jp,#hero .hero-copy:has(.hero-intel:not([hidden])) .hero-jp{font-size:clamp(34px,1.5vw,40px)!important} #hero .hero-intel{max-width:min(480px,100%)!important} #hero .hero-voice p{font-size:clamp(18px,1.03vw,22px)!important;line-height:1.47!important} #hero .hero-bio p{font-size:clamp(13px,.68vw,17px)!important;line-height:1.6!important} #hero .hero-copy .hero-cta{width:clamp(320px,17vw,370px)!important;max-width:370px!important;height:clamp(56px,3.1vw,68px)!important} #hero .hero-cta strong{font-size:clamp(15px,.8vw,18px)!important} }',
 focus:'@media (min-width:1850px){ #hero .hero-copy{left:clamp(120px,6.7vw,174px)!important;width:min(45%,710px)!important} #hero .hero-copy .title-stack h1{font-size:clamp(180px,7.55vw,194px)!important} #hero .hero-copy .title-outline{font-size:clamp(113px,4.9vw,126px)!important} #hero .hero-copy .hero-jp,#hero .hero-copy:has(.hero-intel:not([hidden])) .hero-jp{font-size:clamp(34px,1.55vw,40px)!important} #hero .hero-intel{max-width:min(470px,96%)!important} #hero .hero-voice p{font-size:clamp(19px,1vw,23px)!important;line-height:1.47!important} #hero .hero-bio p{font-size:clamp(14px,.70vw,18px)!important;line-height:1.55!important;max-width:47ch!important} #hero .hero-copy .hero-cta{width:clamp(320px,16vw,365px)!important;max-width:365px!important;height:clamp(58px,3vw,67px)!important} #hero .hero-cta strong{font-size:clamp(15px,.8vw,18px)!important} }',
 bold:'@media (min-width:1850px){ #hero .hero-copy{left:clamp(130px,9vw,245px)!important;width:min(50%,820px)!important} #hero .hero-copy .title-stack h1{font-size:clamp(190px,9vw,232px)!important} #hero .hero-copy .title-outline{font-size:clamp(120px,5.8vw,150px)!important} #hero .hero-copy .hero-jp,#hero .hero-copy:has(.hero-intel:not([hidden])) .hero-jp{font-size:clamp(38px,1.72vw,45px)!important} #hero .hero-intel{max-width:min(540px,100%)!important} #hero .hero-voice p{font-size:clamp(20px,1.12vw,25px)!important;line-height:1.43!important} #hero .hero-bio p{font-size:clamp(14px,.75vw,19px)!important;line-height:1.56!important} #hero .hero-copy .hero-cta{width:clamp(340px,18vw,410px)!important;max-width:410px!important;height:clamp(60px,3.2vw,72px)!important} #hero .hero-cta strong{font-size:clamp(16px,.91vw,20px)!important} }'
};
const browser=await chromium.launch({headless:true});
try{
 for(const [width,height] of [[1920,1080],[2560,1440]]){
  const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
  await page.route('**/cast-rail-current.css*',r=>r.fulfill({status:200,contentType:'text/css',body:railCss}));
  await page.route('**/cast-side-rail.js*',r=>r.fulfill({status:200,contentType:'application/javascript',body:railJs}));
  await page.goto(site,{waitUntil:'domcontentloaded',timeout:45000});
  await page.locator('#v5Stack .v5-item[data-slot="3"]').waitFor();
  await page.evaluate(async()=>{
    await document.fonts.ready;
    await Promise.all([...document.querySelectorAll('#heroArt,#v5Stack img')].map(i=>i.decode?.().catch(()=>{})??Promise.resolve()));
  });
  const flags=await page.evaluate(()=>({art:document.getElementById('heroArt').naturalWidth,
     cards:[...document.querySelectorAll('#v5Stack img')].map(x=>x.naturalWidth)}));
  assert.ok(flags.art>0 && flags.cards.length===4 && flags.cards.every(x=>x>0),'Missing character artwork '+JSON.stringify(flags));
  for(const [name, css] of Object.entries(variants)){
    const style=css?await page.addStyleTag({content:css}):null;
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    await page.waitForTimeout(500);
    const metrics=await page.evaluate(()=>{
      const ids=['heroRoman','heroRoman2','heroJapanese','heroVoice','heroBio','heroVoiceBlock','heroBioBlock','openDetail','artWrap','v5Rail'];
      const result={};
      for(const id of ids){
        const e=document.getElementById(id);
        if(!e)continue;const r=e.getBoundingClientRect(),s=getComputedStyle(e);
        result[id]={x:Math.round(r.x),y:Math.round(r.y),right:Math.round(r.right),bottom:Math.round(r.bottom),w:Math.round(r.width),h:Math.round(r.height),font:s.fontSize,visible:s.display!=='none'};
      }
      const roman=document.getElementById('heroRoman'),copy=document.getElementById('heroCopy');
      result.romanOverflow=roman.scrollWidth>roman.clientWidth;
      result.copyWidth=copy.getBoundingClientRect().width;
      result.railDistance=result.v5Rail.x-result.heroJapanese.right;
      result.bodyBeyondHero=result.openDetail.bottom>document.getElementById('hero').getBoundingClientRect().bottom-20;
      return result;
    });
    console.log('HERO '+width+' '+name+' '+JSON.stringify(metrics));
    assert.ok(!metrics.bodyBeyondHero,'CTA below hero at '+width+' '+name);
    assert.ok(!metrics.romanOverflow,'Roman title clipped at '+width+' '+name);
    await page.screenshot({path:out+'/hero-'+width+'-'+name+'.png',fullPage:true});
    if(style)await style.evaluate(el=>el.remove());
  }
  await page.close();
 }
 console.log('HERO WIDE VARIANTS PREVIEW PASS (screenshots saved; no production edits).');
}finally{await browser.close()}
