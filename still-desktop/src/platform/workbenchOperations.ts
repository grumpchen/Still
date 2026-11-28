import type {AutomationAction,AutomationOperationContext,AutomationOperationResult,AutomationOperationService,AutomationStorage,RuleCatalog} from '../domain/automationRules.ts';
import {parseWorkbenchActions,validateWorkbenchActionBatch,type LinkOrigin,type NoteIdentity,type WorkbenchAction} from '../domain/workbenchActions.ts';
import type {CollectionOperationRequest,CollectionOperationResult} from '../domain/collectionOperations.ts';
import type {CaptureInboxEvent} from '../domain/captureInbox.ts';
import type {GlobalWorkspaceLayout,WorkspaceState} from '../domain/workspaces.ts';
import {allSavedNotes,editSavedNote,noteHistoryIdentity,noteRevision} from '../domain/noteHistory.ts';
import {NOTE_DOCUMENT_TEXT_LIMIT,NOTE_DOCUMENT_TOTAL_LIMIT} from '../domain/noteDocuments.ts';
import {executeCollectionOperation as sharedCollectionOperation} from './collectionOperations.ts';
import {localFiles,type LibrarySearchResponse} from './files.ts';
import {notesLibrary} from './notesLibrary.ts';

export type WorkbenchCaptureEvent=CaptureInboxEvent;
export type WorkbenchLayoutHandlers={
 save:(name:string,sourceWorkspaceId:string)=>string|Promise<string>;
 apply:(layoutId:string,targetWorkspaceId:string,mode:'append'|'replace')=>string|Promise<string>;prepare?:(layoutId:string,targetWorkspaceId:string,mode:'append'|'replace')=>string|Promise<string>;
 rename:(layoutId:string,name:string)=>string|Promise<string>;
 duplicate:(layoutId:string)=>string|Promise<string>;
 delete:(layoutId:string)=>string|Promise<string>;
};
export type WorkbenchReceipt={operation:WorkbenchAction['operation'];status:'succeeded'|'failed'|'needs_clarification'|'outcome_unknown';summary:string;receiptId?:string;data?:unknown;changed?:boolean};
export interface WorkbenchSnapshot {workspaces:Array<{id:string;name:string;role:string;files:Array<{widgetId:string;name:string;kind:'folder'|'document';connected:boolean}>;links:Array<{id:string;name:string;url:string;origin:LinkOrigin}>}>;layouts:Array<{id:string;name:string;createdAt:number;widgetCount:number;groupCount:number}>}
export interface WorkbenchServiceOptions {
 getState:()=>WorkspaceState;commitState:(state:WorkspaceState)=>void|Promise<void>;getLayouts?:()=>GlobalWorkspaceLayout[];layoutHandlers:WorkbenchLayoutHandlers;
 collection?:(action:CollectionOperationRequest,context:{source:'assistant'|'automation';idempotencyKey?:string})=>Promise<CollectionOperationResult>;
 saveRule:(text:string)=>Promise<{kind:'rule';rule:unknown}|{kind:'clarification'|'unsupported'|'error';message:string}>;
 getCaptureEvent:(eventId:string)=>Promise<WorkbenchCaptureEvent|null|{ok:true;value:WorkbenchCaptureEvent|null}|{ok:false;message:string}>;getCourses?:()=>RuleCatalog['courses'];
 searchFiles?:(widgetIds:string[],query:string)=>Promise<LibrarySearchResponse>;
 deleteNote?:(identity:NoteIdentity,expectedRevision:string)=>void|string|Promise<void|string>;
 storage?:AutomationStorage;
}
const JOURNAL_KEY='still.workbench-automation-operations.v1',MAX_JOURNAL=5000;
type JournalEntry={key:string;signature:string;state:'running'|'complete';result:AutomationOperationResult};
function memoryStorage():AutomationStorage{return{getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)}};
function collectionRequest(action:Exclude<WorkbenchAction,{operation:`layout.${string}`}|{operation:'resource.find'|'note.find'|'note.rename'|'note.edit'|'note.delete'|'rule.save'}>):CollectionOperationRequest{
 switch(action.operation){
  case'link.create':return{type:'link.create',workspaceId:action.workspaceId,...(action.groupId?{groupId:action.groupId}:{}),name:action.name,url:action.url};
  case'link.rename':return{type:'link.rename',origin:action.origin,linkId:action.linkId,name:action.name};
  case'link.editUrl':return{type:'link.editUrl',origin:action.origin,linkId:action.linkId,url:action.url};
  case'link.move':return{type:'link.move',origin:action.origin,linkId:action.linkId,destinationWorkspaceId:action.destinationWorkspaceId,...(action.destinationGroupId?{destinationGroupId:action.destinationGroupId}:{})};
  case'link.delete':return{type:'link.delete',origin:action.origin,linkId:action.linkId};
  case'file.annotation':return{type:'file.annotation',widgetId:action.widgetId,path:action.path,text:action.text};
  case'file.moveReference':return{type:'file.moveReference',widgetId:action.widgetId,destinationWorkspaceId:action.destinationWorkspaceId};
  case'file.renameReference':return{type:'file.renameReference',widgetId:action.widgetId,name:action.name};
  case'file.deleteReference':return{type:'file.deleteReference',widgetId:action.widgetId};
  case'file.rename':return{type:'file.rename',widgetId:action.widgetId,path:action.path,name:action.name};
  case'file.move':return{type:'file.move',widgetId:action.widgetId,path:action.path,destinationFolder:action.destinationFolder};
  case'file.delete':return{type:'file.delete',widgetId:action.widgetId,path:action.path};
  case'file.editText':return{type:'file.editText',widgetId:action.widgetId,path:action.path,text:action.text,expectedText:action.expectedText};
  case'file.createText':return{type:'file.createText',widgetId:action.widgetId,path:action.path,text:action.text};
  case'note.quickCapture':return{type:'note.quickCapture',workspaceId:action.workspaceId,...(action.notesWidgetId?{notesWidgetId:action.notesWidgetId}:{}),title:action.title,text:action.text};
 }
}
function safeJournal(storage:AutomationStorage):JournalEntry[]|null{try{const raw=storage.getItem(JOURNAL_KEY);if(!raw)return[];const value:unknown=JSON.parse(raw);if(!Array.isArray(value)||value.some(item=>!item||typeof item.key!=='string'||typeof item.signature!=='string'||!['running','complete'].includes(item.state)||!item.result||!['succeeded','failed','needs_clarification','outcome_unknown'].includes(item.result.status)))return null;return value as JournalEntry[]}catch{return null}}
function writeJournal(storage:AutomationStorage,entries:JournalEntry[]):void{if(entries.length>MAX_JOURNAL)throw new Error('Automation operation history is full.');storage.setItem(JOURNAL_KEY,JSON.stringify(entries))}
function operationReceipt(result:CollectionOperationResult):AutomationOperationResult{
 if(result.status==='succeeded')return{status:'succeeded',receiptId:result.receiptId,message:result.summary,changed:result.changed};
 if(result.status==='needs_clarification')return{status:'needs_clarification',message:result.summary};
 if(result.status==='outcome_unknown')return{status:'outcome_unknown',message:result.summary};
 return{status:'failed',message:result.summary,retryable:false};
}
const activeAutomationByStorage=new WeakMap<object,Map<string,Promise<AutomationOperationResult>>>();
export function createWorkbenchService(options:WorkbenchServiceOptions){
 const storage=options.storage??memoryStorage(),collection=options.collection??sharedCollectionOperation,search=(ids:string[],query:string)=>options.searchFiles?options.searchFiles.call(localFiles,ids,query):localFiles.searchLibrary(ids,query);
 let activeAutomation=activeAutomationByStorage.get(storage as object);if(!activeAutomation){activeAutomation=new Map();activeAutomationByStorage.set(storage as object,activeAutomation)}
 const getLayouts=()=>options.getLayouts?.()??options.getState().globalLayouts;
 function snapshot():WorkbenchSnapshot{
  const state=options.getState();
  return{workspaces:state.workspaces.map(workspace=>({id:workspace.id,name:workspace.name,role:workspace.role,files:workspace.widgets.filter(widget=>widget.type==='files').map(widget=>({widgetId:widget.id,name:widget.fileName||widget.folderName||widget.title||'Files',kind:widget.fileKey?'document':'folder',connected:!!(widget.fileKey||widget.folderKey||widget.folderName)})),links:[...workspace.groups.flatMap(group=>group.shortcuts.map(link=>({id:link.id,name:link.name,url:link.url,origin:{kind:'group' as const,workspaceId:workspace.id,groupId:group.id}}))),...workspace.widgets.filter(widget=>widget.type==='browser'||widget.type==='group'&&!workspace.groups.some(group=>group.id===(widget.groupId??widget.id))).flatMap(widget=>widget.shortcuts.map(link=>({id:link.id,name:link.name,url:link.url,origin:{kind:'browser' as const,workspaceId:workspace.id,widgetId:widget.id}})))]})),layouts:getLayouts().map(layout=>({id:layout.id,name:layout.name,createdAt:layout.createdAt,widgetCount:layout.widgets.length,groupCount:layout.groups.length}))};
 }
 async function executeWorkbenchActions(raw:WorkbenchAction[]):Promise<WorkbenchReceipt[]>{
  const actions=parseWorkbenchActions(raw);validateWorkbenchActionBatch(actions);const receipts:WorkbenchReceipt[]=[];
  for(const action of actions){try{receipts.push(await executeOne(action))}catch(error){const readOnly=action.operation==='layout.list'||action.operation==='layout.find'||action.operation==='resource.find'||action.operation==='note.find';receipts.push({operation:action.operation,status:readOnly?'failed':'outcome_unknown',summary:error instanceof Error?error.message:String(error)})}}
  return receipts;
 }
 async function executeOne(action:WorkbenchAction):Promise<WorkbenchReceipt>{
  if(action.operation==='layout.list')return{operation:action.operation,status:'succeeded',summary:`Found ${getLayouts().length} saved layouts.`,data:getLayouts().map(({id,name,createdAt,widgets,groups})=>({id,name,createdAt,widgetCount:widgets.length,groupCount:groups.length}))};
  if(action.operation==='layout.find'){
   const term=action.query.toLocaleLowerCase(),found=getLayouts().filter(layout=>layout.name.toLocaleLowerCase().includes(term));return{operation:action.operation,status:'succeeded',summary:`Found ${found.length} matching layouts.`,data:found.map(({id,name,createdAt,widgets,groups})=>({id,name,createdAt,widgetCount:widgets.length,groupCount:groups.length}))};
  }
  if(action.operation==='resource.find'){
   const state=options.getState(),term=action.query.toLocaleLowerCase(),fileWidgets=state.workspaces.flatMap(workspace=>workspace.widgets.filter(widget=>widget.type==='files').map(widget=>({workspace,widget}))),folderIds=fileWidgets.filter(({widget})=>widget.type==='files'&&!widget.fileKey&&!!(widget.folderName||widget.folderKey)).map(({widget})=>widget.id);
   const result=folderIds.length?await search(folderIds,action.query):{results:[],unavailableWidgetIds:[],truncated:false},results:Array<Record<string,unknown>>=[...result.results.map(hit=>({kind:'file',widgetId:hit.widgetId,path:hit.entry.path,name:hit.entry.name,directory:hit.entry.directory,size:hit.entry.size,blocked:hit.entry.blocked,...(()=>{const owner=fileWidgets.find(item=>item.widget.id===hit.widgetId);return owner?{sourceWorkspaceId:owner.workspace.id,workspaceName:owner.workspace.name,widgetName:owner.widget.title||owner.widget.fileName||owner.widget.folderName||'Files'}:{}})()}))];
   for(const {workspace,widget} of fileWidgets)if(widget.type==='files'&&widget.fileKey&&widget.fileName?.toLocaleLowerCase().includes(term))results.push({kind:'file',widgetId:widget.id,resourceId:widget.fileKey,name:widget.fileName,path:widget.fileName,directory:false,size:0,blocked:false,sourceWorkspaceId:workspace.id,workspaceName:workspace.name,widgetName:widget.title||widget.fileName});
   for(const workspace of state.workspaces){for(const group of workspace.groups)for(const link of group.shortcuts)if(`${link.name} ${link.url}`.toLocaleLowerCase().includes(term))results.push({kind:'link',linkId:link.id,name:link.name,url:link.url,origin:{kind:'group',workspaceId:workspace.id,groupId:group.id},sourceWorkspaceId:workspace.id,workspaceName:workspace.name});for(const widget of workspace.widgets)if(widget.type==='browser'||widget.type==='group'&&!workspace.groups.some(group=>group.id===(widget.groupId??widget.id)))for(const link of widget.shortcuts)if(`${link.name} ${link.url}`.toLocaleLowerCase().includes(term))results.push({kind:'link',linkId:link.id,name:link.name,url:link.url,origin:{kind:'browser',workspaceId:workspace.id,widgetId:widget.id},sourceWorkspaceId:workspace.id,workspaceName:workspace.name})}
   const unavailable=result.unavailableWidgetIds.map(widgetId=>({widgetId,...(()=>{const owner=fileWidgets.find(item=>item.widget.id===widgetId);return owner?{sourceWorkspaceId:owner.workspace.id,workspaceName:owner.workspace.name,widgetName:owner.widget.title||owner.widget.folderName||'Files'}:{}})()}));
   return{operation:action.operation,status:'succeeded',summary:`Found ${results.length} resources${result.truncated?' before reaching the file search limit':''}.${unavailable.length?` ${unavailable.length} folder connection(s) were unavailable.`:''}`,data:{results,unavailable,truncated:result.truncated}};
  }
  if(action.operation==='note.find'){
   const state=options.getState(),term=action.query.toLocaleLowerCase(),matches=allSavedNotes(state).filter(entry=>[entry.document.title,entry.document.text,...(entry.document.tags??[])].join(' ').toLocaleLowerCase().includes(term)),results:Array<Record<string,unknown>>=[];
   for(const entry of matches.slice(0,12)){
    const open=!!entry.widgetId&&state.workspaces.some(workspace=>workspace.id===entry.workspaceId&&([...workspace.widgets,...workspace.groups.flatMap(group=>group.widgets.flatMap(item=>item.instance?[item.instance]:[]))].some(widget=>widget.id===entry.widgetId)));
    results.push({identity:noteHistoryIdentity(entry),revision:await noteRevision(entry.document),name:entry.document.title||'Untitled note',title:entry.document.title||'Untitled note',workspaceName:entry.workspaceName??'',snippet:entry.document.text.slice(0,240),tags:entry.document.tags??[],textLength:entry.document.text.length,closed:!open});
   }
   return{operation:action.operation,status:'succeeded',summary:'Found '+matches.length+' matching saved notes'+(matches.length>results.length?' (showing the first 12)':'')+'.',data:{results,total:matches.length,truncated:matches.length>results.length}};
  }
  if(action.operation==='note.rename'||action.operation==='note.edit'||action.operation==='note.delete'){
   const state=options.getState(),candidates=allSavedNotes(state).filter(entry=>entry.document.id===action.identity.documentId&&(!action.identity.workspaceId||entry.workspaceId===action.identity.workspaceId)&&(!action.identity.widgetId||entry.widgetId===action.identity.widgetId));
   if(candidates.length!==1)return{operation:action.operation,status:'needs_clarification',summary:candidates.length?'More than one saved note matches that ID. Use the exact workspace and Notes widget IDs returned by note.find.':'That saved note is no longer available.'};
   const entry=candidates[0],identity=noteHistoryIdentity(entry),currentRevision=await noteRevision(entry.document);
   if(currentRevision!==action.expectedRevision)return{operation:action.operation,status:'needs_clarification',summary:'That note changed after it was found. Run note.find again before changing it.'};
   if(action.operation==='note.rename'&&entry.document.sourcePath)return{operation:action.operation,status:'needs_clarification',summary:'This note title comes from its linked Markdown filename. Rename the file from its Files library.'};
   if(action.operation==='note.delete'){
    const message=entry.document.sourcePath?'Removed the note from Still. Its linked Markdown file was left unchanged.':'Deleted “'+(entry.document.title||'Untitled note')+'” from Notes.';
    const latest=options.getState(),current=allSavedNotes(latest).filter(item=>item.document.id===identity.documentId&&(!identity.workspaceId||item.workspaceId===identity.workspaceId)&&(!identity.widgetId||item.widgetId===identity.widgetId));
    if(current.length!==1||await noteRevision(current[0].document)!==action.expectedRevision)return{operation:action.operation,status:'needs_clarification',summary:'That note changed while the deletion was being prepared. Run note.find again.'};
    if(options.deleteNote)await options.deleteNote(identity,action.expectedRevision);else await options.commitState(editSavedNote(latest,identity,()=>null));
    return{operation:action.operation,status:'succeeded',summary:message,changed:true};
   }
   let nextText:string|undefined,linkedFileWritten=false;
   if(action.operation==='note.edit'){
    nextText=action.mode==='append'?(entry.document.text?entry.document.text+'\n\n'+action.text:action.text):action.text;
    if(nextText.length>NOTE_DOCUMENT_TEXT_LIMIT)return{operation:action.operation,status:'needs_clarification',summary:'The edited note would exceed the per-note text limit.'};
    const owner=state.workspaces.find(workspace=>workspace.id===entry.workspaceId),widget=entry.widgetId?owner?.widgets.find(item=>item.id===entry.widgetId)??owner?.groups.flatMap(group=>group.widgets.flatMap(item=>item.instance?[item.instance]:[])).find(item=>item.id===entry.widgetId):undefined;
    if(widget?.type==='notes'&&widget.noteDocuments.reduce((total,note)=>total+note.text.length,0)-entry.document.text.length+nextText.length>NOTE_DOCUMENT_TOTAL_LIMIT)return{operation:action.operation,status:'needs_clarification',summary:'The edited note would exceed this widget’s total Notes text limit.'};
    if(entry.document.sourcePath){if(!entry.widgetId)return{operation:action.operation,status:'needs_clarification',summary:'The linked Markdown source no longer has an owner widget. Reopen it from Notes Home before editing.'};await notesLibrary.write(entry.widgetId,entry.document.sourcePath,nextText,entry.document.text);linkedFileWritten=true}
   }
   const latest=options.getState(),current=allSavedNotes(latest).filter(item=>item.document.id===identity.documentId&&(!identity.workspaceId||item.workspaceId===identity.workspaceId)&&(!identity.widgetId||item.widgetId===identity.widgetId));
   if(current.length!==1||await noteRevision(current[0].document)!==action.expectedRevision){if(linkedFileWritten)throw new Error('The linked Markdown file was updated, but the Still note changed before its index could be saved. Refresh Notes Home before retrying.');return{operation:action.operation,status:'needs_clarification',summary:'That note changed while the edit was being prepared. Run note.find again.'}}
   const updated=editSavedNote(latest,identity,document=>action.operation==='note.rename'?{...document,title:action.title.trim().slice(0,60)}:{...document,text:nextText!});
   await options.commitState(updated);
   return{operation:action.operation,status:'succeeded',summary:action.operation==='note.rename'?'Renamed note to “'+action.title.trim()+'”.':'Updated the saved note.',changed:true};
  }
  if(action.operation.startsWith('layout.')){
   const state=options.getState();let message='';
   if(action.operation==='layout.save'){const source=action.sourceWorkspaceId??state.activeId;if(!state.workspaces.some(item=>item.id===source))return clarification(action,'The source workspace is no longer available.');message=await options.layoutHandlers.save(action.name,source)}
   else if(action.operation==='layout.apply'){if(!state.workspaces.some(item=>item.id===action.targetWorkspaceId)||!getLayouts().some(item=>item.id===action.layoutId))return clarification(action,'The layout or target workspace is no longer available.');message=await options.layoutHandlers.apply(action.layoutId,action.targetWorkspaceId,action.mode)}
   else if(action.operation==='layout.rename'){if(!getLayouts().some(item=>item.id===action.layoutId))return clarification(action,'The saved layout is no longer available.');message=await options.layoutHandlers.rename(action.layoutId,action.name)}else if(action.operation==='layout.duplicate'){if(!getLayouts().some(item=>item.id===action.layoutId))return clarification(action,'The saved layout is no longer available.');message=await options.layoutHandlers.duplicate(action.layoutId)}else if(action.operation==='layout.delete'){if(!getLayouts().some(item=>item.id===action.layoutId))return clarification(action,'The saved layout is no longer available.');message=await options.layoutHandlers.delete(action.layoutId)}
   return{operation:action.operation,status:'succeeded',summary:message,changed:true};
  }
  if(action.operation==='rule.save'){
   const result=await options.saveRule(action.text);return result.kind==='rule'?{operation:action.operation,status:'succeeded',summary:'Automation saved.',data:result.rule,changed:true}:result.kind==='clarification'?clarification(action,result.message):{operation:action.operation,status:'failed',summary:result.message};
  }
  const request=collectionRequest(action as Exclude<WorkbenchAction,{operation:`layout.${string}`}|{operation:'resource.find'|'note.find'|'note.rename'|'note.edit'|'note.delete'|'rule.save'}>);
  const result=await collection(request,{source:'assistant'});
  return{operation:action.operation,status:result.status==='failed'&&result.changed?'outcome_unknown':result.status,summary:result.summary,receiptId:result.receiptId,changed:result.changed,...(result.resource?{data:result.resource}:{})};
 }
 function clarification(action:WorkbenchAction,message:string):WorkbenchReceipt{return{operation:action.operation,status:'needs_clarification',summary:message}}
 async function executeAutomation(action:AutomationAction,context:AutomationOperationContext):Promise<AutomationOperationResult>{
  const key=context.idempotencyKey;const pending=activeAutomation!.get(key);if(pending)return pending;const work=executeAutomationOnce(action,context);activeAutomation!.set(key,work);try{return await work}finally{if(activeAutomation!.get(key)===work)activeAutomation!.delete(key)}
 }
 async function executeAutomationOnce(action:AutomationAction,context:AutomationOperationContext):Promise<AutomationOperationResult>{
  const journal=safeJournal(storage);if(!journal)return{status:'failed',message:'The automation operation journal is unavailable; no operation was started.'};
  const key=context.idempotencyKey;if(typeof key!=='string'||key.length===0||key.length>500)return{status:'failed',message:'Invalid automation idempotency key; no operation was started.'};
  const signature=JSON.stringify({action,captureEventId:context.captureEventId});const prior=journal.find(entry=>entry.key===key);if(prior&&prior.signature!==signature)return{status:'failed',message:'This idempotency key already belongs to a different automation action.'};if(prior?.state==='complete')return prior.result;if(prior?.state==='running')return{status:'outcome_unknown',message:'This automation operation may already have started. Check the workspace before retrying.'};
  const running:AutomationOperationResult={status:'outcome_unknown',message:'Automation operation is in progress.'};try{writeJournal(storage,[...journal,{key,signature,state:'running',result:running}])}catch{return{status:'failed',message:'Could not save an in-flight automation receipt; no operation was started.'}}
  let result:AutomationOperationResult;
  try{result=await performAutomation(action,context)}catch(error){result={status:'outcome_unknown',message:error instanceof Error?error.message:String(error)}}
  const latest=safeJournal(storage);if(!latest)return{status:'outcome_unknown',message:'The operation may have completed, but its durable receipt could not be read.'};
  try{writeJournal(storage,[...latest.filter(entry=>entry.key!==key),{key,signature,state:'complete',result}])}catch{return{status:'outcome_unknown',message:'The operation may have completed, but its durable receipt could not be saved.'}}
  return result;
 }
 async function performAutomation(action:AutomationAction,context:AutomationOperationContext):Promise<AutomationOperationResult>{
  if(action.kind==='prepareWorkspaceLayout'){
   const state=options.getState();if(!state.workspaces.some(workspace=>workspace.id===action.workspaceId)||!getLayouts().some(layout=>layout.id===action.layoutId))return{status:'needs_clarification',message:'The saved layout or target workspace no longer exists.'};
   const message=await (options.layoutHandlers.prepare??options.layoutHandlers.apply)(action.layoutId,action.workspaceId,action.mode);return{status:'succeeded',receiptId:context.idempotencyKey,message,changed:true};
  }
  if(!context.captureEventId)return{status:'needs_clarification',message:'The capture event is missing; no older resources were searched or moved.'};
  let lookup:Awaited<ReturnType<NonNullable<WorkbenchServiceOptions['getCaptureEvent']>>>;try{lookup=await options.getCaptureEvent(context.captureEventId)}catch{return{status:'needs_clarification',message:'The exact capture could not be checked; no resource was moved.'}}
  if(lookup&&typeof lookup==='object'&&'ok'in lookup){if(!lookup.ok)return{status:'needs_clarification',message:lookup.message};lookup=lookup.value}
  const event=lookup as WorkbenchCaptureEvent|null;if(!event||event.status!=='pending')return{status:'needs_clarification',message:'The exact captured resource is no longer pending.'};
  const capturedWorkspaceId=event.kind==='link'?event.origin.workspaceId:event.sourceWorkspaceId;
  if(event.kind==='idea'||!action.resourceKinds.includes(event.kind)||!event.name.toLocaleLowerCase().includes(action.queryPattern.toLocaleLowerCase())||(action.sourceWorkspaceId&&action.sourceWorkspaceId!==capturedWorkspaceId))return{status:'needs_clarification',message:'The exact capture no longer matches this rule; no resource was moved.'};
  const state=options.getState(),destination=state.workspaces.find(workspace=>workspace.id===action.workspaceId),course=options.getCourses?.().find(item=>item.id===action.courseId&&item.workspaceId===action.workspaceId);
  if(!destination||!course)return{status:'needs_clarification',message:'The destination course or workspace is no longer available.'};
  let request:CollectionOperationRequest;
  if(event.kind==='link'){
   if(!event.linkId||event.origin.kind==='legacy-unknown')return{status:'needs_clarification',message:'The exact captured link has no supported tagged source.'};
   const origin=event.origin,sourceWorkspaceId=origin.workspaceId;const sourceWorkspace=state.workspaces.find(workspace=>workspace.id===sourceWorkspaceId);const link=origin.kind==='group'?sourceWorkspace?.groups.find(group=>group.id===origin.groupId)?.shortcuts.find(item=>item.id===event.linkId):sourceWorkspace?.widgets.find(widget=>widget.id===origin.widgetId&&(widget.type==='browser'||widget.type==='group'&&!sourceWorkspace?.groups.some(group=>group.id===(widget.groupId??widget.id))))?.shortcuts.find(item=>item.id===event.linkId);
   if(!link||link.name!==event.name||(event.url!==undefined&&link.url!==event.url))return{status:'needs_clarification',message:'The captured link changed or no longer exists.'};
   request={type:'link.move',origin,linkId:event.linkId,destinationWorkspaceId:action.workspaceId};
  }else{
   if(!event.widgetId||!event.sourceWorkspaceId||!event.resourceId)return{status:'needs_clarification',message:'The captured file reference no longer has a complete source locator.'};
   const source=state.workspaces.find(workspace=>workspace.id===event.sourceWorkspaceId)?.widgets.find(widget=>widget.id===event.widgetId);
   if(!source||source.type!=='files'||!source.fileKey||source.fileName!==event.name||source.fileKey!==event.resourceId)return{status:'needs_clarification',message:'The captured item is not an available PDF file reference. Folder references are not moved by this rule.'};
   request={type:'file.moveReference',widgetId:source.id,destinationWorkspaceId:action.workspaceId};
  }
  const outcome=await collection(request,{source:'automation',idempotencyKey:context.idempotencyKey});return operationReceipt(outcome);
 }
 const automationService:AutomationOperationService={execute:executeAutomation};
 return{snapshot,executeWorkbenchActions,automationService};
}
