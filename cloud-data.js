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
  let scheduled = null, waiters = [], queue = Promise.resolve(), draftError = '';
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
      try{await putRow('draft',snapshot);draftError='';lastError='';return true}
      catch(e){draftError=e.message||String(e);lastError=draftError;console.error('CAST cloud save failed:',e);return false}
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
  async function flushDraft({retry=false}={}){
    if(waiters.length)commitDraft();
    const ok=await queue;
    if(ok!==false||!retry)return ok;
    const pending=saveDraft();
    commitDraft();
    return pending;
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
  const PRIVATE_AUDIO='private-audio:',AUDIO_LIMIT=15*1024*1024;
  const isPrivateAudio=value=>typeof value==='string'&&value.startsWith(PRIVATE_AUDIO);
  function privateAudioPath(value){
    const path=String(value).slice(PRIVATE_AUDIO.length);
    if(!/^published\/audio-[0-9a-f-]{36}\.mp3$/i.test(path))throw Error('非公開音源の参照先が正しくありません');
    return path;
  }
  const audioModels=d=>[d.site?.soundtrack,...d.characters.map(c=>c.soundtrack)].filter(Boolean);
  function validateAudioBlob(blob){
    if(!blob||blob.size<=0||blob.size>AUDIO_LIMIT)throw Error('MP3形式・15MB以下の音源を選んでください');
  }
  async function storePrivateAudio(blob){
    validateAudioBlob(blob);
    const path='published/audio-'+crypto.randomUUID()+'.mp3';
    const {error}=await client.storage.from('cast-private-media').upload(path,blob,{contentType:'audio/mpeg',cacheControl:'0',upsert:false});
    if(error)throw Error('非公開音源の保存に失敗：'+error.message);
    return PRIVATE_AUDIO+path;
  }
  async function readPrivateAudio(value){
    const {data,error}=await client.storage.from('cast-private-media').download(privateAudioPath(value));
    if(error||!data)throw Error('非公開音源の取得に失敗：'+(error?.message||'ファイルなし'));
    validateAudioBlob(data);return data;
  }
  async function audioPreviewURL(value){
    if(!isPrivateAudio(value))return value||'';
    const {data,error}=await client.storage.from('cast-private-media').createSignedUrl(privateAudioPath(value),3600);
    if(error||!data?.signedUrl)throw Error('非公開音源の試聴URLを取得できません：'+(error?.message||'URLなし'));
    return data.signedUrl;
  }
  async function previewDraft(){
    const result=clone(draft);
    await Promise.all(audioModels(result).map(async m=>{if(isPrivateAudio(m.src))m.src=await audioPreviewURL(m.src)}));
    return result;
  }
  function audioDataURI(blob){return new Promise((resolve,reject)=>{
    const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).replace(/^data:[^;]*;base64,/,'data:audio/mpeg;base64,'));
    reader.onerror=()=>reject(Error('音源のバックアップ変換に失敗'));reader.readAsDataURL(blob);
  })}
  // Keep the existing JSON/ZIP export portable for unpublished audio.
  async function exportDraft({charIds=null}={}){
    const result=clone(draft),converted=new Map();
    if(Array.isArray(charIds))result.characters=result.characters.filter(c=>charIds.includes(c.id));
    for(const m of audioModels(result)){
      if(!isPrivateAudio(m.src))continue;
      const value=m.src;
      if(!converted.has(value))converted.set(value,await audioDataURI(await readPrivateAudio(value)));
      m.src=converted.get(value);
    }
    return result;
  }
  async function importAudioReferences(d){
    const converted=new Map();
    for(const m of audioModels(d)){
      if(!/^data:audio\/mpeg;base64,/i.test(m.src||''))continue;
      const value=m.src;
      if(!converted.has(value))converted.set(value,await storePrivateAudio(await (await fetch(value)).blob()));
      m.src=converted.get(value);
    }
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
    if(publicDoc.site?.soundtrack?.jacket)publicDoc.site.soundtrack.jacket=await transform(publicDoc.site.soundtrack.jacket,'MAIN THEME JACKET');
    for(const c of publicDoc.characters){
      if(c.soundtrack?.jacket)c.soundtrack.jacket=await transform(c.soundtrack.jacket,c.name+' JACKET');
      c.artwork=await transform(c.artwork,c.name+' 立ち絵');
      c.icon=await transform(c.icon,c.name+' アイコン');
      for(const g of c.gallery||[])g.image=await transform(g.image,c.name+' ギャラリー');
    }
    for(const w of publicDoc.worlds)w.image=await transform(w.image,w.title+' WORLD画像');
    // Replace image data URIs on the corresponding public characters in the
    // working draft as well, preventing duplicate uploads on future publishes.
    function replaceStoredImage(value){return converted.get(value)||value}
    if(nextDraft.site?.soundtrack?.jacket)nextDraft.site.soundtrack.jacket=replaceStoredImage(nextDraft.site.soundtrack.jacket);
    for(const c of nextDraft.characters){
      if(publicDoc.characters.some(x=>x.id===c.id)){
        if(c.soundtrack?.jacket)c.soundtrack.jacket=replaceStoredImage(c.soundtrack.jacket);
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
      if(!m?.src||(!String(m.src).startsWith('data:')&&!isPrivateAudio(m.src)))return;
      const value=m.src;
      if(converted.has(value)){m.src=converted.get(value);return}
      if(!isPrivateAudio(value)&&!/^data:audio\/mpeg;base64,/i.test(value))throw Error(label+'：MP3形式のみ対応しています');
      const blob=isPrivateAudio(value)?await readPrivateAudio(value):await (await fetch(value)).blob();
      validateAudioBlob(blob);
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
    let committed=false,stage='下書き保存';
    try{
      if((await flushDraft({retry:true}))===false)throw new Error(draftError||'下書き保存が失敗しています');
      const now=new Date().toISOString(),next=clone(draft);
      for(const c of next.characters){if(c.published!==false&&!c.firstPublishedAt)c.firstPublishedAt=now}
      for(const w of next.worlds){if(w.published!==false&&!w.firstPublishedAt)w.firstPublishedAt=now}
      const nextPublic=draftToPublic(next);
      // Nonsecret revision: a new value per publish, even for identical data.
      nextPublic.publicationId=crypto.randomUUID();
      nextPublic.publishedAt=now;
      stage='画像・ジャケットの公開';
      await publishImages(nextPublic,next);
      stage='音源の公開';
      await publishSoundtracks(nextPublic,next);
      // One-row atomic public data commit.
      stage='公開データ保存';
      await putRow('published',nextPublic);
      committed=true;
      published=defaults(nextPublic);
      draft=defaults(next);
      stage='公開後の下書き保存';
      const normalized=await saveDraft();
      stage='匿名閲覧の確認';
      await verifyPublicVisibility(nextPublic.publicationId);
      // Let a public tab on the same origin refresh without a manual reload.
      if('BroadcastChannel' in window){
        try{
          const channel=new BroadcastChannel('cast-signal-published');
          channel.postMessage({type:'published',revision:nextPublic.publicationId});
          channel.close();
        }catch(e){console.warn('Published, but cross-tab notification was unavailable',e)}
      }
      if(!normalized){lastError='公開済み・閲覧確認済みですが、下書きの再保存に失敗しました：'+draftError;return false}
      lastError='';return true;
    }catch(e){
      const reason=e.message||String(e);
      lastError=(committed?'公開データ保存済み／':'')+'['+stage+'] '+reason;
      console.error('CAST publish/visibility check failed',e);
      return false;
    }
  }
  async function replaceDraft(value){
    if(!validDoc(value))return false;
    if((await flushDraft())===false)return false;
    const next=defaults(value);
    try{await importAudioReferences(next);await putRow('draft',next);draft=next;lastError='';return true}
    catch(e){lastError=e.message||String(e);return false}
  }
  // Inventory is deliberately limited to the managed published/ directory in each bucket.
  const resourceBuckets=['cast-public-media','cast-private-media'];
  const resourcePrefix='published/';
  const resourceKey=(bucket,path)=>bucket+'/'+path;
  const resourcePathOK=path=>/^published\/(?:audio-[0-9a-f-]{36}\.mp3|\d+-[0-9a-f-]{36}\.(?:webp|png|jpg|jpeg|gif))$/i.test(path);
  async function scanResources(){
    const latest=await Promise.all([getRow('draft'),getRow('published')]);
    if(!latest.every(validDoc))throw Error('保存済みの下書き・公開データを確認できません');
    const origin=new URL(cfg.url).origin,refs=new Map(),docs=[...latest,draft,published],serialized=docs.map(d=>JSON.stringify(d));
    function add(bucket,path,label){
      const key=resourceKey(bucket,path);
      if(!refs.has(key))refs.set(key,new Set());
      refs.get(key).add(label);
    }
    function visit(v,label){
      if(typeof v==='string'){
        if(isPrivateAudio(v)){try{add('cast-private-media',privateAudioPath(v),label)}catch{}}
        if(v.includes(origin+'/storage/v1/')){
          for(const m of v.match(/https:\/\/[^\s<>"'\x60]+/g)||[]){
            try{const u=new URL(m);if(u.origin!==origin)continue;for(const b of resourceBuckets){const prefix='/storage/v1/object/public/'+b+'/';if(u.pathname.startsWith(prefix))add(b,decodeURIComponent(u.pathname.slice(prefix.length)),label)}}catch{}
          }
        }
      }else if(v&&typeof v==='object'){for(const x of Object.values(v))visit(x,label)}
    }
    docs.forEach((d,i)=>{const label=i%2===0?'DRAFT':'PUBLISHED';visit(d.site,label+' / MAIN THEME');for(const c of d.characters)visit(c,label+' / '+c.name);for(const w of d.worlds)visit(w,label+' / '+w.title);visit(d,label)});
    const files=[],warnings=[];
    for(const bucket of resourceBuckets){
      const storage=client.storage.from(bucket);
      for(let offset=0;;offset+=100){
        const {data,error}=await storage.list('published',{limit:100,offset,sortBy:{column:'name',order:'asc'}});
        if(error)throw Error(bucket+'：'+error.message);
        if(!Array.isArray(data))throw Error(bucket+' の一覧を取得できません');
        for(const f of data){
          if(!f.id&&!f.metadata){warnings.push(bucket+' / published/'+f.name+'：サブフォルダは対象外');continue}
          const path=resourcePrefix+f.name,n=f.metadata?.size,key=resourceKey(bucket,path);
          // Conservative secondary check: a raw or URI-encoded path anywhere protects both buckets.
          const matched=refs.has(key)||serialized.some(s=>s.includes(path)||s.includes(encodeURIComponent(path)));
          const type=f.metadata?.mimetype||(/\.mp3$/i.test(path)?'audio/mpeg':/\.webp$/i.test(path)?'image/webp':/\.png$/i.test(path)?'image/png':/\.gif$/i.test(path)?'image/gif':/\.jpe?g$/i.test(path)?'image/jpeg':'');
          files.push({id:key,bucket,path,size:n!=null&&Number.isFinite(Number(n))&&Number(n)>=0?Number(n):null,type,created:f.created_at||'',referenced:matched,refs:[...(refs.get(key)||[])],manageable:resourcePathOK(path)&&Number.isFinite(Date.parse(f.created_at||''))&&Date.now()-Date.parse(f.created_at)>=10*60*1000});
        }
        if(data.length<100)break;
        if(offset>=9900)throw Error('1万件以上のためスキャンを中止しました');
      }
    }
    const keys=new Set(files.map(f=>f.id)),missing=[...refs.keys()].filter(x=>resourceBuckets.some(b=>x.startsWith(b+'/'+resourcePrefix))&&!keys.has(x));
    return {files,missing,warnings,draftBytes:new Blob([JSON.stringify(latest[0])]).size,publishedBytes:new Blob([JSON.stringify(latest[1])]).size,scannedAt:new Date().toISOString()};
  }
  async function resourcePreview(bucket,path){
    if(!resourceBuckets.includes(bucket)||!path.startsWith(resourcePrefix)||path.includes('..'))throw Error('対象外のファイルです');
    const storage=client.storage.from(bucket);
    if(bucket==='cast-public-media')return storage.getPublicUrl(path).data.publicUrl;
    const {data,error}=await storage.createSignedUrl(path,3600);
    if(error||!data?.signedUrl)throw Error(error?.message||'プレビューURLを取得できません');
    return data.signedUrl;
  }
  async function downloadResource(bucket,path){
    if(!resourceBuckets.includes(bucket)||typeof path!=='string'||!path.startsWith(resourcePrefix)||path.includes('..'))throw Error('対象外のファイルです');
    const {data,error}=await client.storage.from(bucket).download(path);
    if(error||!(data instanceof Blob))throw Error(error?.message||'ファイルを取得できません');
    return data;
  }
  // No auto-delete. Re-read both documents and both listings; abort the entire selection if any is unsafe.
  async function deleteResources(ids){
    if((await flushDraft())===false)throw Error('下書きの保存が完了していないため削除を中止しました');
    if(!Array.isArray(ids)||!ids.length||ids.length>10000)throw Error('削除対象がありません');
    const unique=[...new Set(ids)],fresh=await scanResources();
    if(fresh.missing.length||fresh.warnings.length)throw Error('一覧が不完全なため削除を中止しました');
    const selected=unique.map(id=>fresh.files.find(f=>f.id===id));
    if(selected.some(f=>!f||f.referenced||!f.manageable))throw Error('参照中・対象外・消失したファイルが含まれるため削除を中止しました');
    if(new Set(selected.map(f=>f.bucket)).size!==1)throw Error('バケットごとに削除してください');
    const bucket=selected[0].bucket,storage=client.storage.from(bucket);
    // Supabase's DELETE RLS must also permit the action; it is not granted by this code.
    let failure='';
    try{for(let i=0;i<selected.length;i+=100){const {error}=await storage.remove(selected.slice(i,i+100).map(f=>f.path));if(error){failure=error.message;break}}}catch(e){failure=e.message||String(e)}
    const after=await scanResources(),remaining=new Set(after.files.map(f=>f.id)),removed=unique.filter(id=>!remaining.has(id)).length;
    if(after.missing.length||after.warnings.length)throw Error('削除後の一覧に不整合があります。Storage管理画面を確認してください');
    return {report:after,removed,requested:unique.length,failure};
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
    try{localStorage.setItem('cast-signal-analytics-exclude','1')}catch{}
    window.CAST_DATA={
      initial:clone(seed),clone,
      getDraft:()=>draft,getPublished:()=>published,
      getLastError:()=>lastError,
      getSignalReport:async()=>{const {data,error}=await client.rpc('cast_signal_report');if(error)throw Error(error.message);if(!Array.isArray(data))throw Error('集計データの形式が不正です');return data},
      saveDraft,publish,replaceDraft,scanResources,resourcePreview,downloadResource,deleteResources,storePrivateAudio,audioPreviewURL,previewDraft,exportDraft,isPrivateAudio,
      reset:async()=>replaceDraft(published),
      signOut,
      createId:(prefix)=>`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`
    };
    ui.overlay.hidden=true;
    document.body.classList.remove('cloud-locked');
    return true;
  })().catch(err=>{showStatus('設定を確認してください：'+(err.message||String(err)));console.error(err);throw err});
})();
