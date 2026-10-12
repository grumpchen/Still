import {useCallback,useEffect,useRef,useState,type PointerEvent,type KeyboardEvent,type DragEvent,type MouseEvent as ReactMouseEvent} from 'react';
import {createPortal} from 'react-dom';
import {Icon} from './Icon.tsx';
import {widgetRegistry} from './widgets.tsx';
import {widgetTypes,widgetTagColors,type WidgetInstance,type WidgetType,type SavedGroup,type GroupWidgetEntry,type WidgetTagColor,minimizeWidgetInstance,moveMinimizedWidgetInstance,restoreWidgetInstance,toggleGroupCollapsed,collectedWidgetCount,constrainGroupCollapsedPlacement} from './domain/workspaces.ts';
import {placement,translate,resize,type Placement,canvasExtent,canvasHeight,constrainPlacement} from './domain/layout.ts';
import {captureWidget,downloadCapture} from './platform/capture.ts';
import {toggleLecture} from './domain/lecture.ts';
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
import {chromePanel} from './platform/chromePanel.ts';
import {appPanel} from './platform/appPanel.ts';
import type {WidgetRelaunchMode,WidgetRelaunchPluginStatus} from './domain/widgetRelaunch.ts';
import {showScreenshotControl,type ScreenshotPluginMode} from './domain/screenshotPlugin.ts';
interface DropProps {savePresets:(presets:WidgetPreset[],preserveUndo?:boolean)=>void;openDropped:(presets:WidgetPreset[],at:{x:number;y:number},width:number)=>void}
interface AppPickerProps {pickApp:(id?:string,at?:{x:number;y:number},width?:number)=>void;saveApp:(id:string)=>void;appAttachments:Record<string,import('./platform/appPanel.ts').AppAttachment>;appAttachmentHandled:(id:string,attachment:import('./platform/appPanel.ts').AppAttachment)=>void}
interface Props {workspaceId:string;transferWidget:(sourceWorkspaceId:string,widgetId:string,destinationId:string)=>void;setWorkspaceDropTarget:(id:string|null)=>void;openAppsDialog:()=>void;editTray:()=>void;widgetTrayVisible:boolean;toggleWidgetTray:()=>void;presets:WidgetPreset[];openPreset:(preset:WidgetPreset,at?:{x:number;y:number},width?:number)=>void;editPreset:(type:PresetType,preset?:WidgetPreset)=>void;removePreset:(id:string)=>void;renamePreset:(id:string)=>void;renameGroup:(id:string)=>void;widgets:WidgetInstance[];groups:SavedGroup[];updateGroup:(id:string,patch:Partial<Omit<SavedGroup,'id'>>)=>void;saveToGroup:(widget:WidgetInstance,groupId?:string,preserveUndo?:boolean)=>void;openGroup:(id:string,at?:{x:number;y:number},width?:number)=>void;editGroup:(id:string,mode:GroupEditMode)=>void;removeGroup:(id:string)=>void;openGroupWidget:(entry:GroupWidgetEntry,at?:{x:number;y:number},width?:number)=>void; update:(id:string,patch:Partial<WidgetInstance>)=>void; add:(type:WidgetType,at?:{x:number;y:number},width?:number)=>void; remove:(id:string,preserveUndo?:boolean)=>void; begin:()=>void; bringToFront:(id:string)=>void; notify:(s:string)=>void; obscured:boolean; workspaceActive?:boolean; openResource:(link:WebShortcut,at:{x:number;y:number})=>void;startupDeferredIds?:ReadonlySet<string>;startupRelaunch?:(id:string)=>void;widgetRelaunchPluginStatus?:WidgetRelaunchPluginStatus;widgetRelaunchMode?:WidgetRelaunchMode;widgetRelaunchColors?:Partial<Record<WidgetTagColor,WidgetRelaunchMode>>;setRelaunchMode?:(mode:WidgetRelaunchMode)=>void;setRelaunchColor?:(color:WidgetTagColor,mode:WidgetRelaunchMode|null)=>void;screenshotPluginMode?:ScreenshotPluginMode;screenshotPluginColors?:WidgetTagColor[];setScreenshotMode?:(mode:ScreenshotPluginMode)=>void;setScreenshotColor?:(color:WidgetTagColor,enabled:boolean)=>void;showAppAttachAction?:boolean;showAppDetachAction?:boolean;showAppSaveAction?:boolean;showWidgetRelaunchAction?:boolean;showWidgetExportPngAction?:boolean}
type Gesture={id:string;type:WidgetType;mode:'move'|'resize';startX:number;startY:number;p:Placement;scrollX:number;scrollY:number};
type SaveCue={kind:'saved'}|{kind:'widget';type:WidgetType}|{kind:'group-create'}|{kind:'group';id:string};
export default function WorkspaceCanvas({workspaceId,transferWidget,setWorkspaceDropTarget,openAppsDialog,editTray,widgetTrayVisible,toggleWidgetTray,presets,openPreset,editPreset,removePreset,renamePreset,savePresets,openDropped,renameGroup,widgets,groups,updateGroup,saveToGroup,openGroup,editGroup,removeGroup,openGroupWidget,update,add,remove,begin,bringToFront,notify,obscured,workspaceActive=true,openResource,pickApp,saveApp,appAttachments,appAttachmentHandled,startupDeferredIds=new Set(),startupRelaunch=()=>{},widgetRelaunchPluginStatus='enabled',widgetRelaunchMode='automatic',widgetRelaunchColors={},setRelaunchMode=()=>{},setRelaunchColor=()=>{},screenshotPluginMode='global',screenshotPluginColors=[],setScreenshotMode=()=>{},setScreenshotColor=()=>{},showAppAttachAction=false,showAppDetachAction=false,showAppSaveAction=false,showWidgetRelaunchAction=true,showWidgetExportPngAction=true}:Props&DropProps&AppPickerProps){
  const viewport=useRef<HTMLDivElement>(null),tray=useRef<HTMLDivElement>(null),trayItems=useRef<HTMLDivElement>(null),gesture=useRef<Gesture|null>(null);
  const preparedAppSources=useRef(new Map<string,{appKey:string;appName:string}>());
  const previousPresetIds=useRef(new Set(presets.map(preset=>preset.id)));
  const [active,setActive]=useState<string|null>(null),[trayDragging,setTrayDragging]=useState(false),[overTray,setOverTray]=useState(false),[overCanvas,setOverCanvas]=useState(false),[busy,setBusy]=useState<string|null>(null),[tagPicker,setTagPicker]=useState<{id:string;top:number;right:number}|null>(null),[pluginPicker,setPluginPicker]=useState<{id:string;top:number;right:number}|null>(null);
  const [relaunchTokens,setRelaunchTokens]=useState<Record<string,number>>({}),[relaunchFailures,setRelaunchFailures]=useState<Record<string,boolean>>({});
  const [viewportWidth,setViewportWidth]=useState(0),[viewportHeight,setViewportHeight]=useState(0);
  const overviewViewportRef=useRef<SVGRectElement>(null);
  const [saveTarget,setSaveTarget]=useState<SaveCue|null>(null),[canvasGroupDropId,setCanvasGroupDropId]=useState<string|null>(null),[externalDragging,setExternalDragging]=useState(false),[trayGhost,setTrayGhost]=useState<TrayDragPosition|null>(null);
  const [savedMenu,setSavedMenu]=useState<SavedItemMenuTarget|null>(null);
  const closeSavedMenu=useCallback(()=>setSavedMenu(null),[]);
  function popupPosition(rect:DOMRect,width:number){return{top:Math.max(4,rect.top-40),right:Math.max(4,Math.min(window.innerWidth-rect.right,window.innerWidth-width-4))}}
  const popupKind=tagPicker?'tag':pluginPicker?'plugin':null,popupWidgetId=tagPicker?.id??pluginPicker?.id;
  useEffect(()=>{
   if(!popupKind||!popupWidgetId)return;
   const card=document.querySelector<HTMLElement>(`[data-widget-id="${popupWidgetId}"]`),anchor=card?.querySelector<HTMLElement>(popupKind==='tag'?'.widget-active-tag':'.widget-customize-control');
   if(!card||!anchor)return;
   const width=popupKind==='tag'?238:190;
   const reposition=()=>{const position=popupPosition(anchor.getBoundingClientRect(),width);if(popupKind==='tag')setTagPicker(current=>current?.id!==popupWidgetId||current.top===position.top&&current.right===position.right?current:{id:popupWidgetId,...position});else setPluginPicker(current=>current?.id!==popupWidgetId||current.top===position.top&&current.right===position.right?current:{id:popupWidgetId,...position})};
   const mutations=new MutationObserver(reposition),sizes=new ResizeObserver(reposition),viewport=card.closest('.canvas-viewport');
   mutations.observe(card,{attributes:true,attributeFilter:['style']});sizes.observe(card);sizes.observe(anchor);if(viewport)sizes.observe(viewport);
   window.addEventListener('resize',reposition);window.addEventListener('scroll',reposition,true);reposition();
   return()=>{mutations.disconnect();sizes.disconnect();window.removeEventListener('resize',reposition);window.removeEventListener('scroll',reposition,true)};
  },[popupKind,popupWidgetId]);
  useEffect(()=>{
   const added=presets.some(preset=>!previousPresetIds.current.has(preset.id));
   previousPresetIds.current=new Set(presets.map(preset=>preset.id));
   if(!added)return;
   const frame=requestAnimationFrame(()=>{const items=trayItems.current;if(items)items.scrollLeft=Math.max(0,items.scrollWidth-items.clientWidth)});
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
  function widgetFeedback(x:number,y:number,type:WidgetType){const target=trayTarget(x,y),action=trayDropDecision({source:'widget',widgetType:type,...target});setSaveTarget(cueFor(action,target));setOverTray(action==='remove');return action}
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
   try{const saved=accepted.map(presetForDroppedResource);if(saved.length){if(inCanvas)openDropped(saved,canvasPoint(x,y),extent);else savePresets(saved)}else notify(errors[0]??'Drop on Saved + to save, or on the workspace to add a widget.');if(saved.length&&errors.length)notify('Added '+saved.length+' shortcut(s). '+errors[0])}catch(e){notify(String((e as Error).message??e))}finally{clearDrop()}
  }
  nativeHandler.current=event=>{
   if(!workspaceActive||obscured)return;
   if(event.phase==='leave'){clearDrop();return}
   const p=event.position;if(!p)return;
   if(event.phase==='drop'){acceptResources(event.entries,p.x,p.y,event.errors);return}
   if(event.phase==='enter')externalEntries.current=event.entries;
   setExternalDragging(true);externalFeedback(p.x,p.y,externalEntries.current);
  };
  useEffect(()=>{if(!resourceDrop.available)return;let disposed=false,stop:(()=>void)|undefined;void resourceDrop.subscribe(event=>{if(!disposed)nativeHandler.current(event)}).then(unlisten=>{if(disposed)unlisten();else stop=unlisten}).catch(()=>notify('File drop handling could not start. Restart Still to try again.'));return()=>{disposed=true;stop?.()}},[]);
  useEffect(()=>{if(!workspaceActive||obscured)clearDrop()},[workspaceActive,obscured]);
  const extent=canvasExtent(viewportWidth,widgets);
  const height=canvasHeight(viewportHeight,widgets);
  // Keep vertical space equal to the viewport; horizontal workspace extension remains available.
  function updateOverviewViewport(){const node=viewport.current,marker=overviewViewportRef.current;if(!node||!marker)return;marker.setAttribute('x',String(node.scrollLeft));marker.setAttribute('y',String(node.scrollTop));marker.setAttribute('width',String(node.clientWidth));marker.setAttribute('height',String(node.clientHeight))}
  useEffect(()=>{const node=viewport.current;if(!node)return;const measure=()=>{setViewportWidth(node.clientWidth);setViewportHeight(node.clientHeight);updateOverviewViewport()};measure();const observer=new ResizeObserver(measure);observer.observe(node);node.addEventListener('scroll',updateOverviewViewport,{passive:true});return()=>{observer.disconnect();node.removeEventListener('scroll',updateOverviewViewport)}},[]);
  useEffect(()=>{updateOverviewViewport()},[extent,height,viewportWidth,viewportHeight]);
  function bounded(w:WidgetInstance,p:Placement){return w.minimized?moveMinimizedWidgetInstance(w,{x:p.x,y:p.y},extent,height).placement:w.type==='group'&&w.groupCollapsed?constrainGroupCollapsedPlacement(p,extent,height):constrainPlacement(w.type,p,extent,{width:w.appPanelOpen?w.appMinWidth:undefined,height:w.appPanelOpen?w.appMinHeight:undefined},height)}
  useEffect(()=>{if(!workspaceActive||viewportWidth<=0||viewportHeight<=0)return;for(const w of widgets){if(w.minimized){const moved=moveMinimizedWidgetInstance(w,{x:w.placement.x,y:w.placement.y},extent,height);if(JSON.stringify(moved.placement)!==JSON.stringify(w.placement)||JSON.stringify(moved.restorePlacement)!==JSON.stringify(w.restorePlacement))update(w.id,{placement:moved.placement,restorePlacement:moved.restorePlacement})}else{const p=bounded(w,w.placement);if(p.x!==w.placement.x||p.y!==w.placement.y||p.width!==w.placement.width||p.height!==w.placement.height)update(w.id,{placement:p})}}},[workspaceActive,viewportWidth,viewportHeight,extent,height,widgets,update]);
  function lecture(w:WidgetInstance){const v=viewport.current;if(!v)return;begin();const next=toggleLecture(w.placement,w.lectureRestore,v.clientWidth,v.clientHeight,v.scrollLeft,v.scrollTop);update(w.id,{...next,placement:bounded(w,next.placement)});bringToFront(w.id);}
  function reportRelaunchFailure(id:string,failed:boolean){setRelaunchFailures(current=>{if(!!current[id]===failed)return current;const next={...current};if(failed)next[id]=true;else delete next[id];return next})}
  function relaunch(w:WidgetInstance){reportRelaunchFailure(w.id,false);if(startupDeferredIds.has(w.id)){startupRelaunch(w.id);return}setRelaunchTokens(current=>({...current,[w.id]:(current[w.id]??0)+1}))}
  function start(e:PointerEvent<HTMLElement>,w:WidgetInstance,mode:'move'|'resize'){
    if(e.button!==0 || obscured || (mode==='move'&&!w.minimized&&(e.target as HTMLElement).closest('button')))return;
    if(!w.minimized)e.preventDefault();
    // Native panels are separate top-level HWNDs, so DOM iframe pointer-events
    // cannot keep them from taking the mouse during a canvas drag. Queue the
    // native hide before React's drag-state render and its later present call.
    if(mode==='move'&&!w.minimized){const suspend=w.type==='browser'&&chromePanel.available?chromePanel.suspendForDrag(w.id):w.type==='apps'&&appPanel.available?appPanel.suspendForDrag(w.id):undefined;if(suspend)void suspend.catch(error=>notify('Native panel could not be suspended for dragging: '+String(error)))}
    begin();e.currentTarget.setPointerCapture(e.pointerId);
    gesture.current={id:w.id,type:w.type,mode,startX:e.clientX,startY:e.clientY,p:w.placement,scrollX:viewport.current?.scrollLeft??0,scrollY:viewport.current?.scrollTop??0};setActive(w.id);
  }
  function move(e:PointerEvent<HTMLElement>){const g=gesture.current;if(!g)return;
    const scroll=viewport.current!, dx=e.clientX-g.startX+scroll.scrollLeft-g.scrollX,dy=e.clientY-g.startY+scroll.scrollTop-g.scrollY;
    const row=g.mode==='move'?document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-workspace-drop-target]'):null;
    const w=widgets.find(item=>item.id===g.id);if(w&&!row){if(w.minimized&&g.mode==='move'){const moved=moveMinimizedWidgetInstance(w,{x:g.p.x+dx,y:g.p.y+dy},extent,height);update(g.id,{placement:moved.placement,restorePlacement:moved.restorePlacement})}else update(g.id,{placement:bounded(w,g.mode==='move'?translate(g.type,g.p,dx,dy):resize(g.type,g.p,dx,dy))})}
    if(g.mode==='move'){const target=row?.dataset.workspaceDropTarget??null;setWorkspaceDropTarget(target&&target!==workspaceId?target:null);const targetGroup=canvasGroupTarget(e.clientX,e.clientY,w);if(targetGroup){setCanvasGroupDropId(targetGroup);setSaveTarget(null);setOverTray(false)}else{setCanvasGroupDropId(null);widgetFeedback(e.clientX,e.clientY,g.type)}}
    const r=tray.current!.getBoundingClientRect();
    const v=scroll.getBoundingClientRect();if(!row){if(e.clientY>v.bottom-32)scroll.scrollTop+=10;if(e.clientY<v.top+32&&e.clientY>r.bottom)scroll.scrollTop-=10;
    if(e.clientX>v.right-32)scroll.scrollLeft+=10;if(e.clientX<v.left+32)scroll.scrollLeft-=10}
  }
  function finish(e:PointerEvent<HTMLElement>,cancel=false){const g=gesture.current;if(!g)return;const r=tray.current!.getBoundingClientRect(),currentWidget=widgets.find(w=>w.id===g.id),canvasTarget=canvasGroupTarget(e.clientX,e.clientY,currentWidget),distance=Math.hypot(e.clientX-g.startX,e.clientY-g.startY);
    // DOM reordering can cancel pointer capture. Raise visually during dragging,
    // then persist stacking after releasing the pointer.
     gesture.current=null;setActive(null);setOverTray(false);setSaveTarget(null);setCanvasGroupDropId(null);setWorkspaceDropTarget(null);
     const workspaceRow=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-workspace-drop-target]'),destination=workspaceRow?.dataset.workspaceDropTarget;
     if(!cancel&&g.mode==='move'&&destination&&destination!==workspaceId&&distance>4){transferWidget(workspaceId,g.id,destination);return}
    const original=currentWidget?(currentWidget.minimized?moveMinimizedWidgetInstance(currentWidget,{x:g.p.x,y:g.p.y},extent,height):{...currentWidget,placement:g.p}):undefined;
    if(!cancel&&g.mode==='move'&&distance>4&&canvasTarget&&original){void saveToGroup(original,canvasTarget,true);return}
    const target=trayTarget(e.clientX,e.clientY),action=trayDropDecision({source:'widget',widgetType:g.type,...target});
    if(cancel){if(original)update(g.id,{placement:original.placement,restorePlacement:original.restorePlacement})}
    else if(g.mode==='move'&&distance>4&&target.insideTray){
     if(original)update(g.id,{placement:original.placement,restorePlacement:original.restorePlacement});
     if(action==='remove')remove(g.id,true);
     else if(action==='save'&&original)void saveWidgetToTray(original).catch(error=>notify(String((error as Error).message??error)));
     else try{if((action==='create-group'||action==='save-group')&&original){const groupId=target.groupTarget?.kind==='existing'?target.groupTarget.groupId:undefined;saveToGroup(original,groupId,true)}}catch(error){notify(String((error as Error).message??error))}
    }else bringToFront(g.id);
  }
  function key(e:KeyboardEvent<HTMLElement>,w:WidgetInstance,mode:'move'|'resize'){
    const delta:Record<string,[number,number]>={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
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
      if(!source){const attachment=appAttachments[widget.id]??await appPanel.identity(widget.id);if(!attachment)throw new Error('Attach an application shortcut before saving this Apps widget.');
        const shortcut=await appPanel.prepare(attachment);if(shortcut.kind!=='app'||!shortcut.sourceId)throw new Error('Windows could not create a reusable shortcut for this app.');
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
      notify(download?'PNG exported. Attach it to ChatGPT.':'Widget image copied. Paste into ChatGPT with Ctrl+V.');
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
  const ghostLabel=ghostPayload?.kind==='type'?widgetRegistry[ghostPayload.type].name:ghostPayload?.kind==='preset'?presets.find(p=>p.id===ghostPayload.id)?.name:'Widget';
  function isPresetType(type:WidgetType):type is PresetType{return type!=='group'&&type!=='ai'}
  function trayTypeClick(type:WidgetType){
    type==='apps'?pickApp(undefined,visibleOrigin(),extent):add(type,undefined,extent)
  }
  return <TrayDragProvider enabled={workspaceActive&&!obscured} onChange={trayDragChange} onDrop={trayDragDrop}><div className={`canvas-system ${active||trayDragging||externalDragging?'widget-gesture':''}`} onDragOverCapture={previewDragOver} onDropCapture={previewDrop} onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))clearDrop()}}>
    <div className="widget-tray-shell"><div id="workspace-tray" ref={tray} role="group" className={`widget-tray ${overTray?'tray-remove':''} ${saveTarget?'tray-saving':''}`} aria-label="Widget tray" aria-describedby="widget-tray-help">
     <div className="tray-main-row">
      <span className="tray-status" role="status">{overTray?'Release on Trash to remove':saveTarget?.kind==='saved'?'Release on Saved + to copy':saveTarget?'Release on Group to collect':''}</span>
      <div className="tray-items" ref={trayItems}>
       <TrayDragButton className={'tray-widget-button '+(saveTarget?.kind==='group-create'?'tray-save-target':'')} dragPayload={{kind:'type',type:'group'}} data-group-drop-target="create" aria-label="Create Group" title="Click to create Group · drop a widget to collect into a new Group" onClick={()=>trayTypeClick('group')}><Icon name="group"/><span>Group</span></TrayDragButton>
       <GroupTray groups={groups} update={updateGroup} openGroup={id=>openGroup(id,visibleOrigin(),extent)} openLink={link=>openResource(link,visibleOrigin())} openWidget={entry=>openGroupWidget(entry,visibleOrigin(),extent)} edit={editGroup} remove={removeGroup} onContextMenu={(event,id)=>openSavedContextMenu(event,'group',id)} activeDropGroupId={saveTarget?.kind==='group'?saveTarget.id:null}/>
       <PresetTray presets={presets} add={preset=>openPreset(preset,visibleOrigin(),extent)} onContextMenu={(event,id)=>openSavedContextMenu(event,'preset',id)}/>
       <button className={'tray-control saved-plus '+(saveTarget?.kind==='saved'?'tray-save-target':'')} data-saved-target="" aria-label="Saved +: copy a widget here or edit saved shortcuts" title="Saved + · drag to copy · click to edit" onClick={editTray}>+</button>
      </div>
      <button className="tray-control" aria-label="Edit widget tray" title="Edit widget tray" onClick={editTray}><Icon name="edit"/></button>
      <button className={'tray-control tray-trash '+(overTray?'trash-active':'')} data-trash-target="" aria-label="Remove a widget" title="Trash · drop to remove · click for accessible removal" onClick={editTray}><Icon name="trash"/></button>
     </div>
     <span id="widget-tray-help" className="tray-help-text">Saved + copies a reusable shortcut and keeps the open widget. Group collects the original widget. Trash removes only the dragged widget. Edit contains widget and group management actions.</span></div><button className="tray-edge-toggle" aria-label={widgetTrayVisible?"Hide widget tray":"Show widget tray"} title={widgetTrayVisible?"Hide widget tray":"Show widget tray"} aria-expanded={widgetTrayVisible} aria-controls="workspace-tray" onClick={toggleWidgetTray}><Icon name={widgetTrayVisible?"chevronUp":"chevronDown"}/></button></div>
    <div className="canvas-view-shell">
    <div className={`canvas-viewport ${overCanvas?'canvas-drop':''}`} ref={viewport} aria-label="Workspace canvas">
       <section className="workspace-canvas" aria-label="Workspace widgets" style={{width:extent,height}}>
         {widgets.map((w,index)=>{const d=widgetRegistry[w.type],Component=d.component,p=bounded(w,placement(w.type,w.placement)),group=w.type==='group'?groups.find(item=>item.id===w.groupId):undefined,groupCollapsed=!w.minimized&&w.type==='group'&&w.groupCollapsed;const count=widgets.filter(i=>i.type===w.type).length;const number=w.instanceNumber;const title=w.title||d.name+(count>1?' '+number:'');const relaunchToken=relaunchTokens[w.id]??0,nativeWidget=w.type==='apps'||w.type==='browser';return <article id={'widget-'+w.id} key={w.id} data-widget-id={w.id} data-group-drop-target={w.type==='group'&&w.groupId?'canvas':undefined} data-group-id={w.type==='group'?w.groupId??undefined:undefined} className={`card canvas-card widget-${w.type} ${w.minimized?'widget-minimized':''} ${groupCollapsed?'group-collapsed':''} ${active===w.id?'gesture-card':''} ${w.type==='group'&&!!w.groupId&&w.groupId===canvasGroupDropId?'group-drop-active':''}`} style={{left:p.x,top:p.y,width:p.width,height:p.height,zIndex:active===w.id?widgets.length+1:index+1}}>
          {w.minimized?<><button className="widget-minimized-button" data-capture-ignore aria-label={'Restore '+title} title={'Double-click to restore '+title} onPointerDown={e=>start(e,w,'move')} onPointerMove={move} onPointerUp={e=>finish(e)} onPointerCancel={e=>finish(e,true)} onLostPointerCapture={e=>{if(gesture.current)finish(e,true)}} onKeyDown={e=>key(e,w,'move')} onDoubleClick={e=>{e.stopPropagation();restore(w)}}>{w.type==='apps'&&w.appIconData?<img className="widget-app-icon widget-minimized-icon" src={w.appIconData} alt=""/>:<Icon name={d.icon}/>}<span>{title}</span></button>{showWidgetRelaunchAction&&<button type="button" className="widget-minimized-relaunch" data-capture-ignore aria-label={'Relaunch '+title} aria-invalid={relaunchFailures[w.id]||undefined} title={'Relaunch '+title+' in place'} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();relaunch(w)}}><Icon name="restart"/></button>}</>:
          <div className="card-head widget-move" tabIndex={0} aria-label={'Move '+title} title="Drag to move · arrow keys move · Shift for 1px" onPointerDown={e=>start(e,w,'move')} onPointerMove={move} onPointerUp={e=>finish(e)} onPointerCancel={e=>finish(e,true)} onLostPointerCapture={e=>{if(gesture.current)finish(e,true)}} onKeyDown={e=>key(e,w,'move')}>
            <span className="move-grip" aria-hidden="true">⠿</span>{w.type==='apps'&&w.appIconData?<img className="widget-app-icon" src={w.appIconData} alt=""/>:<Icon name={d.icon}/>}
            {w.type==='group'&&w.groupId?<><GroupHeaderName name={group?.name??''} displayName={group?.name||title} save={name=>updateGroup(w.groupId!,{name})}/><small className="group-widget-count" aria-label={`${collectedWidgetCount(group)} collected widgets`} title={`${collectedWidgetCount(group)} collected widgets`}>{collectedWidgetCount(group)}</small></>:w.type==='apps'?<GroupHeaderName name={w.title||w.appName||''} displayName={w.title||w.appName||title} save={name=>update(w.id,{title:name})} label="App widget name" tooltip="Click to rename app widget"/>:<span className="widget-title">{title}</span>}
            {w.type==='files'&&(w.fileKey||w.folderName)&&<small className="resource-badge">{w.fileKey?w.fileKind?.toUpperCase()??'File':'Folder'}</small>}
            <div className="widget-controls" data-capture-ignore>
              <div className="widget-tag-picker">
                {w.tagColor&&<button type="button" className="widget-active-tag" data-tag-color={w.tagColor} aria-label={'Change '+w.tagColor+' tag color'} title={'Click to change or remove '+w.tagColor+' tag'} aria-haspopup="menu" aria-expanded={tagPicker?.id===w.id} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();const position=popupPosition(e.currentTarget.getBoundingClientRect(),238);setPluginPicker(null);setTagPicker(current=>current?.id===w.id?null:{id:w.id,...position})}}><span className="widget-tag-dot"/></button>}
                <button type="button" className="widget-customize-control" aria-label={'Add widget add-on to '+title} aria-haspopup="menu" aria-expanded={pluginPicker?.id===w.id} title="Add widget add-on" onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();const position=popupPosition(e.currentTarget.getBoundingClientRect(),190);setTagPicker(null);setPluginPicker(current=>current?.id===w.id?null:{id:w.id,...position})}}>+</button>
                {pluginPicker?.id===w.id&&createPortal(<div className="widget-plugin-menu" style={{position:'fixed',top:pluginPicker.top,right:pluginPicker.right}} role="menu" aria-label={'Widget add-ons for '+title}>
                  <button type="button" className="widget-plugin-choice" role="menuitemcheckbox" aria-label="Add Color tag plugin" aria-checked={!!w.tagColor} disabled={!!w.tagColor} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();update(w.id,{tagColor:'blue'});setPluginPicker(null)}}><span className="widget-plugin-dot" aria-hidden="true"/><span>Color tag</span><small>{w.tagColor?'Added':'Add'}</small></button>
                </div>,document.body)}
                {tagPicker?.id===w.id&&createPortal(<div className="widget-tag-palette" style={{position:'fixed',top:tagPicker.top,right:tagPicker.right}} role="menu" aria-label={'Color tag for '+title}>
                  {widgetTagColors.map(color=><button key={color} type="button" role="menuitemradio" aria-label={'Set '+color+' tag color'} aria-checked={w.tagColor===color} className="widget-tag-choice" data-tag-color={color} title={color[0].toUpperCase()+color.slice(1)} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();update(w.id,{tagColor:color});setTagPicker(null)}}><span className="widget-tag-dot"/></button>)}
                  <button type="button" role="menuitemradio" aria-label="Remove color tag" aria-checked={!w.tagColor} className="widget-tag-choice widget-tag-none" onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();update(w.id,{tagColor:null});setTagPicker(null)}}>×</button>
                </div>,document.body)}
              </div>
              {w.type==='browser'&&<button className="widget-header-action browser-lecture-action" data-capture-ignore aria-label={w.lectureRestore?'Restore Browser size':'Set Browser to Lecture size'} title={w.lectureRestore?'Restore previous size':'Use 80% Lecture size'} aria-pressed={!!w.lectureRestore} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();lecture(w)}}>{w.lectureRestore?'↶':'80%'}</button>}
              {w.type==='apps'&&showAppAttachAction&&<button data-capture-ignore aria-label={'Attach open app to '+title} title="Attach an open app" onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();pickApp(w.id,visibleOrigin(),extent)}}>↗</button>}
              {w.type==='apps'&&showAppSaveAction&&w.appKey&&<button data-capture-ignore aria-label={'Save '+title+' to tray'} title="Save app to tray" onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();saveApp(w.id)}}>↓</button>}
              {w.type==='apps'&&showAppDetachAction&&w.appPanelOpen&&<button data-capture-ignore aria-label={'Detach app from '+title} title="Detach app and return it to the desktop" onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();update(w.id,{appPanelOpen:false});notify('App released to your desktop.')}}>⏏</button>}
              {showWidgetRelaunchAction&&<button type="button" className="widget-relaunch-control" data-capture-ignore aria-label={'Relaunch '+title} aria-invalid={relaunchFailures[w.id]||undefined} title={'Relaunch '+title+' in place'} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();relaunch(w)}}><Icon name="restart"/></button>}
              {showScreenshotControl(screenshotPluginMode??'global',screenshotPluginColors,w.tagColor)&&<button className={`widget-snapshot-control ${groupCollapsed?'group-hidden-header-action':''}`} disabled={busy!==null} aria-label={'Copy screenshot of '+title} title="Click or drag this handle to copy a screenshot; paste in ChatGPT" onClick={e=>{if(e.detail===0)void snapshot(w.id)}} onPointerDown={e=>{e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId)}} onPointerUp={e=>{e.stopPropagation();void snapshot(w.id)}}><Icon name="camera"/></button>}
              {showWidgetExportPngAction&&w.type!=='apps'&&<button className={`widget-export-control ${groupCollapsed?'group-hidden-header-action':''}`} disabled={busy!==null} aria-label={'Export '+title+' PNG'} title="Export PNG" onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();void snapshot(w.id,true)}}>↓</button>}
              <button aria-label={'Minimize '+title} title="Minimize widget" onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();minimize(w)}}>−</button>
              <button aria-label={'Remove '+title} title="Remove this instance" onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();remove(w.id)}}>×</button>
              {w.type==='group'&&w.groupId&&<button type="button" className="group-collapse-toggle" data-capture-ignore aria-label={groupCollapsed?'Expand Group':'Collapse Group'} title={groupCollapsed?'Expand Group':'Collapse Group'} aria-expanded={!groupCollapsed} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();toggleGroup(w)}}>{groupCollapsed?'›':'⌄'}</button>}
            </div>
          </div>}
          <div className="widget-content" aria-hidden={w.minimized}>{startupDeferredIds.has(w.id)?<div className="widget-startup-waiting"><Icon name={d.icon}/><p>Waiting for manual relaunch</p><button type="button" className="primary" data-capture-ignore onClick={()=>relaunch(w)}>Relaunch {title}</button></div>:<Component key={nativeWidget?w.id:`${w.id}:${relaunchToken}`} widget={w} relaunchToken={relaunchToken} onRelaunchStatus={failed=>reportRelaunchFailure(w.id,failed)} group={groups.find(g=>g.id===w.groupId)} updateGroup={w.groupId?patch=>updateGroup(w.groupId!,patch):undefined} openGroupWidget={entry=>openGroupWidget(entry,visibleOrigin(),extent)} update={patch=>update(w.id,patch)} obscured={obscured||!!active||trayDragging||externalDragging||w.minimized} workspaceActive={workspaceActive} notify={notify} lecture={()=>lecture(w)} openResource={link=>openResource(link,visibleOrigin())} pickApp={()=>pickApp(w.id,visibleOrigin(),extent)} saveApp={()=>saveApp(w.id)} appAttachment={appAttachments[w.id]} appAttachmentHandled={()=>{const attachment=appAttachments[w.id];if(attachment)appAttachmentHandled(w.id,attachment)}} widgetPluginContext={{relaunchPluginStatus:widgetRelaunchPluginStatus,globalMode:widgetRelaunchMode,colors:widgetRelaunchColors,setGlobalMode:setRelaunchMode,setColorMode:setRelaunchColor,screenshotMode:screenshotPluginMode,screenshotColors:screenshotPluginColors,setScreenshotMode,setScreenshotColor}}/>}</div>
           {!w.minimized&&<button className="widget-resize" data-capture-ignore aria-label={'Resize '+title} title="Drag to resize · arrow keys resize · Shift for 1px" onPointerDown={e=>start(e,w,'resize')} onPointerMove={move} onPointerUp={e=>finish(e)} onPointerCancel={e=>finish(e,true)} onLostPointerCapture={e=>{if(gesture.current)finish(e,true)}} onKeyDown={e=>key(e,w,'resize')}><span aria-hidden="true">◢</span></button>}
         </article>})}
         {!widgets.length&&<div className="canvas-empty"><Icon name="arrange"/><h2>Make room for your next idea.</h2><p>Drag a widget down from the tray, or click one to add it.</p></div>}
       </section>
     </div>
     <svg className="canvas-overview" style={{width:Math.min(160,Math.max(96,viewportWidth-16))}} role="img" aria-label="Workspace overview map; shaded outline shows the visible viewport" viewBox={`0 0 ${Math.max(extent,1)} ${Math.max(height,1)}`} preserveAspectRatio="none"><title>Workspace overview</title><rect className="overview-canvas" x="0" y="0" width={extent} height={height}/>{widgets.map(w=>{const p=bounded(w,w.placement);return <rect key={w.id} className="overview-widget" x={p.x} y={p.y} width={p.width} height={p.height} rx="14"/>})}<rect ref={overviewViewportRef} className="overview-viewport" x="0" y="0" width={viewportWidth} height={viewportHeight}/></svg>
     </div><div className="canvas-status"><span>{widgets.length} widgets · drag headers to move between workspaces · use ◢ to resize</span><span>Camera → copy → paste in ChatGPT</span></div>
    {trayGhost&&<div className="tray-drag-ghost" aria-hidden="true" style={{left:trayGhost.clientX+14,top:trayGhost.clientY+14}}>＋ {ghostLabel}</div>}
    {savedMenu&&<SavedItemContextMenu target={savedMenu} close={closeSavedMenu} rename={()=>savedMenu.kind==='preset'?renamePreset(savedMenu.id):renameGroup(savedMenu.id)} remove={()=>savedMenu.kind==='preset'?removePreset(savedMenu.id):removeGroup(savedMenu.id)}/>}
  </div></TrayDragProvider>;
}
