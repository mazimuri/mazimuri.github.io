/* CAST // SIGNAL / EDIT MAIN VISUAL PARITY
   The public SELECT hero is the source of truth for artwork and FILE badge
   geometry. The editor mirrors its untransformed layout into a scaled scene,
   without changing production CSS or saved character offsets. */
(()=>{'use strict';
  const px=n=>n+'px';
  const themeNames=['theme-orphe','theme-rov','theme-unnamed','theme-generic'];
  function layoutPreview(){
    const outer=document.getElementById('artStage'),scene=document.getElementById('artPreviewScene');
    if(!outer||!scene||!outer.clientWidth)return;
    const real=document.getElementById('hero');
    const w=real?.clientWidth||Math.max(720,innerWidth);
    const h=real?.clientHeight||Math.max(630,innerHeight-245);
    const width=w>=300?w:Math.max(720,innerWidth);
    const height=w>=300?h:Math.max(630,innerHeight-245);
    const factor=Math.min(1,outer.clientWidth/width);
    scene.style.width=px(width);
    scene.style.height=px(height);
    scene.style.transform='scale('+factor+')';
    outer.style.height=px(height*factor);

    const liveArt=real?.querySelector('.hero-art-wrap');
    const liveImg=real?.querySelector('.hero-art');
    const liveBadge=real?.querySelector('.hero-art-stamp');
    const previewArt=scene.querySelector('.hero-art-wrap');
    const previewImg=scene.querySelector('.hero-art');
    const previewBadge=scene.querySelector('.hero-art-stamp');
    if(!real||!liveArt||!liveImg||!previewArt||!previewImg||!liveBadge||!previewBadge)return;

    // Compute the selected draft character's theme geometry without permanently
    // changing the published character shown behind the private EDIT overlay.
    const originalThemes=themeNames.filter(name=>real.classList.contains(name));
    const desiredTheme=themeNames.find(name=>scene.classList.contains(name))||'theme-generic';
    const wasDetail=document.body.classList.contains('detail-open');
    const wasEntering=real.classList.contains('is-entering');
    const previousBadgeCss=liveBadge.style.cssText;
    const previousParX=real.style.getPropertyValue('--par-x'),previousParY=real.style.getPropertyValue('--par-y');
    try{
      real.classList.remove(...originalThemes);
      real.classList.add(desiredTheme);
      document.body.classList.remove('detail-open');
      real.classList.remove('is-entering');
      real.style.setProperty('--par-x','0px');
      real.style.setProperty('--par-y','0px');
      for(const prop of ['--badge-right','--badge-top','--badge-mobile-right','--badge-mobile-top']){
        const value=previewBadge.style.getPropertyValue(prop);
        if(value)liveBadge.style.setProperty(prop,value);
      }
      const artStyle=getComputedStyle(liveArt),imgStyle=getComputedStyle(liveImg);
      scene.style.setProperty('--vstudio-art-left',px(liveArt.offsetLeft));
      scene.style.setProperty('--vstudio-art-top',px(liveArt.offsetTop));
      scene.style.setProperty('--vstudio-art-width',px(liveArt.offsetWidth));
      scene.style.setProperty('--vstudio-art-height',px(liveArt.offsetHeight));
      scene.style.setProperty('--vstudio-art-transform',artStyle.transform);
      previewImg.style.setProperty('--vstudio-art-origin',imgStyle.transformOrigin);
      previewImg.style.setProperty('--vstudio-art-fit',imgStyle.objectFit);
      previewImg.style.setProperty('--vstudio-art-position',imgStyle.objectPosition);
      if(getComputedStyle(liveBadge).display!=='none'){
        scene.style.setProperty('--vstudio-badge-left',px(liveBadge.offsetLeft));
        scene.style.setProperty('--vstudio-badge-top',px(liveBadge.offsetTop));
        scene.style.setProperty('--vstudio-badge-width',px(liveBadge.offsetWidth));
        scene.style.setProperty('--vstudio-badge-height',px(liveBadge.offsetHeight));
      }
    }finally{
      real.classList.remove(...themeNames);
      real.classList.add(...originalThemes);
      if(wasDetail)document.body.classList.add('detail-open');
      if(wasEntering)real.classList.add('is-entering');
      if(previousParX)real.style.setProperty('--par-x',previousParX);
      else real.style.removeProperty('--par-x');
      if(previousParY)real.style.setProperty('--par-y',previousParY);
      else real.style.removeProperty('--par-y');
      liveBadge.style.cssText=previousBadgeCss;
    }
  }
  let queued=false;
  function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;layoutPreview()})}
  function ready(){
    window.addEventListener('resize',schedule,{passive:true});
    if(window.ResizeObserver){
      const observer=new ResizeObserver(schedule);
      for(const id of ['hero','artStage','adminContent']){
        const el=document.getElementById(id);if(el)observer.observe(el);
      }
    }
    new MutationObserver(schedule).observe(document.body,{subtree:true,childList:true});
    schedule();
  }
  window.CAST_CROP={renderAll:schedule,renderOne:()=>{}};
  window.CAST_VISUAL={layout:layoutPreview};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();
