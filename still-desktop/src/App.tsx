import { useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createWidgetFromPreset,createWidgetFromGroupEntry,openSavedGroup,updateSavedGroup,saveGroupName,collectWidgetIntoGroup,restoreCollectedWidget,transferWidgetInstance,deleteSavedGroup,savedGroupHasContents,stackWorkspaceWidgets, createInitialState, nextInstanceNumber, createWidget, createWorkspace, duplicateWorkspace, migratePreview, parseState, workspaceName, widgetTypes, checkedAppIconData,workspaceHasFinishedTimer, type WorkspaceState, type WidgetType, type WidgetInstance,type SavedGroup,type GroupWidgetEntry,type SidebarPlugin,type WidgetTagColor } from './domain/workspaces.ts';
import {startupDeferredWidgetIds,applyRelaunchModeToAll,type WidgetRelaunchMode,type WidgetRelaunchPluginStatus} from './domain/widgetRelaunch.ts';
import {type ClockPluginMode} from './domain/clockPlugin.ts';
import {createNoteDocument,NOTE_DOCUMENT_LIMIT} from './domain/noteDocuments.ts';
import { Icon } from './Icon.tsx';
import {LocaleContext,localizeOperationalMessage,translate,type Locale} from './localization.tsx';
import BrandMark from './BrandMark.tsx';
import { widgetRegistry } from './widgets.tsx';
import {chromeLauncher} from './platform/chrome.ts';
import {openExternalUrl} from './platform/externalUrl.ts';
import WorkspaceCanvas from './WorkspaceCanvas.tsx';
import DashboardHome from './DashboardHome.tsx';
import LibraryHome from './LibraryHome.tsx';
import AssistantPanel from './AssistantPanel.tsx';
import {addFocusForAssistantTimer,applyAssistantWidgetActions,applyLayoutPlan,assistantTrayItems,MAX_ASSISTANT_WIDGETS,MAX_ASSISTANT_WORKSPACES,validateAssistantActions,validateAssistantActionIntent,type AssistantAction,type LayoutPlan} from './domain/assistant.ts';
import {checkedCalendarEvents,checkedStudyCalendarDrafts,type StudyCalendarEventDraft} from './domain/studyCalendar.ts';
import {canvasExtent,canvasHeight,nextPlacement,placement,constrainPlacement} from './domain/layout.ts';
import type {SnapLayoutId} from './domain/snapLayouts.ts';
import { nativeShortcuts } from './platform/shortcuts.ts';
import { windowInput } from './platform/windowInput.ts';
import {startupSettings} from './platform/startup.ts';
import type {StartupStatus} from './domain/startup.ts';
import { interactiveHitRegions } from './domain/windowInput.ts';
import { adjacentWorkspaceId, shortcutAction, shortcutLabel, type AppShortcutAction, type WorkspaceDirection, type WorkspaceShortcuts } from './domain/shortcuts.ts';
import { updateAssistantShortcut } from './domain/assistant.ts';
import {decideCourseEnvironmentAction,dueCourseEnvironmentOccurrences,removeWorkspaceAndUnlinkCourseEnvironments,type CourseEnvironmentOccurrence} from './domain/courseEnvironments.ts';
import ShortcutSettings from './ShortcutSettings.tsx';
import GettingStartedTour from './GettingStartedTour.tsx';
import AppearanceSettings from './AppearanceSettings.tsx';
import LiquidChrome from './LiquidChrome.tsx';
import LineWaves from './LineWaves.tsx';
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
import {localFiles} from './platform/files.ts';
import {remapRecentLibraryFiles} from './domain/libraryRecents.ts';
import {appPanel,type AppAttachment} from './platform/appPanel.ts';
import {appCapture} from './platform/appCapture.ts';
import {getCurrentWindow} from '@tauri-apps/api/window';
import {isTauri} from '@tauri-apps/api/core';
const KEY='still-workspace-v2';
const TUTORIAL_KEY='still-first-run-tutorial-v1';
const MAX_LIBRARY_FOLDERS=40;
const shortcutModifier='Ctrl';
function displayWorkspaceName(workspace:WorkspaceState['workspaces'][number],locale:Locale){return workspace.role==='dashboard'?translate(locale,'dashboardWorkspace'):workspace.role==='library'?translate(locale,'library'):workspace.name}
function load():{state:WorkspaceState;warning:string}{
  try{
    const saved=localStorage.getItem(KEY);if(saved){const document=JSON.parse(saved) as {version?:number};const restored=parseState(document);if(document.version!==10)try{localStorage.setItem(KEY+'-before-browser-removal',saved)}catch{}return{state:restored,warning:''};}
    const old=localStorage.getItem('still-design-study-v1');if(old)return{state:migratePreview(JSON.parse(old)),warning:''};
  }catch{try{const original=localStorage.getItem(KEY);if(original)localStorage.setItem(KEY+'-recovery',original)}catch{}return{state:createInitialState(),warning:'Saved data could not be read. A recovery copy was retained where storage permits.'}}
  return{state:createInitialState(),warning:''};
}
function Modal({title,close,children}:{title:string;close:()=>void;children:ReactNode}){
  const ref=useRef<HTMLDialogElement>(null);
  const locale=useContext(LocaleContext);
  useEffect(()=>{ref.current?.showModal();return()=>ref.current?.close()},[]);
  return <dialog ref={ref} onCancel={close}><div className="dialog-head"><h2>{title}</h2><button onClick={close} aria-label={translate(locale,'closeDialog')}>×</button></div>{children}</dialog>;
}
type ModalType='gallery'|'settings'|'sidebarPlugins'|'shortcuts'|'tutorial'|'create'|'rename'|'renameSaved'|'commands'|'group'|'preset'|'apps'|'appsTray'|'trayEdit'|'delete'|'course-environments'|null;
const COURSE_ENVIRONMENT_HISTORY_KEY='still.course-environment-history.v1';
function readCourseEnvironmentHistory():Map<string,number>{try{const raw=JSON.parse(localStorage.getItem(COURSE_ENVIRONMENT_HISTORY_KEY)||'[]');if(!Array.isArray(raw))return new Map();const cutoff=Date.now()-14*24*60*60_000;return new Map(raw.filter((item):item is [string,number]=>Array.isArray(item)&&typeof item[0]==='string'&&typeof item[1]==='number'&&Number.isFinite(item[1])&&item[1]>=cutoff))}catch{return new Map()}}
export default function App(){
  const [initial]=useState(load);const [state,setState]=useState(initial.state);const [startupDeferred,setStartupDeferred]=useState(()=>startupDeferredWidgetIds(initial.state.workspaces,initial.state.widgetRelaunchPluginStatus,initial.state.widgetRelaunchMode,initial.state.widgetRelaunchColors));const [storage,setStorage]=useState(initial.warning||'Saved on this device');const [modal,setModal]=useState<ModalType>(null);const [courseEnvironmentOffer,setCourseEnvironmentOffer]=useState<Array<{workspaceId:string;workspaceName:string;occurrences:CourseEnvironmentOccurrence[]}>|null>(null);const [settingsTab,setSettingsTab]=useState<'general'|'appearance'|'plugins'>('general');const [arrange,setArrange]=useState(false);const [fullscreen,setFullscreen]=useState(false);const [clickThroughActive,setClickThroughActive]=useState(false);const [sidebarHidden,setSidebarHidden]=useState(false);const [sidebarPeek,setSidebarPeek]=useState(false);const [widgetTrayHidden,setWidgetTrayHidden]=useState(false);const [workspaceDropTarget,setWorkspaceDropTarget]=useState<string|null>(null);const [layoutMode,setLayoutMode]=useState<'picker'|SnapLayoutId|null>(null);const [appsDialogMode,setAppsDialogMode]=useState<'attach'|'shortcut'>('attach');const [message,setMessage]=useState('');const [name,setName]=useState('');const [chosen,setChosen]=useState<WidgetType[]>(['desmos','notes']);const [formError,setFormError]=useState('');const [query,setQuery]=useState('');const sidebarCloseTimer=useRef<ReturnType<typeof setTimeout>|null>(null);const undo=useRef<WorkspaceState|null>(null);const [handledCourseOccurrences]=useState(readCourseEnvironmentHistory);
  const [startup,setStartup]=useState<StartupStatus>({supported:false,enabled:false});const [startupLoading,setStartupLoading]=useState(true);
  const [assistantOpen,setAssistantOpen]=useState(false);
  const workspace=state.workspaces.find(w=>w.id===state.activeId)!;
  const libraryWorkspace=state.workspaces.find(w=>w.role==='library')??null;
  const [editingGroup,setEditingGroup]=useState<string|null>(null),[groupMode,setGroupMode]=useState<GroupEditMode>();
  const selectedGroup=workspace.groups.find(g=>g.id===editingGroup);
  const [presetDraft,setPresetDraft]=useState<{type:PresetType;preset?:WidgetPreset}|null>(null);
  const [savedRename,setSavedRename]=useState<{kind:'preset'|'group';id:string;workspaceId?:string;name:string}|null>(null);
  const [appTarget,setAppTarget]=useState<{workspaceId:string;widgetId?:string;at?:{x:number;y:number};width?:number}|null>(null);
  const [pendingRemoval,setPendingRemoval]=useState<{workspaceId:string;id:string;kind:'widget'|'group';preserveUndo:boolean;name:string}|null>(null);
  const [appAttachments,setAppAttachments]=useState<Record<string,AppAttachment>>({});
  const captureInFlight=useRef(new Set<string>()),pendingAppWidgets=useRef(new Map<string,{workspaceId:string;previous:WidgetInstance|null;name:string}>()),captureState=useRef(state);captureState.current=state;
  const latestState=useRef(state),persistTimer=useRef<ReturnType<typeof setTimeout>|null>(null),persistNow=useRef<()=>void>(()=>{});latestState.current=state;
  const visited=useRef(new Set<string>());visited.current.add(state.activeId);
  function notify(value:string){setMessage(localizeOperationalMessage(captureState.current.locale,value))}
  function rememberCourseOccurrences(occurrences:CourseEnvironmentOccurrence[],now=Date.now()){
    const history=handledCourseOccurrences;for(const occurrence of occurrences)history.set(occurrence.key,now);
    const cutoff=now-14*24*60*60_000;for(const [key,timestamp] of history)if(timestamp<cutoff)history.delete(key);
    try{localStorage.setItem(COURSE_ENVIRONMENT_HISTORY_KEY,JSON.stringify([...history]))}catch{}
  }
  function dismissCourseEnvironmentOffer(){setCourseEnvironmentOffer(null);setModal(null)}
  function openScheduledCourseEnvironment(workspaceId:string){
    const group=courseEnvironmentOffer?.find(item=>item.workspaceId===workspaceId);if(!group){dismissCourseEnvironmentOffer();return}
    const current=captureState.current;if(!current.autoOpenCourseEnvironments||!current.workspaces.some(item=>item.id===workspaceId)){dismissCourseEnvironmentOffer();return}
    const due=dueCourseEnvironmentOccurrences(current.workspaces,current.autoOpenCourseEnvironments,Date.now()),dueKeys=new Set(due.map(item=>item.key));
    if(!group.occurrences.some(item=>dueKeys.has(item.key))){dismissCourseEnvironmentOffer();return}
    setState(value=>value.workspaces.some(item=>item.id===workspaceId)?{...value,activeId:workspaceId}:value);setArrange(false);dismissCourseEnvironmentOffer();
  }
  function appOpenResult(id:string,success:boolean,error?:string){
    const pending=pendingAppWidgets.current.get(id);if(!pending)return;
    pendingAppWidgets.current.delete(id);if(success)return;
    setAppAttachments(current=>{const next={...current};delete next[id];return next});
    void appPanel.release(id).catch(()=>undefined);
    setState(current=>({...current,workspaces:current.workspaces.map(workspace=>{
      if(workspace.id!==pending.workspaceId)return workspace;
      if(!pending.previous)return{...workspace,widgets:workspace.widgets.filter(widget=>widget.id!==id)};
      const previous=pending.previous;
      return{...workspace,widgets:workspace.widgets.map(widget=>widget.id===id?{...widget,title:previous.title,appKey:previous.appKey,appName:previous.appName,appIconData:previous.appIconData,appPanelOpen:previous.appPanelOpen,appWasCollected:previous.appWasCollected,appReuseExisting:previous.appReuseExisting,appMinWidth:previous.appMinWidth,appMinHeight:previous.appMinHeight}:widget)};
    })}));
    notify(pending.previous?`Could not attach ${pending.name}: ${error??'the window is unavailable'}. The previous widget was restored.`:`Could not open ${pending.name}: ${error??'the app is unavailable'}. No widget was added.`);
  }
  function finishTutorial(){try{localStorage.setItem(TUTORIAL_KEY,'done')}catch{}setModal(null)}
  useEffect(()=>{let finished=false;try{finished=localStorage.getItem(TUTORIAL_KEY)==='done'}catch{}if(!finished)setModal(current=>current??'tutorial')},[]);
  useEffect(()=>{let disposed=false;if(!startupSettings.available){setStartupLoading(false);return}void startupSettings.status().then(value=>{if(!disposed)setStartup(value)}).catch(error=>{if(!disposed)notify('Still startup setting could not be read: '+String(error))}).finally(()=>{if(!disposed)setStartupLoading(false)});return()=>{disposed=true}},[]);
  async function setStartupEnabled(enabled:boolean):Promise<boolean>{setStartupLoading(true);try{setStartup(await startupSettings.setEnabled(enabled));return true}catch(error){notify('Still could not update its startup setting: '+String(error));return false}finally{setStartupLoading(false)}}
  useEffect(()=>{const open=()=>setAssistantOpen(true);window.addEventListener('still-open-assistant',open);return()=>window.removeEventListener('still-open-assistant',open)},[]);
  useEffect(()=>{if(!message)return;const timeout=setTimeout(()=>setMessage(''),4500);return()=>clearTimeout(timeout)},[message]);
  useEffect(()=>{
    function evaluateCourseEnvironments(){
      if(modal||document.visibilityState==='hidden')return;
      const current=captureState.current,now=Date.now();
      const due=dueCourseEnvironmentOccurrences(current.workspaces,current.autoOpenCourseEnvironments,now).filter(item=>!handledCourseOccurrences.has(item.key));
      const decision=decideCourseEnvironmentAction(due,current.activeId,new Set(current.workspaces.map(item=>item.id)));
      if(decision.kind==='none')return;
      if(decision.kind==='already-there'){rememberCourseOccurrences(decision.occurrences,now);return}
      if(decision.kind==='switch'){rememberCourseOccurrences(decision.occurrences,now);setState(value=>value.workspaces.some(item=>item.id===decision.workspaceId)?{...value,activeId:decision.workspaceId}:value);setArrange(false);return}
      for(const group of decision.groups)rememberCourseOccurrences(group.occurrences,now);
      setCourseEnvironmentOffer(decision.groups);setModal('course-environments');
    }
    const onVisible=()=>{if(document.visibilityState!=='hidden')evaluateCourseEnvironments()};
    evaluateCourseEnvironments();
    const interval=window.setInterval(evaluateCourseEnvironments,60_000);
    document.addEventListener('visibilitychange',onVisible);window.addEventListener('focus',evaluateCourseEnvironments);window.addEventListener('pageshow',evaluateCourseEnvironments);window.addEventListener('resume',evaluateCourseEnvironments);
    return()=>{window.clearInterval(interval);document.removeEventListener('visibilitychange',onVisible);window.removeEventListener('focus',evaluateCourseEnvironments);window.removeEventListener('pageshow',evaluateCourseEnvironments);window.removeEventListener('resume',evaluateCourseEnvironments)};
  },[modal]);
  useEffect(()=>{if(!isTauri())return;let disposed=false;const win=getCurrentWindow();void win.isFullscreen().then(value=>{if(!disposed)setFullscreen(value)}).catch(()=>{});const unlisten=win.onResized(()=>{void win.isFullscreen().then(value=>{if(!disposed)setFullscreen(value)}).catch(()=>{})});return()=>{disposed=true;void unlisten.then(stop=>stop())}},[]);
  useEffect(()=>{if(!windowInput.available)return;void windowInput.configureToggle(state.enableWholeWindowClickThrough).catch(()=>notify(translate(captureState.current.locale,'clickThroughShortcutConfigureFailed')));},[state.enableWholeWindowClickThrough]);
  useEffect(()=>{if(!windowInput.available)return;let disposed=false,unlisten:(()=>void)|undefined;windowInput.subscribe(active=>{if(!disposed)setClickThroughActive(active)}).then(stop=>{if(disposed)stop();else unlisten=stop}).catch(()=>notify(translate(captureState.current.locale,'clickThroughStatusReadFailed')));return()=>{disposed=true;unlisten?.()}},[]);
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
  },[state.background,state.passThroughTransparentBackground,state.activeId,modal,sidebarHidden,widgetTrayHidden]);
  useEffect(()=>{if(!appPanel.available)return;void appPanel.configureShutdown(state.appShutdownBehavior).catch(()=>notify(translate(captureState.current.locale,'appShutdownUpdateFailed')))},[state.appShutdownBehavior]);
  async function toggleFullscreen(){if(!isTauri())return;try{const win=getCurrentWindow(),next=!(await win.isFullscreen());await win.setFullscreen(next);setFullscreen(next)}catch(error){notify('Fullscreen could not be changed: '+String(error))}}
  useEffect(()=>{if(!fullscreen||modal)return;const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();void toggleFullscreen()}};document.addEventListener('keydown',onKey);return()=>document.removeEventListener('keydown',onKey)},[fullscreen,modal]);
  useEffect(()=>()=>{if(sidebarCloseTimer.current)clearTimeout(sidebarCloseTimer.current)},[]);
  useEffect(()=>{const app=document.querySelector<HTMLElement>('.canvas-app');if(!app)return;app.classList.toggle('fullscreen-taskbar-covered',fullscreen);const updateTaskbarHeight=()=>app.style.setProperty('--fullscreen-taskbar-height',Math.max(40,screen.height-screen.availHeight-Math.max(0,(screen as Screen&{availTop?:number}).availTop??0))+'px');if(fullscreen){updateTaskbarHeight();window.addEventListener('resize',updateTaskbarHeight)}else app.style.removeProperty('--fullscreen-taskbar-height');return()=>window.removeEventListener('resize',updateTaskbarHeight)},[fullscreen]);
  useEffect(()=>{
    document.body.classList.toggle('dark',state.theme==='dark');document.body.classList.toggle('compact',state.density==='compact');document.body.classList.toggle('dots',state.background==='dots');document.body.classList.toggle('transparent-background',state.background==='transparent');document.body.classList.toggle('liquid-glass',state.appearance==='liquid-glass');
    document.body.style.setProperty('--glass-alpha',String(state.glass.opacity/100));
  },[state.theme,state.density,state.background,state.appearance,state.glass.opacity]);
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
  function openLibraryWorkspace(){if(libraryWorkspace)switchWorkspace(libraryWorkspace.id)}
  function addDashboardCalendarEvent(){window.dispatchEvent(new Event('still-calendar-add-event'))}
  function askAiToPlanStudy(){setAssistantOpen(true);window.dispatchEvent(new CustomEvent('still-assistant-prompt',{detail:translate(state.locale,'planStudyPrompt').replace('{date}',new Intl.DateTimeFormat('en-CA').format(new Date()))}))}
  function runDashboardStudyAction(action:()=>void){const dashboard=captureState.current.workspaces.find(item=>item.role==='dashboard');if(!dashboard)return;switchWorkspace(dashboard.id);requestAnimationFrame(()=>requestAnimationFrame(()=>window.setTimeout(action,0)))}
  function moveWorkspace(direction:WorkspaceDirection){setState(s=>({...s,activeId:adjacentWorkspaceId(s.workspaces,s.activeId,direction)}));setArrange(false);}
  // One shared updater path for the header toggle button and the command-palette action.
  function openSidebarPeek(){if(sidebarCloseTimer.current){clearTimeout(sidebarCloseTimer.current);sidebarCloseTimer.current=null}setSidebarHidden(false);setSidebarPeek(true)}
  function closeSidebarPeek(){if(sidebarCloseTimer.current)clearTimeout(sidebarCloseTimer.current);sidebarCloseTimer.current=setTimeout(()=>{setSidebarPeek(false);sidebarCloseTimer.current=null},220)}
  function toggleSidebar(){if(sidebarPeek){setSidebarPeek(false);if(sidebarCloseTimer.current){clearTimeout(sidebarCloseTimer.current);sidebarCloseTimer.current=null}}else openSidebarPeek()}
  function hideSidebar(){setSidebarHidden(true);setSidebarPeek(false);setModal(null)}
  function toggleWidgetTray(){setWidgetTrayHidden(value=>!value)}
  function hideWidgetTray(){setWidgetTrayHidden(true);setModal(null)}
  function boundNewWidget(widget:WidgetInstance,widgets:WidgetInstance[],width?:number){const viewport=document.querySelector<HTMLElement>('.workspace-surface:not([hidden]) .canvas-viewport'),viewportWidth=viewport?.clientWidth??1000,viewportHeight=viewport?.clientHeight??700;const extent=width??canvasExtent(viewportWidth,[...widgets,widget]),height=canvasHeight(viewportHeight,widgets);return {...widget,placement:constrainPlacement(widget.type,widget.placement,extent,{width:widget.appPanelOpen?widget.appMinWidth:undefined,height:widget.appPanelOpen?widget.appMinHeight:undefined},height)}}
  function transferWidget(sourceWorkspaceId:string,widgetId:string,destinationId:string,previewPlacement?:WidgetInstance['placement'],previewRestorePlacement?:WidgetInstance['restorePlacement']){
    if(sourceWorkspaceId===destinationId)return;
    const source=state.workspaces.find(w=>w.id===sourceWorkspaceId),destination=state.workspaces.find(w=>w.id===destinationId),widget=source?.widgets.find(item=>item.id===widgetId);
    if(!source||!destination||!widget)return;
    if(widget.lockPluginEnabled&&widget.locked){notify(translate(captureState.current.locale,'unlockWidgetBeforeMove'));return}
    undo.current=state;
    const viewport=document.querySelector<HTMLElement>('.workspace-surface:not([hidden]) .canvas-viewport'),viewportWidth=viewport?.clientWidth??1000,viewportHeight=viewport?.clientHeight??700;
    const width=canvasExtent(viewportWidth,destination.widgets),height=canvasHeight(viewportHeight,destination.widgets);
    const sourceForTransfer=previewPlacement?{...source,widgets:source.widgets.map(item=>item.id===widgetId?{...item,placement:previewPlacement,...(previewRestorePlacement?{restorePlacement:previewRestorePlacement}:{})}:item)}:source;
    const transfer=transferWidgetInstance(sourceForTransfer,destination,widgetId,width,height);if(!transfer)return;
    setState(s=>({...s,activeId:s.followWidgetToWorkspace?destinationId:s.activeId,workspaces:s.workspaces.map(w=>w.id===sourceWorkspaceId?transfer.source:w.id===destinationId?transfer.destination:w)}));
    setArrange(false);notify(translate(state.locale,'widgetMovedToWorkspace').replace('{widget}',widget.title.trim()||translate(state.locale,'widget_'+widget.type)).replace('{workspace}',destination.name));
  }
  function openAppsTrayDialog(workspaceId:string){setAppTarget({workspaceId});setAppsDialogMode('attach');setModal('appsTray')}
  function stackWidgets(){const viewport=document.querySelector<HTMLElement>('.workspace-surface:not([hidden]) .canvas-viewport'),width=canvasExtent(viewport?.clientWidth??1000,workspace.widgets),height=canvasHeight(viewport?.clientHeight??700,workspace.widgets);undo.current=state;setState(s=>({...s,workspaces:s.workspaces.map(w=>w.id===s.activeId?{...w,widgets:stackWorkspaceWidgets(w.widgets,width,height)}:w)}));notify(translate(captureState.current.locale,'widgetsArrangedIntoStacks'))}
  function addSidebarPlugin(plugin:SidebarPlugin){setState(s=>s.sidebarPlugins.includes(plugin)?s:{...s,sidebarPlugins:[...s.sidebarPlugins,plugin]});setModal(null);notify(translate(captureState.current.locale,'sidebarPluginAdded').replace('{name}',translate(captureState.current.locale,plugin==='stack'?'stack':'layout')))}
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
  function runShortcut(action:AppShortcutAction){if(modal)return;switch(action){case'up':case'down':moveWorkspace(action);break;case'overview':window.dispatchEvent(new Event('still:workspace-overview-toggle'));break;case'clickThrough':if(state.enableWholeWindowClickThrough)void toggleClickThrough();break;case'commandPalette':setQuery('');setModal('commands');break;case'undo':if(undo.current){setState(undo.current);undo.current=null;notify(translate(captureState.current.locale,'previousLayoutRestored'))}break;default:{const index=Number(action.slice('workspace:'.length))-1;if(index>=0&&!Number.isNaN(index)&&state.workspaces[index])switchWorkspace(state.workspaces[index].id)}}}
  const shortcutContext=useRef({modal,moveWorkspace,runShortcut});shortcutContext.current={modal,moveWorkspace,runShortcut};
  useEffect(()=>{if(!nativeShortcuts.available)return;let disposed=false;let unlisten:(()=>void)|undefined;
    nativeShortcuts.subscribe(direction=>{if(!disposed&&!shortcutContext.current.modal)shortcutContext.current.moveWorkspace(direction)}).then(stop=>{if(disposed)stop();else unlisten=stop}).catch(()=>notify(translate(captureState.current.locale,'workspaceShortcutStartFailed')));
    return()=>{disposed=true;unlisten?.()};
  },[]);
  useEffect(()=>{if(!nativeShortcuts.available)return;let disposed=false,unlisten:(()=>void)|undefined;nativeShortcuts.subscribeActions(action=>{if(!disposed&&!shortcutContext.current.modal)shortcutContext.current.runShortcut(action)}).then(stop=>{if(disposed)stop();else unlisten=stop}).catch(()=>notify(translate(captureState.current.locale,'keyboardShortcutStartFailed')));return()=>{disposed=true;unlisten?.()}},[]);
  useEffect(()=>{if(!nativeShortcuts.available)return;let disposed=false,unlisten:(()=>void)|undefined;nativeShortcuts.subscribeOverviewToggle().then(stop=>{if(disposed)stop();else unlisten=stop}).catch(()=>notify(translate(captureState.current.locale,'workspaceMapShortcutStartFailed')));return()=>{disposed=true;unlisten?.()}},[]);
  useEffect(()=>{if(nativeShortcuts.available)void nativeShortcuts.configure(state.shortcuts,!modal).catch(()=>notify(translate(captureState.current.locale,'workspaceShortcutUpdateFailed')))},[state.shortcuts,modal]);
  async function saveShortcuts(shortcuts:WorkspaceShortcuts){if(nativeShortcuts.available)await nativeShortcuts.configure(shortcuts,false);setState(s=>({...s,shortcuts}));notify(translate(captureState.current.locale,'workspaceShortcutsSaved'))}
  function updateWidget(id:string,patch:Partial<WidgetInstance>){setState(s=>({...s,workspaces:s.workspaces.map(w=>w.widgets.some(i=>i.id===id)?{...w,widgets:w.widgets.map(i=>i.id===id?{...i,...patch}:i)}:w)}))}
  function ensureLibraryInbox():string|null{const current=captureState.current,owner=current.workspaces.find(w=>w.role==='library');if(!owner)return null;const existing=owner.widgets.find(widget=>widget.type==='files'&&widget.folderKey==='still-downloads-inbox');if(existing)return existing.id;const widget=createWidget('files');widget.title='Downloads Inbox';widget.folderName='Still Downloads';widget.folderKey='still-downloads-inbox';setState(value=>({...value,workspaces:value.workspaces.map(item=>item.id===owner.id?{...item,widgets:[...item.widgets,widget]}:item)}));return widget.id}
  function addLibraryFolder():string|null{const current=captureState.current,owner=current.workspaces.find(w=>w.role==='library');if(!owner)return null;const folders=owner.widgets.filter(widget=>widget.type==='files'&&!widget.fileKey);if(folders.length>=MAX_LIBRARY_FOLDERS){notify(translate(current.locale,'libraryFolderLimit').replace('{count}',String(MAX_LIBRARY_FOLDERS)));return null}const widget=createWidget('files');widget.instanceNumber=nextInstanceNumber('files',owner.widgets);undo.current=current;setState(value=>({...value,workspaces:value.workspaces.map(item=>item.id===owner.id?{...item,widgets:[...item.widgets,widget]}:item)}));return widget.id}
  function performRemoval(target:NonNullable<typeof pendingRemoval>){
    const current=captureState.current,owner=current.workspaces.find(w=>w.id===target.workspaceId);
    if(!owner)return;
    const targetIsLocked=target.kind==='widget'?owner.widgets.some(widget=>widget.id===target.id&&widget.lockPluginEnabled&&widget.locked):owner.groups.find(group=>group.id===target.id)?.widgets.some(entry=>entry.kind==='collected'&&entry.instance?.lockPluginEnabled&&entry.instance.locked)??false;
    if(targetIsLocked){notify(translate(captureState.current.locale,'unlockWidgetBeforeRemove'));return}
    if(!target.preserveUndo)undo.current=current;
    const group=target.kind==='group'?owner.groups.find(item=>item.id===target.id):undefined;
    const removedWidget=target.kind==='widget'?owner.widgets.find(item=>item.id===target.id):undefined;
    setState(s=>target.kind==='widget'?deleteCanvasWidget(s,target.workspaceId,target.id):({...s,workspaces:s.workspaces.map(w=>w.id===target.workspaceId?deleteSavedGroup(w,target.id):w)}));
    if(removedWidget?.type==='apps'){pendingAppWidgets.current.delete(removedWidget.id);if(appPanel.available)void appPanel.release(removedWidget.id,current.closeAppOnWidgetClose).catch(error=>notify('Widget removed, but its app could not be closed or released: '+String(error)))}
    if(group)for(const entry of group.widgets)if(entry.kind==='collected'){
      const release=entry.type==='apps'&&appPanel.available?appPanel.release(entry.id,current.closeAppOnWidgetClose):undefined;
      if(release)void release.catch(error=>notify('Group deleted, but '+entry.name+' could not be released from its native panel: '+String(error)));
    }
    setPendingRemoval(null);setModal(null);notify((target.kind==='group'?'Group and its contents deleted. ':'Widget removed. ')+shortcutLabel(state.shortcuts.undo)+' restores the previous layout.');
  }
  function removeWidget(id:string,preserveUndo=false){
    const current=captureState.current,owner=current.workspaces.find(w=>w.widgets.some(widget=>widget.id===id)),widget=owner?.widgets.find(w=>w.id===id);if(!owner||!widget)return;
    if(owner.role==='dashboard'){notify(translate(captureState.current.locale,'dashboardModulesFixed'));return}
    const target={workspaceId:owner.id,id,kind:'widget' as const,preserveUndo,name:widget.title||'Group'};
    performRemoval(target);
  }
  function addWidget(type:WidgetType,at?:{x:number;y:number},width?:number){const role=captureState.current.workspaces.find(w=>w.id===captureState.current.activeId)?.role;if(role==='dashboard'||role==='library'){notify(translate(captureState.current.locale,role==='dashboard'?'dashboardAddFixed':'libraryModulesFixed'));setModal(null);return}const viewportWidth=width??document.querySelector<HTMLElement>('.workspace-surface:not([hidden]) .canvas-viewport')?.clientWidth??1000;undo.current=state;setState(s=>({...s,workspaces:s.workspaces.map(w=>{if(w.id!==s.activeId)return w;const widget=createWidget(type);widget.instanceNumber=nextInstanceNumber(type,w.widgets);widget.placement=at?placement(type,{...widget.placement,...at}):nextPlacement(type,w.widgets,width??canvasExtent(viewportWidth,w.widgets));const bounded=boundNewWidget(widget,w.widgets,width);if(type==='group'){const id=crypto.randomUUID();bounded.groupId=id;return{...w,groups:[...w.groups,{id,name:'',shortcuts:[],widgets:[],expanded:false}],widgets:[...w.widgets,bounded]}}return {...w,widgets:[...w.widgets,bounded]}})}));setModal(null);notify(widgetRegistry[type].name+' added')}
  function changeGroup(workspaceId:string,id:string,patch:Partial<Omit<SavedGroup,'id'>>){setState(s=>({...s,workspaces:s.workspaces.map(w=>w.id===workspaceId?(patch.name!==undefined?saveGroupName(w,id,patch.name):updateSavedGroup(w,id,patch)):w)}))}
  async function saveWidgetInGroup(workspaceId:string,widget:WidgetInstance,groupId?:string,preserveUndo=false){
    const initial=captureState.current,initialWorkspace=initial.workspaces.find(w=>w.id===workspaceId);
    if(!initialWorkspace){notify(translate(captureState.current.locale,'workspaceUnavailable'));return}
    try{collectWidgetIntoGroup(initialWorkspace,widget.id,groupId,widget.placement)}catch(error){notify(String((error as Error).message??error));return}
    try{
      if(widget.type==='apps'&&appPanel.available){const suspended=await appPanel.suspendForCollection(widget.id);if(widget.appPanelOpen&&!suspended)throw new Error('The attached app window could not be verified and hidden. It is still on the workspace. Try the drop again.')}
    }catch(error){notify('The native app could not be safely collected: '+String((error as Error).message??error));return}
    const before=captureState.current,workspace=before.workspaces.find(w=>w.id===workspaceId);
    if(!workspace){
      if(widget.type==='apps'&&appPanel.available&&appPanel.consumeCollectionRetention(widget.id))void appPanel.cancelCollection(widget.id).catch(error=>notify(String(error)));
      notify(translate(captureState.current.locale,'collectWorkspaceChanged'));return;
    }
    let collected:typeof workspace;
    try{collected=collectWidgetIntoGroup(workspace,widget.id,groupId,widget.placement)}catch(error){
      if(widget.type==='apps'&&appPanel.available&&appPanel.consumeCollectionRetention(widget.id))void appPanel.cancelCollection(widget.id).catch(reason=>notify(String(reason)));
      notify(String((error as Error).message??error));return;
    }
    if(!preserveUndo)undo.current=before;setState(s=>({...s,workspaces:s.workspaces.map(w=>w.id===workspaceId?collected:w)}));notify(groupId?'Widget moved into the group.':'New group created and widget moved into it.')
  }
  function editGroup(id:string,mode:GroupEditMode){setEditingGroup(id);setGroupMode(mode);setModal('group')}
  function showGroup(workspaceId:string,id:string,at?:{x:number;y:number},width?:number){undo.current=state;setState(s=>({...s,workspaces:s.workspaces.map(w=>{if(w.id!==workspaceId)return w;const opened=openSavedGroup(w,id,at,width),last=opened.widgets.at(-1);return last?{...opened,widgets:[...opened.widgets.slice(0,-1),boundNewWidget(last,opened.widgets.slice(0,-1),width)]}:opened})}));notify(translate(captureState.current.locale,'groupWidgetAdded'))}
  function removeGroup(workspaceId:string,id:string){const group=captureState.current.workspaces.find(w=>w.id===workspaceId)?.groups.find(g=>g.id===id);if(!group)return;const target={workspaceId,id,kind:'group' as const,preserveUndo:false,name:group.name||'Group'};if(!savedGroupHasContents(group)){performRemoval(target);return}setPendingRemoval(target);setModal('delete')}
  function openGroupWidget(workspaceId:string,entry:GroupWidgetEntry,at?:{x:number;y:number},width?:number){const before=captureState.current,workspace=before.workspaces.find(w=>w.id===workspaceId);if(!workspace){notify(translate(captureState.current.locale,'workspaceUnavailable'));return}if(entry.kind==='collected'){const viewport=document.querySelector<HTMLElement>('.workspace-surface:not([hidden]) .canvas-viewport'),canvasWidth=width??canvasExtent(viewport?.clientWidth??1000,workspace.widgets),canvasHeightValue=canvasHeight(viewport?.clientHeight??700,workspace.widgets);try{const restored=restoreCollectedWidget(workspace,entry.id,canvasWidth,canvasHeightValue);undo.current=before;setState(s=>({...s,workspaces:s.workspaces.map(w=>w.id===workspaceId?restored:w)}));notify(entry.name+' restored to the workspace.')}catch(error){notify(String((error as Error).message??error))}return}undo.current=before;setState(s=>({...s,workspaces:s.workspaces.map(w=>{if(w.id!==workspaceId)return w;const created=createWidgetFromGroupEntry(entry,w.widgets,at,width);return{...w,widgets:[...w.widgets,boundNewWidget(created,w.widgets,width)]}})}));notify(entry.name+' added as a new widget.')}
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
  function saveSavedRename(){if(!savedRename)return;try{const nextName=savedRename.name.trim();if(!nextName)throw new Error('Enter a name.');if(savedRename.kind==='preset'){renameSavedPreset(state.presets,savedRename.id,nextName);undo.current=state;setState(s=>({...s,presets:renameSavedPreset(s.presets,savedRename.id,nextName)}))}else{const owner=state.workspaces.find(w=>w.id===savedRename.workspaceId);if(!owner)throw new Error('This workspace is no longer available.');const renamed=saveGroupName(owner,savedRename.id,nextName);undo.current=state;setState(s=>({...s,workspaces:s.workspaces.map(w=>w.id===owner.id?renamed:w)}))}setSavedRename(null);setFormError('');setModal(null);notify(translate(captureState.current.locale,'savedShortcutNameUpdated'))}catch(error){setFormError(String((error as Error).message??error))}}
  async function openPreset(workspaceId:string,preset:WidgetPreset,at?:{x:number;y:number},width?:number){
    const before=captureState.current,owner=before.workspaces.find(w=>w.id===workspaceId);if(!owner){notify(translate(captureState.current.locale,'workspaceUnavailable'));return}
    if(savedAppInUse(before,preset)){notify(translate(captureState.current.locale,'appAlreadyOpenInStill'));return}
    if(preset.type==='apps'&&appPanel.available){try{const window=await appPanel.prepareLaunch(preset.appSourceId,true);const widget=boundNewWidget(managedAppWidget({sourceId:preset.appSourceId,name:preset.appName},preset.name,owner.widgets,at,width,true,checkedAppIconData(preset.iconData)),owner.widgets,width);pendingAppWidgets.current.set(widget.id,{workspaceId,previous:null,name:preset.name});undo.current=before;setAppAttachments(current=>({...current,[widget.id]:{hwnd:window.hwnd,pid:window.pid}}));setState(current=>({...current,workspaces:current.workspaces.map(w=>w.id===workspaceId?{...w,widgets:[...w.widgets,widget]}:w)}));notify(preset.name+' opened in a Still widget.');}catch(error){notify(String(error))}return}
    const app=preset.type==='apps'&&appPanel.available,created=preset.type==='apps'&&appPanel.available?managedAppWidget({sourceId:preset.appSourceId,name:preset.appName},preset.name,owner.widgets,at,width,true,checkedAppIconData(preset.iconData)):createWidgetFromPreset(preset,owner.widgets,at,width),widget=boundNewWidget(created,owner.widgets,width);
    if(app)pendingAppWidgets.current.set(widget.id,{workspaceId,previous:null,name:preset.name});
    undo.current=before;setState(current=>({...current,workspaces:current.workspaces.map(w=>w.id===workspaceId?{...w,widgets:[...w.widgets,widget]}:w)}));notify(preset.name+' added as a new widget.')
  }
  function pickApp(workspaceId:string,widgetId?:string,at?:{x:number;y:number},width?:number){setAppTarget({workspaceId,widgetId,at,width});setModal('apps')}
  function addManagedApp(source:DroppedResource,name:string,save:boolean,window?:AppWindowChoice,icon?:number[]|string,prepared?:AppAttachment){
    const target=appTarget,owner=state.workspaces.find(w=>w.id===target?.workspaceId);if(!target||!owner)throw new Error('Choose a workspace first.');
    const existing=target.widgetId?owner.widgets.find(w=>w.id===target.widgetId&&w.type==='apps'):undefined;
    if(target.widgetId&&!existing)throw new Error('This widget was removed. Open the Apps picker again.');
    const created=managedAppWidget(source,name,owner.widgets,target.at,target.width,true,window?.icon??icon);
     const widget=existing?{...existing,title:created.title,appName:created.appName,appKey:created.appKey,appIconData:created.appIconData,appPanelOpen:true,appReuseExisting:true,appMinWidth:undefined,appMinHeight:undefined}:created;
     const preset=save?presetFromWidget(widget):null;pendingAppWidgets.current.set(widget.id,{workspaceId:owner.id,previous:existing??null,name:widget.title||widget.appName||'App'});undo.current=state;
    const attachment=window?{hwnd:window.hwnd,pid:window.pid}:prepared;if(attachment)setAppAttachments(current=>({...current,[widget.id]:attachment}));
     setState(s=>({...s,presets:preset?upsertSavedPresets(s.presets,[preset]):s.presets,workspaces:s.workspaces.map(w=>w.id!==owner.id?w:{...w,widgets:existing?w.widgets.map(i=>i.id===widget.id?boundNewWidget(widget,w.widgets,target.width):i):[...w.widgets,boundNewWidget(widget,w.widgets,target.width)]})}));
    setModal(null);setAppTarget(null);notify(widget.title+(window?' is attaching.':' is opening in its panel.')+(save?' Saved in Apps.':''));
  }
  async function launchInstalledApp(workspaceId:string,app:import('./domain/appPicker.ts').InstalledAppChoice,source:DroppedResource){
    const before=captureState.current,owner=before.workspaces.find(item=>item.id===workspaceId);if(!owner){notify(translate(captureState.current.locale,'workspaceUnavailable'));return}
    if(!source.sourceId){notify(translate(captureState.current.locale,'selectAppAgainBeforeOpen'));return}
    try{const window=await appPanel.prepareLaunch(source.sourceId,true);const widget=boundNewWidget(managedAppWidget(source,app.name,owner.widgets,undefined,undefined,true,app.iconData??app.icon),owner.widgets);pendingAppWidgets.current.set(widget.id,{workspaceId,previous:null,name:app.name});undo.current=before;setAppAttachments(current=>({...current,[widget.id]:{hwnd:window.hwnd,pid:window.pid}}));setState(current=>({...current,workspaces:current.workspaces.map(item=>item.id===workspaceId?{...item,widgets:[...item.widgets,widget]}:item)}));notify(app.name+' opened in a Still widget.')}catch(error){notify(String(error))}
  }
  function finishAppAttachment(id:string,attachment:AppAttachment){if(attachment.capture)captureInFlight.current.delete(`${attachment.hwnd}:${attachment.pid}`);setAppAttachments(current=>{if(current[id]?.hwnd!==attachment.hwnd||current[id]?.pid!==attachment.pid)return current;const next={...current};delete next[id];return next})}
  useEffect(()=>{if(!appCapture.available)return;let disposed=false,unlisten:(()=>void)|undefined;
    const onCapture=async(result:import('./platform/appCapture.ts').AppCaptureResult)=>{
      if(disposed)return;
      if(result.kind==='failure'){notify(`Capture ${result.stage} failed: ${result.message}`);return}
      const key=`${result.hwnd}:${result.pid}`;if(captureInFlight.current.has(key))return;
      captureInFlight.current.add(key);
      const snapshot=captureState.current,owner=snapshot.workspaces.find(item=>item.id===snapshot.activeId);
      if(!owner){captureInFlight.current.delete(key);notify(translate(captureState.current.locale,'appAttachWorkspaceUnavailable'));return}
       try{
        const icon=await appPanel.icon({hwnd:result.hwnd,pid:result.pid}).catch(()=>undefined);
        const title=result.title.trim().slice(0,60)||'Attached app';
         if(disposed){captureInFlight.current.delete(key);return}
         const widget=boundNewWidget(managedAppWidget({sourceId:null,name:title},title,owner.widgets,undefined,undefined,false,icon),owner.widgets);
          pendingAppWidgets.current.set(widget.id,{workspaceId:owner.id,previous:null,name:title});
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
  function openGroupResource(_workspaceId:string,link:WebShortcut,_at?:{x:number;y:number}){void openExternalUrl(link.url).then(()=>notify(translate(captureState.current.locale,'externalLinkOpened').replace('{name}',link.name))).catch(error=>notify(translate(captureState.current.locale,'externalLinkOpenFailed').replace('{name}',link.name).replace('{detail}',String(error))))}

  function bringToFront(id:string){setState(s=>({...s,workspaces:s.workspaces.map(w=>w.id===s.activeId?{...w,widgets:[...w.widgets.filter(i=>i.id!==id),...w.widgets.filter(i=>i.id===id)]}:w)}))}
  function startCreate(){setName('');setChosen(['desmos','notes']);setFormError('');setModal('create')}
  function quickCaptureNote(){const current=captureState.current,dashboard=current.workspaces.find(item=>item.role==='dashboard'),notes=dashboard?.widgets.find(item=>item.type==='notes');if(!dashboard||!notes){notify(translate(current.locale,'dashboardUnavailable'));return}if(notes.noteDocuments.length>=NOTE_DOCUMENT_LIMIT){notify(translate(current.locale,'quickNoteLimit'));return}const created=createNoteDocument();undo.current=current;setState(value=>({...value,activeId:dashboard.id,workspaces:value.workspaces.map(item=>item.id!==dashboard.id?item:{...item,widgets:item.widgets.map(widget=>widget.id!==notes.id?widget:{...widget,noteDocuments:[...widget.noteDocuments,created],activeNoteDocumentId:created.id,title:created.title,text:created.text})})}));requestAnimationFrame(()=>document.querySelector<HTMLTextAreaElement>('.workspace-surface:not([hidden]) .dashboard-notes-body textarea.note')?.focus());notify(translate(current.locale,'quickNoteCreated'))}
  function submitWorkspace(){try{if(modal==='rename'){const valid=workspaceName(name);setState(s=>({...s,workspaces:s.workspaces.map(w=>w.id===s.activeId?{...w,name:valid}:w)}))}else{const created=createWorkspace(name,chosen);setState(s=>({...s,activeId:created.id,workspaces:[...s.workspaces,created]}));}setModal(null);setArrange(false)}catch(error){setFormError(String(error instanceof Error?error.message:error))}}
  function duplicate(){const copy=duplicateWorkspace(workspace,workspace.name.slice(0,55)+' copy');setState(s=>({...s,activeId:copy.id,workspaces:[...s.workspaces,copy]}));notify(translate(captureState.current.locale,'workspaceDuplicated'))}
  function removeWorkspace(){const active=state.workspaces.find(w=>w.id===state.activeId);if(active?.role==='dashboard'||active?.role==='library'){notify(translate(captureState.current.locale,'builtInWorkspace'));return}if(state.workspaces.length===1){notify(translate(captureState.current.locale,'keepOneWorkspace'));return}if(active&&(active.widgets.some(widget=>widget.lockPluginEnabled&&widget.locked)||active.groups.some(group=>group.widgets.some(entry=>entry.kind==='collected'&&entry.instance?.lockPluginEnabled&&entry.instance.locked)))){notify(translate(captureState.current.locale,'unlockWidgetsBeforeDeleteWorkspace'));return}if(!active)return;undo.current=state;const next=removeWorkspaceAndUnlinkCourseEnvironments(state,active.id);setState(next);if(active){for(const widget of active.widgets)if(widget.type==='apps'){pendingAppWidgets.current.delete(widget.id);if(appPanel.available)void appPanel.release(widget.id,state.closeAppOnWidgetClose).catch(error=>notify('Workspace removed, but '+widget.appName+' could not be closed or released: '+String(error)))}for(const group of active.groups)for(const entry of group.widgets)if(entry.kind==='collected'&&entry.type==='apps'){pendingAppWidgets.current.delete(entry.id);if(appPanel.available)void appPanel.release(entry.id,state.closeAppOnWidgetClose).catch(error=>notify('Workspace removed, but '+entry.name+' could not be closed or released: '+String(error)))}}setArrange(false);notify('Workspace removed. '+shortcutLabel(state.shortcuts.undo)+' restores it.')}  function assistantDimensions(){const viewport=document.querySelector<HTMLElement>('.workspace-surface:not([hidden]) .canvas-viewport');return{width:canvasExtent(viewport?.clientWidth??1000,[]),height:canvasHeight(viewport?.clientHeight??700,[])}}
  async function moveAssistantFile(workspaceId:string,widgetId:string,sourcePath:string,destinationFolder:string):Promise<string>{
    const current=captureState.current,active=current.workspaces.find(item=>item.id===workspaceId),owner=current.workspaces.find(item=>item.widgets.some(widget=>widget.id===widgetId&&widget.type==='files')),fileWidget=owner?.widgets.find(widget=>widget.id===widgetId&&widget.type==='files'),dashboardLibrary=owner?.role==='library'&&(active?.role==='dashboard'||fileWidget?.folderKey==='still-downloads-inbox');
    if(!active||current.activeId!==workspaceId||!owner||owner.id!==workspaceId&&!dashboardLibrary||!fileWidget)throw new Error('The selected Files library changed. Nothing was moved; try again.');
    const expectedDestination=(destinationFolder?destinationFolder+'/':'')+sourcePath.split('/').at(-1);
    if(Object.hasOwn(fileWidget.fileNotes,expectedDestination))throw new Error('A note already exists for that destination. Nothing was moved.');
    const result=await localFiles.moveResource(widgetId,sourcePath,destinationFolder);
    if(result.sourcePath!==sourcePath)throw new Error('Still could not verify the filed item path. Check the library before retrying.');
    const latest=captureState.current,latestWidget=latest.workspaces.flatMap(item=>item.widgets).find(widget=>widget.id===widgetId&&widget.type==='files');
    if(latestWidget&&Object.hasOwn(latestWidget.fileNotes,sourcePath)&&!Object.hasOwn(latestWidget.fileNotes,result.destinationPath)){
      const fileNotes={...latestWidget.fileNotes,[result.destinationPath]:latestWidget.fileNotes[sourcePath]};delete fileNotes[sourcePath];updateWidget(widgetId,{fileNotes});
    }
    remapRecentLibraryFiles(new Set([widgetId]),sourcePath,result.destinationPath);
    window.dispatchEvent(new CustomEvent('still-files-resource-moved',{detail:{widgetId,sourcePath,destinationPath:result.destinationPath}}));
    return result.destinationPath;
  }
  async function addAssistantCalendarEvents(workspaceId:string,widgetId:string,drafts:StudyCalendarEventDraft[]):Promise<string>{
    const current=captureState.current,active=current.workspaces.find(item=>item.id===workspaceId),calendar=active?.widgets.find(widget=>widget.id===widgetId&&widget.type==='calendar');
    if(!active||current.activeId!==workspaceId||!calendar)throw new Error(translate(state.locale,'calendarProposalUnavailable'));
    const safeDrafts=checkedStudyCalendarDrafts(drafts),existing=calendar.calendarEvents??[];
    if(existing.length+safeDrafts.length>500)throw new Error(translate(state.locale,'calendarProposalLimit'));
    const merged=checkedCalendarEvents([...existing,...safeDrafts.map(event=>({...event,id:crypto.randomUUID()}))]);
    if(merged.length!==existing.length+safeDrafts.length)throw new Error(translate(state.locale,'calendarProposalUnavailable'));
    undo.current=current;
    setState(value=>({...value,workspaces:value.workspaces.map(item=>item.id!==workspaceId?item:{...item,widgets:item.widgets.map(widget=>widget.id!==widgetId?widget:{...widget,calendarEvents:merged})})}));
    return translate(state.locale,'calendarProposalAdded').replace('{count}',String(safeDrafts.length));
  }
  async function applyAssistantActions(workspaceId:string,actions:AssistantAction[],prompt:string,selectedIds:string[]):Promise<string>{
    const initial=captureState.current,initialWorkspace=initial.workspaces.find(item=>item.id===workspaceId);
    if(!initialWorkspace||initial.activeId!==workspaceId)throw new Error(translate(captureState.current.locale,'activeWorkspaceChanged'));
    if((initialWorkspace.role==='dashboard'||initialWorkspace.role==='library')&&actions.some(action=>['add_widget','open_saved','remove_widget','minimize','restore'].includes(action.type)))throw new Error(translate(initial.locale,initialWorkspace.role==='dashboard'?'dashboardModulesImmutable':'libraryModulesFixed'));
    const initialTray=assistantTrayItems(initial.presets,initialWorkspace.groups);
    const workspaceChoices=initial.workspaces.map(item=>({id:item.id,name:item.name}));validateAssistantActions(initialWorkspace,actions,initialTray,workspaceChoices);validateAssistantActionIntent(prompt,initialWorkspace,actions,initialTray,workspaceChoices,selectedIds);
    const createAction=actions.find(action=>action.type==='create_workspace');
    if(createAction){if(actions.length!==1||initial.workspaces.length>=MAX_ASSISTANT_WORKSPACES)throw new Error(`Still supports up to ${MAX_ASSISTANT_WORKSPACES} workspaces. Nothing was changed.`);const name=workspaceName(createAction.title!.trim()),created=createWorkspace(name,createAction.ids as WidgetType[]);undo.current=initial;setState({...initial,activeId:created.id,workspaces:[...initial.workspaces,created]});return `Created workspace “${name}”.`}
    const switchAction=actions.find(action=>action.type==='switch_workspace');
    if(switchAction){if(actions.length!==1)throw new Error('Switching workspaces must be the only action in that request.');const destination=initial.workspaces.find(item=>item.id===switchAction.ids[0]);if(!destination)throw new Error('That workspace no longer exists. Nothing was changed.');setState(value=>({...value,activeId:destination.id}));setArrange(false);return `Switched to “${destination.name}”.`;}
    const moveAction=actions.find(action=>action.type==='move_widget');
    if(moveAction){if(actions.length!==1||!moveAction.workspaceId)throw new Error('Moving a widget must be the only action in that request.');const source=initialWorkspace.widgets.find(widget=>widget.id===moveAction.ids[0]),destination=initial.workspaces.find(item=>item.id===moveAction.workspaceId);if(!source||!destination)throw new Error('The widget or destination workspace no longer exists. Nothing was changed.');if(initialWorkspace.role==='dashboard'||initialWorkspace.role==='library'||destination.role==='dashboard'||destination.role==='library')throw new Error('Built-in Dashboard and Library widgets cannot be moved between workspaces. Nothing was changed.');if(destination.widgets.length>=MAX_ASSISTANT_WIDGETS)throw new Error(`The destination workspace is limited to ${MAX_ASSISTANT_WIDGETS} widgets. Nothing was changed.`);if(source.lockPluginEnabled&&source.locked)throw new Error('Unlock the widget before moving it. Nothing was changed.');if(source.type==='apps'&&source.appPanelOpen)throw new Error('Close or detach the native app before moving its workspace card. Nothing was changed.');transferWidget(workspaceId,source.id,destination.id);return `Moved ${source.title.trim()||translate(initial.locale,'widget_'+source.type)} to “${destination.name}”.`;}
    if(actions.some(action=>action.type==='undo')){if(actions.length!==1)throw new Error('Undo must be the only action in that request.');if(!undo.current)throw new Error(translate(initial.locale,'noPreviousLayout'));const previous=undo.current;undo.current=null;setState(previous);setArrange(false);return 'Undid the previous Still change.';}
    const tutorialAction=actions.find(action=>action.type==='run_tutorial');
    if(tutorialAction){if(actions.length!==1)throw new Error('Opening the tutorial must be the only action in that request.');setModal('tutorial');return 'Opened the Still tutorial.';}
    const visibilityAction=actions.find(action=>action.type==='set_ui_visibility');
    if(visibilityAction){if(actions.length!==1)throw new Error('Interface visibility must be the only action in that request.');const show=visibilityAction.enabled===true;if(visibilityAction.ids[0]==='sidebar'){if(sidebarCloseTimer.current){clearTimeout(sidebarCloseTimer.current);sidebarCloseTimer.current=null}setSidebarHidden(!show);setSidebarPeek(false);return initial.locale==='zh-CN'?(show?'已显示侧栏。':'已隐藏侧栏。'):(show?'Sidebar shown.':'Sidebar hidden.')}if(visibilityAction.ids[0]==='apps-bar'){setWidgetTrayHidden(!show);return initial.locale==='zh-CN'?(show?'已显示底部应用栏。':'已隐藏底部应用栏。'):(show?'Bottom Apps bar shown.':'Bottom Apps bar hidden.')}throw new Error('Choose the Still sidebar or Apps bar.');}
    const shortcutAction=actions.find(action=>action.type==='set_shortcut');
    if(shortcutAction){if(actions.length!==1||!shortcutAction.shortcut)throw new Error('Changing a shortcut must be the only action in that request.');const next=updateAssistantShortcut(initial.shortcuts,shortcutAction.ids[0],shortcutAction.shortcut);await saveShortcuts(next);return `Changed ${shortcutAction.ids[0]} to ${shortcutLabel(shortcutAction.shortcut)}.`;}
    let nextPresets=initial.presets;const saved:string[]=[],failed:string[]=[];
    for(const action of actions){
      if(action.type!=='save_to_tray')continue;
      for(const id of action.ids){
        const current=captureState.current,owner=current.workspaces.find(item=>item.id===workspaceId),widget=owner?.widgets.find(item=>item.id===id);
        if(!widget||current.activeId!==workspaceId)throw new Error(translate(captureState.current.locale,'workspaceActionChanged'));
        try{
          let reusable=widget;
          if(widget.type==='apps'&&!widget.appKey){
            if(!appPanel.available)throw new Error(translate(captureState.current.locale,'desktopAppsUnavailable'));
            const attachment=appAttachments[widget.id]??await appPanel.identity(widget.id);
            if(!attachment)throw new Error(translate(captureState.current.locale,'appShortcutRequired'));
            const shortcut=await appPanel.prepare(attachment);
            if(shortcut.kind!=='app'||!shortcut.sourceId)throw new Error(translate(captureState.current.locale,'appShortcutCreateError'));
            reusable={...widget,appKey:shortcut.sourceId,appName:shortcut.name};
          }
          const preset=presetFromWidget(reusable);nextPresets=upsertSavedPresets(nextPresets,[preset]);saved.push(widget.title.trim()||translate(current.locale,'widget_'+widget.type));
        }catch(reason){failed.push(`${widget.title.trim()||translate(current.locale,'widget_'+widget.type)}: ${String((reason as Error).message??reason)}`)}
      }
    }
    const current=captureState.current,owner=current.workspaces.find(item=>item.id===workspaceId);
    if(!owner||current.activeId!==workspaceId)throw new Error(translate(captureState.current.locale,'activeWorkspaceChanged'));
    const tray=assistantTrayItems(current.presets,owner.groups);
    const currentWorkspaceChoices=current.workspaces.map(item=>({id:item.id,name:item.name}));validateAssistantActions(owner,actions,tray,currentWorkspaceChoices);validateAssistantActionIntent(prompt,owner,actions,tray,currentWorkspaceChoices,selectedIds);
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
    const settingActions=actions.filter(action=>action.type==='set_setting'),settingPatch:Partial<WorkspaceState>={},startupResults:string[]=[];
    for(const settingAction of settingActions){const value=settingAction.settingValue!,key=settingAction.ids[0],color=key.split('-').at(-1) as WidgetTagColor;switch(key){
      case'theme':settingPatch.theme=value as WorkspaceState['theme'];break;case'density':settingPatch.density=value as WorkspaceState['density'];break;case'background':settingPatch.background=value as WorkspaceState['background'];break;case'appearance':settingPatch.appearance=value as WorkspaceState['appearance'];break;case'canvasFrameRate':settingPatch.canvasFrameRate=value==='display'?'display':Number(value) as 30|60;break;case'followWidgetToWorkspace':settingPatch.followWidgetToWorkspace=value==='on';break;case'locale':settingPatch.locale=value as WorkspaceState['locale'];break;
      case'glassOpacity':settingPatch.glass={...(settingPatch.glass??current.glass),opacity:Number(value)};break;case'glassBackgroundEffect':settingPatch.glass={...(settingPatch.glass??current.glass),backgroundEffect:value as WorkspaceState['glass']['backgroundEffect']};break;
      case'autoOpenCourseEnvironments':settingPatch.autoOpenCourseEnvironments=value==='on';break;case'appShutdownBehavior':settingPatch.appShutdownBehavior=value as WorkspaceState['appShutdownBehavior'];break;case'launchAtSignIn':startupResults.push(await setStartupEnabled(value==='on')?'Enabled Still at Windows sign-in.':'Could not change the Windows sign-in setting.');break;case'closeAppOnWidgetClose':settingPatch.closeAppOnWidgetClose=value==='on';break;case'saveAppShortcutsOnAttach':settingPatch.saveAppShortcutsOnAttach=value==='on';break;case'showAppAttachAction':settingPatch.showAppAttachAction=value==='on';break;case'showAppDetachAction':settingPatch.showAppDetachAction=value==='on';break;case'showAppSaveAction':settingPatch.showAppSaveAction=value==='on';break;case'showWidgetExportPngAction':settingPatch.showWidgetExportPngAction=value==='on';break;case'passThroughTransparentBackground':settingPatch.passThroughTransparentBackground=value==='on';break;case'enableWholeWindowClickThrough':settingPatch.enableWholeWindowClickThrough=value==='on';break;
      case'widgetRelaunchMode':settingPatch.widgetRelaunchMode=value as WorkspaceState['widgetRelaunchMode'];break;case'widgetRelaunchPluginStatus':settingPatch.widgetRelaunchPluginStatus=value as WorkspaceState['widgetRelaunchPluginStatus'];break;case'screenshotPluginMode':settingPatch.screenshotPluginMode=value as WorkspaceState['screenshotPluginMode'];break;case'clockPluginMode':settingPatch.clockPluginMode=value as WorkspaceState['clockPluginMode'];break;
      default:if(key.startsWith('widgetRelaunchColor-')){const colors={...settingPatch.widgetRelaunchColors??current.widgetRelaunchColors};if(value==='follow')delete colors[color];else colors[color]=value as WorkspaceState['widgetRelaunchMode'];settingPatch.widgetRelaunchColors=colors}
        else if(key.startsWith('screenshotPluginColor-')){const colors=new Set(settingPatch.screenshotPluginColors??current.screenshotPluginColors);if(value==='on')colors.add(color);else colors.delete(color);settingPatch.screenshotPluginColors=[...colors]}
        else if(key.startsWith('screenshotPluginOverride-')){const overrides={...settingPatch.screenshotPluginColorOverrides??current.screenshotPluginColorOverrides};if(value==='follow')delete overrides[color];else overrides[color]=value==='on';settingPatch.screenshotPluginColorOverrides=overrides}
        else if(key.startsWith('clockPluginColor-')){const colors=new Set(settingPatch.clockPluginColors??current.clockPluginColors);if(value==='on')colors.add(color);else colors.delete(color);settingPatch.clockPluginColors=[...colors]}
        else if(key.startsWith('clockPluginOverride-')){const overrides={...settingPatch.clockPluginColorOverrides??current.clockPluginColorOverrides};if(value==='follow')delete overrides[color];else overrides[color]=value==='on';settingPatch.clockPluginColorOverrides=overrides}
      }}
    const settingsChanged=Object.entries(settingPatch).some(([key,value])=>current[key as keyof WorkspaceState]!==value);
    const stateChanged=nextWorkspaceRecord!==owner||nextPresets!==current.presets||nextSidebarPlugins.length!==current.sidebarPlugins.length||nextSidebarPlugins.some((plugin,index)=>plugin!==current.sidebarPlugins[index]);
    if(stateChanged||settingsChanged){undo.current=current;setState({...current,...settingPatch,presets:nextPresets,sidebarPlugins:nextSidebarPlugins,workspaces:current.workspaces.map(item=>item.id===workspaceId?nextWorkspaceRecord:item)});if(sidebarActions.some(action=>action.enabled===false&&action.ids.includes('layout')))setLayoutMode(null)}
    const settingsAction=actions.find(action=>action.type==='open_settings');
    if(settingsAction){setSettingsTab(settingsAction.ids[0] as 'general'|'appearance'|'plugins');setModal('settings')}
    const removedAppIds=removedWidgets.filter(widget=>widget.type==='apps').map(widget=>widget.id);
    if(removedAppIds.length){setAppAttachments(attachments=>Object.fromEntries(Object.entries(attachments).filter(([id])=>!removedAppIds.includes(id))));for(const id of removedAppIds)if(appPanel.available)void appPanel.release(id,current.closeAppOnWidgetClose).catch(error=>notify('Widget removed, but its attached app could not be released to the desktop: '+String(error)));}
    const result:string[]=[],t=(key:string)=>translate(current.locale,key),joinNames=(names:string[])=>names.join(current.locale==='zh-CN'?'、':', '),describeWidgets=(ids:string[])=>joinNames(ids.map(id=>{const widget=nextWorkspace.widgets.find(item=>item.id===id);return widget?.title||widget&&t('widget_'+widget.type)||t('widget')}));
    if(settingActions.length)result.push(...(startupResults.length?startupResults:['Updated '+settingActions.length+' setting'+(settingActions.length===1?'':'s')+'.']));
    if(settingsAction)result.push(t('settings')+' opened.');
    if(actions.some(action=>action.type==='minimize'))result.push(minimized.length?t(minimized.length===1?'assistantMinimizedOne':'assistantMinimizedMany').replace('{count}',String(minimized.length)) :t('assistantAlreadyMinimized'));
    if(actions.some(action=>action.type==='restore'))result.push(restored.length?t(restored.length===1?'assistantRestoredOne':'assistantRestoredMany').replace('{count}',String(restored.length)):t('assistantAlreadyRestored'));
    const addedCounts=new Map<string,number>();for(const action of actions)if(action.type==='add_widget')for(const id of action.ids)addedCounts.set(id,(addedCounts.get(id)??0)+1);
    if(addedCounts.size){const addedNames=[...addedCounts].map(([id,count])=>`${t('widget_'+id)}${count>1?` × ${count}`:''}`);result.push(t('assistantAddedWidgets').replace('{widgets}',joinNames(addedNames)))}
    const noteDocuments=actions.filter(action=>action.type==='create_note_document');if(noteDocuments.length)result.push(t('assistantNotesCreated').replace('{notes}',joinNames(noteDocuments.map(action=>action.title?.trim()||t('untitledNote')))));
    const openedNotes=actions.filter(action=>action.type==='open_note_document').map(action=>{const widget=owner.widgets.find(item=>item.id===action.ids[0]),document=widget?.type==='notes'?widget.noteDocuments.find(item=>item.id===action.ids[1]):undefined;return document?.title||t('untitledNote')});if(openedNotes.length)result.push(t('assistantNotesOpened').replace('{notes}',joinNames(openedNotes)));
    const closedNotes=actions.filter(action=>action.type==='close_note_document').map(action=>{const widget=owner.widgets.find(item=>item.id===action.ids[0]),document=widget?.type==='notes'?widget.noteDocuments.find(item=>item.id===action.ids[1]):undefined;return document?.title||t('untitledNote')});if(closedNotes.length)result.push(current.locale==='zh-CN'?'已关闭笔记标签：'+joinNames(closedNotes):'Closed note tabs: '+joinNames(closedNotes));
    for(const action of actions.filter(item=>item.type==='set_course_auto_open')){const widget=owner.widgets.find(item=>item.id===action.ids[0]),course=widget?.type==='timetable'?widget.schedule.find(item=>item.id===action.ids[1]):undefined;if(course)result.push(current.locale==='zh-CN'?`${course.title} 的自动打开已${action.enabled?'开启':'关闭'}。`:`Automatic opening ${action.enabled?'enabled':'disabled'} for ${course.title}.`)}
    for(const action of actions.filter(item=>item.type==='set_course_environment')){const widget=owner.widgets.find(item=>item.id===action.ids[0]),course=widget?.type==='timetable'?widget.schedule.find(item=>item.id===action.ids[1]):undefined,destination=current.workspaces.find(item=>item.id===action.workspaceId);if(course)result.push(current.locale==='zh-CN'?(action.enabled&&destination?`已将 ${course.title} 链接到 ${destination.name}。`:`已解除 ${course.title} 的环境链接。`):(action.enabled&&destination?`Linked ${course.title} to ${destination.name}.`:`Unlinked ${course.title} from its environment.`))}
    if(renamed)result.push(t('assistantWorkspaceRenamed').replace('{name}',renamed.trim()));
    for(const action of sidebarActions)for(const plugin of action.ids as SidebarPlugin[]){const name=plugin==='stack'?t('stack'):t('layout'),changed=changedSidebarPlugins.get(plugin as SidebarPlugin);const key=changed?(action.enabled?'assistantSidebarPluginAdded':'assistantSidebarPluginRemoved'):(action.enabled?'assistantSidebarPluginAlreadyAdded':'assistantSidebarPluginAlreadyRemoved');result.push(t(key).replace('{name}',name))}
    for(const action of actions.filter(item=>item.type==='set_widget_plugin')){if(action.plugin==='lock'){const operation=action.enabled?(action.locked===false?t('unlock'):t('lock')):t('remove');result.push(t('plugin_lock_name')+' · '+operation+' · '+describeWidgets(action.ids))}else result.push(t(action.enabled?'assistantClockTimerPluginAdded':'assistantClockTimerPluginRemoved').replace('{widgets}',describeWidgets(action.ids)))}
    for(const action of actions.filter(item=>item.type==='edit_widget'))result.push(t('assistantWidgetsUpdated').replace('{widgets}',describeWidgets(action.ids)));
    if(removedWidgets.length){const names=joinNames(removedWidgets.map(widget=>widget.title.trim()||t('widget_'+widget.type)));result.push(t('assistantWidgetsRemoved').replace('{widgets}',names).replace('{workspace}',owner.name))}
    if(actions.some(action=>action.type==='save_to_tray'))result.push(saved.length?t(saved.length===1?'assistantShortcutSaved':'assistantShortcutsSaved').replace('{count}',String(saved.length)):t('noReusableShortcuts'));
    if(openAction){if(opened){const key=opened===1?'assistantOneSavedItemOpened':'assistantSavedItemsOpened';result.push(t(key).replace('{workspace}',owner.name).replace('{count}',String(opened)))}else result.push(t('assistantNoSavedItemsOpened'));if(alreadyOpen)result.push(t('assistantAppsAlreadyOpen').replace('{count}',String(alreadyOpen)))}
    for(const action of actions.filter(item=>item.type==='set_timer')){const seconds=action.seconds??0,count=seconds%3600===0?seconds/3600:seconds%60===0?seconds/60:seconds,unitKey=seconds%3600===0?(count===1?'durationHour':'durationHours'):seconds%60===0?(count===1?'durationMinute':'durationMinutes'):(count===1?'durationSecond':'durationSeconds'),duration=t(unitKey).replace('{count}',String(count));result.push(t('assistantTimerStarted').replace('{duration}',duration).replace('{widgets}',describeWidgets(action.ids)))}
    for(const action of actions.filter(item=>item.type==='control_timer')){const operation=action.operation??'pause',key=operation==='pause'?'assistantTimerPaused':operation==='resume'?'assistantTimerResumed':'assistantTimerReset';result.push(t(key).replace('{widgets}',describeWidgets(action.ids)))}
    if(failed.length)result.push(t('assistantCouldNotSave').replace('{details}',failed.join('; ')));
    return result.join(current.locale==='zh-CN'?'':' ');
  }
  async function clearAssistantTray(workspaceId:string):Promise<string>{
    const current=captureState.current,owner=current.workspaces.find(item=>item.id===workspaceId);
    if(!owner||current.activeId!==workspaceId)throw new Error('The active workspace changed. Nothing was removed; try again.');
    if(!current.presets.length&&!owner.groups.length)return translate(current.locale,'trayAlreadyEmpty');
    if(owner.groups.some(group=>group.widgets.some(entry=>entry.kind==='collected'&&entry.instance?.lockPluginEnabled&&entry.instance.locked)))throw new Error(translate(current.locale,'unlockGroupedWidgets'));
    const groupIds=new Set(owner.groups.map(group=>group.id));
    undo.current=current;
    setState({...current,presets:[],workspaces:current.workspaces.map(item=>item.id===workspaceId?{...item,groups:[],widgets:item.widgets.filter(widget=>!widget.groupId||!groupIds.has(widget.groupId))}:item)});
    for(const group of owner.groups)for(const entry of group.widgets)if(entry.kind==='collected'&&entry.type==='apps'&&appPanel.available)void appPanel.release(entry.id,current.closeAppOnWidgetClose).catch(error=>notify(translate(current.locale,'trayClearedAppError').replace('{name}',entry.name).replace('{detail}',String(error))));
    return `Removed ${current.presets.length} saved shortcut${current.presets.length===1?'':'s'} from the shared tray and ${owner.groups.length} Group${owner.groups.length===1?'':'s'} from ${owner.name}. Undo change restores the saved tray data.`;
  }
  async function deleteAssistantWidgets(workspaceId:string):Promise<string>{
    const current=captureState.current,owner=current.workspaces.find(item=>item.id===workspaceId);
    if(!owner||current.activeId!==workspaceId)throw new Error('The active workspace changed. Nothing was removed; try again.');
    if(owner.role==='dashboard'||owner.role==='library')throw new Error(translate(current.locale,owner.role==='dashboard'?'dashboardModulesFixed':'libraryModulesFixed'));
    if(!owner.widgets.length)return translate(current.locale,'emptyWorkspaceWidgets').replace('{workspace}',owner.name);
    if(owner.widgets.some(widget=>widget.lockPluginEnabled&&widget.locked))throw new Error(translate(current.locale,'unlockWidgetsBeforeRemove'));
    const count=owner.widgets.length,appIds=owner.widgets.filter(widget=>widget.type==='apps').map(widget=>widget.id);
    undo.current=current;
    setState({...current,workspaces:current.workspaces.map(item=>item.id===workspaceId?{...item,widgets:[]}:item)});
    setAppAttachments(attachments=>Object.fromEntries(Object.entries(attachments).filter(([id])=>!appIds.includes(id))));
    for(const id of appIds)if(appPanel.available)void appPanel.release(id,current.closeAppOnWidgetClose).catch(error=>notify(translate(current.locale,'widgetsRemovedAppError').replace('{detail}',String(error))));
    return `Removed ${count} widget${count===1?'':'s'} from ${owner.name}. Saved shortcuts and Groups in the tray were kept. Undo change restores the widget cards; attached app windows were returned to the desktop.`;
  }
  async function deleteAssistantWorkspace(workspaceId:string):Promise<string>{
    const current=captureState.current,owner=current.workspaces.find(item=>item.id===workspaceId);
    if(!owner||current.activeId!==workspaceId)throw new Error('The active workspace changed. Nothing was deleted; try again.');
    if(owner.role==='dashboard'||owner.role==='library')throw new Error(translate(current.locale,'builtInWorkspace'));
    if(current.workspaces.length<=1)throw new Error(translate(current.locale,'keepOneWorkspace'));
    if(owner.widgets.some(widget=>widget.lockPluginEnabled&&widget.locked)||owner.groups.some(group=>group.widgets.some(entry=>entry.kind==='collected'&&entry.instance?.lockPluginEnabled&&entry.instance.locked)))throw new Error(translate(current.locale,'unlockWidgetsBeforeDeleteWorkspace'));
    const nextState=removeWorkspaceAndUnlinkCourseEnvironments(current,workspaceId),remaining=nextState.workspaces,appIds=[...owner.widgets.filter(widget=>widget.type==='apps').map(widget=>widget.id),...owner.groups.flatMap(group=>group.widgets.filter(entry=>entry.kind==='collected'&&entry.type==='apps').map(entry=>entry.id))];
    undo.current=current;setState(nextState);setArrange(false);setLayoutMode(null);
    setAppAttachments(attachments=>Object.fromEntries(Object.entries(attachments).filter(([id])=>!appIds.includes(id))));
    for(const id of appIds)if(appPanel.available)void appPanel.release(id,current.closeAppOnWidgetClose).catch(error=>notify(translate(current.locale,'workspaceDeletedAppError').replace('{detail}',String(error))));
    notify(translate(current.locale,'workspaceDeletedNotice').replace('{workspace}',owner.name).replace('{next}',remaining[0].name));
    return `Deleted ${owner.name}. Switched to ${remaining[0].name}. Undo change restores the workspace and its widget cards; attached app windows were returned to the desktop.`;
  }
  async function startAssistantTimer(workspaceId:string,seconds:number):Promise<string>{
    const current=captureState.current,owner=current.workspaces.find(item=>item.id===workspaceId);
    if(!owner||current.activeId!==workspaceId)throw new Error(translate(captureState.current.locale,'activeWorkspaceChanged'));
    const size=assistantDimensions(),next=addFocusForAssistantTimer(owner,size.width,size.height,seconds);
    undo.current=current;setState({...current,workspaces:current.workspaces.map(item=>item.id===workspaceId?next:item)});
    const label=seconds%3600===0?`${seconds/3600} hour${seconds===3600?'':'s'}`:seconds%60===0?`${seconds/60} minute${seconds===60?'':'s'}`:`${seconds} seconds`;
    return `Added a Focus widget and started a ${label} timer.`;
  }
  function applyAssistantLayout(plan:LayoutPlan){const current=captureState.current,owner=current.workspaces.find(w=>w.id===current.activeId)!;if(owner.role==='dashboard'){notify(translate(current.locale,'dashboardLayoutFixed'));return}const size=assistantDimensions(),next=applyLayoutPlan(owner,plan,size.width,size.height);undo.current=current;setState({...current,workspaces:current.workspaces.map(w=>w.id===owner.id?next:w)});notify(translate(current.locale,'aiLayoutApplied').replace('{shortcut}',shortcutModifier+'+Z'))}
  function undoAssistantLayout(){if(!undo.current){notify(translate(captureState.current.locale,'noPreviousLayout'));return}setState(undo.current);undo.current=null;notify(translate(captureState.current.locale,'previousLayoutRestored'))}
  const commands=[{label:translate(state.locale,'openAiAssistant'),run:()=>setAssistantOpen(true)},...state.workspaces.map(w=>({label:translate(state.locale,'switchWorkspaceByName').replace('{workspace}',displayWorkspaceName(w,state.locale)),run:()=>switchWorkspace(w.id)})),{label:translate(state.locale,'createWorkspace'),run:startCreate},...(workspace.role==='dashboard'||workspace.role==='library'?[]:[{label:translate(state.locale,'addWidget'),run:()=>setModal('gallery')}]),{label:translate(state.locale,'settings'),run:()=>{setSettingsTab('general');setModal('settings')}},{label:translate(state.locale,'appearance'),run:()=>{setSettingsTab('appearance');setModal('settings')}},{label:translate(state.locale,'keyboardShortcuts'),run:()=>setModal('shortcuts')},...(workspace.role==='dashboard'||workspace.role==='library'?[]:[{label:translate(state.locale,'arrangeWorkspace'),run:()=>setArrange(true)}]),{label:translate(state.locale,sidebarPeek?'hideSidebar':'showSidebar'),run:toggleSidebar},{label:translate(state.locale,widgetTrayHidden?'showBottomAppsBar':'hideBottomAppsBar'),run:toggleWidgetTray}];
  useEffect(()=>{function onKey(event:KeyboardEvent){if(event.isComposing||modal)return;const editing=!!(event.target as HTMLElement)?.closest('input,textarea,select,[contenteditable=true],[role=textbox]');const action=shortcutAction(event,state.shortcuts,editing);if(!action)return;if((action==='overview'||action==='undo'||action.startsWith('workspace:'))&&editing)return;if(action==='clickThrough'&&!state.enableWholeWindowClickThrough)return;event.preventDefault();if(!event.repeat)runShortcut(action)}document.addEventListener('keydown',onKey);return()=>document.removeEventListener('keydown',onKey)},[state,modal]);
  const matches=commands.filter(c=>c.label.toLowerCase().includes(query.toLowerCase()));
  const widgetTrayVisible=!widgetTrayHidden;
   return <LocaleContext.Provider value={state.locale}><div lang={state.locale} className={"app canvas-app sidebar-expanded"+(sidebarHidden?' sidebar-hidden':'')+(sidebarPeek?' sidebar-peek-open':'')+(widgetTrayHidden?' widget-tray-hidden':'')+(assistantOpen?' assistant-open':'')}>{state.appearance==='liquid-glass'&&state.background!=='transparent'&&<div className={"liquid-chrome-backdrop"+(state.glass.backgroundEffect==='wave-wallpaper'?' wave-wallpaper-backdrop':'')} aria-hidden="true">{state.glass.backgroundEffect==='liquid-chrome'?<LiquidChrome style={{}} color={state.theme==='dark'?'#bac2c8':'#c8cbd0'} speed={0.08} amplitude={0.22} roughness={0.48} exposure={0.88} interactive rippleStrength={0.42} rippleSize={0.82} tilt={0.65} lightMode={state.theme==='light'} maxDevicePixelRatio={1.5}/>:state.glass.backgroundEffect==='line-waves'?<LineWaves style={{}} color1="#9ea5ab" color2="#e0e3e6" color3="#747d84" colorCycleSpeed={0} speed={0.11} lineCount={72} lineWidth={1.2} glow={0.42} brightness={0.82} highlight={0.86} highlightWidth={0.82} warpIntensity={0.72} rotation={-33} enableMouseInteraction mouseInfluence={1.1} clickRipple lightMode={state.theme==='light'} maxDevicePixelRatio={1.5}/>:null}</div>}<div className="sidebar-reveal-zone" aria-hidden="true" onPointerEnter={openSidebarPeek}/><aside id="workspace-sidebar" className="sidebar" onPointerEnter={openSidebarPeek} onPointerLeave={closeSidebarPeek}><div className="brand"><span className="brand-mark"><BrandMark/></span><span className="brand-text">still.</span></div><p className="eyebrow side-label">{translate(state.locale,'workspaces')}</p><nav className="nav" aria-label={translate(state.locale,'workspaces')}>{state.workspaces.map((w,index)=><button key={w.id} data-workspace-drop-target={w.id} data-drop-active={workspaceDropTarget===w.id||undefined} className={(w.id===state.activeId?'active ':'')+(workspaceDropTarget===w.id?'workspace-drop-active':'')} aria-current={w.id===state.activeId?'page':undefined} title={displayWorkspaceName(w,state.locale)+' '+translate(state.locale,'workspaceSuffix')+(workspaceHasFinishedTimer(w)?' · '+translate(state.locale,'timerFinished'):'')} aria-label={displayWorkspaceName(w,state.locale)+' '+translate(state.locale,'workspaceSuffix')+(workspaceHasFinishedTimer(w)?' · '+translate(state.locale,'timerFinished'):'')} onClick={()=>switchWorkspace(w.id)}><Icon name="study"/><span className="nav-name">{displayWorkspaceName(w,state.locale)}</span><span className={'workspace-status-dot '+(workspaceHasFinishedTimer(w)?'timer-finished':'')} aria-hidden="true" title={workspaceHasFinishedTimer(w)?translate(state.locale,'timerFinished'):translate(state.locale,'noCompletedTimer')}/><kbd>{index+1}</kbd></button>)}</nav><button className="new-workspace" onClick={startCreate} aria-label={translate(state.locale,'newWorkspace')} title={translate(state.locale,'newWorkspace')}><Icon name="add"/><span className="nav-name">{translate(state.locale,'newWorkspace')}</span></button><div className="sidebar-bottom"><div className="sidebar-plugin-list">{state.sidebarPlugins.map(plugin=>plugin==='stack'?<button key={plugin} title={translate(state.locale,'sidebarStack')} aria-label={translate(state.locale,'sidebarStack')} onClick={stackWidgets}><Icon name="stack"/><span className="nav-name">{translate(state.locale,'stack')}</span></button>:<div className="sidebar-plugin-action" key={plugin}><button title={translate(state.locale,'sidebarLayoutHelp')} aria-label={translate(state.locale,'layout')} aria-pressed={layoutMode!==null} onClick={()=>setLayoutMode(current=>current===null?'picker':null)}><Icon name="arrange"/><span className="nav-name">{translate(state.locale,'layout')}</span></button>{layoutMode!==null&&<button type="button" className="sidebar-plugin-close" title={translate(state.locale,'sidebarExitLayout')} aria-label={translate(state.locale,'sidebarExitLayout')} onClick={()=>setLayoutMode(null)}>×</button>}</div>)}</div><button title={translate(state.locale,'sidebarAddPlugin')} aria-label={translate(state.locale,'sidebarAddPlugin')} onClick={()=>setModal('sidebarPlugins')}><Icon name="add"/><span className="nav-name">{translate(state.locale,'addPlugin')}</span></button><div className="sidebar-study-tools"><p className="eyebrow side-label">{translate(state.locale,'studyTools')}</p><button title={translate(state.locale,'quickNote')} aria-label={translate(state.locale,'quickNote')} onClick={quickCaptureNote}><Icon name="notes"/><span className="nav-name">{translate(state.locale,'quickNote')}</span></button><button title={translate(state.locale,'addToCalendar')} aria-label={translate(state.locale,'addToCalendar')} onClick={()=>runDashboardStudyAction(addDashboardCalendarEvent)}><Icon name="calendar"/><span className="nav-name">{translate(state.locale,'addToCalendar')}</span></button><button title={translate(state.locale,'planStudySession')} aria-label={translate(state.locale,'planStudySession')} onClick={()=>runDashboardStudyAction(askAiToPlanStudy)}><Icon name="study"/><span className="nav-name">{translate(state.locale,'planStudySession')}</span></button><button title={translate(state.locale,'aiAssistant')} aria-label={translate(state.locale,'aiAssistant')} aria-expanded={assistantOpen} aria-controls="ai-sidebar" onClick={()=>setAssistantOpen(value=>!value)}><Icon name="ai"/><span className="nav-name">{translate(state.locale,'aiAssistant')}</span></button></div><button title={translate(state.locale,'settings')} aria-label={translate(state.locale,'settings')} onClick={()=>{setSettingsTab('general');setModal('settings')}}><Icon name="settings"/><span className="nav-name">{translate(state.locale,'settings')}</span></button>{isTauri()&&<button title={fullscreen?translate(state.locale,'fullscreenExit'):translate(state.locale,'fullscreenEnter')} aria-label={fullscreen?translate(state.locale,'fullscreenExit'):translate(state.locale,'fullscreenEnter')} onClick={()=>void toggleFullscreen()}><Icon name="fullscreen"/><span className="nav-name">{fullscreen?translate(state.locale,'windowed'):translate(state.locale,'fullscreenEnter')}</span></button>}<div className="profile"><div className="avatar">Y</div><div>{translate(state.locale,'workspaceProfile')}<small>{chromeLauncher.native?translate(state.locale,'desktopLocal'):translate(state.locale,'previewLocal')}</small></div></div></div></aside>
    <main className={"main"+(workspace.role==='dashboard'?' main-dashboard':'')}><header className="topbar"><div className="workspace-heading"><h1 className="topbar-workspace-name" title={displayWorkspaceName(workspace,state.locale)}>{displayWorkspaceName(workspace,state.locale)}</h1></div><button type="button" className="sidebar-toggle" aria-controls="workspace-sidebar" aria-expanded={sidebarPeek} onClick={toggleSidebar}>{translate(state.locale,sidebarPeek?"hideSidebar":"showSidebar")}</button></header><div className="content">
    {arrange&&workspace.role!=='dashboard'&&workspace.role!=='library'&&<div className="workspace-tools"><span className="muted">{translate(state.locale,'makeSpaceYours')}</span><button onClick={()=>{setName(workspace.name);setFormError('');setModal('rename')}}>{translate(state.locale,'rename')}</button><button onClick={duplicate}>{translate(state.locale,'duplicateWorkspace')}</button><button onClick={removeWorkspace} disabled={state.workspaces.length===1}>{translate(state.locale,'removeWorkspace')}</button></div>}
    {state.workspaces.filter(w=>visited.current.has(w.id)).map(w=><div key={w.id} className="workspace-surface" hidden={w.id!==state.activeId} inert={w.id!==state.activeId}>{w.role==='dashboard'?<DashboardHome dashboard={w} library={libraryWorkspace} update={updateWidget} notify={notify} workspaceActive={w.id===state.activeId} workspaceChoices={state.workspaces.map(item=>({id:item.id,name:item.name}))} openWorkspace={switchWorkspace} openLibrary={openLibraryWorkspace} addCalendarEvent={addDashboardCalendarEvent} planStudy={askAiToPlanStudy} askAi={()=>setAssistantOpen(true)}/>:w.role==='library'?<LibraryHome workspace={w} workspaces={state.workspaces} update={updateWidget} notify={notify} workspaceActive={w.id===state.activeId} links={state.workspaces.flatMap(owner=>owner.groups.flatMap(group=>group.shortcuts.map(link=>({...link,workspaceId:owner.id,workspaceName:displayWorkspaceName(owner,state.locale),groupName:group.name||translate(state.locale,'group')}))))} openLink={(workspaceId,link)=>openGroupResource(workspaceId,link)} addFolder={addLibraryFolder} addInbox={ensureLibraryInbox} removeFolder={removeWidget}/>:<WorkspaceCanvas workspaceId={w.id} workspaceChoices={state.workspaces.map(item=>({id:item.id,name:item.name}))} openWorkspace={switchWorkspace} canvasFrameRate={state.canvasFrameRate} minimizeModifiers={state.shortcuts.minimizeModifiers} transferWidget={transferWidget} setWorkspaceDropTarget={setWorkspaceDropTarget} editTray={()=>setModal('trayEdit')} openInstalledApp={(app,source)=>launchInstalledApp(w.id,app,source)} widgetTrayVisible={widgetTrayVisible} toggleWidgetTray={toggleWidgetTray} openAppsDialog={()=>openAppsTrayDialog(w.id)} appAttachments={appAttachments} appOpenResult={appOpenResult} appAttachmentHandled={finishAppAttachment} pickApp={(id,at,width)=>pickApp(w.id,id,at,width)} saveApp={saveAppWidget} presets={state.presets} savePresets={savePresets} openDropped={(items,at,width)=>openDropped(w.id,items,at,width)} openPreset={(preset,at,width)=>openPreset(w.id,preset,at,width)} editPreset={editPreset} removePreset={removePreset} renamePreset={startPresetRename} renameGroup={id=>startGroupRename(w.id,id)} widgets={w.widgets} groups={w.groups} updateGroup={(id,patch)=>changeGroup(w.id,id,patch)} saveToGroup={(widget,groupId,preserveUndo)=>saveWidgetInGroup(w.id,widget,groupId,preserveUndo)} openGroup={(id,at,width)=>showGroup(w.id,id,at,width)} editGroup={editGroup} removeGroup={id=>removeGroup(w.id,id)} openGroupWidget={(entry,at,width)=>openGroupWidget(w.id,entry,at,width)} update={updateWidget} add={addWidget} remove={removeWidget} begin={()=>{undo.current=state}} bringToFront={bringToFront} notify={notify} obscured={!!modal} workspaceActive={w.id===state.activeId} openResource={(link,at)=>openGroupResource(w.id,link,at)} startupDeferredIds={startupDeferred} startupRelaunch={startWidget} widgetRelaunchPluginStatus={state.widgetRelaunchPluginStatus} widgetRelaunchMode={state.widgetRelaunchMode} widgetRelaunchColors={state.widgetRelaunchColors} setRelaunchMode={setRelaunchMode} setRelaunchColor={setRelaunchColor} screenshotPluginMode={state.screenshotPluginMode} screenshotPluginColors={state.screenshotPluginColors} screenshotPluginColorOverrides={state.screenshotPluginColorOverrides} setScreenshotMode={setScreenshotMode} setScreenshotColor={setScreenshotColor} setScreenshotColorOverride={setScreenshotColorOverride} clockPluginMode={state.clockPluginMode} clockPluginColors={state.clockPluginColors} clockPluginColorOverrides={state.clockPluginColorOverrides} setClockPluginMode={setClockMode} setClockPluginColor={setClockColor} setClockPluginColorOverride={setClockColorOverride} showAppAttachAction={state.showAppAttachAction} showAppDetachAction={state.showAppDetachAction} showAppSaveAction={state.showAppSaveAction} showWidgetExportPngAction={state.showWidgetExportPngAction} layoutMode={layoutMode} setLayoutMode={setLayoutMode}/>}</div>)}
    <footer className="footer"><span><i className="dot"/>{storage}</span><span>{chromeLauncher.native?'DESKTOP · in-app browser':'PREVIEW · browser controls'}</span></footer></div></main>
    <AssistantPanel key={workspace.id} inboxWidgetId={libraryWorkspace?.widgets.find(item=>item.type==='files'&&item.folderKey==='still-downloads-inbox')?.id} workspace={workspace} workspaces={state.workspaces.map(item=>({id:item.id,name:item.name}))} canDeleteWorkspace={state.workspaces.length>1} sidebarPlugins={state.sidebarPlugins} trayItems={assistantTrayItems(state.presets,workspace.groups)} open={assistantOpen} close={()=>setAssistantOpen(false)} dimensions={assistantDimensions} apply={applyAssistantLayout} act={applyAssistantActions} moveFile={moveAssistantFile} addCalendarEvents={addAssistantCalendarEvents} startTimer={startAssistantTimer} clearTray={clearAssistantTray} deleteWidgets={deleteAssistantWidgets} deleteWorkspace={deleteAssistantWorkspace} undo={undoAssistantLayout}/>
    {modal==='trayEdit'&&<Modal title={translate(state.locale,'manageSavedShortcuts')} close={()=>setModal(null)}><TrayEditor widgets={workspace.widgets} groups={workspace.groups} presets={state.presets} add={type=>type==='apps'?openAppsTrayDialog(workspace.id):addWidget(type)} editPreset={editPreset} renamePreset={startPresetRename} removePreset={removePreset} editGroup={editGroup} renameGroup={id=>startGroupRename(workspace.id,id)} openGroup={id=>{showGroup(workspace.id,id);setModal(null)}} removeGroup={id=>removeGroup(workspace.id,id)} removeWidget={removeWidget} hideSidebar={hideSidebar} hideWidgetTray={hideWidgetTray} arrange={()=>{setArrange(value=>!value);setModal(null)}} attach={()=>openAppsTrayDialog(workspace.id)}/></Modal>}
    {modal==='renameSaved'&&savedRename&&<Modal title={translate(state.locale,savedRename.kind==='group'?'renameGroup':'renameSavedShortcut')} close={cancelSavedRename}><form onSubmit={event=>{event.preventDefault();saveSavedRename()}}><label className="field-label">{translate(state.locale,'name')}<input className="palette-input" aria-label={translate(state.locale,'savedItemName')} value={savedRename.name} maxLength={60} autoFocus required onChange={event=>setSavedRename(current=>current?{...current,name:event.target.value}:current)} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();cancelSavedRename()}}}/></label>{formError&&<p className="widget-error" role="alert">{formError}</p>}<div className="tray-editor-actions"><button type="button" onClick={cancelSavedRename}>{translate(state.locale,'cancel')}</button><button className="primary" type="submit">{translate(state.locale,'saveName')}</button></div></form></Modal>}
    {modal==='delete'&&pendingRemoval&&<Modal title={translate(state.locale,pendingRemoval.kind==='group'?'deleteGroupTitle':'removeItemTitle').replace('{name}',pendingRemoval.name)} close={()=>{setPendingRemoval(null);setModal(null)}}><p className="notice">{translate(state.locale,pendingRemoval.kind==='widget'?'removeGroupCardNote':'deleteGroupContentsNote')}</p><div className="tray-editor-actions"><button autoFocus onClick={()=>{setPendingRemoval(null);setModal(null)}}>{translate(state.locale,'cancel')}</button><button onClick={()=>performRemoval(pendingRemoval)}>{translate(state.locale,pendingRemoval.kind==='group'?'deleteAll':'confirmRemoval')}</button></div></Modal>}
    {modal==='gallery' &&<Modal title={translate(state.locale,'addWidget')} close={()=>setModal(null)}><p className="notice">{translate(state.locale,'widgetBelongsToWorkspace')}</p>{widgetTypes.map(type=><button className="gallery-item" key={type} onClick={()=>addWidget(type)}><Icon name={widgetRegistry[type].icon}/><span>{translate(state.locale,'widget_'+type)}<small>{translate(state.locale,'widgetDesc_'+type)}</small></span><span>+</span></button>)}</Modal>}
    {modal==='sidebarPlugins'&&<Modal title={translate(state.locale,'addSidebarPlugin')} close={()=>setModal(null)}><p className="notice">{translate(state.locale,'addSidebarToolsHelp')}</p><button className="gallery-item" aria-label={translate(state.locale,'addStackPlugin')} disabled={state.sidebarPlugins.includes('stack')} onClick={()=>addSidebarPlugin('stack')}><Icon name="stack"/><span>{translate(state.locale,'stack')}<small>{translate(state.locale,'stackPluginDescription')}</small></span><span>{state.sidebarPlugins.includes('stack')?translate(state.locale,'added'):translate(state.locale,'addPlugin')}</span></button><button className="gallery-item" aria-label={translate(state.locale,'addLayoutPlugin')} disabled={state.sidebarPlugins.includes('layout')} onClick={()=>addSidebarPlugin('layout')}><Icon name="arrange"/><span>{translate(state.locale,'layout')}<small>{translate(state.locale,'layoutPluginDescription')}</small></span><span>{state.sidebarPlugins.includes('layout')?translate(state.locale,'added'):translate(state.locale,'addPlugin')}</span></button></Modal>}{modal==='group'&&selectedGroup&&<Modal title={selectedGroup.name||translate(state.locale,'editGroup')} close={()=>setModal(null)}><GroupEditor key={selectedGroup.id+'-'+groupMode} group={selectedGroup} initialMode={groupMode} update={patch=>changeGroup(workspace.id,selectedGroup.id,patch)} openLink={link=>{openGroupResource(workspace.id,link);setModal(null)}} openWidget={entry=>{openGroupWidget(workspace.id,entry);setModal(null)}}/></Modal>}
    {modal==='preset'&&presetDraft&&<Modal title={translate(state.locale,presetDraft.preset?'editCustomPreset':'customPreset')+' '+translate(state.locale,'widget_'+presetDraft.type)} close={()=>setModal(null)}><PresetEditor key={presetDraft.preset?.id??presetDraft.type} type={presetDraft.type} preset={presetDraft.preset} save={savePreset} close={()=>setModal(null)}/></Modal>}
    {modal==='apps'&&appTarget&&<Modal title={translate(state.locale,'attachOpenAppTitle')} close={()=>setModal(null)}><AppWindowPicker saveAppShortcutsOnAttach={state.saveAppShortcutsOnAttach} attach={(window,source,name,save)=>addManagedApp(source,name,save,window)} open={(source,name,save,icon,prepared)=>addManagedApp(source,name,save,undefined,icon,prepared)} close={()=>setModal(null)}/></Modal>}
    {modal==='appsTray'&&appTarget&&<Modal title={translate(state.locale,'apps')} close={()=>setModal(null)}><div className="apps-dialog-tabs" role="tablist" aria-label={translate(state.locale,'appsActions')}><button role="tab" aria-selected={appsDialogMode==='attach'} onClick={()=>setAppsDialogMode('attach')}>{translate(state.locale,'attachOpenApp')}</button><button role="tab" aria-selected={appsDialogMode==='shortcut'} onClick={()=>{setPresetDraft({type:'apps'});setAppsDialogMode('shortcut')}}>{translate(state.locale,'addSavedShortcut')}</button></div>{appsDialogMode==='attach'?<AppWindowPicker saveAppShortcutsOnAttach={state.saveAppShortcutsOnAttach} attach={(window,source,appName,save)=>addManagedApp(source,appName,save,window)} open={(source,appName,save,icon,prepared)=>addManagedApp(source,appName,save,undefined,icon,prepared)} close={()=>setModal(null)}/>:<PresetEditor key={presetDraft?.type+'-'+presetDraft?.preset?.id} type="apps" preset={presetDraft?.preset} save={savePreset} close={()=>setModal(null)}/>}</Modal>}
    {modal==='shortcuts'&&<Modal title={translate(state.locale,'keyboardShortcuts')} close={()=>setModal(null)}><ShortcutSettings shortcuts={state.shortcuts} save={saveShortcuts} close={()=>setModal(null)}/></Modal>}
    {modal==='tutorial'&&<Modal title={translate(state.locale,'welcomeToStill')} close={finishTutorial}><GettingStartedTour shortcuts={state.shortcuts} onFinish={finishTutorial} onOpenAssistant={()=>{finishTutorial();setAssistantOpen(true)}}/></Modal>}
    {modal==='settings'&&<Modal title={translate(state.locale,'settings')} close={()=>setModal(null)}><div className="settings-dialog"><div className="settings-tabs" role="tablist" aria-label={translate(state.locale,'settingsPages')}>{([{id:'general',label:translate(state.locale,'general')},{id:'appearance',label:translate(state.locale,'appearance')},{id:'plugins',label:translate(state.locale,'plugins')}] as const).map(tab=><button key={tab.id} id={'settings-tab-'+tab.id} type="button" role="tab" aria-selected={settingsTab===tab.id} aria-controls={'settings-'+tab.id} onClick={()=>setSettingsTab(tab.id)}>{tab.label}</button>)}</div>{settingsTab==='general'&&<GeneralSettings locale={state.locale} appShutdownBehavior={state.appShutdownBehavior} closeAppOnWidgetClose={state.closeAppOnWidgetClose} saveAppShortcutsOnAttach={state.saveAppShortcutsOnAttach} showAppAttachAction={state.showAppAttachAction} showAppDetachAction={state.showAppDetachAction} showAppSaveAction={state.showAppSaveAction} showWidgetExportPngAction={state.showWidgetExportPngAction} widgetRelaunchMode={state.widgetRelaunchMode} widgetRelaunchColors={state.widgetRelaunchColors} background={state.background} passThroughTransparentBackground={state.passThroughTransparentBackground} enableWholeWindowClickThrough={state.enableWholeWindowClickThrough} clickThroughActive={clickThroughActive} canvasFrameRate={state.canvasFrameRate} followWidgetToWorkspace={state.followWidgetToWorkspace} autoOpenCourseEnvironments={state.autoOpenCourseEnvironments} startup={startup} startupLoading={startupLoading} setStartupEnabled={enabled=>void setStartupEnabled(enabled)} toggleClickThrough={()=>void toggleClickThrough()} shortcuts={state.shortcuts} openShortcuts={()=>setModal('shortcuts')} runTutorial={()=>setModal('tutorial')} setRelaunchColor={setRelaunchColor} applyRelaunchModeToAll={()=>applyRelaunchMode(state.widgetRelaunchMode)} update={patch=>setState(s=>({...s,...patch}))}/>}{settingsTab==='appearance'&&<section className="settings-page" role="tabpanel" id="settings-appearance" aria-labelledby="settings-tab-appearance"><AppearanceSettings state={state} update={patch=>setState(s=>({...s,...patch}))}/></section>}{settingsTab==='plugins'&&<section className="settings-page" role="tabpanel" id="settings-plugins" aria-labelledby="settings-tab-plugins"><h3>{translate(state.locale,'sidebarPlugins')}</h3>{state.sidebarPlugins.includes('stack')&&<div className="settings-row"><span>{translate(state.locale,'stack')}</span><button type="button" aria-label={translate(state.locale,'removeStackPlugin')} onClick={()=>removeSidebarPlugin('stack')}>{translate(state.locale,'remove')}</button></div>}{state.sidebarPlugins.includes('layout')&&<div className="settings-row"><span>{translate(state.locale,'layout')}<small>{translate(state.locale,'layoutPluginDescription')}</small></span><button type="button" aria-label={translate(state.locale,'removeLayoutPlugin')} onClick={()=>removeSidebarPlugin('layout')}>{translate(state.locale,'remove')}</button></div>}{state.sidebarPlugins.length===0&&<p className="notice">{translate(state.locale,'noSidebarPlugins')}</p>}<WidgetPluginsSettings state={state} update={patch=>setState(s=>({...s,...patch}))} setRelaunchStatus={setRelaunchPluginStatus} setRelaunchColor={setRelaunchColor} setScreenshotColor={setScreenshotColor} setClockColor={setClockColor}/></section>}</div></Modal>}
    {(modal==='create'||modal==='rename')&&<Modal title={translate(state.locale,modal==='create'?'createWorkspaceTitle':'renameWorkspace')} close={()=>setModal(null)}><form onSubmit={e=>{e.preventDefault();submitWorkspace()}}><label className="field-label">{translate(state.locale,'workspaceName')}<input className="palette-input" aria-label={translate(state.locale,'workspaceName')} placeholder={translate(state.locale,'workspaceNamePlaceholder')} value={name} maxLength={60} onChange={e=>setName(e.target.value)} autoFocus/></label>{modal==='create'&&<><p className="notice">{translate(state.locale,'workspaceCreateHelp')}</p><div className="widget-choices">{widgetTypes.map(type=><label key={type}><input type="checkbox" checked={chosen.includes(type)} onChange={e=>setChosen(e.target.checked?[...chosen,type]:chosen.filter(t=>t!==type))}/><Icon name={widgetRegistry[type].icon}/>{translate(state.locale,'widget_'+type)}</label>)}</div></>}{formError&&<p className="widget-error" role="alert">{formError}</p>}<button className="primary full" type="submit">{translate(state.locale,modal==='create'?'createWorkspace':'saveName')}</button></form></Modal>}
    {modal==='course-environments'&&courseEnvironmentOffer&&<Modal title={translate(state.locale,'classesStarting')} close={dismissCourseEnvironmentOffer}><p className="notice">{translate(state.locale,'courseEnvironmentOfferDescription')}</p><p className="notice">{translate(state.locale,'courseEnvironmentRuntimeNote')}</p>{courseEnvironmentOffer.map(group=><div key={group.workspaceId} className="course-environment-offer"><p><strong>{group.workspaceName}</strong><small>{group.occurrences.map(item=>item.courseTitle).join(', ')}</small></p><button className="gallery-item" type="button" onClick={()=>openScheduledCourseEnvironment(group.workspaceId)}>{translate(state.locale,'openCourseEnvironment').replace('{workspace}',group.workspaceName)}</button></div>)}<div className="tray-editor-actions"><button type="button" onClick={dismissCourseEnvironmentOffer}>{translate(state.locale,'dismissCourseEnvironmentOffer')}</button></div></Modal>}    {modal==='commands'&&<Modal title={translate(state.locale,'commandPaletteTitle')} close={()=>setModal(null)}><input className="palette-input" aria-label={translate(state.locale,'searchCommands')} placeholder={translate(state.locale,'searchWorkspaceActions')} value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&matches[0]){setModal(null);matches[0].run()}}} autoFocus/>{matches.map((command,i)=><button className="gallery-item" key={i} onClick={()=>{setModal(null);command.run()}}>{command.label}</button>)}{!matches.length&&<p className="notice">{translate(state.locale,'noMatchingActions')}</p>}</Modal>}
    {message&&<div className="toast" role="status">{message}</div>}
  </div></LocaleContext.Provider>;
}
