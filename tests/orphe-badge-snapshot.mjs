import {chromium} from 'playwright';
const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1920,height:911}});
await page.goto('https://mazimuri.github.io/',{waitUntil:'domcontentloaded',timeout:60000});
await page.waitForFunction(()=>window.CAST_DATA?.getPublished()?.characters?.length>=4,null,{timeout:45000});
const result=await page.evaluate(()=>{
 const all=window.CAST_DATA.getPublished().characters;
 const orphe=all.find(c=>c.id==='orphe'||c.name?.includes('オルフェ'));
 return {
  orphe:{id:orphe?.id,fileBadgePosition:orphe?.fileBadgePosition??null,fileBadgePositionMobile:orphe?.fileBadgePositionMobile??null},
  others:all.filter(c=>c!==orphe).slice(0,8).map(c=>({id:c.id,desktop:c.fileBadgePosition??null,mobile:c.fileBadgePositionMobile??null})),
  publishedCount:all.length
 };
});
console.log('BADGE POSITION SNAPSHOT '+JSON.stringify(result));
await browser.close();
