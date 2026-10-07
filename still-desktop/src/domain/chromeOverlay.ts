export interface OverlayRect {left:number;top:number;right:number;bottom:number;width?:number;height?:number}
export interface OverlayBounds {x:number;y:number;width:number;height:number}
export interface ChromeClipGeometry {bounds:OverlayBounds;clip:OverlayBounds;occlusions:OverlayBounds[];visible:boolean;viewportRight:number}

function intersection(a:OverlayRect,b:OverlayRect):OverlayRect|null{
 const left=Math.max(a.left,b.left),top=Math.max(a.top,b.top),right=Math.min(a.right,b.right),bottom=Math.min(a.bottom,b.bottom);
 return right>left&&bottom>top?{left,top,right,bottom}:null;
}
function bounds(rect:OverlayRect):OverlayBounds{return{x:rect.left,y:rect.top,width:Math.max(1,rect.right-rect.left),height:Math.max(1,rect.bottom-rect.top)}}
function hasUncoveredArea(base:OverlayRect,covers:OverlayRect[]):boolean{
 const clipped=covers.flatMap(item=>{const overlap=intersection(base,item);return overlap?[overlap]:[]});
 const edges=[base.left,base.right,...clipped.flatMap(item=>[item.left,item.right])].sort((a,b)=>a-b);
 for(let i=0;i<edges.length-1;i++){
  if(edges[i+1]<=edges[i])continue;
  const x=(edges[i]+edges[i+1])/2,intervals=clipped.filter(item=>x>=item.left&&x<item.right).map(item=>[item.top,item.bottom] as const).sort((a,b)=>a[0]-b[0]);
  let covered=base.top;
  for(const [top,bottom] of intervals){if(top>covered)return true;covered=Math.max(covered,bottom);if(covered>=base.bottom)break}
  if(covered<base.bottom)return true;
 }
 return false;
}

/** Geometry for a top-level Chrome window and its viewport/overlap clipping region. */
export function chromeClipGeometry(rect:OverlayRect,viewport:OverlayRect,content:OverlayRect,higher:OverlayRect[],active:boolean,obscured:boolean):ChromeClipGeometry{
 const visibleRect=intersection(intersection(rect,viewport)??{left:0,top:0,right:0,bottom:0},content);
 const clip=visibleRect?bounds(visibleRect):{x:Math.max(0,viewport.left),y:Math.max(0,viewport.top),width:1,height:1};
 const clipped=higher.flatMap(item=>{const overlap=visibleRect&&intersection(visibleRect,item);return overlap?[overlap]:[]}),tooMany=clipped.length>256,occlusions=clipped.slice(0,256).map(bounds);
 return{bounds:{x:rect.left,y:rect.top,width:Math.max(1,rect.right-rect.left),height:Math.max(1,rect.bottom-rect.top)},clip,occlusions,visible:!!visibleRect&&!tooMany&&hasUncoveredArea(visibleRect,clipped)&&active&&!obscured,viewportRight:viewport.right};
}

/** Used by visibility tests; partial viewport intersections are now supported. */
export function overlayVisible(r:OverlayRect,v:OverlayRect,active:boolean,obscured:boolean,overlap:boolean):boolean{
 return !!intersection(r,v)&&active&&!obscured&&!overlap;
}
