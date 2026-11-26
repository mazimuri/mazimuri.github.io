window.CAST_DATA_READY.then(() => {
'use strict';
const api=window.CAST_DATA, pub=window.CAST_PUBLIC;
const $=id=>document.getElementById(id), $$=q=>[...document.querySelectorAll(q)];
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cleanColor=(x,fallback='#eafa42')=>/^#[0-9a-f]{6}$/i.test(x)?x:fallback;
const state={section:'dashboard',charId:null,worldId:null,tab:'basic',dragId:null,saveTimer:null,cropMode:'choose',worldImageView:'select',worldImageSaveTimer:null,worldImageDrag:null};
// Same ORPHE approved FILE badge baseline as app.js. Saved personal values win.
const BADGE_DESKTOP_DEFAULT=Object.freeze({right:9.051756007393713,top:14.186685998241362});
const doc=()=>api.getDraft();
const selected=()=>doc().characters.find(c=>c.id===state.charId);
const world=()=>doc().worlds.find(w=>w.id===state.worldId);
const sortId=(arr,id,delta)=>{const idx=arr.findIndex(x=>x.id===id);const target=idx+delta;if(idx<0||target<0||target>=arr.length)return;[arr[idx],arr[target]]=[arr[target],arr[idx]]};
function persist(note='クラウドに保存済み'){$('adminStatus').textContent='● CLOUD DRAFT';const el=$('saveStatus');el.textContent='クラウド保存中…';api.saveDraft().then(ok=>{el.textContent=ok?note:'⚠ クラウド保存失敗。ネット接続・権限を確認してね';el.style.color=ok?'#b8cc98':'#ff9b82'});return true}
function notify(m){pub.toast(m)}
function visible(on){$('admin').hidden=!on;document.body.classList.toggle('admin-open',on);document.body.style.overflow=on?'hidden':''}
function enter(){visible(true);render()}
function exit(){visible(false);pub.refresh('published')}
function preview(id=state.section==='characters'?selected()?.id:null){visible(false);pub.refresh('draft');if(id&&doc().characters.some(c=>c.id===id))pub.openCharacter(id);notify('下書きプレビューです。ネットには公開されません')}
async function publish(){
 const yes=confirm('公開するキャラクターとWORLDを確認しましたか？\n\n公開用データをSupabaseに保存し、公開サイトから実際に読み取れることまで確認します。HTML/CSSの変更やGitHubへの自動アップロードは行いません。');
 if(!yes)return;
 const button=$('adminPublish');button.disabled=true;
 let verified=false;
 $('adminStatus').textContent='● PUBLISHING…';
 try{
  if(!(await api.publish()))throw Error(api.getLastError?.()||'公開できませんでした');
  verified=true;visible(false);pub.refresh('published');
  const live=api.getPublished();const characterCount=live.characters?.length??0;const worldCount=live.worlds?.length??0;
  notify(`公開サイトからの読み取り確認済み：キャラ${characterCount}人／WORLD${worldCount}件。公開中のタブも自動更新を試みます`);
 }catch(e){
  const message=e.message||String(e);
  $('saveStatus').textContent='⚠ 公開の確認が必要：'+message;
  $('saveStatus').style.color='#ff9b82';
  notify('公開の確認が必要：'+message);
 }
 finally{button.disabled=false;$('adminStatus').textContent=verified?'● PUBLIC VERIFIED':'● PUBLISH CHECK FAILED'}
}
function setSection(s){state.section=s;state.charId=null;state.worldId=null;render()}
function headline(kicker,title,desc,right=''){return `<div class="admin-headline"><div><div class="admin-kicker">${esc(kicker)}</div><h2>${esc(title)}</h2><p>${esc(desc)}</p></div>${right}</div>`}
function btn(action,text,cls='',attrs=''){return `<button type="button" class="admin-btn ${cls}" data-action="${action}" ${attrs}>${text}</button>`}
function f(label,key,value,opt={}){
 const attr=`data-bind="${esc(key)}"`;const wide=opt.wide?' wide':'';
 return `<div class="form-field${wide}"><label>${esc(label)}</label>${opt.area?`<textarea ${attr} rows="${opt.rows||4}" placeholder="${esc(opt.placeholder||'')}">${esc(value)}</textarea>`:`<input ${attr} type="text" value="${esc(value)}" placeholder="${esc(opt.placeholder||'')}">`}</div>`;
}
function renderDashboard(){const d=doc(),active=d.characters.filter(c=>c.published!==false).length;
 return `${headline('ADMIN / CONTROL ROOM','OVERVIEW','キャラクターを登録して、クラウド保存 → 下書きプレビュー → サイトに公開。')}
 <div class="admin-metrics"><div class="admin-metric"><small>CHARACTERS</small><strong>${String(d.characters.length).padStart(2,'0')}</strong><span>登録キャラクター</span></div><div class="admin-metric"><small>WORLDS</small><strong>${String(d.worlds.length).padStart(2,'0')}</strong><span>世界観・作品</span></div><div class="admin-metric"><small>PUBLIC STATUS</small><strong>${String(active).padStart(2,'0')}</strong><span>公開対象</span></div></div>
 <div class="admin-two"><div class="admin-card"><div class="admin-kicker">START EDITING / 01</div><h3>YOUR CAST, YOUR RULES.</h3><p>立ち絵・顔アイコン・ローマ字名・TYPE・性格・タグ・作品・カラーなどを全部この画面から編集。キャラ順はドラッグか矢印で変更できます。</p><div class="form-actions">${btn('new-char','＋ 新しいキャラを登録','accent')}${btn('show-chars','キャラ一覧を編集')}</div></div>
 <div class="admin-card"><div class="admin-kicker">PUBLISH WORKSPACE / 02</div><h3>クラウド保存 → プレビュー → サイト公開</h3><p>下書きはSupabaseに管理者だけがアクセス可能な状態で保存されます。上部の公開ボタンで公開用データを更新できます。</p>${btn('show-publish','↗ GitHub公開用に書き出す','accent')}${btn('show-backup','バックアップを確認','small')}</div></div>
 <div class="admin-card" style="margin-top:18px"><h3>登録済みキャラクター</h3>${renderRows(false)}</div>`;
}
function renderRows(reorder=true){const d=doc();return d.characters.map((c,i)=>`<div class="admin-row" draggable="${reorder}" data-drag-id="${esc(c.id)}"><span class="drag-handle" title="ドラッグして移動">⠿</span><span class="row-number">${String(i+1).padStart(3,'0')}</span><img class="row-art" src="${esc(c.icon||c.artwork||'')}" alt=""><div class="row-desc"><strong>${esc(c.name||'名前未定')}${c.playable?'<b class="tiny-zeta">zeta</b>':''}</strong><small>${esc(c.roman||'UNNAMED')} / ${c.published===false?'DRAFT ONLY':'公開対象'}</small></div><div class="row-actions">${btn('move-up','↑','small',`data-id="${esc(c.id)}" title="上へ"`)}${btn('move-down','↓','small',`data-id="${esc(c.id)}" title="下へ"`)}${btn('edit-char','EDIT ↗','small',`data-id="${esc(c.id)}"`)}</div></div>`).join('')||'<div class="empty-visual">まだキャラは登録されていません。</div>'}
function renderCharacters(){return `${headline('01 / SORT & EDIT','CHARACTERS','番号は表示順で自動生成。途中に挿入しても個別ページのIDは変わりません。',btn('new-char','＋ NEW CHARACTER','accent'))}
 <div class="admin-card"><div class="admin-kicker">DISPLAY ORDER / DRAG OR ARROWS</div><p>ドラッグして並び替え。スマホでは ↑↓ ボタンを使ってね。新規登録時には挿入位置を選べます。</p>${renderRows(true)}</div>`}
const cropVals=(c,mode='choose')=>{const p={x:50,y:30,zoom:c.icon?1:2.05,...(c.iconCrop||{y:Number.isFinite(Number(c.iconPosition))?Number(c.iconPosition):30})};return mode==='all'?{...p,...(c.allCastCrop||{})}:mode==='mobile'?{...p,...(c.mobileIconCrop||{})}:p};
const cropAttrs=(c,mode='choose')=>{const p=cropVals(c,mode);return `--crop-x:${Number(p.x)}%;--crop-y:${Number(p.y)}%;--crop-zoom:${Number(p.zoom)}`};
const cropMode=()=>state.cropMode;
const setCrop=(c,p)=>{if(cropMode()==='all')c.allCastCrop=p;else if(cropMode()==='mobile')c.mobileIconCrop=p;else c.iconCrop=p};
const artVals=c=>({x:0,y:0,zoom:1,...(c.artPosition||{})});
const artAttrs=c=>{const p=artVals(c);return `--art-x:${Number(p.x)}%;--art-y:${Number(p.y)}%;--art-zoom:${Number(p.zoom)}`};
const tagLabels=c=>(c.tagIds||[]).map(id=>doc().tags.find(t=>t.id===id)?.label).filter(Boolean);
function commitTags(c,raw){
 const names=[...new Set(String(raw||'').split(/[,，、]/).map(x=>x.trim()).filter(Boolean))];
 const ids=[];
 for(const name of names){let tag=doc().tags.find(t=>t.label.toLocaleLowerCase('ja')===name.toLocaleLowerCase('ja'));if(!tag){tag={id:api.createId('tag'),label:name};doc().tags.push(tag)}ids.push(tag.id)}
 c.tagIds=ids;persist();return true
}
function tagView(c){return `<div class="tag-chip-editor">${tagLabels(c).map((name,i)=>`<div class="tag-sort-chip"><b>${String(i+1).padStart(2,'0')}</b><span>${esc(name)}</span>${btn('tag-left','←','small',`data-index="${i}" aria-label="${esc(name)}を左へ"`)}${btn('tag-right','→','small',`data-index="${i}" aria-label="${esc(name)}を右へ"`)}${btn('tag-remove','×','small',`data-index="${i}" aria-label="${esc(name)}を削除"`)}</div>`).join('')||'<p class="hint">タグはまだありません。</p>'}</div>`}
function relatedRows(c){const all=doc().characters.filter(ch=>ch.id!==c.id);return `<div class="relation-editor">${(c.relationships||[]).map((r,i)=>`<div class="relation-editor-row"><div class="form-field"><label>つながるキャラ</label><select data-relation-index="${i}" data-relation-field="targetId">${all.map(x=>`<option value="${esc(x.id)}" ${x.id===r.targetId?'selected':''}>${esc(x.name)}</option>`).join('')}</select></div><div class="form-field"><label>関係性（例：同僚・旧知）</label><input type="text" data-relation-index="${i}" data-relation-field="type" value="${esc(r.type||'')}" placeholder="例：旧知の仲"></div><div class="form-field"><label>補足（任意）</label><input type="text" data-relation-index="${i}" data-relation-field="detail" value="${esc(r.detail||'')}" placeholder="短い関係性の説明"></div>${btn('relation-up','↑','small',`data-index="${i}"`)}${btn('relation-down','↓','small',`data-index="${i}"`)}${btn('relation-del','削除','small danger',`data-index="${i}"`)}</div>`).join('')}</div>${btn('relation-add','＋ 関連キャラを登録','small')}`}

const limit=(n,a,b)=>Math.max(a,Math.min(b,n));

function cropStudio(c){
 const mode=cropMode(),p=cropVals(c,mode),src=esc(c.icon||c.artwork||'');
 const option=(value,title,desc)=>`<button type="button" data-action="crop-mode" data-view="${value}" class="crop-mode-btn ${mode===value?'active':''}" aria-pressed="${mode===value}"><b>${title}</b><small>${desc}</small></button>`;
 const sliders=['x','y'].map(k=>`<div class="crop-control-row"><label>${k==='x'?'HORIZONTAL / X':'VERTICAL / Y'} <b id="crop${k.toUpperCase()}Label">${Math.round(p[k])}%</b></label><input type="range" min="0" max="100" step="1" value="${p[k]}" data-crop-axis="${k}"></div>`).join('');
 return `<div class="form-field wide icon-studio v15-icon-studio"><div class="crop-edit-head"><b>ICON CROP STUDIO / アイコン表示範囲</b><span class="mono">INDEPENDENT CROPS</span></div>
 <p class="crop-hint">PCの横長選択カード・スマホの顔アイコン・ALL CAST一覧は別々に編集・保存できます。黄色い枠をドラッグして表示位置を調整してください。</p>
 <div class="crop-mode-tabs" role="group" aria-label="アイコン表示の編集先">${option('choose','PC SELECT','斜めの横長アイコン')}${option('mobile','MOBILE SELECT','スマホの顔アイコン')}${option('all','ALL CAST','キャラ一覧・関連キャラ')}</div>
 <div class="crop-editor"><div class="crop-main"><span class="crop-mark mono">DRAG TO ADJUST / ${mode==='all'?'ALL CAST':mode==='mobile'?'MOBILE CHARACTER SELECTOR':'RIGHT CHARACTER SELECTOR'}</span>
 <div class="crop-canvas ${mode==='all'?'crop-gallery-mode':mode==='mobile'?'crop-mobile-mode':'crop-picker-mode'}" id="cropCanvas" role="img" aria-label="ドラッグして画像の表示範囲を調整">${mode==='choose'?`<span class="v15-rail-shell"><span class="v15-rail-inner"><img data-crop-render id="cropMainImg" src="${src}" style="${cropAttrs(c,mode)}" alt=""></span></span>`:`<img data-crop-render id="cropMainImg" src="${src}" style="${cropAttrs(c,mode)}" alt="">`}<span class="v15-crop-label">${esc(c.name)}</span>${mode==='choose'?'<i class="crop-guide-corner tl" aria-hidden="true"></i><i class="crop-guide-corner tr" aria-hidden="true"></i><i class="crop-guide-corner bl" aria-hidden="true"></i><i class="crop-guide-corner br" aria-hidden="true"></i>':''}</div>
 <div class="crop-control-row"><label>ZOOM / <b id="cropZoomLabel">${Number(p.zoom).toFixed(2)}×</b></label><input id="cropZoom" type="range" min="1" max="4" step="0.05" value="${p.zoom}" data-crop-zoom></div>${sliders}
 <div class="crop-small-actions">${btn('crop-enable-y','↕ 上下の移動幅を増やす','small')}${btn('crop-reset','↺ この枠の位置をリセット','small')}<small>キャラクターを変更しても設定は個別に保持。公開にはPUBLISH操作が必要です。</small></div></div>
 <div class="crop-live-col"><span class="mono">RIGHT SELECTOR / LIVE</span><div class="crop-rail-visual v15-crop-rail-visual"><span class="crop-rail-frame"><span class="v15-rail-shell"><span class="v15-rail-inner"><img data-crop-render class="crop-shared" src="${src}" style="${cropAttrs(c,'choose')}" alt=""></span></span><span class="v15-mini-name">${esc(c.name)}</span></span><div><small>SELECTED / NO.${String(doc().characters.indexOf(c)+1).padStart(3,'0')}</small><b>RIGHT CAST RAIL</b></div></div>
 <span class="mono">MOBILE SELECT / LIVE</span><div class="crop-phone-preview"><span class="crop-phone-frame"><img data-crop-render class="crop-shared" src="${src}" style="${cropAttrs(c,'mobile')}" alt=""></span><strong>${esc(c.name)}</strong></div><span class="mono">ALL CAST / LIVE</span><div class="crop-gallery-preview"><span class="crop-gallery-frame"><img data-crop-render class="crop-shared" src="${src}" style="${cropAttrs(c,'all')}" alt=""></span><strong>${esc(c.name)}</strong></div></div></div></div>`;
}
const badgeIsMobile=()=>matchMedia('(max-width:800px)').matches;
const badgeField=()=>badgeIsMobile()?'fileBadgePositionMobile':'fileBadgePosition';
const badgeVals=c=>({... (badgeIsMobile()?{right:8,top:66}:{...BADGE_DESKTOP_DEFAULT}),...(c[badgeField()]||{})});
function artStudio(c){const p=artVals(c),b=badgeVals(c),number=String(doc().characters.indexOf(c)+1).padStart(3,'0');return `<section class="form-section"><h3>MAIN VISUAL STUDIO / 立ち絵とFILE番号の表示調整</h3>
 <p class="crop-hint">公開側のSELECT画面から立ち絵・FILE番号の配置を取得して縮小表示します。立ち絵や番号をドラッグして調整できます。位置はキャラ別に保存されます。</p>
 <p class="vstudio-mobile-note">MOBILE SELECTではFILE番号は非表示で、立ち絵の位置・倍率も固定です。下の位置調整はPC SELECT用として保存されます。PC幅で操作すると実際の変化を確認できます。</p>
 <div class="art-editor v594-art-editor"><div class="art-stage" id="artStage" role="group" aria-label="立ち絵のライブプレビュー。画像ドラッグで立ち絵、丸い番号ドラッグでバッジを動かせます">
 <div class="art-preview-scene hero theme-${['orphe','rov','unnamed'].includes(c.id)?c.id:'generic'}" id="artPreviewScene" style="--accent:${cleanColor(c.colors?.accent)};--deep:${cleanColor(c.colors?.deep)};--soft:${cleanColor(c.colors?.soft)};--bright:${cleanColor(c.colors?.bright)}">
 <div class="hero-surface"></div><div class="hero-dark-panel"></div><div class="hero-accent-slab"></div><div class="hero-pattern"></div><div class="hero-art-wrap" id="artPreviewWrap"><img class="hero-art" id="artStageImg" src="${esc(c.artwork||'')}" style="${artAttrs(c)}" alt=""></div>
 <div class="hero-art-stamp" id="artPreviewBadge" style="--badge-right:${(c.fileBadgePosition||{}).right??BADGE_DESKTOP_DEFAULT.right}%;--badge-top:${(c.fileBadgePosition||{}).top??BADGE_DESKTOP_DEFAULT.top}%;--badge-mobile-right:${(c.fileBadgePositionMobile||{}).right??8}%;--badge-mobile-top:${(c.fileBadgePositionMobile||{}).top??66}%"><span class="v7-stamp-original">FILE<br><b>${number}</b></span><span class="v7-stamp-detail" aria-hidden="true"><span class="v7-stamp-corner tl"></span><span class="v7-stamp-corner tr"></span><span class="v7-stamp-corner bl"></span><span class="v7-stamp-corner br"></span><span class="v7-stamp-inner"><small>FILE</small><strong>${number}</strong><i></i></span></span></div></div>
 <span class="art-stage-top mono">LIVE SELECT / DRAG ART OR FILE BADGE</span></div>
 <div class="art-controls"><div class="form-field"><label>SIZE / 倍率 <b id="artZoomLabel">${Number(p.zoom).toFixed(2)}×</b></label><input type="range" data-art-control="zoom" min="0.5" max="2.5" step="0.05" value="${p.zoom}"></div>
 <div class="form-field"><label>HORIZONTAL / 左右 <b id="artXLabel">${Math.round(p.x)}%</b></label><input type="range" data-art-control="x" min="-65" max="65" step="1" value="${p.x}"></div>
 <div class="form-field"><label>VERTICAL / 上下 <b id="artYLabel">${Math.round(p.y)}%</b></label><input type="range" data-art-control="y" min="-65" max="65" step="1" value="${p.y}"></div>
 <div class="form-field art-badge-control"><label>FILE BADGE / 左右 <b id="badgeRightLabel">${Math.round(b.right)}%</b></label><input type="range" data-badge-control="right" min="0" max="75" step="1" value="${b.right}"></div>
 <div class="form-field art-badge-control"><label>FILE BADGE / 上下 <b id="badgeTopLabel">${Math.round(b.top)}%</b></label><input type="range" data-badge-control="top" min="0" max="75" step="1" value="${b.top}"></div>
 ${btn('art-reset','↺ 立ち絵位置をリセット','small')} ${btn('badge-reset','↺ FILE番号の位置をリセット','small')}
 <p class="crop-hint">ヒント：立ち絵は背景側をドラッグ、FILE番号は丸いバッジをドラッグ。画面比率を変えた場合も縮小プレビューが追従します。</p></div></div></section>`}

const charTabs=[['basic','IDENTITY'],['visual','VISUAL'],['profile','PROFILE'],['story','STORY'],['gallery','GALLERY'],['links','LINKS'],['sound','SOUNDTRACK']];
function colorCell(key,label,c){const hex=cleanColor(c.colors?.[key],key==='accent'?'#e8fb46':'#ffffff');return `<div class="color-cell"><label>${esc(label)}</label><div class="color-input"><input type="color" data-color="${esc(key)}" value="${hex}" aria-label="${esc(label)}カラーを選択"><input type="text" data-hex="${esc(key)}" value="${hex}" maxlength="7" aria-label="HEXカラーコード"></div></div>`}
function imageSlot(c,key,title,hint){const src=c[key]||'',input=`<input data-image="${key}" type="file" accept="image/png,image/jpeg,image/webp,image/gif" aria-label="${esc(title)}をアップロード">`;
 return `<div class="image-slot">${src?`<img src="${esc(src)}" alt="">`:'<div class="empty-visual">NO IMAGE</div>'}<div class="slot-info"><strong>${esc(title)}</strong><p>${esc(hint)}</p>${input}${src?`<div>${btn('clear-image','画像を外す','small',`data-field="${esc(key)}"`)}</div>`:''}</div></div>`}
function repeatRows(type,items,cols){return items.map((item,i)=>`<div class="multi-row"><div class="multi-heading"><strong>${type.toUpperCase()} / ${String(i+1).padStart(2,'0')}</strong><div class="admin-toolbar">${btn('repeat-up','↑','small',`data-repeat="${type}" data-index="${i}"`)}${btn('repeat-down','↓','small',`data-repeat="${type}" data-index="${i}"`)}${btn('repeat-del','削除','small danger',`data-repeat="${type}" data-index="${i}"`)}</div></div><div class="form-grid">${cols.map(([key,label,wide])=>`<div class="form-field ${wide?'wide':''}"><label>${esc(label)}</label><input type="text" data-repeat="${type}" data-index="${i}" data-field="${esc(key)}" value="${esc(item[key]||'')}"></div>`).join('')}</div></div>`).join('')}

function soundEditor(target,scope){
 const m=target?.soundtrack||{},has=!!m.src,main=scope==='site';
 return '<section class="form-section"><h3>'+(main?'MAIN THEME / サイト共通BGM':'CHARACTER SOUNDTRACK / 専用楽曲')+'</h3><div class="form-grid">'+
 '<div class="form-field"><label>TRACK TITLE / 曲名</label><input type="text" data-sound-meta="title" data-sound-scope="'+scope+'" value="'+esc(m.title||'')+'" placeholder="'+(main?'CAST // SIGNAL':'曲名を入力')+'"></div>'+
 '<div class="form-field"><label>GENRE / ジャンル（任意）</label><input type="text" data-sound-meta="genre" data-sound-scope="'+scope+'" value="'+esc(m.genre||'')+'" placeholder="Electro Swing"></div>'+
 '<div class="form-field wide"><div class="cs-editor-audio"><span class="cs-editor-status" data-empty="'+String(!has)+'">'+(has?'◆ SOUND FILE / REGISTERED':'◇ SOUND FILE / NOT SET')+'</span>'+
 (has?'<span class="cs-editor-file">'+esc(m.filename||'登録済み音源')+'</span><audio controls preload="none" src="'+esc(m.src)+'"></audio>':'')+
 '<input type="file" accept=".mp3,audio/mpeg" data-sound-upload="'+scope+'" aria-label="MP3音源をアップロード">'+(has?btn('clear-sound','楽曲を外す','small danger','data-sound-scope="'+scope+'"'):'')+
 '<p class="hint">MP3（5MB以下）。下書きに保存され、上部の「サイトに公開する」で音源を公開します。曲を外しても元ファイルは削除されません。公開済み音源のURLは引き続きアクセス可能な場合があります。</p></div></div></div></section>';
}
const soundTarget=scope=>scope==='site'?doc().site:selected();
let soundBusy=false;
async function uploadSound(el){
 const file=el.files?.[0],scope=el.dataset.soundUpload,target=soundTarget(scope);if(!file||!target||soundBusy)return;
 if(!/\.mp3$/i.test(file.name)||file.size===0||file.size>5*1024*1024){notify('MP3形式・5MB以下の音源を選んでね');el.value='';return}
 const old=target.soundtrack,button=$('adminPublish');soundBusy=true;el.disabled=true;if(button)button.disabled=true;
 try{
  const bytes=new Uint8Array(await file.slice(0,4096).arrayBuffer()),valid=bytes[0]===73&&bytes[1]===68&&bytes[2]===51||bytes[0]===255&&(bytes[1]&224)===224;
  if(!valid)throw Error('MP3ファイルとして認識できません');
  const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).replace(/^data:[^;]*;base64,/,'data:audio/mpeg;base64,'));reader.onerror=reject;reader.readAsDataURL(file)});
  target.soundtrack={...(target.soundtrack||{}),title:target.soundtrack?.title||file.name.replace(/\.mp3$/i,''),filename:file.name,src:data};
  if(!(await api.saveDraft())){target.soundtrack=old;throw Error(api.getLastError?.()||'下書き保存に失敗しました')}
  render();notify('音源をクラウド下書きに保存しました。公開ボタンで反映できます。');
 }catch(e){notify('音源の登録に失敗：'+(e.message||'ファイルを確認してください'))}finally{soundBusy=false;el.disabled=false;if(button)button.disabled=false}
}

function charForm(c){const cast=doc().characters,ix=cast.findIndex(v=>v.id===c.id),prev=cast[ix-1],next=cast[ix+1];
 const nav=`<nav class="edit-cast-navigation" aria-label="編集キャラクターの切り替え"><span class="edit-cast-count mono">EDITING CAST <b>${String(ix+1).padStart(3,'0')} / ${String(cast.length).padStart(3,'0')}</b></span><div class="edit-cast-actions">${btn('edit-prev','← PREV','small',prev?`data-id="${esc(prev.id)}" title="${esc(prev.name)}に移動"`:'disabled')}${btn('edit-next','NEXT →','small',next?`data-id="${esc(next.id)}" title="${esc(next.name)}に移動"`:'disabled')}</div></nav>`;
 const tabs=`<div class="edit-tabs">${charTabs.map(([id,name],i)=>`<button type="button" data-char-tab="${id}" class="${state.tab===id?'active':''}">${String(i+1).padStart(2,'0')} ${name}</button>`).join('')}</div>`;
 let part='';
 if(state.tab==='basic')part=`<section class="form-section"><h3>IDENTITY / 基本情報</h3><div class="form-grid">${f('キャラクター名（日本語）','name',c.name)}${f('読み仮名（ひらがな／検索用）','reading',c.reading||'',{placeholder:'例：おるふぇ・ろじえ、すずり'})}${f('別名・検索用キーワード','aliases',c.aliases||'',{wide:true,placeholder:'別名や略称をスペースで区切って登録（任意）'})}${f('ローマ字メイン表記','roman',c.roman)}${f('ローマ字サブ表記','surname',c.surname)}${f('TYPE（英語）','type',c.type)}${f('TYPE（日本語）','roleJa',c.roleJa)}${f('一文紹介・キャッチコピー','hook',c.hook,{wide:true,area:true,rows:2})}${f('キャラクターの台詞（任意）','quote',c.quote||'',{wide:true,area:true,rows:2,placeholder:'例：キャラの印象的な台詞を入力'})}${f('メイン画面の人物紹介（長文は枠内スクロール）','intro',c.intro||'',{wide:true,area:true,rows:4})}</div><div class="admin-tip">SELECT画面には名前・台詞・人物紹介が表示されます。TYPE・種族・性別・一文コピー・年齢・身長は詳細ページに残ります。番号はCAST ORDERで自動生成されます。</div><label class="admin-check"><input type="checkbox" data-boolean="playable" ${c.playable?'checked':''}> zetaで遊べるキャラ（ALL CASTにzetaラベルを表示）</label><br><label class="admin-check"><input type="checkbox" data-boolean="published" ${c.published!==false?'checked':''}> 公開対象に含める（オフなら下書きプレビューのみ）</label></section>`;
 if(state.tab==='visual')part=`<section class="form-section"><h3>VISUAL / イラスト登録</h3><div class="form-grid"><div class="form-field wide">${imageSlot(c,'artwork','メイン立ち絵','背景透過PNG推奨。大きなキャラ選択画面に使用。')}</div><div class="form-field wide">${imageSlot(c,'icon','CHOOSE YOUR CAST 用の顔アイコン','正方形推奨。未登録なら立ち絵をアップで仮表示。')}</div>${cropStudio(c)}</div></section>${artStudio(c)}<section class="form-section"><h3>CHARACTER PALETTE / テーマカラー</h3><p class="hint">4色すべてサイトに反映されます。01 主役色／02 暗い面／03 柔らかな装飾色／04 強調ライン。四角から色を選ぶかHEXコードを直接入力できます。</p><div class="color-row">${colorCell('accent','01 / ACCENT',c)}${colorCell('deep','02 / DEEP',c)}${colorCell('soft','03 / SOFT',c)}${colorCell('bright','04 / BRIGHT',c)}</div><div class="color-preview">${['deep','accent','soft','bright'].map(k=>`<i style="background:${cleanColor(c.colors?.[k])}" data-preview-color="${k}"></i>`).join('')}</div></section>`;
 if(state.tab==='profile')part=`<section class="form-section"><h3>PERSONAL DATA / 詳細プロフィール</h3><div class="form-grid">${f('年齢','age',c.age)}${f('身長','height',c.height)}${f('種族','species',c.species)}${f('性別（自由入力・任意）','gender',c.gender||'',{placeholder:'男性／女性／無性／非公開 など'})}${f('PERSONALITY（性格）','personality',c.personality,{wide:true,area:true,rows:5})}</div></section>
 <section class="form-section"><h3>CUSTOM FIELDS / 自由追加項目</h3><p class="hint">「職業」「危険度」「収容番号」「所属」など、キャラに合わせて自由に増やせます。</p>${repeatRows('fields',c.fields||[],[['label','項目名'],['value','内容']])}${btn('repeat-add','＋ 項目を追加','small',`data-repeat="fields"`)}</section>
 <section class="form-section"><h3>CHARACTER TAGS / 登録数自由</h3><p class="hint">タグ数の上限はありません。タグ名を「,」で区切って入力。登録済みなら再利用、なければタグデータベースに自動追加。入力の順番が公開画面に反映されます。</p><div class="tag-quick"><input id="tagQuickInput" type="text" placeholder="例：幼馴染, 溺愛, 二面性" value="${esc(tagLabels(c).join(', '))}">${btn('tag-apply','タグを反映','accent')}</div><p class="hint">Enterキーや「タグを反映」で確定。上下の矢印で並べ替えできます。</p>${tagView(c)}</section>`;
 if(state.tab==='story')part=`<section class="form-section"><h3>WORLD ASSIGNMENT / 所属する世界</h3><p class="hint">1キャラを複数のWORLDに所属させることもできます。</p><div class="chip-line">${doc().worlds.map(w=>`<label class="chip-check"><input type="checkbox" data-world-id="${esc(w.id)}" ${c.worldIds?.includes(w.id)?'checked':''}> ${esc(w.title)}</label>`).join('')}</div><div class="form-actions">${btn('show-worlds','WORLD管理へ ↗','small')}</div></section>
 <section class="form-section"><h3>STORY / 出演作品</h3><p class="hint">出演作品を複数登録可能。URLを登録すると個別ページからリンクを開けます。</p>${repeatRows('works',c.works||[],[['title','作品タイトル',true],['url','zeta等の作品URL（任意）',true]])}${btn('repeat-add','＋ 作品を追加','small',`data-repeat="works"`)}</section><section class="form-section"><h3>CONNECTED CAST / 関連キャラクター</h3><p class="hint">同じWORLDにいることと、直接の関係性は別。ここで明示した組み合わせだけがプロフィールに表示されます。相手側には自動追加しません。</p>${relatedRows(c)}</section>`;
 if(state.tab==='gallery')part=`<section class="form-section"><h3>GALLERY / 画像ギャラリー</h3><p class="hint">ここに追加した画像はプロフィール内のGALLERYに表示。上下で順番を変更できます。</p>${(c.gallery||[]).map((g,i)=>`<div class="multi-row"><div class="multi-heading"><strong>ARTWORK / ${String(i+1).padStart(2,'0')}</strong><div class="admin-toolbar">${btn('repeat-up','↑','small',`data-repeat="gallery" data-index="${i}"`)}${btn('repeat-down','↓','small',`data-repeat="gallery" data-index="${i}"`)}${btn('repeat-del','削除','small danger',`data-repeat="gallery" data-index="${i}"`)}</div></div><div class="image-slot"><img src="${esc(g.image||'')}" alt=""><div class="slot-info"><input type="file" data-gallery-image="${i}" accept="image/*"><div class="form-field"><label>画像の説明</label><input data-repeat="gallery" data-index="${i}" data-field="caption" value="${esc(g.caption||'')}"></div></div></div></div>`).join('')}${btn('repeat-add','＋ ギャラリー画像を追加','small',`data-repeat="gallery"`)}</section>`;
 if(state.tab==='sound')part=soundEditor(c,'character');
 if(state.tab==='links')part=`<section class="form-section"><h3>EXTERNAL LINKS / 外部リンク</h3><p class="hint">X、個人サイトなどを登録。zetaの作品リンクはSTORYにも登録できます。</p>${repeatRows('links',c.links||[],[['label','表示名'],['url','URL',true]])}${btn('repeat-add','＋ 外部リンクを追加','small',`data-repeat="links"`)}</section>`;
 return `${headline('01 / CHARACTER EDIT','EDIT CHARACTER',`${c.name||'名前未定'} · 個別プロフィール編集`,btn('delete-char','キャラを削除','danger',`data-id="${esc(c.id)}"`))}
 ${nav}<div class="edit-layout"><div class="edit-main">${tabs}${part}<div class="form-actions">${btn('show-chars','← キャラ一覧に戻る')}${btn('preview-char','このキャラをプレビュー ↗','accent')}</div></div><div class="edit-sidebar"><div class="mini-preview" style="--preview-accent:${cleanColor(c.colors?.accent)};--preview-deep:${cleanColor(c.colors?.deep)};--preview-soft:${cleanColor(c.colors?.soft)};--preview-bright:${cleanColor(c.colors?.bright)}"><div class="mini-preview-head">LIVE CAST PREVIEW / <span id="liveNo">${String(doc().characters.indexOf(c)+1).padStart(3,'0')}</span></div><div class="mini-preview-art"><img id="liveImg" src="${esc(c.artwork||'')}" style="${artAttrs(c)}" alt=""></div><div class="mini-preview-info"><strong id="liveRoman">${esc(c.roman)}</strong><span id="liveName">${esc(c.name)}</span><p id="liveHook">${esc(c.hook)}</p>${c.playable?'<b class="tiny-zeta">zeta</b>':''}</div></div><p class="admin-footnote">入力は自動保存。画面右上の「下書きを見る」から実際のキャラ画面を確認できます。</p></div></div>`;
}
function renderWorlds(){
 const d=doc();
 return `${headline('02 / STORY NETWORK','WORLDS','世界観を登録し、キャラと関連づけられます。↑↓でWORLD SELECTの表示順を変更できます。',btn('new-world','＋ NEW WORLD','accent'))}
 <div class="admin-card">${d.worlds.map((w,i)=>{
  const n=d.characters.filter(c=>c.worldIds?.includes(w.id)).length;
  return `<div class="admin-row world-editor-row">
   <span class="row-number">${String(i+1).padStart(2,'0')}</span>
   ${w.image?`<img class="world-art-thumb" src="${esc(w.image)}" alt="">`:''}
   <div class="row-desc"><strong>${esc(w.title)}</strong><small>${n} CHARACTER${n===1?'':'S'} / ${esc(w.category||'')}</small></div>
   <div class="admin-toolbar world-order-actions">
    ${btn('world-up','↑','small',`data-id="${esc(w.id)}" title="ひとつ上へ" aria-label="${esc(w.title)}をひとつ上へ移動" ${i===0?'disabled':''}`)}
    ${btn('world-down','↓','small',`data-id="${esc(w.id)}" title="ひとつ下へ" aria-label="${esc(w.title)}をひとつ下へ移動" ${i===d.worlds.length-1?'disabled':''}`)}
    ${btn('edit-world','EDIT ↗','small',`data-id="${esc(w.id)}"`)}
   </div>
  </div>`;
 }).join('')}</div>`;
}
function worldImageValues(w,mode){
 const p=w?.worldImageCrop?.[mode]||{};
 const clamp=(v,def,min,max)=>{const n=Number(v);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):def};
 return {x:clamp(p.x,0,-100,100),y:clamp(p.y,0,-100,100),zoom:clamp(p.zoom,1,.65,2.5)};
}
function worldImageCss(v){return `--wi-x:${v.x}%;--wi-y:${v.y}%;--wi-z:${v.zoom}`;}
function worldImageActiveMode(){return state.worldImageView==='select'?'select':'detail';}
function worldImageFrameDoc(w,view,idx){
 const num=String(idx).padStart(2,'0'),count=(w.stories||[]).filter(t=>t.title?.trim()).length;
 const cat=esc(w.category||'WORLD ARCHIVE'),title=esc(w.title||'UNNAMED WORLD');
 const image=esc(w.image||''),copy=esc(String(w.cardTeaser||'').trim()||w.summary||w.subtitle||'世界観の紹介は準備中です。');
 const mode=view==='select'?'select':'detail',st=esc(worldImageCss(worldImageValues(w,mode)));
 const cssLinks=`<link rel="stylesheet" href="style.css?v=5.9.13"><link rel="stylesheet" href="mobile.css?v=15.4.0"><link rel="stylesheet" href="cast-worlds-current.css?v=1.0.9"><link rel="stylesheet" href="cast-layout-current.css?v=1.0.0">`;
 let panel='';
 if(view==='select'){
  const motif=w.image?'art':(/零号|研究|施設|RESEARCH|LAB|DARK FANTASY/i.test(String(w.title||'')+' '+String(w.category||''))?'research':'unassigned');
  const art=w.image?`<img class="ws5-backdrop" src="${image}" alt="" draggable="false"><img data-world-preview-img class="ws5-art" src="${image}" alt="" draggable="false" style="${st}">`:'';
  const placeholder=motif==='research'?'<span class="ws5-motif" aria-hidden="true">R0</span><span class="ws5-warning" aria-hidden="true"></span>':motif==='unassigned'?'<span class="ws5-motif" aria-hidden="true"><b>+</b><small>UNASSIGNED</small></span>':'';
  panel=`<aside class="directory worlds-panel" id="worldsPanel"><div class="directory-head"></div><div class="directory-content"><span class="directory-kicker mono">INTERCONNECTED STORIES</span><h2>WORLD <i>SELECT</i><span>.</span></h2><p class="worlds-intro">同じ世界に暮らすキャラクターを、作品から探す。</p><div class="world-cards">
   <button type="button" class="world-card ws5-card ${w.image?'has-cover':'no-cover'}" data-world-preview-anchor>
    <span class="ws5-visual" data-motif="${motif}" aria-hidden="true">${art}<span class="ws5-file-mark"><b>◆</b> FILE / ${num} &nbsp; ${cat}</span><span class="ws5-huge">${num}</span>${placeholder}</span>
    <span class="ws5-info"><span class="ws5-meta"><span>WORLD ID / ${num}</span><b>${count?'STORIES '+String(count).padStart(2,'0'):'WORLD FILE'}</b></span><strong class="ws5-name">${title}</strong><span class="ws5-summary">${copy}</span><span class="ws5-action">OPEN WORLD FILE <span class="ws5-arrow" aria-hidden="true">↗</span></span></span>
   </button></div></div></aside>`;
 }else{
  const accent=/^#[0-9a-f]{6}$/i.test(w.accent)?w.accent:'#eafa42';
  const imageHtml=w.image?`<img src="${image}" alt="" draggable="false" class="world-detail-art" data-world-preview-img style="${st}">`:'';
  panel=`<aside class="directory world-detail-panel" id="worldDetailPanel"><div class="directory-head"></div><div class="world-detail-content"><div class="wd4-center"><section class="wd4-dossier">
   <div class="world-detail-hero wd4-hero" data-world-preview-anchor style="--wd-accent:${esc(accent)}"><div class="world-detail-backdrop">${imageHtml}</div><div class="world-detail-hero-content">
    <div class="world-detail-kicker mono">WORLD DOSSIER / ${num} &nbsp; · &nbsp; ${cat}</div><h2>${title}</h2><span class="world-detail-subtitle">${esc(w.subtitle||w.category||'ORIGINAL WORLD')}</span>
   </div></div></section></div></div></aside>`;
 }
 const iframeFix=`html,body{margin:0!important;padding:0!important;width:100%!important;min-height:100%;background:#151b1e;overflow:visible!important}#worldsPanel,#worldDetailPanel{position:relative!important;display:block!important;visibility:visible!important;opacity:1!important;pointer-events:none!important;transform:none!important;inset:auto!important;top:auto!important;left:auto!important;right:auto!important;bottom:auto!important;width:100%!important;max-width:none!important;height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important}#worldsPanel .directory-head,#worldDetailPanel .directory-head{display:none!important}#worldsPanel .directory-content,#worldDetailPanel .world-detail-content{height:auto!important;max-height:none!important;overflow:visible!important}#worldsPanel .world-card.ws5-card:hover{transform:none!important;border-color:#101719!important;outline-color:#526164!important;box-shadow:8px 9px 0 #05080a,0 0 0 1px #a7b5b644!important}#worldsPanel .world-card.ws5-card:hover .ws5-art{transform:translate(var(--wi-x,0%),var(--wi-y,0%)) scale(var(--wi-z,1))!important}`;
 return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${cssLinks}<style>${iframeFix}</style></head><body>${panel}</body></html>`;
}
function worldImageStudio(w){
 const view=['select','detail','mobile'].includes(state.worldImageView)?state.worldImageView:'select';
 const mode=view==='select'?'select':'detail',v=worldImageValues(w,mode);
 const idx=doc().worlds.findIndex(item=>item.id===w.id)+1;
 const viewport=view==='mobile'?390:view==='detail'?Math.max(1024,window.innerWidth):Math.max(320,window.innerWidth);
 const iframeSrcdoc=esc(worldImageFrameDoc(w,view,idx));
 const hasImage=!!w.image,disabled=hasImage?'':'disabled';
 const tab=(label,key)=>`<button type="button" data-action="world-image-view" data-view="${key}" aria-pressed="${String(view===key)}">${label}</button>`;
 const axis=(label,key,min,max,step)=>`<div class="world-image-range"><label for="world-image-range-${key}">${label}<output data-world-image-value="${key}">${key==='zoom'?v[key].toFixed(2)+'×':Math.round(v[key])+'%'}</output></label><input id="world-image-range-${key}" type="range" data-world-image-axis="${key}" min="${min}" max="${max}" step="${step}" value="${v[key]}" ${disabled}></div>`;
 return `<div class="world-image-studio" id="worldImageStudio">
  <div class="world-image-studio-head"><strong class="world-image-studio-kicker">WORLD IMAGE STUDIO / REAL VIEW PREVIEW</strong><small>公開画面と同じレイアウト・CSSで画像位置を確認できます</small></div>
  <div class="world-image-tabs" role="group" aria-label="WORLD画像のプレビュー切り替え">
   ${tab('SELECT CARD','select')}${tab('DETAIL / PC','detail')}${tab('DETAIL / MOBILE','mobile')}
  </div>
  <div class="world-image-canvas"><div class="world-image-frame-shell" data-world-image-drag aria-label="ドラッグして画像の表示位置を変更">
    <iframe title="${view==='select'?'WORLD SELECT':view==='mobile'?'WORLD DETAIL MOBILE':'WORLD DETAIL PC'} の実際の画面プレビュー" data-world-image-frame
     data-world-preview-viewport="${viewport}" loading="eager" sandbox="allow-same-origin" tabindex="-1"
     style="width:${viewport}px;height:1400px" srcdoc="${iframeSrcdoc}"></iframe>
    <div class="world-image-drag-cover" aria-hidden="true"></div>
   </div></div>
  <div class="world-image-control-grid">
   ${axis('横位置 / X','x',-100,100,1)}${axis('縦位置 / Y','y',-100,100,1)}${axis('拡大率 / ZOOM','zoom',.65,2.5,.05)}
  </div>
  <div class="world-image-studio-foot"><small>画像をドラッグして移動。SELECTとDETAILは別々に保存（PCとMOBILEは共通）。</small><div class="world-image-studio-actions"><button type="button" data-action="world-image-expand">↗ PREVIEWを拡大</button><button type="button" data-action="world-image-reset" ${disabled}>↺ RESET POSITION</button></div></div>
 </div>`;
}
function worldImageFit(frame=document.querySelector('#worldImageStudio [data-world-image-frame]')){
 if(!frame||!frame.isConnected)return;
 const target=frame.contentDocument?.querySelector('[data-world-preview-anchor]');
 const canvas=frame.closest('.world-image-canvas');
 const shell=frame.closest('.world-image-frame-shell');
 if(!target||!canvas||!shell)return;
 // Match the public WORLD SELECT title fitting before measuring the crop anchor.
 const frameWin=frame.contentWindow;
 const title=target.querySelector('.ws5-name');
 if(title){
  title.style.removeProperty('--cast-title-size');
  title.removeAttribute('data-cast-wrap');
  if(frameWin?.matchMedia('(min-width:1500px)').matches&&title.clientWidth){
   let size=parseFloat(frameWin.getComputedStyle(title).fontSize);
   while(title.scrollWidth>title.clientWidth+1&&size>18){
    size=Math.max(18,size-1);
    title.style.setProperty('--cast-title-size',size+'px');
   }
   if(title.scrollWidth>title.clientWidth+1)title.setAttribute('data-cast-wrap','');
  }
 }
 const rect=target.getBoundingClientRect();
 if(!(rect.width>0&&rect.height>0))return;
 const css=getComputedStyle(canvas);
 const available=Math.max(120,canvas.clientWidth-(parseFloat(css.paddingLeft)||0)-(parseFloat(css.paddingRight)||0)-4);
 const scale=Math.min(1,available/rect.width);
 shell.style.width=Math.ceil(rect.width*scale)+'px';
 shell.style.height=Math.ceil(rect.height*scale)+'px';
 shell.dataset.worldPreviewScale=String(scale);
 frame.style.transform=`translate(${-rect.left*scale}px,${-rect.top*scale}px) scale(${scale})`;
 frame.style.visibility='visible';
}
function worldImageFrameReady(frame){
 if(!frame?.isConnected||!frame.contentDocument)return;
 worldImageFit(frame);
 const doc=frame.contentDocument;
 if(doc.fonts?.ready)doc.fonts.ready.then(()=>{if(frame.isConnected)worldImageFit(frame)}).catch(()=>{});
 const img=doc.querySelector('[data-world-preview-img]');
 if(img&&!img.complete)img.addEventListener('load',()=>{if(frame.isConnected)worldImageFit(frame)},{once:true});
}
function worldImageToggleExpand(){
 const studio=document.getElementById('worldImageStudio');
 if(!studio)return;
 const expanded=studio.classList.toggle('is-expanded');
 const b=studio.querySelector('[data-action="world-image-expand"]');
 if(b)b.textContent=expanded?'↙ プレビューを戻す':'↗ PREVIEWを拡大';
 requestAnimationFrame(()=>worldImageFit());
}
function worldImageSync(){
 const w=world(),panel=document.getElementById('worldImageStudio');
 if(!w||!panel)return;
 const v=worldImageValues(w,worldImageActiveMode());
 const frame=panel.querySelector('[data-world-image-frame]');
 const img=frame?.contentDocument?.querySelector('[data-world-preview-img]');
 if(img)img.setAttribute('style',worldImageCss(v));
 for(const key of ['x','y','zoom']){
  const inp=panel.querySelector(`[data-world-image-axis="${key}"]`);
  const output=panel.querySelector(`[data-world-image-value="${key}"]`);
  if(inp)inp.value=v[key];
  if(output)output.textContent=key==='zoom'?v[key].toFixed(2)+'×':Math.round(v[key])+'%';
 }
}
function worldImageUpdateCopy(w){
 const frame=document.querySelector('#worldImageStudio [data-world-image-frame]');
 const inner=frame?.contentDocument;
 if(inner){
  const titles=inner.querySelectorAll('.ws5-name,.world-detail-hero-content h2');
  titles.forEach(t=>t.textContent=w.title||'UNNAMED WORLD');
  const copy=inner.querySelector('.ws5-summary');
  if(copy)copy.textContent=String(w.cardTeaser||'').trim()||w.summary||w.subtitle||'世界観の紹介は準備中です。';
  const subtitle=inner.querySelector('.world-detail-subtitle');
  if(subtitle)subtitle.textContent=w.subtitle||w.category||'ORIGINAL WORLD';
  const cat=inner.querySelector('.ws5-file-mark');
  if(cat)cat.innerHTML='<b>◆</b> FILE / '+String(doc().worlds.indexOf(w)+1).padStart(2,'0')+' &nbsp; '+esc(w.category||'WORLD ARCHIVE');
  const kicker=inner.querySelector('.world-detail-kicker');
  if(kicker)kicker.textContent='WORLD DOSSIER / '+String(doc().worlds.indexOf(w)+1).padStart(2,'0')+' · '+(w.category||'ARCHIVE');
  worldImageFit(frame);
 }
 const mini=document.querySelector('.edit-sidebar .mini-preview-info');
 if(mini){
  const t=mini.querySelector('strong'),p=mini.querySelector('p');
  if(t)t.textContent=w.title||'';
  if(p)p.textContent=String(w.cardTeaser||'').trim()||w.summary||'';
 }
}
function worldImageScheduleSave(){
 clearTimeout(state.worldImageSaveTimer);
 state.worldImageSaveTimer=setTimeout(()=>{state.worldImageSaveTimer=null;persist('WORLD画像の表示位置を保存したよ')},300);
}
function worldImageSetAxis(axis,value){
 const w=world();if(!w||!w.image||!['x','y','zoom'].includes(axis))return;
 const mode=worldImageActiveMode(),v=worldImageValues(w,mode);
 const num=Number(value);if(!Number.isFinite(num))return;
 v[axis]=axis==='zoom'?Math.max(.65,Math.min(2.5,num)):Math.max(-100,Math.min(100,num));
 w.worldImageCrop={...(w.worldImageCrop||{}),[mode]:v};
 worldImageSync();
 worldImageScheduleSave();
}
function worldImageDragStart(e){
 const stage=e.target.closest?.('[data-world-image-drag]');
 if(!stage||e.button!==0||!world()?.image||state.section!=='worlds')return;
 const frame=stage.querySelector('[data-world-image-frame]');
 const img=frame?.contentDocument?.querySelector('[data-world-preview-img]');
 if(!img)return;
 const vals=worldImageValues(world(),worldImageActiveMode());
 const scale=Number(stage.dataset.worldPreviewScale)||1;
 state.worldImageDrag={pointerId:e.pointerId,stage,img,scale,startX:e.clientX,startY:e.clientY,origin:vals,moved:false};
 stage.classList.add('is-dragging');
 stage.setPointerCapture?.(e.pointerId);
 e.preventDefault();
}
function worldImageDragMove(e){
 const drag=state.worldImageDrag;
 if(!drag||e.pointerId!==drag.pointerId)return;
 const stepX=(e.clientX-drag.startX)*100/Math.max(1,drag.img.offsetWidth*drag.scale*drag.origin.zoom);
 const stepY=(e.clientY-drag.startY)*100/Math.max(1,drag.img.offsetHeight*drag.scale*drag.origin.zoom);
 const x=Math.round(Math.max(-100,Math.min(100,drag.origin.x+stepX)));
 const y=Math.round(Math.max(-100,Math.min(100,drag.origin.y+stepY)));
 if(x===drag.origin.x&&y===drag.origin.y&&!drag.moved)return;
 drag.moved=true;
 const w=world(),mode=worldImageActiveMode();
 w.worldImageCrop={...(w.worldImageCrop||{}),[mode]:{...worldImageValues(w,mode),x,y}};
 worldImageSync();
}
function worldImageDragEnd(e){
 const drag=state.worldImageDrag;
 if(!drag||e.pointerId!==drag.pointerId)return;
 drag.stage.classList.remove('is-dragging');
 if(drag.stage.hasPointerCapture?.(e.pointerId))drag.stage.releasePointerCapture(e.pointerId);
 state.worldImageDrag=null;
 if(drag.moved)worldImageScheduleSave();
}
function worldForm(w){return `${headline('02 / WORLD EDIT','EDIT WORLD',`世界観：${w.title}`,btn('delete-world','WORLDを削除','danger',`data-id="${esc(w.id)}"`))}<div class="edit-layout"><div class="edit-main"><div class="form-section"><h3>WORLD DATA / 作品・世界観</h3><div class="form-grid">${f('WORLD名','title',w.title)}${f('副題・ストーリータイトル','subtitle',w.subtitle)}${f('ジャンル / TYPE','category',w.category)}${f('WORLD代表URL（任意・詳細画面に表示）','link',w.link)}${f('WORLD SELECT用の短い紹介文（1〜2行）','cardTeaser',w.cardTeaser||'',{wide:true,placeholder:'例：希少種への国家保護の知らせが、ロジエ邸の平穏を揺るがす。'})}${f('WORLD DETAIL用の紹介文（本文）','summary',w.summary,{wide:true,area:true,rows:5})}<div class="form-field wide"><label>メイン画像</label>${imageSlot(w,'image','WORLD キービジュアル','この世界を紹介する画像')}</div>${worldImageStudio(w)}<div class="form-field wide"><label>WORLDテーマカラー</label><div class="color-input"><input type="color" data-world-color="accent" value="${cleanColor(w.accent)}"><input type="text" data-world-hex="accent" value="${cleanColor(w.accent)}"></div></div></div></div><div class="form-section"><h3>STORY FILES / このWORLDの複数作品</h3><p class="hint">本編・派生作品を何本でも登録できます。URLがある作品には外部リンクが表示されます。作品名だけの登録もOK。↑↓で順序を変更できます。</p>${repeatRows('worldStories',w.stories||[],[['label','区分（例：MAIN STORY）'],['title','作品タイトル',true],['description','短い紹介文',true],['url','zeta等の作品URL',true]])}${btn('repeat-add','＋ WORLDに作品を追加','small',`data-repeat="worldStories"`)}</div><div class="form-section"><h3>CAST CONNECTION / 登場キャラ</h3><div class="chip-line">${doc().characters.map(c=>`<label class="chip-check"><input type="checkbox" data-assignment-char="${esc(c.id)}" ${c.worldIds?.includes(w.id)?'checked':''}> ${esc(c.name)}</label>`).join('')}</div></div>${btn('show-worlds','← WORLD一覧へ')}</div><aside class="edit-sidebar"><div class="mini-preview" style="--preview-accent:${cleanColor(w.accent)}"><div class="mini-preview-head">WORLD ARCHIVE</div><div class="mini-preview-art"><img src="${esc(w.image||'')}" alt=""></div><div class="mini-preview-info"><strong>${esc(w.title)}</strong><p>${esc(String(w.cardTeaser||'').trim()||w.summary)}</p></div></div></aside></div>`}
function renderTags(){const d=doc();return `${headline('03 / TAXONOMY','TAG DATABASE','キャラ編集画面から自動登録された共通タグの一覧です。名前の一括変更・使用数の確認ができます。',btn('new-tag','＋ NEW TAG','accent'))}<div class="admin-card"><div class="admin-kicker">SHARED TAG LIBRARY</div><p>登録済みのタグを一覧・整理できます。新しいタグは各キャラのPROFILEから直接追加できます。</p>${d.tags.map(t=>{const n=d.characters.filter(c=>c.tagIds?.includes(t.id)).length;return `<div class="tag-manager-row"><span>⌗</span><input type="text" value="${esc(t.label)}" data-tag-name="${esc(t.id)}" aria-label="タグ名"><small>${n} CAST</small>${btn('delete-tag','削除','small danger',`data-id="${esc(t.id)}"`)}</div>`}).join('')}</div>`}
function renderAboutEditor(){
 const t={...api.initial.site,...(doc().site||{})};
 if(!String(t.faTag||'').trim())t.faTag='#まじむり受信中';
 const aboutField=(title,key,area=false,rows=4)=>`<div class="form-field wide"><label>${esc(title)}</label>${area?`<textarea data-site-field="${key}" rows="${rows}">${esc(t[key]||'')}</textarea>`:`<input type="text" data-site-field="${key}" value="${esc(t[key]||'')}">`}</div>`;
 return `${headline('04 / SITE INFORMATION','ABOUT & POLICY','ABOUTページ・画像利用案内・作者SNSリンクをここで編集。公開前に内容を確認してね。')}
 <section class="form-section"><h3>ABOUT / サイト紹介</h3><div class="form-grid">${aboutField('ABOUT 見出し','title')}${aboutField('このサイトについて','intro',true,5)}</div></section>
 <section class="form-section"><h3>USAGE GUIDE / 利用案内</h3><p class="hint">ここに書くのは作者としての希望です。第三者の権利やzeta等の規約を超える許可はできません。</p><div class="form-grid">${aboutField('画像の保存・利用について','imagePolicy',true,5)}${aboutField('二次創作・ファンアートについて','fanPolicy',true,5)}${aboutField('zetaトークスクショについて','screenshotPolicy',true,5)}${aboutField('共通投稿タグ（FA・zetaスクショ・感想）','faTag')}</div></section>
 <section class="form-section"><h3>CREATOR LINKS / 作者リンク</h3><p class="hint">URLを登録するとABOUTとサイト下部にボタンが表示されます。未入力なら表示しません。</p><div class="form-grid">${aboutField('XプロフィールURL','xUrl')}${aboutField('zetaクリエイターページURL','zetaUrl')}</div></section>
 <section class="form-section"><h3>NEW SIGNAL / 新着ラベル</h3><p class="hint">新規キャラが初めて公開された日から指定日数「NEW」を表示。既存キャラの編集ではカウントがリセットされません。0ならオフ。</p><div class="form-grid"><div class="form-field"><label>NEWの表示日数（0〜90日）</label><input type="number" data-site-days min="0" max="90" value="${Math.max(0,Math.min(90,Number(t.newDays)||0))}"></div></div></section>
 ${soundEditor(doc().site,'site')}
 <div class="form-actions">${btn('preview-about','ABOUTをプレビュー ↗','accent')}</div>`;
}
function renderPublish(){const d=doc();return `${headline('06 / DEPLOYMENT','CLOUD PUBLISH / BACKUP EXPORT','キャラクターやWORLDを公開するときは上部の「サイトに公開する」を使ってね。データをSupabaseへ公開し、訪問者側から読み取れるか確認します。ZIPは手動バックアップ用です。')}<div class="admin-two"><div class="admin-card"><div class="admin-kicker">01 / READY TO DEPLOY</div><h3>公開用ZIPを書き出す ↗</h3><p>「公開対象」にしたキャラだけ出力し、WORLDはチェックで選択できます。<strong>元画像を改変せず</strong>、登録データの画像を書き出すよ。</p><div class="publish-select" id="publishSelections"><p>CHARACTERS</p>${d.characters.map((c,i)=>`<label><input type="checkbox" data-pub-char="${esc(c.id)}" ${c.published!==false?'checked':''}><span>${String(i+1).padStart(3,'0')} / ${esc(c.name)}</span></label>`).join('')}<p>WORLDS</p>${d.worlds.map((w,i)=>`<label><input type="checkbox" data-pub-world="${esc(w.id)}" ${w.published!==false?'checked':''}><span>${String(i+1).padStart(2,'0')} / ${esc(w.title)}</span></label>`).join('')}</div>${btn('export-publish','↓ 公開用ZIPを作成','accent')}<p class="admin-publish-status" id="publishStatus">まだ書き出していません。</p></div><div class="admin-card"><div class="admin-kicker">02 / PUBLICATION RULES</div><h3>公開データとデザインの違い</h3><p>キャラ・WORLD・ABOUTの文章や画像は、上部の公開ボタンからSupabaseへ反映します。公開後は訪問者と同じ読み取り権限で照合します。</p><p>サイトのレイアウト・HTML・CSS・JavaScriptはGitHub Pagesで管理し、この公開ボタンでは変更しません。</p><div class="backup-box"><strong>公開リポジトリの注意</strong><p>非公開キャラを除外しても、既にGitHubに存在する古いファイルは自動削除されません。機密データはGitHubへ載せないでね。</p></div>${btn('show-backup','← JSONバックアップを確認','small')}</div></div>`}
function renderBackup(){return `${headline('04 / CLOUD WORKSPACE','BACKUP','下書きはクラウドに保存されます。定期的なJSONバックアップもおすすめ！')}<div class="backup-box"><strong>IMPORTANT / 試作品の保存範囲</strong><p>下書きはログイン中の管理者だけが読み書きできるSupabaseのデータベースに保存されます。新しく登録した画像は下書きでは非公開、公開時に公開用画像としてアップロードされます。定期的にJSONバックアップも保存してください。</p></div><div class="admin-two"><div class="admin-card"><h3>EXPORT DATA ↗</h3><p>登録したキャラ、WORLD、タグ、アップロード画像をひとつのJSONとして保存します。定期的な書き出し推奨。</p>${btn('export','↓ JSONバックアップを書き出す','accent')}</div><div class="admin-card"><h3>IMPORT DATA ↙</h3><p>以前書き出したCAST / SIGNAL v5のJSONバックアップを読み込み、下書き全体を置き換えます。</p><input type="file" id="backupInput" accept="application/json,.json" style="font-size:12px;max-width:100%;margin-top:14px"></div></div><div class="admin-card" style="margin-top:18px"><h3>RESTORE PUBLISHED DATA</h3><p>現在の公開用データで下書きを置き換えます。未公開の変更は失われます。</p>${btn('reset','公開中のデータに下書きを戻す','danger')}</div>`}

/* Mirror the live selected rail card's inner image aspect ratio. The rail
   resizes with both viewport dimensions; a fixed 2.78 editor ratio did not. */
function syncRailCropAspect(){
 const live=document.querySelector('#v5Stack .v5-item[data-slot="3"] .v5-card-inner');
 const w=live?.offsetWidth||0,h=live?.offsetHeight||0;
 const ratio=w>0&&h>0?Math.max(1.25,Math.min(3.7,w/h)):2.25;
 const editor=document.querySelector('#admin .v15-icon-studio');
 if(editor)editor.style.setProperty('--v15-live-card-ratio',String(ratio));
}
window.addEventListener('resize',()=>{
 if(document.querySelector('#admin .v15-icon-studio'))syncRailCropAspect();
},{passive:true});

function render(){const panel=$('adminContent');const section=state.section;
 $$('[data-admin-section]').forEach(b=>b.classList.toggle('active',b.dataset.adminSection===section));$('adminPath').textContent=`/ CONTROL / ${section.toUpperCase()}${state.charId?' / CHARACTER FILE':''}${state.worldId?' / WORLD FILE':''}`;
 let html='';if(section==='dashboard')html=renderDashboard();if(section==='characters')html=state.charId&&selected()?charForm(selected()):renderCharacters();if(section==='worlds')html=state.worldId&&world()?worldForm(world()):renderWorlds();if(section==='tags')html=renderTags();if(section==='about')html=renderAboutEditor();if(section==='backup')html=renderBackup();if(section==='publish')html=renderPublish();panel.innerHTML=html;
 if(panel.querySelector('.v15-icon-studio'))requestAnimationFrame(syncRailCropAspect);
}
function openChar(id){state.section='characters';state.charId=id;state.tab='basic';render();$('adminContent').scrollIntoView({block:'start'})}
function newChar(){const data=doc(),id=api.createId('char');const position=prompt(`何番目に挿入する？ 1〜${data.characters.length+1}（空欄なら最後）`,String(data.characters.length+1));if(position===null)return;const idx=position.trim()?Number(position)-1:data.characters.length;if(!Number.isInteger(idx)||idx<0||idx>data.characters.length){notify('1以上の正しい順番を入力してね');return}const newC={id,name:'新しいキャラクター',reading:'',aliases:'',roman:'NEW CAST',surname:'',type:'ORIGINAL CHARACTER',roleJa:'オリジナルキャラクター',hook:'ここに一文紹介を入力します。',quote:'',intro:'',age:'',height:'',species:'',gender:'',personality:'',artwork:'',icon:'',iconPosition:25,iconCrop:{x:50,y:50,zoom:1},allCastCrop:null,artPosition:{x:0,y:0,zoom:1},fileBadgePosition:{...BADGE_DESKTOP_DEFAULT},fileBadgePositionMobile:null,relationships:[],colors:{accent:'#e8fa42',deep:'#181920',soft:'#f1efef',bright:'#e8fa42'},worldIds:[],tagIds:[],playable:false,works:[],links:[],gallery:[],fields:[],published:false,createdAt:new Date().toISOString(),firstPublishedAt:null};data.characters.splice(idx,0,newC);persist();openChar(id);notify(`${String(idx+1).padStart(3,'0')} に追加したよ！`)}
function newWorld(){state.worldImageView='select';const id=api.createId('world');doc().worlds.push({id,title:'新しいWORLD',subtitle:'',cardTeaser:'',summary:'',category:'',accent:'#e8fa42',image:'',link:'',stories:[],createdAt:new Date().toISOString(),firstPublishedAt:null});persist();state.section='worlds';state.worldId=id;render()}
function newTag(){const name=prompt('新しい共通タグ名を入力してね（例：人外）');if(!name?.trim())return;if(doc().tags.some(t=>t.label===name.trim())){notify('同じ名前のタグが登録済みだよ');return}doc().tags.push({id:api.createId('tag'),label:name.trim()});persist();render()}
function repeat(type,action,index){const c=selected(),w=world();const obj=type==='worldStories'?w:c;if(!obj)return;const name=type==='worldStories'?'stories':type;const list=obj[name]||(obj[name]=[]);if(action==='repeat-add'){const defaults={fields:{label:'',value:''},works:{title:'',url:''},links:{label:'',url:''},gallery:{image:'',caption:''},worldStories:{label:'SIDE STORY',title:'',description:'',url:''}};list.push({...defaults[type]})}else if(action==='repeat-del')list.splice(index,1);else sortIndex(list,index,action==='repeat-up'?-1:1);persist();render()}
function sortIndex(items,idx,delta){const to=idx+delta;if(to<0||to>=items.length)return;[items[idx],items[to]]=[items[to],items[idx]]}
function moveChar(id,delta){sortId(doc().characters,id,delta);persist();render()}
function moveWorld(id,delta){const worlds=doc().worlds;const at=worlds.findIndex(w=>w.id===id);if(at<0||at+delta<0||at+delta>=worlds.length)return;sortId(worlds,id,delta);persist('WORLDの表示順を保存したよ');render()}
function deleteChar(id){const c=doc().characters.find(x=>x.id===id);if(!c||!confirm(`「${c.name}」を下書きから削除する？（まだ公開ビューは変わりません）`))return;doc().characters=doc().characters.filter(x=>x.id!==id);state.charId=null;persist();render()}
function deleteWorld(id){const w=doc().worlds.find(x=>x.id===id);if(!w||!confirm(`「${w.title}」を削除する？関連キャラからも所属が外れます。`))return;doc().worlds=doc().worlds.filter(x=>x.id!==id);doc().characters.forEach(c=>c.worldIds=c.worldIds.filter(x=>x!==id));state.worldId=null;persist();render()}
function deleteTag(id){const t=doc().tags.find(x=>x.id===id);if(!t||!confirm(`共通タグ「${t.label}」をすべてのキャラから削除する？`))return;doc().tags=doc().tags.filter(x=>x.id!==id);doc().characters.forEach(c=>c.tagIds=c.tagIds.filter(x=>x!==id));persist();render()}
function updatePreview(){const c=selected();if(!c)return;const preview=document.querySelector('.mini-preview');if(!preview)return;for(const k of ['accent','deep','soft','bright'])preview.style.setProperty('--preview-'+k,cleanColor(c.colors?.[k]));const img=$('liveImg');if(img)img.src=c.artwork||'';if($('liveName'))$('liveName').textContent=c.name||'';if($('liveRoman'))$('liveRoman').textContent=c.roman||'';if($('liveHook'))$('liveHook').textContent=c.hook||''}
function showCrop(){const c=selected();if(!c)return;const p=cropVals(c,cropMode());const main=$('cropMainImg');if(main){for(const [k,v] of Object.entries({x:p.x+'%',y:p.y+'%',zoom:p.zoom}))main.style.setProperty('--crop-'+k,v)}
 const choose=cropVals(c,'choose'),mobile=cropVals(c,'mobile'),all=cropVals(c,'all');const ims=document.querySelectorAll('.crop-rail-frame .crop-shared,.crop-phone-frame .crop-shared,.crop-gallery-frame .crop-shared');for(const im of ims){const settings=im.closest('.crop-phone-frame')?mobile:im.closest('.crop-gallery-frame')?all:choose;for(const[k,v]of Object.entries({x:settings.x+'%',y:settings.y+'%',zoom:settings.zoom}))im.style.setProperty('--crop-'+k,v)}
 for(const axis of ['x','y']){const val=document.querySelector('[data-crop-axis="'+axis+'"]');if(val)val.value=p[axis];if($('crop'+axis.toUpperCase()+'Label'))$('crop'+axis.toUpperCase()+'Label').textContent=Math.round(p[axis])+'%'}
 if($('cropZoom'))$('cropZoom').value=p.zoom;if($('cropZoomLabel'))$('cropZoomLabel').textContent=Number(p.zoom).toFixed(2)+'×';window.CAST_CROP?.renderAll();}
function resetCrop(){const c=selected();if(!c)return;setCrop(c,{x:50,y:50,zoom:1});showCrop();persist('現在のアイコン枠をリセットしたよ')}
let cropDrag=null;
/* The same focal origin is used by production and editor. At 1x a
   square icon has no pan room, so dragging unlocks a small zoom. */
function cropMetrics(mode,zoom){
 const frame=$('cropCanvas'),photo=mode==='choose'?frame?.querySelector('.v15-rail-inner'):frame;
 const img=$('cropMainImg'),fw=Math.max(1,photo?.clientWidth||frame?.clientWidth||1),fh=Math.max(1,photo?.clientHeight||frame?.clientHeight||1);
 const r=img?.naturalWidth&&img.naturalHeight?img.naturalWidth/img.naturalHeight:1;
 const w=Math.max(fw,fh*r),h=Math.max(fh,fw/r),s=Math.max(1,Number(zoom)||1)*(mode==='choose'?1.15:1);
 return {fh,overflowX:Math.max(0,s*w-fw),overflowY:Math.max(0,s*h-fh)};
}
function startCrop(e){
 const frame=e.target.closest('#cropCanvas');if(!frame||!selected())return;e.preventDefault();
 const c=selected(),mode=cropMode(),p=cropVals(c,mode);setCrop(c,{...p});
 cropDrag={id:e.pointerId,mode,x:e.clientX,y:e.clientY,cx:p.x,cy:p.y,...cropMetrics(mode,p.zoom)};
 frame.setPointerCapture(e.pointerId);frame.classList.add('dragging');
}
function dragCrop(e){
 if(!cropDrag||e.pointerId!==cropDrag.id||!selected())return;
 const c=selected(),d=cropDrag,dx=e.clientX-d.x,dy=e.clientY-d.y;let p=cropVals(c,cropMode());
 if(d.mode==='mobile'&&((Math.abs(dx)>5&&d.overflowX<=1)||(Math.abs(dy)>5&&d.overflowY<=1))){
   const zoom=Math.max(1.3,Number(p.zoom)||1);
   if(zoom>Number(p.zoom)){p={...p,zoom};setCrop(c,p);Object.assign(d,cropMetrics(d.mode,zoom))}
 }
 const y=d.overflowY>1?limit(d.cy-dy*100/d.overflowY,0,100):p.y;
 const shear=d.mode==='choose'?Math.tan(11*Math.PI/180)*d.fh*(y-d.cy)/100:0;
 const x=d.overflowX>1?limit(d.cx-(dx+shear)*100/d.overflowX,0,100):p.x;
 setCrop(c,{...p,x,y});showCrop();
}
function endCrop(e){if(!cropDrag||e.pointerId!==cropDrag.id)return;cropDrag=null;$('cropCanvas')?.classList.remove('dragging');persist('アイコン位置を保存したよ')}
function refreshArtEditor(){const c=selected();if(!c)return;const p=artVals(c),b=badgeVals(c);for(const id of ['artStageImg','liveImg']){const img=$(id);if(img){for(const [k,v] of Object.entries({x:p.x+'%',y:p.y+'%',zoom:p.zoom}))img.style.setProperty('--art-'+k,v)}}for(const k of ['zoom','x','y']){const el=$('art'+k.toUpperCase()+'Label');if(el)el.textContent=k==='zoom'?Number(p[k]).toFixed(2)+'×':Math.round(p[k])+'%'}
 const badge=$('artPreviewBadge');if(badge){badge.style.setProperty('--badge-right',(c.fileBadgePosition?.right??BADGE_DESKTOP_DEFAULT.right)+'%');badge.style.setProperty('--badge-top',(c.fileBadgePosition?.top??BADGE_DESKTOP_DEFAULT.top)+'%');badge.style.setProperty('--badge-mobile-right',(c.fileBadgePositionMobile?.right??8)+'%');badge.style.setProperty('--badge-mobile-top',(c.fileBadgePositionMobile?.top??66)+'%')};for(const k of ['right','top']){const lbl=$('badge'+k[0].toUpperCase()+k.slice(1)+'Label');if(lbl)lbl.textContent=Math.round(b[k])+'%'}window.CAST_VISUAL?.layout()}
let artDrag=null,badgeDrag=null;
function startArt(e){const frame=e.target.closest('#artStage');if(!frame||!selected()||e.target.closest('#artPreviewBadge'))return;e.preventDefault();const p=artVals(selected()),wrap=$('artPreviewWrap'),rect=wrap?.getBoundingClientRect()||frame.getBoundingClientRect();artDrag={id:e.pointerId,x:e.clientX,y:e.clientY,cx:p.x,cy:p.y,w:Math.max(rect.width,1),h:Math.max(rect.height,1)};frame.setPointerCapture(e.pointerId)}
function moveArt(e){if(!artDrag||artDrag.id!==e.pointerId||!selected())return;const c=selected();c.artPosition={...artVals(c),x:limit(artDrag.cx+(e.clientX-artDrag.x)*100/artDrag.w,-65,65),y:limit(artDrag.cy+(e.clientY-artDrag.y)*100/artDrag.h,-65,65)};refreshArtEditor();for(const k of ['x','y']){const el=document.querySelector('[data-art-control="'+k+'"]');if(el)el.value=c.artPosition[k]}}
function endArt(e){if(!artDrag||artDrag.id!==e.pointerId)return;artDrag=null;persist('立ち絵の位置を保存したよ')}
function startBadge(e){const el=e.target.closest('#artPreviewBadge');if(!el||!selected())return;e.preventDefault();e.stopPropagation();const scene=$('artPreviewScene'),rect=scene.getBoundingClientRect(),p=badgeVals(selected());badgeDrag={id:e.pointerId,x:e.clientX,y:e.clientY,right:p.right,top:p.top,w:rect.width,h:rect.height};el.setPointerCapture(e.pointerId)}
function moveBadge(e){if(!badgeDrag||badgeDrag.id!==e.pointerId||!selected())return;const c=selected();c[badgeField()]={...badgeVals(c),right:limit(badgeDrag.right-(e.clientX-badgeDrag.x)*100/badgeDrag.w,0,75),top:limit(badgeDrag.top+(e.clientY-badgeDrag.y)*100/badgeDrag.h,0,75)};refreshArtEditor();for(const k of ['right','top']){const el=document.querySelector('[data-badge-control="'+k+'"]');if(el)el.value=c[badgeField()][k]}}
function endBadge(e){if(!badgeDrag||badgeDrag.id!==e.pointerId)return;badgeDrag=null;persist('FILE番号の位置を保存したよ')}
function updateRelation(action,index){const c=selected();if(!c)return;const list=c.relationships||(c.relationships=[]);if(action==='relation-add'){const available=doc().characters.find(x=>x.id!==c.id&&!list.some(r=>r.targetId===x.id));if(!available){notify('追加できる別キャラがいません');return}list.push({targetId:available.id,type:'',detail:''})}else if(action==='relation-del')list.splice(index,1);else if(action==='relation-up'&&index>0){[list[index-1],list[index]]=[list[index],list[index-1]]}else if(action==='relation-down'&&index<list.length-1){[list[index+1],list[index]]=[list[index],list[index+1]]}persist();render()}
async function exportPublish(){if(!window.CAST_PUBLISH){notify('書き出しツールが読み込めませんでした');return}const chars=[...document.querySelectorAll('[data-pub-char]:checked')].map(x=>x.dataset.pubChar),worlds=[...document.querySelectorAll('[data-pub-world]:checked')].map(x=>x.dataset.pubWorld);const status=$('publishStatus');const button=document.querySelector('[data-action="export-publish"]');if(button)button.disabled=true;if(status)status.textContent='ZIPを作成中…';try{await new Promise(r=>setTimeout(r,35));const result=window.CAST_PUBLISH.pack(doc(),{charIds:chars,worldIds:worlds});const url=URL.createObjectURL(result.blob),a=document.createElement('a');a.href=url;a.download='cast-signal-github-publish.zip';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),20000);if(status)status.textContent=`完成！ キャラ${result.characters}人 / WORLD${result.worlds}件 / 画像${result.images}枚（${Math.round(result.size/1024)}KB）`;notify('公開用ZIPを書き出したよ！')}catch(e){if(status)status.textContent='書き出し失敗：'+e.message;notify('ZIPの作成に失敗しました')}finally{if(button)button.disabled=false}}
function exportData(){const payload=JSON.stringify(doc(),null,2),file=new Blob([payload],{type:'application/json'}),url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download='cast-signal-v57-backup.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);notify('JSONバックアップを書き出したよ')}
async function importData(file){if(!file)return;try{const data=JSON.parse(await file.text());if(!data||data.version!==5||!Array.isArray(data.characters)||!Array.isArray(data.worlds)||!Array.isArray(data.tags))throw Error('format');if(!confirm('このバックアップで現在の下書きを上書きする？'))return;if(!(await api.replaceDraft(data)))throw Error('storage');state.charId=null;state.worldId=null;state.section='dashboard';render();notify('バックアップを読み込んだよ')}catch(e){notify('読み込みに失敗。CAST / SIGNAL v5のJSONか容量を確認してね')}}
function handleAction(el){const a=el.dataset.action,id=el.dataset.id,index=Number(el.dataset.index);if(a==='clear-sound'){const target=soundTarget(el.dataset.soundScope);if(target&&confirm('この楽曲の登録を外しますか？')){target.soundtrack={...(target.soundtrack||{}),src:'',filename:''};persist();render()}return}if(a==='preview-about'){preview();window.location.hash='about';return}if(a==='show-chars'){state.section='characters';state.charId=null;render()}
 else if(a==='crop-mode'){state.cropMode=['choose','mobile','all'].includes(el.dataset.view)?el.dataset.view:'choose';render();}else if(a==='crop-enable-y'){const c=selected();setCrop(c,{...cropVals(c,cropMode()),zoom:Math.max(1.3,cropVals(c,cropMode()).zoom)});showCrop();persist('上下方向の調整幅を増やしたよ')}else if(a==='crop-reset')resetCrop();else if(a==='badge-reset'){selected()[badgeField()]=badgeIsMobile()?{right:8,top:66}:{...BADGE_DESKTOP_DEFAULT};refreshArtEditor();persist()}else if(a==='art-reset'){selected().artPosition={x:0,y:0,zoom:1};persist();render()}else if(a.startsWith('relation-'))updateRelation(a,index);else if(a.startsWith('tag-')){const c=selected();if(!c)return;if(a==='tag-apply'){const input=$('tagQuickInput');if(commitTags(c,input?.value))render();return}const ids=c.tagIds||[];if(a==='tag-left'&&index>0)[ids[index-1],ids[index]]=[ids[index],ids[index-1]];if(a==='tag-right'&&index<ids.length-1)[ids[index+1],ids[index]]=[ids[index],ids[index+1]];if(a==='tag-remove')ids.splice(index,1);persist();render()}else if(a==='show-publish')setSection('publish');else if(a==='export-publish')exportPublish();else if(a==='new-char')newChar();else if(a==='edit-char')openChar(id);else if(a==='edit-prev'||a==='edit-next'){if(id&&doc().characters.some(c=>c.id===id)){state.charId=id;render();document.querySelector('.admin-workspace')?.scrollTo({top:0,behavior:'instant'})}}else if(a==='move-up')moveChar(id,-1);else if(a==='move-down')moveChar(id,1);else if(a==='delete-char')deleteChar(id);
 else if(a==='world-image-view'){if(!world()||!['select','detail','mobile'].includes(el.dataset.view))return;state.worldImageView=el.dataset.view;const studio=document.getElementById('worldImageStudio');if(studio)studio.outerHTML=worldImageStudio(world());}
 else if(a==='world-image-expand'){worldImageToggleExpand();}
 else if(a==='world-image-reset'){const w=world();if(!w||!w.image)return;const mode=worldImageActiveMode();w.worldImageCrop={...(w.worldImageCrop||{}),[mode]:{x:0,y:0,zoom:1}};worldImageSync();worldImageScheduleSave();}
 else if(a==='show-worlds'){state.section='worlds';state.worldId=null;render()}else if(a==='new-world')newWorld();else if(a==='world-up')moveWorld(id,-1);else if(a==='world-down')moveWorld(id,1);else if(a==='edit-world'){state.worldId=id;state.worldImageView='select';render()}else if(a==='delete-world')deleteWorld(id);
 else if(a==='show-tags')setSection('tags');else if(a==='show-about')setSection('about');else if(a==='new-tag')newTag();else if(a==='delete-tag')deleteTag(id);
 else if(a.startsWith('repeat-'))repeat(el.dataset.repeat,a,index);
 else if(a==='clear-image'){const target=state.section==='worlds'?world():selected();target[el.dataset.field]='';persist();render()}
 else if(a==='preview-char')preview(selected()?.id)
 else if(a==='show-backup')setSection('backup');else if(a==='export')exportData();else if(a==='reset'){if(confirm('下書きの変更が失われます。現在の公開用データで下書きを上書きしていいですか？')){api.reset().then(ok=>{if(ok){setSection('dashboard');notify('公開用データに戻しました')}else notify('復元できませんでした。先にバックアップを取ってください')})}}
}
function updateField(el){const c=selected(),w=world();if(el.dataset.soundMeta){const target=soundTarget(el.dataset.soundScope);if(target){target.soundtrack={...(target.soundtrack||{}),[el.dataset.soundMeta]:el.value};persist()}return}if(el.dataset.worldImageAxis&&w){worldImageSetAxis(el.dataset.worldImageAxis,el.value);return}if(el.dataset.badgeControl&&c){c[badgeField()]={...badgeVals(c),[el.dataset.badgeControl]:Number(el.value)};refreshArtEditor();clearTimeout(state.saveTimer);state.saveTimer=setTimeout(()=>persist('FILE番号位置を保存したよ'),230);return}if(el.dataset.cropAxis&&c){const mode=cropMode(),axis=el.dataset.cropAxis;let p=cropVals(c,mode);if(mode==='mobile'&&Number(el.value)!==Number(p[axis])&&cropMetrics(mode,p.zoom)[axis==='x'?'overflowX':'overflowY']<=1)p={...p,zoom:Math.max(1.3,Number(p.zoom)||1)};setCrop(c,{...p,[axis]:Number(el.value)});showCrop();clearTimeout(state.saveTimer);state.saveTimer=setTimeout(()=>persist('アイコン位置を保存したよ'),230);return}if(el.dataset.artControl&&c){const k=el.dataset.artControl;c.artPosition={...artVals(c),[k]:Number(el.value)};refreshArtEditor();clearTimeout(state.saveTimer);state.saveTimer=setTimeout(()=>persist('立ち絵位置を保存したよ'),230);return}if(el.dataset.relationIndex!==undefined&&c){const item=c.relationships?.[Number(el.dataset.relationIndex)];if(item){item[el.dataset.relationField]=el.value;persist()}return}if(el.matches('[data-crop-zoom]')&&c){setCrop(c,{...cropVals(c,cropMode()),zoom:Number(el.value)});showCrop();persist();return}if(el.dataset.siteField){doc().site=doc().site||{...api.initial.site};doc().site[el.dataset.siteField]=el.value;persist();return}
 if(el.dataset.siteDays!==undefined){doc().site=doc().site||{...api.initial.site};doc().site.newDays=Math.max(0,Math.min(90,Number(el.value)||0));persist();return}
 if(el.dataset.bind){const target=state.section==='worlds'?w:c;if(!target)return;target[el.dataset.bind]=el.value;persist();updatePreview();if(w)worldImageUpdateCopy(w);return}
 if(el.dataset.boolean&&c){c[el.dataset.boolean]=el.checked;persist();return}
 if(el.dataset.range&&c){c[el.dataset.range]=Number(el.value);persist();const label=el.previousElementSibling;if(label)label.textContent='アイコンの縦位置 / '+el.value+'%';return}
 if(el.dataset.tagId&&c){const t=el.dataset.tagId;c.tagIds=el.checked?[...new Set([...c.tagIds,t])]:c.tagIds.filter(x=>x!==t);persist();return}
 if(el.dataset.worldId&&c){const id=el.dataset.worldId;c.worldIds=el.checked?[...new Set([...c.worldIds,id])]:c.worldIds.filter(x=>x!==id);persist();return}
 if(el.dataset.assignmentChar&&w){const match=doc().characters.find(x=>x.id===el.dataset.assignmentChar);if(!match)return;match.worldIds=el.checked?[...new Set([...match.worldIds,w.id])]:match.worldIds.filter(x=>x!==w.id);persist();return}
 if(el.dataset.repeat&&el.dataset.field&&(c||w)){const list=el.dataset.repeat==='worldStories'?w?.stories:c?.[el.dataset.repeat];const item=list?.[Number(el.dataset.index)];if(!item)return;item[el.dataset.field]=el.value;persist();return}
 if(el.dataset.tagName){const t=doc().tags.find(x=>x.id===el.dataset.tagName);if(t){t.label=el.value;persist()}return}
 if(el.dataset.color&&c){const k=el.dataset.color;c.colors[k]=el.value;const sibling=document.querySelector(`[data-hex="${k}"]`);if(sibling)sibling.value=el.value;persist();updatePreview();const box=document.querySelector(`[data-preview-color="${k}"]`);if(box)box.style.background=el.value;return}
 if(el.dataset.hex&&c&&/^#[0-9a-f]{6}$/i.test(el.value)){const k=el.dataset.hex;c.colors[k]=el.value;document.querySelector(`[data-color="${k}"]`).value=el.value;persist();updatePreview();const box=document.querySelector(`[data-preview-color="${k}"]`);if(box)box.style.background=el.value;return}
 if(el.dataset.worldColor&&w){w.accent=el.value;const inp=document.querySelector('[data-world-hex]');if(inp)inp.value=w.accent;persist();return}
 if(el.dataset.worldHex&&w&&/^#[0-9a-f]{6}$/i.test(el.value)){w.accent=el.value;document.querySelector('[data-world-color]').value=w.accent;persist()}
}
// Resize uploads for the local browser storage demo. Original files are never modified.
async function compress(file,maxSide=1300){return new Promise((resolve,reject)=>{const img=new Image(),src=URL.createObjectURL(file);img.onload=()=>{try{const r=Math.min(1,maxSide/Math.max(img.naturalWidth,img.naturalHeight)),w=Math.round(img.naturalWidth*r),h=Math.round(img.naturalHeight*r);if(w*h>10000000)throw Error('image-too-large');const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;canvas.getContext('2d').drawImage(img,0,0,w,h);const out=canvas.toDataURL('image/webp',.78);URL.revokeObjectURL(src);resolve(out)}catch(e){URL.revokeObjectURL(src);reject(e)}};img.onerror=()=>{URL.revokeObjectURL(src);reject(Error('image'))};img.src=src})}
async function upload(el){const file=el.files?.[0];if(!file)return;const c=selected(),w=world();const target=state.section==='worlds'?w:c;if(!target)return;const key=el.dataset.image||'image',gidx=el.dataset.galleryImage;
 try{if(file.size>20*1024*1024){notify('20MB以下の画像を選んでね');return}const data=await compress(file,key==='icon'?560:key==='image'?1000:1300);let old;
 if(gidx!==undefined&&c){old=c.gallery[Number(gidx)].image;c.gallery[Number(gidx)].image=data}else{old=target[key];target[key]=data}
 if(!(await api.saveDraft())){if(gidx!==undefined&&c)c.gallery[Number(gidx)].image=old;else target[key]=old;notify('画像の保存に失敗しました。BACKUPから書き出してね');return}render();notify('画像をクラウド下書きに保存したよ（公開までは非公開）')
 }catch(e){notify('画像を読み込めませんでした。PNG/JPG/WebPを試してね')}}
// Admin controls and delegation
$('openAdmin').onclick=enter;$('adminExit').onclick=exit;$('adminPreview').onclick=()=>preview();$('adminPublish').onclick=publish;$('backToAdmin').onclick=enter;
$$('[data-admin-section]').forEach(b=>b.onclick=()=>setSection(b.dataset.adminSection));
$('cloudLogout').addEventListener('click', async()=>{if(confirm('ログアウトしますか？'))await api.signOut()});
$('adminContent').addEventListener('click',e=>{const tab=e.target.closest('[data-char-tab]');if(tab){state.tab=tab.dataset.charTab;render();return}const b=e.target.closest('[data-action]');if(b)handleAction(b)});
$('adminContent').addEventListener('input',e=>{const el=e.target;if(el.matches('[type=file]'))return;updateField(el)});
$('adminContent').addEventListener('change',e=>{const el=e.target;if(el.id==='tagQuickInput'){if(commitTags(selected(),el.value))render();return}if(el.matches('[type=file]')){if(el.id==='backupInput')importData(el.files?.[0]);else if(el.dataset.soundUpload)uploadSound(el);else upload(el)}});
$('adminContent').addEventListener('keydown',e=>{if(e.target?.id==='tagQuickInput'&&e.key==='Enter'){e.preventDefault();if(commitTags(selected(),e.target.value))render()}});$('adminContent').addEventListener('load',e=>{if(e.target?.matches?.('iframe[data-world-image-frame]'))worldImageFrameReady(e.target)},true);
window.addEventListener('resize',()=>{
 const frame=document.querySelector('#worldImageStudio [data-world-image-frame]');
 if(!frame)return;
 const view=state.worldImageView;
 const viewport=view==='mobile'?390:view==='detail'?Math.max(1024,window.innerWidth):Math.max(320,window.innerWidth);
 frame.style.width=viewport+'px';frame.dataset.worldPreviewViewport=String(viewport);
 worldImageFit(frame);
},{passive:true});
$('adminContent').addEventListener('pointerdown',worldImageDragStart);$('adminContent').addEventListener('pointermove',worldImageDragMove);$('adminContent').addEventListener('pointerup',worldImageDragEnd);$('adminContent').addEventListener('pointercancel',worldImageDragEnd);
$('adminContent').addEventListener('pointerdown',startCrop);$('adminContent').addEventListener('pointerdown',startBadge);$('adminContent').addEventListener('pointerdown',startArt);
$('adminContent').addEventListener('pointermove',dragCrop);$('adminContent').addEventListener('pointermove',moveBadge);$('adminContent').addEventListener('pointermove',moveArt);
$('adminContent').addEventListener('pointerup',endCrop);$('adminContent').addEventListener('pointerup',endBadge);$('adminContent').addEventListener('pointerup',endArt);
$('adminContent').addEventListener('pointercancel',endCrop);$('adminContent').addEventListener('pointercancel',endBadge);$('adminContent').addEventListener('pointercancel',endArt);
$('adminContent').addEventListener('dragstart',e=>{const row=e.target.closest('[data-drag-id]');if(!row)return;state.dragId=row.dataset.dragId;row.classList.add('dragging');e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',state.dragId)});
$('adminContent').addEventListener('dragover',e=>{const row=e.target.closest('[data-drag-id]');if(!row||!state.dragId)return;e.preventDefault();row.classList.add('drop-target')});
$('adminContent').addEventListener('dragleave',e=>{const row=e.target.closest('[data-drag-id]');row?.classList.remove('drop-target')});
$('adminContent').addEventListener('drop',e=>{const row=e.target.closest('[data-drag-id]');if(!row||!state.dragId)return;e.preventDefault();const list=doc().characters,old=list.findIndex(c=>c.id===state.dragId),idx=list.findIndex(c=>c.id===row.dataset.dragId);if(old>=0&&idx>=0&&old!==idx){const [m]=list.splice(old,1);list.splice(idx,0,m);persist();render();notify('キャラの順番を入れ替えたよ')}state.dragId=null});
$('adminContent').addEventListener('dragend',()=>{state.dragId=null;$$('.admin-row').forEach(r=>r.classList.remove('dragging','drop-target'))});
document.addEventListener('keydown',e=>{if(document.body.classList.contains('admin-open')&&e.key==='Escape')exit()});
enter();
});
