/* CAST // SIGNAL v5.9.7 - PUBLIC, READ-ONLY online data bridge.
 * Use ONLY after cloud admin setup/login/testing is successful.
 * Never fetch the private 'draft' row on public pages.
 */
(() => {
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));
  const cfg = window.CAST_CONFIG || {};
  let published = {version:5,site:{},tags:[],worlds:[],characters:[]};
  const valid = d => d?.version===5 && d.site &&
    Array.isArray(d.tags) && Array.isArray(d.worlds) && Array.isArray(d.characters);

  async function fromGitHub() {
    const [site,tags,worlds,characters] = await Promise.all(['site','tags','worlds','characters'].map(async name => {
      const r=await fetch(`content/${name}.json`, {cache:'no-store'});
      if(!r.ok)throw new Error(`${name}.json: HTTP ${r.status}`);
      return r.json();
    }));
    return {version:5,site,tags,worlds,characters};
  }
  async function fromCloud() {
    const project=/^https:\/\/[\w-]+\.supabase\.co$/.test(cfg.url||'');
    const key=typeof cfg.publishableKey==='string' && cfg.publishableKey.length>20 && !cfg.publishableKey.startsWith('YOUR_');
    if(!project||!key)throw new Error('Supabase config not set');
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),9000);
    try{
      const url=cfg.url+'/rest/v1/cast_documents?kind=eq.published&select=payload';
      const response=await fetch(url,{
        headers:{'apikey':cfg.publishableKey,'Accept':'application/json'},
        cache:'no-store',signal:controller.signal
      });
      if(!response.ok)throw new Error(`Supabase: HTTP ${response.status}`);
      const rows=await response.json(), doc=rows?.[0]?.payload;
      if(!valid(doc))throw new Error('published row not initialized');
      return doc;
    }finally{clearTimeout(timeout)}
  }
  async function load(){
    try{
      // Once configured, never fall back to old GitHub JSON. Old JSON may
      // contain characters subsequently unpublished from Supabase.
      const configured=/^https:\/\/[\w-]+\.supabase\.co$/.test(cfg.url||'') &&
        typeof cfg.publishableKey==='string' && cfg.publishableKey.length>20 && !cfg.publishableKey.startsWith('YOUR_');
      published=configured?await fromCloud():await fromGitHub();
      if(!valid(published))throw new Error('Invalid published data');
    }catch(error){
      console.error('CAST / SIGNAL public content failed:',error);
      const report=()=>{
        const notice=document.createElement('div');
        notice.setAttribute('role','alert');
        notice.style.cssText='position:fixed;z-index:99999;bottom:12px;left:12px;right:12px;max-width:520px;background:#fff3a0;color:#161616;padding:15px;border:2px solid #171717;font:700 14px/1.5 sans-serif;box-shadow:5px 5px 0 #111';
        notice.textContent='キャラクターデータの読み込みに失敗しました。ページを再読み込みしてください。';
        document.body.appendChild(notice);
      };
      if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',report,{once:true});
      else report();
    }
  }
  window.CAST_DATA={initial:published,clone,getPublished:()=>clone(published),getDraft:()=>clone(published)};
  window.CAST_DATA_READY=load();

  // The published document is fetched at initial page load. If an editor
  // publishes while the visitor keeps this tab open, check the PUBLIC row when
  // the tab is revisited. Never request private draft data from the public app.
  let checkingPublished=false,lastPublishedCheck=0;
  async function checkPublishedWhenActive(){
    if(checkingPublished||document.hidden||/\/admin\.html$/i.test(location.pathname))return;
    const now=Date.now();
    if(now-lastPublishedCheck<3000)return;
    checkingPublished=true;lastPublishedCheck=now;
    try{
      await window.CAST_DATA_READY;
      const configured=/^https:\/\/[\w-]+\.supabase\.co$/.test(cfg.url||'')
        && typeof cfg.publishableKey==='string'
        && cfg.publishableKey.length>20
        && !cfg.publishableKey.startsWith('YOUR_');
      const latest=configured?await fromCloud():await fromGitHub();
      if(valid(latest)&&JSON.stringify(latest)!==JSON.stringify(published)){
        published=latest;
        window.CAST_PUBLIC?.refresh?.('published');
      }
    }catch(error){console.warn('CAST / SIGNAL public data recheck failed:',error)}
    finally{checkingPublished=false}
  }
  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden)checkPublishedWhenActive();
  });
  window.addEventListener('focus',checkPublishedWhenActive);
  window.addEventListener('pageshow',event=>{
    if(event.persisted)checkPublishedWhenActive();
  });
})();
