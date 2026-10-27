import {snapLayouts,type SnapLayoutId} from './domain/snapLayouts.ts';
import type {WidgetInstance} from './domain/workspaces.ts';
import {useT} from './localization.tsx';

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
 const t=useT();
 if(mode==='picker')return <div className="snap-layout-picker" data-app-panel-occlusion role="dialog" aria-label={t('chooseWorkspaceLayout')}>
  <div className="snap-layout-picker-heading"><strong>{t('snapWidgetsIntoLayout')}</strong><button type="button" aria-label={t('closeLayoutPicker')} onClick={close}>×</button></div>
  <div className="snap-layout-templates">{snapLayouts.map(layout=>{const name=t('snapLayout_'+layout.id);return <button type="button" key={layout.id} className="snap-layout-template" aria-label={name} onClick={()=>chooseLayout(layout.id)}>
   <span className="snap-layout-preview" data-layout={layout.id} aria-hidden="true">{layout.zones.map((zone,index)=><i key={index} style={{left:`${zone.x*100}%`,top:`${zone.y*100}%`,width:`${zone.width*100}%`,height:`${zone.height*100}%`}}/>)}</span><span>{name}</span>
  </button>})}</div>
 </div>;
 const layout=snapLayouts.find(item=>item.id===mode)!;
 const layoutName=t('snapLayout_'+layout.id);
 const availableIds=new Set(availableWidgets.filter(widget=>!widget.minimized&&!(widget.type==='group'&&widget.groupCollapsed)).map(widget=>widget.id));
 const liveAssignments=Object.fromEntries(Object.entries(assigned).filter(([index,id])=>layout.zones[Number(index)]&&availableIds.has(id)));
 const assignedIds=new Set(Object.values(liveAssignments));
 const filled=Object.keys(liveAssignments).length;
 const remainingZones=layout.zones.length-filled;
 const suggestions=availableWidgets.filter(widget=>!widget.minimized&&!(widget.type==='group'&&widget.groupCollapsed)&&!assignedIds.has(widget.id));
 return <div className="snap-layout-layer" aria-label={t('snapZonesFor').replace('{layout}',layoutName)}>
  {layout.zones.map((zone,index)=>{const widgetId=liveAssignments[index],active=hoveredZone===index,assignedWidget=availableWidgets.find(widget=>widget.id===widgetId);return <div key={index} className={'snap-layout-zone '+(widgetId?'snap-layout-zone-filled ':'')+(active?'snap-layout-zone-hover':'')} data-snap-zone={index} aria-label={t('snapZoneNumber').replace('{number}',String(index+1))} style={{left:`${zone.x*100}%`,top:`${zone.y*100}%`,width:`${zone.width*100}%`,height:`${zone.height*100}%`}}>
   {widgetId?<span className="snap-zone-label">{assignedWidget?widgetName(assignedWidget):t('widgetPlaced')}</span>:<span className="snap-zone-label">{active?t('releaseToSnap'):t('dropWidgetHere')}</span>}
  </div>})}
  <section className="snap-assist" data-app-panel-occlusion aria-label={t('snapAssist')}>
   <div className="snap-assist-heading"><div><strong>{remainingZones>0&&filled>0?t('chooseAnotherWidget'):t('layoutMode')}</strong><small>{filled===0?t('dragWidgetIntoArea'):remainingZones>0?t('fillRemainingAreas'):t('allAreasFilled')}</small></div><button type="button" aria-label={t('exitLayoutMode')} onClick={close}>×</button></div>
   {filled>0&&remainingZones>0&&(suggestions.length?<div className="snap-assist-widgets">{suggestions.map(widget=><button type="button" key={widget.id} onClick={()=>chooseWidget(widget.id)}>{widgetName(widget)}</button>)}</div>:<small className="snap-assist-empty">{t('noOpenWidgetsToPlace')}</small>)}
  </section>
 </div>;
}
