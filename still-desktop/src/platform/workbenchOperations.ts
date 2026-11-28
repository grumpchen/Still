import type {AutomationAction,AutomationOperationContext,AutomationOperationResult,AutomationOperationService,AutomationStorage,RuleCatalog} from '../domain/automationRules.ts';
import {parseWorkbenchActions,validateWorkbenchActionBatch,type LinkOrigin,type WorkbenchAction} from '../domain/workbenchActions.ts';
import type {CollectionOperationRequest,CollectionOperationResult} from '../domain/collectionOperations.ts';
import type {CaptureInboxEvent} from '../domain/captureInbox.ts';
import {createWidget,deleteSavedGroup,nextInstanceNumber,saveGroupName,type GlobalWorkspaceLayout,type WorkspaceState} from '../domain/workspaces.ts';
import {nextPlacement} from '../domain/layout.ts';
import {widgetCatalog} from '../domain/widgetCatalog.ts';
import type {AutomationRunSummary} from '../domain/automationRunner.ts';
import {executeCollectionOperation as sharedCollectionOperation} from './collectionOperations.ts';
import {localFiles,type LibrarySearchResponse} from './files.ts';

export type WorkbenchCaptureEvent=CaptureInboxEvent;
export type WorkbenchLayoutHandlers={
 save:(name:string,sourceWorkspaceId:string)=>string|Promise<string>;
 apply:(layoutId:string,targetWorkspaceId:string,mode:'append'|'replace')=>string|Promise<string>;prepare?:(layoutId:string,targetWorkspaceId:string,mode:'append'|'replace')=>string|Promise<string>;
 rename:(layoutId:string,name:string)=>string|Promise<string>;
 duplicate:(layoutId:string)=>string|Promise<string>;
 delete:(layoutId:string)=>string|Promise<string>;
};
export type WorkbenchReceipt={operation:WorkbenchAction['operation'];status:'succeeded'|'failed'|'needs_clarification'|'outcome_unknown';summary:string;receiptId?:string;data?:unknown;changed?:boolean};
export interface WorkbenchSnapshot {workspaces:Array<{id:string;name:string;role:string;files:Array<{widgetId:string;name:string;kind:'folder'|'document';connected:boolean}>;links:Array<{id:string;name:string;url:string;origin:LinkOrigin}>;groups?:Array<{id:string;name:string;shortcutCount:number;widgetCount:number}>;dashboardModules?:Array<{id:string;type:string;title:string;visible:boolean}>}>;layouts:Array<{id:string;name:string;createdAt:number;widgetCount:number;groupCount:number}>;automationRules?:Array<{id:string;enabled:boolean;sourceText:string;trigger:unknown;action:unknown;latestReceipt?:{status:string;updatedAt:string;message?:string}}>}
export interface WorkbenchRuleAdmin {list:()=>WorkbenchSnapshot['automationRules'];enable:(id:string,value:boolean)=>string;setLayoutMode:(id:string,mode:'append'|'replace')=>string;delete:(id:string)=>string;runDue:()=>Promise<AutomationRunSummary>}
export interface WorkbenchServiceOptions {
 getState:()=>WorkspaceState;commitState:(state:WorkspaceState)=>void|Promise<void>;getLayouts?:()=>GlobalWorkspaceLayout[];layoutHandlers:WorkbenchLayoutHandlers;
 collection?:(action:CollectionOperationRequest,context:{source:'assistant'|'automation';idempotencyKey?:string})=>Promise<CollectionOperationResult>;
 saveRule:(text:string)=>Promise<{kind:'rule';rule:unknown}|{kind:'clarification'|'unsupported'|'error';message:string}>;
 getCaptureEvent:(eventId:string)=>Promise<WorkbenchCaptureEvent|null|{ok:true;value:WorkbenchCaptureEvent|null}|{ok:false;message:string}>;getCourses?:()=>RuleCatalog['courses'];
 searchFiles?:(widgetIds:string[],query:string)=>Promise<LibrarySearchResponse>;
 ruleAdmin?:WorkbenchRuleAdmin;
 storage?:AutomationStorage;
}
const JOURNAL_KEY='still.workbench-automation-operations.v1',MAX_JOURNAL=5000;
type JournalEntry={key:string;signature:string;state:'running'|'complete';result:AutomationOperationResult};
function memoryStorage():AutomationStorage{return{getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)}};
function collectionRequest(action:Exclude<WorkbenchAction,{operation:`layout.${string}`}|{operation:`dashboard.${string}`}|{operation:`group.${string}`}|{operation:`rule.${string}`}|{operation:'resource.find'}>):CollectionOperationRequest{
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
 const dashboardWorkspace=()=>options.getState().workspaces.find(workspace=>workspace.role==='dashboard');
 const dashboardOrder=(workspace:NonNullable<ReturnType<typeof dashboardWorkspace>>)=>workspace.dashboardLayout?.order??workspace.widgets.filter(widget=>['calendar','focus','timetable','files'].includes(widget.type)).map(widget=>widget.id);
 function snapshot():WorkbenchSnapshot{
  const state=options.getState(),dashboard=state.workspaces.find(workspace=>workspace.role==='dashboard'),visibleDashboard=new Set(dashboard?dashboardOrder(dashboard):[]),rules=options.ruleAdmin?.list();
  return{workspaces:state.workspaces.map(workspace=>({id:workspace.id,name:workspace.name,role:workspace.role,files:workspace.widgets.filter(widget=>widget.type==='files').map(widget=>({widgetId:widget.id,name:widget.fileName||widget.folderName||widget.title||'Files',kind:widget.fileKey?'document':'folder',connected:!!(widget.fileKey||widget.folderKey||widget.folderName)})),links:[...workspace.groups.flatMap(group=>group.shortcuts.map(link=>({id:link.id,name:link.name,url:link.url,origin:{kind:'group' as const,workspaceId:workspace.id,groupId:group.id}}))),...workspace.widgets.filter(widget=>widget.type==='browser'||widget.type==='group'&&!workspace.groups.some(group=>group.id===(widget.groupId??widget.id))).flatMap(widget=>widget.shortcuts.map(link=>({id:link.id,name:link.name,url:link.url,origin:{kind:'browser' as const,workspaceId:workspace.id,widgetId:widget.id}})))],groups:workspace.groups.map(group=>({id:group.id,name:group.name,shortcutCount:group.shortcuts.length,widgetCount:group.widgets.length})),...(workspace.role==='dashboard'?{dashboardModules:workspace.widgets.map(widget=>({id:widget.id,type:widget.type,title:widget.title||widget.type,visible:visibleDashboard.has(widget.id)}))}:{})})),layouts:getLayouts().map(layout=>({id:layout.id,name:layout.name,createdAt:layout.createdAt,widgetCount:layout.widgets.length,groupCount:layout.groups.length})),...(rules?{automationRules:rules}:{})};
 }
 async function executeWorkbenchActions(raw:WorkbenchAction[]):Promise<WorkbenchReceipt[]>{
  const actions=parseWorkbenchActions(raw);validateWorkbenchActionBatch(actions);const receipts:WorkbenchReceipt[]=[];
  for(const action of actions){try{receipts.push(await executeOne(action))}catch(error){const readOnly=action.operation==='layout.list'||action.operation==='layout.find'||action.operation==='resource.find'||action.operation==='dashboard.list'||action.operation==='group.list'||action.operation==='rule.list';receipts.push({operation:action.operation,status:readOnly?'failed':'outcome_unknown',summary:error instanceof Error?error.message:String(error)})}}
  return receipts;
 }
 async function executeOne(action:WorkbenchAction):Promise<WorkbenchReceipt>{
  if(action.operation==='layout.list')return{operation:action.operation,status:'succeeded',summary:`Found ${getLayouts().length} saved layouts.`,data:getLayouts().map(({id,name,createdAt,widgets,groups})=>({id,name,createdAt,widgetCount:widgets.length,groupCount:groups.length}))};
  if(action.operation==='dashboard.list'){
   const dashboard=dashboardWorkspace();if(!dashboard)return clarification(action,'The Dashboard is not available.');const visible=new Set(dashboardOrder(dashboard));
   return{operation:action.operation,status:'succeeded',summary:`Found ${dashboard.widgets.filter(widget=>visible.has(widget.id)).length} visible Dashboard modules.`,data:dashboard.widgets.map(widget=>({id:widget.id,type:widget.type,title:widget.title||widget.type,visible:visible.has(widget.id)}))};
  }
  if(action.operation==='dashboard.module.add'||action.operation==='dashboard.module.remove'||action.operation==='dashboard.module.reorder'||action.operation==='dashboard.module.resize'){
   const dashboard=dashboardWorkspace();if(!dashboard)return clarification(action,'The Dashboard is not available.');
   if(action.operation==='dashboard.module.add'){
    const order=dashboardOrder(dashboard).filter(id=>dashboard.widgets.some(widget=>widget.id===id));const hidden=dashboard.widgets.find(widget=>widget.type===action.widgetType&&!order.includes(widget.id)),widget=hidden??createWidget(action.widgetType);if(!hidden){widget.instanceNumber=nextInstanceNumber(widget.type,dashboard.widgets);widget.placement=nextPlacement(widget.type,dashboard.widgets)}
    const nextOrder=[...order,widget.id],sizes={...(dashboard.dashboardLayout?.sizes??{}),[widget.id]:{width:widget.placement.width,height:widget.placement.height}},placements={...(dashboard.dashboardLayout?.placements??{}),[widget.id]:widget.placement};
    await options.commitState({...options.getState(),workspaces:options.getState().workspaces.map(owner=>owner.id===dashboard.id?{...owner,widgets:hidden?owner.widgets:[...owner.widgets,widget],dashboardLayout:{order:nextOrder,sizes,placements}}:owner)});
    return{operation:action.operation,status:'succeeded',summary:`Added ${widget.title||widget.type} to Dashboard.`,data:{widgetId:widget.id,type:widget.type},changed:true};
   }
   const order=dashboardOrder(dashboard).filter(id=>dashboard.widgets.some(widget=>widget.id===id)),sizes={...(dashboard.dashboardLayout?.sizes??{})},placements={...(dashboard.dashboardLayout?.placements??{})};
   if(action.operation==='dashboard.module.remove'){
    if(!dashboard.widgets.some(widget=>widget.id===action.widgetId)||!order.includes(action.widgetId))return clarification(action,'That module is not visible on the Dashboard.');
    await options.commitState({...options.getState(),workspaces:options.getState().workspaces.map(owner=>owner.id===dashboard.id?{...owner,dashboardLayout:{order:order.filter(id=>id!==action.widgetId),sizes,placements}}:owner)});
    return{operation:action.operation,status:'succeeded',summary:'Removed the module from Dashboard. Its saved widget data remains in the workspace.',changed:true};
   }
   const widget=dashboard.widgets.find(item=>item.id===action.widgetId);if(!widget||!order.includes(widget.id))return clarification(action,'That module is not visible on the Dashboard.');
   if(action.operation==='dashboard.module.reorder'){
    if(!order.includes(action.targetWidgetId))return clarification(action,'The target Dashboard module is no longer visible.');const next=order.filter(id=>id!==action.widgetId),target=next.indexOf(action.targetWidgetId);next.splice(target+(action.position==='after'?1:0),0,action.widgetId);
    await options.commitState({...options.getState(),workspaces:options.getState().workspaces.map(owner=>owner.id===dashboard.id?{...owner,dashboardLayout:{order:next,sizes,placements}}:owner)});
    return{operation:action.operation,status:'succeeded',summary:`Moved ${widget.title||widget.type} ${action.position} ${dashboard.widgets.find(item=>item.id===action.targetWidgetId)?.title||'the selected module'}.`,changed:true};
   }
   const bounds=widgetCatalog[widget.type];if(action.width<bounds.minWidth||action.height<bounds.minHeight)return clarification(action,`That module needs to be at least ${bounds.minWidth} × ${bounds.minHeight} pixels.`);
   const size={width:action.width,height:action.height},oldPlacement=placements[widget.id]??widget.placement; sizes[widget.id]=size;placements[widget.id]={...oldPlacement,...size};
   await options.commitState({...options.getState(),workspaces:options.getState().workspaces.map(owner=>owner.id===dashboard.id?{...owner,dashboardLayout:{order,sizes,placements}}:owner)});
   return{operation:action.operation,status:'succeeded',summary:`Resized ${widget.title||widget.type} to ${size.width} × ${size.height}.`,changed:true};
  }
  if(action.operation==='group.list'){
   const workspace=options.getState().workspaces.find(item=>item.id===action.workspaceId);return workspace?{operation:action.operation,status:'succeeded',summary:`Found ${workspace.groups.length} groups in ${workspace.name}.`,data:workspace.groups.map(group=>({id:group.id,name:group.name,shortcutCount:group.shortcuts.length,widgetCount:group.widgets.length,expanded:group.expanded}))}:clarification(action,'That workspace is no longer available.');
  }
  if(action.operation==='group.create'){
   const state=options.getState(),workspace=state.workspaces.find(item=>item.id===action.workspaceId);if(!workspace||workspace.role==='dashboard'||workspace.role==='library')return clarification(action,'Choose a regular course or custom workspace for a Group.');
   if(workspace.groups.some(group=>group.name.trim().toLocaleLowerCase()===action.name.toLocaleLowerCase()))return clarification(action,'A Group already uses that name in this workspace.');
   const id=crypto.randomUUID(),widget=createWidget('group');widget.groupId=id;widget.title=action.name;widget.instanceNumber=nextInstanceNumber('group',workspace.widgets);widget.placement=nextPlacement('group',workspace.widgets);const group={id,name:action.name,shortcuts:[],widgets:[],expanded:false};
   await options.commitState({...state,workspaces:state.workspaces.map(owner=>owner.id===workspace.id?{...owner,groups:[...owner.groups,group],widgets:[...owner.widgets,widget]}:owner)});
   return{operation:action.operation,status:'succeeded',summary:`Created Group “${action.name}” in ${workspace.name}.`,data:{workspaceId:workspace.id,groupId:id,widgetId:widget.id},changed:true};
  }
  if(action.operation==='group.rename'){
   const state=options.getState(),workspace=state.workspaces.find(item=>item.id===action.workspaceId),group=workspace?.groups.find(item=>item.id===action.groupId);if(!workspace||!group)return clarification(action,'The requested Group is no longer available.');
   if(workspace.groups.some(item=>item.id!==group.id&&item.name.trim().toLocaleLowerCase()===action.name.toLocaleLowerCase()))return clarification(action,'Another Group already uses that name.');
   const renamed=saveGroupName(workspace,group.id,action.name);await options.commitState({...state,workspaces:state.workspaces.map(owner=>owner.id===workspace.id?renamed:owner)});
   return{operation:action.operation,status:'succeeded',summary:`Renamed Group to “${action.name}”.`,changed:group.name!==action.name};
  }
  if(action.operation==='group.delete'){
   const state=options.getState(),workspace=state.workspaces.find(item=>item.id===action.workspaceId),group=workspace?.groups.find(item=>item.id===action.groupId);if(!workspace||!group)return clarification(action,'The requested Group is no longer available.');
   const hasContents=group.shortcuts.length>0||group.widgets.length>0;if(hasContents&&!action.removeContents)return clarification(action,`This Group contains ${group.shortcuts.length} shortcuts and ${group.widgets.length} widget entries. Ask to delete the Group and its contents explicitly.`);
   const next=deleteSavedGroup(workspace,group.id);await options.commitState({...state,workspaces:state.workspaces.map(owner=>owner.id===workspace.id?next:owner)});
   return{operation:action.operation,status:'succeeded',summary:hasContents?`Deleted Group “${group.name}” and its saved contents.`:`Deleted empty Group “${group.name}”.`,changed:true};
  }
  if(action.operation==='rule.list'||action.operation==='rule.runDue'||action.operation==='rule.enable'||action.operation==='rule.layoutMode'||action.operation==='rule.delete'){
   const admin=options.ruleAdmin;if(!admin)return clarification(action,'Automation rule management is unavailable.');
   if(action.operation==='rule.list')return{operation:action.operation,status:'succeeded',summary:`Found ${admin.list()?.length??0} automation rules.`,data:admin.list()??[]};
   if(action.operation==='rule.runDue'){const result=await admin.runDue();return{operation:action.operation,status:result.ok?'succeeded':'failed',summary:result.ok?result.dueCount===0?'No scheduled automation rules were due.':`${result.succeededCount} of ${result.dueCount} due rule(s) succeeded; ${result.attentionCount} need attention and ${result.notConfirmedCount} were not confirmed.`:result.message??'Automation check failed.',data:result,changed:result.succeededCount>0};}
   const message=action.operation==='rule.enable'?admin.enable(action.ruleId,action.enabled):action.operation==='rule.layoutMode'?admin.setLayoutMode(action.ruleId,action.mode):admin.delete(action.ruleId);
   return{operation:action.operation,status:'succeeded',summary:message,changed:true};
  }
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
  const request=collectionRequest(action as Exclude<WorkbenchAction,{operation:`layout.${string}`}|{operation:`dashboard.${string}`}|{operation:`group.${string}`}|{operation:`rule.${string}`}|{operation:'resource.find'}>);
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
