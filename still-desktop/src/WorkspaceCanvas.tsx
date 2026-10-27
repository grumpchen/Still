import {useCallback,useEffect,useRef,useState,type PointerEvent,type KeyboardEvent,type DragEvent,type MouseEvent as ReactMouseEvent} from 'react';
import {createPortal} from 'react-dom';
import {Icon} from './Icon.tsx';
import TimerWidget from './TimerWidget.tsx';
import {widgetRegistry} from './widgets.tsx';
import {widgetTypes,widgetTagColors,type WidgetInstance,type WidgetType,type SavedGroup,type GroupWidgetEntry,type WidgetTagColor,minimizeWidgetInstance,moveMinimizedWidgetInstance,restoreWidgetInstance,toggleGroupCollapsed,collectedWidgetCount,constrainGroupCollapsedPlacement} from './domain/workspaces.ts';
import {placement,translate,resize,type Placement,canvasExtent,canvasHeight,constrainPlacement} from './domain/layout.ts';
import {captureWidget,downloadCapture} from './platform/capture.ts';
import type {WebShortcut} from './domain/webShortcuts.ts';
import GroupTray from './GroupTray.tsx';
import GroupHeaderName from './GroupHeaderName.tsx';
import type {GroupEditMode} from './GroupEditor.tsx';
import PresetTray from './PresetTray.tsx';
import SavedItemContextMenu,{type SavedItemMenuTarget} from './SavedItemContextMenu.tsx';
import {presetFromWidget,type WidgetPreset,type PresetType} from './domain/presets.ts';
import {trayDropDecision,droppedWebsite,type GroupTrayDropTarget} from './domain/trayDrop.ts';
import {resourceDrop,previewFileDrop,presetForDroppedResource,type ResourceDropEvent,type DroppedResource} from './platform/resourceDrop.ts';
import {TrayDragProvider,TrayDragButton,trayFocusIntoView,type TrayDragPosition} from './TrayDragButton.tsx';
import {appPanel} from './platform/appPanel.ts';
import {openExternalUrl} from './platform/externalUrl.ts';
import type {WidgetRelaunchMode,WidgetRelaunchPluginStatus} from './domain/widgetRelaunch.ts';
import {showClockControl,type ClockPluginMode} from './domain/clockPlugin.ts';
import {clockPopupPosition} from './domain/clockPopup.ts';
import {showScreenshotControl,type ScreenshotPluginMode} from './domain/screenshotPlugin.ts';
import {canCloseWidget,canMoveWidget,setWidgetLock} from './domain/widgetLock.ts';
import {cascadeSnapZone,nextSnapZone,snapLayout,snapZoneAtPoint,type SnapLayoutId} from './domain/snapLayouts.ts';
import {canvasFrameInterval,isCanvasFrameDue,type CanvasFrameRate} from './domain/performance.ts';
import SnapLayoutOverlay from './SnapLayoutOverlay.tsx';
import WorkspaceDock from './WorkspaceDock.tsx';
import {useT} from './localization.tsx';
interface DropProps {savePresets:(presets:WidgetPreset[],preserveUndo?:boolean)=>void;openDropped:(presets:WidgetPreset[],at:{x:number;y:number},width:number)=>void}
interface AppPickerProps {pickApp:(id?:string,at?:{x:number;y:number},width?:number)=>void;saveApp:(id:string)=>void;appAttachments:Record<string,import('./platform/appPanel.ts').AppAttachment>;appAttachmentHandled:(id:string,attachment:import('./platform/appPanel.ts').AppAttachment)=>void}
interface Props {workspaceId:string;canvasFrameRate?:CanvasFrameRate;minimizeModifiers?:{ctrl:boolean;alt:boolean;shift:boolean};transferWidget:(sourceWorkspaceId:string,widgetId:string,destinationId:string,placement?:Placement,restorePlacement?:Placement|null)=>void;setWorkspaceDropTarget:(id:string|null)=>void;openAppsDialog:()=>void;editTray:()=>void;openInstalledApp:(app:import('./domain/appPicker.ts').InstalledAppChoice,source:DroppedResource)=>void;widgetTrayVisible:boolean;toggleWidgetTray:()=>void;presets:WidgetPreset[];openPreset:(preset:WidgetPreset,at?:{x:number;y:number},width?:number)=>void;editPreset:(type:PresetType,preset?:WidgetPreset)=>void;removePreset:(id:string)=>void;renamePreset:(id:string)=>void;renameGroup:(id:string)=>void;widgets:WidgetInstance[];groups:SavedGroup[];updateGroup:(id:string,patch:Partial<Omit<SavedGroup,'id'>>)=>void;saveToGroup:(widget:WidgetInstance,groupId?:string,preserveUndo?:boolean)=>void;openGroup:(id:string,at?:{x:number;y:number},width?:number)=>void;editGroup:(id:string,mode:GroupEditMode)=>void;removeGroup:(id:string)=>void;openGroupWidget:(entry:GroupWidgetEntry,at?:{x:number;y:number},width?:number)=>void; update:(id:string,patch:Partial<WidgetInstance>)=>void; add:(type:WidgetType,at?:{x:number;y:number},width?:number)=>void; remove:(id:string,preserveUndo?:boolean)=>void; begin:()=>void; bringToFront:(id:string)=>void; notify:(s:string)=>void;appOpenResult?:(id:string,success:boolean,error?:string)=>void;obscured:boolean; workspaceActive?:boolean; openResource:(link:WebShortcut,at:{x:number;y:number})=>void;startupDeferredIds?:ReadonlySet<string>;startupRelaunch?:(id:string)=>void;widgetRelaunchPluginStatus?:WidgetRelaunchPluginStatus;widgetRelaunchMode?:WidgetRelaunchMode;widgetRelaunchColors?:Partial<Record<WidgetTagColor,WidgetRelaunchMode>>;setRelaunchMode?:(mode:WidgetRelaunchMode)=>void;setRelaunchColor?:(color:WidgetTagColor,mode:WidgetRelaunchMode|null)=>void;screenshotPluginMode?:ScreenshotPluginMode;screenshotPluginColors?:WidgetTagColor[];setScreenshotMode?:(mode:ScreenshotPluginMode)=>void;setScreenshotColor?:(color:WidgetTagColor,enabled:boolean)=>void;screenshotPluginColorOverrides?:Partial<Record<WidgetTagColor,boolean>>;setScreenshotColorOverride?:(color:WidgetTagColor,enabled:boolean|null)=>void;clockPluginMode?:ClockPluginMode;clockPluginColors?:WidgetTagColor[];clockPluginColorOverrides?:Partial<Record<WidgetTagColor,boolean>>;setClockPluginMode?:(mode:ClockPluginMode)=>void;setClockPluginColor?:(color:WidgetTagColor,enabled:boolean)=>void;setClockPluginColorOverride?:(color:WidgetTagColor,enabled:boolean|null)=>void;showAppAttachAction?:boolean;showAppDetachAction?:boolean;showAppSaveAction?:boolean;showWidgetRelaunchAction?:boolean;showWidgetExportPngAction?:boolean}
type Gesture={id:string;type:WidgetType;mode:'move'|'resize';startX:number;startY:number;p:Placement;current:Placement;restorePlacement?:Placement|null;currentRestorePlacement?:Placement|null;scrollX:number;scrollY:number};
type SaveCue={kind:'saved'}|{kind:'widget';type:WidgetType}|{kind:'group-create'}|{kind:'group';id:string};
type SnapProps={layoutMode?:'picker'|SnapLayoutId|null;setLayoutMode?:(mode:'picker'|SnapLayoutId|null)=>void};
export default function WorkspaceCanvas({workspaceId,canvasFrameRate='display',minimizeModifiers={ctrl:true,alt:false,shift:true},transferWidget,setWorkspaceDropTarget,openAppsDialog,editTray,openInstalledApp,widgetTrayVisible,toggleWidgetTray,presets,openPreset,editPreset,removePreset,renamePreset,savePresets,openDropped,renameGroup,widgets,groups,updateGroup,saveToGroup,openGroup,editGroup,removeGroup,openGroupWidget,update,add,remove,begin,bringToFront,notify,appOpenResult,obscured,workspaceActive=true,openResource,pickApp,saveApp,appAttachments,appAttachmentHandled,startupDeferredIds=new Set(),startupRelaunch=()=>{},widgetRelaunchPluginStatus='enabled',widgetRelaunchMode='automatic',widgetRelaunchColors={},setRelaunchMode=()=>{},setRelaunchColor=()=>{},screenshotPluginMode='global',screenshotPluginColors=[],setScreenshotMode=()=>{},setScreenshotColor=()=>{},screenshotPluginColorOverrides={},setScreenshotColorOverride=()=>{},clockPluginMode='global',clockPluginColors=[],clockPluginColorOverrides={},setClockPluginMode=()=>{},setClockPluginColor=()=>{},setClockPluginColorOverride=()=>{},showAppAttachAction=false,showAppDetachAction=false,showAppSaveAction=false,showWidgetRelaunchAction=true,showWidgetExportPngAction=true,layoutMode=null,setLayoutMode=()=>{}}:Props&DropProps&AppPickerProps&SnapProps){
  const t=useT();
  const viewport=useRef<HTMLDivElement>(null),tray=useRef<HTMLDivElement>(null),gesture=useRef<Gesture|null>(null),gestureEndListeners=useRef<(()=>void)|null>(null);
  const latestWidgets=useRef(widgets),latestUpdate=useRef(update);latestWidgets.current=widgets;latestUpdate.current=update;
  const pendingMove=useRef<{x:number;y:number}|null>(null),moveFrame=useRef(0),moveTimer=useRef<ReturnType<typeof setTimeout>|null>(null),lastMoveAt=useRef(0);
  const preparedAppSources=useRef(new Map<string,{appKey:string;appName:string}>());
  const previousPresetIds=useRef(new Set(presets.map(preset=>preset.id)));
  const [active,setActive]=useState<string|null>(null),[trayDragging,setTrayDragging]=useState(false),[overTray,setOverTray]=useState(false),[overCanvas,setOverCanvas]=useState(false),[busy,setBusy]=useState<string|null>(null),[tagPicker,setTagPicker]=useState<{id:string;top:number;right:number}|null>(null),[pluginPicker,setPluginPicker]=useState<{id:string;top:number;right:number}|null>(null),[clockPicker,setClockPicker]=useState<{id:string;top:number;right:number;maxHeight:number}|null>(null);
  const [relaunchTokens,setRelaunchTokens]=useState<Record<string,number>>({}),[relaunchFailures,setRelaunchFailures]=useState<Record<string,boolean>>({});const [snapAssignments,setSnapAssignments]=useState<Record<number,string>>({}),[hoveredSnapZone,setHoveredSnapZone]=useState<number|null>(null);
  const [viewportWidth,setViewportWidth]=useState(0),[viewportHeight,setViewportHeight]=useState(0),[overviewVisible,setOverviewVisible]=useState(true),[dockExpanded,setDockExpanded]=useState(false);
  const overviewViewportRef=useRef<SVGRectElement>(null);
  const [saveTarget,setSaveTarget]=useState<SaveCue|null>(null),[canvasGroupDropId,setCanvasGroupDropId]=useState<string|null>(null),[externalDragging,setExternalDragging]=useState(false),[trayGhost,setTrayGhost]=useState<TrayDragPosition|null>(null);
  const [savedMenu,setSavedMenu]=useState<SavedItemMenuTarget|null>(null);
  const closeSavedMenu=useCallback(()=>setSavedMenu(null),[]);
  function popupPosition(rect:DOMRect,width:number){return{top:Math.max(4,rect.top-40),right:Math.max(4,Math.min(window.innerWidth-rect.right,window.innerWidth-width-4))}}
  const popupKind=tagPicker?'tag':pluginPicker?'plugin':clockPicker?'clock':null,popupWidgetId=tagPicker?.id??pluginPicker?.id??clockPicker?.id;
  useEffect(()=>{
   if(!popupKind||!popupWidgetId)return;
   const card=document.querySelector<HTMLElement>(`[data-widget-id="${popupWidgetId}"]`),anchor=card?.querySelector<HTMLElement>(popupKind==='tag'?'.widget-active-tag':popupKind==='clock'?'.widget-clock-control':'.widget-customize-control');
   if(!card||!anchor){if(popupKind==='clock')setClockPicker(null);return}
   const width=popupKind==='tag'?238:popupKind==='clock'?360:190;
   const reposition=()=>{const rect=anchor.getBoundingClientRect();if(popupKind==='clock'){const position=clockPopupPosition(card.getBoundingClientRect(),{width:window.innerWidth,height:window.innerHeight});setClockPicker(current=>current?.id!==popupWidgetId||current.top===position.top&&current.right===position.right&&current.maxHeight===position.maxHeight?current:{id:popupWidgetId,...position});return}const position=popupPosition(rect,width);if(popupKind==='tag')setTagPicker(current=>current?.id!==popupWidgetId||current.top===position.top&&current.right===position.right?current:{id:popupWidgetId,...position});else setPluginPicker(current=>current?.id!==popupWidgetId||current.top===position.top&&current.right===position.right?current:{id:popupWidgetId,...position})};
   const mutations=new MutationObserver(reposition),sizes=new ResizeObserver(reposition),viewport=card.closest('.canvas-viewport');
   mutations.observe(card,{attributes:true,attributeFilter:['style']});sizes.observe(card);sizes.observe(anchor);if(viewport)sizes.observe(viewport);
   window.addEventListener('resize',reposition);window.addEventListener('scroll',reposition,true);reposition();
   return()=>{mutations.disconnect();sizes.disconnect();window.removeEventListener('resize',reposition);window.removeEventListener('scroll',reposition,true)};
  },[popupKind,popupWidgetId]);
  const runningClockSignature=widgets.filter(widget=>widget.clockPluginEnabled&&widget.end!==null).map(widget=>`${widget.id}:${widget.end}`).join('|');
  useEffect(()=>{
   if(!workspaceActive||obscured)return;
   function toggleOverview(){setOverviewVisible(value=>!value)}
   document.addEventListener('still:workspace-overview-toggle',toggleOverview);return()=>{document.removeEventListener('still:workspace-overview-toggle',toggleOverview)};
  },[workspaceActive,obscured]);
  useEffect(()=>{
   if(!workspaceActive||!runningClockSignature)return;
   const checkCompleted=()=>{const now=Date.now();for(const widget of widgets){if(widget.clockPluginEnabled&&widget.end!==null&&widget.end<=now){update(widget.id,{end:null,remaining:0});notify(t('clockTimerCompleted'))}}};
   checkCompleted();
   const timer=window.setInterval(checkCompleted,1000);
   return()=>window.clearInterval(timer);
  },[workspaceActive,runningClockSignature,widgets,update,notify]);
  useEffect(()=>{
   const added=presets.some(preset=>!previousPresetIds.current.has(preset.id));
   previousPresetIds.current=new Set(presets.map(preset=>preset.id));
   if(!added)return;
   const frame=requestAnimationFrame(()=>{const items=tray.current?.querySelector<HTMLElement>('.dock-shortcuts-items');if(items)items.scrollLeft=Math.max(0,items.scrollWidth-items.clientWidth)});
   return()=>cancelAnimationFrame(frame);
  },[presets]);
  useEffect(()=>{const ids=new Set(widgets.map(widget=>widget.id));setRelaunchTokens(current=>{const next=Object.fromEntries(Object.entries(current).filter(([id])=>ids.has(id)));return Object.keys(next).length===Object.keys(current).length?current:next});setRelaunchFailures(current=>{const next=Object.fromEntries(Object.entries(current).filter(([id])=>ids.has(id)));return Object.keys(next).length===Object.keys(current).length?current:next})},[widgets]);
  function openSavedContextMenu(event:ReactMouseEvent<HTMLButtonElement>,kind:SavedItemMenuTarget['kind'],id:string){event.preventDefault();event.stopPropagation();setSavedMenu({kind,id,x:event.clientX,y:event.clientY})}
  const externalEntries=useRef<DroppedResource[]>([]),nativeHandler=useRef<(event:ResourceDropEvent)=>void>(()=>{});
  function contains(rect:DOMRect,x:number,y:number){return x>=rect.left&&x<=rect.right&&y>=rect.top&&y<=rect.bottom}
  function trayTarget(x:number,y:number){
   const t=tray.current!;if(!contains(t.getBoundingClientRect(),x,y))return{insideTray:false,targetType:null,overInteractive:false};
   const trashTarget=Array.from(t.querySelectorAll<HTMLElement>('[data-trash-target]')).some(node=>contains(node.getBoundingClientRect(),x,y));
   const savedTarget=Array.from(t.querySelectorAll<HTMLElement>('[data-saved-target]')).some(node=>{const scroll=node.closest('.tray-items');return contains(node.getBoundingClientRect(),x,y)&&(!scroll||contains(scroll.getBoundingClientRect(),x,y))});
   const groupNode=Array.from(t.querySelectorAll<HTMLElement>('[data-group-drop-target]')).find(node=>{const scroll=node.closest('.tray-items');return contains(node.getBoundingClientRect(),x,y)&&(!scroll||contains(scroll.getBoundingClientRect(),x,y))});
   const groupTarget:GroupTrayDropTarget|undefined=groupNode?.dataset.groupDropTarget==='create'?{kind:'create'}:groupNode?.dataset.groupDropTarget==='existing'&&groupNode.dataset.groupId?{kind:'existing',groupId:groupNode.dataset.groupId}:undefined;
   const element=Array.from(t.querySelectorAll<HTMLElement>('[data-tray-type]')).find(node=>{const scroll=node.closest('.tray-items');return contains(node.getBoundingClientRect(),x,y)&&(!scroll||contains(scroll.getBoundingClientRect(),x,y))});
   const targetType=element?.dataset.trayType as WidgetType|undefined;
   const overInteractive=!!targetType||!!groupTarget||Array.from(t.querySelectorAll<HTMLElement>('button,input,select,a')).some(node=>{const scroll=node.closest('.tray-items');return contains(node.getBoundingClientRect(),x,y)&&(!scroll||contains(scroll.getBoundingClientRect(),x,y))});
   return{insideTray:true,targetType:targetType??null,groupTarget,overInteractive,savedTarget,trashTarget};
  }
  function cueFor(action:string,target:ReturnType<typeof trayTarget>):SaveCue|null {if(action==='save'&&target.savedTarget)return{kind:'saved'};if(action==='save'&&target.targetType)return{kind:'widget',type:target.targetType};if(action==='create-group')return{kind:'group-create'};if(action==='save-group'&&target.groupTarget?.kind==='existing')return{kind:'group',id:target.groupTarget.groupId};return null}
  function sameSaveCue(a:SaveCue|null,b:SaveCue|null){return a===b||!!a&&!!b&&a.kind===b.kind&&(a.kind==='widget'&&b.kind==='widget'?a.type===b.type:a.kind==='group'&&b.kind==='group'?a.id===b.id:true)}
  function widgetFeedback(x:number,y:number,type:WidgetType){const target=trayTarget(x,y),action=trayDropDecision({source:'widget',widgetType:type,...target}),cue=cueFor(action,target);if(target.insideTray)setDockExpanded(true);setSaveTarget(current=>sameSaveCue(current,cue)?current:cue);setOverTray(action==='remove');return action}
  function clearDrop(){setExternalDragging(false);setSaveTarget(null);setCanvasGroupDropId(null);setOverTray(false);setOverCanvas(false);externalEntries.current=[]}
  function entrySource(entry:DroppedResource){return entry.kind==='website'?'website':entry.kind==='app'?'app':'file'}
  function externalFeedback(x:number,y:number,entries:DroppedResource[]){const target=trayTarget(x,y);const green=entries.some(entry=>trayDropDecision({source:entrySource(entry),...target})==='save');setSaveTarget(green?target.savedTarget?{kind:'saved'}:target.targetType?{kind:'widget',type:target.targetType}:null:null);setOverTray(false);setOverCanvas(!target.insideTray&&contains(viewport.current!.getBoundingClientRect(),x,y))}
  function canvasPoint(x:number,y:number){const v=viewport.current!,r=v.getBoundingClientRect();return{x:x-r.left+v.scrollLeft,y:y-r.top+v.scrollTop}}
  function canvasGroupTarget(x:number,y:number,source:WidgetInstance|undefined):string|null{
   if(!source||source.type==='group')return null;
   const candidates=Array.from(viewport.current?.querySelectorAll<HTMLElement>('[data-group-drop-target="canvas"]')??[]).filter(node=>node.dataset.widgetId!==source.id&&node.dataset.groupId&&contains(node.getBoundingClientRect(),x,y));
   candidates.sort((a,b)=>(Number(b.style.zIndex)||0)-(Number(a.style.zIndex)||0));return candidates[0]?.dataset.groupId??null;
  }
  function acceptResources(entries:DroppedResource[],x:number,y:number,errors:string[]=[]){
   const target=trayTarget(x,y),inCanvas=!target.insideTray&&contains(viewport.current!.getBoundingClientRect(),x,y);
   const accepted=inCanvas?entries:entries.filter(entry=>trayDropDecision({source:entrySource(entry),...target})==='save');
   const websites=accepted.filter(entry=>entry.kind==='website'&&entry.url),widgetEntries=accepted.filter(entry=>entry.kind!=='website');
   if(websites.length&&!inCanvas){notify(t('websiteGroupOnly'));clearDrop();return}
   for(const website of websites)if(website.url)void openExternalUrl(website.url).catch(error=>notify(String(error)));
   try{const saved=widgetEntries.map(presetForDroppedResource);if(saved.length){if(inCanvas)openDropped(saved,canvasPoint(x,y),extent);else savePresets(saved)}else if(!websites.length)notify(errors[0]??t('dropSavedHint'));if((saved.length||websites.length)&&errors.length)notify('Added '+saved.length+' shortcut(s). '+errors[0])}catch(e){notify(String((e as Error).message??e))}finally{clearDrop()}
  }
  nativeHandler.current=event=>{
   if(!workspaceActive||obscured)return;
   if(event.phase==='leave'){clearDrop();return}
   const p=event.position;if(!p)return;
   if(event.phase==='drop'){acceptResources(event.entries,p.x,p.y,event.errors);return}
   if(event.phase==='enter')externalEntries.current=event.entries;
   setExternalDragging(true);externalFeedback(p.x,p.y,externalEntries.current);
  };
  useEffect(()=>{if(!resourceDrop.available)return;let disposed=false,stop:(()=>void)|undefined;void resourceDrop.subscribe(event=>{if(!disposed)nativeHandler.current(event)}).then(unlisten=>{if(disposed)unlisten();else stop=unlisten}).catch(()=>notify(t('fileDropUnavailable')));return()=>{disposed=true;stop?.()}},[]);
  useEffect(()=>{if(!workspaceActive||obscured)clearDrop()},[workspaceActive,obscured]);
  const extent=canvasExtent(viewportWidth,widgets);
  const height=canvasHeight(viewportHeight,widgets);
  const activeSnapLayout=layoutMode&&layoutMode!=='picker'?snapLayout(layoutMode):null;
  useEffect(()=>{setSnapAssignments({});setHoveredSnapZone(null)},[layoutMode]);
  function snapZoneAtClient(x:number,y:number){const node=viewport.current,layout=activeSnapLayout;if(!node||!layout)return null;const rect=node.getBoundingClientRect();if(!rect.width||!rect.height)return null;const index=snapZoneAtPoint(layout,{x:(x-rect.left)*node.clientWidth/rect.width,y:(y-rect.top)*node.clientHeight/rect.height},{width:node.clientWidth,height:node.clientHeight});return index===null||index<0?null:index}
  function liveSnapAssignments(assignments:Record<number,string>){const selectable=new Set(widgets.filter(widget=>!widget.minimized&&!(widget.type==='group'&&widget.groupCollapsed)).map(widget=>widget.id));return Object.fromEntries(Object.entries(assignments).filter(([,id])=>selectable.has(id)))}
  function snapWidgetToZone(widgetId:string,zone:number,recordUndo=false){const widget=widgets.find(item=>item.id===widgetId),node=viewport.current,layout=activeSnapLayout;if(!widget||widget.minimized||widget.type==='group'&&widget.groupCollapsed||!node||!layout)return;if(recordUndo)begin();const result=cascadeSnapZone(layout,liveSnapAssignments(snapAssignments),widgets,widgetId,zone,{width:node.clientWidth,height:node.clientHeight},{x:node.scrollLeft,y:node.scrollTop},{width:extent,height});for(const item of widgets){const next=result.placements[item.id];if(!next||(next.x===item.placement.x&&next.y===item.placement.y&&next.width===item.placement.width&&next.height===item.placement.height))continue;if(item.minimized){const moved=moveMinimizedWidgetInstance(item,{x:next.x,y:next.y},extent,height);update(item.id,{placement:moved.placement,restorePlacement:moved.restorePlacement})}else update(item.id,{placement:bounded(item,next)})}bringToFront(widgetId);for(const id of result.overflowIds)bringToFront(id);setSnapAssignments(result.assignments);if(Object.keys(result.assignments).length>=layout.zones.length)setLayoutMode(null)}
  function chooseSnapAssistWidget(widgetId:string){const widget=widgets.find(item=>item.id===widgetId);if(!activeSnapLayout||!widget||!canMoveWidget(widget))return;const zone=nextSnapZone(activeSnapLayout,liveSnapAssignments(snapAssignments));if(zone>=0)snapWidgetToZone(widgetId,zone,true)}
  // Keep vertical space equal to the viewport; horizontal workspace extension remains available.
  function updateOverviewViewport(){const node=viewport.current,marker=overviewViewportRef.current;if(!node||!marker)return;marker.setAttribute('x',String(node.scrollLeft));marker.setAttribute('y',String(node.scrollTop));marker.setAttribute('width',String(node.clientWidth));marker.setAttribute('height',String(node.clientHeight))}
  useEffect(()=>{const node=viewport.current;if(!node)return;const measure=()=>{setViewportWidth(node.clientWidth);setViewportHeight(node.clientHeight);updateOverviewViewport()};measure();const observer=new ResizeObserver(measure);observer.observe(node);node.addEventListener('scroll',updateOverviewViewport,{passive:true});return()=>{observer.disconnect();node.removeEventListener('scroll',updateOverviewViewport)}},[]);
  useEffect(()=>{updateOverviewViewport()},[extent,height,viewportWidth,viewportHeight,overviewVisible]);
  function bounded(w:WidgetInstance,p:Placement){return w.minimized?moveMinimizedWidgetInstance(w,{x:p.x,y:p.y},extent,height).placement:w.type==='group'&&w.groupCollapsed?constrainGroupCollapsedPlacement(p,extent,height):constrainPlacement(w.type,p,extent,{width:w.appPanelOpen?w.appMinWidth:undefined,height:w.appPanelOpen?w.appMinHeight:undefined},height)}
  useEffect(()=>{if(active||!workspaceActive||viewportWidth<=0||viewportHeight<=0)return;for(const w of latestWidgets.current){if(w.minimized){const moved=moveMinimizedWidgetInstance(w,{x:w.placement.x,y:w.placement.y},extent,height);if(JSON.stringify(moved.placement)!==JSON.stringify(w.placement)||JSON.stringify(moved.restorePlacement)!==JSON.stringify(w.restorePlacement))latestUpdate.current(w.id,{placement:moved.placement,restorePlacement:moved.restorePlacement})}else{const p=bounded(w,w.placement);if(p.x!==w.placement.x||p.y!==w.placement.y||p.width!==w.placement.width||p.height!==w.placement.height)latestUpdate.current(w.id,{placement:p})}}},[active,workspaceActive,viewportWidth,viewportHeight,extent,height]);
  function reportRelaunchFailure(id:string,failed:boolean){setRelaunchFailures(current=>{if(!!current[id]===failed)return current;const next={...current};if(failed)next[id]=true;else delete next[id];return next})}
  function relaunch(w:WidgetInstance){reportRelaunchFailure(w.id,false);if(startupDeferredIds.has(w.id)){startupRelaunch(w.id);return}setRelaunchTokens(current=>({...current,[w.id]:(current[w.id]??0)+1}))}
  function start(e:PointerEvent<HTMLElement>,w:WidgetInstance,mode:'move'|'resize'){
    if(e.button!==0 || obscured || (mode==='move'&&!canMoveWidget(w)) || (mode==='move'&&!w.minimized&&(e.target as HTMLElement).closest('button')))return;
    if(!w.minimized)e.preventDefault();
    // Native panels are separate top-level HWNDs, so DOM iframe pointer-events
    // cannot keep them from taking the mouse during a canvas drag. Queue the
    // native hide before React's drag-state render and its later present call.
    if(mode==='move'&&!w.minimized&&w.type==='apps'&&appPanel.available)void appPanel.suspendForDrag(w.id).catch(error=>notify(t('appSuspendDragError').replace('{detail}',String(error))));
    begin();e.currentTarget.setPointerCapture(e.pointerId);
    const pointerId=e.pointerId,onPointerUp=(event:globalThis.PointerEvent)=>{if(event.pointerId===pointerId)finish(event)},onPointerCancel=(event:globalThis.PointerEvent)=>{if(event.pointerId===pointerId)finish(event,true)};
    window.addEventListener('pointerup',onPointerUp,true);window.addEventListener('pointercancel',onPointerCancel,true);gestureEndListeners.current=()=>{window.removeEventListener('pointerup',onPointerUp,true);window.removeEventListener('pointercancel',onPointerCancel,true)};
    gesture.current={id:w.id,type:w.type,mode,startX:e.clientX,startY:e.clientY,p:w.placement,current:w.placement,restorePlacement:w.restorePlacement,currentRestorePlacement:w.restorePlacement,scrollX:viewport.current?.scrollLeft??0,scrollY:viewport.current?.scrollTop??0};setActive(w.id);
  }
  function applyMove(x:number,y:number){const g=gesture.current;if(!g)return;
    const scroll=viewport.current!, dx=x-g.startX+scroll.scrollLeft-g.scrollX,dy=y-g.startY+scroll.scrollTop-g.scrollY;
    const row=g.mode==='move'?document.elementFromPoint(x,y)?.closest<HTMLElement>('[data-workspace-drop-target]'):null;
    const w=widgets.find(item=>item.id===g.id);if(w&&!row){if(w.minimized&&g.mode==='move'){const moved=moveMinimizedWidgetInstance(w,{x:g.p.x+dx,y:g.p.y+dy},extent,height);g.current=moved.placement;g.currentRestorePlacement=moved.restorePlacement}else g.current=bounded(w,g.mode==='move'?translate(g.type,g.p,dx,dy):resize(g.type,g.p,dx,dy));const card=document.getElementById('widget-'+g.id);if(card){if(g.mode==='move')card.style.transform=`translate3d(${g.current.x-g.p.x}px,${g.current.y-g.p.y}px,0)`;else{card.style.width=`${g.current.width}px`;card.style.height=`${g.current.height}px`;card.style.transform=''}}}
    if(g.mode==='move'){const target=row?.dataset.workspaceDropTarget??null;setWorkspaceDropTarget(target&&target!==workspaceId?target:null);const targetGroup=canvasGroupTarget(x,y,w);setHoveredSnapZone(!target&&!targetGroup?snapZoneAtClient(x,y):null);if(targetGroup){setCanvasGroupDropId(targetGroup);setSaveTarget(null);setOverTray(false)}else{setCanvasGroupDropId(null);widgetFeedback(x,y,g.type)}}
    const r=tray.current!.getBoundingClientRect();
    const v=scroll.getBoundingClientRect();if(!row&&!activeSnapLayout){if(y>v.bottom-32)scroll.scrollTop+=10;if(y<v.top+32&&y>r.bottom)scroll.scrollTop-=10;
    if(x>v.right-32)scroll.scrollLeft+=10;if(x<v.left+32)scroll.scrollLeft-=10}
  }
  function writeCardPlacement(id:string,p:Placement){const card=document.getElementById('widget-'+id);if(!card)return;card.style.transition='none';card.style.left=`${p.x}px`;card.style.top=`${p.y}px`;card.style.width=`${p.width}px`;card.style.height=`${p.height}px`;card.style.transform='';card.style.transformOrigin='';void card.getBoundingClientRect();card.style.removeProperty('transition')}
  function move(e:PointerEvent<HTMLElement>){pendingMove.current={x:e.clientX,y:e.clientY};if(moveFrame.current||moveTimer.current)return;
    const schedule=()=>{moveTimer.current=null;moveFrame.current=requestAnimationFrame(now=>{moveFrame.current=0;const interval=canvasFrameInterval(canvasFrameRate),wait=interval-(now-lastMoveAt.current);if(lastMoveAt.current&&!isCanvasFrameDue(now,lastMoveAt.current,canvasFrameRate)){moveTimer.current=setTimeout(schedule,wait);return}const point=pendingMove.current;pendingMove.current=null;lastMoveAt.current=now;if(point)applyMove(point.x,point.y)})};schedule();
  }
  function moveHeaderReflection(e:PointerEvent<HTMLElement>){const head=e.currentTarget,rect=head.getBoundingClientRect();if(rect.width<=0||rect.height<=0)return;const x=`${Math.max(0,Math.min(100,(e.clientX-rect.left)/rect.width*100))}%`,y=`${Math.max(0,Math.min(100,(e.clientY-rect.top)/rect.height*100))}%`;head.style.setProperty('--reflect-x',x);head.style.setProperty('--reflect-y',y);const card=head.closest<HTMLElement>('.canvas-card');card?.style.setProperty('--reflect-x',x);card?.style.setProperty('--reflect-y',y)}
  function resetHeaderReflection(e:PointerEvent<HTMLElement>){const head=e.currentTarget;head.style.setProperty('--reflect-x','46%');head.style.setProperty('--reflect-y','34%');const card=head.closest<HTMLElement>('.canvas-card');card?.style.setProperty('--reflect-x','46%');card?.style.setProperty('--reflect-y','34%')}
  function flushMove(x:number,y:number){pendingMove.current=null;if(moveFrame.current)cancelAnimationFrame(moveFrame.current);moveFrame.current=0;if(moveTimer.current)clearTimeout(moveTimer.current);moveTimer.current=null;lastMoveAt.current=0;applyMove(x,y)}
  useEffect(()=>()=>{if(moveFrame.current)cancelAnimationFrame(moveFrame.current);if(moveTimer.current)clearTimeout(moveTimer.current);gestureEndListeners.current?.();gestureEndListeners.current=null},[]);
  function finish(e:Pick<MouseEvent,'clientX'|'clientY'>,cancel=false){const g=gesture.current;if(!g)return;flushMove(e.clientX,e.clientY);const currentWidget=widgets.find(w=>w.id===g.id),canvasTarget=canvasGroupTarget(e.clientX,e.clientY,currentWidget),distance=Math.hypot(e.clientX-g.startX,e.clientY-g.startY);
    // DOM reordering can cancel pointer capture. Raise visually during dragging,
    // then persist stacking after releasing the pointer.
     gesture.current=null;gestureEndListeners.current?.();gestureEndListeners.current=null;setActive(null);setOverTray(false);setSaveTarget(null);setCanvasGroupDropId(null);setWorkspaceDropTarget(null);setHoveredSnapZone(null);
     const workspaceRow=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-workspace-drop-target]'),destination=workspaceRow?.dataset.workspaceDropTarget;
     if(!cancel&&g.mode==='move'&&destination&&destination!==workspaceId&&distance>4){writeCardPlacement(g.id,g.p);if(g.type==='apps')appPanel.finishDrag(g.id);transferWidget(workspaceId,g.id,destination,g.current,g.currentRestorePlacement);return}
    const original=currentWidget?{...currentWidget,placement:g.p,...(g.restorePlacement?{restorePlacement:g.restorePlacement}:{})}:undefined;
    const moved=currentWidget?{...currentWidget,placement:g.current,...(g.currentRestorePlacement?{restorePlacement:g.currentRestorePlacement}:{})}:undefined;
    if(!cancel&&g.mode==='move'&&distance>4&&canvasTarget&&moved){writeCardPlacement(g.id,moved.placement);void saveToGroup(moved,canvasTarget,true);return}
    const target=trayTarget(e.clientX,e.clientY),action=trayDropDecision({source:'widget',widgetType:g.type,...target});
    if(cancel){if(original)writeCardPlacement(g.id,original.placement)}
    else if(g.mode==='move'&&distance>4&&target.insideTray){
     if(action==='remove')remove(g.id,true);
     else if(action==='save'&&original){writeCardPlacement(g.id,original.placement);if(g.type==='apps')appPanel.finishDrag(g.id);void saveWidgetToTray(original).catch(error=>notify(String((error as Error).message??error)))}
     else try{if((action==='create-group'||action==='save-group')&&moved){writeCardPlacement(g.id,moved.placement);const groupId=target.groupTarget?.kind==='existing'?target.groupTarget.groupId:undefined;saveToGroup(moved,groupId,true)}else if(original)writeCardPlacement(g.id,original.placement)}catch(error){notify(String((error as Error).message??error))}
    }else{const snapZone=!cancel&&g.mode==='move'&&distance>4?snapZoneAtClient(e.clientX,e.clientY):null;if(snapZone!==null&&currentWidget&&!currentWidget.minimized&&!(currentWidget.type==='group'&&currentWidget.groupCollapsed)){writeCardPlacement(g.id,g.current);snapWidgetToZone(g.id,snapZone)}else{if(moved){writeCardPlacement(g.id,moved.placement);update(g.id,{placement:moved.placement,...(moved.restorePlacement?{restorePlacement:moved.restorePlacement}:{})})}else writeCardPlacement(g.id,g.p);bringToFront(g.id)}if(g.type==='apps')appPanel.finishDrag(g.id)}
  }
  function key(e:KeyboardEvent<HTMLElement>,w:WidgetInstance,mode:'move'|'resize'){
    const delta:Record<string,[number,number]>={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
    if(mode==='move'&&!canMoveWidget(w))return;
    if(mode==='move'&&w.lockPluginEnabled&&w.locked)return;
    if(e.target!==e.currentTarget||!delta[e.key])return;e.preventDefault();begin();const [x,y]=delta[e.key],step=e.shiftKey?1:10;
      update(w.id,{placement:bounded(w,mode==='move'?translate(w.type,w.placement,x*step,y*step):resize(w.type,w.placement,x*step,y*step))});
  }
  function minimize(w:WidgetInstance){update(w.id,minimizeWidgetInstance(w,extent,height));bringToFront(w.id)}
  function restore(w:WidgetInstance){update(w.id,restoreWidgetInstance(w,extent,height));bringToFront(w.id)}
  function toggleGroup(w:WidgetInstance){update(w.id,toggleGroupCollapsed(w,extent,height))}
  async function saveWidgetToTray(widget:WidgetInstance){
    let reusable=widget;
    if(widget.type==='apps'&&!widget.appKey){
      let source=preparedAppSources.current.get(widget.id);
      if(!source){const attachment=appAttachments[widget.id]??await appPanel.identity(widget.id);if(!attachment)throw new Error(t('appShortcutRequired'));
        const shortcut=await appPanel.prepare(attachment);if(shortcut.kind!=='app'||!shortcut.sourceId)throw new Error(t('appShortcutCreateError'));
        source={appKey:shortcut.sourceId,appName:shortcut.name};preparedAppSources.current.set(widget.id,source);
      }
      reusable={...widget,...source};
    }
    savePresets([presetFromWidget(reusable)],true);
  }
  async function snapshot(id:string,download=false){if(busy)return;setBusy(id);
    try{
      // Raise the chosen card before the native crop so overlapping cards cannot
      // cover its contents. Wait for React and the browser to paint that order.
      bringToFront(id);await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
      const node=document.getElementById('widget-'+id);if(!node)return;
      const blob=await captureWidget(node,!download);if(download && !await downloadCapture(blob,widgetRegistry[widgets.find(w=>w.id===id)!.type].name))return;
      notify(download?t('pngExported'):t('screenshotCopied'));
    }catch(e){notify(String((e as Error).message??e))}finally{setBusy(null)}
  }
  const visibleOrigin=()=>({x:(viewport.current?.scrollLeft??0)+12,y:(viewport.current?.scrollTop??0)+12});
  function trayDragChange(drag:TrayDragPosition|null){setTrayDragging(!!drag);setTrayGhost(drag);setOverCanvas(!!drag&&contains(viewport.current!.getBoundingClientRect(),drag.clientX,drag.clientY))}
  function trayDragDrop({payload,clientX,clientY}:TrayDragPosition){
   if(!workspaceActive||obscured||!contains(viewport.current!.getBoundingClientRect(),clientX,clientY))return;
   const at=canvasPoint(clientX,clientY),width=extent;
   if(payload.kind==='type'){add(payload.type,at,width);return}
   if(payload.kind==='group'){openGroup(payload.id,at,width);return}
   if(payload.kind==='preset'){const preset=presets.find(p=>p.id===payload.id);if(preset)openPreset(preset,at,width);return}
   const group=groups.find(g=>g.id===payload.groupId);if(!group)return;
   if(payload.entryKind==='link'){const link=group.shortcuts.find(s=>s.id===payload.id);if(link)openResource(link,at)}
   else{const entry=group.widgets.find(s=>s.id===payload.id);if(entry)openGroupWidget(entry,at,width)}
  }
  function previewDragOver(e:DragEvent<HTMLDivElement>){
   if(resourceDrop.available||!workspaceActive||obscured)return;
   const types=e.dataTransfer.types;if(!types.some(type=>['Files','text/uri-list','text/plain','text/html'].includes(type)))return;
   e.preventDefault();e.dataTransfer.dropEffect='copy';setExternalDragging(true);
   // Browsers conceal filenames until the drop; Windows supplies typed previews.
   externalFeedback(e.clientX,e.clientY,[{sourceId:null,name:'',kind:types.includes('Files')?'document':'website',extension:''}]);
  }
  function previewDrop(e:DragEvent<HTMLDivElement>){
   if(resourceDrop.available||!workspaceActive||obscured)return;
   e.preventDefault();e.stopPropagation();
   if(e.dataTransfer.files.length){const result=previewFileDrop(Array.from(e.dataTransfer.files));acceptResources(result.entries,e.clientX,e.clientY,result.errors);return}
   const website=droppedWebsite(e.dataTransfer.getData('text/uri-list')||e.dataTransfer.getData('text/plain'),e.dataTransfer.getData('text/html'));
   acceptResources(website?[{sourceId:null,name:website.name,kind:'website',extension:'url',url:website.url}]:[],e.clientX,e.clientY);
  }
  const ghostPayload=trayGhost?.payload;
  const ghostLabel=ghostPayload?.kind==='type'?t('widget_'+ghostPayload.type):ghostPayload?.kind==='preset'?presets.find(p=>p.id===ghostPayload.id)?.name:'Widget';
  function isPresetType(type:WidgetType):type is PresetType{return type!=='group'&&type!=='ai'}
  function trayTypeClick(type:WidgetType){
    type==='apps'?pickApp(undefined,visibleOrigin(),extent):add(type,undefined,extent)
  }
  const widgetCounts=new Map<WidgetType,number>();
  for(const widget of widgets)widgetCounts.set(widget.type,(widgetCounts.get(widget.type)??0)+1);
  return <TrayDragProvider enabled={workspaceActive&&!obscured} onChange={trayDragChange} onDrop={trayDragDrop}><div className={`canvas-system ${active||trayDragging||externalDragging?'widget-gesture':''}`} onDragOverCapture={previewDragOver} onDropCapture={previewDrop} onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))clearDrop()}}>
    <WorkspaceDock trayRef={tray} expanded={widgetTrayVisible&&dockExpanded} onExpandedChange={expanded=>{if(widgetTrayVisible)setDockExpanded(expanded)}} onOpenInstalledApp={openInstalledApp} onEditShortcuts={editTray} onRemoveDrop={overTray} status={overTray?t('releaseTrashHint'):saveTarget?.kind==='saved'?t('releaseSavedHint'):saveTarget?t('releaseGroupHint'):''} shortcuts={<>
      <TrayDragButton className={'tray-widget-button '+(saveTarget?.kind==='group-create'?'tray-save-target':'')} dragPayload={{kind:'type',type:'group'}} data-group-drop-target="create" aria-label={t('createGroupTitle')} title={t('createGroupHelp')} onClick={()=>trayTypeClick('group')}><Icon name="group"/><span>{t('group')}</span></TrayDragButton>
      <GroupTray groups={groups} update={updateGroup} openGroup={id=>openGroup(id,visibleOrigin(),extent)} openLink={link=>openResource(link,visibleOrigin())} openWidget={entry=>openGroupWidget(entry,visibleOrigin(),extent)} edit={editGroup} remove={removeGroup} onContextMenu={(event,id)=>openSavedContextMenu(event,'group',id)} activeDropGroupId={saveTarget?.kind==='group'?saveTarget.id:null}/>
      <PresetTray presets={presets} add={preset=>openPreset(preset,visibleOrigin(),extent)} onContextMenu={(event,id)=>openSavedContextMenu(event,'preset',id)}/>
      </>}/>
    <div className="canvas-view-shell">
    <div className={`canvas-viewport ${overCanvas?'canvas-drop':''} ${activeSnapLayout?'layout-scroll-locked':''}`} ref={viewport} aria-label={t('workspaceCanvas')}>
       <section className="workspace-canvas" aria-label={t('workspaceWidgets')} style={{width:extent,height}}>
         {widgets.map((w,index)=>{const d=widgetRegistry[w.type],Component=d.component,p=bounded(w,placement(w.type,w.placement)),group=w.type==='group'?groups.find(item=>item.id===w.groupId):undefined,groupCollapsed=!w.minimized&&w.type==='group'&&w.groupCollapsed;const count=widgetCounts.get(w.type)??0;const number=w.instanceNumber;const title=w.title||t('widget_'+w.type)+(count>1?' '+number:'');const relaunchToken=relaunchTokens[w.id]??0,nativeWidget=w.type==='apps',clockVisible=w.clockPluginEnabled&&showClockControl(clockPluginMode,clockPluginColors,w.tagColor,clockPluginColorOverrides);return <article id={'widget-'+w.id} key={w.id} data-widget-id={w.id} data-group-drop-target={w.type==='group'&&w.groupId?'canvas':undefined} data-group-id={w.type==='group'?w.groupId??undefined:undefined} className={`card canvas-card widget-${w.type} ${w.minimized?'widget-minimized':''} ${w.lockPluginEnabled&&w.locked?'widget-locked':''} ${groupCollapsed?'group-collapsed':''} ${active===w.id?'gesture-card':''} ${w.type==='group'&&!!w.groupId&&w.groupId===canvasGroupDropId?'group-drop-active':''}`} style={{left:p.x,top:p.y,width:p.width,height:p.height,zIndex:active===w.id?widgets.length+1:index+1}} onContextMenu={event=>{if(event.button!==2||event.ctrlKey!==minimizeModifiers.ctrl||event.altKey!==minimizeModifiers.alt||event.shiftKey!==minimizeModifiers.shift||event.metaKey)return;event.preventDefault();event.stopPropagation();if(!w.minimized)minimize(w)}}>
          {w.minimized?<><button className="widget-minimized-button" data-capture-ignore aria-label={t('restoreWidget').replace('{title}',title)+(w.tagColor?' · '+t('tag_'+w.tagColor)+' '+t('tagLabel'):'')} title={w.lockPluginEnabled&&w.locked?t('unlockOrRestoreWidget').replace('{title}',title):t('doubleClickRestoreWidget').replace('{title}',title)} onPointerDown={e=>start(e,w,'move')} onPointerMove={move} onPointerUp={e=>finish(e)} onPointerCancel={e=>finish(e,true)} onLostPointerCapture={e=>{if(gesture.current)finish(e)}} onKeyDown={e=>key(e,w,'move')} onDoubleClick={e=>{e.stopPropagation();restore(w)}}>{w.type==='apps'&&w.appIconData?<img className="widget-app-icon widget-minimized-icon" src={w.appIconData} alt=""/>:<Icon name={d.icon}/>}{w.tagColor&&<i className="widget-minimized-tag" data-tag-color={w.tagColor} aria-hidden="true"/>}<span>{title}</span></button>{w.lockPluginEnabled&&w.locked&&<button type="button" className="widget-minimized-lock" data-capture-ignore aria-label={t('unlockTitle').replace('{title}',title)} title={t('unlockWidget')} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();update(w.id,{locked:false})}}><Icon name="lock"/></button>}{showWidgetRelaunchAction&&<button type="button" className="widget-minimized-relaunch" data-capture-ignore aria-label={t('relaunchTitle').replace('{title}',title)} aria-invalid={relaunchFailures[w.id]||undefined} title={t('relaunchTitle').replace('{title}',title)+' in place'} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();relaunch(w)}}><Icon name="restart"/></button>}</>:
          <div className="card-head widget-move" tabIndex={0} aria-label={t('moveTitle').replace('{title}',title)} title={t('moveWidgetHint')} onPointerDown={e=>start(e,w,'move')} onPointerMove={e=>{move(e);moveHeaderReflection(e)}} onPointerLeave={resetHeaderReflection} onPointerUp={e=>finish(e)} onPointerCancel={e=>finish(e,true)} onLostPointerCapture={e=>{if(gesture.current)finish(e)}} onKeyDown={e=>key(e,w,'move')}>
            <span className="move-grip" aria-hidden="true">⠿</span>{w.type==='apps'&&w.appIconData?<img className="widget-app-icon" src={w.appIconData} alt=""/>:<Icon name={d.icon}/>}
            {w.type==='group'&&w.groupId?<><GroupHeaderName name={group?.name??''} displayName={group?.name||title} save={name=>updateGroup(w.groupId!,{name})}/><small className="group-widget-count" aria-label={t('collectedWidgetsCount').replace('{count}',String(collectedWidgetCount(group)))} title={t('collectedWidgetsCount').replace('{count}',String(collectedWidgetCount(group)))}>{collectedWidgetCount(group)}</small></>:w.type==='apps'?<GroupHeaderName name={w.title||w.appName||''} displayName={w.title||w.appName||title} save={name=>update(w.id,{title:name})} label={t('appWidgetName')} tooltip={t('renameAppWidgetHint')}/>:<span className="widget-title">{title}</span>}
            {w.type==='files'&&(w.fileKey||w.folderName)&&<small className="resource-badge">{w.fileKey?w.fileKind?.toUpperCase()??'File':'Folder'}</small>}
            <div className="widget-controls" data-capture-ignore>
              <div className="widget-tag-picker">
                {w.tagColor&&<button type="button" className="widget-active-tag" data-tag-color={w.tagColor} aria-label={t('changeTagColor').replace('{color}',t('tag_'+w.tagColor))} title={t('changeTagColorHint')} aria-haspopup="menu" aria-expanded={tagPicker?.id===w.id} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();const position=popupPosition(e.currentTarget.getBoundingClientRect(),238);setPluginPicker(null);setTagPicker(current=>current?.id===w.id?null:{id:w.id,...position})}}><span className="widget-tag-dot"/></button>}
                <button type="button" className="widget-customize-control" aria-label={t('addWidgetAddonTo').replace('{title}',title)} aria-haspopup="menu" aria-expanded={pluginPicker?.id===w.id} title={t('addWidgetAddon')} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();const position=popupPosition(e.currentTarget.getBoundingClientRect(),190);setTagPicker(null);setClockPicker(null);setPluginPicker(current=>current?.id===w.id?null:{id:w.id,...position})}}>+</button>
                {clockVisible&&<button type="button" className="widget-clock-control" aria-label={t('openClockForWidget').replace('{title}',title)} aria-haspopup="dialog" aria-expanded={clockPicker?.id===w.id} title={t('openClockTimer')} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();const card=e.currentTarget.closest<HTMLElement>('.canvas-card');const rect=card?.getBoundingClientRect()??e.currentTarget.getBoundingClientRect();const position=clockPopupPosition(rect,{width:window.innerWidth,height:window.innerHeight});setTagPicker(null);setPluginPicker(null);setClockPicker(current=>current?.id===w.id?null:{id:w.id,...position})}}><Icon name="clock"/></button>}
                {pluginPicker?.id===w.id&&createPortal(<div className="widget-plugin-menu" style={{position:'fixed',top:pluginPicker.top,right:pluginPicker.right}} role="menu" aria-label={t('widgetAddonsFor').replace('{title}',title)}>
                  <button type="button" className="widget-plugin-choice" role="menuitemcheckbox" aria-label={t('addColorTagPlugin')} aria-checked={!!w.tagColor} disabled={!!w.tagColor} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();update(w.id,{tagColor:'blue'});setPluginPicker(null)}}><span className="widget-plugin-dot" aria-hidden="true"/><span>{t('tagColor')}</span><small>{w.tagColor?t('added'):t('add')}</small></button>
                  <button type="button" className="widget-plugin-choice" role="menuitemcheckbox" aria-label={w.clockPluginEnabled?t('removeClockTimerPlugin'):t('addClockTimerPlugin')} aria-checked={w.clockPluginEnabled} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();update(w.id,{clockPluginEnabled:!w.clockPluginEnabled});if(w.clockPluginEnabled)setClockPicker(current=>current?.id===w.id?null:current);setPluginPicker(null)}}><Icon name="clock"/><span>{t('clockAddon')}</span><small>{w.clockPluginEnabled?t('remove'):t('add')}</small></button>
                  <button type="button" className="widget-plugin-choice" role="menuitemcheckbox" aria-label={w.lockPluginEnabled?t('removeLockPlugin'):t('addLockPlugin')} aria-checked={w.lockPluginEnabled} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();update(w.id,setWidgetLock(w,!w.lockPluginEnabled));setPluginPicker(null)}}><Icon name="lock"/><span>{t('lockWidgetAction')}</span><small>{w.lockPluginEnabled?t('remove'):t('add')}</small></button>
                </div>,document.body)}
                {clockPicker?.id===w.id&&clockVisible&&workspaceActive&&createPortal(<div className="widget-clock-popover" role="dialog" aria-label={t('clockTimerForWidget').replace('{title}',title)} style={{position:'fixed',top:clockPicker.top,right:clockPicker.right,maxHeight:clockPicker.maxHeight}} onPointerDown={e=>e.stopPropagation()}><button type="button" className="widget-clock-close" aria-label={t('closeClockTimer')} onClick={()=>setClockPicker(null)}>×</button><TimerWidget widget={w} variant="clock" workspaceActive={workspaceActive} update={patch=>update(w.id,patch)} notify={notify}/></div>,document.body)}
                {tagPicker?.id===w.id&&createPortal(<div className="widget-tag-palette" style={{position:'fixed',top:tagPicker.top,right:tagPicker.right}} role="menu" aria-label={t('colorTagForWidget').replace('{title}',title)}>
                  {widgetTagColors.map(color=><button key={color} type="button" role="menuitemradio" aria-label={t('setTagColor').replace('{color}',t('tag_'+color))} aria-checked={w.tagColor===color} className="widget-tag-choice" data-tag-color={color} title={t('tag_'+color)} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();update(w.id,{tagColor:color});setTagPicker(null)}}><span className="widget-tag-dot"/></button>)}
                  <button type="button" role="menuitemradio" aria-label={t('removeColorTag')} aria-checked={!w.tagColor} className="widget-tag-choice widget-tag-none" onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();update(w.id,{tagColor:null});setTagPicker(null)}}>×</button>
                </div>,document.body)}
              </div>
              {w.type==='apps'&&showAppAttachAction&&<button data-capture-ignore aria-label={t('attachOpenAppTo').replace('{title}',title)} title={t('attachOpenApp')} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();pickApp(w.id,visibleOrigin(),extent)}}>↗</button>}
              {w.type==='apps'&&showAppSaveAction&&w.appKey&&<button data-capture-ignore aria-label={t('saveWidgetToTray').replace('{title}',title)} title={t('saveAppToTray')} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();saveApp(w.id)}}>↓</button>}
              {w.type==='apps'&&showAppDetachAction&&w.appPanelOpen&&<button data-capture-ignore aria-label={t('detachAppFrom').replace('{title}',title)} title={t('detachAppToDesktop')} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();update(w.id,{appPanelOpen:false});notify(t('appReleased'))}}>⏏</button>}
              {w.lockPluginEnabled&&<button type="button" className="widget-lock-toggle" data-capture-ignore aria-label={w.locked?t('unlockTitle').replace('{title}',title):t('lockTitle').replace('{title}',title)} title={w.locked?t('unlockWidgetToMove'):t('lockWidgetPosition')} aria-pressed={w.locked} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();update(w.id,{locked:!w.locked})}}><Icon name="lock"/></button>}
              {showWidgetRelaunchAction&&<button type="button" className="widget-relaunch-control" data-capture-ignore aria-label={t('relaunchTitle').replace('{title}',title)} aria-invalid={relaunchFailures[w.id]||undefined} title={t('relaunchTitle').replace('{title}',title)+' in place'} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();relaunch(w)}}><Icon name="restart"/></button>}
              {showScreenshotControl(screenshotPluginMode??'global',screenshotPluginColors,w.tagColor,screenshotPluginColorOverrides)&&<button className={`widget-snapshot-control ${groupCollapsed?'group-hidden-header-action':''}`} disabled={busy!==null} aria-label={t('copyScreenshotWidget').replace('{title}',title)} title={t('copyScreenshot')} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();void snapshot(w.id)}}><Icon name="camera"/></button>}
              {showWidgetExportPngAction&&w.type!=='apps'&&<button className={`widget-export-control ${groupCollapsed?'group-hidden-header-action':''}`} disabled={busy!==null} aria-label={t('exportWidgetPng').replace('{title}',title)} title={t('exportPng')} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();void snapshot(w.id,true)}}>↓</button>}
              <button aria-label={t('minimizeTitle').replace('{title}',title)} title={t('minimizeWidget')} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();minimize(w)}}>−</button>
              <button aria-label={t('removeWidgetTitle').replace('{title}',title)} title={!canCloseWidget(w)?t('unlockBeforeRemoving'):t('removeThisInstance')} disabled={!canCloseWidget(w)} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();remove(w.id)}}>×</button>
              {w.type==='group'&&w.groupId&&<button type="button" className="group-collapse-toggle" data-capture-ignore aria-label={groupCollapsed?t('expandGroup'):t('collapseGroup')} title={groupCollapsed?t('expandGroup'):t('collapseGroup')} aria-expanded={!groupCollapsed} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();toggleGroup(w)}}><Icon name="chevronRight"/></button>}
            </div>
          </div>}
          <div className="widget-content" aria-hidden={w.minimized}>{startupDeferredIds.has(w.id)?<div className="widget-startup-waiting"><Icon name={d.icon}/><p>{t('waitManualRelaunch')}</p><button type="button" className="primary" data-capture-ignore onClick={()=>relaunch(w)}>{t('relaunchTitle').replace('{title}',title)}</button></div>:<Component key={nativeWidget?w.id:`${w.id}:${relaunchToken}`} widget={w} relaunchToken={relaunchToken} onRelaunchStatus={failed=>reportRelaunchFailure(w.id,failed)} group={groups.find(g=>g.id===w.groupId)} updateGroup={w.groupId?patch=>updateGroup(w.groupId!,patch):undefined} openGroupWidget={entry=>openGroupWidget(entry,visibleOrigin(),extent)} update={patch=>update(w.id,patch)} obscured={obscured||!!active||trayDragging||externalDragging||w.minimized} workspaceActive={workspaceActive} notify={notify} appOpenResult={appOpenResult} openResource={link=>openResource(link,visibleOrigin())} pickApp={()=>pickApp(w.id,visibleOrigin(),extent)} saveApp={()=>saveApp(w.id)} appAttachment={appAttachments[w.id]} appAttachmentHandled={()=>{const attachment=appAttachments[w.id];if(attachment)appAttachmentHandled(w.id,attachment)}} widgetPluginContext={{relaunchPluginStatus:widgetRelaunchPluginStatus,globalMode:widgetRelaunchMode,colors:widgetRelaunchColors,setGlobalMode:setRelaunchMode,setColorMode:setRelaunchColor,screenshotMode:screenshotPluginMode,screenshotColors:screenshotPluginColors,screenshotColorOverrides:screenshotPluginColorOverrides,setScreenshotMode,setScreenshotColor,setScreenshotColorOverride,clockMode:clockPluginMode,clockColors:clockPluginColors,clockColorOverrides:clockPluginColorOverrides,setClockMode:setClockPluginMode,setClockColor:setClockPluginColor,setClockColorOverride:setClockPluginColorOverride}}/>}</div>
           {!w.minimized&&<button className="widget-resize" data-capture-ignore aria-label={t('resizeTitle').replace('{title}',title)} title={t('resizeWidgetHint')} onPointerDown={e=>start(e,w,'resize')} onPointerMove={move} onPointerUp={e=>finish(e)} onPointerCancel={e=>finish(e,true)} onLostPointerCapture={e=>{if(gesture.current)finish(e)}} onKeyDown={e=>key(e,w,'resize')}><span aria-hidden="true">◢</span></button>}
         </article>})}
         {!widgets.length&&<div className="canvas-empty"><Icon name="arrange"/><h2>{t('canvasEmptyTitle')}</h2><p>{t('canvasEmptyHint')}</p></div>}
       </section>
     </div>
     {layoutMode&&<SnapLayoutOverlay mode={layoutMode} assigned={snapAssignments} hoveredZone={hoveredSnapZone} availableWidgets={widgets} widgetName={widget=>widget.title||t('widget_'+widget.type)} chooseLayout={setLayoutMode} chooseWidget={chooseSnapAssistWidget} close={()=>setLayoutMode(null)}/>}
     {overviewVisible&&!layoutMode&&<svg className="canvas-overview" style={{width:Math.min(160,Math.max(96,viewportWidth-16))}} role="img" aria-label={t('workspaceOverviewMap')} viewBox={`0 0 ${Math.max(extent,1)} ${Math.max(height,1)}`} preserveAspectRatio="none"><title>{t('workspaceOverview')}</title><rect className="overview-canvas" x="0" y="0" width={extent} height={height}/>{widgets.map(w=>{const p=bounded(w,w.placement);return <rect key={w.id} className="overview-widget" x={p.x} y={p.y} width={p.width} height={p.height} rx="14"/>})}<rect ref={overviewViewportRef} className="overview-viewport" x="0" y="0" width={viewportWidth} height={viewportHeight}/></svg>}
     </div>
    {trayGhost&&<div className="tray-drag-ghost" aria-hidden="true" style={{left:trayGhost.clientX+14,top:trayGhost.clientY+14}}>＋ {ghostLabel}</div>}
    {savedMenu&&<SavedItemContextMenu target={savedMenu} close={closeSavedMenu} rename={()=>savedMenu.kind==='preset'?renamePreset(savedMenu.id):renameGroup(savedMenu.id)} remove={()=>savedMenu.kind==='preset'?removePreset(savedMenu.id):removeGroup(savedMenu.id)}/>}
  </div></TrayDragProvider>;
}
