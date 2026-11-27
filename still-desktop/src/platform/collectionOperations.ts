import {applyCollectionAction,type CollectionOperationContext,type CollectionOperationRequest,type CollectionOperationResult} from '../domain/collectionOperations.ts';
import type {WorkspaceState} from '../domain/workspaces.ts';
import {localFiles} from './files.ts';
import {remapLibraryPath} from '../domain/libraryOrganisation.ts';
import {checkedFileNotes} from '../domain/fileNotes.ts';
import {forgetRecentLibraryFiles,remapRecentLibraryFiles} from '../domain/libraryRecents.ts';

export interface CollectionOperationHost {getState:()=>WorkspaceState;commitState:(state:WorkspaceState)=>void|Promise<void>}
const JOURNAL_KEY='still-collection-operation-receipts-v1';
type JournalEntry={key:string;result:CollectionOperationResult;state:'running'|'complete'};
let host:CollectionOperationHost|null=null;
/** The app shell binds its current state and commit function once; all callers use the same dispatcher. */
export function configureCollectionOperationHost(value:CollectionOperationHost):void{host=value}
function readJournal():JournalEntry[]{const parsed=JSON.parse(localStorage.getItem(JOURNAL_KEY)||'[]');if(!Array.isArray(parsed)||parsed.some(item=>!item||typeof item.key!=='string'||!item.result||item.state!=='running'&&item.state!=='complete'))throw new Error('The collection operation journal is invalid.');return parsed as JournalEntry[]}
function writeJournal(value:JournalEntry[]):void{if(value.length>5000)throw new Error('The collection operation journal is full. Export or clear old receipts before continuing.');localStorage.setItem(JOURNAL_KEY,JSON.stringify(value))}

/** Apply one typed collection action with durable idempotency for retries. */
export async function executeCollectionOperation(action:CollectionOperationRequest,context:CollectionOperationContext):Promise<CollectionOperationResult>{
 const key=context.idempotencyKey?.trim()||`${context.source}:${crypto.randomUUID()}`;
 if(!key||key.length>500||/[\u0000-\u001f\u007f]/.test(key))return{status:'failed',changed:false,summary:'The operation idempotency key is invalid.'};
 let journal:JournalEntry[];try{journal=readJournal()}catch{return{status:'failed',changed:false,summary:'The collection operation journal is unavailable.'}}
 const prior=journal.find(item=>item.key===key);
 if(prior?.state==='complete')return prior.result;
 if(prior?.state==='running')return{status:'outcome_unknown',changed:false,summary:'This operation may already have started. Check the Library before retrying.',receiptId:key};
 const started:CollectionOperationResult={status:'outcome_unknown',changed:false,summary:'The operation outcome is being checked.',receiptId:key};
 try{writeJournal([...journal,{key,state:'running',result:started}])}catch{return{status:'failed',changed:false,summary:'Still could not save the operation receipt. Nothing was changed.'}}
 let result:CollectionOperationResult,physicalChanged=false;
 try{
  if(!host)throw new Error('The Library operation service is not connected to the workspace state.');
  if(action.type==='file.rename'||action.type==='file.move'||action.type==='file.delete'||action.type==='file.editText'||action.type==='file.createText'){
   const sourceWidget=host.getState().workspaces.flatMap(workspace=>workspace.widgets).find(widget=>widget.id===action.widgetId&&widget.type==='files');
   if(!sourceWidget)throw new Error('The source Files widget is no longer available. Reopen the Library and choose its current card.');
   const sourcePath=action.path,managed=action.type==='file.rename'?{type:'rename' as const,name:action.name}:action.type==='file.move'?{type:'move' as const,destinationFolder:action.destinationFolder}:action.type==='file.delete'?{type:'delete' as const}:action.type==='file.createText'?{type:'createText' as const,text:action.text}:{type:'editText' as const,text:action.text,expectedText:action.expectedText};
   const receipt=await localFiles.manageResource(action.widgetId,sourcePath,managed);
   if(action.type==='file.createText'&&receipt.action==='createText'&&receipt.sourcePath===sourcePath)physicalChanged=true;
   if(receipt.action!==managed.type||receipt.sourcePath!==sourcePath||action.type==='file.createText'&&receipt.destinationPath!==sourcePath)throw new Error('The Library result did not match the requested operation. Check the folder before retrying.');
   physicalChanged=true;
   if(action.type!=='file.editText'&&action.type!=='file.createText'){
    const destinationPath=action.type==='file.delete'?'':receipt.destinationPath;
    const state=host.getState(),workspaces=state.workspaces.map(workspace=>({...workspace,widgets:workspace.widgets.map(widget=>{
     if(widget.id!==action.widgetId||widget.type!=='files')return widget;
     const notes:Record<string,string>={};for(const [path,text] of Object.entries(widget.fileNotes)){if(action.type==='file.delete'&&(path===sourcePath||path.startsWith(sourcePath+'/')))continue;notes[remapLibraryPath(path,sourcePath,destinationPath)]=text}
     const reading:NonNullable<typeof widget.fileReadingStatus>={};for(const [key,value] of Object.entries(widget.fileReadingStatus??{})){const marker='/';const split=key.indexOf(marker),path=split>=0?key.slice(split+1):key;if(action.type==='file.delete'&&(path===sourcePath||path.startsWith(sourcePath+'/')))continue;reading[split>=0?key.slice(0,split+1)+remapLibraryPath(path,sourcePath,destinationPath):remapLibraryPath(path,sourcePath,destinationPath)]=value}
     return{...widget,fileNotes:checkedFileNotes(notes),fileReadingStatus:reading};
    })}));await host.commitState({...state,workspaces});
   if(action.type==='file.delete')forgetRecentLibraryFiles(new Set([action.widgetId]),sourcePath);else remapRecentLibraryFiles(new Set([action.widgetId]),sourcePath,destinationPath);
   window.dispatchEvent(new CustomEvent('still-files-resource-moved',{detail:{widgetId:action.widgetId,sourcePath,destinationPath,removedFolder:action.type==='file.delete'}}));
   }
   const summary=action.type==='file.delete'?`Deleted ${sourcePath} from the connected folder.`:action.type==='file.editText'?`Saved changes to ${sourcePath}.`:action.type==='file.createText'?`Created ${receipt.destinationPath} in the connected folder.`:action.type==='file.rename'?`Renamed ${sourcePath} to ${receipt.destinationPath}.`:`Moved ${sourcePath} to ${receipt.destinationPath}.`;
   result={status:'succeeded',changed:true,summary,receiptId:key};
   try{writeJournal([...readJournal().filter(item=>item.key!==key),{key,state:'complete',result}])}catch{return{status:'outcome_unknown',changed:true,summary:'The file operation completed, but Still could not save its receipt. Check the Library before retrying.',receiptId:key}}
   return result;
  }
  const applied=applyCollectionAction(host.getState(),action);
  if(applied.changed)await host.commitState(applied.state);
  result={status:'succeeded',changed:applied.changed,summary:applied.summary,receiptId:key,resource:applied.resource};
 }catch(error){result={status:'failed',changed:physicalChanged,summary:physicalChanged?'The disk change completed, but Still could not save all workspace references. Check the Library before retrying.':error instanceof Error?error.message:String(error),receiptId:key}}
 try{writeJournal([...readJournal().filter(item=>item.key!==key),{key,state:'complete',result}])}catch{
  // The durable "running" marker blocks retries after an uncertain result.
  return{status:'outcome_unknown',changed:result.changed,summary:'The change may have completed, but Still could not save its receipt. Check the Library before retrying.',receiptId:key};
 }
 return result;
}
