/* Functional browser regression for private editor context and character-switch actions.
 * Runs with: node tests/admin-cast-navigation.mjs
 * No login, network, or production Supabase mutations.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';
const admin=readFileSync(new URL('../admin.js',import.meta.url),'utf8');
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 await page.setContent(`<!doctype html><html><head><style>#cropCanvas{display:block;width:200px;height:200px}#cropMainImg{display:block;width:200px;height:200px}</style></head><body>
  <button id="openAdmin"></button><button id="adminExit"></button><button id="adminPreview"></button>
  <button id="adminPublish"></button><button id="backToAdmin"></button><button id="cloudLogout"></button>
  <div id="admin" hidden><div id="adminStatus"></div><div id="adminPath"></div>
  <span id="saveStatus"></span><button data-admin-section="characters"></button>
  <button data-admin-section="dashboard"></button><div class="admin-workspace"><div id="adminContent"></div></div></div>
  </body></html>`);
 await page.evaluate(src=>{
   const palette={accent:'#e8fa42',deep:'#141719',soft:'#f1eeee',bright:'#e8fa42'};
   const mk=(id,name)=>({id,name,roman:name,colors:{...palette},iconCrop:{x:50,y:50,zoom:1},
     mobileIconCrop:{x:50,y:50,zoom:1},allCastCrop:{x:50,y:50,zoom:1},artPosition:{x:0,y:0,zoom:1},
     tagIds:[],worldIds:[],works:[],links:[],fields:[],gallery:[],relationships:[]});
   const doc={characters:[mk('char-a','Alpha'),mk('char-b','Beta')],worlds:[],tags:[],site:{newDays:7}};
   window.__previewLog=[];
   window.CAST_DATA_READY=Promise.resolve();
   window.CAST_DATA={getDraft:()=>doc,getPublished:()=>doc,initial:{site:doc.site},
     saveDraft:async()=>true};
   window.CAST_PUBLIC={refresh:m=>window.__previewLog.push(['refresh',m]),
     openCharacter:id=>window.__previewLog.push(['openCharacter',id]),
     toast:m=>window.__previewLog.push(['toast',m])};
   new Function(src)();
 },admin);
 await page.waitForSelector('#adminContent [data-action="edit-char"]');
 await page.locator('#adminContent [data-action="edit-char"][data-id="char-a"]').click();
 assert.match(await page.locator('#adminContent .edit-cast-navigation').innerText(),/001 \/ 002/);
 assert.equal(await page.locator('#adminContent [data-action="edit-prev"]').isDisabled(),true);
 await page.locator('#adminContent [data-char-tab="visual"]').click();
 assert.equal(await page.locator('#adminContent [data-char-tab="visual"]').getAttribute('class'),'active');
 await page.locator('#adminContent [data-action="edit-next"]').click();
 assert.match(await page.locator('#adminContent .edit-cast-navigation').innerText(),/002 \/ 002/);
 assert.equal(await page.locator('#adminContent [data-char-tab="visual"]').getAttribute('class'),'active',
  'Changing character must keep the current editor tab');
 assert.equal(await page.locator('#adminContent [data-action="edit-next"]').isDisabled(),true);
 await page.locator('#adminPreview').click();
 const events=await page.evaluate(()=>window.__previewLog);
 assert.ok(events.some(([type,mode])=>type==='refresh'&&mode==='draft'));
 assert.ok(events.some(([type,id])=>type==='openCharacter'&&id==='char-b'),
  'Top draft preview must open the selected character');
 await page.locator('#backToAdmin').click();
 assert.match(await page.locator('#adminContent .edit-cast-navigation').innerText(),/002 \/ 002/);
 assert.equal(await page.locator('#adminContent [data-char-tab="visual"]').getAttribute('class'),'active');
 await page.locator('#adminContent [data-action="edit-prev"]').click();
 assert.match(await page.locator('#adminContent .edit-cast-navigation').innerText(),/001 \/ 002/);
 await page.locator('#adminContent [data-action="crop-mode"][data-view="mobile"]').click();
 const frame=await page.locator('#cropCanvas').boundingBox();
 assert.ok(frame&&frame.width>100&&frame.height>100,'Square mobile drag surface must be sized');
 await page.mouse.move(frame.x+frame.width/2,frame.y+frame.height/2);
 await page.mouse.down();
 await page.mouse.move(frame.x+frame.width/2-30,frame.y+frame.height/2,{steps:4});
 await page.mouse.up();
 assert.match(await page.locator('#cropZoomLabel').innerText(),/1\.30/,
   'A 1x square crop should auto-zoom when the user drags horizontally');
 assert.notEqual(await page.locator('#cropXLabel').innerText(),'50%',
   'Dragging a square mobile icon must actually change the X position');
 console.log('PASS: PREV/NEXT preserve editor tab, selected draft preview, and 1x square mobile drag pan');
}finally{await browser.close()}
