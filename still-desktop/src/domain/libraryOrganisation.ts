import {programFile} from '../platform/files.ts';

export interface LibraryEntry {id:string;path:string;name:string;directory:boolean;size:number;revision:string}
export interface LibrarySnapshot {version:1;rootId:string;rootName:string;entries:LibraryEntry[];truncated:boolean}
export interface LibraryOperation {version:1;id:string;type:'create_folder'|'rename'|'move';entryId?:string;expectedRevision?:string;parentId?:string;name?:string;destinationFolderId?:string;reason:string}
export interface LibraryProposal {version:1;rootId:string;operations:LibraryOperation[]}
export interface LibraryReceipt {id:string;rootId:string;type:LibraryOperation['type'];sourcePath:string|null;destinationPath:string;entryId:string;revision:string;undoToken:string;affectedCount:number}
export interface LibraryUndoResult {sourcePath:string;destinationPath:string;removedFolder:boolean}
export interface LibraryReviewRow {operation:LibraryOperation;sourcePath:string|null;destinationPath:string;descendants:string[]}
export type LibraryNativeOperation=Omit<LibraryOperation,'reason'>;
export const LIBRARY_OPERATION_LIMIT=20;
export function remapLibraryPath(path:string,source:string,destination:string){return path===source?destination:path.startsWith(source+'/')?destination+path.slice(source.length):path}
function validName(name:unknown):name is string {
 return typeof name==='string'&&!!name.trim()&&name.length<=100&&!/[<>:"/\\|?*\u0000-\u001f]/.test(name)&&!/[ .]$/.test(name)&&name!=='.'&&name!=='..'&&!/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(name);
}
function parent(path:string){return path.split('/').slice(0,-1).join('/')}
function extension(name:string){return name.includes('.')?name.slice(name.lastIndexOf('.')).toLowerCase():''}
const join=(folder:string,name:string)=>folder?folder+'/'+name:name;

/** Resolve proposals only against the explicit, bounded native snapshot. This performs no I/O. */
export function reviewLibraryProposal(snapshot:LibrarySnapshot,proposal:LibraryProposal):LibraryReviewRow[]{
 if(proposal.version!==1||snapshot.version!==1||proposal.rootId!==snapshot.rootId||!Array.isArray(proposal.operations)||!proposal.operations.length||proposal.operations.length>LIBRARY_OPERATION_LIMIT)throw new Error('Choose one assigned Library folder and request up to 20 operations.');
 const entries=new Map(snapshot.entries.map(entry=>[entry.id,{...entry}]));
 entries.set(snapshot.rootId,{id:snapshot.rootId,path:'',name:snapshot.rootName,directory:true,size:0,revision:''});
 const originalPaths=proposal.operations.filter(operation=>operation.type!=='create_folder').map(operation=>entries.get(operation.entryId??'')?.path).filter((path):path is string=>!!path);
 for(let a=0;a<originalPaths.length;a++)for(let b=a+1;b<originalPaths.length;b++)if(originalPaths[a]===originalPaths[b]||originalPaths[a].startsWith(originalPaths[b]+'/')||originalPaths[b].startsWith(originalPaths[a]+'/'))throw new Error('Split overlapping folder/file changes into separate reviewed batches.');
 const ids=new Set<string>(),rows:LibraryReviewRow[]=[];
 for(const operation of proposal.operations){
  if(operation.version!==1||!operation.id||ids.has(operation.id)||entries.has(operation.id)||!operation.reason?.trim())throw new Error('Invalid or duplicate Library operation.');
  ids.add(operation.id);
  let source:LibraryEntry|undefined,destination:string;
  if(operation.type==='create_folder'){
   const folder=entries.get(operation.parentId??'');
   if(!folder?.directory||!validName(operation.name))throw new Error('Choose a valid destination folder and safe folder name.');
   destination=join(folder.path,operation.name);
  }else if(operation.type==='rename'||operation.type==='move'){
   source=entries.get(operation.entryId??'');
   if(!source||source.id===snapshot.rootId||source.revision!==operation.expectedRevision)throw new Error('The source changed. Refresh the folder and request a new proposal.');
   if(!source.directory&&programFile(source.name))throw new Error('Programs and shortcuts cannot be organised by AI.');
   if(source.directory&&snapshot.truncated)throw new Error('This folder snapshot is incomplete. Folder moves/renames are blocked until all affected files can be reviewed.');
   if(operation.type==='rename'){
    if(!validName(operation.name)||!source.directory&&extension(operation.name)!==extension(source.name))throw new Error('Rename must preserve the file extension and use a safe name.');
    destination=join(parent(source.path),operation.name);
   }else{
    const folder=entries.get(operation.destinationFolderId??'');
    if(!folder?.directory)throw new Error('The destination folder is missing or depends on an unselected create-folder operation.');
    if(folder.id===source.id||folder.path.startsWith(source.path+'/'))throw new Error('A folder cannot be moved into itself.');
    destination=join(folder.path,source.name);
   }
   if(destination.toLowerCase()===source.path.toLowerCase())throw new Error('No-op and case-only renames/moves are not supported.');
  }else throw new Error('Unsupported Library operation.');
  if(destination.length>1000||destination.split('/').length>24)throw new Error('The destination exceeds Library path limits.');
  if([...entries.values()].some(entry=>entry.id!==source?.id&&entry.path.toLowerCase()===destination.toLowerCase()))throw new Error('The destination already exists. Still never overwrites or merges files.');
  const descendants=source?.directory?snapshot.entries.filter(entry=>entry.path.startsWith(source!.path+'/')).map(entry=>entry.path):[];
  rows.push({operation,sourcePath:source?.path??null,destinationPath:destination,descendants});
  if(source){const old=source.path;for(const entry of entries.values())entry.path=remapLibraryPath(entry.path,old,destination);source.name=destination.split('/').at(-1)!}
  else entries.set(operation.id,{id:operation.id,path:destination,name:operation.name!,directory:true,size:0,revision:''});
 }
 return rows;
}

/** Stop on first failure; completed receipts are never hidden or reported as rolled back. */
export async function executeLibraryProposal(snapshot:LibrarySnapshot,proposal:LibraryProposal,apply:(operation:LibraryNativeOperation)=>Promise<LibraryReceipt>,record:(receipt:LibraryReceipt)=>Promise<void>){
 const rows=reviewLibraryProposal(snapshot,proposal),resolved=new Map<string,string>(),receipts:LibraryReceipt[]=[];
 for(const row of rows){
  const {reason:_,...operation}=row.operation;
  const nativeOperation={...operation,id:crypto.randomUUID(),...(operation.parentId?{parentId:resolved.get(operation.parentId)??operation.parentId}:{}),...(operation.destinationFolderId?{destinationFolderId:resolved.get(operation.destinationFolderId)??operation.destinationFolderId}:{})};
  try{
   const receipt=await apply(nativeOperation);
   // Include confirmed native output before UI refresh; a later refresh failure must not hide a completed mutation.
   receipts.push(receipt);
   if(receipt.rootId!==snapshot.rootId||receipt.sourcePath!==row.sourcePath||receipt.destinationPath!==row.destinationPath)throw new Error('Native result differs from the reviewed operation. Stop and inspect the Library before continuing.');
   if(operation.type==='create_folder')resolved.set(operation.id,receipt.entryId);
   await record(receipt);
  }catch(reason){return{receipts,error:reason instanceof Error?reason.message:String(reason),remaining:rows.length-receipts.length}}
 }
 return{receipts,error:'',remaining:0};
}
