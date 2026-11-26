import { invoke, isTauri } from '@tauri-apps/api/core';
export interface FileEntry { name:string; path:string; directory:boolean; size:number; blocked:boolean }
export interface FolderListing { rootName:string; location:string; entries:FileEntry[]; truncated:boolean }
export interface NativeFilePreview {mimeType:string;base64:string}
export interface StillInbox {listing:FolderListing;path:string}
export interface FileMoveResult {sourcePath:string;destinationPath:string}
export interface ManagedFileResult {action:'rename'|'move'|'delete'|'editText';sourcePath:string;destinationPath:string}
export type ManagedFileAction={type:'rename';name:string}|{type:'move';destinationFolder:string}|{type:'delete'}|{type:'editText';text:string;expectedText:string};
export interface ExtractedPdfText {text:string;pagesRead:number;totalPages:number;truncated:boolean}
export interface LibrarySearchHit {widgetId:string;entry:FileEntry}
export interface LibrarySearchResponse {results:LibrarySearchHit[];unavailableWidgetIds:string[];truncated:boolean}
/** Bound total work across ten native 40-folder requests or one browser scan. */
export const MAX_LIBRARY_SEARCH_ROOTS=400;
export const MAX_LIBRARY_SEARCH_RESULTS=500;
const MAX_BROWSER_LIBRARY_SEARCH_ENTRIES=10_000;
const selected=new Map<string,{rootName:string; files:Map<string,File>}>();
async function searchNativeLibrary(ids:string[],query:string):Promise<LibrarySearchResponse>{
 const unique=[...new Set(ids)],roots=unique.slice(0,MAX_LIBRARY_SEARCH_ROOTS),unavailable=new Set<string>(),results:LibrarySearchHit[]=[];
 let truncated=unique.length>roots.length;
 for(let offset=0;offset<roots.length;offset+=40){
  const response=await invoke<LibrarySearchResponse>('files_library_search',{ids:roots.slice(offset,offset+40),query});
  for(const id of response.unavailableWidgetIds)unavailable.add(id);
  const room=MAX_LIBRARY_SEARCH_RESULTS-results.length,accepted=response.results.slice(0,room);
  results.push(...accepted);
  const capped=response.results.length>accepted.length,hasLaterBatch=offset+40<roots.length;
  if(response.truncated||capped){truncated=true;break}
  if(results.length>=MAX_LIBRARY_SEARCH_RESULTS){if(hasLaterBatch)truncated=true;break}
 }
 results.sort((a,b)=>a.entry.path.toLocaleLowerCase().localeCompare(b.entry.path.toLocaleLowerCase())||a.widgetId.localeCompare(b.widgetId));
 return{results,unavailableWidgetIds:[...unavailable],truncated};
}
export function programFile(name:string):boolean { return /\.(exe|com|bat|cmd|msi|ps1|psm1|vbs|vbe|js|jse|wsf|wsh|scr|lnk|url|reg|hta|sh|app|desktop)$/i.test(name) }
export async function openBrowserFile(file:File):Promise<void>{
 if(programFile(file.name))throw new Error('Choose a document, image or media file to open.');
 const extension=file.name.split('.').pop()?.toLowerCase()??'';
 const types:Record<string,string>={pdf:'application/pdf',txt:'text/plain',md:'text/plain',csv:'text/plain',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp',mp4:'video/mp4',webm:'video/webm',mp3:'audio/mpeg',wav:'audio/wav'};
 const url=URL.createObjectURL(new Blob([file],{type:types[extension]||'application/octet-stream'}));
 if(types[extension])window.open(url,'_blank','noopener,noreferrer');
 else{const link=document.createElement('a');link.href=url;link.download=file.name;link.click()}
 setTimeout(()=>URL.revokeObjectURL(url),300000);
}
export function folderEntries(items:Iterable<{path:string;size:number}>,location:string):FileEntry[]{
  const entries=new Map<string,FileEntry>(),prefix=location?location+'/':'';
  for(const file of items){if(!file.path.startsWith(prefix))continue;const rest=file.path.slice(prefix.length);const parts=rest.split('/');const name=parts[0];if(!name)continue;const directory=parts.length>1;entries.set(name,{name,path:prefix+name,directory,size:directory?0:file.size,blocked:!directory&&programFile(name)})}
  return [...entries.values()].sort((a,b)=>Number(b.directory)-Number(a.directory)||a.name.localeCompare(b.name));
}
export const localFiles={
  native:isTauri(),
  choose:(id:string)=>invoke<FolderListing|null>('files_choose',{id}),
  async inbox(id:string):Promise<StillInbox>{if(!this.native)throw new Error('The Downloads Inbox is available in the Still desktop app. In browser preview, manage saved PDF shortcuts and links from Library.');return invoke<StillInbox>('files_still_inbox',{id})},
  select(id:string,files:File[]):FolderListing{
    if(!files.length)throw new Error('This folder contains no selectable files.');
    const first=files[0].webkitRelativePath||files[0].name;const rootName=first.includes('/')?first.split('/')[0]:'Selected files';
    const map=new Map(files.map(f=>{const path=f.webkitRelativePath||f.name;return [path.includes('/')?path.slice(path.indexOf('/')+1):path,f] as const}));
    selected.set(id,{rootName,files:map});return this.browserList(id,'');
  },
  release(id:string):void{selected.delete(id)},
  browserList(id:string,location:string):FolderListing{
    const folder=selected.get(id);if(!folder)throw new Error('Choose a folder to get started.');
    return {rootName:folder.rootName,location,entries:folderEntries([...folder.files].map(([path,file])=>({path,size:file.size})),location),truncated:false};
  },
  async list(id:string,location:string):Promise<FolderListing>{return this.native?invoke('files_list',{id,location}):this.browserList(id,location)},
  async searchLibrary(ids:string[],query:string):Promise<LibrarySearchResponse>{
    if(this.native)return searchNativeLibrary(ids,query);
    const results:LibrarySearchHit[]=[],unavailableWidgetIds:string[]=[],term=query.trim().toLowerCase(),unique=[...new Set(ids)],rootOverflow=unique.length>MAX_LIBRARY_SEARCH_ROOTS;let scanTruncated=false,scanned=0;
    for(const id of unique.slice(0,MAX_LIBRARY_SEARCH_ROOTS)){const folder=selected.get(id);if(!folder){unavailableWidgetIds.push(id);continue}for(const [path,file] of folder.files){if(scanned>=MAX_BROWSER_LIBRARY_SEARCH_ENTRIES||results.length>=MAX_LIBRARY_SEARCH_RESULTS){scanTruncated=true;break}scanned++;if(file.name.toLowerCase().includes(term))results.push({widgetId:id,entry:{name:file.name,path,directory:false,size:file.size,blocked:programFile(file.name)}})}if(scanTruncated)break}
    return{results,unavailableWidgetIds,truncated:rootOverflow||scanTruncated};
  },
  async search(id:string,query:string):Promise<FileEntry[]>{
    if(this.native)return invoke<FileEntry[]>('files_search',{id,query});
    const selectedFolder=selected.get(id);if(!selectedFolder)throw new Error('Choose a folder to search.');
    const term=query.toLowerCase();return [...selectedFolder.files].filter(([path,file])=>path.toLowerCase().includes(term)).slice(0,500).map(([path,file])=>({name:file.name,path,directory:false,size:file.size,blocked:programFile(file.name)}));
  },
  async reuse(id:string,sourceId:string):Promise<FolderListing>{
    if(this.native)return invoke('files_reuse',{id,sourceId});
    if(!selected.has(id)){const source=selected.get(sourceId);if(!source)throw new Error('Choose the saved folder again to reconnect it.');selected.set(id,{rootName:source.rootName,files:new Map(source.files)})}
    return this.browserList(id,'');
  },
  async open(id:string,path:string):Promise<void>{
    if(this.native)return invoke('files_open',{id,path});
    const file=selected.get(id)?.files.get(path);if(!file)throw new Error('Select the folder again to open this file.');
    return openBrowserFile(file);
  },
  async preview(id:string,path:string):Promise<Blob>{
    if(this.native){const result=await invoke<NativeFilePreview>('files_preview',{id,path});return previewBlob(result)}
    const file=selected.get(id)?.files.get(path);if(!file)throw new Error('Select the folder again to preview this file.');
    if(programFile(file.name))throw new Error('Programs and shortcuts cannot be previewed.');
    if(file.size>20*1024*1024)throw new Error('This file is larger than the 20 MB preview limit. Open it in your default app instead.');
    return file.slice(0,file.size,file.type||mimeFor(file.name));
  },
  async extractPdfText(id:string,path:string):Promise<ExtractedPdfText>{
    if(!this.native)throw new Error('PDF text extraction is available in the Still desktop app.');
    return invoke<ExtractedPdfText>('files_extract_pdf_text',{id,path});
  },
  async moveResource(id:string,sourcePath:string,destinationFolder:string):Promise<FileMoveResult>{
    if(!this.native)throw new Error('Filing resources is available in the Still desktop app.');
    return invoke<FileMoveResult>('files_move_resource',{id,sourcePath,destinationFolder});
  },
  async manageResource(id:string,sourcePath:string,action:ManagedFileAction):Promise<ManagedFileResult>{
    if(!this.native)throw new Error('Changing files on disk is available in the Still desktop app.');
    return invoke<ManagedFileResult>('files_manage_resource',{id,sourcePath,action});
  },
};

export function mimeFor(name:string):string{
 const extension=name.split('.').pop()?.toLowerCase()??'';
 return ({pdf:'application/pdf',txt:'text/plain',md:'text/plain',csv:'text/plain',log:'text/plain',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp',bmp:'image/bmp',mp4:'video/mp4',m4v:'video/mp4',webm:'video/webm',mp3:'audio/mpeg',wav:'audio/wav',ogg:'audio/ogg'} as Record<string,string>)[extension]??'application/octet-stream';
}
function previewBlob(value:NativeFilePreview):Blob{
 const binary=atob(value.base64),bytes=new Uint8Array(binary.length);
 for(let index=0;index<binary.length;index++)bytes[index]=binary.charCodeAt(index);
 return new Blob([bytes],{type:value.mimeType});
}
