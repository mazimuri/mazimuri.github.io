window.CAST_DATA_READY.then(() => {
'use strict';
const $=id=>document.getElementById(id), $$=q=>[...document.querySelectorAll(q)];
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const validUrl=x=>/^https?:\/\/[^\s]+$/i.test(x||'')?x:'';
const api=window.CAST_DATA;
const state={people:[],doc:null,index:0,panel:null,tab:'profile',filter:'all',world:'',mode:'published',animations:!matchMedia('(prefers-reduced-motion: reduce)').matches,timer:null};
const stage=$('hero'), cur=()=>state.people[state.index];
const cropOf=c=>({x:50,y:30,zoom:c?.icon?1:2.05,...(c?.iconCrop||{y:Number.isFinite(Number(c?.iconPosition))?Number(c.iconPosition):30})});
const cropStyle=c=>{const p=cropOf(c);return `--crop-x:${Number(p.x)||0}%;--crop-y:${Number(p.y)||0}%;--crop-zoom:${Number(p.zoom)||1}`};
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
function showEmpty(){stage.style.display='none';$('pickerStrip').innerHTML='<p class="empty">公開中のキャラクターはまだいません。</p>'}
function load({animate=true}={}){
 if(!state.people.length){showEmpty();return} stage.style.display='';const c=cur();setTheme(c);
 setText('heroRoman',c.roman||c.name||'UNKNOWN');setText('heroRoman2',c.surname||'');$('heroRoman2').hidden=!String(c.surname||'').trim();$('heroCopy').classList.toggle('no-surname',!String(c.surname||'').trim());setText('heroJapanese',c.name||'名前未定');
 setText('heroKicker',`CHARACTER FILE ${c.no} / ${String(state.people.length).padStart(3,'0')}`);setText('heroRole',c.roleJa||c.type||'ORIGINAL CHARACTER');
 setText('heroHook',c.hook||'');$('heroNew').hidden=!isNew(c);setText('heroNumber',String(state.index+1).padStart(2,'0'));setText('ghostName',c.roman||'SIGNAL');
 setText('heroMeta',`${c.playable?'PLAYABLE / zeta':'SHOWCASE'} / ${c.world}  ●  ${c.no}`);setText('sideDash',c.deco+' / SYSTEM READY');
 $('heroArt').src=c.artwork||'';$('heroArt').alt=c.name+'の立ち絵';$('artStamp').innerHTML=`<span>FILE<br><b>${esc(c.no)}</b></span>`;
 renderPicker();if(state.panel==='dossier')renderDossier();
 if(animate&&state.animations){void stage.offsetWidth;stage.classList.add('is-entering');setTimeout(()=>stage.classList.remove('is-entering'),1000)}
}
function icon(c){return c.icon||c.artwork||''}
function label(c){return c.playable?'<b class="zeta-badge">zeta</b>':''}
function renderPicker(){
 const c=cur();$('pickerCount').textContent=`${String(state.people.length).padStart(2,'0')} SIGNALS DETECTED`;
 $('pickerStrip').innerHTML=state.people.map(p=>`<button type="button" class="person" role="tab" data-person="${esc(p.id)}" aria-selected="${p.id===c.id}" style="--character-accent:${esc(p.colors.accent)}" title="${esc(p.name)}を選ぶ">
 <span class="person-thumb"><img class="cast-icon ${p.icon?'has-face':''}" style="${cropStyle(p)}" src="${esc(icon(p))}" alt=""></span>
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
 const strip=$('pickerStrip'),overflow=strip.scrollWidth>strip.clientWidth+5;
 const left=$('pickerEdgePrev'),right=$('pickerEdgeNext');
 if(!overflow){left.hidden=true;right.hidden=true;return}
 left.hidden=strip.scrollLeft<=3;
 right.hidden=strip.scrollLeft>=strip.scrollWidth-strip.clientWidth-4;
}
function route(path){const h='#'+path;if(location.hash!==h)history.pushState(null,'',h)}
function choose(id,{routing=true,detail=false}={}){const i=state.people.findIndex(p=>p.id===id);if(i<0)return;state.index=i;close(false);load();if(detail){state.tab='profile';open('dossier',false)}if(routing)route('char/'+id+(detail?'/profile':''))}
function shift(n){if(state.people.length)choose(state.people[(state.index+n+state.people.length)%state.people.length].id)}
function renderDossier(){const c=cur();if(!c)return;
 setText('dossierNo','#'+c.no);$('dossierMobileArt').src=c.artwork||'';
 setText('dossierEyebrow',`PERSONNEL RECORD / ${c.playable?'PLAYABLE':'SHOWCASE'} / ${c.world}${isNew(c)?' / NEW':''}`);setText('dossierSuper',c.roman||c.name||'');setText('dossierName',c.name);setText('dossierLead',c.hook);setText('dossierFooter',`ARCHIVE / ${c.no} / ${c.deco}`);
 $$('.dossier-tabs [data-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===state.tab)));
 const box=$('dossierContent');box.style.animation='none';void box.offsetWidth;box.style.animation='';
 if(state.tab==='profile'){
 const mainFields=[['AGE','年齢',c.age],['HEIGHT','身長',c.height],['SPECIES','種族',c.species]].filter(pair=>pair[2]);
 const extraFields=(c.fields||[]).filter(f=>f.label&&f.value);
 box.innerHTML=`<div class="tab-kicker">01 / PERSONAL DATA <span class="profile-kicker-tail">IDENTITY / PERSONAL RECORD</span></div>
 ${c.tags.length?`<section class="profile-tag-feature"><div class="tag-feature-heading"><span>⌗ <b>CHARACTER KEYWORDS</b></span><span class="mono">${String(c.tags.length).padStart(2,'0')} / SIGNALS</span></div><div class="tag-feature-list">${c.tags.map((t,i)=>`<span><i>${String(i+1).padStart(2,'0')}</i>${esc(t)}</span>`).join('')}</div></section>`:''}
 <div class="personal-data-card"><div class="personal-card-top"><b>BASIC <i>INFO.</i></b><span class="mono">FILE ${esc(c.no)} / VERIFIED</span></div><div class="personal-prime">${mainFields.map((f,i)=>`<div class="personal-prime-field"><span class="prime-index">0${i+1}</span><small>${esc(f[0])}<em>${esc(f[1])}</em></small><strong>${esc(f[2])}</strong></div>`).join('')||'<span class="no-data">基本データは準備中です</span>'}</div></div>
 ${extraFields.length?`<div class="personal-extra"><div class="extra-label mono">ADDITIONAL PARAMETERS / ${String(extraFields.length).padStart(2,'0')}</div><div class="personal-extra-grid">${extraFields.map(f=>`<div><small>${esc(f.label)}</small><strong>${esc(f.value)}</strong></div>`).join('')}</div></div>`:''}
 ${c.intro?`<p class="personal-intro">${esc(c.intro)}</p>`:''}
 <section class="personality-module"><div class="personality-heading"><span class="mono">CHARACTER ANALYSIS / 02</span><strong>PERSONALITY <i>↗</i></strong></div><p>${esc(c.personality||'設定準備中')}</p></section>`;
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
function renderDirectory(){const query=searchNormalize($('search').value);const terms=query.split(' ').filter(Boolean);let items=state.people.filter(c=>(state.filter==='all'||(state.filter==='playable'?c.playable:!c.playable))&&(!state.world||c.worldIds?.includes(state.world)));if(terms.length)items=items.filter(c=>{const hay=searchNormalize([c.name,c.reading,c.aliases,c.roman,c.surname,c.world,c.roleJa,c.type,...c.works,...c.tags].join(' '));return terms.every(term=>hay.includes(term))});
 setText('directoryCount',`${String(items.length).padStart(2,'0')} FILES MATCH`);
 $('directoryItems').innerHTML=items.map(c=>`<button type="button" data-pick="${esc(c.id)}" class="directory-item" style="--item-color:${esc(c.colors.accent)}"><span class="d-no">${c.no}</span><span class="d-thumb"><img class="index-face ${c.icon?'has-face':''}" style="${cropStyle(c)}" src="${esc(icon(c))}" alt=""></span><span class="d-main"><strong>${esc(c.name)} ${label(c)} ${newBadge(c)}</strong><span>${esc(c.roman)} / ${esc(c.role)}</span></span><span class="d-group">${esc(c.world)}</span><span class="d-arrow">↗</span></button>`).join('')||'<p class="empty">該当するキャラが見つかりません。</p>';
 $$('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===state.filter)));
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
   <div class="world-cast-grid">${group.length?group.map(c=>`<button type="button" class="world-cast-card" data-world-character="${esc(c.id)}" style="--cast-accent:${esc(c.colors.accent)}"><span class="world-cast-visual"><img src="${esc(icon(c))}" alt="" style="${cropStyle(c)}"></span><span class="world-cast-info"><small class="mono">FILE #${esc(c.no)} ${c.playable?' / zeta':''}</small><strong>${esc(c.name)}</strong><em>VIEW PROFILE ↗</em></span></button>`).join(''):'<p class="world-detail-empty">キャラクターはまだ登録されていません。</p>'}</div>
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
}
function setNav(){$$('[data-nav]').forEach(b=>b.classList.toggle('active',state.panel==='directory'?b.dataset.nav==='index':(state.panel==='worldsPanel'||state.panel==='worldDetailPanel')?b.dataset.nav==='worlds':state.panel==='aboutPanel'?b.dataset.nav==='about':b.dataset.nav==='select'))}
function open(which,routing=true){close(false);state.panel=which;const el=$(which);el.setAttribute('aria-hidden','false');el.classList.add('open');$('scrim').hidden=false;requestAnimationFrame(()=>$('scrim').classList.add('visible'));document.body.style.overflow='hidden';document.body.classList.toggle('detail-open',which==='dossier');if(which==='dossier')renderDossier();if(which==='directory')renderDirectory();if(which==='worldsPanel')renderWorlds();if(which==='worldDetailPanel')renderWorldDetail();if(which==='aboutPanel')renderAbout();setNav();if(routing)route(which==='dossier'?'char/'+cur().id+'/'+state.tab:which==='directory'?'index':which==='aboutPanel'?'about':which==='worldDetailPanel'?'world/'+state.world:'worlds');el.querySelector('[data-close]')?.focus({preventScroll:true})}
function close(routing=true){$$('.dossier,.directory').forEach(el=>{el.classList.remove('open');el.setAttribute('aria-hidden','true')});$('scrim').classList.remove('visible');$('scrim').hidden=true;document.body.style.overflow='';document.body.classList.remove('detail-open');const before=state.panel;state.panel=null;setNav();if(before&&routing&&cur())route('char/'+cur().id)}
function openWorld(id){if(!worldById(id))return;state.world=id;state.filter='all';$('search').value='';open('worldDetailPanel')}
function tab(k){state.tab=k;renderDossier();route('char/'+cur().id+'/'+k)}
function onRoute(){if(document.body.classList.contains('admin-open'))return;const path=decodeURIComponent(location.hash.replace(/^#/,'')),parts=path.split('/');if(parts[0]==='char'){
 const i=state.people.findIndex(c=>c.id===parts[1]);if(i>=0){state.index=i;load({animate:false});if(['profile','story','gallery','links'].includes(parts[2])){state.tab=parts[2];open('dossier',false)}else close(false);return}
 }if(parts[0]==='world'&&worldById(parts[1])){state.world=parts[1];open('worldDetailPanel',false);return}if(path==='index'){state.world='';state.filter='all';open('directory',false);return}if(path==='worlds'){open('worldsPanel',false);return}if(path==='about'){open('aboutPanel',false);return}close(false)}
function toast(t){const el=$('toast');el.textContent=t;el.classList.add('show');clearTimeout(state.timer);state.timer=setTimeout(()=>el.classList.remove('show'),3600)}
function refresh(mode='published'){const id=cur()?.id;state.mode=mode;hydrate(mode==='draft'?api.getDraft():api.getPublished(),mode);state.index=Math.max(0,state.people.findIndex(c=>c.id===id));if(!state.people.length)state.index=0;close(false);load({animate:false});renderWorlds();renderAbout();onRoute();$('draftIndicator').hidden=mode!=='draft';}
window.CAST_PUBLIC={refresh,openCharacter:id=>choose(id,{detail:true}),toast};
$('pickerStrip').addEventListener('click',e=>{const b=e.target.closest('[data-person]');if(b)choose(b.dataset.person)});
$('prev').onclick=()=>shift(-1);$('next').onclick=()=>shift(1);
$('pickerStrip').addEventListener('scroll',updatePickerEdges,{passive:true});window.addEventListener('resize',()=>{followSelected(false);updatePickerEdges()});
$('pickerEdgePrev').onclick=()=>shift(-1);$('pickerEdgeNext').onclick=()=>shift(1);
$('openDetail').onclick=()=>{state.tab='profile';open('dossier')};
$('openIndex').onclick=()=>{state.world='';state.filter='all';$('search').value='';open('directory')};
$$('[data-nav]').forEach(b=>b.onclick=()=>{if(b.dataset.nav==='select')close();else if(b.dataset.nav==='index'){state.world='';state.filter='all';$('search').value='';open('directory')}else if(b.dataset.nav==='worlds')open('worldsPanel');else open('aboutPanel')});
$('brandHome').onclick=e=>{e.preventDefault();if(state.people.length)choose(state.people[0].id)};
$$('[data-close]').forEach(b=>b.onclick=()=>close());$('scrim').onclick=()=>close();
$$('.dossier-tabs [data-tab]').forEach(b=>b.onclick=()=>tab(b.dataset.tab));$('search').addEventListener('input',renderDirectory);
$$('[data-filter]').forEach(b=>b.onclick=()=>{state.filter=b.dataset.filter;state.world='';renderDirectory()});
$('directoryItems').addEventListener('click',e=>{const b=e.target.closest('[data-pick]');if(b)choose(b.dataset.pick)});
$('copyFa').addEventListener('click',()=>{const t=website().faTag||'';if(navigator.clipboard?.writeText)navigator.clipboard.writeText(t).then(()=>toast('FAタグをコピーしたよ')).catch(()=>window.prompt('FAタグをコピー',t));else window.prompt('FAタグをコピー',t)});
$('worldCards').addEventListener('click',e=>{const b=e.target.closest('[data-world]');if(b)openWorld(b.dataset.world)});
$('worldDetailBack').onclick=()=>open('worldsPanel');
$('worldDetailContent').addEventListener('click',e=>{const b=e.target.closest('[data-world-character]');if(b)choose(b.dataset.worldCharacter,{detail:true})});
$('dossierContent').addEventListener('click',e=>{const mode=e.target.closest('[data-gallery-mode]'),pick=e.target.closest('[data-gallery-select]');if(mode){galleryState.view=mode.dataset.galleryMode;renderDossier()}else if(pick){galleryState.focus=Number(pick.dataset.gallerySelect);renderDossier()}});
$('motionToggle').onclick=()=>{state.animations=!state.animations;document.body.classList.toggle('no-motion',!state.animations);$('motionToggle').innerHTML=`MOTION <b>${state.animations?'ON':'OFF'}</b>`;$('motionToggle').setAttribute('aria-pressed',String(state.animations))};
$('motionToggle').innerHTML=`MOTION <b>${state.animations?'ON':'OFF'}</b>`;
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
