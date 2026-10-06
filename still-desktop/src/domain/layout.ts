import {widgetCatalog, type WidgetType} from './widgetCatalog.ts';
export interface Placement {x:number; y:number; width:number; height:number}
const finite = (v:unknown, fallback:number) => typeof v==='number' && Number.isFinite(v) ? v : fallback;
export function placement(type:WidgetType, value:unknown, fallback?:Placement):Placement {
  const meta=widgetCatalog[type], p=(value && typeof value==='object' ? value : {}) as Partial<Placement>;
  const d=fallback ?? {x:0,y:0,width:meta.width,height:meta.height};
  return {x:Math.round(Math.max(0,Math.min(20000,finite(p.x,d.x)))),y:Math.round(Math.max(0,Math.min(20000,finite(p.y,d.y)))),
    width:Math.round(Math.max(meta.minWidth,Math.min(3000,finite(p.width,d.width)))),height:Math.round(Math.max(meta.minHeight,Math.min(3000,finite(p.height,d.height))))};
}
export function nextPlacement(type:WidgetType, widgets:Array<{placement:Placement}>, availableWidth=1000):Placement {
  const d=placement(type,null), gap=16, limit=Math.max(d.width,Math.min(3000,availableWidth));
  // Scan unoccupied positions. Existing widgets are never rearranged when adding one.
  for(let y=0;y<20000;y+=40) for(let x=0;x+d.width<=limit;x+=40) {
    if(widgets.every(({placement:p})=>x+d.width+gap<=p.x || x>=p.x+p.width+gap || y+d.height+gap<=p.y || y>=p.y+p.height+gap))return {...d,x,y};
  }
  return {...d,y:Math.min(20000,Math.max(0,...widgets.map(w=>w.placement.y+w.placement.height+gap)))};
}
export function translate(type:WidgetType,p:Placement,dx:number,dy:number):Placement {return placement(type,{...p,x:p.x+dx,y:p.y+dy})}
export function resize(type:WidgetType,p:Placement,dx:number,dy:number):Placement {return placement(type,{...p,width:p.width+dx,height:p.height+dy})}
export function canvasHeight(viewportHeight:number,_widgets:Array<{placement:Placement}>):number {
 const viewport=Math.max(1,Number.isFinite(viewportHeight)?viewportHeight:0);
 return Math.ceil(viewport*1.5);
}
export function constrainPlacement(type:WidgetType,candidate:Placement,canvasWidth:number,minimum:{width?:number;height?:number}={},canvasHeight=Number.POSITIVE_INFINITY):Placement {
 const meta=widgetCatalog[type],p=placement(type,candidate);
 const widthLimit=Math.max(1,Math.min(3000,Math.floor(canvasWidth)-20));
 const heightLimit=Math.max(1,Math.min(3000,Math.floor(canvasHeight)-20));
 const minWidth=Math.min(widthLimit,Math.max(meta.minWidth,Number.isFinite(minimum.width)?Math.ceil(minimum.width!):0));
 const minHeight=Math.min(heightLimit,Math.max(meta.minHeight,Number.isFinite(minimum.height)?Math.ceil(minimum.height!):0));
 let width=Math.max(minWidth,Math.min(widthLimit,p.width)),height=Math.max(minHeight,Math.min(heightLimit,p.height)),x=Math.max(0,p.x),y=Math.max(0,p.y);
 const availableWidth=Math.floor(canvasWidth)-x-20;
 if(width>availableWidth){if(availableWidth>=minWidth)width=availableWidth;else x=Math.max(0,Math.floor(canvasWidth)-width-20)}
 const availableHeight=Math.floor(canvasHeight)-y-20;
 if(height>availableHeight){if(availableHeight>=minHeight)height=availableHeight;else y=Math.max(0,Math.floor(canvasHeight)-height-20)}
 return {x,y,width,height};
}
// Keep a fixed, discoverable extension so widgets can be moved into it while
// ensuring corrupt or legacy placements can never grow the workspace itself.
export function canvasExtent(viewportWidth:number,_widgets:Array<{placement:Placement}>):number {
 const viewport=Math.max(1,Number.isFinite(viewportWidth)?viewportWidth:0);
 return Math.ceil(viewport*1.5);
}
