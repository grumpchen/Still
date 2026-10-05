import { AKO_URL, GOOGLE_URL, normalizeUrl } from './browser.ts';
import { defaultShortcuts, parseShortcuts, type WorkspaceShortcuts } from './shortcuts.ts';
import { defaultGlass, parseGlass, type Appearance, type GlassSettings } from './appearance.ts';
import {widgetCatalog,widgetTypes, type WidgetType} from './widgetCatalog.ts';
import {placement, nextPlacement, type Placement} from './layout.ts';
import {defaultWebShortcuts, parseWebShortcuts, shortcut, type WebShortcut} from './webShortcuts.ts';
import {parseBookmarks} from './bookmarks.ts';
import {widgetPreset,parsePresets,fileKind,fileName,type FileKind,type WidgetPreset} from './presets.ts';
export {widgetTypes, type WidgetType} from './widgetCatalog.ts';
export const DESMOS_URL = 'https://www.desmos.com/scientific';
export interface Bookmark { id: string; name: string; url: string }
export interface ScheduleEntry {id:string; day:number; time:string; title:string; location:string}
export interface GroupWidgetEntry {id:string;type:Exclude<WidgetType,'group'>;name:string;icon:string}
export interface SavedGroup {id:string;name:string;shortcuts:WebShortcut[];widgets:GroupWidgetEntry[];expanded:boolean}
export interface WidgetInstance {
  id: string; type: WidgetType; span: 1 | 2 | 3; instanceNumber:number; title:string;
  text: string;
  remaining: number; end: number | null; url: string; bookmarks: Bookmark[];
   homeVersion?: number; folderName?: string;folderKey:string|null;fileKey:string|null;fileName?:string;fileKind?:FileKind;appKey:string|null;appName?:string;appPanelOpen:boolean;appReuseExisting:boolean;appMinWidth?:number;appMinHeight?:number;
  browserVersion:1; browserToolsExpanded:boolean; bookmarksExpanded:boolean; pageTitle:string; lectureRestore:Placement|null;
  placement:Placement; shortcuts:WebShortcut[]; schedule:ScheduleEntry[]; groupId:string|null;
}
export interface Workspace { id: string; name: string; widgets: WidgetInstance[]; groups:SavedGroup[]; layout: 'canvas'; browserWidth: number; browserHeight: number }
export function browserSize(value: unknown, fallback: number, maximum: number): number {
  return typeof value==='number'&&Number.isFinite(value)?Math.min(maximum,Math.max(50,Math.round(value))):fallback;
}
export interface WorkspaceState {
  version: 4; activeId: string; workspaces: Workspace[]; sidebarCollapsed:boolean;presets:WidgetPreset[];
  theme: 'light' | 'dark'; density: 'comfortable' | 'compact'; background: 'solid' | 'dots';
  shortcuts: WorkspaceShortcuts;
  appearance: Appearance; glass: GlassSettings;
}
export function createWidget(type: WidgetType): WidgetInstance {
  return { id: crypto.randomUUID(), type, instanceNumber:1, title:'', span: type === 'browser' ? 3 : type === 'ai' ? 2 : 1,
    text: type === 'notes' ? 'A clear space, a clear mind.\n\nStart with one important thing.\nLeave room for a new idea.' : '',
    remaining: 1500, end: null, placement:placement(type,null), shortcuts:type==='browser'?defaultWebShortcuts():[], schedule:[],groupId:null,folderKey:null,fileKey:null,appKey:null,appPanelOpen:false,appReuseExisting:false,
    url: type==='desmos'?DESMOS_URL:GOOGLE_URL, homeVersion:1,browserVersion:1,browserToolsExpanded:false,bookmarksExpanded:false,pageTitle:'',lectureRestore:null,
    bookmarks:type==='browser'?parseBookmarks(defaultWebShortcuts()):[] };
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
export function createWorkspace(name: string, types: WidgetType[]): Workspace {
  const widgets:WidgetInstance[]=[];
  for(const type of types){const widget=createWidget(type);widget.instanceNumber=nextInstanceNumber(type,widgets);widget.placement=nextPlacement(type,widgets);widgets.push(widget)}
  const groups=widgets.filter(w=>w.type==='group').map(w=>{w.groupId=crypto.randomUUID();return{id:w.groupId,name:'',shortcuts:[],widgets:[],expanded:false}});
  return { id: crypto.randomUUID(), name: workspaceName(name), widgets, groups, layout:'canvas', browserWidth:80, browserHeight:100 };
}
export function duplicateWorkspace(original: Workspace, name: string): Workspace {
  const ids=new Map(original.groups.map(g=>[g.id,crypto.randomUUID()]));
  return { ...original, id: crypto.randomUUID(), name: workspaceName(name),groups:original.groups.map(g=>({...structuredClone(g),id:ids.get(g.id)!})), widgets: original.widgets.map(widget => ({...structuredClone(widget),id:crypto.randomUUID(),groupId:widget.groupId?ids.get(widget.groupId)??null:null,end:null})) };
}
export function nextInstanceNumber(type:WidgetType,widgets:WidgetInstance[]):number {return Math.max(0,...widgets.filter(w=>w.type===type).map(w=>w.instanceNumber))+1}
export function createBrowserFromGroup(link:WebShortcut,widgets:WidgetInstance[],at?:{x:number;y:number}):WidgetInstance {
 const checked=shortcut(link),widget=createWidget('browser');
 widget.title=checked.name;widget.url=checked.url;widget.instanceNumber=nextInstanceNumber('browser',widgets);
 widget.placement=at?placement('browser',{...widget.placement,...at}):nextPlacement('browser',widgets);
 return widget;
}
export function groupWidgetEntry(value:{id?:string;type:WidgetType;name?:string;icon?:string}):GroupWidgetEntry {
 if(!widgetTypes.includes(value.type)||value.type==='group')throw new Error('Choose a widget type for this group.');
 const name=value.name===undefined?widgetCatalog[value.type].name:value.name.trim();
 if(!name||name.length>60)throw new Error('Use a name from 1 to 60 characters.');
 return{id:value.id??crypto.randomUUID(),type:value.type,name,icon:(value.icon?.trim()||name.slice(0,2).toUpperCase()).slice(0,8)};
}
function parseGroupEntries(value:unknown):GroupWidgetEntry[]{
 if(!Array.isArray(value))return [];const ids=new Set<string>();
 return value.slice(0,200).flatMap(v=>{try{
  if(!v||typeof v.type!=='string'||(v.name!==undefined&&typeof v.name!=='string'))return [];
  const item=groupWidgetEntry({id:typeof v.id==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(v.id)&&!ids.has(v.id)?v.id:undefined,type:v.type,name:v.name,icon:typeof v.icon==='string'?v.icon:undefined});ids.add(item.id);return[item];
 }catch{return []}});
}
function parseGroups(value:unknown):SavedGroup[]{
 if(!Array.isArray(value))return [];const ids=new Set<string>();
 return value.slice(0,200).flatMap(v=>{
  if(!v||typeof v.id!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(v.id)||ids.has(v.id))return [];ids.add(v.id);
  return[{id:v.id,name:typeof v.name==='string'?v.name.trim().slice(0,60):'',shortcuts:parseWebShortcuts(v.shortcuts,[]),widgets:parseGroupEntries(v.widgets),expanded:v.expanded===true}];
 });
}
export function createWidgetFromGroupEntry(entry:GroupWidgetEntry,widgets:WidgetInstance[],at?:{x:number;y:number},width?:number):WidgetInstance {
 const checked=groupWidgetEntry(entry),widget=createWidget(checked.type);widget.title=checked.name;widget.instanceNumber=nextInstanceNumber(checked.type,widgets);
 widget.placement=at?placement(checked.type,{...widget.placement,...at}):nextPlacement(checked.type,widgets,width);return widget;
}
export function createWidgetFromPreset(preset:WidgetPreset,widgets:WidgetInstance[],at?:{x:number;y:number},width?:number):WidgetInstance {
 const checked=widgetPreset(preset),widget=createWidget(checked.type);widget.title=checked.name;widget.instanceNumber=nextInstanceNumber(checked.type,widgets);
 if(checked.type==='browser')widget.url=checked.url;
 else if(checked.type==='files'&&checked.resourceKind==='document'){widget.fileKey=checked.fileSourceId;widget.fileName=checked.fileName;widget.fileKind=checked.fileKind}
 else if(checked.type==='files'){widget.folderName=checked.folderName;widget.folderKey=checked.folderSourceId}
 else if(checked.type==='apps'){widget.appKey=checked.appSourceId;widget.appName=checked.appName}
 else if(checked.type==='notes'||checked.type==='ai')widget.text=checked.text??widget.text;
 else if(checked.type==='focus')widget.remaining=checked.remaining??widget.remaining;
 else if(checked.type==='timetable')widget.schedule=structuredClone(checked.schedule??[]);
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
export function createInitialState(): WorkspaceState {
  const workspaces = [createWorkspace('Study',['browser','desmos','notes','focus']), createWorkspace('Design',['notes','ai','files']), createWorkspace('Daily',['notes','focus']), createWorkspace('Minimal',['desmos','notes'])];
  return { version:4,activeId:workspaces[0].id,workspaces,sidebarCollapsed:false,presets:[],theme:'light',density:'comfortable',background:'solid',shortcuts:defaultShortcuts(),appearance:'liquid-glass',glass:defaultGlass() };
}
function checkedWidget(value: unknown): WidgetInstance {
  const item = value as Partial<WidgetInstance>;
  if (!item || typeof item.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(item.id) || !widgetTypes.includes(item.type as WidgetType)) throw new Error('Invalid widget');
  const defaults = createWidget(item.type as WidgetType);
  const checkedFileKey=item.type==='files'&&typeof item.fileKey==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(item.fileKey)?item.fileKey:null;
  const checkedAppKey=item.type==='apps'&&typeof item.appKey==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(item.appKey)?item.appKey:null;
  const checkedAppPanelOpen=!!checkedAppKey&&item.appPanelOpen===true;
  const checkedAppMinSize=(size:unknown,minimum:number):number|undefined=>item.type==='apps'&&checkedAppKey&&typeof size==='number'&&Number.isFinite(size)&&size>=minimum&&size<=3000?Math.ceil(size):undefined;
  const appMinWidth=checkedAppMinSize(item.appMinWidth,widgetCatalog.apps.minWidth),appMinHeight=checkedAppMinSize(item.appMinHeight,widgetCatalog.apps.minHeight);
  const checkedPlacement=placement(item.type as WidgetType,item.placement);
  if(checkedAppPanelOpen){if(appMinWidth!==undefined)checkedPlacement.width=Math.max(checkedPlacement.width,appMinWidth);if(appMinHeight!==undefined)checkedPlacement.height=Math.max(checkedPlacement.height,appMinHeight)}
  if (item.text !== undefined && typeof item.text !== 'string') throw new Error('Invalid note');
  return {...defaults,...item,type:item.type as WidgetType,span:item.span===2?2:item.span===3?3:1,
    title:typeof item.title==='string'?item.title.trim().slice(0,60):'',
    groupId:item.type==='group'&&typeof item.groupId==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(item.groupId)?item.groupId:null,
    url:normalizeUrl(item.type==='browser'&&!item.homeVersion&&item.url===AKO_URL?GOOGLE_URL:typeof item.url==='string'?item.url:defaults.url),homeVersion:1,
    folderName:typeof item.folderName==='string'?item.folderName:undefined,
    folderKey:!checkedFileKey&&item.type==='files'&&typeof item.folderKey==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(item.folderKey)?item.folderKey:null,
    fileKey:checkedFileKey,fileName:checkedFileKey&&fileName(item.fileName)?item.fileName:undefined,fileKind:checkedFileKey&&fileKind(item.fileKind)?item.fileKind:undefined,
    appKey:checkedAppKey,
    appName:item.type==='apps'&&fileName(item.appName)?item.appName:undefined,
     appPanelOpen:checkedAppPanelOpen,appMinWidth,appMinHeight,
    appReuseExisting:!!checkedAppKey&&item.appReuseExisting===true,
    instanceNumber:typeof item.instanceNumber==='number'&&Number.isSafeInteger(item.instanceNumber)&&item.instanceNumber>0&&item.instanceNumber<1000000?item.instanceNumber:1,
     placement:checkedPlacement,
    browserVersion:1,browserToolsExpanded:item.browserToolsExpanded===true,bookmarksExpanded:item.bookmarksExpanded===true,pageTitle:typeof item.pageTitle==='string'?item.pageTitle.slice(0,200):'',
    lectureRestore:item.type==='browser'&&item.lectureRestore&&typeof item.lectureRestore==='object'?placement('browser',item.lectureRestore):null,
    shortcuts:parseWebShortcuts(item.shortcuts,item.type==='browser'?parseWebShortcuts(item.bookmarks,defaults.shortcuts):[]),
    schedule:Array.isArray(item.schedule)?item.schedule.filter(e=>e && typeof e.id==='string' && typeof e.title==='string' && typeof e.location==='string' && Number.isInteger(e.day) && e.day>=0 && e.day<7 && /^([01]\d|2[0-3]):[0-5]\d$/.test(e.time)).slice(0,500):[],
    remaining:typeof item.remaining==='number'&&Number.isFinite(item.remaining)&&item.remaining>=0?item.remaining:1500,
    end:typeof item.end==='number'&&Number.isFinite(item.end)?item.end:null,
    bookmarks:item.type==='browser'&&item.browserVersion!==1?parseBookmarks([...parseBookmarks(item.bookmarks),...parseWebShortcuts(item.shortcuts,[])],defaults.bookmarks):parseBookmarks(item.bookmarks,defaults.bookmarks)};
}
export function parseState(text: string): WorkspaceState {
  const value = JSON.parse(text) as Omit<WorkspaceState,'version'> & {version:number};
  if (!value || ![2,3,4].includes(value.version) || !Array.isArray(value.workspaces) || !value.workspaces.length) throw new Error('Unsupported workspace data');
  const ids = new Set<string>();
  const widgetIds = new Set<string>();
  const workspaces = value.workspaces.map(workspace=>{
    if (!workspace || typeof workspace.id!=='string' || ids.has(workspace.id) || !Array.isArray(workspace.widgets)) throw new Error('Invalid workspace');
    ids.add(workspace.id);
    const widgets:WidgetInstance[]=[];
    for(const raw of workspace.widgets){const widget=checkedWidget(raw);if(!(raw as WidgetInstance).placement)widget.placement=nextPlacement(widget.type,widgets);if(!(raw as WidgetInstance).instanceNumber || widgets.some(w=>w.type===widget.type&&w.instanceNumber===widget.instanceNumber))widget.instanceNumber=nextInstanceNumber(widget.type,widgets);widgets.push(widget)}
    // Preserve a custom current browser URL as a shortcut when migrating the embedded browser.
    if(value.version===2)for(const widget of widgets)if(widget.type==='browser'){
      if(!widget.shortcuts.some(s=>s.url===widget.url))widget.shortcuts.push({id:crypto.randomUUID(),name:'Saved website',url:widget.url,icon:'↗'});
      for(const link of defaultWebShortcuts())if(!widget.shortcuts.some(s=>s.url===link.url))widget.shortcuts.push(link);
    }
    for (const widget of widgets) { if (widgetIds.has(widget.id)) throw new Error('Duplicate widget instance'); widgetIds.add(widget.id); }
    const groups=parseGroups(workspace.groups);
    // Older Group cards become reusable tray collections, without changing their links or geometry.
    for(const widget of widgets)if(widget.type==='group'){
      if(!widget.groupId||!groups.some(g=>g.id===widget.groupId)){
        const id=widget.groupId??widget.id;groups.push({id,name:widget.title,shortcuts:structuredClone(widget.shortcuts),widgets:[],expanded:false});widget.groupId=id;
      }
    }
    return {id:workspace.id,name:workspaceName(workspace.name),widgets,groups,layout:'canvas',browserWidth:browserSize(workspace.browserWidth,80,95),browserHeight:browserSize(workspace.browserHeight,100,100)} as Workspace;
  });
  if (!ids.has(value.activeId)) throw new Error('Missing active workspace');
  return {version:4,activeId:value.activeId,workspaces,sidebarCollapsed:value.sidebarCollapsed===true,presets:parsePresets(value.presets),theme:value.theme==='dark'?'dark':'light',density:value.density==='compact'?'compact':'comfortable',background:value.background==='dots'?'dots':'solid',shortcuts:parseShortcuts(value.shortcuts),appearance:value.appearance==='minimal'?'minimal':'liquid-glass',glass:parseGlass(value.glass)};
}
export function migratePreview(value: unknown): WorkspaceState {
  const legacy = value as {active:string;theme:string;density:string;background:string;workspaces:Record<string,Array<Record<string,unknown>>>};
  if (!legacy || !legacy.workspaces || typeof legacy.workspaces!=='object') throw new Error('Invalid original preview');
  const workspaces = Object.entries(legacy.workspaces).map(([name,items])=>{
    if (!Array.isArray(items)) throw new Error('Invalid original preview');
    const workspace = createWorkspace(name,[]);
    for(const item of items){const widget=checkedWidget({...item,type:item.type==='calculator'?'desmos':item.type,span:item.wide?2:1});widget.placement=nextPlacement(widget.type,workspace.widgets);workspace.widgets.push(widget)}
    if(name===legacy.active&&!workspace.widgets.some(w=>w.type==='browser'))workspace.widgets.unshift(createWidget('browser'));
    return workspace;
  });
  return parseState(JSON.stringify({version:2,workspaces,activeId:workspaces.find(w=>w.name===legacy.active)?.id??workspaces[0]?.id,theme:legacy.theme,density:legacy.density,background:legacy.background}));
}
