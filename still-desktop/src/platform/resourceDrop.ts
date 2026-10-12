import {invoke,isTauri} from '@tauri-apps/api/core';
import {listen,type UnlistenFn} from '@tauri-apps/api/event';
import {widgetPreset,type WidgetPreset,type FileKind} from '../domain/presets.ts';
import {programFile,openBrowserFile} from './files.ts';
export interface DroppedResource {sourceId:string|null;name:string;kind:'folder'|'pdf'|'document'|'website'|'app';extension:string;url?:string}
export interface ResourceDropEvent {phase:'enter'|'over'|'leave'|'drop';position?:{x:number;y:number};entries:DroppedResource[];errors:string[]}
const documents=new Map<string,File>();
export function previewDocument(sourceId:string):File|undefined{return documents.get(sourceId)}
export function previewFileDrop(files:File[]):{entries:DroppedResource[];errors:string[]}{
 const entries:DroppedResource[]=[],errors:string[]=[];
 for(const file of files.slice(0,100)){
  if(/\.(exe|lnk)$/i.test(file.name)){entries.push({sourceId:crypto.randomUUID(),name:file.name,kind:'app',extension:file.name.split('.').pop()!.toLowerCase()});continue}
  if(programFile(file.name)){errors.push(file.name+' cannot be saved as a document.');continue}
  const sourceId=crypto.randomUUID(),extension=file.name.split('.').pop()?.toLowerCase()??'';
  documents.set(sourceId,file);entries.push({sourceId,name:file.name,kind:extension==='pdf'?'pdf':'document',extension});
 }
 return{entries,errors};
}
function kind(entry:DroppedResource):FileKind {
 if(entry.kind==='pdf')return'pdf';
 if(/^(png|jpe?g|gif|webp|bmp|svg|tiff?)$/i.test(entry.extension))return'image';
 if(/^(mp4|webm|mkv|mov|mp3|wav|ogg|flac|m4a)$/i.test(entry.extension))return'media';
 return'document';
}
export function presetForDroppedResource(entry:DroppedResource):WidgetPreset {
 const id=crypto.randomUUID(),name=entry.name.slice(0,60);
 if(entry.kind==='app')return widgetPreset({id,type:'apps',name,appSourceId:entry.sourceId??'',appName:entry.name});
 if(entry.kind==='website')throw new Error('Website links can be saved inside a Group. Drop a link into a Group or add it from the Group editor.');
 if(entry.kind==='folder')return widgetPreset({id,type:'files',name,folderSourceId:entry.sourceId??'',folderName:entry.name});
 return widgetPreset({id,type:'files',name,resourceKind:'document',fileSourceId:entry.sourceId??'',fileName:entry.name,fileKind:kind(entry)});
}
export const resourceDrop={
 available:isTauri(),
 subscribe:(callback:(event:ResourceDropEvent)=>void):Promise<UnlistenFn>=>listen<ResourceDropEvent>('still-file-drop',event=>callback(event.payload)),
};
export const localDocuments={
 native:isTauri(),
 choose:()=>invoke<DroppedResource|null>('document_choose',{}),
 retain(sourceIds:ReadonlySet<string>):void{for(const id of documents.keys())if(!sourceIds.has(id))documents.delete(id)},
 async open(sourceId:string):Promise<void>{
  if(this.native)return invoke('document_open',{sourceId});
  const file=documents.get(sourceId);if(!file)throw new Error('Select this file again to reconnect it in the preview.');
  return openBrowserFile(file);
 },
};
export const localApps={
 native:isTauri(),choose:()=>invoke<DroppedResource|null>('app_choose',{}),
 open:(sourceId:string):Promise<void>=>isTauri()?invoke('app_open',{sourceId}):Promise.reject(new Error('App shortcuts launch from the Windows app. This is a web preview.')),
};
