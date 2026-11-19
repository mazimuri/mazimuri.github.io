/* CAST / SIGNAL v5.9.7 — PUBLIC, READ-ONLY CONTENT BRIDGE.
   Loads exported GitHub Pages files; no local drafts, admin or credentials. */
(() => {
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));
  let published = {version:5,site:{},tags:[],worlds:[],characters:[]};
  async function load() {
    try {
      const names = ['site','tags','worlds','characters'];
      const loaded = await Promise.all(names.map(async name => {
        const response = await fetch(`content/${name}.json`, {cache:'no-store'});
        if (!response.ok) throw new Error(`${name}.json: HTTP ${response.status}`);
        return response.json();
      }));
      const [site,tags,worlds,characters] = loaded;
      if (!site || !Array.isArray(tags) || !Array.isArray(worlds) || !Array.isArray(characters)) {
        throw new Error('Invalid exported content');
      }
      published = {version:5,site,tags,worlds,characters};
    } catch (error) {
      console.error('CAST / SIGNAL — public content failed to load:', error);
      const report = () => {
        const notice = document.createElement('div');
        notice.setAttribute('role','alert');
        notice.style.cssText='position:fixed;z-index:99999;bottom:12px;left:12px;right:12px;max-width:520px;background:#fff3a0;color:#161616;padding:15px;border:2px solid #171717;font:700 14px/1.5 sans-serif;box-shadow:5px 5px 0 #111';
        notice.textContent='キャラクターデータの読み込みに失敗しました。ページを再読み込みしてください。';
        document.body.appendChild(notice);
      };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', report, {once:true});
      else report();
    }
  }
  window.CAST_DATA = {
    initial: published,
    clone,
    getPublished: () => clone(published),
    getDraft: () => clone(published)
  };
  window.CAST_DATA_READY = load();
})();
