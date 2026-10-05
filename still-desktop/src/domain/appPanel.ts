export interface PanelRect {left:number;top:number;right:number;bottom:number;width:number;height:number}
export interface PanelBounds {x:number;y:number;width:number;height:number}
export function appPanelGeometry(rect:PanelRect,viewport:PanelRect,active:boolean,obscured:boolean,resizeGrip:PanelRect|null=null):{bounds:PanelBounds;clip:PanelBounds;grip:PanelBounds|null;visible:boolean}{
 const left=Math.max(rect.left,viewport.left,0),top=Math.max(rect.top,viewport.top,0);
 const width=Math.max(0,Math.min(rect.right,viewport.right)-left),height=Math.max(0,Math.min(rect.bottom,viewport.bottom)-top);
 return{bounds:{x:rect.left,y:rect.top,width:Math.max(1,rect.width),height:Math.max(1,rect.height)},clip:{x:left,y:top,width:Math.max(1,width),height:Math.max(1,height)},grip:resizeGrip?{x:resizeGrip.left,y:resizeGrip.top,width:resizeGrip.width,height:resizeGrip.height}:null,visible:active&&!obscured&&width>1&&height>1};
}
