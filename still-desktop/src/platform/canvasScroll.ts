export function observeCanvasScroll(viewport:HTMLElement,onScrollingChange:(scrolling:boolean)=>void,idleMs=120):()=>void {
 let scrolling=false,timer:ReturnType<typeof setTimeout>|undefined,disposed=false;
 const settle=()=>{if(timer!==undefined)clearTimeout(timer);timer=undefined;if(!disposed&&scrolling){scrolling=false;onScrollingChange(false)}};
 const onScroll=()=>{if(disposed)return;if(!scrolling){scrolling=true;onScrollingChange(true)}if(timer!==undefined)clearTimeout(timer);timer=setTimeout(settle,Math.max(0,idleMs))};
 viewport.addEventListener('scroll',onScroll,{passive:true});viewport.addEventListener('scrollend',settle);
 return()=>{disposed=true;if(timer!==undefined)clearTimeout(timer);timer=undefined;viewport.removeEventListener('scroll',onScroll);viewport.removeEventListener('scrollend',settle)};
}
