import type {AutomationCaptureQueue,PendingCapture} from '../domain/automationRunner.ts';
import {acknowledgeCaptureEvent,appendSavedCapture,captureEventFromSavedResource,getCaptureEvent,ignoreCaptureEvent,ignoredCaptureEvents,pendingCaptureEvents,CAPTURE_INBOX_EVENT,type CaptureInboxEvent,type CaptureInboxEventNotification,type CaptureInboxResult,type NewCaptureEvent,type SavedCaptureResource} from '../domain/captureInbox.ts';
import type {AutomationReceipt,AutomationStorage} from '../domain/automationRules.ts';

export interface CaptureInboxEventTarget {addEventListener(type:string,listener:(event:Event)=>void):void;removeEventListener(type:string,listener:(event:Event)=>void):void;dispatchEvent?(event:Event):boolean}
export interface AutomationCaptureInboxApi extends AutomationCaptureQueue {
  append(event:NewCaptureEvent):CaptureInboxResult<import('../domain/captureInbox.ts').CaptureInboxEvent>;
  recordSavedCapture(captureId:string,resource:SavedCaptureResource,capturedAt?:string):CaptureInboxResult<import('../domain/captureInbox.ts').CaptureInboxEvent>;
  get(eventId:string):ReturnType<typeof getCaptureEvent>;
  pending():ReturnType<typeof pendingCaptureEvents>;
  ignored():ReturnType<typeof ignoredCaptureEvents>;
}
const browserStorage:AutomationStorage={getItem:key=>window.localStorage.getItem(key),setItem:(key,value)=>window.localStorage.setItem(key,value)};
function notification(target:CaptureInboxEventTarget|undefined,event:CaptureInboxEventNotification){if(target?.dispatchEvent&&typeof CustomEvent!=='undefined')target.dispatchEvent(new CustomEvent(CAPTURE_INBOX_EVENT,{detail:event}))}
function toRunnerEvent(event:CaptureInboxEvent):PendingCapture{return{eventId:event.eventId,capturedAt:event.capturedAt,resourceKind:event.kind,name:event.name,...('sourceWorkspaceId'in event?{sourceWorkspaceId:event.sourceWorkspaceId}:{}),...(event.kind==='link'&&event.origin.kind!=='legacy-unknown'?{sourceWorkspaceId:event.origin.workspaceId,linkOrigin:event.origin.kind,...(event.origin.kind==='browser'?{widgetId:event.origin.widgetId}:{groupId:event.origin.groupId}),linkId:event.linkId,...(event.url?{url:event.url}:{})}:{}),...(event.kind==='file'?{widgetId:event.widgetId,...(event.resourceId?{resourceId:event.resourceId}:{})}:{}),...(event.kind==='idea'?{widgetId:event.widgetId,documentId:event.documentId}:{})}}
function unwrap<T>(result:{ok:true;value:T}|{ok:false;message:string}):T{if(!result.ok)throw new Error(result.message);return result.value}

/** Queue adapter that is safe to construct before the webview/browser is available. */
export function createAutomationCaptureInbox(storage:AutomationStorage=browserStorage,target?:CaptureInboxEventTarget):AutomationCaptureInboxApi{
 const getTarget=()=>target??(typeof window!=='undefined'?window:undefined);
 const append=(event:NewCaptureEvent)=>appendSavedCapture(storage,event,{notify:payload=>notification(getTarget(),payload)});
 return{
  append,
  recordSavedCapture:(captureId,resource,capturedAt=new Date().toISOString())=>append(captureEventFromSavedResource(captureId,capturedAt,resource)),
  get:(eventId)=>getCaptureEvent(storage,eventId),
  pending:()=>pendingCaptureEvents(storage),
  ignored:()=>ignoredCaptureEvents(storage),
  listPending:async()=>unwrap(pendingCaptureEvents(storage)).map(toRunnerEvent),
  listIgnored:async()=>unwrap(ignoredCaptureEvents(storage)).map(toRunnerEvent),
  ignore:async(eventId,reason)=>{unwrap(ignoreCaptureEvent(storage,eventId,reason))},
  acknowledge:async(eventId,receipts)=>{unwrap(acknowledgeCaptureEvent(storage,eventId,receipts as AutomationReceipt[]))},
  subscribe:(callback)=>{const eventTarget=getTarget();if(!eventTarget)return()=>{};const listener=(event:Event)=>{const detail=(event as CustomEvent<CaptureInboxEventNotification>).detail;if(detail&&typeof detail.eventId==='string')callback(detail.eventId)};eventTarget.addEventListener(CAPTURE_INBOX_EVENT,listener);return()=>eventTarget.removeEventListener(CAPTURE_INBOX_EVENT,listener)},
 };
}
export const automationCaptureInbox=createAutomationCaptureInbox();
