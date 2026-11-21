import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {PNG} from 'pngjs';

const css=readFileSync('cast-rail-current.css','utf8');
const site='https://mazimuri.github.io/';
const output='anchored-shadow-review';
mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true});
function texture(bytes,rects){
 const im=PNG.sync.read(bytes);
 return rects.map(r=>{
  let count=0,rough=0;
  const xa=Math.max(1,Math.floor(r.x+r.width*.22)),xb=Math.min(im.width-1,Math.floor(r.x+r.width*.78));
  const ya=Math.max(0,Math.floor(r.y+r.height*.2)),yb=Math.min(im.height-1,Math.floor(r.y+r.height*.67));
  for(let y=ya;y<yb;y+=2)for(let x=xa+1;x<xb;x+=2){
   const p=(y*im.width+x)*4,q=p-4;
   rough+=Number(Math.max(...[0,1,2].map(ch=>Math.abs(im.data[p+ch]-im.data[q+ch])))>18);count++;
  }
  return count?rough/count:0;
 });
}
async function capture(page,path){
 let last=[];
 for(let attempt=0;attempt<10;attempt++){
   await page.waitForTimeout(280);
   const rects=await page.locator('#v5Stack .v5-item:not(.v6-rail-ghost) .v5-card-inner').evaluateAll(
     els=>els.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}})
   );
   const png=await page.screenshot({fullPage:true,animations:'disabled'});
   last=texture(png,rects);
   if(last.length===4&&last.every(x=>x>.013)){
     writeFileSync(path,png);console.log('CAPTURE VERIFIED '+path+' attempts='+attempt+' texture='+last.map(x=>x.toFixed(2)));
     return;
   }
 }
 throw new Error('No valid screenshot after retries: '+path+' texture='+last);
}
try{
 for(const [width,height] of [[1024,768],[1920,1080],[2560,1440]]){
  const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
  let intercepted=false;
  await page.route('**/cast-rail-current.css*',r=>{intercepted=true;return r.fulfill({status:200,contentType:'text/css',body:css})});
  await page.goto(site,{waitUntil:'domcontentloaded',timeout:45000});
  await page.locator('#v5Stack .v5-item[data-slot="3"] .v5-card').waitFor();
  assert.equal(intercepted,true,'Candidate CSS not injected');
  await page.evaluate(async()=>{
   await document.fonts.ready;
   await Promise.all([...document.querySelectorAll('#v5Stack img')].map(i=>i.decode?.().catch(()=>{})??Promise.resolve()));
  });
  const card=page.locator('#v5Stack .v5-item[data-slot="3"] .v5-card');
  await page.mouse.move(0,0);
  await page.waitForTimeout(250);
  const before=await card.evaluate(el=>{
    const outer=el.querySelector('.v5-card-outer'),img=el.querySelector('img');
    const pseudo=getComputedStyle(el,'::before'),shell=getComputedStyle(outer);
    const c=el.getBoundingClientRect(),r=outer.getBoundingClientRect();
    return {card:[c.x,c.y,c.width,c.height],outer:[r.x,r.y,r.width,r.height],
      pseudoShadow:pseudo.boxShadow,pseudoTransform:pseudo.transform,pseudoContent:pseudo.content,
      shellShadow:shell.boxShadow,shellTranslate:shell.translate,filter:getComputedStyle(img).filter,
      pseudoDisplay:pseudo.display,outerZ:shell.zIndex};
  });
  assert.notEqual(before.pseudoShadow,'none','Stationary shadow is not rendered');
  assert.ok(before.pseudoContent==='""'||before.pseudoContent==="''",'Shadow pseudo element missing: '+before.pseudoContent);
  assert.ok(before.shellShadow.startsWith('rgba(')||before.shellShadow.includes('inset'),
      'Visible plate still has an external cast-shadow');
  if(width>=1920)await capture(page,output+'/fixed-shadow-'+width+'-rest.png');
  await card.hover({force:true});
  await page.waitForTimeout(310);
  const after=await card.evaluate(el=>{
    const outer=el.querySelector('.v5-card-outer'),img=el.querySelector('img');
    const pseudo=getComputedStyle(el,'::before'),shell=getComputedStyle(outer);
    const c=el.getBoundingClientRect(),r=outer.getBoundingClientRect();
    return {card:[c.x,c.y,c.width,c.height],outer:[r.x,r.y,r.width,r.height],
      pseudoShadow:pseudo.boxShadow,pseudoTransform:pseudo.transform,pseudoContent:pseudo.content,
      shellShadow:shell.boxShadow,shellTranslate:shell.translate,filter:getComputedStyle(img).filter,
      pseudoDisplay:pseudo.display,outerZ:shell.zIndex};
  });
  assert.deepEqual(after.card,before.card,'Shadow anchor moved during hover');
  assert.equal(after.pseudoShadow,before.pseudoShadow,'Shadow layer changed color/position');
  assert.equal(after.pseudoTransform,before.pseudoTransform,'Shadow layer rotated during hover');
  assert.equal(after.filter,before.filter,'Image filter changed on hover');
  assert.equal(after.shellShadow,before.shellShadow,'Outer plate bevel changed on hover');
  assert.ok(Math.abs((after.outer[0]-before.outer[0])+2)<.6,'Face plate X movement incorrect: '+(after.outer[0]-before.outer[0]));
  assert.ok(Math.abs((after.outer[1]-before.outer[1])+2)<.6,'Face plate Y movement incorrect: '+(after.outer[1]-before.outer[1]));
  if(width>=1920)await capture(page,output+'/fixed-shadow-'+width+'-hover.png');
  console.log('ANCHORED SHADOW PASS '+width+'x'+height+' fixed card='+before.card.slice(0,2)+' moving plate: '+after.outer[0]+'/'+after.outer[1]);
  await page.close();
 }
 console.log('ANCHORED-SHADOW PREVIEW PASS: fixed shadow, lifted plate, unchanged image filters.');
}finally{await browser.close()}
