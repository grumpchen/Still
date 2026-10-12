import type {WidgetType} from './widgetCatalog.ts';
import {placement,type Placement} from './layout.ts';

export type SnapLayoutId='halves'|'focus-left'|'thirds'|'quadrants';
export interface SnapZone {x:number;y:number;width:number;height:number}
export interface SnapLayout {id:SnapLayoutId;name:string;zones:SnapZone[]}
export type SnapAssignments=Record<number,string>;

export const snapLayouts:SnapLayout[]=[
 {id:'halves',name:'Side by side',zones:[{x:0,y:0,width:.5,height:1},{x:.5,y:0,width:.5,height:1}]},
 {id:'focus-left',name:'Focus left',zones:[{x:0,y:0,width:.5,height:1},{x:.5,y:0,width:.5,height:.5},{x:.5,y:.5,width:.5,height:.5}]},
 {id:'thirds',name:'Three columns',zones:[{x:0,y:0,width:1/3,height:1},{x:1/3,y:0,width:1/3,height:1},{x:2/3,y:0,width:1/3,height:1}]},
 {id:'quadrants',name:'Four corners',zones:[{x:0,y:0,width:.5,height:.5},{x:.5,y:0,width:.5,height:.5},{x:0,y:.5,width:.5,height:.5},{x:.5,y:.5,width:.5,height:.5}]},
];

export function snapLayout(id:SnapLayoutId):SnapLayout{return snapLayouts.find(layout=>layout.id===id)!}

export function snapZoneAtPoint(layout:SnapLayout,point:{x:number;y:number},size:{width:number;height:number}):number|null{
 if(size.width<=0||size.height<=0||point.x<0||point.y<0||point.x>=size.width||point.y>=size.height)return null;
 return layout.zones.findIndex(zone=>point.x>=zone.x*size.width&&point.x<(zone.x+zone.width)*size.width&&point.y>=zone.y*size.height&&point.y<(zone.y+zone.height)*size.height);
}

export function snapPlacement(type:WidgetType,layout:SnapLayout,zoneIndex:number,size:{width:number;height:number},scroll={x:0,y:0},gap=12):Placement{
 const zone=layout.zones[zoneIndex];if(!zone)throw new RangeError('Unknown snap layout zone.');
 const width=Math.max(1,Math.floor(zone.width*size.width-gap)),height=Math.max(1,Math.floor(zone.height*size.height-gap));
 return placement(type,{x:Math.max(0,Math.round(scroll.x+zone.x*size.width+gap/2)),y:Math.max(0,Math.round(scroll.y+zone.y*size.height+gap/2)),width,height});
}

export function nextSnapZone(layout:SnapLayout,assigned:SnapAssignments):number{return layout.zones.findIndex((_,index)=>!assigned[index])}

export function assignSnapZone(layout:SnapLayout,assigned:SnapAssignments,widgetId:string,zoneIndex:number):SnapAssignments{
 if(!layout.zones[zoneIndex])throw new RangeError('Unknown snap layout zone.');
 if(assigned[zoneIndex]&&assigned[zoneIndex]!==widgetId)return assigned;
 const next={...assigned};for(const [index,id]of Object.entries(next))if(id===widgetId)delete next[Number(index)];next[zoneIndex]=widgetId;return next;
}

export interface SnapWidget {id:string;type:WidgetType;placement:Placement;minimized?:boolean;groupCollapsed?:boolean}
export interface SnapCascadeResult {assignments:SnapAssignments;placements:Record<string,Placement>;overflowIds:string[]}
const overlaps=(a:Placement,b:Placement)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
function availableZone(layout:SnapLayout,assigned:SnapAssignments,after:number):number{
 for(let offset=1;offset<=layout.zones.length;offset++){const index=(after+offset)%layout.zones.length;if(!assigned[index])return index}
 return -1;
}
function overflowPlacement(widget:SnapWidget,widgets:SnapWidget[],positions:Record<string,Placement>,viewport:{width:number;height:number},scroll:{x:number;y:number},workspace:{width:number;height:number},stackIndex:number):Placement|null{
 const width=Math.min(widget.placement.width,Math.max(1,workspace.width-20)),height=Math.min(widget.placement.height,Math.max(1,workspace.height-20));
 const left=Math.max(0,Math.ceil(scroll.x+6)),top=Math.max(0,Math.ceil(scroll.y+6));
 const right=Math.min(workspace.width-width-14,Math.floor(scroll.x+viewport.width-width-14));
 const bottom=Math.min(workspace.height-height-14,Math.floor(scroll.y+viewport.height-height-14));
 const blocked=(x:number,y:number)=>widgets.some(other=>other.id!==widget.id&&!other.minimized&&!(other.type==='group'&&other.groupCollapsed)&&overlaps({x,y,width,height},positions[other.id]));
 if(right>=left&&bottom>=top){
  // First use a genuinely empty spot, but keep it on the currently visible page.
  for(let y=top;y<=bottom;y+=24){for(let x=left;x<=right;x+=24){if(!blocked(x,y))return{x,y,width,height}}}
  // If the grid fills the page, cascade cards in a visible stack. The caller
  // raises these cards so their title bars remain available to drag.
  const step=32,rows=Math.max(1,Math.floor((bottom-top)/step)+1),columns=Math.max(1,Math.floor((right-left)/step)+1);
  const index=stackIndex%(rows*columns),column=Math.floor(index/rows),row=index%rows;
  const x=Math.min(right,left+column*step),y=Math.min(bottom,top+row*step);
  return{x,y,width,height};
 }
 // A widget larger than the visible page cannot fit fully, so keep its origin
 // inside the current page rather than creating a horizontal-scroll placement.
 if(left<workspace.width&&top<workspace.height)return{x:left,y:top,width,height};
 return null;
}

/** Place a widget in a snap zone and cascade any cards occupying the destination
 * through the remaining zones. Extra cards stay within the currently visible
 * page, using free space first and a raised, staggered stack when the grid fills it. */
export function cascadeSnapZone(layout:SnapLayout,assigned:SnapAssignments,widgets:SnapWidget[],widgetId:string,zoneIndex:number,viewport:{width:number;height:number},scroll={x:0,y:0},workspace={width:Math.ceil(viewport.width*1.5),height:viewport.height}):SnapCascadeResult{
 if(!layout.zones[zoneIndex])throw new RangeError('Unknown snap layout zone.');
 const selected=widgets.find(widget=>widget.id===widgetId);if(!selected||selected.minimized||selected.type==='group'&&selected.groupCollapsed)return{assignments:{...assigned},placements:Object.fromEntries(widgets.map(widget=>[widget.id,{...widget.placement}])),overflowIds:[]};
 const eligible=widgets.filter(widget=>!widget.minimized&&!(widget.type==='group'&&widget.groupCollapsed));
 const ids=new Set(eligible.map(widget=>widget.id)),nextAssignments=Object.fromEntries(Object.entries(assigned).filter(([index,id])=>layout.zones[Number(index)]&&ids.has(id))) as SnapAssignments;
 for(const [index,id]of Object.entries(nextAssignments))if(id===widgetId)delete nextAssignments[Number(index)];
 const positions=Object.fromEntries(widgets.map(widget=>[widget.id,{...widget.placement}]));
 const target=snapPlacement(selected.type,layout,zoneIndex,viewport,scroll);positions[widgetId]=target;
 const queue:SnapWidget[]=[],queued=new Set<string>(),completed=new Set([widgetId]),overflowIds:string[]=[];
 const enqueue=(widget:SnapWidget)=>{if(widget.id===widgetId||queued.has(widget.id)||completed.has(widget.id))return;for(const [index,id]of Object.entries(nextAssignments))if(id===widget.id)delete nextAssignments[Number(index)];queued.add(widget.id);queue.push(widget)};
 for(const other of eligible){if(other.id!==widgetId&&(nextAssignments[zoneIndex]===other.id||overlaps(other.placement,target)))enqueue(other)}
 for(const [index,id]of Object.entries(nextAssignments))if(Number(index)===zoneIndex&&id!==widgetId){const occupant=eligible.find(widget=>widget.id===id);if(occupant)enqueue(occupant)}
 nextAssignments[zoneIndex]=widgetId;
 while(queue.length){const widget=queue.shift()!;const next=availableZone(layout,nextAssignments,zoneIndex);
  if(next<0){const overflow=overflowPlacement(widget,widgets,positions,viewport,scroll,workspace,overflowIds.length);if(overflow){positions[widget.id]=overflow;overflowIds.push(widget.id)}completed.add(widget.id);continue}
  const destination=snapPlacement(widget.type,layout,next,viewport,scroll);positions[widget.id]=destination;
  for(const other of eligible){if(other.id!==widget.id&&other.id!==widgetId&&overlaps(positions[other.id],destination))enqueue(other)}
  for(const [index,id]of Object.entries(nextAssignments))if(Number(index)===next&&id!==widget.id){const occupant=eligible.find(item=>item.id===id);if(occupant)enqueue(occupant)}
  nextAssignments[next]=widget.id;completed.add(widget.id);
 }
 return{assignments:nextAssignments,placements:positions,overflowIds};
}
