export interface BrowserRect {left:number;top:number;right:number;bottom:number}
const contains=(outer:BrowserRect,inner:BrowserRect)=>inner.left>=outer.left&&inner.top>=outer.top&&inner.right<=outer.right&&inner.bottom<=outer.bottom;

/** Native child webviews cannot be clipped by the React DOM; hide if any ancestor would clip them. */
export function browserPanelFullyVisible(bounds:BrowserRect,windowBounds:BrowserRect,clippingAncestors:BrowserRect[]):boolean{
 if([bounds.left,bounds.top,bounds.right,bounds.bottom,bounds.right-bounds.left,bounds.bottom-bounds.top].some(value=>!Number.isFinite(value))||bounds.right-bounds.left<2||bounds.bottom-bounds.top<2)return false;
 return contains(windowBounds,bounds)&&clippingAncestors.every(clip=>contains(clip,bounds));
}
