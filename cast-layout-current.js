/* CAST // SIGNAL — approved desktop layout behavior.
   No preview controls, no content or storage changes. */
(() => {
  "use strict";
  const desktop = window.matchMedia("(min-width:1500px)");
  const roots = ["worldCards","worldDetailContent","directoryItems","allcastRosterShell"].map(id=>document.getElementById(id)).filter(Boolean);
  const panels = ["worldsPanel","worldDetailPanel","directory"].map(id=>document.getElementById(id)).filter(Boolean);
  let raf=0;
  function schedule(){
    if(!raf) raf=requestAnimationFrame(()=>{raf=0;refresh();});
  }
  function updateDeckFade(){
    const shell=document.getElementById("allcastRosterShell");
    const grid=document.querySelector("#directory #directoryItems.directory-gallery");
    if(!shell)return;
    let fade=shell.querySelector(".cast-deck-fade");
    if(!desktop.matches||!grid||!shell.classList.contains("is-gallery")||!grid.clientHeight){
      if(fade)fade.remove();return;
    }
    if(!fade){
      fade=document.createElement("div");
      fade.className="cast-deck-fade";fade.setAttribute("aria-hidden","true");
      shell.append(fade);
    }
    const r=grid.getBoundingClientRect(),s=shell.getBoundingClientRect();
    const h=Math.min(32,Math.round(grid.clientHeight*.1));
    const vals={left:r.left-s.left-shell.clientLeft+grid.clientLeft,
      top:r.top-s.top-shell.clientTop+grid.clientTop+grid.clientHeight-h,
      width:grid.clientWidth,height:h};
    for(const [k,v] of Object.entries(vals))fade.style.setProperty("--cast-fade-"+k,v+"px");
    fade.dataset.more=String(grid.scrollHeight-grid.clientHeight-grid.scrollTop>3);
  }
  function fitWorldTitles(){
    document.querySelectorAll("#worldsPanel .ws5-name").forEach(el=>{
      el.style.removeProperty("--cast-title-size");
      el.removeAttribute("data-cast-wrap");
      if(!desktop.matches||!el.clientWidth)return;
      let size=parseFloat(getComputedStyle(el).fontSize);
      while(el.scrollWidth>el.clientWidth+1&&size>18){
        size=Math.max(18,size-1);
        el.style.setProperty("--cast-title-size",size+"px");
      }
      if(el.scrollWidth>el.clientWidth+1)el.setAttribute("data-cast-wrap","");
    });
  }
  function refreshBriefs(){
    document.querySelectorAll("#worldDetailPanel .wd4-description").forEach(el=>{
      let btn=el.parentElement.querySelector(".cast-brief-toggle");
      if(!desktop.matches){
        el.removeAttribute("data-cast-fold");if(btn)btn.remove();return;
      }
      if(!el.clientWidth)return;
      const line=parseFloat(getComputedStyle(el).lineHeight);
      const long=el.scrollHeight>line*5.5+2;
      if(!long){
        el.removeAttribute("data-cast-fold");if(btn)btn.remove();return;
      }
      if(!el.dataset.castFold)el.dataset.castFold="closed";
      function setLabel(){
        const open=el.dataset.castFold==="open";
        const label=open?"CLOSE BRIEF / 閉じる":"READ MORE / 続きを読む";
        if(btn.textContent!==label)btn.textContent=label;
        btn.setAttribute("aria-expanded",String(open));
      }
      if(!btn){
        btn=document.createElement("button");btn.type="button";btn.className="cast-brief-toggle";
        el.id=el.id||"castWorldBrief";
        btn.setAttribute("aria-controls",el.id);
        el.after(btn);
        btn.addEventListener("click",()=>{
          el.dataset.castFold=el.dataset.castFold==="closed"?"open":"closed";
          setLabel();
        });
      }
      setLabel();
    });
  }
  function refresh(){updateDeckFade();fitWorldTitles();refreshBriefs();}
  document.addEventListener("scroll",e=>{if(e.target.id==="directoryItems")updateDeckFade();},true);
  const observer=new MutationObserver(schedule);
  roots.forEach(el=>observer.observe(el,{childList:true,subtree:true}));
  panels.forEach(el=>observer.observe(el,{attributes:true,attributeFilter:["class","aria-hidden"]}));
  const resizeObserver=new ResizeObserver(schedule);
  roots.forEach(el=>resizeObserver.observe(el));
  window.addEventListener("resize",schedule);
  if(document.fonts)document.fonts.ready.then(schedule);
  schedule();
})();
