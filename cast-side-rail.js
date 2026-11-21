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
  zeta:!!b.querySelector('.zeta-badge'),recent:!!b.querySelector('.cast-new')});
 let currentId=null,nextDirection=0,previous=null,framePending=false,busyUntil=0,gestureTime=0,touchY=null,queuedSteps=0,queueTimer=null;
 function snapshot(){return Array.from(stack.querySelectorAll('.v5-item:not(.v6-rail-ghost)')).map(el=>({
  id:el.dataset.person,slot:+el.dataset.slot,rect:el.getBoundingClientRect(),node:el.cloneNode(true)}));}
 function itemHtml(b,slot){const p=read(b),active=slot===3;
  return `<div class="v5-item" data-slot="${slot}" data-person="${esc(p.id)}">
    <button type="button" class="v5-card" data-v5-target="${esc(p.id)}" role="tab" aria-selected="${active}" aria-label="${esc(p.name)}を選択">
     <span class="v5-card-outer"><span class="v5-card-inner"><img src="${esc(p.src)}" alt="" style="${esc(p.imageStyle)}"></span><span class="v5-card-name">${esc(p.name)}</span></span>
     ${(p.zeta||p.recent)?`<span class="v5-badges">${p.zeta?'<b>zeta</b>':''}${p.recent?'<b class="is-new">NEW</b>':''}</span>`:''}
    </button>${active?'<button type="button" class="v5-allcast" aria-label="全キャラ一覧を見る"><span class="v155-grid" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="v155-action-text"><strong>ALL CAST</strong><small>全キャラを見る</small></span><span class="v155-action-arrow" aria-hidden="true">↗</span></button>':''}</div>`;
 }
 function render(){
  framePending=false;
  const b=buttons(),n=b.length;
  if(!n){stack.innerHTML='';return;}
  const ix=Math.max(0,selectedIx()),chosen=b[ix].dataset.person,stage=stack.getBoundingClientRect();
  const changes=nextDirection;nextDirection=0;
  const old=previous||snapshot();previous=null;
  const oldId=currentId;
  currentId=chosen;
  count.textContent=`${String(ix+1).padStart(2,'0')} / ${String(n).padStart(2,'0')}`;
  if(total)total.textContent=String(n).padStart(2,'0');
  if(paperNum)paperNum.textContent=String(n).padStart(2,'0');
  batchPrev.disabled=n<2;batchNext.disabled=n<2;
  batchPrev.title=n<=4?'前のキャラクターへ':'4人前へ';batchNext.title=n<=4?'次のキャラクターへ':'4人先へ';
  const batchLabel=rail.querySelector('.v5-batch-label');if(batchLabel)batchLabel.textContent=n<=4?'SELECT ±01':'JUMP ±04';
  batchPrev.setAttribute('aria-label',batchPrev.title);batchNext.setAttribute('aria-label',batchNext.title);
  const offsets=[3,2,1,0];
  stack.innerHTML=offsets.map((off,slot)=>itemHtml(b[mod(ix+off,n)],slot)).join('');
  const animate=desktop()&&!reduced()&&oldId!==null&&chosen!==oldId&&Math.abs(changes)===1;
  if(!animate)return;
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
 function activate(i,step){
  const b=buttons(),n=b.length;if(n<2)return false;
  const from=Math.max(0,selectedIx()),target=b[mod(i,n)];if(!target||target===b[from])return false;
  previous=snapshot();nextDirection=step;
  target.click();schedule();return true;
 }
 function move(step){
  if(!desktop()||Date.now()<busyUntil)return false;
  const n=buttons().length;if(n<2)return false;
  busyUntil=Date.now()+330;return activate(Math.max(0,selectedIx())+step,step);
 }
 // Click any candidate: advance through intermediate virtual slots if needed;
 // rapidly repeated input is bounded so an accidental wheel gesture won't skip 20 faces.
 function chooseCard(id){
  const b=buttons(),n=b.length,ix=Math.max(0,selectedIx()),target=b.findIndex(x=>x.dataset.person===id);
  if(target<0||target===ix)return;
  const forward=mod(target-ix,n),back=mod(ix-target,n);
  const step=forward<=back?1:-1,remaining=Math.min(forward,back);
  if(queueTimer)clearTimeout(queueTimer);queuedSteps=remaining;
  const advance=()=>{if(queuedSteps<=0){queueTimer=null;return;}
   if(Date.now()<busyUntil){queueTimer=setTimeout(advance,60);return;}
   if(move(step))queuedSteps--;
   queueTimer=queuedSteps>0?setTimeout(advance,390):null;};
  advance();
 }
 stack.addEventListener('click',e=>{
  if(e.target.closest('.v5-allcast')){document.getElementById('openIndex')?.click();return;}
  const card=e.target.closest('[data-v5-target]');if(card)chooseCard(card.dataset.v5Target);
 });
 function jumpGroup(direction){
  const n=buttons().length;if(n<2||Date.now()<busyUntil)return;
  if(queueTimer){clearTimeout(queueTimer);queueTimer=null;queuedSteps=0;}
  busyUntil=Date.now()+410;
  const amount=n<=4?1:4;
  activate(Math.max(0,selectedIx())+direction*amount,0);
 }
 batchPrev.addEventListener('click',()=>jumpGroup(-1));
 batchNext.addEventListener('click',()=>jumpGroup(1));
 rail.addEventListener('wheel',e=>{if(!desktop())return;
  e.preventDefault();const now=Date.now();if(now-gestureTime<360)return;gestureTime=now;
  if(queueTimer){clearTimeout(queueTimer);queueTimer=null;queuedSteps=0;}
  move(e.deltaY>=0?1:-1);
 },{passive:false});
 rail.addEventListener('touchstart',e=>{touchY=e.touches[0]?.clientY??null},{passive:true});
 rail.addEventListener('touchend',e=>{if(touchY===null)return;
  const dy=(e.changedTouches[0]?.clientY??touchY)-touchY;touchY=null;
  if(Math.abs(dy)>35)move(dy<0?1:-1);
 },{passive:true});
 rail.addEventListener('keydown',e=>{if(e.key==='ArrowUp'||e.key==='ArrowDown'){
  e.preventDefault();move(e.key==='ArrowUp'?-1:1);
 }});
 new MutationObserver(schedule).observe(source,{childList:true});
 window.addEventListener('resize',()=>{nextDirection=0;previous=null;schedule()},{passive:true});
 schedule();
})();
