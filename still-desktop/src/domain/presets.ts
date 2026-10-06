import {normalizeUrl} from './browser.ts';
import {widgetCatalog,type WidgetType} from './widgetCatalog.ts';
import type {WidgetInstance} from './workspaces.ts';
export type FileKind='pdf'|'image'|'media'|'document';
export type PresetType=Exclude<WidgetType,'group'>;
export type GenericPresetType=Exclude<PresetType,'browser'|'files'|'apps'>;
export interface PresetScheduleEntry {id:string;day:number;time:string;title:string;location:string}
export type WidgetPreset={id:string;type:'browser';name:string;url:string}
 |{id:string;type:'files';name:string;resourceKind?:'folder';folderSourceId:string;folderName:string}
 |{id:string;type:'files';name:string;resourceKind:'document';fileSourceId:string;fileName:string;fileKind:FileKind}
 |{id:string;type:'apps';name:string;appSourceId:string;appName:string;iconData?:string}
 |{id:string;type:GenericPresetType;name:string;text?:string;remaining?:number;schedule?:PresetScheduleEntry[]};
export function fileKind(value:unknown):value is FileKind{return value==='pdf'||value==='image'||value==='media'||value==='document'}
export function fileName(value:unknown):value is string{return typeof value==='string'&&value.length>0&&value.length<=260&&!/[\\/\x00-\x1f]/.test(value)&&value!=='.'&&value!=='..'}
function checkedIconData(value:unknown):string|undefined{return typeof value==='string'&&value.length<=16*1024&&/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(value)?value:undefined}
function savedSchedule(value:unknown):PresetScheduleEntry[]{
 if(!Array.isArray(value))return [];
 const ids=new Set<string>();return value.slice(0,500).flatMap(entry=>{
  if(!entry||typeof entry.id!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(entry.id)||ids.has(entry.id)||!Number.isInteger(entry.day)||entry.day<0||entry.day>6||typeof entry.time!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(entry.time)||typeof entry.title!=='string'||!entry.title.trim()||typeof entry.location!=='string')return [];
  ids.add(entry.id);return[{id:entry.id,day:entry.day,time:entry.time,title:entry.title.trim().slice(0,80),location:entry.location.slice(0,100)}];
 });
}
export function widgetPreset(value:WidgetPreset):WidgetPreset {
 if(!value||typeof value.id!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(value.id))throw new Error('Invalid saved widget.');
 const name=typeof value.name==='string'?value.name.trim():'';if(!name||name.length>60)throw new Error('Use a name from 1 to 60 characters.');
 if(value.type==='browser')return{id:value.id,type:'browser',name,url:normalizeUrl(value.url)};
 if(value.type==='files'){
  if(value.resourceKind==='document'){
   if(typeof value.fileSourceId!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(value.fileSourceId))throw new Error('Choose a file for this saved shortcut.');
   if(!fileName(value.fileName)||!fileKind(value.fileKind))throw new Error('Use a supported file shortcut.');
   return{id:value.id,type:'files',resourceKind:'document',name,fileSourceId:value.fileSourceId,fileName:value.fileName,fileKind:value.fileKind};
  }
  if(value.resourceKind!==undefined&&value.resourceKind!=='folder')throw new Error('Use a folder or file shortcut.');
  if(typeof value.folderSourceId!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(value.folderSourceId))throw new Error('Choose a folder for this saved Files widget.');
  return{id:value.id,type:'files',...(value.resourceKind==='folder'?{resourceKind:'folder' as const}:{}),name,folderSourceId:value.folderSourceId,folderName:typeof value.folderName==='string'?value.folderName.slice(0,200):'Selected folder'};
 }
 if(value.type==='apps'){
  if(typeof value.appSourceId!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(value.appSourceId)||!fileName(value.appName))throw new Error('Choose an application shortcut before saving this Apps widget.');
   const iconData=checkedIconData(value.iconData);
   return{id:value.id,type:'apps',name,appSourceId:value.appSourceId,appName:value.appName,...(iconData?{iconData}:{})};
 }
 if(value.type==='notes'||value.type==='ai'){
  if(value.text!==undefined&&(typeof value.text!=='string'||value.text.length>2*1024*1024))throw new Error('Use valid saved text.');
  return{id:value.id,type:value.type,name,...(value.text===undefined?{}:{text:value.text})};
 }
 if(value.type==='focus'){
  if(value.remaining!==undefined&&(typeof value.remaining!=='number'||!Number.isFinite(value.remaining)||value.remaining<0||value.remaining>31536000))throw new Error('Use a valid saved timer duration.');
  return{id:value.id,type:'focus',name,...(value.remaining===undefined?{}:{remaining:Math.ceil(value.remaining)})};
 }
 if(value.type==='timetable')return{id:value.id,type:'timetable',name,schedule:savedSchedule(value.schedule)};
 if(value.type==='desmos')return{id:value.id,type:'desmos',name};
 throw new Error('Choose a supported widget.');
}
export function presetFromWidget(widget:WidgetInstance):WidgetPreset {
 const id=crypto.randomUUID(),name=widget.title.trim()||widgetCatalog[widget.type].name;
 if(widget.type==='browser')return widgetPreset({id,type:'browser',name,url:widget.url});
 if(widget.type==='files'){
  if(widget.fileKey&&widget.fileName&&widget.fileKind)return widgetPreset({id,type:'files',resourceKind:'document',name,fileSourceId:widget.fileKey,fileName:widget.fileName,fileKind:widget.fileKind});
  if(widget.folderKey||widget.folderName)return widgetPreset({id,type:'files',name,folderSourceId:widget.folderKey||widget.id,folderName:widget.folderName||'Selected folder'});
  throw new Error('Choose a folder or file before saving this Files widget.');
 }
 if(widget.type==='apps'){
  if(!widget.appKey||!widget.appName)throw new Error('Choose an application shortcut before saving this Apps widget.');
   return widgetPreset({id,type:'apps',name,appSourceId:widget.appKey,appName:widget.appName,iconData:widget.appIconData});
 }
 if(widget.type==='group')throw new Error('Groups are already saved in the widget tray.');
 return widgetPreset({id,type:widget.type,name,
  ...(widget.type==='notes'||widget.type==='ai'?{text:widget.text}:{}),
  ...(widget.type==='focus'?{remaining:widget.end?Math.max(0,Math.ceil((widget.end-Date.now())/1000)):widget.remaining}:{}),
  ...(widget.type==='timetable'?{schedule:widget.schedule}:{})});
}
export function parsePresets(value:unknown):WidgetPreset[]{
 if(!Array.isArray(value))return [];const ids=new Set<string>();
 return value.slice(0,200).flatMap(v=>{try{const item=widgetPreset(v);if(ids.has(item.id))return [];ids.add(item.id);return[item]}catch{return []}});
}
