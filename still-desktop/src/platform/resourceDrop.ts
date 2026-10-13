import {invoke,isTauri} from '@tauri-apps/api/core';
import {listen,type UnlistenFn} from '@tauri-apps/api/event';
import {widgetPreset,type WidgetPreset,type FileKind} from '../domain/presets.ts';
import {programFile,openBrowserFile,mimeFor} from './files.ts';
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
 choose:(sourceId?:string)=>invoke<DroppedResource|null>('document_choose',{sourceId:sourceId??null}),
 retain(sourceIds:ReadonlySet<string>):void{for(const id of documents.keys())if(!sourceIds.has(id))documents.delete(id)},
 async open(sourceId:string):Promise<void>{
  if(this.native)return invoke('document_open',{sourceId});
  const file=documents.get(sourceId);if(!file)throw new Error('Select this file again to reconnect it in the preview.');
  return openBrowserFile(file);
 },
 async preview(sourceId:string):Promise<Blob>{
  if(this.native){const result=await invoke<{mimeType:string;base64:string}>('document_preview',{sourceId});const binary=atob(result.base64),bytes=new Uint8Array(binary.length);for(let index=0;index<binary.length;index++)bytes[index]=binary.charCodeAt(index);return new Blob([bytes],{type:result.mimeType})}
  const file=documents.get(sourceId);if(!file)throw new Error('Select this file again to reconnect it in the preview.');
  if(programFile(file.name))throw new Error('Programs and shortcuts cannot be previewed.');
  if(file.size>20*1024*1024)throw new Error('This file is larger than the 20 MB preview limit. Open it in your default app instead.');
  const type=mimeFor(file.name);if(type==='application/octet-stream')throw new Error('Preview supports PDF, text, common image and audio/video files.');
  const blob=file.slice(0,file.size,type);if(type==='text/plain')try{await blob.text()}catch{throw new Error('This text file cannot be previewed.')};return blob;
 },
};
export const localApps={
 native:isTauri(),choose:()=>invoke<DroppedResource|null>('app_choose',{}),
 open:(sourceId:string):Promise<void>=>isTauri()?invoke('app_open',{sourceId}):Promise.reject(new Error('App shortcuts launch from the Windows app. This is a web preview.')),
};
