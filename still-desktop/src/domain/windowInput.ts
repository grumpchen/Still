export interface HitRegion { x:number; y:number; width:number; height:number }
export interface RectLike { left:number; top:number; right:number; bottom:number }

function intersect(a:RectLike,b:RectLike):RectLike|null{
 const left=Math.max(a.left,b.left),top=Math.max(a.top,b.top),right=Math.min(a.right,b.right),bottom=Math.min(a.bottom,b.bottom);
 return right>left&&bottom>top?{left,top,right,bottom}:null;
}

/** Collect visible Still controls in WebView CSS pixels, clipped to the viewport. */
export function interactiveHitRegions(root:ParentNode,viewportWidth:number,viewportHeight:number):HitRegion[]{
 const bounds={left:0,top:0,right:Math.max(0,viewportWidth),bottom:Math.max(0,viewportHeight)};
 const canvasElement=root.querySelector<HTMLElement>('.canvas-viewport');
 const canvasViewport=canvasElement?.getBoundingClientRect();
 const regions:HitRegion[]=[];
 for(const node of root.querySelectorAll<HTMLElement>('.sidebar,.sidebar-reveal-zone,.topbar,.widget-tray-shell,.canvas-card,dialog,[role="dialog"],[role="menu"],button,input,select,textarea,[role="button"],[contenteditable="true"]')){
  if(node.getClientRects().length===0)continue;
  const clipped=intersect(node.getBoundingClientRect(),bounds);
  const visible=node.matches('.canvas-card')&&canvasViewport&&clipped?intersect(clipped,canvasViewport):clipped;
  if(!visible)continue;
  regions.push({x:visible.left,y:visible.top,width:visible.right-visible.left,height:visible.bottom-visible.top});
 }
 // The viewport itself is transparent, but its native scrollbar gutters still need a hit target.
 if(canvasElement&&canvasViewport&&canvasElement.getClientRects().length){
  const addTrack=(rect:RectLike)=>{const visible=intersect(rect,bounds);if(visible)regions.push({x:visible.left,y:visible.top,width:visible.right-visible.left,height:visible.bottom-visible.top})};
  const left=canvasViewport.left+canvasElement.clientLeft,top=canvasViewport.top+canvasElement.clientTop;
  if(canvasElement.scrollWidth>canvasElement.clientWidth)addTrack({left,top:top+canvasElement.clientHeight,right:left+canvasElement.clientWidth,bottom:top+canvasElement.clientHeight+14});
  if(canvasElement.scrollHeight>canvasElement.clientHeight)addTrack({left:left+canvasElement.clientWidth,top,right:left+canvasElement.clientWidth+14,bottom:top+canvasElement.clientHeight});
 }
 return regions;
}
