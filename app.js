window.CAST_DATA_READY.then(() => {
'use strict';
const $=id=>document.getElementById(id), $$=q=>[...document.querySelectorAll(q)];
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const validUrl=x=>/^https?:\/\/[^\s]+$/i.test(x||'')?x:'';
const api=window.CAST_DATA;
const state={people:[],doc:null,index:0,panel:null,tab:'profile',filter:'all',world:'',mode:'published',animations:!matchMedia('(prefers-reduced-motion: reduce)').matches,timer:null,enterTimer:null,enterNonce:0,directoryView:'gallery'};
const stage=$('hero'), cur=()=>state.people[state.index];
const cropOf=(c,view='choose')=>{const legacy={x:50,y:30,zoom:c?.icon?1:2.05,...(c?.iconCrop||{y:Number.isFinite(Number(c?.iconPosition))?Number(c.iconPosition):30})};return view==='all'?{...legacy,...(c?.allCastCrop||{})}:legacy};
const cropStyle=(c,view='choose')=>{const p=cropOf(c,view);return `--crop-x:${Number(p.x)||0}%;--crop-y:${Number(p.y)||0}%;--crop-zoom:${Number(p.zoom)||1}`};
const galleryState={items:[],index:0,returnFocus:null,view:'mosaic',focus:0};
const website=()=>({...api.initial.site,...(state.doc?.site||{})});
const isNew=c=>{const p=Date.parse(c.firstPublishedAt||'');const days=Number(website().newDays);return Number.isFinite(p)&&Number.isFinite(days)&&days>0&&(Date.now()-p)>=0&&(Date.now()-p)<days*86400000};
const newBadge=c=>isNew(c)?'<b class="cast-new">NEW</b>':'';
// Unicode width + katakana/hiragana normalization. Kanji reading is sourced from the creator's explicit reading field.
const searchNormalize=value=>String(value??'').normalize('NFKC').toLowerCase().replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-96)).replace(/\s+/g,' ').trim();
const worldHasZeta=w=>[w?.link,...(w?.stories||[]).map(s=>s.url)].some(u=>/^https?:\/\/(?:www\.)?zeta-ai\.io\//i.test(u||'')) || state.people.some(c=>c.playable&&c.worldIds?.includes(w?.id));
const isNewWorld=w=>{const p=Date.parse(w?.firstPublishedAt||'');const days=Number(website().newDays);return Number.isFinite(p)&&Number.isFinite(days)&&days>0&&Date.now()>=p&&Date.now()-p<days*86400000};
const worldBadges=w=>`<span class="world-badges">${worldHasZeta(w)?'<b class="zeta-badge">zeta</b>':''}${isNewWorld(w)?'<b class="cast-new">NEW</b>':''}</span>`;
if(!state.animations)document.body.classList.add('no-motion');
function hydrate(doc,mode){
 state.doc=doc;
 state.people=doc.characters.filter(c=>mode==='draft'||c.published!==false).map((c,i)=>({
 ...c, no:String(i+1).padStart(3,'0'),role:c.type||'',world:(doc.worlds.find(w=>w.id===c.worldIds?.[0])?.title)||'UNASSIGNED',
 works:(c.works||[]).map(w=>typeof w==='string'?w:w.title),workRecords:(c.works||[]).map(w=>typeof w==='string'?{title:w,url:''}:w),tags:(c.tagIds||[]).map(id=>doc.tags.find(t=>t.id===id)?.label).filter(Boolean),
 link:c.works?.find(w=>validUrl(w.url)&&w.url.includes('zeta-ai.io'))?.url || c.links?.find(l=>validUrl(l.url)&&l.url.includes('zeta-ai.io'))?.url || '',
 artScale:['orphe','rov','unnamed'].includes(c.id)?c.id:'generic',deco:c.playable?'PLAYABLE SIGNAL':'ORIGINAL SIGNAL',
 colors:c.colors||{accent:'#e5fb4a',soft:'#e5fb4a',deep:'#131517',bright:'#e5fb4a'}
 }));
}
function setTheme(c){
 stage.className='hero theme-'+c.artScale;
 const colors={accent:'#e5fb4a',deep:'#191b1d',soft:'#e9dfea',bright:'#ffffff',...(c.colors||{})};
 // All four editable swatches drive distinct visible interface elements.
 for(const [k,v] of Object.entries(colors)){
   if(!/^#[0-9a-fA-F]{6}$/.test(v)) continue;
   stage.style.setProperty('--'+k,v);
   document.documentElement.style.setProperty('--'+k,v);
   $('dossier').style.setProperty('--'+k,v);
 }
 $('dossier').style.setProperty('--panel-accent',colors.accent);
 $('dossier').style.setProperty('--deep',colors.deep);
}
function setText(id,value){$(id).textContent=String(value??'')}
// Persistent visual scroll progress for the fixed-size INTRODUCTION window.
// The scrolling remains native, so wheel, touch and keyboard continue to work.
function updateIntroScrollIndicator(){
 const text=$('heroBio'),track=$('introScrollRail');if(!text||!track)return;
 const overflow=text.scrollHeight-text.clientHeight;
 track.hidden=overflow<3||$('heroBioBlock').hidden;
 if(track.hidden)return;
 const height=track.clientHeight;
 const thumb=Math.max(14,Math.min(height,height*text.clientHeight/text.scrollHeight));
 const top=overflow?text.scrollTop/overflow*(height-thumb):0;
 const knob=track.firstElementChild;
 knob.style.height=thumb+'px';knob.style.transform='translateY('+top+'px)';
}
function updateMobileIntroProgress(){
 const reading=$('mobileIntroText'), track=$('mobileIntroTrack'), thumb=$('mobileIntroThumb');
 if(!reading||!track||!thumb)return;
 const diff=reading.scrollHeight-reading.clientHeight,trackHeight=track.clientHeight;
 track.hidden=diff<2;
 if(track.hidden)return;
 const th=Math.max(15,Math.min(trackHeight,reading.clientHeight/reading.scrollHeight*trackHeight));
 thumb.style.height=th+'px';thumb.style.transform='translateY('+reading.scrollTop/diff*(trackHeight-th)+'px)';
}
function renderMobileSelection(){
 const c=cur(),track=$('mobilePortraitTrack'), viewport=$('mobilePortraitViewport');
 if(!c||!track)return;
 track.innerHTML=state.people.map(p=>`<button type="button" class="mobile-portrait" role="tab" data-mobile-person="${esc(p.id)}" aria-selected="${p.id===c.id}" style="--portrait-accent:${esc(p.colors.accent)}" aria-label="${esc(p.name)}を選ぶ" title="${esc(p.name)}"><span><img src="${esc(icon(p))}" alt="" style="${cropStyle(p,'choose')}" class="cast-icon ${p.icon?'has-face':''}" data-crop-render></span></button>`).join('');
 setText('mobilePickerCount',String(state.index+1).padStart(2,'0')+' / '+String(state.people.length).padStart(2,'0'));
 requestAnimationFrame(()=>{const chosen=track.querySelector('[aria-selected="true"]');if(!chosen)return;
 const destination=chosen.offsetLeft+chosen.offsetWidth/2-viewport.clientWidth/2;
 viewport.scrollTo({left:Math.max(0,destination),behavior:'instant'});
 });
}
function showEmpty(){stage.style.display='none';$('pickerStrip').innerHTML='<p class="empty">公開中のキャラクターはまだいません。</p>'}
function load({animate=true}={}){
 if(!state.people.length){showEmpty();return} stage.style.display='';const c=cur();setTheme(c);
 setText('heroRoman',c.roman||c.name||'UNKNOWN');setText('heroRoman2',c.surname||'');$('heroRoman2').hidden=!String(c.surname||'').trim();$('heroCopy').classList.toggle('no-surname',!String(c.surname||'').trim());setText('heroJapanese',c.name||'名前未定');
 setText('heroKicker',`CHARACTER FILE ${c.no} / ${String(state.people.length).padStart(3,'0')}`);setText('heroRole',c.roleJa||c.type||'ORIGINAL CHARACTER');
 const species=String(c.species||'').trim(),gender=String(c.gender||'').trim();$('heroCoreData').hidden=!(species||gender);$('heroSpeciesWrap').hidden=!species;$('heroGenderWrap').hidden=!gender;setText('heroSpecies',species);setText('heroGender',gender);
 setText('heroHook',c.hook||'');const voice=String(c.quote||'').trim(),bio=String(c.intro||'').trim();
 $('heroVoiceBlock').hidden=!voice;$('heroBioBlock').hidden=!bio;$('heroIntel').hidden=!(voice||bio);setText('heroVoice',voice);setText('heroBio',bio);$('heroBio').scrollTop=0;requestAnimationFrame(updateIntroScrollIndicator);$('heroCopy').classList.toggle('has-voice',!!voice);$('heroCopy').classList.toggle('has-bio',!!bio);$('heroNew').hidden=!isNew(c);setText('heroNumber',String(state.index+1).padStart(2,'0'));setText('ghostName',c.roman||'SIGNAL');
 setText('mobileQuoteName',c.name||'名前未定');setText('mobileQuoteText',voice);
 $('mobileQuote').classList.toggle('no-quote',!voice);
 setText('mobileIntroText',bio||'紹介文は準備中です。');setText('mobileIntroNumber',c.no+' / CHARACTER FILE');
 $('mobileIntroText').scrollTop=0;requestAnimationFrame(updateMobileIntroProgress);
 setText('heroMeta',`${c.playable?'PLAYABLE / zeta':'SHOWCASE'} / ${c.world}  ●  ${c.no}`);setText('sideDash',c.deco+' / SYSTEM READY');
 $('heroArt').src=c.artwork||'';const pos={x:0,y:0,zoom:1,...(c.artPosition||{})};$('heroArt').style.setProperty('--art-x',`${Number(pos.x)||0}%`);$('heroArt').style.setProperty('--art-y',`${Number(pos.y)||0}%`);$('heroArt').style.setProperty('--art-zoom',Number(pos.zoom)||1);$('heroArt').alt=c.name+'の立ち絵';const badge={right:17,top:10,...(c.fileBadgePosition||{})},mobileBadge={right:8,top:66,...(c.fileBadgePositionMobile||{})};$('artStamp').style.setProperty('--badge-right',Number(badge.right)+'%');$('artStamp').style.setProperty('--badge-top',Number(badge.top)+'%');$('artStamp').style.setProperty('--badge-mobile-right',Number(mobileBadge.right)+'%');$('artStamp').style.setProperty('--badge-mobile-top',Number(mobileBadge.top)+'%');$('artStamp').innerHTML=`<span>FILE<br><b>${esc(c.no)}</b></span>`;
 renderPicker();renderMobileSelection();if(state.panel==='dossier')renderDossier();
 clearTimeout(state.enterTimer);const nonce=++state.enterNonce;stage.classList.remove('is-entering');
 if(animate&&state.animations){stage.style.setProperty('--par-x','0px');stage.style.setProperty('--par-y','0px');void stage.offsetWidth;stage.classList.add('is-entering');state.enterTimer=setTimeout(()=>{if(state.enterNonce===nonce)stage.classList.remove('is-entering')},1220)}
}
function icon(c){return c.icon||c.artwork||''}
function label(c){return c.playable?'<b class="zeta-badge">zeta</b>':''}
function renderPicker(){
 const c=cur();$('pickerCount').textContent=`${String(state.people.length).padStart(2,'0')} SIGNALS DETECTED`;
 $('pickerStrip').innerHTML=state.people.map(p=>`<button type="button" class="person" role="tab" data-person="${esc(p.id)}" aria-selected="${p.id===c.id}" style="--character-accent:${esc(p.colors.accent)}" title="${esc(p.name)}を選ぶ">
 <span class="person-thumb"><img data-crop-render class="cast-icon ${p.icon?'has-face':''}" style="${cropStyle(p,'choose')}" src="${esc(icon(p))}" alt=""></span>
 <span class="person-data"><span class="person-no">NO.${p.no} ${label(p)} ${newBadge(p)}</span><strong>${esc(p.name)}</strong><small>${esc(p.roman)}</small><span class="person-selected">${p.id===c.id?'◀ SELECTED':'SELECT ↗'}</span></span></button>`).join('');
 requestAnimationFrame(()=>{followSelected(true);updatePickerEdges()});
}
function followSelected(animate=true){
 const strip=$('pickerStrip'),selected=strip.querySelector('[aria-selected="true"]');
 if(!selected)return;
 const target=selected.offsetLeft+selected.offsetWidth/2-strip.clientWidth/2;
 const bounded=Math.max(0,Math.min(strip.scrollWidth-strip.clientWidth,target));
 strip.scrollTo({left:bounded,behavior:animate&&state.animations?'smooth':'instant'});
 // ScrollIntoView would also scroll the whole page; keep movement inside this rail only.
}
function updatePickerEdges(){
 // The selector loops from the last character to the first, and vice versa.
 // Keep both rail arrows visible even when the thumbnail strip is at either end.
 const canCycle=state.people.length>1;
 $('pickerEdgePrev').hidden=!canCycle;
 $('pickerEdgeNext').hidden=!canCycle;
}
function route(path){const h='#'+path;if(location.hash!==h)history.pushState(null,'',h)}
function choose(id,{routing=true,detail=false}={}){const i=state.people.findIndex(p=>p.id===id);if(i<0)return;state.index=i;close(false);load();if(detail){state.tab='profile';open('dossier',false)}if(routing)route('char/'+id+(detail?'/profile':''))}
function shift(n){if(state.people.length)choose(state.people[(state.index+n+state.people.length)%state.people.length].id)}
function relationPanel(c){
 // Connections are explicitly registered in the editor. Being in the same WORLD alone
 // does not imply a relationship (the WORLD link below covers other inhabitants).
 const visible=new Set(), relationships=(c.relationships||[]).map(rel=>({
   rel,char:state.people.find(p=>p.id===rel.targetId&&p.id!==c.id)
 })).filter(({char})=>char&&!visible.has(char.id)&&visible.add(char.id));
 const worlds=(c.worldIds||[]).map(id=>state.doc.worlds.find(w=>w.id===id)).filter(Boolean);
 if(!relationships.length&&!worlds.length)return '';
 const faces=relationships.map(({rel,char})=>{
   const relation=String(rel.type||'関連キャラ').trim();
   const more=String(rel.detail||'').trim();
   const explanation=[relation,more].filter(Boolean).join(' / ');
   return `<button class="connection-avatar" type="button" data-related-id="${esc(char.id)}" data-connection-name="${esc(char.name)}" data-connection-type="${esc(relation)}" data-connection-detail="${esc(more)}" style="--avatar-accent:${esc(char.colors?.accent||'#d5dfd9')}" aria-label="${esc(char.name)} — ${esc(explanation)}。プロフィールへ移動">
     <span class="connection-avatar-frame"><img data-crop-render src="${esc(icon(char))}" style="${cropStyle(char,'all')}" alt="" loading="lazy"></span>
     <span class="connection-avatar-indicator" aria-hidden="true">↗</span>
   </button>`;
 }).join('');
 const worldLinks=worlds.map(w=>`<button type="button" class="connection-world-link" data-related-world="${esc(w.id)}"><span class="connection-world-label">WORLD <b>${esc(w.title)}</b></span><span aria-hidden="true">↗</span></button>`).join('');
 return `<section class="file-profile-section file-connections" aria-label="関連キャラと所属WORLD">
   <div class="file-section-label mono"><b>03</b><span>CONNECTIONS <small>関連キャラ</small></span></div>
   ${relationships.length?`<div class="connection-avatars" role="group" aria-label="関連キャラのプロフィール">${faces}</div>`:''}
   ${worldLinks?`<div class="connection-worlds-compact">${worldLinks}</div>`:''}
 </section>`;
}
function renderDossier(){const c=cur();if(!c)return;
 setText('dossierNo','#'+c.no);$('dossierMobileArt').src=c.artwork||'';
 setText('dossierEyebrow',`PERSONNEL RECORD / ${c.playable?'PLAYABLE':'SHOWCASE'} / ${c.world}${isNew(c)?' / NEW':''}`);setText('dossierSuper',c.roman||c.name||'');setText('dossierName',c.name);setText('dossierLead',[c.roleJa||c.role,c.species].filter(Boolean).join('  /  '));setText('dossierFooter',`ARCHIVE / ${c.no} / ${c.deco}`);
 $$('.dossier-tabs [data-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===state.tab)));
 const box=$('dossierContent');box.style.animation='none';void box.offsetWidth;box.style.animation='';
 if(state.tab==='profile'){
 const basic=[['TYPE',c.roleJa||c.role],['SPECIES',c.species],['GENDER',c.gender]].filter(f=>String(f[1]||'').trim());
 const secondary=[['年齢',c.age],['身長',c.height]].filter(f=>String(f[1]||'').trim());
 const extraFields=(c.fields||[]).filter(f=>f.label&&f.value),tags=(c.tags||[]);
 box.innerHTML=`<div class="file-profile-v59 file-profile-v592 file-profile-v593">
   <div class="file-profile-top mono"><span>PERSONAL FILE / ${esc(c.no)}</span><span>IDENTITY VERIFIED</span></div>
   <section class="file-profile-section file-personality">
     <div class="file-section-label mono"><b>01</b><span>PERSONALITY <small>人物像</small></span></div>
     <p class="file-reading">${esc(c.personality||'設定準備中')}</p>
   </section>
   <section class="file-profile-section file-identity">
     <div class="file-section-label mono"><b>02</b><span>PROFILE DATA <small>基本データ</small></span></div>
     <div class="file-data-layout">
       ${basic.filter(([k])=>k==='TYPE').map(([k,v])=>`<div class="file-data-role"><small>${esc(k)}</small><strong>${esc(v)}</strong></div>`).join('')}
       <div class="file-data-facts">
         ${[...basic.filter(([k])=>k!=='TYPE'),...secondary,...extraFields.map(f=>[f.label,f.value])].map(([k,v])=>`<div class="file-data-fact"><small>${esc(k)}</small><strong>${esc(v)}</strong></div>`).join('')||'<span class="file-empty">基本データは未登録です</span>'}
       </div>
     </div>
   </section>
   ${relationPanel(c)}
   ${tags.length?`<section class="file-profile-section file-keywords"><div class="file-section-label mono"><b>04</b><span>KEYWORDS <small>タグ</small></span></div><div class="file-tags">${tags.map(t=>`<span># ${esc(t)}</span>`).join('')}</div></section>`:''}
 </div>`;
 } else if(state.tab==='story'){
 const works=c.workRecords.length?c.workRecords.map((t,i)=>{const tag=validUrl(t.url)?'a':'div',attrs=tag==='a'?`href="${esc(validUrl(t.url))}" target="_blank" rel="noopener noreferrer"`:'';return `<${tag} ${attrs} class="work-row ${tag==='a'?'work-clickable':''}"><div><small>STORY / ${String(i+1).padStart(2,'0')}</small><strong>${esc(t.title||'')}</strong></div><span class="work-arrow">${tag==='a'?'↗':'—'}</span></${tag}>`}).join(''):'<p class="tab-paragraph">作品はまだ登録されていません。</p>';
 box.innerHTML=`<div class="tab-kicker">02 / APPEARANCE HISTORY</div>${works}<button class="go-link" type="button" id="relatedWorld"><span>この世界の詳細を見る<small>EXPLORE WORLD / ${esc(c.world)}</small></span><span>↗</span></button>`;
 $('relatedWorld').onclick=()=>openWorld(c.worldIds?.[0]);
 } else if(state.tab==='gallery'){
 const art=[{image:c.artwork,caption:'MAIN VISUAL'},...(c.gallery||[])].filter(x=>x.image);
 galleryState.items=art;galleryState.focus=Math.max(0,Math.min(galleryState.focus,art.length-1));
 box.innerHTML=`<div class="tab-kicker">03 / VISUAL ARCHIVE</div><div class="gallery-heading"><div><strong>VISUAL <i>FILES.</i></strong><span class="mono">KEEP THE PROPORTIONS. EXPLORE THE DETAILS.</span></div><span class="gallery-total mono">${String(art.length).padStart(2,'0')} FILES / CLICK TO EXPAND ↗</span></div><div class="gallery-mode-row"><span class="mono">DISPLAY MODE /</span><button type="button" class="gallery-mode ${galleryState.view==='mosaic'?'active':''}" data-gallery-mode="mosaic" aria-pressed="${galleryState.view==='mosaic'}">▦ ALBUM</button><button type="button" class="gallery-mode ${galleryState.view==='select'?'active':''}" data-gallery-mode="select" aria-pressed="${galleryState.view==='select'}">◈ SELECT</button></div>
 ${galleryState.view==='mosaic'?`<div class="gallery-mosaic${art.length===1?' gallery-single':''}" aria-label="ギャラリー画像一覧">${art.map((a,i)=>`<button type="button" class="gallery-tile" data-gallery-open="${i}" aria-label="画像 ${i+1}: ${esc(a.caption||c.name)}を全体表示"><span class="gallery-picture"><img src="${esc(a.image)}" alt="${esc(a.caption||c.name)}" loading="lazy"><span class="gallery-zoom" aria-hidden="true">↗</span></span><span class="gallery-tile-label"><b>${String(i+1).padStart(2,'0')}</b><span>${esc(a.caption||'ARTWORK')}</span><em>VIEW FULL ↗</em></span></button>`).join('')}</div>`:`<div class="gallery-select-display"><button type="button" data-gallery-open="${Math.min(galleryState.focus,art.length-1)}" class="gallery-select-focus" aria-label="選択中の画像を拡大表示"><img src="${esc(art[Math.min(galleryState.focus,art.length-1)]?.image||'')}" alt="${esc(art[Math.min(galleryState.focus,art.length-1)]?.caption||'')}" loading="lazy"><span>VIEW FULL ↗</span></button><div class="gallery-select-rail" aria-label="ギャラリー画像を選択">${art.map((a,i)=>`<button type="button" data-gallery-select="${i}" aria-label="${i+1}枚目の画像を選択" aria-pressed="${i===galleryState.focus}"><span><img src="${esc(a.image)}" alt="" loading="lazy"></span><b>${String(i+1).padStart(2,'0')}</b></button>`).join('')}</div><span class="gallery-select-caption mono">${esc(art[Math.min(galleryState.focus,art.length-1)]?.caption||'ARTWORK')} / ${String(galleryState.focus+1).padStart(2,'0')}-${String(art.length).padStart(2,'0')}</span></div>`}${art.length?'':'<p class="tab-paragraph">画像はまだ登録されていません。</p>'}`;
 } else {
 const links=[...(c.workRecords||[]).filter(x=>validUrl(x.url)).map(x=>({label:x.title,url:x.url})),...(c.links||[]).filter(x=>validUrl(x.url))];
 box.innerHTML=`<div class="tab-kicker">04 / EXTERNAL TRANSMISSION</div><h3 class="tab-subtitle">キャラに会いにいく。</h3>${links.map(l=>`<a class="go-link" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer"><span>${esc(l.label)}<small>EXTERNAL LINK</small></span><span>↗</span></a>`).join('')||'<p class="tab-paragraph">外部リンクはまだありません。</p>'}<button class="go-link" id="copyLink"><span>キャラページのリンクをコピー<small>COPY CHARACTER URL</small></span><span>⧉</span></button><p class="notice">この試作品はローカル動作です。インターネット公開後に共有用URLが使えるようになります。</p>`;
 $('copyLink').onclick=()=>{if(location.protocol==='file:'||location.hostname==='localhost'){toast('まだ公開用URLはありません。正式公開後に利用できます');return}const url=new URL(location.href);url.hash='char/'+c.id+'/profile';navigator.clipboard?.writeText(url.href).then(()=>toast('URLをコピーしました')).catch(()=>window.prompt('このURLをコピー',url.href))};
 }
}
function renderDirectory({resetScroll=false}={}){
 const query=searchNormalize($('search').value),terms=query.split(' ').filter(Boolean);
 let items=state.people.filter(c=>(state.filter==='all'||(state.filter==='playable'?c.playable:!c.playable))&&(!state.world||c.worldIds?.includes(state.world)));
 if(terms.length)items=items.filter(c=>{const hay=searchNormalize([c.name,c.reading,c.aliases,c.roman,c.surname,c.world,c.roleJa,c.type,...(c.works||[]),...(c.tags||[])].join(' '));return terms.every(term=>hay.includes(term))});
 setText('directoryCount',`${String(items.length).padStart(2,'0')} FILES MATCH`);
 const el=$('directoryItems');el.classList.toggle('directory-gallery',state.directoryView==='gallery');el.classList.toggle('directory-detail',state.directoryView==='detail');
 if(state.directoryView==='gallery')el.innerHTML=items.map(c=>`<button type="button" data-pick="${esc(c.id)}" class="cast-gallery-card" style="--item-color:${esc(c.colors.accent)}" aria-label="${esc(c.name)}のプロフィールを開く"><span class="cast-gallery-visual"><img data-crop-render src="${esc(icon(c))}" alt="" style="${cropStyle(c,'all')}" loading="lazy"><span class="cast-gallery-number mono">FILE / ${esc(c.no)}</span></span><span class="cast-gallery-caption"><span class="cast-gallery-name">${esc(c.name)}</span><span class="cast-gallery-badges">${label(c)} ${newBadge(c)}</span><small>${esc(c.roleJa||c.role||'CHARACTER')}</small><span class="cast-gallery-world mono">${esc(c.world)}</span><span class="cast-gallery-arrow" aria-hidden="true">↗</span></span></button>`).join('')||'<p class="empty">該当するキャラが見つかりません。</p>';
 else el.innerHTML=items.map(c=>`<button type="button" data-pick="${esc(c.id)}" class="directory-item" style="--item-color:${esc(c.colors.accent)}"><span class="d-thumb"><img data-crop-render class="index-face ${c.icon?'has-face':''}" style="${cropStyle(c,'all')}" src="${esc(icon(c))}" alt=""><span class="d-no">${c.no}</span></span><span class="d-main"><span class="d-top"><small class="mono">CHARACTER / ${c.no}</small><span class="d-badges">${label(c)} ${newBadge(c)}</span></span><strong>${esc(c.name)}</strong><span class="d-roman">${esc(c.roman||c.name)}${c.surname?' / '+esc(c.surname):''}</span><span class="d-role">${esc(c.roleJa||c.role||'CHARACTER')}</span><span class="d-group">WORLD <i>/</i> ${esc(c.world)}</span></span><span class="d-arrow">↗</span></button>`).join('')||'<p class="empty">該当するキャラが見つかりません。</p>';
 $$('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===state.filter)));
 $$('[data-directory-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.directoryView===state.directoryView)));
 if(resetScroll)el.scrollTop=0;
}
function renderWorlds(){const worlds=state.doc.worlds||[];
 $('worldCards').innerHTML=worlds.map((w,i)=>{const group=state.people.filter(c=>c.worldIds?.includes(w.id));return `<button type="button" class="world-card ${w.image?'has-cover':'no-cover'}" data-world="${esc(w.id)}" style="--world-accent:${esc(w.accent||'#e1fb42')}">${w.image?`<span class="world-card-image" aria-hidden="true"><img class="world-bg" src="${esc(w.image)}" alt="" loading="lazy"><img class="world-figure" src="${esc(w.image)}" alt="" loading="lazy"></span>`:''}<span class="world-top">WORLD / ${String(i+1).padStart(2,'0')} ${worldBadges(w)}</span><strong>${esc(w.title)}</strong><small>${esc(w.subtitle||w.category||'')} &nbsp; · &nbsp; ${group.length} CAST</small><p class="world-excerpt">${esc(w.summary||'')}</p><span class="world-arrow">↗</span></button>`}).join('');
}

function worldById(id){return state.doc?.worlds.find(w=>w.id===id)}
function renderWorldDetail(){
 const w=worldById(state.world);if(!w){$('worldDetailContent').innerHTML='<p class="empty">WORLDが見つかりません</p>';return}
 const idx=state.doc.worlds.indexOf(w)+1;
 const group=state.people.filter(c=>c.worldIds?.includes(w.id));
 const rawStories=Array.isArray(w.stories)?w.stories:[];
 const stories=rawStories.filter(t=>t.title?.trim());
 const mainLink=validUrl(w.link);
 const mainAlready=stories.some(t=>validUrl(t.url)===mainLink&&mainLink);
 const linkBlock=mainLink&&!mainAlready?`<a class="world-primary-link" href="${esc(mainLink)}" target="_blank" rel="noopener noreferrer"><span>↗ MAIN / WORLD LINK</span><b>登録した作品URLへ進む</b></a>`:'';
 const heroImage=w.image?`<img src="${esc(w.image)}" alt="" class="world-detail-art">`:'';
 const safeAccent=/^#[0-9a-f]{6}$/i.test(w.accent)?w.accent:'#eafa42';
 $('worldDetailContent').innerHTML=`<section class="world-detail-hero" style="--wd-accent:${esc(safeAccent)}">
    <div class="world-detail-backdrop">${heroImage}</div>
    <div class="world-detail-hero-content"><div class="world-detail-kicker mono">FILE ${String(idx).padStart(2,'0')} / WORLD DATABASE / ${esc(w.category||'ARCHIVE')}</div>
    <div class="world-detail-badges">${worldBadges(w)}</div><h2>${esc(w.title||'UNNAMED WORLD')}</h2><strong class="world-detail-subtitle">${esc(w.subtitle||'ORIGINAL WORLD')}</strong><p>${esc(w.summary||'世界観の詳細は準備中です。')}</p>
    <div class="world-detail-stats mono"><span>${String(stories.length).padStart(2,'0')} STORIES</span><span>${String(group.length).padStart(2,'0')} CHARACTERS</span></div></div>
  </section>
  <div class="world-detail-main"><div class="world-detail-section-title"><span class="mono">01 / PLAYABLE STORIES</span><h3>STORY <i>FILES.</i></h3><p>気になる物語を選んで、作品ページへ。</p></div>
   <div class="world-story-list">${stories.length?stories.map((t,i)=>{const href=validUrl(t.url);const tag=href?'a':'div';return `<${tag} class="world-story-item ${href?'clickable':'pending'}" ${href?`href="${esc(href)}" target="_blank" rel="noopener noreferrer"`:''}><span class="world-story-num mono">${String(i+1).padStart(2,'0')}</span><div class="world-story-info"><small class="mono">${esc(t.label||'STORY')}</small><b>${esc(t.title)}</b>${t.description?`<p>${esc(t.description)}</p>`:''}</div><span class="world-story-arrow">${href?'↗':'—'}</span></${tag}>`}).join(''):'<p class="world-detail-empty">作品の登録はまだありません。</p>'}</div>
   ${linkBlock}
   <div class="world-detail-section-title cast-section"><span class="mono">02 / CHARACTER NETWORK</span><h3>CONNECTED <i>CAST.</i></h3><p>この世界に登場するキャラクター</p></div>
   <div class="world-cast-grid">${group.length?group.map(c=>`<button type="button" class="world-cast-card" data-world-character="${esc(c.id)}" style="--cast-accent:${esc(c.colors.accent)}"><span class="world-cast-visual"><img data-crop-render src="${esc(icon(c))}" alt="" style="${cropStyle(c,'all')}"></span><span class="world-cast-info"><small class="mono">FILE #${esc(c.no)} ${c.playable?' / zeta':''}</small><strong>${esc(c.name)}</strong><em>VIEW PROFILE ↗</em></span></button>`).join(''):'<p class="world-detail-empty">キャラクターはまだ登録されていません。</p>'}</div>
   <div class="world-detail-foot mono">© CAST / SIGNAL — CONNECTED WORLDS</div>
  </div>`;
}

function renderAbout(){
 const t=website();
 for(const [id,val] of [['aboutTitle',t.title],['aboutIntro',t.intro],['aboutImages',t.imagePolicy],['aboutFans',t.fanPolicy],['aboutScreens',t.screenshotPolicy]])setText(id,val||'');
 const fa=(t.faTag||'').trim();$('aboutFa').hidden=!fa;setText('aboutFaValue',fa);
 const links=[{label:'X / TWITTER',url:t.xUrl,icon:'X'},{label:'ZETA / CREATOR',url:t.zetaUrl,icon:'zeta'}].filter(l=>validUrl(l.url));
 $('aboutLinks').innerHTML=links.length?links.map(l=>`<a href="${esc(l.url)}" rel="noopener noreferrer" target="_blank"><b>${esc(l.icon)}</b><span>${esc(l.label)}</span><em>↗</em></a>`).join(''):'<span class="about-link-pending">CREATOR LINKS / 準備中</span>';
 $('footerSocial').innerHTML=links.map(l=>`<a href="${esc(l.url)}" rel="noopener noreferrer" target="_blank" aria-label="${esc(l.label)}を開く">${esc(l.icon)} ↗</a>`).join('');
 $('mobileSocialLinks').innerHTML=links.length?links.map(l=>`<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(l.label)}を開く"><b>${esc(l.icon)}</b></a>`).join(''):'<small>LINKS / 準備中</small>';
}
function setNav(){$$('[data-nav]').forEach(b=>b.classList.toggle('active',state.panel==='directory'?b.dataset.nav==='index':(state.panel==='worldsPanel'||state.panel==='worldDetailPanel')?b.dataset.nav==='worlds':state.panel==='aboutPanel'?b.dataset.nav==='about':b.dataset.nav==='select'))}
function open(which,routing=true){close(false);state.panel=which;const el=$(which);el.setAttribute('aria-hidden','false');el.classList.add('open');$('scrim').hidden=false;requestAnimationFrame(()=>$('scrim').classList.add('visible'));document.body.style.overflow='hidden';document.body.classList.toggle('detail-open',which==='dossier');if(which==='dossier'){renderDossier();$('dossierContent').scrollTop=0}if(which==='directory')renderDirectory();if(which==='worldsPanel')renderWorlds();if(which==='worldDetailPanel')renderWorldDetail();if(which==='aboutPanel')renderAbout();setNav();if(routing)route(which==='dossier'?'char/'+cur().id+'/'+state.tab:which==='directory'?'index':which==='aboutPanel'?'about':which==='worldDetailPanel'?'world/'+state.world:'worlds');el.querySelector('[data-close]')?.focus({preventScroll:true})}
function close(routing=true){hideConnectionTooltip();$$('.dossier,.directory').forEach(el=>{el.classList.remove('open');el.setAttribute('aria-hidden','true')});$('scrim').classList.remove('visible');$('scrim').hidden=true;document.body.style.overflow='';document.body.classList.remove('detail-open');const before=state.panel;state.panel=null;setNav();if(before&&routing&&cur())route('char/'+cur().id)}
function openWorld(id){if(!worldById(id))return;state.world=id;state.filter='all';$('search').value='';open('worldDetailPanel')}
function tab(k){hideConnectionTooltip();state.tab=k;renderDossier();$('dossierContent').scrollTop=0;route('char/'+cur().id+'/'+k)}
function onRoute(){if(document.body.classList.contains('admin-open'))return;const path=decodeURIComponent(location.hash.replace(/^#/,'')),parts=path.split('/');if(parts[0]==='char'){
 const i=state.people.findIndex(c=>c.id===parts[1]);if(i>=0){state.index=i;load({animate:false});if(['profile','story','gallery','links'].includes(parts[2])){state.tab=parts[2];open('dossier',false)}else close(false);return}
 }if(parts[0]==='world'&&worldById(parts[1])){state.world=parts[1];open('worldDetailPanel',false);return}if(path==='index'){state.world='';state.filter='all';open('directory',false);return}if(path==='worlds'){open('worldsPanel',false);return}if(path==='about'){open('aboutPanel',false);return}close(false)}
function toast(t){const el=$('toast');el.textContent=t;el.classList.add('show');clearTimeout(state.timer);state.timer=setTimeout(()=>el.classList.remove('show'),3600)}
function refresh(mode='published'){const id=cur()?.id;state.mode=mode;hydrate(mode==='draft'?api.getDraft():api.getPublished(),mode);state.index=Math.max(0,state.people.findIndex(c=>c.id===id));if(!state.people.length)state.index=0;close(false);load({animate:false});renderWorlds();renderAbout();onRoute();$('draftIndicator').hidden=mode!=='draft';}
window.CAST_PUBLIC={refresh,openCharacter:id=>choose(id,{detail:true}),toast};
const connectionTooltip=$('connectionTooltip');
let activeConnection=null;
function hideConnectionTooltip(){activeConnection=null;connectionTooltip.hidden=true;connectionTooltip.setAttribute('aria-hidden','true')}
function showConnectionTooltip(el){
 if(!el?.classList.contains('connection-avatar'))return;
 activeConnection=el;
 $('connectionTooltipName').textContent=el.dataset.connectionName||'';
 $('connectionTooltipRelation').textContent=el.dataset.connectionType||'関連キャラ';
 const note=$('connectionTooltipDetail');note.textContent=el.dataset.connectionDetail||'';
 note.hidden=!note.textContent;
 connectionTooltip.hidden=false;connectionTooltip.setAttribute('aria-hidden','false');
 // Measure the *actual* tooltip, then keep it entirely inside the viewport.
 const r=el.getBoundingClientRect(), tip=connectionTooltip.getBoundingClientRect();
 const left=Math.max(10,Math.min(window.innerWidth-tip.width-10,r.left+r.width/2-tip.width/2));
 const preferredTop=r.top-tip.height-12;
 const top=preferredTop>=10?preferredTop:Math.min(window.innerHeight-tip.height-10,r.bottom+12);
 connectionTooltip.style.left=left+'px';connectionTooltip.style.top=Math.max(10,top)+'px';
}
$('dossierContent').addEventListener('pointerover',e=>{const button=e.target.closest('.connection-avatar');if(button&&button!==activeConnection&&e.pointerType!=='touch')showConnectionTooltip(button)});
$('dossierContent').addEventListener('pointerout',e=>{const button=e.target.closest('.connection-avatar');if(button&&!button.contains(e.relatedTarget)&&button===activeConnection)hideConnectionTooltip()});
$('dossierContent').addEventListener('focusin',e=>{const button=e.target.closest('.connection-avatar');if(button)showConnectionTooltip(button)});
$('dossierContent').addEventListener('focusout',e=>{const button=e.target.closest('.connection-avatar');if(button===activeConnection)hideConnectionTooltip()});
$('dossierContent').addEventListener('scroll',hideConnectionTooltip,{passive:true});
window.addEventListener('resize',hideConnectionTooltip);
$('dossierContent').addEventListener('click',e=>{const rel=e.target.closest('[data-related-id]');if(rel){hideConnectionTooltip();choose(rel.dataset.relatedId,{detail:true});return}const w=e.target.closest('[data-related-world]');if(w){hideConnectionTooltip();openWorld(w.dataset.relatedWorld)}});
$('pickerStrip').addEventListener('click',e=>{const b=e.target.closest('[data-person]');if(b)choose(b.dataset.person)});
$('prev').onclick=()=>shift(-1);$('next').onclick=()=>shift(1);
$('pickerStrip').addEventListener('scroll',updatePickerEdges,{passive:true});$('heroBio').addEventListener('scroll',updateIntroScrollIndicator,{passive:true});
window.addEventListener('resize',()=>{followSelected(false);updatePickerEdges();updateIntroScrollIndicator()});
$('pickerEdgePrev').onclick=()=>shift(-1);$('pickerEdgeNext').onclick=()=>shift(1);
$('openDetail').onclick=()=>{state.tab='profile';open('dossier')};
$('openIndex').onclick=()=>{state.world='';state.filter='all';$('search').value='';open('directory')};
$$('[data-nav]').forEach(b=>b.onclick=()=>{if(b.dataset.nav==='select')close();else if(b.dataset.nav==='index'){state.world='';state.filter='all';$('search').value='';open('directory')}else if(b.dataset.nav==='worlds')open('worldsPanel');else open('aboutPanel')});
$('brandHome').onclick=e=>{e.preventDefault();if(state.people.length)choose(state.people[0].id)};
$$('[data-close]').forEach(b=>b.onclick=()=>close());$('scrim').onclick=()=>close();
$$('.dossier-tabs [data-tab]').forEach(b=>b.onclick=()=>tab(b.dataset.tab));$('search').addEventListener('input',()=>renderDirectory({resetScroll:true}));
$$('[data-filter]').forEach(b=>b.onclick=()=>{state.filter=b.dataset.filter;state.world='';renderDirectory()});
$('directoryItems').addEventListener('click',e=>{const b=e.target.closest('[data-pick]');if(b)choose(b.dataset.pick)});
$$('[data-directory-view]').forEach(b=>b.addEventListener('click',()=>{state.directoryView=b.dataset.directoryView;renderDirectory({resetScroll:true})}));
$('copyFa').addEventListener('click',()=>{const t=website().faTag||'';if(navigator.clipboard?.writeText)navigator.clipboard.writeText(t).then(()=>toast('FAタグをコピーしたよ')).catch(()=>window.prompt('FAタグをコピー',t));else window.prompt('FAタグをコピー',t)});
$('worldCards').addEventListener('click',e=>{const b=e.target.closest('[data-world]');if(b)openWorld(b.dataset.world)});
$('worldDetailBack').onclick=()=>open('worldsPanel');
$('worldDetailContent').addEventListener('click',e=>{const b=e.target.closest('[data-world-character]');if(b)choose(b.dataset.worldCharacter,{detail:true})});
$('dossierContent').addEventListener('click',e=>{const mode=e.target.closest('[data-gallery-mode]'),pick=e.target.closest('[data-gallery-select]');if(mode){galleryState.view=mode.dataset.galleryMode;renderDossier()}else if(pick){galleryState.focus=Number(pick.dataset.gallerySelect);renderDossier()}});
$('motionToggle').onclick=()=>{state.animations=!state.animations;document.body.classList.toggle('no-motion',!state.animations);$('motionToggle').innerHTML=`MOTION <b>${state.animations?'ON':'OFF'}</b>`;
$('motionToggle').setAttribute('aria-pressed',String(state.animations))};
$('motionToggle').innerHTML=`MOTION <b>${state.animations?'ON':'OFF'}</b>`;
// V5.9.8: compact mobile navigation, no impact on desktop navigation.
$('mobileIntroText').addEventListener('scroll',updateMobileIntroProgress,{passive:true});
window.addEventListener('resize',updateMobileIntroProgress);
$('mobileOpenDetail').addEventListener('click',()=>$('openDetail').click());
$('mobilePrev').addEventListener('click',()=>shift(-1));
$('mobileNext').addEventListener('click',()=>shift(1));
$('mobileAllCast').addEventListener('click',()=>$('openIndex').click());
$('mobilePortraitTrack').addEventListener('click',e=>{const b=e.target.closest('[data-mobile-person]');if(b)choose(b.dataset.mobilePerson)});
const mobileMenuToggle=$('mobileMenuToggle'), mobileNav=$('mobileNav');
const mobileBackdrop=$('mobileNavBackdrop'), mobileMenuClose=$('mobileMenuClose');
const mobileMotionToggle=$('mobileMotionToggle');
function setMobileMenu(opened){
 const openNow=Boolean(opened&&matchMedia('(max-width:620px)').matches);
 mobileMenuToggle.setAttribute('aria-expanded',String(openNow));
 mobileMenuToggle.setAttribute('aria-label',openNow?'メニューを閉じる':'メニューを開く');
 mobileNav.setAttribute('aria-hidden',String(!openNow));
 mobileNav.inert=!openNow;
 mobileNav.classList.toggle('open',openNow);
 mobileBackdrop.hidden=!openNow;
 document.body.classList.toggle('mobile-menu-open',openNow);
 if(openNow)mobileMenuClose.focus({preventScroll:true});
}
mobileMenuToggle.addEventListener('click',()=>setMobileMenu(mobileMenuToggle.getAttribute('aria-expanded')!=='true'));
mobileMenuClose.addEventListener('click',()=>{setMobileMenu(false);mobileMenuToggle.focus({preventScroll:true})});
mobileBackdrop.addEventListener('click',()=>setMobileMenu(false));
$$('#mobileNav [data-nav]').forEach(b=>b.addEventListener('click',()=>setMobileMenu(false)));
mobileMotionToggle.innerHTML=$('motionToggle').innerHTML;
mobileMotionToggle.addEventListener('click',()=>{$('motionToggle').click(); mobileMotionToggle.innerHTML=$('motionToggle').innerHTML});
window.addEventListener('resize',()=>{if(!matchMedia('(max-width:620px)').matches)setMobileMenu(false)});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('mobile-menu-open')){e.stopImmediatePropagation();setMobileMenu(false);mobileMenuToggle.focus({preventScroll:true})}},true);

// Mobile ALL CAST: keep search/filter available without stealing screen height.
const filterToggle=$('mobileFilterToggle'),filterPanel=$('mobileFilters');
filterToggle.addEventListener('click',()=>{
 const open=filterToggle.getAttribute('aria-expanded')!=='true';
 filterToggle.setAttribute('aria-expanded',String(open));
 filterToggle.querySelector('span').textContent=open?'−':'＋';
 filterPanel.classList.toggle('mobile-filters-open',open);
 if(open)$('search').focus({preventScroll:true});
});

// Swipe horizontally over the character stage to switch cast members.
// Vertical movement is left to native page/intro scrolling; taps and controls are untouched.
let mobileSwipe=null;
function skipSwipeTarget(e){return Boolean(e.target.closest('button,a,input,textarea,select,.hero-bio,.hero-voice,.hero-cta,.mobile-intro,.mobile-quote,.mobile-profile'))}
stage.addEventListener('touchstart',e=>{
 if(!matchMedia('(max-width:620px)').matches||state.panel||document.body.classList.contains('mobile-menu-open')||e.touches.length!==1||skipSwipeTarget(e)){mobileSwipe=null;return}
 mobileSwipe={x:e.touches[0].clientX,y:e.touches[0].clientY,time:Date.now()};
},{passive:true});
stage.addEventListener('touchend',e=>{
 if(!mobileSwipe||e.changedTouches.length!==1||state.panel||document.body.classList.contains('mobile-menu-open')){mobileSwipe=null;return}
 const dx=e.changedTouches[0].clientX-mobileSwipe.x,dy=e.changedTouches[0].clientY-mobileSwipe.y;
 if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.45&&Date.now()-mobileSwipe.time<950)shift(dx<0?1:-1);
 mobileSwipe=null;
},{passive:true});
stage.addEventListener('touchcancel',()=>{mobileSwipe=null},{passive:true});
document.addEventListener('keydown',e=>{if(document.body.classList.contains('admin-open'))return;if(e.key==='Escape'&&state.panel){close();return}if(['ArrowLeft','ArrowRight'].includes(e.key)&&!state.panel&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){e.preventDefault();shift(e.key==='ArrowRight'?1:-1)}});
let frame=0;stage.addEventListener('pointermove',e=>{if(!state.animations||state.panel||e.pointerType==='touch')return;if(frame)return;const r=stage.getBoundingClientRect(),x=((e.clientX-r.left)/r.width-.5)*14,y=((e.clientY-r.top)/r.height-.5)*10;frame=requestAnimationFrame(()=>{stage.style.setProperty('--par-x',x.toFixed(1)+'px');stage.style.setProperty('--par-y',y.toFixed(1)+'px');frame=0})});stage.addEventListener('pointerleave',()=>{stage.style.setProperty('--par-x','0px');stage.style.setProperty('--par-y','0px')});
window.addEventListener('hashchange',onRoute);window.addEventListener('popstate',onRoute);
refresh('published');

// Image viewer: full image, no crop, next/prev navigation, escape to close.
function lightboxShow(){
 const item=galleryState.items[galleryState.index];if(!item)return;
 $('lightboxImage').src=item.image;$('lightboxImage').alt=item.caption||cur()?.name||'ギャラリー画像';
 setText('lightboxCaption',item.caption||'ARTWORK');
 setText('lightboxCount',`${String(galleryState.index+1).padStart(2,'0')} / ${String(galleryState.items.length).padStart(2,'0')}`);
 $('lightboxPrev').disabled=galleryState.items.length<2;
 $('lightboxNext').disabled=galleryState.items.length<2;
}
function lightboxOpen(index,trigger){
 if(!galleryState.items.length)return;
 galleryState.index=Math.min(Math.max(index,0),galleryState.items.length-1);
 galleryState.returnFocus=trigger||document.activeElement;
 const el=$('galleryLightbox');el.hidden=false;el.setAttribute('aria-hidden','false');
 document.body.classList.add('lightbox-open');lightboxShow();$('lightboxClose').focus();
}
function lightboxClose(){
 const el=$('galleryLightbox');if(el.hidden)return;
 el.hidden=true;el.setAttribute('aria-hidden','true');document.body.classList.remove('lightbox-open');
 $('lightboxImage').removeAttribute('src');galleryState.returnFocus?.focus?.();
}
function lightboxMove(step){
 if(galleryState.items.length<2)return;
 galleryState.index=(galleryState.index+step+galleryState.items.length)%galleryState.items.length;
 lightboxShow();
}
$('dossierContent').addEventListener('click',e=>{
 const b=e.target.closest('[data-gallery-open]');if(!b)return;
 lightboxOpen(Number(b.dataset.galleryOpen),b);
});
$('lightboxClose').addEventListener('click',lightboxClose);
$('lightboxPrev').addEventListener('click',()=>lightboxMove(-1));
$('lightboxNext').addEventListener('click',()=>lightboxMove(1));
$('galleryLightbox').addEventListener('click',e=>{if(e.target===$('galleryLightbox'))lightboxClose()});
document.addEventListener('keydown',e=>{
 if($('galleryLightbox').hidden)return;
 if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();lightboxClose()}
 if(e.key==='ArrowLeft'){e.preventDefault();e.stopImmediatePropagation();lightboxMove(-1)}
 if(e.key==='ArrowRight'){e.preventDefault();e.stopImmediatePropagation();lightboxMove(1)}
},true);

});
