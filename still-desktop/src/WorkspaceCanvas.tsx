import {useEffect,useRef,useState,type PointerEvent,type KeyboardEvent,type DragEvent} from 'react';
import {Icon,widgetRegistry} from './widgets.tsx';
import {widgetTypes,type WidgetInstance,type WidgetType,type SavedGroup,type GroupWidgetEntry} from './domain/workspaces.ts';
import {placement,translate,resize,type Placement,canvasExtent,canvasHeight,constrainPlacement} from './domain/layout.ts';
import {captureWidget,downloadCapture} from './platform/capture.ts';
import {toggleLecture} from './domain/lecture.ts';
import type {WebShortcut} from './domain/webShortcuts.ts';
import GroupTray from './GroupTray.tsx';
import type {GroupEditMode} from './GroupEditor.tsx';
import PresetTray from './PresetTray.tsx';
import {presetFromWidget,type WidgetPreset,type PresetType} from './domain/presets.ts';
import {trayDropDecision,droppedWebsite,type GroupTrayDropTarget} from './domain/trayDrop.ts';
import {resourceDrop,previewFileDrop,presetForDroppedResource,type ResourceDropEvent,type DroppedResource} from './platform/resourceDrop.ts';
import {TrayDragProvider,TrayDragButton,trayFocusIntoView,type TrayDragPosition} from './TrayDragButton.tsx';
interface DropProps {savePresets:(presets:WidgetPreset[],preserveUndo?:boolean)=>void;openDropped:(presets:WidgetPreset[],at:{x:number;y:number},width:number)=>void}
interface AppPickerProps {pickApp:(id?:string,at?:{x:number;y:number},width?:number)=>void;saveApp:(id:string)=>void;appAttachments:Record<string,import('./platform/appPanel.ts').AppAttachment>;appAttachmentHandled:(id:string,attachment:import('./platform/appPanel.ts').AppAttachment)=>void}
interface Props {presets:WidgetPreset[];openPreset:(preset:WidgetPreset,at?:{x:number;y:number},width?:number)=>void;editPreset:(type:PresetType,preset?:WidgetPreset)=>void;removePreset:(id:string)=>void;widgets:WidgetInstance[];groups:SavedGroup[];updateGroup:(id:string,patch:Partial<Omit<SavedGroup,'id'>>)=>void;saveToGroup:(widget:WidgetInstance,groupId?:string,preserveUndo?:boolean)=>void;openGroup:(id:string,at?:{x:number;y:number},width?:number)=>void;editGroup:(id:string,mode:GroupEditMode)=>void;removeGroup:(id:string)=>void;openGroupWidget:(entry:GroupWidgetEntry,at?:{x:number;y:number},width?:number)=>void; update:(id:string,patch:Partial<WidgetInstance>)=>void; add:(type:WidgetType,at?:{x:number;y:number},width?:number)=>void; remove:(id:string,preserveUndo?:boolean)=>void; begin:()=>void; bringToFront:(id:string)=>void; notify:(s:string)=>void; obscured:boolean; workspaceActive?:boolean; openResource:(link:WebShortcut,at:{x:number;y:number})=>void}
type Gesture={id:string;type:WidgetType;mode:'move'|'resize';startX:number;startY:number;p:Placement;scrollX:number;scrollY:number};
type SaveCue={kind:'widget';type:WidgetType}|{kind:'group-create'}|{kind:'group';id:string};
export default function WorkspaceCanvas({presets,openPreset,editPreset,removePreset,savePresets,openDropped,widgets,groups,updateGroup,saveToGroup,openGroup,editGroup,removeGroup,openGroupWidget,update,add,remove,begin,bringToFront,notify,obscured,workspaceActive=true,openResource,pickApp,saveApp,appAttachments,appAttachmentHandled}:Props&DropProps&AppPickerProps){
  const viewport=useRef<HTMLDivElement>(null),tray=useRef<HTMLDivElement>(null),gesture=useRef<Gesture|null>(null);
  const [active,setActive]=useState<string|null>(null),[trayDragging,setTrayDragging]=useState(false),[overTray,setOverTray]=useState(false),[overCanvas,setOverCanvas]=useState(false),[busy,setBusy]=useState<string|null>(null);
  const [viewportWidth,setViewportWidth]=useState(0),[viewportHeight,setViewportHeight]=useState(0);
  const [presetMenu,setPresetMenu]=useState<PresetType|null>(null);
  const [saveTarget,setSaveTarget]=useState<SaveCue|null>(null),[externalDragging,setExternalDragging]=useState(false),[trayGhost,setTrayGhost]=useState<TrayDragPosition|null>(null);
  const externalEntries=useRef<DroppedResource[]>([]),nativeHandler=useRef<(event:ResourceDropEvent)=>void>(()=>{});
  function contains(rect:DOMRect,x:number,y:number){return x>=rect.left&&x<=rect.right&&y>=rect.top&&y<=rect.bottom}
  function trayTarget(x:number,y:number){
   const t=tray.current!;if(!contains(t.getBoundingClientRect(),x,y))return{insideTray:false,targetType:null,overInteractive:false};
   const groupNode=Array.from(t.querySelectorAll<HTMLElement>('[data-group-drop-target]')).find(node=>{const scroll=node.closest('.tray-items');return contains(node.getBoundingClientRect(),x,y)&&(!scroll||contains(scroll.getBoundingClientRect(),x,y))});
   const groupTarget:GroupTrayDropTarget|undefined=groupNode?.dataset.groupDropTarget==='create'?{kind:'create'}:groupNode?.dataset.groupDropTarget==='existing'&&groupNode.dataset.groupId?{kind:'existing',groupId:groupNode.dataset.groupId}:undefined;
   const element=Array.from(t.querySelectorAll<HTMLElement>('[data-tray-type]')).find(node=>{const scroll=node.closest('.tray-items');return contains(node.getBoundingClientRect(),x,y)&&(!scroll||contains(scroll.getBoundingClientRect(),x,y))});
   const targetType=element?.dataset.trayType as WidgetType|undefined;
   const overInteractive=!!targetType||!!groupTarget||Array.from(t.querySelectorAll<HTMLElement>('button,input,select,a')).some(node=>{const scroll=node.closest('.tray-items');return contains(node.getBoundingClientRect(),x,y)&&(!scroll||contains(scroll.getBoundingClientRect(),x,y))});
   return{insideTray:true,targetType:targetType??null,groupTarget,overInteractive};
  }
  function cueFor(action:string,target:ReturnType<typeof trayTarget>):SaveCue|null {if(action==='save'&&target.targetType)return{kind:'widget',type:target.targetType};if(action==='create-group')return{kind:'group-create'};if(action==='save-group'&&target.groupTarget?.kind==='existing')return{kind:'group',id:target.groupTarget.groupId};return null}
  function widgetFeedback(x:number,y:number,type:WidgetType){const target=trayTarget(x,y),action=trayDropDecision({source:'widget',widgetType:type,...target});setSaveTarget(cueFor(action,target));setOverTray(action==='remove');return action}
  function clearDrop(){setExternalDragging(false);setSaveTarget(null);setOverTray(false);setOverCanvas(false);externalEntries.current=[]}
  function entrySource(entry:DroppedResource){return entry.kind==='website'?'website':entry.kind==='app'?'app':'file'}
  function externalFeedback(x:number,y:number,entries:DroppedResource[]){const target=trayTarget(x,y);const green=entries.some(entry=>trayDropDecision({source:entrySource(entry),...target})==='save');setSaveTarget(green&&target.targetType?{kind:'widget',type:target.targetType}:null);setOverTray(target.insideTray&&!target.overInteractive&&!green);setOverCanvas(!target.insideTray&&contains(viewport.current!.getBoundingClientRect(),x,y))}
  function canvasPoint(x:number,y:number){const v=viewport.current!,r=v.getBoundingClientRect();return{x:x-r.left+v.scrollLeft,y:y-r.top+v.scrollTop}}
  function acceptResources(entries:DroppedResource[],x:number,y:number,errors:string[]=[]){
   const target=trayTarget(x,y),inCanvas=!target.insideTray&&contains(viewport.current!.getBoundingClientRect(),x,y);
   const accepted=inCanvas?entries:entries.filter(entry=>trayDropDecision({source:entrySource(entry),...target})==='save');
   try{const saved=accepted.map(presetForDroppedResource);if(saved.length){if(inCanvas)openDropped(saved,canvasPoint(x,y),extent);else{savePresets(saved);setPresetMenu(saved[0].type)}}else notify(errors[0]??'Drop on the matching tray button to save, or on the workspace to add a widget.');if(saved.length&&errors.length)notify('Added '+saved.length+' shortcut(s). '+errors[0])}catch(e){notify(String((e as Error).message??e))}finally{clearDrop()}
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
  // The canvas extent must track the visible viewport reactively (sidebar
  // toggle, window resize) so the 30% scroll room recomputes with it.
  useEffect(()=>{const node=viewport.current;if(!node)return;const measure=()=>{setViewportWidth(node.clientWidth);setViewportHeight(node.clientHeight)};measure();const observer=new ResizeObserver(measure);observer.observe(node);return()=>observer.disconnect()},[]);
  function bounded(w:WidgetInstance,p:Placement){return constrainPlacement(w.type,p,extent,{width:w.appPanelOpen?w.appMinWidth:undefined,height:w.appPanelOpen?w.appMinHeight:undefined})}
  function lecture(w:WidgetInstance){const v=viewport.current;if(!v)return;begin();const next=toggleLecture(w.placement,w.lectureRestore,v.clientWidth,v.clientHeight,v.scrollLeft,v.scrollTop);update(w.id,{...next,placement:bounded(w,next.placement)});bringToFront(w.id);}
  function start(e:PointerEvent<HTMLElement>,w:WidgetInstance,mode:'move'|'resize'){
    if(e.button!==0 || obscured || (mode==='move'&&(e.target as HTMLElement).closest('button')))return;
    e.preventDefault();begin();e.currentTarget.setPointerCapture(e.pointerId);
    gesture.current={id:w.id,type:w.type,mode,startX:e.clientX,startY:e.clientY,p:w.placement,scrollX:viewport.current?.scrollLeft??0,scrollY:viewport.current?.scrollTop??0};setActive(w.id);
  }
  function move(e:PointerEvent<HTMLElement>){const g=gesture.current;if(!g)return;
    const scroll=viewport.current!, dx=e.clientX-g.startX+scroll.scrollLeft-g.scrollX,dy=e.clientY-g.startY+scroll.scrollTop-g.scrollY;
     const w=widgets.find(item=>item.id===g.id);if(w)update(g.id,{placement:bounded(w,g.mode==='move'?translate(g.type,g.p,dx,dy):resize(g.type,g.p,dx,dy))});
    const r=tray.current!.getBoundingClientRect();if(g.mode==='move')widgetFeedback(e.clientX,e.clientY,g.type);
    const v=scroll.getBoundingClientRect();if(e.clientY>v.bottom-32)scroll.scrollTop+=10;if(e.clientY<v.top+32&&e.clientY>r.bottom)scroll.scrollTop-=10;
    if(e.clientX>v.right-32)scroll.scrollLeft+=10;if(e.clientX<v.left+32)scroll.scrollLeft-=10;
  }
  function finish(e:PointerEvent<HTMLElement>,cancel=false){const g=gesture.current;if(!g)return;const r=tray.current!.getBoundingClientRect();
    // DOM reordering can cancel pointer capture. Raise visually during dragging,
    // then persist stacking after releasing the pointer.
    gesture.current=null;setActive(null);setOverTray(false);setSaveTarget(null);
    const target=trayTarget(e.clientX,e.clientY),action=trayDropDecision({source:'widget',widgetType:g.type,...target});
    if(cancel)update(g.id,{placement:g.p});else if(g.mode==='move'&&Math.hypot(e.clientX-g.startX,e.clientY-g.startY)>4&&target.insideTray){
     if(action==='remove')remove(g.id,true);else{update(g.id,{placement:g.p});const w=widgets.find(w=>w.id===g.id);try{if(action==='save'&&w){savePresets([presetFromWidget(w)],true);if(w.type!=='group')setPresetMenu(w.type)}else if((action==='create-group'||action==='save-group')&&w){const groupId=target.groupTarget?.kind==='existing'?target.groupTarget.groupId:undefined;saveToGroup(w,groupId,true)}}catch(error){notify(String((error as Error).message??error))}}
    }else bringToFront(g.id);
  }
  function key(e:KeyboardEvent<HTMLElement>,w:WidgetInstance,mode:'move'|'resize'){
    const delta:Record<string,[number,number]>={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
    if(e.target!==e.currentTarget||!delta[e.key])return;e.preventDefault();begin();const [x,y]=delta[e.key],step=e.shiftKey?1:10;
      update(w.id,{placement:bounded(w,mode==='move'?translate(w.type,w.placement,x*step,y*step):resize(w.type,w.placement,x*step,y*step))});
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
  const extent=canvasExtent(viewportWidth,widgets);
  const height=canvasHeight(viewportHeight,widgets);
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
  return <TrayDragProvider enabled={workspaceActive&&!obscured} onChange={trayDragChange} onDrop={trayDragDrop}><div className={`canvas-system ${active||trayDragging||externalDragging?'widget-gesture':''}`} onDragOverCapture={previewDragOver} onDropCapture={previewDrop} onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))clearDrop()}}>
    <div ref={tray} role="group" className={`widget-tray ${overTray?'tray-remove':''} ${saveTarget?'tray-saving':''}`} aria-label="Widget tray" aria-describedby="widget-tray-help">
     <div className="tray-main-row">
      <div className="tray-label" aria-live="polite" aria-atomic="true"><strong>{saveTarget?'Release to save':overTray?active?'Release to remove':'Not saved here':'Widget tray'}</strong><small>{saveTarget?'Reusable shortcut':overTray?active?'Only this instance':'Drop on a matching button':'Drag in · green saves · red removes'}</small></div>
      <div className="tray-items">{widgetTypes.filter(type=>type!=='ai').map(type=><div data-tray-type={type} className={'tray-widget-button '+(type!=='group'?'tray-split-button ':'')+(saveTarget?.kind==='widget'&&saveTarget.type===type||saveTarget?.kind==='group-create'&&type==='group'?'tray-save-target':'')} key={type}><TrayDragButton dragPayload={{kind:'type',type}} data-group-drop-target={type==='group'?'create':undefined} onFocus={trayFocusIntoView} aria-label={type==='apps'?'Attach open app':'Add '+widgetRegistry[type].name+' widget'} title={type==='apps'?'Choose an open app · drag to add an empty Apps panel':widgetRegistry[type].description} onClick={()=>type==='apps'?pickApp(undefined,visibleOrigin(),extent):add(type,undefined,extent)}><Icon name={widgetRegistry[type].icon}/><span>{widgetRegistry[type].name}</span></TrayDragButton>{type!=='group'&&<><button className="tray-preset-arrow" onFocus={trayFocusIntoView} aria-label={widgetRegistry[type].name+' presets'} title={'Custom '+widgetRegistry[type].name+' widgets'} aria-expanded={presetMenu===type} aria-controls={'preset-tray-'+type} onClick={()=>setPresetMenu(presetMenu===type?null:type)}>{presetMenu===type?'▴':'▾'}</button>{presetMenu===type&&<PresetTray type={type as PresetType} presets={presets} add={preset=>openPreset(preset,visibleOrigin(),extent)} edit={editPreset} remove={removePreset} collapse={()=>setPresetMenu(null)} attachApp={()=>pickApp(undefined,visibleOrigin(),extent)}/>}</>}</div>)}{groups.length>0&&<span className="tray-group-separator" aria-hidden="true"/>}<GroupTray groups={groups} update={updateGroup} openGroup={id=>openGroup(id,visibleOrigin(),extent)} openLink={link=>openResource(link,visibleOrigin())} openWidget={entry=>openGroupWidget(entry,visibleOrigin(),extent)} edit={editGroup} remove={removeGroup} activeDropGroupId={saveTarget?.kind==='group'?saveTarget.id:null}/></div>
      <div className="tray-blank-gutter" data-tray-blank-gutter="" aria-hidden="true" title="Blank tray space — drop a widget here to remove only that instance"/>
     </div>
     <span id="widget-tray-help" className="tray-help-text">Saved widget tray. Drag a widget header onto a matching type button to save a reusable shortcut, drop onto Group to create a group, or onto a group button to save there. Blank tray space removes only that open instance.</span>
    </div>
    <div className={`canvas-viewport ${overCanvas?'canvas-drop':''}`} ref={viewport} aria-label="Workspace canvas">
      <section className="workspace-canvas" aria-label="Workspace widgets" style={{minWidth:extent,height}}>
        {widgets.map((w,index)=>{const d=widgetRegistry[w.type],Component=d.component,p=placement(w.type,w.placement);const count=widgets.filter(i=>i.type===w.type).length;const number=w.instanceNumber;const title=w.title||d.name+(count>1?' '+number:'');return <article id={'widget-'+w.id} key={w.id} data-widget-id={w.id} className={`card canvas-card widget-${w.type} ${active===w.id?'gesture-card':''}`} style={{left:p.x,top:p.y,width:p.width,height:p.height,zIndex:active===w.id?widgets.length+1:index+1}}>
          <div className="card-head widget-move" tabIndex={0} aria-label={'Move '+title} title="Drag to move · arrow keys move · Shift for 1px" onPointerDown={e=>start(e,w,'move')} onPointerMove={move} onPointerUp={e=>finish(e)} onPointerCancel={e=>finish(e,true)} onLostPointerCapture={e=>{if(gesture.current)finish(e,true)}} onKeyDown={e=>key(e,w,'move')}><span className="move-grip" aria-hidden="true">⠿</span><Icon name={d.icon}/><span className="widget-title">{title}</span>{(w.type==='apps'||w.type==='files'&&(w.fileKey||w.folderName))&&<small className="resource-badge">{w.type==='apps'?'App':w.fileKey?w.fileKind?.toUpperCase()??'File':'Folder'}</small>}<div className="widget-controls" data-capture-ignore>
             <button disabled={busy!==null} aria-label={'Copy screenshot of '+title} title="Click or drag this handle to copy a screenshot; paste in ChatGPT" onClick={e=>{if(e.detail===0)void snapshot(w.id)}} onPointerDown={e=>{e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId)}} onPointerUp={e=>{e.stopPropagation();void snapshot(w.id)}}><Icon name="camera"/></button>
             <button disabled={busy!==null} aria-label={'Export '+title+' PNG'} title="Export PNG" onClick={()=>void snapshot(w.id,true)}>↓</button>
             {w.type==='apps'&&<button className="widget-resize-control" aria-label={'Resize '+title} title="Drag to resize · use arrow keys to resize" onPointerDown={e=>{e.stopPropagation();start(e,w,'resize')}} onKeyDown={e=>key(e,w,'resize')}><span aria-hidden="true">↘</span></button>}
             <button aria-label={'Remove '+title} title="Remove this instance" onClick={()=>remove(w.id)}>×</button>
          </div></div>
          <div className="widget-content"><Component widget={w} group={groups.find(g=>g.id===w.groupId)} updateGroup={w.groupId?patch=>updateGroup(w.groupId!,patch):undefined} openGroupWidget={entry=>openGroupWidget(entry,visibleOrigin(),extent)} update={patch=>update(w.id,patch)} obscured={obscured||!!active||trayDragging||externalDragging} workspaceActive={workspaceActive} notify={notify} lecture={()=>lecture(w)} openResource={link=>openResource(link,visibleOrigin())} pickApp={()=>pickApp(w.id,visibleOrigin(),extent)} saveApp={()=>saveApp(w.id)} appAttachment={appAttachments[w.id]} appAttachmentHandled={()=>{const attachment=appAttachments[w.id];if(attachment)appAttachmentHandled(w.id,attachment)}}/></div>
          <button className="widget-resize" data-capture-ignore aria-label={'Resize '+title} title="Drag to resize · arrow keys resize · Shift for 1px" onPointerDown={e=>start(e,w,'resize')} onPointerMove={move} onPointerUp={e=>finish(e)} onPointerCancel={e=>finish(e,true)} onLostPointerCapture={e=>{if(gesture.current)finish(e,true)}} onKeyDown={e=>key(e,w,'resize')}><span aria-hidden="true">◢</span></button>
        </article>})}
        {!widgets.length&&<div className="canvas-empty"><Icon name="arrange"/><h2>Make room for your next idea.</h2><p>Drag a widget down from the tray, or click one to add it.</p></div>}
      </section>
    </div><div className="canvas-status"><span>{widgets.length} widgets · drag headers to move · use ◢ to resize</span><span>Camera → copy → paste in ChatGPT</span></div>
    {trayGhost&&<div className="tray-drag-ghost" aria-hidden="true" style={{left:trayGhost.clientX+14,top:trayGhost.clientY+14}}>＋ {ghostLabel}</div>}
  </div></TrayDragProvider>;
}
