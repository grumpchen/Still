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
function overflowPlacement(widget:SnapWidget,widgets:SnapWidget[],positions:Record<string,Placement>,reserved:Placement[],viewport:{width:number;height:number},scroll:{x:number;y:number},workspace:{width:number;height:number},stackIndex:number):Placement|null{
 const width=Math.min(widget.placement.width,Math.max(1,workspace.width-20)),height=Math.min(widget.placement.height,Math.max(1,workspace.height-20));
 const left=Math.max(0,Math.ceil(scroll.x+6)),top=Math.max(0,Math.ceil(scroll.y+6));
 const right=Math.min(workspace.width-width-14,Math.floor(scroll.x+viewport.width-width-14));
 const bottom=Math.min(workspace.height-height-14,Math.floor(scroll.y+viewport.height-height-14));
 const blocked=(x:number,y:number)=>{const candidate={x,y,width,height};return reserved.some(area=>overlaps(candidate,area))||widgets.some(other=>other.id!==widget.id&&overlaps(candidate,positions[other.id]))};
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

/** Place the chosen widget in a snap zone and move every blocker into visible
 * free canvas space. Blockers are left unassigned so Snap Assist can offer them
 * individually instead of silently filling the rest of the layout. */
export function cascadeSnapZone(layout:SnapLayout,assigned:SnapAssignments,widgets:SnapWidget[],widgetId:string,zoneIndex:number,viewport:{width:number;height:number},scroll={x:0,y:0},workspace={width:Math.ceil(viewport.width*1.5),height:viewport.height}):SnapCascadeResult{
 if(!layout.zones[zoneIndex])throw new RangeError('Unknown snap layout zone.');
 const selected=widgets.find(widget=>widget.id===widgetId);if(!selected||selected.minimized||selected.type==='group'&&selected.groupCollapsed)return{assignments:{...assigned},placements:Object.fromEntries(widgets.map(widget=>[widget.id,{...widget.placement}])),overflowIds:[]};
 const selectable=widgets.filter(widget=>!widget.minimized&&!(widget.type==='group'&&widget.groupCollapsed));
 const ids=new Set(selectable.map(widget=>widget.id)),nextAssignments=Object.fromEntries(Object.entries(assigned).filter(([index,id])=>layout.zones[Number(index)]&&ids.has(id))) as SnapAssignments;
 for(const [index,id]of Object.entries(nextAssignments))if(id===widgetId)delete nextAssignments[Number(index)];
 const positions=Object.fromEntries(widgets.map(widget=>[widget.id,{...widget.placement}]));
 const target=snapPlacement(selected.type,layout,zoneIndex,viewport,scroll);positions[widgetId]=target;
 // Snap labels sit at the top-left of each highlighted region. Treat their
 // visible footprint as occupied so displaced cards never land on the prompt.
 const promptAreas=layout.zones.map(zone=>({x:Math.round(scroll.x+zone.x*viewport.width)+10,y:Math.round(scroll.y+zone.y*viewport.height)+10,width:Math.max(1,Math.min(180,Math.floor(zone.width*viewport.width)-16)),height:42}));
 const overflowIds:string[]=[];
 const blockerIds=new Set(widgets.filter(other=>other.id!==widgetId&&overlaps(positions[other.id],target)).map(other=>other.id));
 for(const [index,id]of Object.entries(nextAssignments))if(Number(index)===zoneIndex&&id!==widgetId)blockerIds.add(id);
 for(const [index,id]of Object.entries(nextAssignments))if(id===widgetId||blockerIds.has(id))delete nextAssignments[Number(index)];
 nextAssignments[zoneIndex]=widgetId;
 for(const id of blockerIds){const blocker=widgets.find(other=>other.id===id);if(!blocker)continue;const free=overflowPlacement(blocker,widgets,positions,promptAreas,viewport,scroll,workspace,overflowIds.length);if(free){positions[id]=free;overflowIds.push(id)}}
 return{assignments:nextAssignments,placements:positions,overflowIds};
}
