import {useEffect,useRef,useState} from 'react';
import type {WorkspaceState} from './domain/workspaces.ts';
import type {WorkbenchAction} from './domain/workbenchActions.ts';
import type {RuleCatalog} from './domain/automationRules.ts';
import {createWorkbenchService,type WorkbenchLayoutHandlers,type WorkbenchReceipt} from './platform/workbenchOperations.ts';
import {configureCollectionOperationHost} from './platform/collectionOperations.ts';
import {automationCaptureInbox} from './platform/automationCaptureInbox.ts';
import {localFiles} from './platform/files.ts';
import {useAutomationRunner,type AutomationRunnerApi} from './useAutomationRunner.ts';
import {boundedWorkbenchContext} from './domain/workbenchContext.ts';

const storage={getItem:(key:string)=>localStorage.getItem(key),setItem:(key:string,value:string)=>localStorage.setItem(key,value)};
export interface StillWorkbenchHost {getState:()=>WorkspaceState;commitState:(state:WorkspaceState)=>void;layoutHandlers:WorkbenchLayoutHandlers;onRuleModeRequired?:(text:string)=>void}
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
  getState:()=>latest.current.getState(),commitState:next=>latest.current.commitState(next),getCourses:()=>getCatalog().courses,
  layoutHandlers:{save:(...args)=>latest.current.layoutHandlers.save(...args),apply:(...args)=>latest.current.layoutHandlers.apply(...args),rename:(...args)=>latest.current.layoutHandlers.rename(...args),duplicate:(...args)=>latest.current.layoutHandlers.duplicate(...args),delete:(...args)=>latest.current.layoutHandlers.delete(...args),prepare:(...args)=>(latest.current.layoutHandlers.prepare??latest.current.layoutHandlers.apply)(...args)},
  saveRule:async (text:string)=>{const runner=runnerRef.current;if(!runner)return{kind:'error' as const,message:'Rules are still starting. Try again.'};return runner.createFromText(ruleRequestText(text))},
  getCaptureEvent:async id=>{const result=automationCaptureInbox.get(id);if(!result.ok)throw new Error(result.message);return result.value},
  searchFiles:async(ids,query)=>{const state=latest.current.getState();await Promise.allSettled(ids.map(async id=>{const widget=state.workspaces.flatMap(w=>w.widgets).find(w=>w.id===id);if(widget?.folderKey&&widget.folderKey!=='still-downloads-inbox')await localFiles.reuse(id,widget.folderKey)}));return localFiles.searchLibrary(ids,query)},storage,
 }));
 useEffect(()=>{configureCollectionOperationHost({getState:()=>latest.current.getState(),commitState:next=>latest.current.commitState(next)})},[]);
 const runner=useAutomationRunner({storage,getCatalog,getService:()=>service.automationService});runnerRef.current=runner;
 const executeWorkbench=async(actions:WorkbenchAction[],_prompt:string)=>{const receipts=await service.executeWorkbenchActions(actions);lastResults.current=receipts;return receipts.map(describeReceipt).join('\n\n')};
 const directWorkbenchRequest=async(prompt:string)=>{
  if(!isDirectRuleRequest(prompt))return{handled:false};
  const result=await runner.createFromText(ruleRequestText(prompt));
  if(result.kind==='unsupported')return{handled:false,message:result.message};
  if(result.kind==='rule')return{handled:true,message:'Saved the automation rule. You can see its execution results in Rules.'};
  if(result.kind==='clarification'&&result.code==='layout-mode-required')latest.current.onRuleModeRequired?.(ruleRequestText(prompt));
  return{handled:true,message:result.message};
 };
 return{runner,catalog:getCatalog(),service,executeWorkbench,directWorkbenchRequest,canHandleDirectWorkbenchRequest:isDirectRuleRequest,workbenchContext:()=>boundedWorkbenchContext(service.snapshot(),lastResults.current)};
}
