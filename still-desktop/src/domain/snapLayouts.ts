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
