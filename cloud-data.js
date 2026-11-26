/* CAST // SIGNAL v5.9.7 - Supabase private admin data bridge.
 * Only the Supabase publishable key may be present in cloud-config.js.
 * Access control MUST be enforced by setup.sql (RLS), not this UI.
 */
(() => {
  'use strict';
  const cfg = window.CAST_CONFIG || {};
  const clone = obj => JSON.parse(JSON.stringify(obj));
  const ui = {
    overlay: document.getElementById('cloudLogin'),
    form: document.getElementById('cloudLoginForm'),
    email: document.getElementById('cloudEmail'),
    password: document.getElementById('cloudPassword'),
    button: document.getElementById('cloudLoginButton'),
    status: document.getElementById('cloudLoginStatus')
  };
  const showStatus = message => { ui.status.textContent = message; };
  const hasConfig = /^https:\/\/[\w-]+\.supabase\.co$/.test(cfg.url || '') &&
    typeof cfg.publishableKey === 'string' &&
    cfg.publishableKey.length > 20 && !cfg.publishableKey.startsWith('YOUR_');
  let client = null, draft = null, published = null, seed = null, lastError = '';
  let scheduled = null, waiters = [], queue = Promise.resolve();
  const validDoc = d => d?.version === 5 && d.site &&
    Array.isArray(d.characters) && Array.isArray(d.worlds) && Array.isArray(d.tags);

  async function fromStaticFiles() {
    const parts = await Promise.all(['site','tags','worlds','characters'].map(async name => {
      const res = await fetch(`content/${name}.json`, {cache:'no-store'});
      if (!res.ok) throw new Error(`既存の公開データ ${name}.json を取得できません (HTTP ${res.status})`);
      return res.json();
    }));
    const doc = {version:5, site:parts[0], tags:parts[1], worlds:parts[2], characters:parts[3]};
    if(!validDoc(doc)) throw new Error('既存の公開データの形式が正しくありません');
    return doc;
  }
  async function getRow(kind) {
    const {data,error} = await client.from('cast_documents').select('payload').eq('kind',kind).maybeSingle();
    if(error) throw error;
    return data?.payload || null;
  }
  async function putRow(kind, value) {
    const {error} = await client.from('cast_documents').upsert({kind,payload:value,updated_at:new Date().toISOString()},{onConflict:'kind'});
    if(error) throw error;
  }
  function defaults(doc){
    const d=clone(doc);
    d.site={...(seed?.site||{}),...(d.site||{})};
    d.worlds.forEach(w=>{w.stories??=[];w.firstPublishedAt??=null});
    d.characters.forEach(c=>{
      c.reading??='';c.aliases??='';c.gender??='';c.quote??='';c.relationships??=[];
      c.artPosition??={x:0,y:0,zoom:1};
      c.iconCrop??={x:50,y:Number.isFinite(Number(c.iconPosition))?Number(c.iconPosition):30,zoom:c.icon?1:2.05};
    });
    return d;
  }
  async function initializeDocuments() {
    let loadedPublished=await getRow('published');
    let loadedDraft=await getRow('draft');
    // After the first successful import, GitHub content/*.json is NOT needed.
    // This also allows old exports to be retired once cloud publishing works.
    seed=validDoc(loadedPublished)?clone(loadedPublished):await fromStaticFiles();
    // Never seed a public document from a private draft.
    if(!validDoc(loadedPublished)) {
      loadedPublished=draftToPublic(seed);
      await putRow('published',loadedPublished);
    }
    if(!validDoc(loadedDraft)) {
      loadedDraft=clone(seed);
      await putRow('draft',loadedDraft);
    }
    published=defaults(loadedPublished);
    draft=defaults(loadedDraft);
  }
  function commitDraft() {
    clearTimeout(scheduled);scheduled=null;
    const resolvers=waiters.splice(0);
    if(!resolvers.length)return queue;
    const snapshot=clone(draft);
    queue=queue.catch(()=>{}).then(async()=>{
      try{await putRow('draft',snapshot);lastError='';return true}
      catch(e){lastError=e.message||String(e);console.error('CAST cloud save failed:',e);return false}
    });
    queue.then(ok=>resolvers.forEach(resolve=>resolve(ok)));
    return queue;
  }
  function saveDraft(){
    return new Promise(resolve=>{
      waiters.push(resolve);
      clearTimeout(scheduled);
      scheduled=setTimeout(commitDraft,550);
    });
  }
  async function flushDraft(){
    if(waiters.length)commitDraft();
    return queue;
  }
  function draftToPublic(source) {
    const out=clone(source), chars=out.characters.filter(c=>c.published!==false);
    const worlds=out.worlds.filter(w=>w.published!==false);
    const visibleCharIds=new Set(chars.map(c=>c.id));
    const visibleWorldIds=new Set(worlds.map(w=>w.id));
    chars.forEach(c=>{
      c.worldIds=(c.worldIds||[]).filter(id=>visibleWorldIds.has(id));
      c.relationships=(c.relationships||[]).filter(r=>r.targetId!==c.id && visibleCharIds.has(r.targetId));
    });
    out.characters=chars;
    out.worlds=worlds;
    const visibleTags=new Set(chars.flatMap(c=>c.tagIds||[]));
    out.tags=out.tags.filter(t=>visibleTags.has(t.id));
    return out;
  }
  const isImageData = value => typeof value==='string' && value.startsWith('data:');
  async function publishImages(publicDoc, nextDraft){
    const converted=new Map();
    async function transform(value,label){
      if(!isImageData(value))return value||'';
      if(converted.has(value))return converted.get(value);
      if(!/^data:image\/(?:webp|png|jpeg|gif);base64,/i.test(value))
        throw new Error(label+' の画像形式は公開できません');
      const blob=await (await fetch(value)).blob();
      const ext={'image/webp':'webp','image/png':'png','image/jpeg':'jpg','image/gif':'gif'}[blob.type];
      if(!ext||blob.size>5*1024*1024)throw new Error(label+' は5MB以下のWebP/PNG/JPEG/GIFにしてください');
      const filename=`published/${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const {error}=await client.storage.from('cast-public-media').upload(filename,blob,{contentType:blob.type,cacheControl:'31536000',upsert:false});
      if(error)throw new Error(label+' の画像アップロード失敗: '+error.message);
      const {data}=client.storage.from('cast-public-media').getPublicUrl(filename);
      converted.set(value,data.publicUrl);
      return data.publicUrl;
    }
    for(const c of publicDoc.characters){
      c.artwork=await transform(c.artwork,c.name+' 立ち絵');
      c.icon=await transform(c.icon,c.name+' アイコン');
      for(const g of c.gallery||[])g.image=await transform(g.image,c.name+' ギャラリー');
    }
    for(const w of publicDoc.worlds)w.image=await transform(w.image,w.title+' WORLD画像');
    // Replace image data URIs on the corresponding public characters in the
    // working draft as well, preventing duplicate uploads on future publishes.
    function replaceStoredImage(value){return converted.get(value)||value}
    for(const c of nextDraft.characters){
      if(publicDoc.characters.some(x=>x.id===c.id)){
        c.artwork=replaceStoredImage(c.artwork);c.icon=replaceStoredImage(c.icon);
        for(const g of c.gallery||[])g.image=replaceStoredImage(g.image);
      }
    }
    for(const w of nextDraft.worlds){
      if(publicDoc.worlds.some(x=>x.id===w.id))w.image=replaceStoredImage(w.image);
    }
  }

  // Draft audio is private in the authenticated draft row. Publish only tracks
  // in the filtered public document, using the existing media storage bucket.
  async function publishSoundtracks(publicDoc,nextDraft){
    const converted=new Map();
    async function transform(m,label){
      if(!m?.src||!String(m.src).startsWith('data:'))return;
      const value=m.src;
      if(converted.has(value)){m.src=converted.get(value);return}
      if(!/^data:audio\/mpeg;base64,/i.test(value))throw Error(label+'：MP3形式のみ対応しています');
      const blob=await (await fetch(value)).blob();
      if(blob.size>5*1024*1024)throw Error(label+'：5MB以下のMP3にしてください');
      const filename='published/audio-'+crypto.randomUUID()+'.mp3';
      const {error}=await client.storage.from('cast-public-media').upload(filename,blob,{contentType:'audio/mpeg',cacheControl:'31536000',upsert:false});
      if(error)throw Error(label+'：音源のアップロードに失敗しました。Supabaseのcast-public-mediaバケットがaudio/mpegを許可しているか確認してください。 '+error.message);
      const {data}=client.storage.from('cast-public-media').getPublicUrl(filename);
      converted.set(value,data.publicUrl);m.src=data.publicUrl;
    }
    await transform(publicDoc.site?.soundtrack,'MAIN THEME');
    for(const c of publicDoc.characters)await transform(c.soundtrack,c.name+' SOUNDTRACK');
    const replace=m=>{if(m&&converted.has(m.src))m.src=converted.get(m.src)};
    replace(nextDraft.site?.soundtrack);
    for(const c of nextDraft.characters)if(publicDoc.characters.some(x=>x.id===c.id))replace(c.soundtrack);
  }

  // Verify that a logged-out visitor can read this exact published revision.
  // An authenticated upsert can succeed even when public SELECT is blocked.
  async function verifyPublicVisibility(revision){
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),12000);
    try{
      const url=cfg.url+'/rest/v1/cast_documents?kind=eq.published&select=payload';
      const response=await fetch(url,{
        headers:{apikey:cfg.publishableKey,Accept:'application/json'},
        cache:'no-store',signal:controller.signal
      });
      if(!response.ok)throw new Error('公開データの匿名読み取りに失敗 (HTTP '+response.status+')。Supabaseのpublished行のSELECT権限を確認してください');
      const rows=await response.json(),seen=rows?.[0]?.payload;
      if(!validDoc(seen))throw new Error('公開サイトと同じ接続でpublished行を読み取れません。公開閲覧権限を確認してください');
      if(seen.publicationId!==revision)
        throw new Error('公開データの更新を読み取り側で確認できません。キャッシュ・公開権限を確認してください');
    }finally{clearTimeout(timeout)}
  }
  async function publish(){
    let committed=false;
    try{
      if((await flushDraft())===false)throw new Error(lastError||'下書き保存が失敗しています');
      const now=new Date().toISOString(),next=clone(draft);
      for(const c of next.characters){if(c.published!==false&&!c.firstPublishedAt)c.firstPublishedAt=now}
      for(const w of next.worlds){if(w.published!==false&&!w.firstPublishedAt)w.firstPublishedAt=now}
      const nextPublic=draftToPublic(next);
      // Nonsecret revision: a new value per publish, even for identical data.
      nextPublic.publicationId=crypto.randomUUID();
      nextPublic.publishedAt=now;
      await publishImages(nextPublic,next);
      await publishSoundtracks(nextPublic,next);
      // One-row atomic public data commit.
      await putRow('published',nextPublic);
      committed=true;
      published=defaults(nextPublic);
      draft=defaults(next);
      if(!(await saveDraft()))console.warn('Published, but normalized draft needs saving again');
      await verifyPublicVisibility(nextPublic.publicationId);
      // Let a public tab on the same origin refresh without a manual reload.
      if('BroadcastChannel' in window){
        try{
          const channel=new BroadcastChannel('cast-signal-published');
          channel.postMessage({type:'published',revision:nextPublic.publicationId});
          channel.close();
        }catch(e){console.warn('Published, but cross-tab notification was unavailable',e)}
      }
      lastError='';return true;
    }catch(e){
      const reason=e.message||String(e);
      lastError=(committed?'公開用データはクラウドに保存されましたが、公開サイト側の確認に失敗しました：':'公開できませんでした：')+reason;
      console.error('CAST publish/visibility check failed',e);
      return false;
    }
  }
  async function replaceDraft(value){
    if(!validDoc(value))return false;
    if((await flushDraft())===false)return false;
    const next=defaults(value);
    try{await putRow('draft',next);draft=next;lastError='';return true}
    catch(e){lastError=e.message||String(e);return false}
  }
  async function signOut(){
    if(waiters.length && !(await flushDraft())){
      if(!confirm('未保存の変更があります。それでもログアウトしますか？'))return;
    }
    await client.auth.signOut();location.reload();
  }
  async function loadUser() {
    const {data,error}=await client.auth.getUser();
    if(error||!data?.user)return false;
    try{await initializeDocuments();return true}
    catch(e){lastError=e.message||String(e);console.error('CAST access denied/initialization error:',e);showStatus('管理権限またはデータを確認してください：'+lastError);return false}
  }
  async function requireLogin(){
    if(await loadUser())return;
    return new Promise(resolve=>{
      ui.form.addEventListener('submit', async e=>{
        e.preventDefault();
        ui.button.disabled=true;showStatus('認証中…');
        try{
          const {error}=await client.auth.signInWithPassword({email:ui.email.value.trim(),password:ui.password.value});
          ui.password.value='';
          if(error)throw error;
          if(!(await loadUser())){
            await client.auth.signOut();throw new Error('ログインできましたが、管理者の書き込み権限がありません。setup.sqlとUIDを確認してください。');
          }
          resolve();
        }catch(err){showStatus('ログインできません：'+(err.message||String(err)))}
        finally{ui.button.disabled=false}
      });
      showStatus('メールアドレスとパスワードを入力してください。');
    });
  }
  window.CAST_DATA_READY=(async()=>{
    if(!hasConfig)throw new Error('cloud-config.js にProject URLとPublishable Keyを入力してください。');
    if(!window.supabase?.createClient)throw new Error('Supabaseのライブラリを読み込めません。ネット接続をご確認ください。');
    client=window.supabase.createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
    await requireLogin();
    window.CAST_DATA={
      initial:clone(seed),clone,
      getDraft:()=>draft,getPublished:()=>published,
      getLastError:()=>lastError,
      saveDraft,publish,replaceDraft,
      reset:async()=>replaceDraft(published),
      signOut,
      createId:(prefix)=>`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`
    };
    ui.overlay.hidden=true;
    document.body.classList.remove('cloud-locked');
    return true;
  })().catch(err=>{showStatus('設定を確認してください：'+(err.message||String(err)));console.error(err);throw err});
})();
