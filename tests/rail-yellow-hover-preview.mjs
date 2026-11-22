import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
const url='https://mazimuri.github.io/';
const css=readFileSync('cast-rail-current.css','utf8');
const folder='rail-yellow-hover-review';
mkdirSync(folder,{recursive:true});
const browser=await chromium.launch();
const samples=[];
const box=(el)=>{const r=el.getBoundingClientRect();return {x:+r.x.toFixed(2),y:+r.y.toFixed(2),width:+r.width.toFixed(2),height:+r.height.toFixed(2)}};
async function evaluate(width,height){
 const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,reducedMotion:'reduce'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/cast-rail-current.css*',r=>r.fulfill({contentType:'text/css',status:200,body:css}));
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>{
   const items=[...document.querySelectorAll('#v5Stack .v5-item:not(.v6-rail-ghost)')];
   return items.length===4&&items.every(item=>{
      const img=item.querySelector('.v5-card-inner img');
      return img?.complete&&img.naturalWidth>0;
   });
 },null,{timeout:40000});
 await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.querySelectorAll('#v5Stack img')].map(i=>i.decode().catch(()=>{})))});
 await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;caret-color:transparent!important}'});
 const tag=width+'x'+height;
 const read=async(slot)=>page.locator('#v5Stack .v5-item[data-slot="'+slot+'"] .v5-card').evaluate(el=>{
   const outer=el.querySelector('.v5-card-outer');
   const name=el.querySelector('.v5-card-name');
   const img=el.querySelector('img');
   const b=el.getBoundingClientRect();
   const styles=getComputedStyle(outer),im=getComputedStyle(img);
   return {card:{x:b.x,y:b.y,w:b.width,h:b.height},
      border:styles.borderTopColor,outline:styles.outlineColor,
      shadow:styles.boxShadow,
      fasciaBorder:getComputedStyle(name).borderTopColor,
      image:{objectPosition:im.objectPosition,transform:im.transform,filter:im.filter},
      cardAria:el.getAttribute('aria-label')};
 });
 const none=await read(3);
 await page.screenshot({path:folder+'/'+tag+'-REST.png',animations:'disabled'});
 const slots=[0,1,2,3];
 for(const slot of slots){
   const card=page.locator('#v5Stack .v5-item[data-slot="'+slot+'"] .v5-card');
   try{await card.hover({timeout:8000});}
   catch(e){throw Error('Cannot reach selectable rail card '+slot+' at '+tag+': '+e.message.slice(0,900))}
   await page.waitForTimeout(200);
   const hover=await read(slot);
   assert.equal(hover.border,'rgb(234, 255, 85)','Card shell should turn yellow on hover: '+tag+' '+slot);
   assert.equal(hover.fasciaBorder,'rgb(234, 255, 85)','Name line should turn yellow on hover: '+tag+' '+slot);
   const shifted=Math.abs(hover.card.w-none.card.w);
   assert.ok(hover.card.w>100&&hover.card.h>25,'Card remains usable');
   const name=hover.cardAria;assert.ok(name&&name.length>=2,'Accessible name preserved');
   const imgSame=await page.locator('#v5Stack .v5-item[data-slot="'+slot+'"] .v5-card img').evaluate(img=>({pos:getComputedStyle(img).objectPosition,zoom:getComputedStyle(img).transform}));
   if(slot===3){
      assert.deepEqual(hover.image,none.image,'Selected image crop/filter should not change on hover');
      await page.screenshot({path:folder+'/'+tag+'-HOVER-front.png',animations:'disabled'});
   }
   if(slot===1)await page.screenshot({path:folder+'/'+tag+'-HOVER-rear.png',animations:'disabled'});
 }
 // Simulate focus-visible via keyboard navigation to validate yellow focus ring.
 await page.mouse.move(5,5);
 await page.keyboard.press('Tab');
 await page.evaluate(()=>{
   const el=document.querySelector('#v5Stack .v5-item[data-slot="3"] .v5-card');
   el.focus();
 });
 const focus=await page.locator('#v5Stack .v5-item[data-slot="3"] .v5-card').evaluate(el=>({
  focusVisible:el.matches(':focus-visible'),
  border:getComputedStyle(el.querySelector('.v5-card-outer')).borderTopColor
 }));
 assert.equal(focus.border,'rgb(234, 255, 85)','Keyboard focus must use yellow shell');
 assert.deepEqual(errors,[], 'Unexpected JS errors: '+JSON.stringify(errors));
 samples.push({tag,rest:none,keyboard:focus,errors});
 await page.close();
 console.log('RAIL YELLOW HOVER PASS '+tag+' '+JSON.stringify({keyboard:focus,restBorder:none.border,hoverColor:'#eaff55',slots:slots.length}));
}
try{
 await evaluate(1920,911);
 await evaluate(2560,1271);
 writeFileSync(folder+'/metrics.json',JSON.stringify(samples,null,2));
 console.log('ALL HOVER TESTS PASS');
}finally{await browser.close();}
