import {widgetCatalog, type WidgetType} from './widgetCatalog.ts';
export interface Placement {x:number; y:number; width:number; height:number}
export type PlacementMinimum = Partial<Pick<Placement,'width'|'height'>>;
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
export function resize(type:WidgetType,p:Placement,dx:number,dy:number,minimum?:PlacementMinimum):Placement {return placement(type,{...p,width:Math.max(minimum?.width??0,p.width+dx),height:Math.max(minimum?.height??0,p.height+dy)})}
