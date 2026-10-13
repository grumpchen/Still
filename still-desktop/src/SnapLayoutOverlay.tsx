import {snapLayouts,type SnapLayoutId} from './domain/snapLayouts.ts';
import type {WidgetInstance} from './domain/workspaces.ts';

interface Props {
 mode:'picker'|SnapLayoutId;
 assigned:Record<number,string>;
 hoveredZone:number|null;
 availableWidgets:WidgetInstance[];
 widgetName:(widget:WidgetInstance)=>string;
 chooseLayout:(id:SnapLayoutId)=>void;
 chooseWidget:(id:string)=>void;
 close:()=>void;
}

export default function SnapLayoutOverlay({mode,assigned,hoveredZone,availableWidgets,widgetName,chooseLayout,chooseWidget,close}:Props){
 if(mode==='picker')return <div className="snap-layout-picker" data-app-panel-occlusion role="dialog" aria-label="Choose a workspace layout">
  <div className="snap-layout-picker-heading"><strong>Snap widgets into a layout</strong><button type="button" aria-label="Close layout picker" onClick={close}>×</button></div>
  <div className="snap-layout-templates">{snapLayouts.map(layout=><button type="button" key={layout.id} className="snap-layout-template" aria-label={layout.name} onClick={()=>chooseLayout(layout.id)}>
   <span className="snap-layout-preview" data-layout={layout.id} aria-hidden="true">{layout.zones.map((zone,index)=><i key={index} style={{left:`${zone.x*100}%`,top:`${zone.y*100}%`,width:`${zone.width*100}%`,height:`${zone.height*100}%`}}/>)}</span><span>{layout.name}</span>
  </button>)}</div>
 </div>;
 const layout=snapLayouts.find(item=>item.id===mode)!;
 const availableIds=new Set(availableWidgets.filter(widget=>!widget.minimized&&!(widget.type==='group'&&widget.groupCollapsed)).map(widget=>widget.id));
 const liveAssignments=Object.fromEntries(Object.entries(assigned).filter(([index,id])=>layout.zones[Number(index)]&&availableIds.has(id)));
 const assignedIds=new Set(Object.values(liveAssignments));
 const filled=Object.keys(liveAssignments).length;
 const remainingZones=layout.zones.length-filled;
 const suggestions=availableWidgets.filter(widget=>!widget.minimized&&!(widget.type==='group'&&widget.groupCollapsed)&&!assignedIds.has(widget.id));
 return <div className="snap-layout-layer" aria-label={layout.name+' snap zones'}>
  {layout.zones.map((zone,index)=>{const widgetId=liveAssignments[index],active=hoveredZone===index,assignedWidget=availableWidgets.find(widget=>widget.id===widgetId);return <div key={index} className={'snap-layout-zone '+(widgetId?'snap-layout-zone-filled ':'')+(active?'snap-layout-zone-hover':'')} data-snap-zone={index} aria-label={'Snap zone '+(index+1)} style={{left:`${zone.x*100}%`,top:`${zone.y*100}%`,width:`${zone.width*100}%`,height:`${zone.height*100}%`}}>
   {widgetId?<span className="snap-zone-label">{assignedWidget?widgetName(assignedWidget):'Widget placed'}</span>:<span className="snap-zone-label">{active?'Release to snap':'Drop a widget here'}</span>}
  </div>})}
  <section className="snap-assist" data-app-panel-occlusion aria-label="Snap Assist">
   <div className="snap-assist-heading"><div><strong>{remainingZones>0&&filled>0?'Choose another widget':'Layout mode'}</strong><small>{filled===0?'Drag a widget into a highlighted area.':remainingZones>0?'Fill the remaining areas, or leave them open.': 'All areas are filled.'}</small></div><button type="button" aria-label="Exit layout mode" onClick={close}>×</button></div>
   {filled>0&&remainingZones>0&&(suggestions.length?<div className="snap-assist-widgets">{suggestions.map(widget=><button type="button" key={widget.id} onClick={()=>chooseWidget(widget.id)}>{widgetName(widget)}</button>)}</div>:<small className="snap-assist-empty">No other open widgets to place.</small>)}
  </section>
 </div>;
}
