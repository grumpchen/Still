import {useCallback,useEffect,useRef,useState} from 'react';
import {createAutomationRule,loadAutomationState,parseAutomationRule,saveAutomationState,type AutomationAction,type AutomationRule,type AutomationRuleDraft,type AutomationStorage,type RuleCatalog,type RuleParseResult} from './domain/automationRules.ts';
import {AutomationRunnerController,type AutomationCaptureQueue,type AutomationRunnerSnapshot} from './domain/automationRunner.ts';
import type {AutomationRuntimePort} from './platform/automationRuntime.ts';
import {automationRuntime} from './platform/automationRuntime.ts';
import type {AutomationOperationService} from './domain/automationRules.ts';

export type CreateFromTextResult=RuleParseResult|{kind:'error';message:string};
export interface AutomationRunnerApi extends AutomationRunnerSnapshot {
 createFromText(text:string,layoutMode?:'append'|'replace'):Promise<CreateFromTextResult>;
 setEnabled(ruleId:string,enabled:boolean):void;
 setLayoutMode(ruleId:string,mode:'append'|'replace'):void;
 deleteRule(ruleId:string):void;
 runDueNow():Promise<void>;
 hideToTray():Promise<{ok:true}|{ok:false;message:string}>;
}
export interface UseAutomationRunnerOptions {
 storage:AutomationStorage;
 getCatalog:()=>RuleCatalog;
 getService:()=>AutomationOperationService;
 getCaptureQueue?:()=>AutomationCaptureQueue|undefined;
 runtime?:AutomationRuntimePort;
}
const initialSnapshot=(storage:AutomationStorage):AutomationRunnerSnapshot=>{
 const loaded=loadAutomationState(storage);
 return{mode:'starting',state:loaded.ok?loaded.state:{version:2,rules:[],receipts:[]},runtimeStatus:null,cursor:{runtimeId:null,sequence:0},pendingCaptures:[],lastTickAt:null,error:loaded.ok?null:loaded.message,captureQueueAvailable:false};
};

/** Mount this hook once at the app root, independently from whether AutomationPanel is open. */
export function useAutomationRunner(options:UseAutomationRunnerOptions):AutomationRunnerApi {
 const latest=useRef(options);latest.current=options;
 const [snapshot,setSnapshot]=useState(()=>initialSnapshot(options.storage));
 const [mutationError,setMutationError]=useState<string|null>(null);
 const controller=useRef<AutomationRunnerController|null>(null);
 useEffect(()=>{
  const current=latest.current;
  const instance=new AutomationRunnerController({storage:current.storage,runtime:current.runtime??automationRuntime,getService:()=>latest.current.getService(),getCaptureQueue:()=>latest.current.getCaptureQueue?.(),onSnapshot:setSnapshot});
  controller.current=instance;
  void instance.start().catch(error=>setSnapshot(value=>({...value,mode:'runtime-error',error:error instanceof Error?error.message:String(error)})));
  return()=>{instance.stop();if(controller.current===instance)controller.current=null};
 },[options.storage,options.runtime]);
 const refresh=useCallback(()=>{controller.current?.refresh();const loaded=loadAutomationState(latest.current.storage);if(loaded.ok)setSnapshot(value=>({...value,state:loaded.state,error:null}));else setSnapshot(value=>({...value,error:loaded.message}))},[]);
 const createFromText=useCallback(async(text:string,layoutMode?:'append'|'replace'):Promise<CreateFromTextResult>=>{
  const catalog=latest.current.getCatalog(),parsed=parseAutomationRule(text,{catalog});
  let draft:AutomationRuleDraft,id:string;
  if(parsed.kind==='rule'){
   if(parsed.rule.action.kind==='prepareWorkspaceLayout'&&!parsed.rule.action.mode)return{kind:'clarification',code:'layout-mode-required',message:'Choose append or replace before saving this layout rule.',choices:[{id:'append',label:'Append · keep current widgets'},{id:'replace',label:'Replace · replace workspace layout'}],pendingLayout:{trigger:parsed.rule.trigger,workspaceId:parsed.rule.action.workspaceId,layoutId:parsed.rule.action.layoutId}};
   draft={sourceText:parsed.rule.sourceText,trigger:parsed.rule.trigger,action:parsed.rule.action as AutomationAction};id=parsed.rule.id
  }
  else if(parsed.kind==='clarification'&&parsed.code==='layout-mode-required'&&layoutMode&&parsed.pendingLayout){draft={sourceText:text.trim(),trigger:parsed.pendingLayout.trigger,action:{kind:'prepareWorkspaceLayout',workspaceId:parsed.pendingLayout.workspaceId,layoutId:parsed.pendingLayout.layoutId,mode:layoutMode}};id=crypto.randomUUID()}
  else return parsed;
  const current=loadAutomationState(latest.current.storage);if(!current.ok){setMutationError(current.message);return{kind:'error',message:current.message}}
  const created=createAutomationRule(draft,catalog,new Date(),id);
  if(!created.ok){setMutationError(created.message);return{kind:'clarification',message:created.message}}
  if(current.state.rules.some(rule=>rule.id===created.rule.id)){const message='A rule with this ID already exists. Try again.';setMutationError(message);return{kind:'error',message}}
  try{saveAutomationState(latest.current.storage,{...current.state,rules:[...current.state.rules,created.rule]});setMutationError(null);refresh();return{kind:'rule',rule:created.rule}}
  catch(error){const message=`Could not save automation rule: ${error instanceof Error?error.message:String(error)}`;setMutationError(message);setSnapshot(value=>({...value,error:message}));return{kind:'error',message}}
 },[refresh]);
 const setEnabled=useCallback((ruleId:string,enabled:boolean)=>{
  const current=loadAutomationState(latest.current.storage);if(!current.ok){setMutationError(current.message);setSnapshot(value=>({...value,error:current.message}));return}
  if(enabled&&current.state.rules.some(rule=>rule.id===ruleId&&rule.requiresModeChoice)){const message='Choose append or replace before enabling this legacy layout rule.';setMutationError(message);setSnapshot(value=>({...value,error:message}));return}
  try{const rules=current.state.rules.map(rule=>rule.id===ruleId?{...rule,enabled,updatedAt:new Date().toISOString()}:rule);saveAutomationState(latest.current.storage,{...current.state,rules});setMutationError(null);refresh()}
  catch(error){const message=`Could not update automation rule: ${error instanceof Error?error.message:String(error)}`;setMutationError(message);setSnapshot(value=>({...value,error:message}))}
 },[refresh]);
 const deleteRule=useCallback((ruleId:string)=>{
  const current=loadAutomationState(latest.current.storage);if(!current.ok){setMutationError(current.message);setSnapshot(value=>({...value,error:current.message}));return}
  try{saveAutomationState(latest.current.storage,{...current.state,rules:current.state.rules.filter(rule=>rule.id!==ruleId)});setMutationError(null);refresh()}
  catch(error){const message=`Could not delete automation rule: ${error instanceof Error?error.message:String(error)}`;setMutationError(message);setSnapshot(value=>({...value,error:message}))}
 },[refresh]);
 const setLayoutMode=useCallback((ruleId:string,mode:'append'|'replace')=>{
  const current=loadAutomationState(latest.current.storage);if(!current.ok){setMutationError(current.message);setSnapshot(value=>({...value,error:current.message}));return}
  const target=current.state.rules.find(rule=>rule.id===ruleId);
  if(!target||target.action.kind!=='prepareWorkspaceLayout'||!target.requiresModeChoice){const message='This rule is not waiting for a layout mode.';setMutationError(message);setSnapshot(value=>({...value,error:message}));return}
  try{const rules=current.state.rules.map(rule=>{if(rule.id!==ruleId)return rule;const{requiresModeChoice:_needsChoice,resumeAfterModeChoice,...rest}=rule;return{...rest,enabled:resumeAfterModeChoice===true,action:{...rule.action,mode},updatedAt:new Date().toISOString()}});saveAutomationState(latest.current.storage,{...current.state,rules});setMutationError(null);refresh()}
  catch(error){const message=`Could not save layout mode: ${error instanceof Error?error.message:String(error)}`;setMutationError(message);setSnapshot(value=>({...value,error:message}))}
 },[refresh]);
 const runDueNow=useCallback(async()=>{try{await controller.current?.runDueNow()}catch(error){const message=`Could not run due automations: ${error instanceof Error?error.message:String(error)}`;setMutationError(message);setSnapshot(value=>({...value,error:message}))}},[]);
 const hideToTray=useCallback(async()=>{try{await(latest.current.runtime??automationRuntime).hideToTray();return{ok:true as const}}catch(error){return{ok:false as const,message:error instanceof Error?error.message:String(error)}}},[]);
 return{...snapshot,error:mutationError??snapshot.error,createFromText,setEnabled,setLayoutMode,deleteRule,runDueNow,hideToTray};
}
