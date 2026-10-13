import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createWidgetFromPreset,createWidgetFromGroupEntry,openSavedGroup,updateSavedGroup,saveGroupName,collectWidgetIntoGroup,restoreCollectedWidget,transferWidgetInstance,deleteSavedGroup,savedGroupHasContents,stackWorkspaceWidgets, createInitialState, nextInstanceNumber, createWidget, createWorkspace, duplicateWorkspace, migratePreview, parseState, workspaceName, toggleSidebarCollapsed, sidebarToggleLabel, widgetTypes, checkedAppIconData,workspaceHasFinishedTimer, type WorkspaceState, type WidgetType, type WidgetInstance,type SavedGroup,type GroupWidgetEntry,type SidebarPlugin,type WidgetTagColor } from './domain/workspaces.ts';
import {startupDeferredWidgetIds,applyRelaunchModeToAll,type WidgetRelaunchMode,type WidgetRelaunchPluginStatus} from './domain/widgetRelaunch.ts';
import {type ClockPluginMode} from './domain/clockPlugin.ts';
import { Icon } from './Icon.tsx';
import { widgetRegistry } from './widgets.tsx';
import {chromeLauncher} from './platform/chrome.ts';
import {openExternalUrl} from './platform/externalUrl.ts';
import WorkspaceCanvas from './WorkspaceCanvas.tsx';
import AssistantPanel from './AssistantPanel.tsx';
import {addFocusForAssistantTimer,applyAssistantWidgetActions,applyLayoutPlan,assistantAddedWidgetReceipt,assistantTrayItems,MAX_ASSISTANT_WIDGETS,validateAssistantActions,validateAssistantActionIntent,type AssistantAction,type LayoutPlan} from './domain/assistant.ts';
import {canvasExtent,canvasHeight,nextPlacement,placement,constrainPlacement} from './domain/layout.ts';
import type {SnapLayoutId} from './domain/snapLayouts.ts';
import { nativeShortcuts } from './platform/shortcuts.ts';
import { windowInput } from './platform/windowInput.ts';
import {startupSettings} from './platform/startup.ts';
import type {StartupStatus} from './domain/startup.ts';
import { interactiveHitRegions } from './domain/windowInput.ts';
import { adjacentWorkspaceId, shortcutAction, shortcutLabel, type AppShortcutAction, type WorkspaceDirection, type WorkspaceShortcuts } from './domain/shortcuts.ts';
import ShortcutSettings from './ShortcutSettings.tsx';
import AppearanceSettings from './AppearanceSettings.tsx';
import GeneralSettings from './GeneralSettings.tsx';
import WidgetPluginsSettings from './WidgetPluginsSettings.tsx';
import type {WebShortcut} from './domain/webShortcuts.ts';
import GroupEditor,{type GroupEditMode} from './GroupEditor.tsx';
import PresetEditor from './PresetEditor.tsx';
import TrayEditor from './TrayEditor.tsx';
import {upsertSavedPresets,renameSavedPreset,removeSavedPreset,savedAppInUse,deleteCanvasWidget} from './domain/trayActions.ts';
import {presetFromWidget,widgetPreset,type WidgetPreset,type PresetType} from './domain/presets.ts';
import AppWindowPicker from './AppWindowPicker.tsx';
import {managedAppWidget,type AppWindowChoice} from './domain/appPicker.ts';
import {localDocuments,type DroppedResource} from './platform/resourceDrop.ts';
import {appPanel,type AppAttachment} from './platform/appPanel.ts';
import {appCapture} from './platform/appCapture.ts';
import {getCurrentWindow} from '@tauri-apps/api/window';
import {isTauri} from '@tauri-apps/api/core';
const KEY='still-workspace-v2';
const shortcutModifier='Ctrl';
function load():{state:WorkspaceState;warning:string}{
  try{
    const saved=localStorage.getItem(KEY);if(saved){const document=JSON.parse(saved) as {version?:number};const restored=parseState(document);if(document.version!==7)try{localStorage.setItem(KEY+'-before-browser-removal',saved)}catch{}return{state:restored,warning:''};}
    const old=localStorage.getItem('still-design-study-v1');if(old)return{state:migratePreview(JSON.parse(old)),warning:''};
  }catch{try{const original=localStorage.getItem(KEY);if(original)localStorage.setItem(KEY+'-recovery',original)}catch{}return{state:createInitialState(),warning:'Saved data could not be read. A recovery copy was retained where storage permits.'}}
  return{state:createInitialState(),warning:''};
}
function Modal({title,close,children}:{title:string;close:()=>void;children:ReactNode}){
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{ref.current?.showModal();return()=>ref.current?.close()},[]);
  return <dialog ref={ref} onCancel={close}><div className="dialog-head"><h2>{title}</h2><button onClick={close} aria-label="Close dialog">×</button></div>{children}</dialog>;
}
type ModalType='gallery'|'settings'|'sidebarPlugins'|'shortcuts'|'create'|'rename'|'renameSaved'|'commands'|'group'|'preset'|'apps'|'appsTray'|'trayEdit'|'delete'|null;
export default function App(){
  const [initial]=useState(load);const [state,setState]=useState(initial.state);const [startupDeferred,setStartupDeferred]=useState(()=>startupDeferredWidgetIds(initial.state.workspaces,initial.state.widgetRelaunchPluginStatus,initial.state.widgetRelaunchMode,initial.state.widgetRelaunchColors));const [storage,setStorage]=useState(initial.warning||'Saved on this device');const [modal,setModal]=useState<ModalType>(null);const [settingsTab,setSettingsTab]=useState<'general'|'appearance'|'plugins'>('general');const [arrange,setArrange]=useState(false);const [fullscreen,setFullscreen]=useState(false);const [clickThroughActive,setClickThroughActive]=useState(false);const [focusMode,setFocusMode]=useState(false);const [sidebarHidden,setSidebarHidden]=useState(false);const [widgetTrayHidden,setWidgetTrayHidden]=useState(false);const [workspaceDropTarget,setWorkspaceDropTarget]=useState<string|null>(null);const [layoutMode,setLayoutMode]=useState<'picker'|SnapLayoutId|null>(null);const [appsDialogMode,setAppsDialogMode]=useState<'attach'|'shortcut'>('attach');const [message,setMessage]=useState('');const [name,setName]=useState('');const [chosen,setChosen]=useState<WidgetType[]>(['desmos','notes']);const [formError,setFormError]=useState('');const [query,setQuery]=useState('');const undo=useRef<WorkspaceState|null>(null);
  const [startup,setStartup]=useState<StartupStatus>({supported:false,enabled:false});const [startupLoading,setStartupLoading]=useState(true);
  const [assistantOpen,setAssistantOpen]=useState(false);
  const workspace=state.workspaces.find(w=>w.id===state.activeId)!;
  const [editingGroup,setEditingGroup]=useState<string|null>(null),[groupMode,setGroupMode]=useState<GroupEditMode>();
  const selectedGroup=workspace.groups.find(g=>g.id===editingGroup);
  const [presetDraft,setPresetDraft]=useState<{type:PresetType;preset?:WidgetPreset}|null>(null);
  const [savedRename,setSavedRename]=useState<{kind:'preset'|'group';id:string;workspaceId?:string;name:string}|null>(null);
  const [appTarget,setAppTarget]=useState<{workspaceId:string;widgetId?:string;at?:{x:number;y:number};width?:number}|null>(null);
  const [pendingRemoval,setPendingRemoval]=useState<{workspaceId:string;id:string;kind:'widget'|'group';preserveUndo:boolean;name:string}|null>(null);
  const [appAttachments,setAppAttachments]=useState<Record<string,AppAttachment>>({});
  const captureInFlight=useRef(new Set<string>()),captureState=useRef(state);captureState.current=state;
  const latestState=useRef(state),persistTimer=useRef<ReturnType<typeof setTimeout>|null>(null),persistNow=useRef<()=>void>(()=>{});latestState.current=state;
  const visited=useRef(new Set<string>());visited.current.add(state.activeId);
  function notify(value:string){setMessage(value)}
  useEffect(()=>{let disposed=false;if(!startupSettings.available){setStartupLoading(false);return}void startupSettings.status().then(value=>{if(!disposed)setStartup(value)}).catch(error=>{if(!disposed)notify('Still startup setting could not be read: '+String(error))}).finally(()=>{if(!disposed)setStartupLoading(false)});return()=>{disposed=true}},[]);
  async function setStartupEnabled(enabled:boolean){setStartupLoading(true);try{setStartup(await startupSettings.setEnabled(enabled))}catch(error){notify('Still could not update its startup setting: '+String(error))}finally{setStartupLoading(false)}}
  useEffect(()=>{const open=()=>setAssistantOpen(true);window.addEventListener('still-open-assistant',open);return()=>window.removeEventListener('still-open-assistant',open)},[]);
  useEffect(()=>{if(!message)return;const timeout=setTimeout(()=>setMessage(''),4500);return()=>clearTimeout(timeout)},[message]);
  useEffect(()=>{if(!isTauri())return;let disposed=false;const win=getCurrentWindow();void win.isFullscreen().then(value=>{if(!disposed)setFullscreen(value)}).catch(()=>{});const unlisten=win.onResized(()=>{void win.isFullscreen().then(value=>{if(!disposed)setFullscreen(value)}).catch(()=>{})});return()=>{disposed=true;void unlisten.then(stop=>stop())}},[]);
  useEffect(()=>{if(!windowInput.available)return;void windowInput.configureToggle(state.enableWholeWindowClickThrough).catch(()=>notify('Click-through shortcut could not be configured.'));},[state.enableWholeWindowClickThrough]);
  useEffect(()=>{if(!windowInput.available)return;let disposed=false,unlisten:(()=>void)|undefined;windowInput.subscribe(active=>{if(!disposed)setClickThroughActive(active)}).then(stop=>{if(disposed)stop();else unlisten=stop}).catch(()=>notify('Click-through status could not be read.'));return()=>{disposed=true;unlisten?.()}},[]);
  async function toggleClickThrough(){try{await windowInput.setClickThrough(!clickThroughActive);setClickThroughActive(value=>!value)}catch(error){notify('Whole-window click-through could not be changed: '+String(error))}}
  useEffect(()=>{
    if(!windowInput.available)return;
    const enabled=state.passThroughTransparentBackground&&state.background==='transparent';
    if(!enabled){void windowInput.updateRegions(false,[]).catch(()=>{});return}
    let frame=0,disposed=false;
    const root=document.body;
    const update=()=>{if(frame)cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{frame=0;if(disposed)return;const regions=interactiveHitRegions(root,window.innerWidth,window.innerHeight);void windowInput.updateRegions(true,regions).catch(error=>notify('Transparent-area click-through could not be updated: '+String(error)))})};
    const resize=new ResizeObserver(update);resize.observe(root);
    const observeElements=()=>{for(const node of root.querySelectorAll<HTMLElement>('.sidebar,.topbar,.widget-tray-shell,.canvas-card,dialog,[role="dialog"],[role="menu"]'))resize.observe(node)};
    observeElements();
    const mutation=new MutationObserver(()=>{observeElements();update()});mutation.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','hidden','open']});
    window.addEventListener('resize',update);window.addEventListener('scroll',update,true);update();
    return()=>{disposed=true;if(frame)cancelAnimationFrame(frame);resize.disconnect();mutation.disconnect();window.removeEventListener('resize',update);window.removeEventListener('scroll',update,true);void windowInput.updateRegions(false,[]).catch(()=>{})};
  },[state.background,state.passThroughTransparentBackground,state.activeId,modal,sidebarHidden,widgetTrayHidden,focusMode]);
  useEffect(()=>{if(!appPanel.available)return;void appPanel.configureShutdown(state.appShutdownBehavior).catch(()=>notify('App shutdown behavior could not be updated.'))},[state.appShutdownBehavior]);
  async function toggleFullscreen(){if(!isTauri())return;try{const win=getCurrentWindow(),next=!(await win.isFullscreen());await win.setFullscreen(next);setFullscreen(next)}catch(error){notify('Fullscreen could not be changed: '+String(error))}}
  useEffect(()=>{if(!fullscreen||modal)return;const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();void toggleFullscreen()}};document.addEventListener('keydown',onKey);return()=>document.removeEventListener('keydown',onKey)},[fullscreen,modal]);
  useEffect(()=>{const app=document.querySelector<HTMLElement>('.canvas-app');if(!app)return;app.classList.toggle('fullscreen-taskbar-covered',fullscreen);const updateTaskbarHeight=()=>app.style.setProperty('--fullscreen-taskbar-height',Math.max(40,screen.height-screen.availHeight-Math.max(0,(screen as Screen&{availTop?:number}).availTop??0))+'px');if(fullscreen){updateTaskbarHeight();window.addEventListener('resize',updateTaskbarHeight)}else app.style.removeProperty('--fullscreen-taskbar-height');return()=>window.removeEventListener('resize',updateTaskbarHeight)},[fullscreen]);
  useEffect(()=>{
    document.body.classList.toggle('dark',state.theme==='dark');document.body.classList.toggle('compact',state.density==='compact');document.body.classList.toggle('dots',state.background==='dots');document.body.classList.toggle('transparent-background',state.background==='transparent');document.body.classList.toggle('liquid-glass',state.appearance==='liquid-glass');
    document.body.style.setProperty('--wallpaper-blur',state.glass.blur+'px');
    document.body.style.setProperty('--wallpaper-saturation',String(state.glass.saturation/100));
    document.body.style.setProperty('--glass-alpha',String(state.glass.opacity/100));
  },[state.theme,state.density,state.background,state.appearance,state.glass]);
  useEffect(()=>{persistNow.current=()=>{
    const snapshot=latestState.current,retainedDocuments=new Set<string>();
    for(const saved of [snapshot,undo.current])if(saved){
      for(const workspace of saved.workspaces){
        for(const widget of workspace.widgets)if(widget.fileKey)retainedDocuments.add(widget.fileKey);
        for(const group of workspace.groups)for(const entry of group.widgets)if(entry.kind==='collected'&&entry.instance?.fileKey)retainedDocuments.add(entry.instance.fileKey);
      }
      for(const preset of saved.presets)if(preset.type==='files'&&preset.resourceKind==='document')retainedDocuments.add(preset.fileSourceId);
    }
    localDocuments.retain(retainedDocuments);
    try{localStorage.setItem(KEY,JSON.stringify(snapshot));setStorage('Saved on this device')}catch{setStorage('Could not save — changes remain in this session')}
  }},[]);
  useEffect(()=>{if(persistTimer.current)return;persistTimer.current=setTimeout(()=>{persistTimer.current=null;persistNow.current()},250)},[state]);
  useEffect(()=>{const flush=()=>{if(persistTimer.current){clearTimeout(persistTimer.current);persistTimer.current=null}persistNow.current()};window.addEventListener('pagehide',flush);window.addEventListener('beforeunload',flush);return()=>{window.removeEventListener('pagehide',flush);window.removeEventListener('beforeunload',flush);if(persistTimer.current)clearTimeout(persistTimer.current)}},[]);
  function switchWorkspace(id:string){setState(s=>({...s,activeId:id}));setArrange(false);}
  // One shared updater path for the header toggle button and the command-palette action.
  function toggleSidebar(){if(sidebarHidden||focusMode){setSidebarHidden(false);setFocusMode(false);return}setState(s=>({...s,sidebarCollapsed:toggleSidebarCollapsed(s.sidebarCollapsed)}))}
  function hideSidebar(){setSidebarHidden(true);setFocusMode(false);setModal(null)}
  function toggleWidgetTray(){if(widgetTrayHidden||focusMode){setWidgetTrayHidden(false);setFocusMode(false);return}setWidgetTrayHidden(true)}
  function hideWidgetTray(){setWidgetTrayHidden(true);setFocusMode(false);setModal(null)}
  function boundNewWidget(widget:WidgetInstance,widgets:WidgetInstance[],width?:number){const viewport=document.querySelector<HTMLElement>('.workspace-surface:not([hidden]) .canvas-viewport'),viewportWidth=viewport?.clientWidth??1000,viewportHeight=viewport?.clientHeight??700;const extent=width??canvasExtent(viewportWidth,[...widgets,widget]),height=canvasHeight(viewportHeight,widgets);return {...widget,placement:constrainPlacement(widget.type,widget.placement,extent,{width:widget.appPanelOpen?widget.appMinWidth:undefined,height:widget.appPanelOpen?widget.appMinHeight:undefined},height)}}
  function moveWorkspace(direction:WorkspaceDirection){setState(s=>({...s,activeId:adjacentWorkspaceId(s.workspaces,s.activeId,direction)}));setArrange(false);}
  function transferWidget(sourceWorkspaceId:string,widgetId:string,destinationId:string){
    if(sourceWorkspaceId===destinationId)return;
    const source=state.workspaces.find(w=>w.id===sourceWorkspaceId),destination=state.workspaces.find(w=>w.id===destinationId),widget=source?.widgets.find(item=>item.id===widgetId);
    if(!source||!destination||!widget)return;
    undo.current=state;
    const viewport=document.querySelector<HTMLElement>('.workspace-surface:not([hidden]) .canvas-viewport'),viewportWidth=viewport?.clientWidth??1000,viewportHeight=viewport?.clientHeight??700;
    const width=canvasExtent(viewportWidth,destination.widgets),height=canvasHeight(viewportHeight,destination.widgets);
    const transfer=transferWidgetInstance(source,destination,widgetId,width,height);if(!transfer)return;
    setState(s=>({...s,workspaces:s.workspaces.map(w=>w.id===sourceWorkspaceId?transfer.source:w.id===destinationId?transfer.destination:w)}));
    setArrange(false);notify((widget.title.trim()||widgetRegistry[widget.type].name)+' moved to '+destination.name+'.');
  }
  function openAppsTrayDialog(workspaceId:string){setAppTarget({workspaceId});setAppsDialogMode('attach');setModal('appsTray')}
  function stackWidgets(){const viewport=document.querySelector<HTMLElement>('.workspace-surface:not([hidden]) .canvas-viewport'),width=canvasExtent(viewport?.clientWidth??1000,workspace.widgets),height=canvasHeight(viewport?.clientHeight??700,workspace.widgets);undo.current=state;setState(s=>({...s,workspaces:s.workspaces.map(w=>w.id===s.activeId?{...w,widgets:stackWorkspaceWidgets(w.widgets,width,height)}:w)}));notify('Open widgets and Groups/minimized widgets arranged in separate stacks.')}
  function addSidebarPlugin(plugin:SidebarPlugin){setState(s=>s.sidebarPlugins.includes(plugin)?s:{...s,sidebarPlugins:[...s.sidebarPlugins,plugin]});setModal(null);notify((plugin==='stack'?'Stack':'Layout')+' plugin added to the sidebar.')}
  function removeSidebarPlugin(plugin:SidebarPlugin){setState(s=>({...s,sidebarPlugins:s.sidebarPlugins.filter(item=>item!==plugin)}));if(plugin==='layout')setLayoutMode(null)}
  function startWidget(id:string){setStartupDeferred(current=>{if(!current.has(id))return current;const next=new Set(current);next.delete(id);return next})}
  function setRelaunchMode(mode:WidgetRelaunchMode){setState(s=>({...s,widgetRelaunchMode:mode}))}
  function applyRelaunchMode(mode:WidgetRelaunchMode){setState(s=>applyRelaunchModeToAll(s,mode))}
  function setRelaunchPluginStatus(status:WidgetRelaunchPluginStatus){setState(s=>({...s,widgetRelaunchPluginStatus:status}))}
  function setRelaunchColor(color:WidgetTagColor,mode:WidgetRelaunchMode|null){setState(s=>{const colors={...s.widgetRelaunchColors};if(mode)colors[color]=mode;else delete colors[color];return{...s,widgetRelaunchColors:colors}})}
  function setScreenshotColor(color:WidgetTagColor,enabled:boolean){setState(s=>({...s,screenshotPluginColors:enabled?[...new Set([...s.screenshotPluginColors,color])]:s.screenshotPluginColors.filter(item=>item!==color)}))}
  function setScreenshotColorOverride(color:WidgetTagColor,enabled:boolean|null){setState(s=>{const overrides={...s.screenshotPluginColorOverrides};if(enabled===null)delete overrides[color];else overrides[color]=enabled;return{...s,screenshotPluginColorOverrides:overrides}})}
  function setScreenshotMode(mode:'global'|'tag-colors'|'off'){setState(s=>({...s,screenshotPluginMode:mode}))}
  function setClockColor(color:WidgetTagColor,enabled:boolean){setState(s=>({...s,clockPluginColors:enabled?[...new Set([...s.clockPluginColors,color])]:s.clockPluginColors.filter(item=>item!==color)}))}
  function setClockColorOverride(color:WidgetTagColor,enabled:boolean|null){setState(s=>{const overrides={...s.clockPluginColorOverrides};if(enabled===null)delete overrides[color];else overrides[color]=enabled;return{...s,clockPluginColorOverrides:overrides}})}
  function setClockMode(mode:ClockPluginMode){setState(s=>({...s,clockPluginMode:mode}))}
  function runShortcut(action:AppShortcutAction){if(modal)return;switch(action){case'up':case'down':moveWorkspace(action);break;case'overview':window.dispatchEvent(new Event('still:workspace-overview-toggle'));break;case'clickThrough':if(state.enableWholeWindowClickThrough)void toggleClickThrough();break;case'commandPalette':setQuery('');setModal('commands');break;case'undo':if(undo.current){setState(undo.current);undo.current=null;notify('Previous workspace layout restored.')}break;default:{const index=Number(action.slice('workspace:'.length))-1;if(index>=0&&!Number.isNaN(index)&&state.workspaces[index])switchWorkspace(state.workspaces[index].id)}}}
  const shortcutContext=useRef({modal,moveWorkspace,runShortcut});shortcutContext.current={modal,moveWorkspace,runShortcut};
  useEffect(()=>{if(!nativeShortcuts.available)return;let disposed=false;let unlisten:(()=>void)|undefined;
    nativeShortcuts.subscribe(direction=>{if(!disposed&&!shortcutContext.current.modal)shortcutContext.current.moveWorkspace(direction)}).then(stop=>{if(disposed)stop();else unlisten=stop}).catch(()=>notify('Workspace shortcut handling could not start. Restart the app to try again.'));
    return()=>{disposed=true;unlisten?.()};
  },[]);
  useEffect(()=>{if(!nativeShortcuts.available)return;let disposed=false,unlisten:(()=>void)|undefined;nativeShortcuts.subscribeActions(action=>{if(!disposed&&!shortcutContext.current.modal)shortcutContext.current.runShortcut(action)}).then(stop=>{if(disposed)stop();else unlisten=stop}).catch(()=>notify('Keyboard shortcut handling could not start.'));return()=>{disposed=true;unlisten?.()}},[]);
  useEffect(()=>{if(!nativeShortcuts.available)return;let disposed=false,unlisten:(()=>void)|undefined;nativeShortcuts.subscribeOverviewToggle().then(stop=>{if(disposed)stop();else unlisten=stop}).catch(()=>notify('The workspace map shortcut could not start.'));return()=>{disposed=true;unlisten?.()}},[]);
  useEffect(()=>{if(nativeShortcuts.available)void nativeShortcuts.configure(state.shortcuts,!modal).catch(()=>notify('Workspace shortcuts could not be updated. Workspace shortcuts still work in the interface.'))},[state.shortcuts,modal]);
  async function saveShortcuts(shortcuts:WorkspaceShortcuts){if(nativeShortcuts.available)await nativeShortcuts.configure(shortcuts,false);setState(s=>({...s,shortcuts}));notify('Workspace shortcuts saved.')}
  function updateWidget(id:string,patch:Partial<WidgetInstance>){setState(s=>({...s,workspaces:s.workspaces.map(w=>w.widgets.some(i=>i.id===id)?{...w,widgets:w.widgets.map(i=>i.id===id?{...i,...patch}:i)}:w)}))}
  function performRemoval(target:NonNullable<typeof pendingRemoval>){
    const current=captureState.current,owner=current.workspaces.find(w=>w.id===target.workspaceId);
    if(!owner)return;
    if(!target.preserveUndo)undo.current=current;
    const group=target.kind==='group'?owner.groups.find(item=>item.id===target.id):undefined;
    setState(s=>target.kind==='widget'?deleteCanvasWidget(s,target.workspaceId,target.id):({...s,workspaces:s.workspaces.map(w=>w.id===target.workspaceId?deleteSavedGroup(w,target.id):w)}));
    if(group)for(const entry of group.widgets)if(entry.kind==='collected'){
      const release=entry.type==='apps'&&appPanel.available?appPanel.release(entry.id):undefined;
      if(release)void release.catch(error=>notify('Group deleted, but '+entry.name+' could not be released from its native panel: '+String(error)));
    }
    setPendingRemoval(null);setModal(null);notify((target.kind==='group'?'Group and its contents deleted. ':'Widget removed. ')+shortcutLabel(state.shortcuts.undo)+' restores the previous layout.');
  }
  function removeWidget(id:string,preserveUndo=false){
    const current=captureState.current,owner=current.workspaces.find(w=>w.widgets.some(widget=>widget.id===id)),widget=owner?.widgets.find(w=>w.id===id);if(!owner||!widget)return;
    const target={workspaceId:owner.id,id,kind:'widget' as const,preserveUndo,name:widget.title||'Group'};
    performRemoval(target);
  }
  function addWidget(type:WidgetType,at?:{x:number;y:number},width?:number){const viewportWidth=width??document.querySelector<HTMLElement>('.workspace-surface:not([hidden]) .canvas-viewport')?.clientWidth??1000;undo.current=state;setState(s=>({...s,workspaces:s.workspaces.map(w=>{if(w.id!==s.activeId)return w;const widget=createWidget(type);widget.instanceNumber=nextInstanceNumber(type,w.widgets);widget.placement=at?placement(type,{...widget.placement,...at}):nextPlacement(type,w.widgets,width??canvasExtent(viewportWidth,w.widgets));const bounded=boundNewWidget(widget,w.widgets,width);if(type==='group'){const id=crypto.randomUUID();bounded.groupId=id;return{...w,groups:[...w.groups,{id,name:'',shortcuts:[],widgets:[],expanded:false}],widgets:[...w.widgets,bounded]}}return {...w,widgets:[...w.widgets,bounded]}})}));setModal(null);notify(widgetRegistry[type].name+' added')}
  function changeGroup(workspaceId:string,id:string,patch:Partial<Omit<SavedGroup,'id'>>){setState(s=>({...s,workspaces:s.workspaces.map(w=>w.id===workspaceId?(patch.name!==undefined?saveGroupName(w,id,patch.name):updateSavedGroup(w,id,patch)):w)}))}
  async function saveWidgetInGroup(workspaceId:string,widget:WidgetInstance,groupId?:string,preserveUndo=false){
    const initial=captureState.current,initialWorkspace=initial.workspaces.find(w=>w.id===workspaceId);
    if(!initialWorkspace){notify('This workspace is no longer available.');return}
    try{collectWidgetIntoGroup(initialWorkspace,widget.id,groupId,widget.placement)}catch(error){notify(String((error as Error).message??error));return}
    try{
      if(widget.type==='apps'&&appPanel.available){const suspended=await appPanel.suspendForCollection(widget.id);if(widget.appPanelOpen&&!suspended)throw new Error('The attached app window could not be verified and hidden. It is still on the workspace. Try the drop again.')}
    }catch(error){notify('The native app could not be safely collected: '+String((error as Error).message??error));return}
    const before=captureState.current,workspace=before.workspaces.find(w=>w.id===workspaceId);
    if(!workspace){
      if(widget.type==='apps'&&appPanel.available&&appPanel.consumeCollectionRetention(widget.id))void appPanel.cancelCollection(widget.id).catch(error=>notify(String(error)));
      notify('The workspace changed before this widget could be collected.');return;
    }
    let collected:typeof workspace;
    try{collected=collectWidgetIntoGroup(workspace,widget.id,groupId,widget.placement)}catch(error){
      if(widget.type==='apps'&&appPanel.available&&appPanel.consumeCollectionRetention(widget.id))void appPanel.cancelCollection(widget.id).catch(reason=>notify(String(reason)));
      notify(String((error as Error).message??error));return;
    }
    if(!preserveUndo)undo.current=before;setState(s=>({...s,workspaces:s.workspaces.map(w=>w.id===workspaceId?collected:w)}));notify(groupId?'Widget moved into the group.':'New group created and widget moved into it.')
  }
  function editGroup(id:string,mode:GroupEditMode){setEditingGroup(id);setGroupMode(mode);setModal('group')}
  function showGroup(workspaceId:string,id:string,at?:{x:number;y:number},width?:number){undo.current=state;setState(s=>({...s,workspaces:s.workspaces.map(w=>{if(w.id!==workspaceId)return w;const opened=openSavedGroup(w,id,at,width),last=opened.widgets.at(-1);return last?{...opened,widgets:[...opened.widgets.slice(0,-1),boundNewWidget(last,opened.widgets.slice(0,-1),width)]}:opened})}));notify('Group widget added.')}
  function removeGroup(workspaceId:string,id:string){const group=captureState.current.workspaces.find(w=>w.id===workspaceId)?.groups.find(g=>g.id===id);if(!group)return;const target={workspaceId,id,kind:'group' as const,preserveUndo:false,name:group.name||'Group'};if(!savedGroupHasContents(group)){performRemoval(target);return}setPendingRemoval(target);setModal('delete')}
  function openGroupWidget(workspaceId:string,entry:GroupWidgetEntry,at?:{x:number;y:number},width?:number){const before=captureState.current,workspace=before.workspaces.find(w=>w.id===workspaceId);if(!workspace){notify('This workspace is no longer available.');return}if(entry.kind==='collected'){const viewport=document.querySelector<HTMLElement>('.workspace-surface:not([hidden]) .canvas-viewport'),canvasWidth=width??canvasExtent(viewport?.clientWidth??1000,workspace.widgets),canvasHeightValue=canvasHeight(viewport?.clientHeight??700,workspace.widgets);try{const restored=restoreCollectedWidget(workspace,entry.id,canvasWidth,canvasHeightValue);undo.current=before;setState(s=>({...s,workspaces:s.workspaces.map(w=>w.id===workspaceId?restored:w)}));notify(entry.name+' restored to the workspace.')}catch(error){notify(String((error as Error).message??error))}return}undo.current=before;setState(s=>({...s,workspaces:s.workspaces.map(w=>{if(w.id!==workspaceId)return w;const created=createWidgetFromGroupEntry(entry,w.widgets,at,width);return{...w,widgets:[...w.widgets,boundNewWidget(created,w.widgets,width)]}})}));notify(entry.name+' added as a new widget.')}
  function editPreset(type:PresetType,preset?:WidgetPreset){setPresetDraft({type,preset});setModal('preset')}
  function savePresets(items:WidgetPreset[],preserveUndo=false){
    const checked=items.map(widgetPreset);if(!checked.length)return;if(!preserveUndo)undo.current=state;
    setState(s=>{return{...s,presets:upsertSavedPresets(s.presets,checked)}});
    notify(checked.length===1?checked[0].name+' saved in the tray.':checked.length+' shortcuts saved in the tray.');
  }
  function savePreset(preset:WidgetPreset){savePresets([preset]);setModal(null)}
  function removePreset(id:string){if(!state.presets.some(p=>p.id===id))return;undo.current=state;setState(s=>({...s,presets:removeSavedPreset(s.presets,id)}));notify('Saved button removed. Open widgets are kept. '+shortcutLabel(state.shortcuts.undo)+' restores it.')}
  function startPresetRename(id:string){const preset=state.presets.find(item=>item.id===id);if(!preset)return;setSavedRename({kind:'preset',id,name:preset.name});setFormError('');setModal('renameSaved')}
  function startGroupRename(workspaceId:string,id:string){const group=state.workspaces.find(item=>item.id===workspaceId)?.groups.find(item=>item.id===id);if(!group)return;setSavedRename({kind:'group',id,workspaceId,name:group.name||'Group'});setFormError('');setModal('renameSaved')}
  function cancelSavedRename(){setSavedRename(null);setFormError('');setModal(null)}
  function saveSavedRename(){if(!savedRename)return;try{const nextName=savedRename.name.trim();if(!nextName)throw new Error('Enter a name.');if(savedRename.kind==='preset'){renameSavedPreset(state.presets,savedRename.id,nextName);undo.current=state;setState(s=>({...s,presets:renameSavedPreset(s.presets,savedRename.id,nextName)}))}else{const owner=state.workspaces.find(w=>w.id===savedRename.workspaceId);if(!owner)throw new Error('This workspace is no longer available.');const renamed=saveGroupName(owner,savedRename.id,nextName);undo.current=state;setState(s=>({...s,workspaces:s.workspaces.map(w=>w.id===owner.id?renamed:w)}))}setSavedRename(null);setFormError('');setModal(null);notify('Saved name updated.')}catch(error){setFormError(String((error as Error).message??error))}}
  function openPreset(workspaceId:string,preset:WidgetPreset,at?:{x:number;y:number},width?:number){if(savedAppInUse(captureState.current,preset)){notify('This application is already open or collected in Still. Restore its existing widget instead.');return}undo.current=state;setState(s=>savedAppInUse(s,preset)?s:({...s,workspaces:s.workspaces.map(w=>{if(w.id!==workspaceId)return w;const created=preset.type==='apps'&&appPanel.available?managedAppWidget({sourceId:preset.appSourceId,name:preset.appName},preset.name,w.widgets,at,width,true,checkedAppIconData(preset.iconData)):createWidgetFromPreset(preset,w.widgets,at,width);return{...w,widgets:[...w.widgets,boundNewWidget(created,w.widgets,width)]}})}));notify(preset.name+' added as a new widget.')}
  function pickApp(workspaceId:string,widgetId?:string,at?:{x:number;y:number},width?:number){setAppTarget({workspaceId,widgetId,at,width});setModal('apps')}
  function addManagedApp(source:DroppedResource,name:string,save:boolean,window?:AppWindowChoice,icon?:number[]){
    const target=appTarget,owner=state.workspaces.find(w=>w.id===target?.workspaceId);if(!target||!owner)throw new Error('Choose a workspace first.');
    const existing=target.widgetId?owner.widgets.find(w=>w.id===target.widgetId&&w.type==='apps'):undefined;
    if(target.widgetId&&!existing)throw new Error('This widget was removed. Open the Apps picker again.');
    const created=managedAppWidget(source,name,owner.widgets,target.at,target.width,true,window?.icon??icon);
     const widget=existing?{...existing,title:created.title,appName:created.appName,appKey:created.appKey,appIconData:created.appIconData,appPanelOpen:true,appReuseExisting:true,appMinWidth:undefined,appMinHeight:undefined}:created;
     const preset=save?presetFromWidget(widget):null;undo.current=state;
    if(window)setAppAttachments(current=>({...current,[widget.id]:{hwnd:window.hwnd,pid:window.pid}}));
     setState(s=>({...s,presets:preset?upsertSavedPresets(s.presets,[preset]):s.presets,workspaces:s.workspaces.map(w=>w.id!==owner.id?w:{...w,widgets:existing?w.widgets.map(i=>i.id===widget.id?boundNewWidget(widget,w.widgets,target.width):i):[...w.widgets,boundNewWidget(widget,w.widgets,target.width)]})}));
    setModal(null);setAppTarget(null);notify(widget.title+(window?' is attaching.':' is opening in its panel.')+(save?' Saved in Apps.':''));
  }
  function finishAppAttachment(id:string,attachment:AppAttachment){if(attachment.capture)captureInFlight.current.delete(`${attachment.hwnd}:${attachment.pid}`);setAppAttachments(current=>{if(current[id]?.hwnd!==attachment.hwnd||current[id]?.pid!==attachment.pid)return current;const next={...current};delete next[id];return next})}
  useEffect(()=>{if(!appCapture.available)return;let disposed=false,unlisten:(()=>void)|undefined;
    const onCapture=async(result:import('./platform/appCapture.ts').AppCaptureResult)=>{
      if(disposed)return;
      if(result.kind==='failure'){notify(`Capture ${result.stage} failed: ${result.message}`);return}
      const key=`${result.hwnd}:${result.pid}`;if(captureInFlight.current.has(key))return;
      captureInFlight.current.add(key);
      const snapshot=captureState.current,owner=snapshot.workspaces.find(item=>item.id===snapshot.activeId);
      if(!owner){captureInFlight.current.delete(key);notify('The clicked app could not be attached because its workspace is unavailable.');return}
       try{
        const icon=await appPanel.icon({hwnd:result.hwnd,pid:result.pid}).catch(()=>undefined);
        const title=result.title.trim().slice(0,60)||'Attached app';
         if(disposed){captureInFlight.current.delete(key);return}
         const widget=boundNewWidget(managedAppWidget({sourceId:null,name:title},title,owner.widgets,undefined,undefined,false,icon),owner.widgets);
        undo.current=snapshot;
         setState(current=>({...current,workspaces:current.workspaces.map(item=>item.id===owner.id?{...item,widgets:[...item.widgets,widget]}:item)}));
        setAppAttachments(current=>({...current,[widget.id]:{hwnd:result.hwnd,pid:result.pid,capture:true}}));
         notify(title+' attached. Save it to the Apps tray from its widget when needed.');
       }catch(error){captureInFlight.current.delete(key);notify('Capture widget could not be created: '+String(error))}
    };
    void appCapture.subscribe(onCapture).then(stop=>{if(disposed){stop();return}unlisten=stop;return appCapture.enable()}).catch(error=>notify('Global capture could not start: '+String(error)));
    return()=>{disposed=true;unlisten?.()};
  },[]);
  function saveAppWidget(id:string){const widget=state.workspaces.flatMap(w=>w.widgets).find(w=>w.id===id);if(!widget)return;try{savePresets([presetFromWidget({...widget,title:widget.title.trim()||widget.appName||'App'})])}catch(reason){notify(String(reason))}}
  function openDropped(workspaceId:string,items:WidgetPreset[],at:{x:number;y:number},width:number){
    const checked=items.map(widgetPreset);if(!checked.length)return;undo.current=state;
    setState(s=>({...s,workspaces:s.workspaces.map(w=>{if(w.id!==workspaceId)return w;const widgets=[...w.widgets];for(const [index,preset] of checked.entries()){const created=createWidgetFromPreset(preset,widgets,{x:at.x+index*24,y:at.y+index*24},width);widgets.push(boundNewWidget(created,widgets,width))}return{...w,widgets}})}));
    notify(checked.length===1?checked[0].name+' added as a new widget.':checked.length+' widgets added. Drag them onto their tray buttons to save shortcuts.');
  }
  function openGroupResource(_workspaceId:string,link:WebShortcut,_at?:{x:number;y:number}){void openExternalUrl(link.url).then(()=>notify(link.name+' opened in your default browser.')).catch(error=>notify('Could not open '+link.name+': '+String(error)))}

  function bringToFront(id:string){setState(s=>({...s,workspaces:s.workspaces.map(w=>w.id===s.activeId?{...w,widgets:[...w.widgets.filter(i=>i.id!==id),...w.widgets.filter(i=>i.id===id)]}:w)}))}
  function startCreate(){setName('');setChosen(['desmos','notes']);setFormError('');setModal('create')}
  function submitWorkspace(){try{if(modal==='rename'){const valid=workspaceName(name);setState(s=>({...s,workspaces:s.workspaces.map(w=>w.id===s.activeId?{...w,name:valid}:w)}))}else{const created=createWorkspace(name,chosen);setState(s=>({...s,activeId:created.id,workspaces:[...s.workspaces,created]}));}setModal(null);setArrange(false)}catch(error){setFormError(String(error instanceof Error?error.message:error))}}
  function duplicate(){const copy=duplicateWorkspace(workspace,workspace.name.slice(0,55)+' copy');setState(s=>({...s,activeId:copy.id,workspaces:[...s.workspaces,copy]}));notify('Workspace duplicated with independent widget instances.')}
  function removeWorkspace(){if(state.workspaces.length===1){notify('Keep at least one workspace.');return}undo.current=state;const remaining=state.workspaces.filter(w=>w.id!==state.activeId);setState(s=>({...s,workspaces:remaining,activeId:remaining[0].id}));setArrange(false);notify('Workspace removed. '+shortcutLabel(state.shortcuts.undo)+' restores it.')}
  function assistantDimensions(){const viewport=document.querySelector<HTMLElement>('.workspace-surface:not([hidden]) .canvas-viewport');return{width:canvasExtent(viewport?.clientWidth??1000,[]),height:canvasHeight(viewport?.clientHeight??700,[])}}
  async function applyAssistantActions(workspaceId:string,actions:AssistantAction[],prompt:string):Promise<string>{
    const initial=captureState.current,initialWorkspace=initial.workspaces.find(item=>item.id===workspaceId);
    if(!initialWorkspace||initial.activeId!==workspaceId)throw new Error('The active workspace changed. Nothing was changed; try again.');
    const initialTray=assistantTrayItems(initial.presets,initialWorkspace.groups);
    validateAssistantActions(initialWorkspace,actions,initialTray);validateAssistantActionIntent(prompt,initialWorkspace,actions,initialTray);
    let nextPresets=initial.presets;const saved:string[]=[],failed:string[]=[];
    for(const action of actions){
      if(action.type!=='save_to_tray')continue;
      for(const id of action.ids){
        const current=captureState.current,owner=current.workspaces.find(item=>item.id===workspaceId),widget=owner?.widgets.find(item=>item.id===id);
        if(!widget||current.activeId!==workspaceId)throw new Error('The workspace changed before the action finished. Nothing was changed; try again.');
        try{
          let reusable=widget;
          if(widget.type==='apps'&&!widget.appKey){
            if(!appPanel.available)throw new Error('App shortcuts are unavailable outside the Still desktop app.');
            const attachment=appAttachments[widget.id]??await appPanel.identity(widget.id);
            if(!attachment)throw new Error('Attach an application shortcut before saving this Apps widget.');
            const shortcut=await appPanel.prepare(attachment);
            if(shortcut.kind!=='app'||!shortcut.sourceId)throw new Error('Windows could not create a reusable shortcut for this app.');
            reusable={...widget,appKey:shortcut.sourceId,appName:shortcut.name};
          }
          const preset=presetFromWidget(reusable);nextPresets=upsertSavedPresets(nextPresets,[preset]);saved.push(widget.title.trim()||widgetRegistry[widget.type].name);
        }catch(reason){failed.push(`${widget.title.trim()||widgetRegistry[widget.type].name}: ${String((reason as Error).message??reason)}`)}
      }
    }
    const current=captureState.current,owner=current.workspaces.find(item=>item.id===workspaceId);
    if(!owner||current.activeId!==workspaceId)throw new Error('The active workspace changed. Nothing was changed; try again.');
    const tray=assistantTrayItems(current.presets,owner.groups);
    validateAssistantActions(owner,actions,tray);validateAssistantActionIntent(prompt,owner,actions,tray);
    const size=assistantDimensions();let nextWorkspace=applyAssistantWidgetActions(owner,actions,size.width,size.height,Date.now(),tray);
    let opened=0,alreadyOpen=0;
    const openAction=actions.find(action=>action.type==='open_saved');
    if(openAction){
      if(nextWorkspace.widgets.length+openAction.ids.length>MAX_ASSISTANT_WIDGETS)throw new Error(`This workspace is limited to ${MAX_ASSISTANT_WIDGETS} widgets so it stays responsive. Nothing was changed.`);
      for(const id of openAction.ids){
        const item=tray.find(candidate=>candidate.id===id);
        if(!item)throw new Error('A saved tray item changed before the action could run. Nothing was changed. Try again.');
        if(item.kind==='group'){
          const groupId=id.slice('group-'.length),openedWorkspace=openSavedGroup(nextWorkspace,groupId,undefined,size.width),last=openedWorkspace.widgets.at(-1);
          nextWorkspace=last?{...openedWorkspace,widgets:[...openedWorkspace.widgets.slice(0,-1),boundNewWidget(last,openedWorkspace.widgets.slice(0,-1),size.width)]}:openedWorkspace;
        }else{
          const preset=current.presets.find(candidate=>`preset-${candidate.id}`===id);
          if(!preset)throw new Error('A saved shortcut changed before the action could run. Nothing was changed. Try again.');
          if(preset.type==='apps'&&savedAppInUse({...current,workspaces:current.workspaces.map(workspace=>workspace.id===workspaceId?nextWorkspace:workspace)},preset)){alreadyOpen++;continue}
          const widgets=nextWorkspace.widgets;
          const created=preset.type==='apps'&&appPanel.available?managedAppWidget({sourceId:preset.appSourceId,name:preset.appName},preset.name,widgets,undefined,size.width,true,checkedAppIconData(preset.iconData)):createWidgetFromPreset(preset,widgets,undefined,size.width);
          nextWorkspace={...nextWorkspace,widgets:[...widgets,boundNewWidget(created,widgets,size.width)]};
        }
        opened++;
      }
    }
    const removedIds=[...new Set(actions.filter(action=>action.type==='remove_widget').flatMap(action=>action.ids))];
    const removedWidgets=owner.widgets.filter(widget=>removedIds.includes(widget.id));
    if(removedWidgets.length)nextWorkspace={...nextWorkspace,widgets:nextWorkspace.widgets.filter(widget=>!removedIds.includes(widget.id))};
    if(nextWorkspace.widgets.length>MAX_ASSISTANT_WIDGETS)throw new Error(`This workspace is limited to ${MAX_ASSISTANT_WIDGETS} widgets so it stays responsive. Nothing was changed.`);
    const minimized=actions.filter(action=>action.type==='minimize').flatMap(action=>action.ids).filter(id=>owner.widgets.find(widget=>widget.id===id)?.minimized===false&&nextWorkspace.widgets.find(widget=>widget.id===id)?.minimized===true);
    const restored=actions.filter(action=>action.type==='restore').flatMap(action=>action.ids).filter(id=>owner.widgets.find(widget=>widget.id===id)?.minimized===true&&nextWorkspace.widgets.find(widget=>widget.id===id)?.minimized===false);
    const requestedRename=actions.find(action=>action.type==='rename_workspace')?.title;
    const renamed=requestedRename?workspaceName(requestedRename.trim()):undefined;
    const sidebarActions=actions.filter(action=>action.type==='set_sidebar_plugin');
    const nextSidebarPlugins=[...current.sidebarPlugins];
    const changedSidebarPlugins=new Map<SidebarPlugin,boolean>();
    for(const action of sidebarActions)for(const plugin of action.ids as SidebarPlugin[]){const index=nextSidebarPlugins.indexOf(plugin);const changed=action.enabled?index<0:index>=0;changedSidebarPlugins.set(plugin,changed);if(action.enabled&&index<0)nextSidebarPlugins.push(plugin);if(!action.enabled&&index>=0)nextSidebarPlugins.splice(index,1)}
    const nextWorkspaceRecord=renamed?{...nextWorkspace,name:renamed.trim()}:nextWorkspace;
    const stateChanged=nextWorkspaceRecord!==owner||nextPresets!==current.presets||nextSidebarPlugins.length!==current.sidebarPlugins.length||nextSidebarPlugins.some((plugin,index)=>plugin!==current.sidebarPlugins[index]);
    if(stateChanged){undo.current=current;setState({...current,presets:nextPresets,sidebarPlugins:nextSidebarPlugins,workspaces:current.workspaces.map(item=>item.id===workspaceId?nextWorkspaceRecord:item)});if(sidebarActions.some(action=>action.enabled===false&&action.ids.includes('layout')))setLayoutMode(null)}
    const removedAppIds=removedWidgets.filter(widget=>widget.type==='apps').map(widget=>widget.id);
    if(removedAppIds.length){setAppAttachments(attachments=>Object.fromEntries(Object.entries(attachments).filter(([id])=>!removedAppIds.includes(id))));for(const id of removedAppIds)if(appPanel.available)void appPanel.release(id).catch(error=>notify('Widget removed, but its attached app could not be released to the desktop: '+String(error)));}
    const result:string[]=[];
    if(actions.some(action=>action.type==='minimize'))result.push(minimized.length?`Minimized ${minimized.length} widget${minimized.length===1?'':'s'} as compact cards on the canvas.`:'Those widgets were already minimized.');
    if(actions.some(action=>action.type==='restore'))result.push(restored.length?`Restored ${restored.length} widget${restored.length===1?'':'s'}.`:'Those widgets were already restored.');
    const addedReceipt=assistantAddedWidgetReceipt(actions);if(addedReceipt)result.push(addedReceipt);
    if(renamed)result.push(`Renamed this workspace to ${renamed.trim()}.`);
    for(const action of sidebarActions)result.push(action.ids.map(plugin=>{const name=plugin==='stack'?'Stack':'Layout';return changedSidebarPlugins.get(plugin as SidebarPlugin)?`${action.enabled?'Added':'Removed'} ${name}`:`${name} was already ${action.enabled?'added':'removed'}`}).join('; ')+'.');
    for(const action of actions.filter(item=>item.type==='set_widget_plugin'))result.push(`${action.enabled?'Added':'Removed'} the Clock timer ${action.enabled?'to':'from'} ${action.ids.map(id=>{const widget=nextWorkspace.widgets.find(item=>item.id===id);return widget?.title||widget&&widgetRegistry[widget.type].name||'widget'}).join(', ')}.`);
    for(const action of actions.filter(item=>item.type==='edit_widget'))result.push(`Updated ${action.ids.map(id=>{const widget=nextWorkspace.widgets.find(item=>item.id===id);return widget?.title||widget&&widgetRegistry[widget.type].name||'widget'}).join(', ')}.`);
    if(removedWidgets.length)result.push(`Removed ${removedWidgets.map(widget=>widget.title.trim()||widgetRegistry[widget.type].name).join(', ')} from ${owner.name}. Saved shortcuts stay in the tray; Undo change restores the widget${removedWidgets.length===1?'':'s'}.`);
    if(actions.some(action=>action.type==='save_to_tray'))result.push(saved.length?`Saved ${saved.length} reusable shortcut${saved.length===1?'':'s'} to the widget tray. The original widgets stay open.`:'No reusable shortcuts were saved.');
    if(openAction)result.push(opened?`Opened ${opened} saved tray item${opened===1?'':'s'} in ${owner.name}.${alreadyOpen?` ${alreadyOpen} app shortcut${alreadyOpen===1?' was':'s were'} already open.`:''}`:`No saved items were opened.${alreadyOpen?` ${alreadyOpen} app shortcut${alreadyOpen===1?' was':'s were'} already open.`:''}`);
    for(const action of actions.filter(item=>item.type==='set_timer')){const seconds=action.seconds??0,label=seconds%3600===0?`${seconds/3600} hour${seconds===3600?'':'s'}`:seconds%60===0?`${seconds/60} minute${seconds===60?'':'s'}`:`${seconds} seconds`;const names=action.ids.map(id=>{const widget=nextWorkspace.widgets.find(item=>item.id===id);return widget?widget.title||widgetRegistry[widget.type].name:''}).filter(Boolean);result.push(`Started a ${label} timer on ${names.join(', ')}.`)}
    if(failed.length)result.push(`Could not save: ${failed.join('; ')}`);
    return result.join(' ');
  }
  async function clearAssistantTray(workspaceId:string):Promise<string>{
    const current=captureState.current,owner=current.workspaces.find(item=>item.id===workspaceId);
    if(!owner||current.activeId!==workspaceId)throw new Error('The active workspace changed. Nothing was removed; try again.');
    if(!current.presets.length&&!owner.groups.length)return 'The widget tray is already empty. Nothing changed.';
    const groupIds=new Set(owner.groups.map(group=>group.id));
    undo.current=current;
    setState({...current,presets:[],workspaces:current.workspaces.map(item=>item.id===workspaceId?{...item,groups:[],widgets:item.widgets.filter(widget=>!widget.groupId||!groupIds.has(widget.groupId))}:item)});
    for(const group of owner.groups)for(const entry of group.widgets)if(entry.kind==='collected'&&entry.type==='apps'&&appPanel.available)void appPanel.release(entry.id).catch(error=>notify('Tray cleared, but '+entry.name+' could not be released from its native panel: '+String(error)));
    return `Removed ${current.presets.length} saved shortcut${current.presets.length===1?'':'s'} from the shared tray and ${owner.groups.length} Group${owner.groups.length===1?'':'s'} from ${owner.name}. Undo change restores the saved tray data.`;
  }
  async function deleteAssistantWidgets(workspaceId:string):Promise<string>{
    const current=captureState.current,owner=current.workspaces.find(item=>item.id===workspaceId);
    if(!owner||current.activeId!==workspaceId)throw new Error('The active workspace changed. Nothing was removed; try again.');
    if(!owner.widgets.length)return `There are no widgets in ${owner.name}. Nothing changed.`;
    const count=owner.widgets.length,appIds=owner.widgets.filter(widget=>widget.type==='apps').map(widget=>widget.id);
    undo.current=current;
    setState({...current,workspaces:current.workspaces.map(item=>item.id===workspaceId?{...item,widgets:[]}:item)});
    setAppAttachments(attachments=>Object.fromEntries(Object.entries(attachments).filter(([id])=>!appIds.includes(id))));
    for(const id of appIds)if(appPanel.available)void appPanel.release(id).catch(error=>notify('Widgets removed, but an attached app could not be released to the desktop: '+String(error)));
    return `Removed ${count} widget${count===1?'':'s'} from ${owner.name}. Saved shortcuts and Groups in the tray were kept. Undo change restores the widget cards; attached app windows were returned to the desktop.`;
  }
  async function deleteAssistantWorkspace(workspaceId:string):Promise<string>{
    const current=captureState.current,owner=current.workspaces.find(item=>item.id===workspaceId);
    if(!owner||current.activeId!==workspaceId)throw new Error('The active workspace changed. Nothing was deleted; try again.');
    if(current.workspaces.length<=1)throw new Error('Still must keep at least one workspace. Nothing was deleted.');
    const remaining=current.workspaces.filter(item=>item.id!==workspaceId),appIds=[...owner.widgets.filter(widget=>widget.type==='apps').map(widget=>widget.id),...owner.groups.flatMap(group=>group.widgets.filter(entry=>entry.kind==='collected'&&entry.type==='apps').map(entry=>entry.id))];
    undo.current=current;setState({...current,activeId:remaining[0].id,workspaces:remaining});setArrange(false);setLayoutMode(null);
    setAppAttachments(attachments=>Object.fromEntries(Object.entries(attachments).filter(([id])=>!appIds.includes(id))));
    for(const id of appIds)if(appPanel.available)void appPanel.release(id).catch(error=>notify('Workspace deleted, but an attached app could not be released to the desktop: '+String(error)));
    notify(`Deleted ${owner.name}. Switched to ${remaining[0].name}. Undo change restores the workspace.`);
    return `Deleted ${owner.name}. Switched to ${remaining[0].name}. Undo change restores the workspace and its widget cards; attached app windows were returned to the desktop.`;
  }
  async function startAssistantTimer(workspaceId:string,seconds:number):Promise<string>{
    const current=captureState.current,owner=current.workspaces.find(item=>item.id===workspaceId);
    if(!owner||current.activeId!==workspaceId)throw new Error('The active workspace changed. Nothing was changed; try again.');
    const size=assistantDimensions(),next=addFocusForAssistantTimer(owner,size.width,size.height,seconds);
    undo.current=current;setState({...current,workspaces:current.workspaces.map(item=>item.id===workspaceId?next:item)});
    const label=seconds%3600===0?`${seconds/3600} hour${seconds===3600?'':'s'}`:seconds%60===0?`${seconds/60} minute${seconds===60?'':'s'}`:`${seconds} seconds`;
    return `Added a Focus widget and started a ${label} timer.`;
  }
  function applyAssistantLayout(plan:LayoutPlan){const current=captureState.current,owner=current.workspaces.find(w=>w.id===current.activeId)!;const size=assistantDimensions(),next=applyLayoutPlan(owner,plan,size.width,size.height);undo.current=current;setState({...current,workspaces:current.workspaces.map(w=>w.id===owner.id?next:w)});notify('AI layout applied. Undo layout or '+shortcutModifier+'+Z restores it.')}
  function undoAssistantLayout(){if(!undo.current){notify('No previous layout to restore.');return}setState(undo.current);undo.current=null;notify('Previous workspace layout restored.')}
  const commands=[{label:'Open AI assistant',run:()=>setAssistantOpen(true)},...state.workspaces.map(w=>({label:'Switch to '+w.name,run:()=>switchWorkspace(w.id)})),{label:'Create workspace',run:startCreate},{label:'Add widget',run:()=>setModal('gallery')},{label:'Settings',run:()=>{setSettingsTab('general');setModal('settings')}},{label:'Change appearance',run:()=>{setSettingsTab('appearance');setModal('settings')}},{label:'Keyboard shortcuts',run:()=>setModal('shortcuts')},{label:'Arrange workspace',run:()=>setArrange(true)},{label:sidebarHidden||focusMode?'Show sidebar':sidebarToggleLabel(state.sidebarCollapsed),run:toggleSidebar},{label:widgetTrayHidden||focusMode?'Show widget tray':'Hide widget tray',run:toggleWidgetTray}];
  const matches=commands.filter(c=>c.label.toLowerCase().includes(query.toLowerCase()));
  useEffect(()=>{function onKey(event:KeyboardEvent){if(event.isComposing||modal)return;const editing=!!(event.target as HTMLElement)?.closest('input,textarea,select,[contenteditable=true],[role=textbox]');const action=shortcutAction(event,state.shortcuts,editing);if(!action)return;if((action==='overview'||action==='undo'||action.startsWith('workspace:'))&&editing)return;if(action==='clickThrough'&&!state.enableWholeWindowClickThrough)return;event.preventDefault();if(!event.repeat)runShortcut(action)}document.addEventListener('keydown',onKey);return()=>document.removeEventListener('keydown',onKey)},[state,modal]);
  const sidebarVisible=!sidebarHidden&&!focusMode,widgetTrayVisible=!widgetTrayHidden&&!focusMode;
  return <div className={"app canvas-app "+(state.sidebarCollapsed?"sidebar-collapsed":"sidebar-expanded")+(focusMode?' focus-mode':'')+(sidebarHidden?' sidebar-hidden':'')+(widgetTrayHidden?' widget-tray-hidden':'')+(assistantOpen?' assistant-open':'')}><aside id="workspace-sidebar" className="sidebar"><div className="brand"><span className="brand-mark" aria-hidden="true"><i/><i/><i/></span><span className="brand-text">still.</span></div><p className="personal">Your space, at your pace.</p><p className="eyebrow side-label">Workspaces</p><nav className="nav" aria-label="Workspaces">{state.workspaces.map((w,index)=><button key={w.id} data-workspace-drop-target={w.id} data-drop-active={workspaceDropTarget===w.id||undefined} className={(w.id===state.activeId?'active ':'')+(workspaceDropTarget===w.id?'workspace-drop-active':'')} aria-current={w.id===state.activeId?'page':undefined} title={w.name+' workspace'+(workspaceHasFinishedTimer(w)?' · timer complete':'')} aria-label={w.name+' workspace'+(workspaceHasFinishedTimer(w)?' · timer complete':'')} onClick={()=>switchWorkspace(w.id)}><Icon name="study"/><span className="nav-name">{w.name}</span><span className={'workspace-status-dot '+(workspaceHasFinishedTimer(w)?'timer-finished':'')} aria-hidden="true" title={workspaceHasFinishedTimer(w)?'Timer finished':'No completed timer'}/>{index<9&&<kbd>{index+1}</kbd>}</button>)}</nav><button className="new-workspace" onClick={startCreate} aria-label="New workspace" title="New workspace"><Icon name="add"/><span className="nav-name">New workspace</span></button><div className="sidebar-bottom"><div className="sidebar-plugin-list">{state.sidebarPlugins.map(plugin=>plugin==='stack'?<button key={plugin} title="Stack widgets" aria-label="Stack widgets" onClick={stackWidgets}><Icon name="stack"/><span className="nav-name">Stack</span></button>:<div className="sidebar-plugin-action" key={plugin}><button title="Snap workspace widgets into a layout" aria-label="Layout" aria-pressed={layoutMode!==null} onClick={()=>setLayoutMode(current=>current===null?'picker':null)}><Icon name="arrange"/><span className="nav-name">Layout</span></button>{layoutMode!==null&&<button type="button" className="sidebar-plugin-close" title="Exit layout mode" aria-label="Exit layout mode" onClick={()=>setLayoutMode(null)}>×</button>}</div>)}</div><button title="Add sidebar plugin" aria-label="Add sidebar plugin" onClick={()=>setModal('sidebarPlugins')}><Icon name="add"/><span className="nav-name">Add plugin</span></button><button title="AI assistant" aria-label="AI assistant" aria-expanded={assistantOpen} aria-controls="ai-sidebar" onClick={()=>setAssistantOpen(value=>!value)}><Icon name="ai"/><span className="nav-name">AI assistant</span></button><button title="Settings" aria-label="Settings" onClick={()=>{setSettingsTab('general');setModal('settings')}}><Icon name="settings"/><span className="nav-name">Settings</span></button><div className="profile"><div className="avatar">Y</div><div>Your workspace<small>{chromeLauncher.native?'Desktop · local':'Preview · local'}</small></div></div></div></aside>
    <main className="main"><button className="sidebar-edge-toggle" aria-label={sidebarVisible?sidebarToggleLabel(state.sidebarCollapsed):'Show sidebar'} title={sidebarVisible?sidebarToggleLabel(state.sidebarCollapsed):'Show sidebar'} aria-expanded={sidebarVisible&&!state.sidebarCollapsed} aria-controls="workspace-sidebar" onClick={toggleSidebar}><Icon name={sidebarVisible&&!state.sidebarCollapsed?'chevronLeft':'chevronRight'}/></button><header className="topbar"><div className="workspace-heading"><h1 className="topbar-workspace-name" title={workspace.name}>{workspace.name}</h1></div><div className="topbar-actions"><button aria-label={focusMode?'Exit focus mode':'Enter focus mode'} title={focusMode?'Exit focus mode':'Enter focus mode'} aria-pressed={focusMode} onClick={()=>setFocusMode(value=>!value)}><Icon name="focus"/></button><button className="search" aria-label="Find an action" onClick={()=>{setQuery('');setModal('commands')}}><Icon name="search"/><span className="search-label">Find an action…</span><kbd>{shortcutLabel(state.shortcuts.commandPalette)}</kbd></button>{isTauri()&&<button className="topbar-fullscreen" aria-label={fullscreen?'Exit fullscreen':'Enter fullscreen'} title={fullscreen?'Exit fullscreen':'Enter fullscreen'} onClick={()=>void toggleFullscreen()}><Icon name="fullscreen"/><span className="topbar-action-label">{fullscreen?'Windowed':'Fullscreen'}</span></button>}</div></header><div className="content">
    {arrange&&<div className="workspace-tools"><span className="muted">Make this space yours.</span><button onClick={()=>{setName(workspace.name);setFormError('');setModal('rename')}}>Rename</button><button onClick={duplicate}>Duplicate</button><button onClick={removeWorkspace} disabled={state.workspaces.length===1}>Remove workspace</button></div>}
    {state.workspaces.filter(w=>visited.current.has(w.id)).map(w=><div key={w.id} className="workspace-surface" hidden={w.id!==state.activeId} inert={w.id!==state.activeId}><WorkspaceCanvas workspaceId={w.id} canvasFrameRate={state.canvasFrameRate} minimizeModifiers={state.shortcuts.minimizeModifiers} transferWidget={transferWidget} setWorkspaceDropTarget={setWorkspaceDropTarget} editTray={()=>setModal('trayEdit')} widgetTrayVisible={widgetTrayVisible} toggleWidgetTray={toggleWidgetTray} openAppsDialog={()=>openAppsTrayDialog(w.id)} appAttachments={appAttachments} appAttachmentHandled={finishAppAttachment} pickApp={(id,at,width)=>pickApp(w.id,id,at,width)} saveApp={saveAppWidget} presets={state.presets} savePresets={savePresets} openDropped={(items,at,width)=>openDropped(w.id,items,at,width)} openPreset={(preset,at,width)=>openPreset(w.id,preset,at,width)} editPreset={editPreset} removePreset={removePreset} renamePreset={startPresetRename} renameGroup={id=>startGroupRename(w.id,id)} widgets={w.widgets} groups={w.groups} updateGroup={(id,patch)=>changeGroup(w.id,id,patch)} saveToGroup={(widget,groupId,preserveUndo)=>saveWidgetInGroup(w.id,widget,groupId,preserveUndo)} openGroup={(id,at,width)=>showGroup(w.id,id,at,width)} editGroup={editGroup} removeGroup={id=>removeGroup(w.id,id)} openGroupWidget={(entry,at,width)=>openGroupWidget(w.id,entry,at,width)} update={updateWidget} add={addWidget} remove={removeWidget} begin={()=>{undo.current=state}} bringToFront={bringToFront} notify={notify} obscured={!!modal} workspaceActive={w.id===state.activeId} openResource={(link,at)=>openGroupResource(w.id,link,at)} startupDeferredIds={startupDeferred} startupRelaunch={startWidget} widgetRelaunchPluginStatus={state.widgetRelaunchPluginStatus} widgetRelaunchMode={state.widgetRelaunchMode} widgetRelaunchColors={state.widgetRelaunchColors} setRelaunchMode={setRelaunchMode} setRelaunchColor={setRelaunchColor} screenshotPluginMode={state.screenshotPluginMode} screenshotPluginColors={state.screenshotPluginColors} screenshotPluginColorOverrides={state.screenshotPluginColorOverrides} setScreenshotMode={setScreenshotMode} setScreenshotColor={setScreenshotColor} setScreenshotColorOverride={setScreenshotColorOverride} clockPluginMode={state.clockPluginMode} clockPluginColors={state.clockPluginColors} clockPluginColorOverrides={state.clockPluginColorOverrides} setClockPluginMode={setClockMode} setClockPluginColor={setClockColor} setClockPluginColorOverride={setClockColorOverride} showAppAttachAction={state.showAppAttachAction} showAppDetachAction={state.showAppDetachAction} showAppSaveAction={state.showAppSaveAction} showWidgetRelaunchAction={state.showWidgetRelaunchAction} showWidgetExportPngAction={state.showWidgetExportPngAction} layoutMode={layoutMode} setLayoutMode={setLayoutMode}/></div>)}
    <footer className="footer"><span><i className="dot"/>{storage}</span><span>{chromeLauncher.native?'DESKTOP · in-app browser':'PREVIEW · browser controls'}</span></footer></div></main>
    <AssistantPanel key={workspace.id} workspace={workspace} canDeleteWorkspace={state.workspaces.length>1} sidebarPlugins={state.sidebarPlugins} trayItems={assistantTrayItems(state.presets,workspace.groups)} open={assistantOpen} close={()=>setAssistantOpen(false)} dimensions={assistantDimensions} apply={applyAssistantLayout} act={applyAssistantActions} startTimer={startAssistantTimer} clearTray={clearAssistantTray} deleteWidgets={deleteAssistantWidgets} deleteWorkspace={deleteAssistantWorkspace} undo={undoAssistantLayout}/>
    {modal==='trayEdit'&&<Modal title="Edit widget tray" close={()=>setModal(null)}><TrayEditor widgets={workspace.widgets} groups={workspace.groups} presets={state.presets} add={type=>type==='apps'?openAppsTrayDialog(workspace.id):addWidget(type)} editPreset={editPreset} renamePreset={startPresetRename} removePreset={removePreset} editGroup={editGroup} renameGroup={id=>startGroupRename(workspace.id,id)} openGroup={id=>{showGroup(workspace.id,id);setModal(null)}} removeGroup={id=>removeGroup(workspace.id,id)} removeWidget={removeWidget} hideSidebar={hideSidebar} hideWidgetTray={hideWidgetTray} arrange={()=>{setArrange(value=>!value);setModal(null)}} attach={()=>openAppsTrayDialog(workspace.id)}/></Modal>}
    {modal==='renameSaved'&&savedRename&&<Modal title={savedRename.kind==='group'?'Rename group':'Rename saved shortcut'} close={cancelSavedRename}><form onSubmit={event=>{event.preventDefault();saveSavedRename()}}><label className="field-label">Name<input className="palette-input" aria-label="Saved item name" value={savedRename.name} maxLength={60} autoFocus required onChange={event=>setSavedRename(current=>current?{...current,name:event.target.value}:current)} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();cancelSavedRename()}}}/></label>{formError&&<p className="widget-error" role="alert">{formError}</p>}<div className="tray-editor-actions"><button type="button" onClick={cancelSavedRename}>Cancel</button><button className="primary" type="submit">Save name</button></div></form></Modal>}
    {modal==='delete'&&pendingRemoval&&<Modal title={pendingRemoval.kind==='group'?'Delete '+pendingRemoval.name+' and its contents?':'Remove '+pendingRemoval.name+'?'} close={()=>{setPendingRemoval(null);setModal(null)}}><p className="notice">{pendingRemoval.kind==='widget'?'Remove this Group card from the workspace? Its collected widgets remain in the saved Group and can be restored from the tray.':'Delete this Group and all of its saved widgets and links? Native applications will be released to the desktop.'}</p><div className="tray-editor-actions"><button autoFocus onClick={()=>{setPendingRemoval(null);setModal(null)}}>Cancel</button><button onClick={()=>performRemoval(pendingRemoval)}>{pendingRemoval.kind==='group'?'Delete All':'Confirm removal'}</button></div></Modal>}
    {modal==='gallery' &&<Modal title="Add a widget" close={()=>setModal(null)}><p className="notice">Each widget belongs to this workspace.</p>{widgetTypes.map(type=><button className="gallery-item" key={type} onClick={()=>addWidget(type)}><Icon name={widgetRegistry[type].icon}/><span>{widgetRegistry[type].name}<small>{widgetRegistry[type].description}</small></span><span>+</span></button>)}</Modal>}
    {modal==='sidebarPlugins'&&<Modal title="Add a sidebar plugin" close={()=>setModal(null)}><p className="notice">Add tools to your sidebar.</p><button className="gallery-item" aria-label="Add Stack plugin" disabled={state.sidebarPlugins.includes('stack')} onClick={()=>addSidebarPlugin('stack')}><Icon name="stack"/><span>Stack<small>Arrange open widgets and keep Groups/minimized widgets in a separate pile.</small></span><span>{state.sidebarPlugins.includes('stack')?'Added':'Add plugin'}</span></button><button className="gallery-item" aria-label="Add Layout plugin" disabled={state.sidebarPlugins.includes('layout')} onClick={()=>addSidebarPlugin('layout')}><Icon name="arrange"/><span>Layout<small>Snap open workspace widgets into highlighted areas, then offer other widgets for the remaining zones.</small></span><span>{state.sidebarPlugins.includes('layout')?'Added':'Add plugin'}</span></button></Modal>}{modal==='group'&&selectedGroup&&<Modal title={selectedGroup.name||'Edit group'} close={()=>setModal(null)}><GroupEditor key={selectedGroup.id+'-'+groupMode} group={selectedGroup} initialMode={groupMode} update={patch=>changeGroup(workspace.id,selectedGroup.id,patch)} openLink={link=>{openGroupResource(workspace.id,link);setModal(null)}} openWidget={entry=>{openGroupWidget(workspace.id,entry);setModal(null)}}/></Modal>}
    {modal==='preset'&&presetDraft&&<Modal title={(presetDraft.preset?'Edit custom ':'Custom ')+widgetRegistry[presetDraft.type].name} close={()=>setModal(null)}><PresetEditor key={presetDraft.preset?.id??presetDraft.type} type={presetDraft.type} preset={presetDraft.preset} save={savePreset} close={()=>setModal(null)}/></Modal>}
    {modal==='apps'&&appTarget&&<Modal title="Attach open app" close={()=>setModal(null)}><AppWindowPicker saveAppShortcutsOnAttach={state.saveAppShortcutsOnAttach} attach={(window,source,name,save)=>addManagedApp(source,name,save,window)} open={(source,name,save,icon)=>addManagedApp(source,name,save,undefined,icon)} close={()=>setModal(null)}/></Modal>}
    {modal==='appsTray'&&appTarget&&<Modal title="Apps" close={()=>setModal(null)}><div className="apps-dialog-tabs" role="tablist" aria-label="Apps actions"><button role="tab" aria-selected={appsDialogMode==='attach'} onClick={()=>setAppsDialogMode('attach')}>Attach Open App</button><button role="tab" aria-selected={appsDialogMode==='shortcut'} onClick={()=>{setPresetDraft({type:'apps'});setAppsDialogMode('shortcut')}}>Add saved shortcut</button></div>{appsDialogMode==='attach'?<AppWindowPicker saveAppShortcutsOnAttach={state.saveAppShortcutsOnAttach} attach={(window,source,appName,save)=>addManagedApp(source,appName,save,window)} open={(source,appName,save,icon)=>addManagedApp(source,appName,save,undefined,icon)} close={()=>setModal(null)}/>:<PresetEditor key={presetDraft?.type+'-'+presetDraft?.preset?.id} type="apps" preset={presetDraft?.preset} save={savePreset} close={()=>setModal(null)}/>}</Modal>}
    {modal==='settings'&&<Modal title="Settings" close={()=>setModal(null)}><div className="settings-dialog"><div className="settings-tabs" role="tablist" aria-label="Settings pages">{([{id:'general',label:'General'},{id:'appearance',label:'Appearance'},{id:'plugins',label:'Plugins'}] as const).map(tab=><button key={tab.id} id={'settings-tab-'+tab.id} type="button" role="tab" aria-selected={settingsTab===tab.id} aria-controls={'settings-'+tab.id} onClick={()=>setSettingsTab(tab.id)}>{tab.label}</button>)}</div>{settingsTab==='general'&&<GeneralSettings appShutdownBehavior={state.appShutdownBehavior} saveAppShortcutsOnAttach={state.saveAppShortcutsOnAttach} showAppAttachAction={state.showAppAttachAction} showAppDetachAction={state.showAppDetachAction} showAppSaveAction={state.showAppSaveAction} showWidgetRelaunchAction={state.showWidgetRelaunchAction} showWidgetExportPngAction={state.showWidgetExportPngAction} widgetRelaunchMode={state.widgetRelaunchMode} widgetRelaunchColors={state.widgetRelaunchColors} background={state.background} passThroughTransparentBackground={state.passThroughTransparentBackground} enableWholeWindowClickThrough={state.enableWholeWindowClickThrough} clickThroughActive={clickThroughActive} canvasFrameRate={state.canvasFrameRate} startup={startup} startupLoading={startupLoading} setStartupEnabled={enabled=>void setStartupEnabled(enabled)} toggleClickThrough={()=>void toggleClickThrough()} shortcuts={state.shortcuts} openShortcuts={()=>setModal('shortcuts')} setRelaunchColor={setRelaunchColor} applyRelaunchModeToAll={()=>applyRelaunchMode(state.widgetRelaunchMode)} update={patch=>setState(s=>({...s,...patch}))}/>}{settingsTab==='appearance'&&<section className="settings-page" role="tabpanel" id="settings-appearance" aria-labelledby="settings-tab-appearance"><AppearanceSettings state={state} update={patch=>setState(s=>({...s,...patch}))}/></section>}{settingsTab==='plugins'&&<section className="settings-page" role="tabpanel" id="settings-plugins" aria-labelledby="settings-tab-plugins"><h3>Sidebar plugins</h3>{state.sidebarPlugins.includes('stack')&&<div className="settings-row"><span>Stack</span><button type="button" aria-label="Remove Stack plugin" onClick={()=>removeSidebarPlugin('stack')}>Remove</button></div>}{state.sidebarPlugins.includes('layout')&&<div className="settings-row"><span>Layout<small>Snap open widgets into highlighted workspace zones.</small></span><button type="button" aria-label="Remove Layout plugin" onClick={()=>removeSidebarPlugin('layout')}>Remove</button></div>}{state.sidebarPlugins.length===0&&<p className="notice">No sidebar plugins added yet. Use + above Settings to add one.</p>}<WidgetPluginsSettings state={state} update={patch=>setState(s=>({...s,...patch}))} setRelaunchStatus={setRelaunchPluginStatus} setRelaunchColor={setRelaunchColor} setScreenshotColor={setScreenshotColor} setClockColor={setClockColor}/></section>}</div></Modal>}
    {modal==='shortcuts'&&<Modal title="Keyboard shortcuts" close={()=>setModal(null)}><ShortcutSettings shortcuts={state.shortcuts} save={saveShortcuts} close={()=>setModal(null)}/></Modal>}
    {(modal==='create'||modal==='rename')&&<Modal title={modal==='create'?'A space of your own.':'Rename workspace'} close={()=>setModal(null)}><form onSubmit={e=>{e.preventDefault();submitWorkspace()}}><label className="field-label">Workspace name<input className="palette-input" aria-label="Workspace name" placeholder="e.g. Engineering, Revision, Research…" value={name} maxLength={60} onChange={e=>setName(e.target.value)} autoFocus/></label>{modal==='create'&&<><p className="notice">Start with the tools you need. Change them any time.</p><div className="widget-choices">{widgetTypes.map(type=><label key={type}><input type="checkbox" checked={chosen.includes(type)} onChange={e=>setChosen(e.target.checked?[...chosen,type]:chosen.filter(t=>t!==type))}/><Icon name={widgetRegistry[type].icon}/>{widgetRegistry[type].name}</label>)}</div></>}{formError&&<p className="widget-error" role="alert">{formError}</p>}<button className="primary full" type="submit">{modal==='create'?'Create workspace':'Save name'}</button></form></Modal>}
    {modal==='commands'&&<Modal title="Find your next action" close={()=>setModal(null)}><input className="palette-input" aria-label="Search commands" placeholder="Search workspaces or actions…" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&matches[0]){setModal(null);matches[0].run()}}} autoFocus/>{matches.map((command,i)=><button className="gallery-item" key={i} onClick={()=>{setModal(null);command.run()}}>{command.label}</button>)}{!matches.length&&<p className="notice">No matching actions.</p>}</Modal>}
    {message&&<div className="toast" role="status">{message}</div>}
  </div>;
}
