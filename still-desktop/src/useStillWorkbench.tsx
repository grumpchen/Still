import {currentFileRequest,currentFilesView,isFilesLocationQuestion} from './platform/currentFilesView.ts';
import {useEffect,useRef,useState} from 'react';
import type {WorkspaceState} from './domain/workspaces.ts';
import type {InterfaceAction,WorkbenchAction} from './domain/workbenchActions.ts';
import {loadAutomationState,type RuleCatalog} from './domain/automationRules.ts';
import {createWorkbenchService,type WorkbenchLayoutHandlers,type WorkbenchReceipt,type WidgetWorkbenchAction} from './platform/workbenchOperations.ts';
import {configureCollectionOperationHost} from './platform/collectionOperations.ts';
import {automationCaptureInbox} from './platform/automationCaptureInbox.ts';
import {localFiles} from './platform/files.ts';
import {useAutomationRunner,type AutomationRunnerApi} from './useAutomationRunner.ts';
import {boundedWorkbenchContext} from './domain/workbenchContext.ts';

const storage={getItem:(key:string)=>localStorage.getItem(key),setItem:(key:string,value:string)=>localStorage.setItem(key,value)};
export interface StillWorkbenchHost {interfaceAction?:(action:InterfaceAction)=>string;viewport?:()=>{width:number;height:number};getState:()=>WorkspaceState;commitState:(state:WorkspaceState)=>void;layoutHandlers:WorkbenchLayoutHandlers;widgetAction?:(action:WidgetWorkbenchAction,prompt:string)=>Promise<string>;onRuleModeRequired?:(text:string)=>void}
export function ruleRequestText(text:string):string{return text.trim().replace(/^(?:please\s+)?(?:save|create|add)\s+(?:an?\s+)?(?:automation\s+)?rule\s*[:：,，]?\s*/i,'').replace(/^(?:请)?(?:保存|创建|添加)(?:一条|一个)?(?:自动)?规则\s*[:：,，]?\s*/,'')}
export function isDirectRuleRequest(text:string):boolean{
 if(/^(?:how\s+(?:do|can|to)|what\s+|为什么|如何|怎么|怎样)/i.test(text.trim()))return false;
 return /^(?:(?:please\s+)?(?:save|create|add)\s+(?:an?\s+)?(?:automation\s+)?rule\b|(?:请)?(?:保存|创建|添加)(?:一条|一个)?(?:自动)?规则|when\s+i\s+capture\b|every\s+(?:day|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b|每天\s*\d|每(?:周|星期)[一二三四五六日]|(?:新增|添加)(?:链接|资料)(?:名称)?(?:匹配|包含))/i.test(text.trim());
}
function describeReceipt(receipt:WorkbenchReceipt):string{
 const heading=receipt.status==='failed'?`Could not complete the action: ${receipt.summary}`:receipt.status==='outcome_unknown'?`The result could not be confirmed: ${receipt.summary}`:receipt.summary;
 if(receipt.status!=='succeeded')return heading;
 const data=receipt.data as {results?:Array<Record<string,unknown>>}|Array<Record<string,unknown>>|undefined;
 const rows=Array.isArray(data)?data:data?.results;
 if(!rows?.length)return heading;
 return heading+'\n'+rows.slice(0,20).map(item=>`• ${String(item.name??item.fileName??item.path??'Item')}${item.workspaceName?` · ${String(item.workspaceName)}`:''}${item.url?` · ${String(item.url)}`:''}`).join('\n');
}
/** App-root wiring; the runner stays mounted independently from the Rules view. */
export function useStillWorkbench(host:StillWorkbenchHost){
 const latest=useRef(host);latest.current=host;
 const runnerRef=useRef<AutomationRunnerApi|null>(null),lastResults=useRef<WorkbenchReceipt[]>([]);
 const getCatalog=():RuleCatalog=>{
  const state=latest.current.getState(),courses=state.workspaces.filter(item=>item.role==='study'||item.role==='custom');
  return{workspaces:state.workspaces.filter(item=>item.role!=='library').map(({id,name})=>({id,name})),courses:courses.map(({id,name})=>({id,title:name,workspaceId:id})),layouts:state.globalLayouts.map(({id,name})=>({id,name}))};
 };
 const [service]=useState(()=>createWorkbenchService({
  interfaceAction:action=>{if(!latest.current.interfaceAction)throw new Error('The workspace window is unavailable.');return latest.current.interfaceAction(action)},
  viewport:()=>{if(!latest.current.viewport)throw new Error('The canvas is unavailable.');return latest.current.viewport()},
  getState:()=>latest.current.getState(),commitState:next=>latest.current.commitState(next),getCourses:()=>getCatalog().courses,
  layoutHandlers:{save:(...args)=>latest.current.layoutHandlers.save(...args),apply:(...args)=>latest.current.layoutHandlers.apply(...args),rename:(...args)=>latest.current.layoutHandlers.rename(...args),duplicate:(...args)=>latest.current.layoutHandlers.duplicate(...args),delete:(...args)=>latest.current.layoutHandlers.delete(...args),prepare:(...args)=>(latest.current.layoutHandlers.prepare??latest.current.layoutHandlers.apply)(...args)},
  saveRule:async (text:string)=>{const runner=runnerRef.current;if(!runner)return{kind:'error' as const,message:'Rules are still starting. Try again.'};return runner.createFromText(ruleRequestText(text))},
  ruleAdmin:{
   list:()=>{const loaded=loadAutomationState(storage);if(!loaded.ok)return[];return loaded.state.rules.map(rule=>{const latest=loaded.state.receipts.filter(receipt=>receipt.ruleId===rule.id).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0];return{id:rule.id,enabled:rule.enabled,sourceText:rule.sourceText,trigger:rule.trigger,action:rule.action,...(latest?{latestReceipt:{status:latest.status,updatedAt:latest.updatedAt,...(latest.message?{message:latest.message}:{})}}:{})}})},
   enable:(id,enabled)=>{const api=runnerRef.current;if(!api)throw new Error('Rules are still starting.');api.setEnabled(id,enabled);const loaded=loadAutomationState(storage);if(!loaded.ok)throw new Error(loaded.message);const rule=loaded.state.rules.find(item=>item.id===id);if(!rule||rule.enabled!==enabled)throw new Error('The rule change could not be saved.');return enabled?'Enabled the automation rule.':'Disabled the automation rule.'},
   setLayoutMode:(id,mode)=>{const api=runnerRef.current;if(!api)throw new Error('Rules are still starting.');api.setLayoutMode(id,mode);const loaded=loadAutomationState(storage);if(!loaded.ok)throw new Error(loaded.message);const rule=loaded.state.rules.find(item=>item.id===id);if(!rule||rule.action.kind!=='prepareWorkspaceLayout'||rule.action.mode!==mode||rule.requiresModeChoice)throw new Error('The layout mode could not be saved.');return`Saved ${mode} mode for the automation rule.`},
   delete:id=>{const api=runnerRef.current;if(!api)throw new Error('Rules are still starting.');api.deleteRule(id);const loaded=loadAutomationState(storage);if(!loaded.ok)throw new Error(loaded.message);if(loaded.state.rules.some(item=>item.id===id))throw new Error('The automation rule could not be deleted.');return'Deleted the automation rule.'},
   runDue:async()=>{const api=runnerRef.current;if(!api)throw new Error('Rules are still starting.');return api.runDueNow()},
  },
  getCaptureEvent:async id=>{const result=automationCaptureInbox.get(id);if(!result.ok)throw new Error(result.message);return result.value},
  searchFiles:async(ids,query)=>{const state=latest.current.getState();await Promise.allSettled(ids.map(async id=>{const widget=state.workspaces.flatMap(w=>w.widgets).find(w=>w.id===id);if(widget?.folderKey&&widget.folderKey!=='still-downloads-inbox')await localFiles.reuse(id,widget.folderKey)}));return localFiles.searchLibrary(ids,query)},
  widgetAction:(action,prompt)=>{if(!latest.current.widgetAction)throw new Error('The widget operation handler is unavailable.');return latest.current.widgetAction(action,prompt)},storage,
 }));
 useEffect(()=>{configureCollectionOperationHost({getState:()=>latest.current.getState(),commitState:next=>latest.current.commitState(next)})},[]);
 const runner=useAutomationRunner({storage,getCatalog,getService:()=>service.automationService});runnerRef.current=runner;
 const executeWorkbench=async(actions:WorkbenchAction[],prompt:string)=>{const receipts=await service.executeWorkbenchActions(actions,prompt);lastResults.current=receipts;return receipts.map(describeReceipt).join('\n\n')};
 const pendingRename=useRef<{workspaceId:string;widgetId:string;path:string}|null>(null);
 const renameReplyName=(prompt:string)=>prompt.trim().match(/^(?:to\s+|改成|改为)?[“"']?([^\\/:*?"<>|\r\n]+\.[a-z0-9]{1,12})[”"']?$/i)?.[1];
 const canHandleDirectWorkbenchRequest=(prompt:string)=>isDirectRuleRequest(prompt)||isFilesLocationQuestion(prompt)||!!currentFileRequest(prompt)||!!(pendingRename.current&&renameReplyName(prompt));

 const directWorkbenchRequest=async(prompt:string,selectedIds:string[]=[])=>{
  if(isFilesLocationQuestion(prompt)){
   pendingRename.current=null;
   const state=latest.current.getState();
   const workspace=state.workspaces.find(item=>item.id===state.activeId);
   const view=workspace&&currentFilesView(workspace,selectedIds);
   const zh=state.locale==='zh-CN';
   if(!view)return{handled:true,message:zh?'请点击要查看的 Files 组件，并打开一个文件夹。':'Click the Files widget you mean and open a folder first.'};
   const folder=[view.folderName,view.folder].filter(Boolean).join(' / ');
   const fileName=view.selectedFile?.split('/').at(-1);
   return{handled:true,message:zh
    ?`Files 当前打开的是「${folder}」。${fileName?` 正在预览「${fileName}」。`:''}`
    :`Files is open to “${folder}”.${fileName?` You’re previewing “${fileName}”.`:''}`};
  }
  const direct=currentFileRequest(prompt);
  const pending=pendingRename.current;
  pendingRename.current=null;
  const replyName=pending&&!direct?renameReplyName(prompt):undefined;
  const request=direct??(replyName?{kind:'rename' as const,name:replyName}:undefined);
  if(request){
   const state=latest.current.getState();
   const workspace=state.workspaces.find(item=>item.id===state.activeId);
   const view=workspace&&currentFilesView(workspace,selectedIds);
   if(!view)return{handled:true,message:'Open or select the Files widget and folder you want to use.'};
   const source=view.selectedFile??view.onlyFile;
   if(request.kind==='rename'&&!source)return{handled:true,message:'Open the file preview in Files so I know which file you want to rename.'};
   const name=request.name?.replace(/^[“"']|[”"']$/g,'');
   if(replyName&&(pending?.workspaceId!==workspace?.id||pending?.widgetId!==view.widgetId||pending?.path!==source)){
    return{handled:true,message:'The current file changed. Open the file and request the rename again.'};
   }
   if(!name){
    pendingRename.current={workspaceId:workspace!.id,widgetId:view.widgetId,path:source!};
    return{handled:true,message:`What should I rename “${source!.split('/').at(-1)}” to? Include the file extension in the new name.`};
   }
   if(/[\\/:*?"<>|]/.test(name)||name==='.'||name==='..'||name.length>120)return{handled:true,message:'Enter a file name without a folder path or Windows reserved characters.'};
   const action:WorkbenchAction=request.kind==='rename'
    ?{operation:'file.rename',widgetId:view.widgetId,path:source!,name}
    :{operation:'file.createText',widgetId:view.widgetId,path:view.folder?`${view.folder}/${name}`:name,text:''};
   return{handled:true,message:await executeWorkbench([action],prompt)};
  }
  if(!isDirectRuleRequest(prompt))return{handled:false};
  const result=await runner.createFromText(ruleRequestText(prompt));
  if(result.kind==='unsupported')return{handled:false,message:result.message};
  if(result.kind==='rule')return{handled:true,message:'Saved the automation rule. You can see its execution results in Rules.'};
  if(result.kind==='clarification'&&result.code==='layout-mode-required')latest.current.onRuleModeRequired?.(ruleRequestText(prompt));
  return{handled:true,message:result.message};
 };
 return{runner,catalog:getCatalog(),service,executeWorkbench,directWorkbenchRequest,resetDirectWorkbench:()=>{pendingRename.current=null},canHandleDirectWorkbenchRequest,workbenchContext:(prompt:string,selectedIds:string[])=>{
  const snapshot=boundedWorkbenchContext(service.snapshot(),lastResults.current);
  if(!/\b(?:file|files|folder|directory|rename)\b|文件|目录/.test(prompt.toLocaleLowerCase()))return snapshot;
  const state=latest.current.getState(),workspace=state.workspaces.find(item=>item.id===state.activeId);
  const view=workspace&&currentFilesView(workspace,selectedIds);
  return view?{...snapshot,currentFilesView:view}:snapshot;
 }};
}
