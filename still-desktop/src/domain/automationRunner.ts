import { dueAutomationOccurrences, evaluateAutomationRules, loadAutomationState, saveAutomationState, type AutomationCaptureEvent, type AutomationOperationService, type AutomationReceipt, type AutomationState, type AutomationStorage, type RuleCatalog } from './automationRules.ts';
import type { AutomationCursor, AutomationRuntimePort, AutomationRuntimeStatus, AutomationTick } from '../platform/automationRuntime.ts';

export interface PendingCapture extends AutomationCaptureEvent {}
export interface AutomationRunSummary {ok:boolean;dueCount:number;succeededCount:number;attentionCount:number;notConfirmedCount:number;message?:string}
export interface AutomationCaptureQueue {
  listPending():Promise<PendingCapture[]>;
  acknowledge(eventId:string,receipts:AutomationReceipt[]):Promise<void|boolean>;
  ignore?(eventId:string,reason:string):Promise<void|boolean>;
  listIgnored?():Promise<PendingCapture[]>;
  subscribe?(callback:(eventId:string)=>void):()=>void;
}
export type AutomationRunnerMode='starting'|'native-tray-runtime'|'web-preview-page-open'|'runtime-error';
export interface AutomationRunnerSnapshot {mode:AutomationRunnerMode;state:AutomationState;runtimeStatus:AutomationRuntimeStatus|null;cursor:AutomationCursor;pendingCaptures:PendingCapture[];ignoredCaptures:number;lastTickAt:string|null;error:string|null;captureQueueAvailable:boolean}
export interface AutomationRunnerControllerOptions {
  storage:AutomationStorage;
  runtime:AutomationRuntimePort;
  getService:()=>AutomationOperationService;
  getCaptureQueue?:()=>AutomationCaptureQueue|undefined;
  now?:()=>Date;
  previewTickMs?:number;
  setPreviewInterval?:(callback:()=>void,ms:number)=>unknown;
  clearPreviewInterval?:(token:unknown)=>void;
  onSnapshot:(snapshot:AutomationRunnerSnapshot)=>void;
}
const CURSOR_KEY='still.automation-runtime-cursor.v1';
function readCursor(storage:AutomationStorage):AutomationCursor{try{const value=JSON.parse(storage.getItem(CURSOR_KEY)??'null');if(value&&typeof value.runtimeId==='string'&&Number.isSafeInteger(value.sequence)&&value.sequence>=0)return{runtimeId:value.runtimeId,sequence:value.sequence}}catch{}return{runtimeId:null,sequence:0}}
function writeCursor(storage:AutomationStorage,cursor:AutomationCursor):void{storage.setItem(CURSOR_KEY,JSON.stringify(cursor))}
function matchesCapture(event:PendingCapture,rule:AutomationState['rules'][number]):boolean{return rule.enabled&&rule.trigger.kind==='onCapture'&&rule.action.kind==='fileResourcesToCourse'&&event.resourceKind!=='idea'&&rule.action.resourceKinds.includes(event.resourceKind)&&event.name.toLocaleLowerCase().includes(rule.action.queryPattern.toLocaleLowerCase())&&(!rule.action.sourceWorkspaceId||rule.action.sourceWorkspaceId===event.sourceWorkspaceId)}

/** Native ticks drive hidden/tray work. Browser timer is explicitly page-open preview only. */
export class AutomationRunnerController {
 private alive=false;
 private snapshot:AutomationRunnerSnapshot;
 private unlisten:(()=>void)|null=null;
 private unlistenCapture:(()=>void)|null=null;
 private previewTimer:unknown=null;
 private work:Promise<void>=Promise.resolve();
 private cursor:AutomationCursor;
 constructor(private readonly options:AutomationRunnerControllerOptions){
  const loaded=loadAutomationState(options.storage);this.cursor=readCursor(options.storage);
  this.snapshot={mode:'starting',state:loaded.ok?loaded.state:{version:2,rules:[],receipts:[]},runtimeStatus:null,cursor:this.cursor,pendingCaptures:[],ignoredCaptures:0,lastTickAt:null,error:loaded.ok?null:loaded.message,captureQueueAvailable:!!options.getCaptureQueue?.()};
 }
 getSnapshot(){return this.snapshot}
 private publish(patch:Partial<AutomationRunnerSnapshot>){this.snapshot={...this.snapshot,...patch};this.options.onSnapshot(this.snapshot)}
 private enqueue(task:()=>Promise<void>){this.work=this.work.then(task,task);return this.work}
 async start():Promise<void>{
  if(this.alive)return;this.alive=true;this.reloadState();
  const captureQueue=this.options.getCaptureQueue?.();
  try{this.unlistenCapture=captureQueue?.subscribe?.(()=>{void this.enqueue(async()=>{await this.runPass(this.now())})})??null}catch(error){this.publish({error:`Capture event listener unavailable: ${this.errorText(error)}`})}
  if(this.options.runtime.native){
   try{this.unlisten=await this.options.runtime.subscribeTicks(tick=>{void this.enqueue(()=>this.acceptTick(tick))});if(!this.alive){this.unlisten();this.unlisten=null;return}}
   catch(error){this.publish({mode:'runtime-error',error:this.errorText(error)});return}
   this.publish({mode:'native-tray-runtime'});
   try{const status=await this.options.runtime.runtimeStatus();if(!this.alive)return;this.publish({runtimeStatus:status,mode:'native-tray-runtime'});await this.enqueue(()=>this.replay())}catch(error){this.publish({mode:'runtime-error',error:`Native automation runtime unavailable: ${this.errorText(error)}`})}
  }else{
   this.publish({mode:'web-preview-page-open'});
   await this.runPass(new Date());
   const set=this.options.setPreviewInterval??((fn,ms)=>window.setInterval(fn,ms));
   this.previewTimer=set(()=>{void this.enqueue(async()=>{await this.runPass(this.now())})},this.options.previewTickMs??15000);
  }
 }
 stop(){this.alive=false;this.unlisten?.();this.unlisten=null;this.unlistenCapture?.();this.unlistenCapture=null;if(this.previewTimer!==null){const clear=this.options.clearPreviewInterval??(token=>window.clearInterval(token as number));clear(this.previewTimer);this.previewTimer=null}}
 private now(){return this.options.now?.()??new Date()}
 private errorText(error:unknown){return error instanceof Error?error.message:String(error)}
 private reloadState(){const loaded=loadAutomationState(this.options.storage);if(!loaded.ok){this.publish({error:loaded.message});return false}this.publish({state:loaded.state,error:null});return true}
 private async replay(){
  const batch=await this.options.runtime.ticksSince(this.cursor);
  if(!this.alive)return;
  if(batch.runtimeId!==this.cursor.runtimeId)this.cursor={runtimeId:batch.runtimeId,sequence:0};
  for(const tick of [...batch.ticks].sort((a,b)=>a.sequence-b.sequence)){
   if(tick.runtimeId!==batch.runtimeId||tick.sequence<=this.cursor.sequence)continue;
   if(!(await this.processTick(tick)))return;
  }
  this.publish({cursor:this.cursor});
 }
 private async acceptTick(tick:AutomationTick){
  if(!this.alive)return;
  if(!this.cursor.runtimeId||tick.runtimeId!==this.cursor.runtimeId||tick.sequence>this.cursor.sequence+1){await this.replay();return}
  if(tick.sequence<=this.cursor.sequence)return;
  await this.processTick(tick);
 }
 private async processTick(tick:AutomationTick):Promise<boolean>{
  let runtimeStatusError:string|null=null;
  try{const runtimeStatus=await this.options.runtime.runtimeStatus();if(this.alive)this.publish({runtimeStatus,mode:'native-tray-runtime'})}catch(error){runtimeStatusError=`Native runtime status refresh failed: ${this.errorText(error)}`}
  const okay=await this.runPass(new Date(tick.scheduledAtUnixMs));
  if(!okay){if(runtimeStatusError)this.publish({error:runtimeStatusError});return false}
  this.cursor={runtimeId:tick.runtimeId,sequence:tick.sequence};
  try{writeCursor(this.options.storage,this.cursor)}catch(error){this.publish({error:`Tick ran but its cursor could not be saved: ${this.errorText(error)}`});return false}
  this.publish({cursor:this.cursor,lastTickAt:new Date(tick.scheduledAtUnixMs).toISOString(),...(runtimeStatusError?{error:runtimeStatusError}:{})});return true;
 }
 async runDueNow():Promise<AutomationRunSummary>{
  const now=this.now(),loaded=loadAutomationState(this.options.storage);
  if(!loaded.ok)return{ok:false,dueCount:0,succeededCount:0,attentionCount:0,notConfirmedCount:0,message:loaded.message};
  const due=dueAutomationOccurrences(loaded.state,now);
  let okay=false;await this.enqueue(async()=>{okay=await this.runPass(now)});
  const latest=loadAutomationState(this.options.storage);
  if(!latest.ok)return{ok:false,dueCount:due.length,succeededCount:0,attentionCount:0,notConfirmedCount:due.length,message:latest.message};
  let succeededCount=0,attentionCount=0,notConfirmedCount=0;
  for(const occurrence of due){
   const receipt=latest.state.receipts.find(item=>item.ruleId===occurrence.rule.id&&item.occurrenceKey===occurrence.occurrenceKey);
   if(receipt?.status==='succeeded')succeededCount++;
   else if(receipt&&receipt.status!=='running')attentionCount++;
   else notConfirmedCount++;
  }
  return{ok:okay,dueCount:due.length,succeededCount,attentionCount,notConfirmedCount,...(!okay?{message:this.snapshot.error??'Automation evaluation could not complete.'}:{})};
 }
 async refreshRuntimeStatus():Promise<AutomationRuntimeStatus|null>{if(!this.options.runtime.native)return null;const status=await this.options.runtime.runtimeStatus();this.publish({runtimeStatus:status,mode:'native-tray-runtime'});return status}
 refresh():void{this.reloadState()}
 private async runPass(now:Date):Promise<boolean>{
  const service=this.options.getService(),scheduled=await evaluateAutomationRules({storage:this.options.storage,service,now});
  if(!scheduled.ok){this.reloadState();this.publish({error:scheduled.error});return false}
  let state=scheduled.state,error:string|null=null,pending:PendingCapture[]=this.snapshot.pendingCaptures,ignoredCount=this.snapshot.ignoredCaptures;
  const queue=this.options.getCaptureQueue?.();
  if(queue){
   try{pending=await queue.listPending();for(const event of [...pending]){const latest=loadAutomationState(this.options.storage);if(!latest.ok){error=latest.message;break}state=latest.state;const relevant=state.rules.filter(rule=>matchesCapture(event,rule));if(!relevant.length){if(queue.ignore){try{const ignored=await queue.ignore(event.eventId,event.resourceKind==='idea'?'Idea captures are saved for history, but no idea automation is supported yet.':`No enabled capture rule matched “${event.name}”.`);if(ignored===false)throw new Error('The event journal did not confirm the ignored state.');pending=pending.filter(item=>item.eventId!==event.eventId)}catch(reason){error=`Capture ${event.eventId} could not be marked ignored: ${this.errorText(reason)}`}}continue}
     const outcome=await evaluateAutomationRules({storage:this.options.storage,service:this.options.getService(),now,pendingCapture:event});if(!outcome.ok){error=outcome.error;break}state=outcome.state;
     const receiptKey=`capture-event:${event.eventId}`,receipts=relevant.map(rule=>state.receipts.find(item=>item.ruleId===rule.id&&item.occurrenceKey===receiptKey)).filter((item):item is AutomationReceipt=>!!item);
     if(receipts.length===relevant.length&&receipts.every(receipt=>receipt.status==='succeeded')){try{const acknowledged=await queue.acknowledge(event.eventId,receipts);if(acknowledged===false)throw new Error('The event journal did not confirm acknowledgement.');pending=pending.filter(item=>item.eventId!==event.eventId)}catch(reason){error=`Capture ${event.eventId} succeeded but could not be acknowledged: ${this.errorText(reason)}`}}
    }if(queue.listIgnored)ignoredCount=(await queue.listIgnored()).length}catch(reason){error=`Could not read pending QuickCapture events: ${this.errorText(reason)}`}
  }
  const latest=loadAutomationState(this.options.storage);if(latest.ok)state=latest.state;else error=latest.message;
  const currentPending=queue?pending:this.snapshot.pendingCaptures;
  this.publish({state,pendingCaptures:currentPending,ignoredCaptures:ignoredCount,captureQueueAvailable:!!queue,error});return !error;
 }
}
