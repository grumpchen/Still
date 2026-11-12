import { defaultShortcuts, parseShortcuts, type WorkspaceShortcuts } from './shortcuts.ts';
import { defaultGlass, parseGlass, type Appearance, type GlassSettings } from './appearance.ts';
import {parseAppShutdownBehavior,type AppShutdownBehavior} from './appSettings.ts';
import {type WidgetRelaunchMode,type WidgetRelaunchOverride,type WidgetRelaunchPluginStatus} from './widgetRelaunch.ts';
import {widgetCatalog,widgetTypes, type WidgetType} from './widgetCatalog.ts';
import {placement, nextPlacement,constrainPlacement,type Placement} from './layout.ts';
import {parseWebShortcuts, type WebShortcut} from './webShortcuts.ts';
import {widgetPreset,parsePresets,fileKind,fileName,type FileKind,type WidgetPreset} from './presets.ts';
import {type ScreenshotColorOverrides,type ScreenshotPluginMode} from './screenshotPlugin.ts';
import {type ClockPluginColorOverrides,type ClockPluginMode} from './clockPlugin.ts';
import {widgetTagColors,type WidgetTagColor} from './widgetTags.ts';
import {type CanvasFrameRate} from './performance.ts';
import {checkedFileNotes} from './fileNotes.ts';
import {checkedNoteDocuments,createNoteDocument,noteDocument,type NoteDocument} from './noteDocuments.ts';
import {checkedCalendarEvents,type StudyCalendarEvent} from './studyCalendar.ts';
import {type Locale} from '../localization.tsx';
export {widgetTypes, type WidgetType} from './widgetCatalog.ts';
export {widgetTagColors,type WidgetTagColor} from './widgetTags.ts';
export const DESMOS_URL = 'https://www.desmos.com/scientific';
export interface ScheduleEntry {id:string; day:number; time:string; title:string; location:string; workspaceId?:string; autoOpen?:boolean}
export interface GroupWidgetEntry {id:string;type:Exclude<WidgetType,'group'>;name:string;icon:string;iconData?:string;kind?:'shortcut'|'collected';instance?:WidgetInstance}
export interface SavedGroup {id:string;name:string;shortcuts:WebShortcut[];widgets:GroupWidgetEntry[];expanded:boolean}
export function collectedWidgetCount(group:SavedGroup|undefined):number{return group?.widgets.filter(entry=>entry.kind==='collected').length??0}
export function savedGroupHasContents(group:SavedGroup|undefined):boolean{return !!group&&(group.shortcuts.length>0||group.widgets.length>0)}
/** Delete a Group collection and its canvas cards as one state transition. */
export function deleteSavedGroup(workspace:Workspace,id:string):Workspace{
 if(!workspace.groups.some(group=>group.id===id))return workspace;
 return{...workspace,groups:workspace.groups.filter(group=>group.id!==id),widgets:workspace.widgets.filter(widget=>widget.groupId!==id)};
}
export interface WidgetInstance {
  id: string; type: WidgetType; span: 1 | 2 | 3; instanceNumber:number; title:string;
  tagColor:WidgetTagColor|null;
  relaunchOverride:WidgetRelaunchOverride;
  pluginControls:string[];
  clockPluginEnabled:boolean;
  lockPluginEnabled:boolean;locked:boolean;
  noteFont:'sans'|'serif'|'mono';noteFontSize:number;
  noteDocuments:NoteDocument[];activeNoteDocumentId:string;
  notesLibraryKey:string|null;notesLibraryName?:string;
  fileNotes:Record<string,string>;
  text: string;
  remaining: number; end: number | null;
   homeVersion?: number; folderName?: string;folderKey:string|null;fileKey:string|null;fileName?:string;fileKind?:FileKind;appKey:string|null;appName?:string;appIconData?:string;appPanelOpen:boolean;appWasCollected?:boolean;appReuseExisting:boolean;appMinWidth?:number;appMinHeight?:number;
  placement:Placement; minimized:boolean; restorePlacement:Placement|null; groupCollapsed:boolean;groupExpandedPlacement:Placement|null;shortcuts:WebShortcut[]; schedule:ScheduleEntry[];calendarEvents:StudyCalendarEvent[]; groupId:string|null;
}
export type WorkspaceRole='dashboard'|'study'|'library'|'custom';
export interface Workspace { id: string; name: string; widgets: WidgetInstance[]; groups:SavedGroup[]; layout: 'canvas';role:WorkspaceRole }
/** True when a Focus or Clock add-on timer in this workspace has reached zero. */
export function workspaceHasFinishedTimer(workspace:Pick<Workspace,'widgets'>,now=Date.now()):boolean{
 return workspace.widgets.some(widget=>(widget.type==='focus'||widget.clockPluginEnabled)&&(widget.end===null?widget.remaining===0:widget.end<=now));
}
export type SidebarPlugin='stack'|'layout';
export interface WorkspaceState {
  version: 10; activeId: string; workspaces: Workspace[]; sidebarCollapsed:boolean;sidebarPlugins:SidebarPlugin[];presets:WidgetPreset[];locale:Locale;
  theme: 'light' | 'dark'; density: 'comfortable' | 'compact'; background: 'solid' | 'dots' | 'transparent';
  shortcuts: WorkspaceShortcuts;
  appearance: Appearance; glass: GlassSettings;
  saveAppShortcutsOnAttach:boolean;appShutdownBehavior:AppShutdownBehavior;closeAppOnWidgetClose:boolean;
  showAppAttachAction:boolean;showAppDetachAction:boolean;showAppSaveAction:boolean;
  showWidgetRelaunchAction:boolean;showWidgetExportPngAction:boolean;
  widgetRelaunchMode:WidgetRelaunchMode;widgetRelaunchPluginStatus:WidgetRelaunchPluginStatus;widgetRelaunchColors:Partial<Record<WidgetTagColor,WidgetRelaunchMode>>;
  screenshotPluginMode:ScreenshotPluginMode;screenshotPluginColors:WidgetTagColor[];screenshotPluginColorOverrides:ScreenshotColorOverrides;
  clockPluginMode:ClockPluginMode;clockPluginColors:WidgetTagColor[];clockPluginColorOverrides:ClockPluginColorOverrides;
  passThroughTransparentBackground:boolean;enableWholeWindowClickThrough:boolean;
  canvasFrameRate:CanvasFrameRate;
  followWidgetToWorkspace:boolean;
  autoOpenCourseEnvironments:boolean;
}
export function createWidget(type: WidgetType): WidgetInstance {
  const id=crypto.randomUUID(),initialText='A clear space, a clear mind.\n\nStart with one important thing.\nLeave room for a new idea.',initialNote=createNoteDocument();initialNote.text=initialText;
  return { id, type, instanceNumber:1, title:'', tagColor:null, relaunchOverride:'follow',pluginControls:type==='tagStatus'?['widget-relaunch.tag-colors']:[], span: type === 'ai' ? 2 : 1,
    clockPluginEnabled:false,lockPluginEnabled:false,locked:false,noteFont:'sans',noteFontSize:14,noteDocuments:type==='notes'?[initialNote]:[],activeNoteDocumentId:type==='notes'?initialNote.id:'',notesLibraryKey:null,fileNotes:{},text: type === 'notes' ? initialText : '',
    remaining: 1500, end: null, placement:placement(type,null), shortcuts:[], schedule:[],groupId:null,folderKey:null,fileKey:null,appKey:null,appPanelOpen:false,appReuseExisting:false,
    minimized:false,restorePlacement:null,groupCollapsed:false,groupExpandedPlacement:null,calendarEvents:[] };
}
const MINIMIZED_WIDTH=136,MINIMIZED_HEIGHT=42;
const GROUP_COLLAPSED_WIDTH=204,GROUP_COLLAPSED_HEIGHT=43;
function compactPlacement(value:unknown,canvasWidth=20020,canvasHeight=20020):Placement{
 const p=value&&typeof value==='object'?value as Partial<Placement>:{};
 const width=Math.max(1,Math.min(MINIMIZED_WIDTH,Math.floor(canvasWidth)-20,Number.isFinite(p.width)?Math.round(p.width!):MINIMIZED_WIDTH));
 const height=Math.max(1,Math.min(MINIMIZED_HEIGHT,Math.floor(canvasHeight)-20,Number.isFinite(p.height)?Math.round(p.height!):MINIMIZED_HEIGHT));
 return{x:Math.max(0,Math.min(Math.floor(canvasWidth)-width-20,Number.isFinite(p.x)?Math.round(p.x!):0)),y:Math.max(0,Math.min(Math.floor(canvasHeight)-height-20,Number.isFinite(p.y)?Math.round(p.y!):0)),width,height};
}
export function minimizeWidgetInstance(widget:WidgetInstance,canvasWidth:number,canvasHeight:number):WidgetInstance{
 const restore=widget.minimized?widget.restorePlacement:widget.placement;
 return{...widget,minimized:true,restorePlacement:placement(widget.type,restore),placement:compactPlacement(widget.placement,canvasWidth,canvasHeight)};
}
export function moveMinimizedWidgetInstance(widget:WidgetInstance,at:{x:number;y:number},canvasWidth:number,canvasHeight:number):WidgetInstance{
 if(!widget.minimized)return widget;
 const moved=compactPlacement({...widget.placement,...at},canvasWidth,canvasHeight),restore=widget.restorePlacement??widget.placement;
 return{...widget,placement:moved,restorePlacement:{...restore,x:moved.x,y:moved.y}};
}
/** Arrange ordinary open widgets and compact/Group widgets in separate cascades. */
export function stackWorkspaceWidgets(widgets:WidgetInstance[],canvasWidth:number,canvasHeight:number):WidgetInstance[]{
 const open=widgets.filter(widget=>!widget.minimized&&widget.type!=='group'),special=widgets.filter(widget=>widget.minimized||widget.type==='group');
 const stepX=28,stepY=34,originY=16;
 const openRight=Math.max(16,...open.map((widget,index)=>16+index*stepX+widget.placement.width));
 const specialWidth=Math.max(1,...special.map(widget=>widget.minimized?MINIMIZED_WIDTH:widget.placement.width));
 const specialMaxX=Math.max(16,Math.floor(canvasWidth)-specialWidth-(special.length-1)*stepX-20);
 const specialX=special.length&&open.length?Math.min(openRight+48,specialMaxX):16;
 const stack=(items:WidgetInstance[],originX:number)=>items.map((widget,index)=>{
  if(widget.lockPluginEnabled&&widget.locked)return widget;
  const at={x:originX+index*stepX,y:originY+index*stepY};
  if(widget.minimized){
   const moved=moveMinimizedWidgetInstance(widget,at,canvasWidth,canvasHeight);
   return widget.type==='group'&&widget.groupExpandedPlacement?{...moved,groupExpandedPlacement:{...widget.groupExpandedPlacement,x:moved.placement.x,y:moved.placement.y}}:moved;
  }
  if(widget.type==='group'&&widget.groupCollapsed){
   const next=constrainGroupCollapsedPlacement({...widget.placement,...at},canvasWidth,canvasHeight);
   const expanded=widget.groupExpandedPlacement??widget.placement;
   return{...widget,placement:next,groupExpandedPlacement:{...expanded,x:next.x,y:next.y}};
  }
  return{...widget,placement:constrainPlacement(widget.type,{...widget.placement,...at},canvasWidth,{width:widget.appPanelOpen?widget.appMinWidth:undefined,height:widget.appPanelOpen?widget.appMinHeight:undefined},canvasHeight)};
 });
 const positions=new Map([...stack(open,16),...stack(special,specialX)].map(widget=>[widget.id,widget]));
 return widgets.map(widget=>positions.get(widget.id)??widget);
}
function checkedRestorePlacement(type:WidgetType,value:unknown):Placement|null{
 if(!value||typeof value!=='object')return null;
 const p=value as Partial<Placement>,meta=widgetCatalog[type];
 if([p.x,p.y,p.width,p.height].some(item=>typeof item!=='number'||!Number.isFinite(item))||p.x!<0||p.y!<0||p.width!<meta.minWidth||p.height!<meta.minHeight||p.width!>3000||p.height!>3000)return null;
 return placement(type,p);
}
export function restoreWidgetInstance(widget:WidgetInstance,canvasWidth:number,canvasHeight:number):WidgetInstance{
 if(!widget.minimized)return widget;
 const saved=widget.restorePlacement??widget.placement,candidate={...saved,x:widget.placement.x,y:widget.placement.y};
 const minimum=widget.type==='apps'&&widget.appPanelOpen?{width:widget.appMinWidth,height:widget.appMinHeight}:{};
 return{...widget,minimized:false,restorePlacement:null,placement:constrainPlacement(widget.type,candidate,canvasWidth,minimum,canvasHeight)};
}
export function constrainGroupCollapsedPlacement(value:Placement,canvasWidth:number,canvasHeight:number):Placement{
 const p=value&&typeof value==='object'?value as Partial<Placement>:{},widthLimit=Math.max(1,Math.min(3000,Math.floor(canvasWidth)-20)),heightLimit=Math.max(1,Math.min(3000,Math.floor(canvasHeight)-20));
 const width=Math.min(widthLimit,GROUP_COLLAPSED_WIDTH),height=Math.min(heightLimit,GROUP_COLLAPSED_HEIGHT);
 const x=Math.max(0,Math.min(Math.max(0,Math.floor(canvasWidth)-width-20),Number.isFinite(p.x)?Math.round(p.x!):0)),y=Math.max(0,Math.min(Math.max(0,Math.floor(canvasHeight)-height-20),Number.isFinite(p.y)?Math.round(p.y!):0));
 return{x,y,width,height};
}
export function toggleGroupCollapsed(widget:WidgetInstance,canvasWidth:number,canvasHeight:number):WidgetInstance{
 if(widget.type!=='group')return widget;
 if(!widget.groupCollapsed){
  const expanded=placement('group',widget.placement),candidate={...widget.placement,width:GROUP_COLLAPSED_WIDTH,height:GROUP_COLLAPSED_HEIGHT};
  return{...widget,groupCollapsed:true,groupExpandedPlacement:expanded,placement:constrainGroupCollapsedPlacement(candidate,canvasWidth,canvasHeight)};
 }
 const saved=checkedRestorePlacement('group',widget.groupExpandedPlacement)??placement('group',null),candidate={...saved,x:widget.placement.x,y:widget.placement.y};
 return{...widget,groupCollapsed:false,groupExpandedPlacement:null,placement:constrainPlacement('group',candidate,canvasWidth,{},canvasHeight)};
}
export function workspaceName(value: string): string {
  const name = value.trim(); if (!name || name.length > 60) throw new Error('Use a workspace name from 1 to 60 characters'); return name;
}
/** One shared state transition for the sidebar toggle button and the command-palette action. */
export function toggleSidebarCollapsed(collapsed: boolean): boolean {
  return !collapsed;
}
/** Accessible name and tooltip for the toggle, matching the visible next action. */
export function sidebarToggleLabel(collapsed: boolean): string {
  return collapsed ? 'Expand sidebar' : 'Collapse sidebar';
}
/** Short name-derived badge for collapsed workspace buttons (for example CH, ST). */
export function workspaceInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'WS';
  const letters = parts.length > 1 ? parts.map(part => part[0]).join('') : parts[0].slice(0, 2);
  return letters.toUpperCase().slice(0, 2);
}
/** Badges for every workspace; matching initials gain the 1-based sidebar order number (C1, C2). */
export function sidebarBadges(names: string[]): string[] {
  const letters = names.map(workspaceInitials);
  const counts = new Map<string, number>();
  for (const letter of letters) counts.set(letter, (counts.get(letter) ?? 0) + 1);
  return letters.map((letter, index) => counts.get(letter)! > 1 ? letter + (index + 1) : letter);
}
export function createWorkspace(name: string, types: WidgetType[],role:WorkspaceRole='custom'): Workspace {
  const widgets:WidgetInstance[]=[];
  for(const type of types){const widget=createWidget(type);widget.instanceNumber=nextInstanceNumber(type,widgets);widget.placement=nextPlacement(type,widgets);widgets.push(widget)}
  const groups=widgets.filter(w=>w.type==='group').map(w=>{w.groupId=crypto.randomUUID();return{id:w.groupId,name:'',shortcuts:[],widgets:[],expanded:false}});
  if(role==='library')for(const widget of widgets)if(widget.type==='files'){widget.title='Downloads Inbox';widget.folderKey='still-downloads-inbox'}
  return { id: crypto.randomUUID(), name: workspaceName(name), widgets, groups, layout:'canvas',role };
}
export function duplicateWorkspace(original: Workspace, name: string): Workspace {
  const ids=new Map(original.groups.map(g=>[g.id,crypto.randomUUID()])),collectedIds=new Map(original.groups.flatMap(g=>g.widgets.filter(entry=>entry.kind==='collected').map(entry=>[entry.id,crypto.randomUUID()] as const)));
  const groups=original.groups.map(g=>({...structuredClone(g),id:ids.get(g.id)!,widgets:g.widgets.map(entry=>{if(entry.kind!=='collected'||!entry.instance)return structuredClone(entry);const id=collectedIds.get(entry.id)!;return{...structuredClone(entry),id,instance:{...structuredClone(entry.instance),id}}})}));
  return { ...original, role:'custom',id: crypto.randomUUID(), name: workspaceName(name),groups, widgets: original.widgets.map(widget => ({...structuredClone(widget),id:crypto.randomUUID(),groupId:widget.groupId?ids.get(widget.groupId)??null:null,end:null})) };
}
export function transferWidgetInstance(source:Workspace,destination:Workspace,widgetId:string,canvasWidth:number,canvasHeight:number):{source:Workspace;destination:Workspace}|null{
 if(source.id===destination.id)return null;
 const widget=source.widgets.find(item=>item.id===widgetId);if(!widget||widget.lockPluginEnabled&&widget.locked)return null;
 let moved=widget.minimized?moveMinimizedWidgetInstance(widget,widget.placement,canvasWidth,canvasHeight):{...widget,placement:constrainPlacement(widget.type,widget.placement,canvasWidth,{},canvasHeight)},groups=destination.groups;
 const linked=widget.type==='group'&&widget.groupId?source.groups.find(group=>group.id===widget.groupId):undefined;
 if(linked){let id=linked.id;if(groups.some(group=>group.id===id))id=crypto.randomUUID();const collectedIds=new Map(linked.widgets.filter(entry=>entry.kind==='collected').map(entry=>[entry.id,crypto.randomUUID()]));groups=[...groups,{...structuredClone(linked),id,widgets:linked.widgets.map(entry=>{if(entry.kind!=='collected'||!entry.instance)return structuredClone(entry);const instanceId=collectedIds.get(entry.id)!;return{...structuredClone(entry),id:instanceId,instance:{...structuredClone(entry.instance),id:instanceId}}})}];if(id!==widget.groupId)moved={...moved,groupId:id}}
 return{source:{...source,widgets:source.widgets.filter(item=>item.id!==widgetId)},destination:{...destination,widgets:[...destination.widgets,moved],groups}};
}
export function nextInstanceNumber(type:WidgetType,widgets:WidgetInstance[]):number {return Math.max(0,...widgets.filter(w=>w.type===type).map(w=>w.instanceNumber))+1}
const GROUP_ICON_LIMIT=384*1024,GROUP_ICON_BUDGET=1024*1024;
export function checkedAppIconData(value:unknown):string|undefined {
 return typeof value==='string'&&value.length<=GROUP_ICON_LIMIT&&/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(value)?value:undefined;
}
function groupEntryIconData(entry:GroupWidgetEntry):string|undefined{return entry.kind==='collected'?entry.instance?.appIconData:entry.iconData}
export function groupIconBudget(groups:SavedGroup[],candidate?:GroupWidgetEntry):boolean {
 const total=groups.reduce((sum,group)=>sum+group.widgets.reduce((amount,item)=>amount+(groupEntryIconData(item)?.length??0),0),0)+(candidate?groupEntryIconData(candidate)?.length??0:0);
 return total<=GROUP_ICON_BUDGET;
}
export function groupWidgetEntry(value:{id?:string;type:WidgetType;name?:string;icon?:string;iconData?:string}):GroupWidgetEntry {
 if(!widgetTypes.includes(value.type)||value.type==='group')throw new Error('Choose a widget type for this group.');
 const name=value.name===undefined?widgetCatalog[value.type].name:value.name.trim();
 if(!name||name.length>60)throw new Error('Use a name from 1 to 60 characters.');
 const iconData=checkedAppIconData(value.iconData);
 return{id:value.id??crypto.randomUUID(),type:value.type,name,icon:(value.icon?.trim()||name.slice(0,2).toUpperCase()).slice(0,8),kind:'shortcut',...(value.type==='apps'&&iconData?{iconData}:{})};
}
export function saveWidgetToGroup(workspace:Workspace,widget:WidgetInstance,groupId?:string):Workspace {
 let entry=groupWidgetEntry({type:widget.type,name:widget.title.trim()||widgetCatalog[widget.type].name,iconData:widget.type==='apps'?widget.appIconData:undefined});
 if(!groupIconBudget(workspace.groups,entry)){const {iconData:_ignored,...fallback}=entry;entry=fallback}
 if(groupId){
  const group=workspace.groups.find(item=>item.id===groupId);
  if(!group)throw new Error('This group is no longer available.');
  if(group.widgets.length>=200)throw new Error('This group has reached its widget limit.');
  return updateSavedGroup(workspace,groupId,{widgets:[...group.widgets,entry],expanded:true});
 }
 if(workspace.groups.length>=200)throw new Error('This workspace has reached its group limit.');
 return{...workspace,groups:[...workspace.groups,{id:crypto.randomUUID(),name:'',shortcuts:[],widgets:[entry],expanded:true}]};
}
export function collectWidgetIntoGroup(workspace:Workspace,widgetId:string,groupId?:string,originalPlacement?:Placement):Workspace {
 const source=workspace.widgets.find(item=>item.id===widgetId);
 if(!source)throw new Error('This widget is no longer on the workspace.');
 if(source.lockPluginEnabled&&source.locked)throw new Error('Unlock this widget before moving it into a Group.');
 if(source.type==='group')throw new Error('Groups cannot be collected inside another Group.');
 if(workspace.groups.some(group=>group.widgets.some(item=>item.kind==='collected'&&item.id===widgetId)))throw new Error('This widget is already collected.');
 const target=groupId?workspace.groups.find(item=>item.id===groupId):undefined;
 if(groupId&&!target)throw new Error('This group is no longer available.');
 if(target&&target.widgets.length>=200)throw new Error('This group has reached its widget limit.');
 if(!target&&workspace.groups.length>=200)throw new Error('This workspace has reached its group limit.');
 const snapshot=persistentWidgetSnapshot({...source,...(originalPlacement?{placement:placement(source.type,originalPlacement)}:{})});
 let entry:GroupWidgetEntry={id:snapshot.id,type:snapshot.type as Exclude<WidgetType,'group'>,name:snapshot.title.trim()||widgetCatalog[snapshot.type].name,icon:widgetCatalog[snapshot.type].name.slice(0,2).toUpperCase(),kind:'collected',instance:snapshot};
 if(!groupIconBudget(workspace.groups,entry)){const {appIconData:_ignored,...instance}=snapshot;entry={...entry,instance}}
 const groups=target?updateSavedGroup(workspace,target.id,{widgets:[...target.widgets,entry],expanded:true}).groups:[...workspace.groups,{id:crypto.randomUUID(),name:'',shortcuts:[],widgets:[entry],expanded:true}];
 return{...workspace,groups,widgets:workspace.widgets.filter(item=>item.id!==widgetId)};
}
export function restoreCollectedWidget(workspace:Workspace,entryId:string,canvasWidth=20000,canvasHeight=20000):Workspace {
 const group=workspace.groups.find(item=>item.widgets.some(entry=>entry.id===entryId&&entry.kind==='collected'));
 const entry=group?.widgets.find(item=>item.id===entryId&&item.kind==='collected');
 if(!group||!entry?.instance)throw new Error('This collected widget is no longer available.');
 if(workspace.widgets.some(item=>item.id===entry.id))throw new Error('This widget is already on the workspace.');
 let restored=structuredClone(entry.instance);
 if(restored.minimized)restored=moveMinimizedWidgetInstance(restored,{x:restored.placement.x,y:restored.placement.y},canvasWidth,canvasHeight);
 else restored={...restored,placement:constrainPlacement(restored.type,restored.placement,canvasWidth,{width:restored.type==='apps'&&restored.appPanelOpen?restored.appMinWidth:undefined,height:restored.type==='apps'&&restored.appPanelOpen?restored.appMinHeight:undefined},canvasHeight)};
 return{...workspace,widgets:[...workspace.widgets,restored],groups:workspace.groups.map(item=>item.id===group.id?{...item,widgets:item.widgets.filter(saved=>saved.id!==entryId)}:item)};
}
function parseGroupEntries(value:unknown):GroupWidgetEntry[]{
 if(!Array.isArray(value))return [];const ids=new Set<string>();
 return value.slice(0,200).flatMap(v=>{try{
  if(!v||typeof v.type!=='string'||(v.name!==undefined&&typeof v.name!=='string'))return [];
  if(v.kind==='collected'){
   if(typeof v.id!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(v.id)||ids.has(v.id))return [];
   const instance=persistentWidgetSnapshot(v.instance);
   if(instance.type==='group'||instance.id!==v.id||instance.type!==v.type)return [];
   const name=typeof v.name==='string'?v.name.trim().slice(0,60):'';
   const item:GroupWidgetEntry={id:instance.id,type:instance.type,name:name||instance.title||widgetCatalog[instance.type].name,icon:typeof v.icon==='string'?v.icon.slice(0,8):widgetCatalog[instance.type].name.slice(0,2).toUpperCase(),kind:'collected',instance};
   ids.add(item.id);return[item];
  }
  if(v.kind!==undefined&&v.kind!=='shortcut')return [];
  const item=groupWidgetEntry({id:typeof v.id==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(v.id)&&!ids.has(v.id)?v.id:undefined,type:v.type,name:v.name,icon:typeof v.icon==='string'?v.icon:undefined,iconData:typeof v.iconData==='string'?v.iconData:undefined});ids.add(item.id);return[item];
 }catch{return []}});
}
const PERSISTED_WIDGET_FIELDS:(keyof WidgetInstance)[]=['id','type','span','instanceNumber','title','tagColor','relaunchOverride','pluginControls','clockPluginEnabled','lockPluginEnabled','locked','noteFont','noteFontSize','noteDocuments','activeNoteDocumentId','notesLibraryKey','notesLibraryName','fileNotes','text','remaining','end','folderName','folderKey','fileKey','fileName','fileKind','appKey','appName','appIconData','appPanelOpen','appWasCollected','appReuseExisting','appMinWidth','appMinHeight','placement','minimized','restorePlacement','shortcuts','schedule','calendarEvents','groupId'];
function persistentWidgetSnapshot(value:unknown):WidgetInstance {
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid collected widget.');
 const source=value as Record<string,unknown>,filtered=Object.fromEntries(PERSISTED_WIDGET_FIELDS.filter(key=>key in source).map(key=>[key,source[key]]));
 const checked=checkedWidget(filtered);
 // Open-app identity is held in native process state only; the collected
 // snapshot keeps its safe app configuration but never auto-launches it later.
 return checked.type==='apps'?{...checked,appPanelOpen:false,appWasCollected:source.appPanelOpen===true||source.appWasCollected===true}:checked;
}
function parseGroups(value:unknown):SavedGroup[]{
 if(!Array.isArray(value))return [];const ids=new Set<string>();
 return value.slice(0,200).flatMap(v=>{
  if(!v||typeof v.id!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(v.id)||ids.has(v.id))return [];ids.add(v.id);
  return[{id:v.id,name:typeof v.name==='string'?v.name.trim().slice(0,60):'',shortcuts:parseWebShortcuts(v.shortcuts,[]),widgets:parseGroupEntries(v.widgets),expanded:v.expanded===true}];
 });
}
function migrateLegacyBrowserGroups(widgets:unknown[],existing:SavedGroup[]):SavedGroup[]{
 const groups=[...existing],ids=new Set(groups.map(group=>group.id));
 for(const [index,value] of widgets.entries()){
  if(!value||typeof value!=='object'||Array.isArray(value))continue;
  const browser=value as Record<string,unknown>;
  if(browser.type!=='browser')continue;
  const rawLinks=[...(Array.isArray(browser.bookmarks)?browser.bookmarks.slice(0,100):[]),...(Array.isArray(browser.shortcuts)?browser.shortcuts.slice(0,99):[])];
  if(typeof browser.url==='string'&&browser.url.trim())rawLinks.push({name:typeof browser.title==='string'&&browser.title.trim()?browser.title:'Last open page',url:browser.url});
  const shortcuts:WebShortcut[]=[],urls=new Set<string>();
  for(const [linkIndex,rawLink] of rawLinks.entries()){
   const parsed=parseWebShortcuts([rawLink],[])[0];
   if(!parsed||urls.has(parsed.url))continue;
   urls.add(parsed.url);shortcuts.push({...parsed,id:parsed.id||`legacy-${index}-${linkIndex}`});
  }
  if(!shortcuts.length||groups.length>=200)continue;
  const sourceId=typeof browser.id==='string'?browser.id:`${index}`;
  const baseId=('legacy-browser-'+sourceId.replace(/[^a-zA-Z0-9-]/g,'-')).slice(0,80)||`legacy-browser-${index}`;
  let id=baseId,suffix=2;while(ids.has(id)){const tail=`-${suffix++}`;id=baseId.slice(0,80-tail.length)+tail}
  ids.add(id);
  const name=typeof browser.title==='string'?browser.title.trim().slice(0,60):'';
  groups.push({id,name:name||'Imported browser links',shortcuts,widgets:[],expanded:false});
 }
 return groups;
}
export function createWidgetFromGroupEntry(entry:GroupWidgetEntry,widgets:WidgetInstance[],at?:{x:number;y:number},width?:number):WidgetInstance {
 if(entry.kind==='collected')throw new Error('Collected widgets must be restored as the same instance.');
 const checked=groupWidgetEntry(entry),widget=createWidget(checked.type);widget.title=checked.name;widget.instanceNumber=nextInstanceNumber(checked.type,widgets);if(checked.type==='apps')widget.appIconData=checked.iconData;
 widget.placement=at?placement(checked.type,{...widget.placement,...at}):nextPlacement(checked.type,widgets,width);return widget;
}
export function createWidgetFromPreset(preset:WidgetPreset,widgets:WidgetInstance[],at?:{x:number;y:number},width?:number):WidgetInstance {
 const checked=widgetPreset(preset),widget=createWidget(checked.type);widget.title=checked.name;widget.instanceNumber=nextInstanceNumber(checked.type,widgets);widget.clockPluginEnabled=checked.clockPluginEnabled===true;if(checked.remaining!==undefined)widget.remaining=checked.remaining;
 if(checked.type==='files'&&checked.resourceKind==='document'){widget.fileKey=checked.fileSourceId;widget.fileName=checked.fileName;widget.fileKind=checked.fileKind;widget.fileNotes=checked.fileNotes??{}}
 else if(checked.type==='files'){widget.folderName=checked.folderName;widget.folderKey=checked.folderSourceId;widget.fileNotes=checked.fileNotes??{}}
  else if(checked.type==='apps'){widget.appKey=checked.appSourceId;widget.appName=checked.appName;widget.appIconData=checked.iconData}
  else if(checked.type==='notes'||checked.type==='ai')widget.text=checked.text??widget.text;
  if(checked.type==='notes'&&checked.noteDocuments){widget.noteDocuments=structuredClone(checked.noteDocuments);const active=noteDocument(widget.noteDocuments,checked.activeNoteDocumentId);widget.activeNoteDocumentId=active.id;widget.title=active.title;widget.text=active.text}
  if(checked.type==='notes'){widget.noteFont=checked.noteFont??widget.noteFont;widget.noteFontSize=checked.noteFontSize??widget.noteFontSize}
  else if(checked.type==='tagStatus')widget.pluginControls=checked.pluginControls??widget.pluginControls;
 else if(checked.type==='focus')widget.remaining=checked.remaining??widget.remaining;
 else if(checked.type==='timetable')widget.schedule=structuredClone(checked.schedule??[]);
 else if(checked.type==='calendar')widget.calendarEvents=structuredClone(checked.calendarEvents??[]);
 widget.placement=at?placement(checked.type,{...widget.placement,...at}):nextPlacement(checked.type,widgets,width);return widget;
}
export function openSavedGroup(workspace:Workspace,id:string,at?:{x:number;y:number},width?:number):Workspace {
 const group=workspace.groups.find(g=>g.id===id);if(!group)throw new Error('This group is no longer available.');
 const widget=createWidget('group');widget.groupId=id;widget.title=group.name;widget.shortcuts=structuredClone(group.shortcuts);widget.instanceNumber=nextInstanceNumber('group',workspace.widgets);
 widget.placement=at?placement('group',{...widget.placement,...at}):nextPlacement('group',workspace.widgets,width);
 return{...workspace,widgets:[...workspace.widgets,widget]};
}
export function updateSavedGroup(workspace:Workspace,id:string,patch:Partial<Omit<SavedGroup,'id'>>):Workspace {
 const groups=workspace.groups.map(g=>g.id===id?{...g,...patch,id:g.id}:g),group=groups.find(g=>g.id===id);
 if(!group)return workspace;
 return{...workspace,groups,widgets:workspace.widgets.map(w=>w.type==='group'&&w.groupId===id?{...w,title:group.name,shortcuts:structuredClone(group.shortcuts)}:w)};
}
export function saveGroupName(workspace:Workspace,id:string,value:string):Workspace {
 if(typeof value!=='string'||value.length>60)throw new Error('Use a group name up to 60 characters long.');
 return updateSavedGroup(workspace,id,{name:value.trim()});
}
export function createInitialState(): WorkspaceState {
  const workspaces = [createWorkspace('Dashboard',['calendar','focus','notes','timetable'],'dashboard'),createWorkspace('Library',['files','notes'],'library'),createWorkspace('Study',['desmos','notes','focus'],'study'), createWorkspace('Design',['notes','ai','files']), createWorkspace('Daily',['notes','focus']), createWorkspace('Minimal',['desmos','notes'])];
  return { version:10,activeId:workspaces[0].id,workspaces,sidebarCollapsed:false,sidebarPlugins:[],presets:[],locale:'en',theme:'light',density:'comfortable',background:'solid',shortcuts:defaultShortcuts(),appearance:'liquid-glass',glass:defaultGlass(),saveAppShortcutsOnAttach:true,appShutdownBehavior:'leaveOpen',closeAppOnWidgetClose:true,showAppAttachAction:false,showAppDetachAction:false,showAppSaveAction:false,showWidgetRelaunchAction:true,showWidgetExportPngAction:true,widgetRelaunchMode:'automatic',widgetRelaunchPluginStatus:'enabled',widgetRelaunchColors:{},screenshotPluginMode:'global',screenshotPluginColors:[],screenshotPluginColorOverrides:{},clockPluginMode:'global',clockPluginColors:[],clockPluginColorOverrides:{},passThroughTransparentBackground:false,enableWholeWindowClickThrough:false,canvasFrameRate:'display',followWidgetToWorkspace:true,autoOpenCourseEnvironments:true };
}
function parseSidebarPlugins(value:unknown):SidebarPlugin[]{
 if(!Array.isArray(value))return[];
 return [...new Set(value.filter((plugin):plugin is SidebarPlugin=>plugin==='stack'||plugin==='layout'))].slice(0,12);
}
function parseWidgetRelaunchMode(value:unknown):WidgetRelaunchMode{return value==='manual'?'manual':'automatic'}
function parseWidgetRelaunchPluginStatus(value:unknown):WidgetRelaunchPluginStatus{return value==='disabled'||value==='removed'?value:'enabled'}
function parseWidgetRelaunchColors(value:unknown):Partial<Record<WidgetTagColor,WidgetRelaunchMode>>{
 if(!value||typeof value!=='object'||Array.isArray(value))return{};
 return Object.fromEntries(widgetTagColors.flatMap(color=>{const mode=(value as Record<string,unknown>)[color];return mode==='automatic'||mode==='manual'?[[color,mode]]:[]})) as Partial<Record<WidgetTagColor,WidgetRelaunchMode>>;
}
function parseScreenshotPluginMode(value:unknown):ScreenshotPluginMode{return value==='tag-colors'||value==='off'?value:'global'}
function parseScreenshotPluginColors(value:unknown):WidgetTagColor[]{return Array.isArray(value)?[...new Set(value.filter((color):color is WidgetTagColor=>widgetTagColors.includes(color as WidgetTagColor)))]:[]}
function parseScreenshotPluginColorOverrides(value:unknown):ScreenshotColorOverrides{
 if(!value||typeof value!=='object'||Array.isArray(value))return{};
 const entries=Object.entries(value as Record<string,unknown>).filter((entry):entry is [WidgetTagColor,boolean]=>widgetTagColors.includes(entry[0] as WidgetTagColor)&&typeof entry[1]==='boolean');
 return Object.fromEntries(entries);
}
function parseClockPluginMode(value:unknown):ClockPluginMode{return value==='tag-colors'||value==='off'?value:'global'}
function parseClockPluginColors(value:unknown):WidgetTagColor[]{return Array.isArray(value)?[...new Set(value.filter((color):color is WidgetTagColor=>widgetTagColors.includes(color as WidgetTagColor)))]:[]}
function parseClockPluginColorOverrides(value:unknown):ClockPluginColorOverrides{
 if(!value||typeof value!=='object'||Array.isArray(value))return{};
 const entries=Object.entries(value as Record<string,unknown>).filter((entry):entry is [WidgetTagColor,boolean]=>widgetTagColors.includes(entry[0] as WidgetTagColor)&&typeof entry[1]==='boolean');
 return Object.fromEntries(entries);
}
function checkedWidget(value: unknown): WidgetInstance {
  const item = value as Partial<WidgetInstance>;
  if (!item || typeof item.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(item.id) || !widgetTypes.includes(item.type as WidgetType)) throw new Error('Invalid widget');
  const defaults = createWidget(item.type as WidgetType);
  const checkedFileKey=item.type==='files'&&typeof item.fileKey==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(item.fileKey)?item.fileKey:null;
  const checkedAppKey=item.type==='apps'&&typeof item.appKey==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(item.appKey)?item.appKey:null;
  // HWND ownership is process-local, but this flag is durable open intent. The
  // Apps widget resolves that intent by reusing or launching its saved shortcut.
  const checkedAppPanelOpen=!!checkedAppKey&&item.appPanelOpen===true;
  const checkedAppMinSize=(size:unknown,minimum:number):number|undefined=>item.type==='apps'&&checkedAppKey&&typeof size==='number'&&Number.isFinite(size)&&size>=minimum&&size<=3000?Math.ceil(size):undefined;
  const appMinWidth=checkedAppMinSize(item.appMinWidth,widgetCatalog.apps.minWidth),appMinHeight=checkedAppMinSize(item.appMinHeight,widgetCatalog.apps.minHeight);
  const restorePlacement=item.minimized===true?checkedRestorePlacement(item.type as WidgetType,item.restorePlacement):null;
  const minimized=item.minimized===true&&restorePlacement!==null;
  const groupCollapsed=item.type==='group'&&item.groupCollapsed===true;
  const groupExpandedPlacement=item.type==='group'?(checkedRestorePlacement('group',item.groupExpandedPlacement)??(groupCollapsed?placement('group',{x:(item.placement as Placement|undefined)?.x,y:(item.placement as Placement|undefined)?.y}):null)):null;
  const checkedPlacement=minimized?compactPlacement(item.placement):groupCollapsed?constrainGroupCollapsedPlacement(item.placement as Placement,20000,20000):placement(item.type as WidgetType,item.placement);
  if(checkedAppPanelOpen&&!minimized){if(appMinWidth!==undefined)checkedPlacement.width=Math.max(checkedPlacement.width,appMinWidth);if(appMinHeight!==undefined)checkedPlacement.height=Math.max(checkedPlacement.height,appMinHeight)}
  if (item.text !== undefined && typeof item.text !== 'string') throw new Error('Invalid note');
  const noteDocuments=item.type==='notes'?checkedNoteDocuments(item.noteDocuments,{id:`legacy-${item.id.slice(0,70)}`,title:typeof item.title==='string'?item.title:'',text:typeof item.text==='string'?item.text:defaults.text}):[];
  const activeNote=noteDocument(noteDocuments,typeof item.activeNoteDocumentId==='string'?item.activeNoteDocumentId:undefined);
  return {...defaults,...item,type:item.type as WidgetType,span:item.span===2?2:item.span===3?3:1,
    title:item.type==='notes'?activeNote.title:typeof item.title==='string'?item.title.trim().slice(0,60):'',
    text:item.type==='notes'?activeNote.text:typeof item.text==='string'?item.text:defaults.text,
    tagColor:widgetTagColors.includes(item.tagColor as WidgetTagColor)?item.tagColor as WidgetTagColor:null,
    relaunchOverride:item.relaunchOverride==='automatic'||item.relaunchOverride==='manual'?item.relaunchOverride:'follow',
    pluginControls:Array.isArray(item.pluginControls)?[...new Set(item.pluginControls.filter((control):control is string=>typeof control==='string'&&/^[a-z0-9.-]{1,80}$/.test(control)))].slice(0,20):defaults.pluginControls,
    clockPluginEnabled:item.clockPluginEnabled===true,
    lockPluginEnabled:item.lockPluginEnabled===true,locked:item.lockPluginEnabled===true&&item.locked===true,
    noteFont:item.noteFont==='serif'||item.noteFont==='mono'?item.noteFont:'sans',noteFontSize:typeof item.noteFontSize==='number'&&Number.isFinite(item.noteFontSize)?Math.max(12,Math.min(28,Math.round(item.noteFontSize/2)*2)):14,
    noteDocuments,activeNoteDocumentId:item.type==='notes'?activeNote.id:'',notesLibraryKey:item.type==='notes'&&typeof item.notesLibraryKey==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(item.notesLibraryKey)?item.notesLibraryKey:null,notesLibraryName:item.type==='notes'&&typeof item.notesLibraryName==='string'?item.notesLibraryName.slice(0,255):undefined,
    fileNotes:checkedFileNotes(item.fileNotes),
    groupId:item.type==='group'&&typeof item.groupId==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(item.groupId)?item.groupId:null,
    folderName:typeof item.folderName==='string'?item.folderName:undefined,
    folderKey:!checkedFileKey&&item.type==='files'&&typeof item.folderKey==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(item.folderKey)?item.folderKey:null,
    fileKey:checkedFileKey,fileName:checkedFileKey&&fileName(item.fileName)?item.fileName:undefined,fileKind:checkedFileKey&&fileKind(item.fileKind)?item.fileKind:undefined,
    appKey:checkedAppKey,
    appName:item.type==='apps'&&fileName(item.appName)?item.appName:undefined,appIconData:item.type==='apps'?checkedAppIconData(item.appIconData):undefined,
    appPanelOpen:checkedAppPanelOpen,...(item.type==='apps'&&item.appWasCollected===true?{appWasCollected:true}:{}),appMinWidth,appMinHeight,
    appReuseExisting:!!checkedAppKey&&item.appReuseExisting===true,
    instanceNumber:typeof item.instanceNumber==='number'&&Number.isSafeInteger(item.instanceNumber)&&item.instanceNumber>0&&item.instanceNumber<1000000?item.instanceNumber:1,
    placement:checkedPlacement,minimized,restorePlacement:minimized?restorePlacement:null,groupCollapsed,groupExpandedPlacement,
    shortcuts:parseWebShortcuts(item.shortcuts,defaults.shortcuts),
    schedule:Array.isArray(item.schedule)?item.schedule.filter(e=>e && typeof e.id==='string' && typeof e.title==='string' && typeof e.location==='string' && Number.isInteger(e.day) && e.day>=0 && e.day<7 && /^([01]\d|2[0-3]):[0-5]\d$/.test(e.time)).slice(0,500).map(e=>({...e,...(typeof e.workspaceId==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(e.workspaceId)?{workspaceId:e.workspaceId}:{}),autoOpen:e.autoOpen!==false})):[],
    calendarEvents:item.type==='calendar'?checkedCalendarEvents(item.calendarEvents):[],
    remaining:typeof item.remaining==='number'&&Number.isFinite(item.remaining)&&item.remaining>=0?item.remaining:1500,
    end:typeof item.end==='number'&&Number.isFinite(item.end)?item.end:null,
    };
}
export function parseState(source: unknown): WorkspaceState {
  const value = (typeof source==='string'?JSON.parse(source):source) as Omit<WorkspaceState,'version'> & {version:number};
  if (!value || ![2,3,4,5,6,7,8,9,10].includes(value.version) || !Array.isArray(value.workspaces) || !value.workspaces.length) throw new Error('Unsupported workspace data');
  const ids = new Set<string>();
  const widgetIds = new Set<string>();
  const workspaces = value.workspaces.map(workspace=>{
    if (!workspace || typeof workspace.id!=='string' || ids.has(workspace.id) || !Array.isArray(workspace.widgets)) throw new Error('Invalid workspace');
    ids.add(workspace.id);
    const widgets:WidgetInstance[]=[];
    for(const raw of workspace.widgets){if(raw&&typeof raw==='object'&&!widgetTypes.includes((raw as {type?:unknown}).type as WidgetType))continue;const widget=checkedWidget(raw);if(!(raw as WidgetInstance).placement)widget.placement=nextPlacement(widget.type,widgets);if(!(raw as WidgetInstance).instanceNumber || widgets.some(w=>w.type===widget.type&&w.instanceNumber===widget.instanceNumber))widget.instanceNumber=nextInstanceNumber(widget.type,widgets);widgets.push(widget)}
    for (const widget of widgets) { if (widgetIds.has(widget.id)) throw new Error('Duplicate widget instance'); widgetIds.add(widget.id); }
    const groups=migrateLegacyBrowserGroups(workspace.widgets,parseGroups(workspace.groups)),collectedIds=new Set(widgets.map(item=>item.id));let iconBytes=0;
    for(const group of groups){
      group.widgets=group.widgets.filter(item=>{if(item.kind!=='collected')return true;if(collectedIds.has(item.id))return false;collectedIds.add(item.id);return true});
      group.widgets=group.widgets.map(item=>{const iconData=groupEntryIconData(item);if(!iconData)return item;if(iconBytes+iconData.length>GROUP_ICON_BUDGET){if(item.kind==='collected'&&item.instance){const {appIconData:_ignored,...instance}=item.instance;return{...item,instance}}const {iconData:_ignored,...fallback}=item;return fallback}iconBytes+=iconData.length;return item});
    }
    // Older Group cards become reusable tray collections, without changing their links or geometry.
    for(const widget of widgets)if(widget.type==='group'){
      if(!widget.groupId||!groups.some(g=>g.id===widget.groupId)){
        const id=widget.groupId??widget.id;groups.push({id,name:widget.title,shortcuts:structuredClone(widget.shortcuts),widgets:[],expanded:false});widget.groupId=id;
      }
    }
    const role:WorkspaceRole=workspace.role==='dashboard'||workspace.role==='study'||workspace.role==='library'?workspace.role:workspace.name==='Study'?'study':'custom';
    return {id:workspace.id,name:workspaceName(workspace.name),widgets,groups,layout:'canvas' as const,role};
  });
  for(const workspace of workspaces)for(const widget of workspace.widgets)if(widget.type==='timetable')widget.schedule=widget.schedule.map(entry=>{if(!entry.workspaceId||ids.has(entry.workspaceId))return entry;const {workspaceId:_stale,...unlinked}=entry;return unlinked});
  let activeId=value.activeId;
  if(!workspaces.some(workspace=>workspace.role==='dashboard')){const dashboard=createWorkspace('Dashboard',['calendar','focus','notes','timetable'],'dashboard');workspaces.unshift(dashboard);ids.add(dashboard.id);if(value.version<8)activeId=dashboard.id;}
  if(!workspaces.some(workspace=>workspace.role==='library')){const library=createWorkspace('Library',['files','notes'],'library');workspaces.splice(Math.min(1,workspaces.length),0,library);ids.add(library.id);}
  const dashboard=workspaces.find(workspace=>workspace.role==='dashboard');
  if(dashboard)for(const type of ['calendar','focus','notes','timetable'] as WidgetType[]){const existing=dashboard.widgets.find(widget=>widget.type===type);if(existing){existing.minimized=false;existing.restorePlacement=null;continue}const widget=createWidget(type);widget.instanceNumber=nextInstanceNumber(type,dashboard.widgets);widget.placement=nextPlacement(type,dashboard.widgets);dashboard.widgets.push(widget);}
  if (!ids.has(activeId)) throw new Error('Missing active workspace');
  return {version:10,activeId,workspaces,sidebarCollapsed:value.sidebarCollapsed===true,sidebarPlugins:parseSidebarPlugins(value.sidebarPlugins),presets:parsePresets(value.presets),locale:value.locale==='zh-CN'?'zh-CN':'en',theme:value.theme==='dark'?'dark':'light',density:value.density==='compact'?'compact':'comfortable',background:value.background==='dots'?'dots':value.background==='transparent'?'transparent':'solid',shortcuts:parseShortcuts(value.shortcuts),appearance:value.appearance==='minimal'?'minimal':'liquid-glass',glass:parseGlass(value.glass),saveAppShortcutsOnAttach:value.saveAppShortcutsOnAttach!==false,appShutdownBehavior:parseAppShutdownBehavior(value.appShutdownBehavior),closeAppOnWidgetClose:value.closeAppOnWidgetClose!==false,showAppAttachAction:value.showAppAttachAction===true,showAppDetachAction:value.showAppDetachAction===true,showAppSaveAction:value.showAppSaveAction===true,showWidgetRelaunchAction:value.showWidgetRelaunchAction!==false,showWidgetExportPngAction:value.showWidgetExportPngAction!==false,widgetRelaunchMode:parseWidgetRelaunchMode(value.widgetRelaunchMode),widgetRelaunchPluginStatus:parseWidgetRelaunchPluginStatus(value.widgetRelaunchPluginStatus),widgetRelaunchColors:parseWidgetRelaunchColors(value.widgetRelaunchColors),screenshotPluginMode:parseScreenshotPluginMode(value.screenshotPluginMode),screenshotPluginColors:parseScreenshotPluginColors(value.screenshotPluginColors),screenshotPluginColorOverrides:parseScreenshotPluginColorOverrides(value.screenshotPluginColorOverrides),clockPluginMode:parseClockPluginMode(value.clockPluginMode),clockPluginColors:parseClockPluginColors(value.clockPluginColors),clockPluginColorOverrides:parseClockPluginColorOverrides(value.clockPluginColorOverrides),passThroughTransparentBackground:value.passThroughTransparentBackground===true,enableWholeWindowClickThrough:value.enableWholeWindowClickThrough===true,canvasFrameRate:value.canvasFrameRate===30||value.canvasFrameRate===60?value.canvasFrameRate:'display',followWidgetToWorkspace:value.followWidgetToWorkspace!==false,autoOpenCourseEnvironments:value.autoOpenCourseEnvironments!==false};
}
export function migratePreview(value: unknown): WorkspaceState {
  const legacy = value as {active:string;theme:string;density:string;background:string;workspaces:Record<string,Array<Record<string,unknown>>>};
  if (!legacy || !legacy.workspaces || typeof legacy.workspaces!=='object') throw new Error('Invalid original preview');
  const workspaces = Object.entries(legacy.workspaces).map(([name,items])=>{
    if (!Array.isArray(items)) throw new Error('Invalid original preview');
    const workspace = createWorkspace(name,[]);
    for(const item of items){if(item.type==='browser')continue;const widget=checkedWidget({...item,type:item.type==='calculator'?'desmos':item.type,span:item.wide?2:1});widget.placement=nextPlacement(widget.type,workspace.widgets);workspace.widgets.push(widget)}
    workspace.groups=migrateLegacyBrowserGroups(items,workspace.groups);
    return workspace;
  });
  return parseState(JSON.stringify({version:2,workspaces,activeId:workspaces.find(w=>w.name===legacy.active)?.id??workspaces[0]?.id,theme:legacy.theme,density:legacy.density,background:legacy.background}));
}
