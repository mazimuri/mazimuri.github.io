/* CAST // SIGNAL / minimal anonymous daily aggregation */
(() => {
'use strict';
const cfg=window.CAST_CONFIG||{},key='cast-signal-analytics-exclude',sessionKey='cast-signal-session-v1';
const admin=/\/admin\.html$/i.test(location.pathname);
const get=(storage,k)=>{try{return storage.getItem(k)}catch{return null}};
const set=(storage,k,v)=>{try{storage.setItem(k,v)}catch{}};
const exclude=()=>admin||get(localStorage,key)==='1'||navigator.globalPrivacyControl===true||navigator.doNotTrack==='1'||window.CAST_PUBLIC?.getSoundContext?.()?.mode==='draft';
let pending=new Map(),recent=new Map(),timer=null,ready=false,lastActivity=0,lastPage='',disabled=false;
const allowed=/^[A-Za-z0-9_.-]{1,100}$/;
function enqueue(event,target){
 const id=event+':'+target,now=Date.now();
 if(!allowed.test(target)||pending.has(id)||now-(recent.get(id)||0)<10000)return;
 recent.set(id,now);pending.set(id,{event,target});
 if(recent.size>2000)for(const [k,t] of recent)if(now-t>60000)recent.delete(k);
 if(!timer)timer=setTimeout(flush,1800);
 if(pending.size>=20)flush();
}
function flush(){
 clearTimeout(timer);timer=null;
 if(exclude()||disabled){pending.clear();return}
 if(!pending.size)return;
 const events=[...pending.values()].slice(0,20);
 for(const e of events)pending.delete(e.event+':'+e.target);
 // No retries after ambiguous delivery, avoiding inflated counts.
 fetch(cfg.url+'/rest/v1/rpc/cast_signal_record',{method:'POST',headers:{apikey:cfg.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({events}),keepalive:true,credentials:'omit',referrerPolicy:'no-referrer'}).then(r=>{if([401,403,404].includes(r.status))disabled=true}).catch(()=>{});
 if(pending.size)timer=setTimeout(flush,1000);
}
function source(){
 try{const h=new URL(document.referrer).hostname.toLowerCase();
 if(h===location.hostname)return 'internal';
 if(/(^|\.)(x\.com|twitter\.com|t\.co)$/.test(h))return 'x';
 if(/(^|\.)zeta-ai\.io$/.test(h))return 'zeta';
 if(/(^|\.)(google\.[a-z.]+|bing\.com|search\.yahoo\.co\.jp|yahoo\.com|duckduckgo\.com)$/.test(h))return 'search';
 return 'other'}catch{return 'direct'}
}
function touch(){
 const now=Date.now(),saved=Number(get(sessionStorage,sessionKey)||0);
 const before=Math.max(saved,lastActivity);
 if(!before||now-before>30*60*1000){enqueue('visit','site');enqueue('device',innerWidth<768?'mobile':innerWidth<1100?'tablet':'desktop');enqueue('referrer',source());lastPage=''}
 lastActivity=now;set(sessionStorage,sessionKey,String(now));
}
function emit(event,target='site'){
 if(!ready||exclude()||disabled)return;touch();enqueue(event,String(target))
}
function page(){
 if(!ready||exclude()||disabled)return;
 const hash=location.hash.slice(1).split('/'),section=hash[0],id=hash[1];
 let type='select',identity='select';
 const ctx=window.CAST_PUBLIC?.getSoundContext?.(),doc=ctx?.doc;
 if(!doc)return;
 if(section==='char'&&id&&doc.characters.some(c=>c.id===id)&&['profile','story','gallery','links'].includes(hash[2])){type='profile';identity='profile:'+id}
 else if(section==='world'&&id&&doc.worlds.some(w=>w.id===id)){type='world';identity='world:'+id}
 else if(['index','worlds','about'].includes(section)){type=section;identity=section}
 touch();
 if(lastPage===identity)return;lastPage=identity;
 enqueue('page',type);if(type==='profile'||type==='world')enqueue(type,id);
}
function privacy(){
 const container=document.getElementById('aboutLinks');if(!container||container.querySelector('[data-cast-privacy]'))return;
 const row=document.createElement('div');row.dataset.castPrivacy='1';row.style.cssText='flex-basis:100%;padding:12px 0;font-size:11px;line-height:1.7;opacity:.88';
 const text=document.createElement('span');text.textContent='アクセス解析：訪問・閲覧・楽曲操作等を日別に匿名集計します。IPアドレス・個人ID・閲覧履歴は解析用データに保存しません（サービス側の通信ログを除く）。';
 const button=document.createElement('button');button.type='button';button.style.cssText='margin:8px 0;padding:5px 9px;border:1px solid currentColor;background:transparent;color:inherit;font:inherit;cursor:pointer;display:block';
 const update=()=>{button.textContent=get(localStorage,key)==='1'?'このブラウザの解析除外を解除':'このブラウザの解析を除外する'};
 button.onclick=()=>{if(get(localStorage,key)==='1'){try{localStorage.removeItem(key)}catch{}}else{set(localStorage,key,'1');pending.clear()}update()};update();row.append(text,button);container.append(row)
}
window.CAST_ANALYTICS={emit,page,privacy};
window.addEventListener('pagehide',flush);document.addEventListener('visibilitychange',()=>{if(document.hidden)flush()});
window.addEventListener('hashchange',page);window.addEventListener('popstate',page);
window.addEventListener('storage',e=>{if(e.key===key&&e.newValue==='1'){pending.clear();clearTimeout(timer);timer=null}});
if(!admin&&/^https:\/\/[\w-]+\.supabase\.co$/.test(cfg.url||'')&&cfg.publishableKey){
 Promise.resolve(window.CAST_DATA_READY).then(()=>{ready=true;page();privacy()}).catch(()=>{});
 window.addEventListener('cast-sound-refresh',()=>{page();privacy()});
}
})();
