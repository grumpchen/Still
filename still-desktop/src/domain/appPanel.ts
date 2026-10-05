import {placement} from './layout.ts';
import type {WidgetInstance} from './workspaces.ts';
import {widgetCatalog} from './widgetCatalog.ts';
export interface AppSizeInfo {minWidth:number;minHeight:number;requiredWidth:number|null;requiredHeight:number|null}
export function appPanelFit(widget:WidgetInstance,info:AppSizeInfo,frameWidth:number,frameHeight:number):Partial<WidgetInstance>{
 const minimum=(reported:number|null,frame:number,base:number,cached:number|undefined)=>typeof reported==='number'&&Number.isFinite(reported)&&reported>0?Math.min(3000,Math.max(base,Math.ceil(reported+Math.max(0,Number.isFinite(frame)?frame:0)))):cached;
 const appMinWidth=minimum(info.requiredWidth,frameWidth,widgetCatalog.apps.minWidth,widget.appMinWidth),appMinHeight=minimum(info.requiredHeight,frameHeight,widgetCatalog.apps.minHeight,widget.appMinHeight);
 // minWidth/minHeight describe the reply's window, which may predate the user's latest drag.
 // Grow the current card only to the required minimum, never back to an earlier requested size.
 const p=widget.placement,width=Math.max(p.width,appMinWidth??0),height=Math.max(p.height,appMinHeight??0);
 const patch:Partial<WidgetInstance>={};if(width>p.width||height>p.height)patch.placement=placement('apps',{...p,width,height});
 if(appMinWidth!==widget.appMinWidth)patch.appMinWidth=appMinWidth;if(appMinHeight!==widget.appMinHeight)patch.appMinHeight=appMinHeight;
 return patch;
}
export interface PanelRect {left:number;top:number;right:number;bottom:number;width:number;height:number}
export interface PanelBounds {x:number;y:number;width:number;height:number}
export function appPanelGeometry(rect:PanelRect,viewport:PanelRect,active:boolean,obscured:boolean,resizeGrip:PanelRect|null=null):{bounds:PanelBounds;clip:PanelBounds;grip:PanelBounds|null;visible:boolean}{
 const left=Math.max(rect.left,viewport.left,0),top=Math.max(rect.top,viewport.top,0);
 const width=Math.max(0,Math.min(rect.right,viewport.right)-left),height=Math.max(0,Math.min(rect.bottom,viewport.bottom)-top);
 return{bounds:{x:rect.left,y:rect.top,width:Math.max(1,rect.width),height:Math.max(1,rect.height)},clip:{x:left,y:top,width:Math.max(1,width),height:Math.max(1,height)},grip:resizeGrip?{x:resizeGrip.left,y:resizeGrip.top,width:resizeGrip.width,height:resizeGrip.height}:null,visible:active&&!obscured&&width>1&&height>1};
}
