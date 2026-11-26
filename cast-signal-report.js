/* SIGNAL REPORT / authenticated, aggregate-only dashboard */
(()=>{
'use strict';
let days=30,rows=null,busy=false,error='',metric='visit',rank='profile',loadedAt='',refreshView=null;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Number(n||0).toLocaleString('ja-JP');
const dayKey=offset=>new Date(Date.now()+9*3600000+offset*86400000).toISOString().slice(0,10);
const labels={visit:'VISITS',page:'PAGE VIEWS',profile:'PROFILE',select:'SELECT',world:'WORLD',sound:'SOUND',sound_auto:'AUTO BGM',sound_30:'30 SEC',sound_complete:'COMPLETE',lyrics:'LYRICS',zeta_char:'ZETA',zeta_world:'ZETA / WORLD',zeta_site:'ZETA / CREATOR'};
const range=(n,off=0)=>Array.from({length:n},(_,i)=>dayKey(-n+1+i-off));
const values=(event,keys)=>{const set=new Set(keys);return (rows||[]).filter(r=>r.event===event&&set.has(r.day))};
const sum=r=>r.reduce((s,x)=>s+Number(x.count||0),0);
const grouping=(event,keys)=>{const m=new Map();for(const r of values(event,keys))m.set(r.target,(m.get(r.target)||0)+Number(r.count));return [...m].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))};
const first=()=>rows?.reduce((min,r)=>!min||r.day<min?r.day:min,'')||'';
const name=(id,type)=>{const d=window.CAST_DATA?.getPublished?.();if(id==='main'&&type==='sound')return d?.site?.soundtrack?.title||'MAIN THEME';const c=d?.characters?.find(x=>x.id===id);if(type==='sound')return c?.soundtrack?.title||c?.name||id;return type==='world'?d?.worlds?.find(w=>w.id===id)?.title||id:c?.name||id};
const art=(id,type)=>{const d=window.CAST_DATA?.getPublished?.();const c=d?.characters?.find(x=>x.id===id);const s=type==='sound'?(id==='main'?d?.site?.soundtrack?.jacket:c?.soundtrack?.jacket||c?.icon):c?.icon||c?.artwork;return typeof s==='string'&&/^(https:\/\/|assets\/)/.test(s)?'<img src="'+esc(s)+'" loading="lazy" decoding="async" alt="">':''};
const button=(id,text,active=false)=>'<button type="button" data-sr="'+id+'" class="'+(active?'active':'')+'">'+esc(text)+'</button>';
function chart(keys,previous){
 const map=ks=>ks.map(day=>({day,v:sum(values(metric,[day])),known:!!first()&&day>=first()}));
 const a=map(keys),b=map(previous),max=Math.max(1,...a.map(x=>x.v),...b.map(x=>x.v));const w=800,h=204,left=46,right=785,top=15,bottom=169;
 const x=i=>left+(right-left)*i/Math.max(1,a.length-1),y=v=>bottom-(bottom-top)*v/max;
 const line=data=>{let started=false;return data.map((d,i)=>{if(!d.known){started=false;return ''}const s=(started?'L':'M')+x(i).toFixed(1)+' '+y(d.v).toFixed(1);started=true;return s}).join(' ')};
 let grid='';for(let i=0;i<=4;i++){const v=max*i/4;grid+='<line x1="'+left+'" y1="'+y(v)+'" x2="'+right+'" y2="'+y(v)+'" stroke="#394247"/><text x="38" y="'+(y(v)+4)+'" text-anchor="end" fill="#9caaae" font-size="10">'+fmt(Math.round(v))+'</text>'}
 const labelsAt=[0,Math.floor((a.length-1)/2),a.length-1];
 return '<svg viewBox="0 0 '+w+' '+h+'" role="img" aria-label="選択期間と前期間の日別集計グラフ">'+grid+'<path d="'+line(b)+'" stroke="#8ea9c9" stroke-width="2" stroke-dasharray="5 5" fill="none"/><path d="'+line(a)+'" stroke="#eaff55" stroke-width="3" fill="none"/>'+a.map((d,i)=>d.known?'<circle cx="'+x(i)+'" cy="'+y(d.v)+'" r="3" fill="#eaff55"><title>'+esc(d.day)+'：'+fmt(d.v)+'</title></circle>':'').join('')+labelsAt.map(i=>'<text x="'+x(i)+'" y="192" text-anchor="'+(i===0?'start':i===a.length-1?'end':'middle')+'" fill="#9caaae" font-size="11">'+a[i].day.slice(5).replace('-','/')+'</text>').join('')+'</svg>';
}
function ranking(event,keys,type){
 const items=grouping(event,keys),max=items[0]?.[1]||1;
 return items.length?items.map(([id,n],i)=>'<div class="sr-rank"><span class="sr-pos">'+String(i+1).padStart(2,'0')+'</span>'+(type==='cast'||type==='sound'?'<span class="sr-avatar">'+art(id,type)+'</span>':'')+'<div class="sr-rankbody"><strong>'+esc(name(id,type))+'</strong><div class="sr-track"><i style="width:'+(n/max*100).toFixed(2)+'%"></i></div></div><b>'+fmt(n)+'</b></div>').join(''):'<div class="sr-empty">この期間の計測データはまだありません。</div>';
}
function distribution(event,keys,names){
 const items=grouping(event,keys),total=items.reduce((s,x)=>s+x[1],0);
 return items.length?items.map(([id,n])=>'<div class="sr-dist"><span>'+esc(names[id]||id)+'</span><div class="sr-track"><i style="width:'+(n/total*100).toFixed(2)+'%"></i></div><b>'+fmt(n)+' / '+(n/total*100).toFixed(1)+'%</b></div>').join(''):'<div class="sr-empty">計測データなし</div>';
}
function render(){
 const keys=range(days),prev=range(days,days),f=first(),valid=rows!==null,complete=!!f&&f<=prev[0],cnt=e=>sum(values(e,keys)),old=e=>sum(values(e,prev));
 const totalZ=cnt('zeta_char')+cnt('zeta_world')+cnt('zeta_site'),oldZ=old('zeta_char')+old('zeta_world')+old('zeta_site');
 const tile=(t,n,o,sub)=>'<div class="sr-metric"><small>'+t+'</small><strong>'+(valid?fmt(n):'—')+'</strong><span>'+sub+'</span><em>'+(complete&&o>0?((n-o)/o*100>=0?'+':'')+((n-o)/o*100).toFixed(1)+'% / 前期間比':complete?'前期間比 —':'比較期間の蓄積待ち')+'</em></div>';
 const box=(title,subtitle,body)=>'<section class="sr-box"><h3>'+title+'</h3><p>'+subtitle+'</p>'+body+'</section>';
 return '<div id="sr-root"><header class="sr-head"><div><div class="sr-kicker">08 / AUDIENCE INTELLIGENCE</div><h2>SIGNAL REPORT.</h2><p>作品との出会いと、訪問者の行動を日別に集計。</p></div><div class="sr-controls">'+[7,30,90].map(n=>button('days:'+n,n+' DAYS',days===n)).join('')+button('reload',busy?'LOADING…':'↻ REFRESH')+'</div></header>'+
 (error?'<div class="sr-notice" role="alert">'+esc(error)+'</div>':'')+
 '<div class="sr-info">'+(busy?'集計データを取得中…':valid?(f?'最初の計測日 '+f:'まだ計測データはありません。'):'REFRESH で実データを取得します。')+'　｜　'+keys[0]+' – '+keys[keys.length-1]+' JST（本日は途中集計）'+(loadedAt?'　｜　更新 '+esc(loadedAt):'')+'</div>'+
 '<div class="sr-metrics">'+tile('VISITS',cnt('visit'),old('visit'),'訪問セッション')+tile('PROFILE',cnt('profile'),old('profile'),'キャラ詳細閲覧')+tile('SOUND',cnt('sound'),old('sound'),'手動楽曲再生')+tile('ZETA',totalZ,oldZ,'zetaリンククリック')+'</div>'+
 box('TRAFFIC SIGNAL.','日別の推移 / 前期間との比較（計測開始前は線を表示しません）','<div class="sr-controls">'+['visit','page','profile','sound','lyrics'].map(e=>button('metric:'+e,labels[e],metric===e)).join('')+'</div>'+chart(keys,prev)+'<div class="sr-legend"><span>━ 選択期間</span><span>┄ 前期間</span></div>')+
 '<div class="sr-columns">'+box('CAST RANKING.','キャラクター別 / 初期表示はSELECTに含めません','<div class="sr-controls">'+['profile','select','zeta_char'].map(e=>button('rank:'+e,labels[e],rank===e)).join('')+'</div>'+ranking(rank,keys,'cast'))+
 box('SOUND REPORT.','手動再生 / 30秒到達 / 完了 / 歌詞','<div class="sr-soundstats">'+['sound','sound_30','sound_complete','lyrics','sound_auto'].map(e=>'<div><small>'+labels[e]+'</small><b>'+fmt(cnt(e))+'</b></div>').join('')+'</div>'+ranking('sound',keys,'sound')+'<details><summary>曲別の30秒・完了・歌詞</summary><div class="sr-soundtable">'+[...new Set(['sound','sound_30','sound_complete','lyrics'].flatMap(e=>grouping(e,keys).map(x=>x[0])))].map(id=>'<div><strong>'+esc(name(id,'sound'))+'</strong><span>30秒 '+fmt(grouping('sound_30',keys).find(x=>x[0]===id)?.[1])+' / 完了 '+fmt(grouping('sound_complete',keys).find(x=>x[0]===id)?.[1])+' / 歌詞 '+fmt(grouping('lyrics',keys).find(x=>x[0]===id)?.[1])+'</span></div>').join('')+'</div></details>')+'</div>'+
 '<div class="sr-columns">'+box('WORLD SIGNAL.','世界観別の詳細閲覧',ranking('world',keys,'world'))+box('DISCOVERY ROUTES.','訪問開始時の流入元（不明はDIRECTに含む）',distribution('referrer',keys,{direct:'DIRECT / 不明',x:'X / Twitter',zeta:'ZETA',search:'検索',other:'その他',internal:'サイト内'}))+'</div>'+
 '<div class="sr-columns">'+box('VIEW ENVIRONMENT.','訪問開始時の画面幅（機種の特定ではない）',distribution('device',keys,{mobile:'MOBILE',tablet:'TABLET WIDTH',desktop:'DESKTOP'}))+box('PAGE SIGNAL.','セクション別の閲覧数',distribution('page',keys,{select:'SELECT',index:'ALL CAST',profile:'PROFILE',worlds:'WORLDS',world:'WORLD DETAIL',about:'ABOUT'}))+'</div>'+
 '<div class="sr-info">管理画面ログイン済みのこのブラウザは計測除外。別端末ではABOUTから除外できます。訪問はタブ単位の30分無操作区切り。再生完了は手動再生で実際の再生時間が曲の90%以上かつ終端到達した場合。10秒以内の同一イベントは抑制。広告ブロック・通信失敗・ボット等により誤差があります。zetaのトーク開始数は計測対象外。</div></div>';
}
async function load(){
 if(busy)return;busy=true;error='';refreshView?.();
 try{rows=await window.CAST_DATA.getSignalReport();loadedAt=new Date().toLocaleTimeString('ja-JP',{timeZone:'Asia/Tokyo'})}catch(e){error='集計を取得できません：'+(e.message||String(e))+'。signal-report-setup.sql の実行状況を確認してください。'}finally{busy=false;refreshView?.()}
}
function bind(refresh){
 refreshView=refresh;const root=document.getElementById('sr-root');if(!root)return;
 root.onclick=e=>{const a=e.target.closest('[data-sr]')?.dataset.sr;if(!a)return;if(a==='reload'){load();return}const [k,v]=a.split(':');if(k==='days')days=Number(v);else if(k==='rank')rank=v;else if(k==='metric')metric=v;refreshView?.()};
}
window.CAST_SIGNAL_REPORT={render,bind,load};
})();
