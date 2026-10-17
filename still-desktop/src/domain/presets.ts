import {widgetCatalog,type WidgetType} from './widgetCatalog.ts';
import type {WidgetInstance} from './workspaces.ts';
import {checkedFileNotes} from './fileNotes.ts';
import {checkedNoteDocuments,noteDocument,type NoteDocument} from './noteDocuments.ts';
export type FileKind='pdf'|'image'|'media'|'document';
export type PresetType=Exclude<WidgetType,'group'>;
export type GenericPresetType=Exclude<PresetType,'files'|'apps'>;
export interface PresetScheduleEntry {id:string;day:number;time:string;title:string;location:string}
export type WidgetPreset={id:string;type:'files';name:string;resourceKind?:'folder';folderSourceId:string;folderName:string;fileNotes?:Record<string,string>;remaining?:number;clockPluginEnabled?:boolean}
 |{id:string;type:'files';name:string;resourceKind:'document';fileSourceId:string;fileName:string;fileKind:FileKind;fileNotes?:Record<string,string>;remaining?:number;clockPluginEnabled?:boolean}
 |{id:string;type:'apps';name:string;appSourceId:string;appName:string;iconData?:string;remaining?:number;clockPluginEnabled?:boolean}
 |{id:string;type:GenericPresetType;name:string;text?:string;noteDocuments?:NoteDocument[];activeNoteDocumentId?:string;noteFont?:'sans'|'serif'|'mono';noteFontSize?:number;remaining?:number;schedule?:PresetScheduleEntry[];pluginControls?:string[];clockPluginEnabled?:boolean};
export function fileKind(value:unknown):value is FileKind{return value==='pdf'||value==='image'||value==='media'||value==='document'}
export function fileName(value:unknown):value is string{return typeof value==='string'&&value.length>0&&value.length<=260&&!/[\\/\x00-\x1f]/.test(value)&&value!=='.'&&value!=='..'}
function checkedIconData(value:unknown):string|undefined{return typeof value==='string'&&value.length<=32*1024&&/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(value)?value:undefined}
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
 if(value.remaining!==undefined&&(typeof value.remaining!=='number'||!Number.isFinite(value.remaining)||value.remaining<0||value.remaining>31536000))throw new Error('Use a valid saved timer duration.');
 const remaining=value.remaining===undefined?{}:{remaining:Math.ceil(value.remaining)};
 const clockPluginEnabled=value.clockPluginEnabled===true?true:undefined;
 if(value.type==='files'){
  if(value.resourceKind==='document'){
   if(typeof value.fileSourceId!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(value.fileSourceId))throw new Error('Choose a file for this saved shortcut.');
   if(!fileName(value.fileName)||!fileKind(value.fileKind))throw new Error('Use a supported file shortcut.');
   return{id:value.id,type:'files',resourceKind:'document',name,fileSourceId:value.fileSourceId,fileName:value.fileName,fileKind:value.fileKind,...(value.fileNotes?{fileNotes:checkedFileNotes(value.fileNotes)}:{}),...remaining,...(clockPluginEnabled?{clockPluginEnabled}:{})};
  }
  if(value.resourceKind!==undefined&&value.resourceKind!=='folder')throw new Error('Use a folder or file shortcut.');
  if(typeof value.folderSourceId!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(value.folderSourceId))throw new Error('Choose a folder for this saved Files widget.');
  return{id:value.id,type:'files',...(value.resourceKind==='folder'?{resourceKind:'folder' as const}:{}),name,folderSourceId:value.folderSourceId,folderName:typeof value.folderName==='string'?value.folderName.slice(0,200):'Selected folder',...(value.fileNotes?{fileNotes:checkedFileNotes(value.fileNotes)}:{}),...remaining,...(clockPluginEnabled?{clockPluginEnabled}:{})};
 }
 if(value.type==='apps'){
  if(typeof value.appSourceId!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(value.appSourceId)||!fileName(value.appName))throw new Error('Choose an application shortcut before saving this Apps widget.');
   const iconData=checkedIconData(value.iconData);
   return{id:value.id,type:'apps',name,appSourceId:value.appSourceId,appName:value.appName,...(iconData?{iconData}:{}),...remaining,...(clockPluginEnabled?{clockPluginEnabled}:{})};
 }
 if(value.type==='notes'||value.type==='ai'){
  if(value.text!==undefined&&(typeof value.text!=='string'||value.text.length>2*1024*1024))throw new Error('Use valid saved text.');
  // Tray copies preserve note content but deliberately sever the selected-folder relationship.
  const docs=value.type==='notes'&&(value.noteDocuments!==undefined||value.text!==undefined)?checkedNoteDocuments(value.noteDocuments,{id:'legacy-preset',title:'',text:typeof value.text==='string'?value.text:''}).map(({sourcePath,...document})=>document):undefined;
  const active=value.type==='notes'?noteDocument(docs!,value.activeNoteDocumentId):undefined;
  const noteFont=value.type==='notes'&&(value.noteFont==='serif'||value.noteFont==='mono'||value.noteFont==='sans')?value.noteFont:undefined;
  const noteFontSize=value.type==='notes'&&typeof value.noteFontSize==='number'&&Number.isFinite(value.noteFontSize)?Math.max(12,Math.min(28,Math.round(value.noteFontSize/2)*2)):undefined;
  return{id:value.id,type:value.type,name,...(active?{text:active.text,noteDocuments:docs,activeNoteDocumentId:active.id}:value.text===undefined?{}:{text:value.text}),...(noteFont?{noteFont}:{}),...(noteFontSize?{noteFontSize}:{}),...remaining,...(clockPluginEnabled?{clockPluginEnabled}:{})};
 }
 if(value.type==='focus'){
  return{id:value.id,type:value.type,name,...remaining,...(clockPluginEnabled?{clockPluginEnabled}:{})};
 }
 if(value.type==='timetable')return{id:value.id,type:'timetable',name,schedule:savedSchedule(value.schedule),...remaining,...(clockPluginEnabled?{clockPluginEnabled}:{})};
 if(value.type==='tagStatus')return{id:value.id,type:'tagStatus',name,pluginControls:Array.isArray(value.pluginControls)?[...new Set(value.pluginControls.filter(control=>typeof control==='string'&&/^[a-z0-9.-]{1,80}$/.test(control)))].slice(0,20):undefined,...remaining,...(clockPluginEnabled?{clockPluginEnabled}:{})};
 if(value.type==='desmos')return{id:value.id,type:'desmos',name,...remaining,...(clockPluginEnabled?{clockPluginEnabled}:{})};
 throw new Error('Choose a supported widget.');
}
export function presetFromWidget(widget:WidgetInstance):WidgetPreset {
 const id=crypto.randomUUID(),name=widget.title.trim()||widgetCatalog[widget.type].name;
 const remaining=widget.end?Math.max(0,Math.ceil((widget.end-Date.now())/1000)):widget.remaining;
 if(widget.type==='files'){
  if(widget.fileKey&&widget.fileName&&widget.fileKind)return widgetPreset({id,type:'files',resourceKind:'document',name,fileSourceId:widget.fileKey,fileName:widget.fileName,fileKind:widget.fileKind,fileNotes:widget.fileNotes,...(widget.clockPluginEnabled?{remaining}:{}),clockPluginEnabled:widget.clockPluginEnabled});
  if(widget.folderKey||widget.folderName)return widgetPreset({id,type:'files',name,folderSourceId:widget.folderKey||widget.id,folderName:widget.folderName||'Selected folder',fileNotes:widget.fileNotes,...(widget.clockPluginEnabled?{remaining}:{}),clockPluginEnabled:widget.clockPluginEnabled});
  throw new Error('Choose a folder or file before saving this Files widget.');
 }
 if(widget.type==='apps'){
  if(!widget.appKey||!widget.appName)throw new Error('Choose an application shortcut before saving this Apps widget.');
   return widgetPreset({id,type:'apps',name,appSourceId:widget.appKey,appName:widget.appName,iconData:widget.appIconData,...(widget.clockPluginEnabled?{remaining}:{}),clockPluginEnabled:widget.clockPluginEnabled});
 }
 if(widget.type==='group')throw new Error('Groups are already saved in the widget tray.');
 return widgetPreset({id,type:widget.type,name,
  ...(widget.clockPluginEnabled?{clockPluginEnabled:true}:{}),
  ...(widget.type==='notes'||widget.type==='ai'?{text:widget.text}:{}),
  ...(widget.type==='notes'?{noteFont:widget.noteFont,noteFontSize:widget.noteFontSize,noteDocuments:widget.noteDocuments,activeNoteDocumentId:widget.activeNoteDocumentId}:{}),
  ...(widget.type==='focus'||widget.clockPluginEnabled?{remaining}:{}),
  ...(widget.type==='timetable'?{schedule:widget.schedule}:{}),
  ...(widget.type==='tagStatus'?{pluginControls:widget.pluginControls}:{})});
}
export function parsePresets(value:unknown):WidgetPreset[]{
 if(!Array.isArray(value))return [];const ids=new Set<string>();
 return value.slice(0,200).flatMap(v=>{try{const item=widgetPreset(v);if(ids.has(item.id))return [];ids.add(item.id);return[item]}catch{return []}});
}
