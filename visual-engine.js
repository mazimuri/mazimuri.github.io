/* CAST / SIGNAL V5.9.5 — responsive icon crop stabilizer.
   The frame itself is the coordinate space.  The image uses the SAME
   focal alignment for object-position and scale transform-origin, so
   alignment remains normalized when the viewport or grid width changes.
   No per-resize pixel writes; the browser resolves size/layout atomically.
*/
(()=>{'use strict';
  function layoutPreview(){
    const outer=document.getElementById('artStage'),scene=document.getElementById('artPreviewScene');
    if(!outer||!scene||!outer.clientWidth)return;
    const real=document.getElementById('hero');
    let w=real?.clientWidth||Math.max(720,innerWidth),h=real?.clientHeight||Math.max(630,innerHeight-245);
    if(w<300){w=Math.max(720,innerWidth);h=Math.max(630,innerHeight-245)}
    const factor=Math.min(1,outer.clientWidth/w);
    scene.style.width=w+'px';scene.style.height=h+'px';scene.style.transform='scale('+factor+')';
    outer.style.height=(h*factor)+'px';
  }
  let queued=false;
  function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;layoutPreview()})}
  function ready(){
    window.addEventListener('resize',schedule,{passive:true});
    if(window.ResizeObserver){const observer=new ResizeObserver(schedule);for(const id of ['hero','artStage','adminContent']){const el=document.getElementById(id);if(el)observer.observe(el)}}
    // Subtree refreshes mainly keep the miniature MAIN VISUAL preview in sync.
    new MutationObserver(schedule).observe(document.body,{subtree:true,childList:true});
    schedule();
  }
  window.CAST_CROP={renderAll:schedule,renderOne:()=>{}};
  window.CAST_VISUAL={layout:layoutPreview};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();
