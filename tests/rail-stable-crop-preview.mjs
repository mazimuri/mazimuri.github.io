import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';

const repo='https://mazimuri.github.io/';
const fileNames=['cast-side-rail.css','cast-rail-current.css'];
const before=Object.fromEntries(fileNames.map(f=>[f,execFileSync('git',['show','origin/main:'+f],{encoding:'utf8',maxBuffer:3000000})]));
const after=Object.fromEntries(fileNames.map(f=>[f,readFileSync(f,'utf8')]));
const targets=[[1920,911],[2560,1271],[1440,900],[1024,768],[2560,911]];
const dir='rail-stable-crop-review';
mkdirSync(dir,{recursive:true});
const browser=await chromium.launch();
const records=[];
try{
 for(const [width,height] of targets){
  for(const phase of ['before','after']){
   const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,reducedMotion:'reduce'});
   for(const f of fileNames){
    await page.route('**/'+f+'*',r=>r.fulfill({contentType:'text/css',status:200,body:(phase==='before'?before:after)[f]}));
   }
   await page.goto(repo,{waitUntil:'domcontentloaded',timeout:60000});
   await page.waitForFunction(()=>{
    const els=[...document.querySelectorAll('#v5Stack .v5-item:not(.v6-rail-ghost)')];
    return els.length===4 && els.every(el=>{
     const img=el.querySelector('.v5-card-inner img');
     return img?.complete && img.naturalWidth>0;
    });
   },null,{timeout:40000});
   await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.querySelectorAll('#v5Stack img')].map(i=>i.decode?.().catch(()=>{})))});
   await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}'});
   const geometry=await page.evaluate(()=>{
    const box=e=>{const r=e.getBoundingClientRect();return {x:+r.x.toFixed(2),y:+r.y.toFixed(2),width:+r.width.toFixed(2),height:+r.height.toFixed(2)};};
    const rail=document.getElementById('v5Rail');
    const items=[0,1,2,3].map(n=>{
     const el=document.querySelector('#v5Stack .v5-item[data-slot="'+n+'"]');
     const image=el.querySelector('.v5-card-inner');
     const img=image.querySelector('img');
     const name=el.querySelector('.v5-card-name');
     return {slot:n,item:box(el),image:box(image),imageLayout:[image.offsetWidth,image.offsetHeight],
      ratio:+(image.offsetWidth/image.offsetHeight).toFixed(5),name:box(name),
      crop:img.getAttribute('style'),objectFit:getComputedStyle(img).objectFit,
      position:getComputedStyle(img).objectPosition};
    });
    return {viewport:[innerWidth,innerHeight],rail:box(rail),items,documentWidth:document.documentElement.scrollWidth};
   });
   assert.ok(geometry.rail.width>150 && geometry.rail.height>500,'rail dimension invalid');
   assert.ok(geometry.items.every(i=>i.imageLayout[0]>60 && i.imageLayout[1]>25),'image bay clipped');
   assert.ok(geometry.items.every(i=>i.objectFit==='cover'),'image fit regressed');
   // The existing site may already have intentional horizontal overhang from its
   // decorative diagonal hero. Compare the new CSS against that baseline
   // rather than incorrectly requiring a perfectly zero-overflow document.
   if(phase==='after'){
    const prior=records.find(r=>r.width===width&&r.height===height&&r.phase==='before');
    assert.ok(geometry.documentWidth<=Math.max(width,prior.documentWidth)+3,
      'new horizontal page overflow');
   }
   records.push({width,height,phase,...geometry});
   console.log('RAIL '+width+'x'+height+' '+phase+' geometry='+JSON.stringify({rail:geometry.rail,ratios:geometry.items.map(i=>i.ratio),imageDims:geometry.items.map(i=>i.imageLayout)}));
   if((width===1920&&height===911)||(width===2560&&height===1271))
    await page.screenshot({path:dir+'/'+width+'x'+height+'-'+phase+'.png',animations:'disabled'});
   await page.close();
  }
 }
 const get=(width,height,phase)=>records.find(r=>r.width===width&&r.height===height&&r.phase===phase);
 const fh=get(1920,911,'after'),k=get(2560,1271,'after');
 for(let i=0;i<4;i++){
  const gap=Math.abs(fh.items[i].ratio/k.items[i].ratio-1);
  assert.ok(gap<=.035,'ratio differs Full HD / 2K slot '+i+': '+gap);
 }
 for(const run of [fh,k,get(1440,900,'after'),get(2560,911,'after')]){
  for(let i=0;i<3;i++){
   const end=run.items[i].item.y+run.items[i].item.height;
   const space=run.items[i+1].item.y-end;
   assert.ok(space>=5,'card '+i+' fascia is covered at '+run.width+'x'+run.height+': gap '+space);
  }
  const last=run.items[3];
  const railBottom=run.rail.y+run.rail.height;
  assert.ok(last.item.y+last.item.height<=railBottom+2,
    'front card overflows stage at '+run.width+'x'+run.height);
 }
 const previous=get(1920,911,'before');
 assert.ok(fh.items[3].item.y<previous.items[3].item.y-10,'Full HD card spacing did not compress as intended');
 assert.ok(Math.abs(k.items[3].item.y-get(2560,1271,'before').items[3].item.y)<2,
   '2K approved vertical arrangement changed unexpectedly');
 console.log('FULLHD VS 2K delta before='+JSON.stringify(previous.items.map((v,i)=>+(v.ratio/get(2560,1271,'before').items[i].ratio-1).toFixed(3))));
 console.log('FULLHD VS 2K delta after='+JSON.stringify(fh.items.map((v,i)=>+(v.ratio/k.items[i].ratio-1).toFixed(3))));
 writeFileSync(dir+'/metrics.json',JSON.stringify(records,null,2));
 console.log('ASPECT LOCK VISUAL TEST PASS');
}finally{await browser.close();}
