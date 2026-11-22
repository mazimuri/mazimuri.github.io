/* CAST // SIGNAL · Side Rail Study 06: continuous 20+-character perspective carousel.
   The previous selected character never visibly wraps around the back of the stack. */
(()=>{
 const source=document.getElementById('pickerStrip'), stack=document.getElementById('v5Stack'),rail=document.getElementById('v5Rail');
 const count=document.getElementById('v5Count'),batchPrev=document.getElementById('v5BatchPrev'),batchNext=document.getElementById('v5BatchNext'),total=document.getElementById('v6Total'),paperNum=document.getElementById('v6PaperNumber');
 if(!source||!stack||!rail)return;
 const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const mod=(x,n)=>(x%n+n)%n;
 const buttons=()=>Array.from(source.querySelectorAll('[data-person]'));
 const desktop=()=>matchMedia('(min-width:801px)').matches;
 const reduced=()=>matchMedia('(prefers-reduced-motion:reduce)').matches||document.body.classList.contains('no-motion');
 const selectedIx=()=>buttons().findIndex(b=>b.getAttribute('aria-selected')==='true');
 const read=(b)=>({id:b.dataset.person,name:b.querySelector('.person-data strong')?.textContent.trim()||'UNKNOWN',
  src:b.querySelector('img')?.getAttribute('src')||'',imageStyle:b.querySelector('img')?.getAttribute('style')||'',
  zeta:!!b.querySelector('.zeta-badge'),recent:!!b.querySelector('.cast-new'),number:((b.querySelector('.person-no')?.textContent||'').split('NO.')[1]||'--').trim().split(' ')[0]});
 let currentId=null,nextDirection=0,nextMotion='step',previous=null,framePending=false,busyUntil=0,gestureTime=0,touchY=null;
 function snapshot(){return Array.from(stack.querySelectorAll('.v5-item:not(.v6-rail-ghost)')).map(el=>({
  id:el.dataset.person,slot:+el.dataset.slot,rect:el.getBoundingClientRect(),node:el.cloneNode(true)}));}
 /* Status data comes from real picker entries, never from fixture data. */
 function statusHtml(p){
  if(!p.zeta&&!p.recent)return '';
  const zeta=p.zeta?'<span class="v5-status-chip is-zeta" title="zetaで遊べる"><span class="long">zeta</span><span class="short">Z</span></span>':'';
  const recent=p.recent?'<span class="v5-status-chip is-new" title="新着キャラ"><span class="long">NEW</span><span class="short">N</span></span>':'';
  return '<span class="v5-status" aria-hidden="true">'+zeta+recent+'</span>';
 }
 function itemHtml(b,slot){
  const p=read(b),active=slot===3;
  const statusCount=Number(p.zeta)+Number(p.recent);
  const statusName=[p.zeta?'zetaで遊べる':'',p.recent?'NEWキャラ':''].filter(Boolean).join('・');
  return `<div class="v5-item" data-slot="${slot}" data-person="${esc(p.id)}" data-status-count="${statusCount}">
    <button type="button" class="v5-card" data-v5-target="${esc(p.id)}" role="tab" aria-selected="${active}" aria-label="${esc(p.name)}を選択${statusName?'・'+statusName:''}">
     <span class="v5-card-outer"><span class="v5-card-inner"><img src="${esc(p.src)}" alt="" style="${esc(p.imageStyle)}"></span><span class="v5-card-name">${esc(p.name)}</span>${statusHtml(p)}</span>
    </button>${active?'<button type="button" class="v5-allcast" aria-label="全キャラ一覧を見る"><span class="v155-grid" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="v155-action-text"><strong>ALL CAST</strong><small>全キャラを見る</small></span><span class="v155-action-arrow" aria-hidden="true">↗</span></button>':''}</div>`;
 }
 function render(){
  framePending=false;
  const b=buttons(),n=b.length;
  if(!n){stack.innerHTML='';return;}
  const ix=Math.max(0,selectedIx()),chosen=b[ix].dataset.person,stage=stack.getBoundingClientRect();
  const changes=nextDirection,motion=nextMotion;nextDirection=0;nextMotion='step';
  const old=previous||snapshot();previous=null;
  const oldId=currentId;
  currentId=chosen;
  count.textContent=`${String(ix+1).padStart(2,'0')} / ${String(n).padStart(2,'0')}`;
  if(total)total.textContent=String(n).padStart(2,'0');
  if(paperNum)paperNum.textContent=String(n).padStart(2,'0');
  batchPrev.disabled=n<2;batchNext.disabled=n<2;
  batchPrev.title=n>4?'前のキャラクターへ（Shift＋クリックで4人前）':'前のキャラクターへ';batchNext.title=n>4?'次のキャラクターへ（Shift＋クリックで4人先）':'次のキャラクターへ';
  const batchLabel=rail.querySelector('.v5-batch-label');if(batchLabel)batchLabel.textContent='STEP ±01';
  batchPrev.setAttribute('aria-label',batchPrev.title);batchNext.setAttribute('aria-label',batchNext.title);
  const offsets=[3,2,1,0];
  stack.innerHTML=offsets.map((off,slot)=>itemHtml(b[mod(ix+off,n)],slot)).join('');
  const animate=desktop()&&!reduced()&&oldId!==null&&chosen!==oldId&&Math.abs(changes)===1;
  if(!animate)return;
  // A direct card click or four-person jump makes ONE physical transition.
  // Only step input (wheel/arrows) tours the intermediate characters.
  if(motion==='direct'||motion==='jump'){
   const visibleIds=new Set(Array.from(stack.querySelectorAll('.v5-item:not(.v6-rail-ghost)')).map(el=>el.dataset.person));
   for(const el of stack.querySelectorAll('.v5-item:not(.v6-rail-ghost)')){
    const origin=old.find(p=>p.id===el.dataset.person),after=el.getBoundingClientRect(),slot=+el.dataset.slot;
    if(origin){
     const dx=origin.rect.left-after.left,dy=origin.rect.top-after.top;
     const sx=origin.rect.width/after.width,sy=origin.rect.height/after.height;
     el.animate([{transform:`translate(${dx}px,${dy}px) scale(${sx},${sy})`,opacity:.78},
                 {transform:'translate(0,0) scale(1)',opacity:1}],
                {duration:370,easing:'cubic-bezier(.18,.8,.24,1)'});
    }else{
     el.animate([{transform:`translateY(${changes>0?'-26px':'26px'}) scale(.95)`,opacity:0},
                 {transform:'translateY(0) scale(1)',opacity:1}],
                {duration:380,delay:slot*18,easing:'cubic-bezier(.2,.8,.25,1)'});
    }
   }
   // A departing selected portrait fades instead of traversing multiple unseen faces.
   const leaving=old.find(p=>p.slot===3&&!visibleIds.has(p.id));
   if(leaving){
    const ghost=leaving.node,rect=leaving.rect;
    ghost.classList.add('v6-rail-ghost');
    ghost.setAttribute('aria-hidden','true');
    ghost.style.cssText=`position:absolute!important;top:${rect.top-stage.top}px!important;left:${rect.left-stage.left}px!important;right:auto!important;width:${rect.width}px!important;height:${rect.height}px!important;z-index:10!important;pointer-events:none!important;`;
    ghost.querySelectorAll('button').forEach(el=>el.tabIndex=-1);
    stack.appendChild(ghost);
    const a=ghost.animate([{opacity:.5},{opacity:0,transform:'translateY(24px)'}],{duration:225,fill:'forwards'});
    a.onfinish=()=>ghost.remove();
   }
   return;
  }
  const outgoing=changes>0?3:0, incoming=changes>0?0:3;
  // Preserve the outgoing card as an independent ghost. When there are exactly four
  // people, its repeated virtual copy at the opposite end is a NEW incoming card.
  const former=old.find(p=>p.slot===outgoing);
  if(former){
   const ghost=former.node;
   ghost.classList.remove('v5-enter');ghost.classList.add('v6-rail-ghost');
   ghost.setAttribute('aria-hidden','true');
   const rect=former.rect;
   ghost.style.cssText=`position:absolute!important;top:${rect.top-stage.top}px!important;left:${rect.left-stage.left}px!important;right:auto!important;width:${rect.width}px!important;height:${rect.height}px!important;z-index:32!important;pointer-events:none!important;`;
   ghost.querySelectorAll('button').forEach(el=>el.tabIndex=-1);
   stack.appendChild(ghost);
   const drift=changes>0?Math.max(85,stage.height*.16):-Math.max(85,stage.height*.16);
   const animation=ghost.animate([{transform:'translateY(0) scale(1)',opacity:1},{transform:`translateY(${drift}px) scale(${changes>0?1.15:.83})`,opacity:0}],{duration:425,easing:'cubic-bezier(.26,.48,.28,1)',fill:'forwards'});
   animation.onfinish=()=>ghost.remove();
  }
  for(const el of stack.querySelectorAll('.v5-item:not(.v6-rail-ghost)')){
   const slot=+el.dataset.slot,after=el.getBoundingClientRect();
   if(slot===incoming){
    el.animate([{transform:`translateY(${changes>0?-Math.max(after.height,65):Math.max(after.height,65)}px) scale(${changes>0?.84:1.12})`,opacity:0},{transform:'translateY(0) scale(1)',opacity:1}],{duration:415,easing:'cubic-bezier(.21,.79,.25,1)'});
    continue;
   }
   const originSlot=slot+(changes>0?-1:1);
   const from=old.find(p=>p.slot===originSlot);
   if(!from)continue;
   const dx=from.rect.left-after.left,dy=from.rect.top-after.top,sx=from.rect.width/after.width,sy=from.rect.height/after.height;
   el.animate([{transform:`translate(${dx}px,${dy}px) scale(${sx},${sy})`,opacity:Math.abs(sx-1)>.09?.75:1},{transform:'translate(0,0) scale(1)',opacity:1}],{duration:435,easing:'cubic-bezier(.18,.8,.24,1)'});
  }
 }
 function schedule(){if(framePending)return;framePending=true;requestAnimationFrame(render);}
 function activate(i,step,motion='step'){
  const b=buttons(),n=b.length;if(n<2)return false;
  const from=Math.max(0,selectedIx()),target=b[mod(i,n)];
  if(!target||target===b[from])return false;
  previous=snapshot();nextDirection=step;nextMotion=motion;
  target.click();schedule();return true;
 }
 function move(step){
  if(!desktop()||Date.now()<busyUntil)return false;
  const n=buttons().length;if(n<2)return false;
  busyUntil=Date.now()+330;return activate(Math.max(0,selectedIx())+step,step,'step');
 }
 function jumpGroup(direction,forceJump=false){
  const n=buttons().length;if(n<2||!desktop())return false;
  const amount=forceJump&&n>4?4:1;
  return activate(Math.max(0,selectedIx())+direction*amount,direction,amount===1?'step':'jump');
 }
 function chooseCard(id){
  const b=buttons(),n=b.length,ix=Math.max(0,selectedIx());
  const target=b.findIndex(x=>x.dataset.person===id);
  if(target<0||target===ix)return;
  const forward=mod(target-ix,n),back=mod(ix-target,n);
  const direction=forward<=back?1:-1,distance=Math.min(forward,back);
  // Pick any visible portrait immediately; do not play 2-3 unwanted selections.
  activate(target,direction,distance===1?'step':'direct');
 }
 stack.addEventListener('click',e=>{
  if(e.target.closest('.v5-allcast')){document.getElementById('openIndex')?.click();return;}
  const card=e.target.closest('[data-v5-target]');if(card)chooseCard(card.dataset.v5Target);
 });
 // A second click on the already-selected portrait opens its profile.
 // Clicking any other portrait still just selects it, as before.
 stack.addEventListener('dblclick',e=>{
  const card=e.target.closest('[data-v5-target]');
  if(card?.getAttribute('aria-selected')==='true'&&card.dataset.v5Target===buttons()[selectedIx()]?.dataset.person){
   document.getElementById('openDetail')?.click();
  }
 });
 batchPrev.addEventListener('click',e=>jumpGroup(-1,e.shiftKey));
 batchNext.addEventListener('click',e=>jumpGroup(1,e.shiftKey));
 rail.addEventListener('wheel',e=>{if(!desktop())return;
  e.preventDefault();const now=Date.now();if(now-gestureTime<360)return;gestureTime=now;
  move(e.deltaY>=0?1:-1);
 },{passive:false});
 rail.addEventListener('touchstart',e=>{touchY=e.touches[0]?.clientY??null},{passive:true});
 rail.addEventListener('touchend',e=>{if(touchY===null)return;
  const dy=(e.changedTouches[0]?.clientY??touchY)-touchY;touchY=null;
  if(Math.abs(dy)>35)move(dy<0?1:-1);
 },{passive:true});
 // The page-level ↑↓ handler also handles keyboard focus inside the rail.
 // Avoid two competing key handlers or accidental double movements.
 window.CAST_SIDE_RAIL={step:(direction,{jump=false}={})=>jump?jumpGroup(direction,true):move(direction)};
 new MutationObserver(schedule).observe(source,{childList:true});
 window.addEventListener('resize',()=>{nextDirection=0;previous=null;schedule()},{passive:true});
 schedule();
})();
