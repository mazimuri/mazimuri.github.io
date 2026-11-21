import {readFileSync,mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {PNG} from 'pngjs';

const css=readFileSync('cast-rail-current.css','utf8');
const url='https://mazimuri.github.io/';
mkdirSync('rail-paint-diagnostics',{recursive:true});
const conditions=[
 ['default',''],
 ['no-parent-will-change','#main .v5-item{will-change:auto!important}'],
 ['no-image-filter','#main .v5-card-inner img{filter:none!important}'],
 ['no-image-transform','#main .v5-card-inner img{transform:none!important}'],
 ['no-outer-skew','#main .v5-card-outer{transform:none!important}'],
 ['img-backface','#main .v5-card-inner img{backface-visibility:hidden!important;will-change:transform!important}'],
 ['shell-composite','#main .v5-card-outer{backface-visibility:hidden!important;will-change:transform!important}'],
 ['no-card-isolation','#main .v5-item .v5-card{isolation:auto!important}'],
 ['no-parent-motion','#main .v5-item{animation:none!important;transition:none!important;will-change:auto!important}'],
 ['filter-to-parent','#main .v5-card-inner img{filter:none!important}#main .v5-item[data-slot="0"] .v5-card-inner{filter:grayscale(1) contrast(1.05) brightness(.91)!important}#main .v5-item[data-slot="1"] .v5-card-inner{filter:grayscale(.86) saturate(.72) contrast(1.04) brightness(.94)!important}#main .v5-item[data-slot="2"] .v5-card-inner{filter:grayscale(.53) saturate(.86) contrast(1.03) brightness(.97)!important}#main .v5-item[data-slot="3"] .v5-card-inner{filter:saturate(1.01) contrast(1.03)!important}']
];
function inspect(png,rects){
 const im=PNG.sync.read(png);return rects.map(r=>{
  const xa=Math.max(1,Math.floor(r.x+r.w*.25)),xb=Math.min(im.width-1,Math.floor(r.x+r.w*.75));
  const ya=Math.max(0,Math.floor(r.y+r.h*.25)),yb=Math.min(im.height-1,Math.floor(r.y+r.h*.66));
  let count=0,diff=0,high=0;
  for(let y=ya;y<yb;y+=2)for(let x=xa+1;x<xb;x+=2){
   const p=4*(y*im.width+x),q=p-4;
   const d=Math.max(...[0,1,2].map(c=>Math.abs(im.data[p+c]-im.data[q+c])));
   diff+=d; high+=(d>18);count++;
  }
  return {texture:count?Math.round(1000*high/count)/1000:0,avg:count?Math.round(100*diff/count)/100:0};
 });
}
const browser=await chromium.launch({headless:true});
try{
 for(const width of [1024,1920]){
  const height=width===1024?768:1080;
  const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
  await page.route('**/cast-rail-current.css*',r=>r.fulfill({status:200,contentType:'text/css',body:css}));
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
  await page.locator('#v5Stack .v5-item[data-slot="3"]').waitFor();
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.querySelectorAll('#v5Stack img')].map(x=>x.decode?.().catch(()=>{})??Promise.resolve()))});
  await page.waitForTimeout(450);
  const injected=await page.addStyleTag({content:''});
  for(const [name,style] of conditions){
   await injected.evaluate((el,body)=>el.textContent=body,style);
   await page.waitForTimeout(360);
   const rects=await page.locator('#v5Stack .v5-item:not(.v6-rail-ghost) .v5-card-inner').evaluateAll(
    els=>els.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})
   );
   const photos=[];
   for(let n=0;n<2;n++){
    const png=await page.screenshot({fullPage:true,animations:'disabled'});
    const scores=inspect(png,rects);
    photos.push(scores);
    if((width===1024 && n===1)||(width===1920&&n===0)){
      await import('node:fs').then(fs=>fs.writeFileSync('rail-paint-diagnostics/'+width+'-'+name+'.png',png));
    }
   }
   console.log('RASTER TEST '+width+' '+name+' '+JSON.stringify(photos));
  }
  await page.close();
 }
}finally{await browser.close()}
