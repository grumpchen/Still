export interface OverlayRect {left:number;top:number;right:number;bottom:number;width?:number;height?:number}
export interface OverlayBounds {x:number;y:number;width:number;height:number}
export interface ChromeClipGeometry {bounds:OverlayBounds;clip:OverlayBounds;occlusions:OverlayBounds[];visible:boolean;viewportRight:number}

function intersection(a:OverlayRect,b:OverlayRect):OverlayRect|null{
 const left=Math.max(a.left,b.left),top=Math.max(a.top,b.top),right=Math.min(a.right,b.right),bottom=Math.min(a.bottom,b.bottom);
 return right>left&&bottom>top?{left,top,right,bottom}:null;
}
function bounds(rect:OverlayRect):OverlayBounds{return{x:rect.left,y:rect.top,width:Math.max(1,rect.right-rect.left),height:Math.max(1,rect.bottom-rect.top)}}
/** Geometry for a top-level Chrome window and its viewport/overlap clipping region. */
export function chromeClipGeometry(rect:OverlayRect,viewport:OverlayRect,content:OverlayRect,higher:OverlayRect[],active:boolean,obscured:boolean,resizeGrip:OverlayRect|null=null):ChromeClipGeometry{
 const visibleRect=intersection(intersection(rect,viewport)??{left:0,top:0,right:0,bottom:0},content);
 const clip=visibleRect?bounds(visibleRect):{x:Math.max(0,viewport.left),y:Math.max(0,viewport.top),width:1,height:1};
 // Chrome is a separate top-level HWND above the WebView, so the DOM resize
 // control must be cut out of its native region to remain visible and hittable.
 const clippedHigher=higher.flatMap(item=>{const overlap=visibleRect&&intersection(visibleRect,item);return overlap?[overlap]:[]}),clippedGrip=resizeGrip&&visibleRect?intersection(visibleRect,resizeGrip):null,tooMany=clippedHigher.length>256;
 // Keep a native cutout for the grip even at the occlusion limit.
 const occlusionRects=[...clippedHigher.slice(0,clippedGrip?255:256),...(clippedGrip?[clippedGrip]:[])],occlusions=occlusionRects.map(bounds);
 // A higher card occludes the attached native window as a whole. Its Still
 // card remains rendered above the WebView, and clearing the overlap restores
 // this same HWND through the normal present path.
 return{bounds:{x:rect.left,y:rect.top,width:Math.max(1,rect.right-rect.left),height:Math.max(1,rect.bottom-rect.top)},clip,occlusions,visible:!!visibleRect&&!tooMany&&clippedHigher.length===0&&active&&!obscured,viewportRight:viewport.right};
}

/** Used by visibility tests; partial viewport intersections are now supported. */
export function overlayVisible(r:OverlayRect,v:OverlayRect,active:boolean,obscured:boolean,overlap:boolean):boolean{
 return !!intersection(r,v)&&active&&!obscured&&!overlap;
}
