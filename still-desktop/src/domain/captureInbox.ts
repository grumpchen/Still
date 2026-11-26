import type {AutomationReceipt,AutomationStorage} from './automationRules.ts';

export const CAPTURE_INBOX_STORAGE_KEY='still.automation-capture-inbox.v1';
export const CAPTURE_INBOX_LIMIT=2000;
const ID_RE=/^[A-Za-z0-9][A-Za-z0-9._:@/%-]{0,499}$/;
const SAFE_TEXT=/^[^\u0000-\u001f\u007f]{1,500}$/;

interface CaptureEventBase {version:1;eventId:string;capturedAt:string;name:string;status:'pending'|'acknowledged';acknowledgedAt?:string;terminalReceipts?:Array<{ruleId:string;receiptId?:string;updatedAt:string}>}
export type CaptureInboxEvent=
 | (CaptureEventBase&{kind:'file';sourceWorkspaceId:string;widgetId:string;resourceId?:string})
 | (CaptureEventBase&{kind:'idea';sourceWorkspaceId:string;widgetId:string;documentId:string})
 | (CaptureEventBase&{kind:'link';linkOrigin:string;linkId:string;url?:string;sourceWorkspaceId?:string;widgetId?:string});
export type NewCaptureEvent=
 | {eventId?:string;kind:'file';capturedAt:string;name:string;sourceWorkspaceId:string;widgetId:string;resourceId?:string}
 | {eventId?:string;kind:'idea';capturedAt:string;name:string;sourceWorkspaceId:string;widgetId:string;documentId:string}
 | {eventId?:string;kind:'link';capturedAt:string;name:string;linkOrigin:string;linkId:string;url?:string;sourceWorkspaceId?:string;widgetId?:string};
export type SavedCaptureResource=
 | {kind:'file';workspaceId:string;widgetId:string;name:string;sourceId:string}
 | {kind:'note';workspaceId:string;widgetId:string;documentId:string;name:string}
 | {kind:'link';origin:string;linkId:string;name:string;url:string};
export interface CaptureInboxState {version:1;events:CaptureInboxEvent[]}
export type CaptureInboxErrorCode='corrupt'|'unsupported-version'|'invalid-event'|'id-conflict'|'queue-full'|'storage';
export type CaptureInboxResult<T>={ok:true;value:T;duplicate?:boolean}|{ok:false;code:CaptureInboxErrorCode;message:string};
export type CaptureInboxLoadResult={ok:true;state:CaptureInboxState}|{ok:false;code:'corrupt'|'unsupported-version'|'storage';message:string};
export interface CaptureInboxEventNotification {eventId:string}
export const CAPTURE_INBOX_EVENT='still:automation-capture';
const obj=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const validDate=(value:unknown):value is string=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const validId=(value:unknown):value is string=>typeof value==='string'&&ID_RE.test(value);
const validText=(value:unknown):value is string=>typeof value==='string'&&SAFE_TEXT.test(value.trim());
function validUrl(value:unknown):value is string{if(typeof value!=='string')return false;try{const url=new URL(value);return url.protocol==='https:'||url.protocol==='http:'}catch{return false}}
function checkedEvent(value:unknown):CaptureInboxEvent|null{
 if(!obj(value)||value.version!==1||!validId(value.eventId)||!validDate(value.capturedAt)||!validText(value.name)||!['pending','acknowledged'].includes(String(value.status)))return null;
 if(value.acknowledgedAt!==undefined&&!validDate(value.acknowledgedAt))return null;
 if(value.terminalReceipts!==undefined&&(!Array.isArray(value.terminalReceipts)||value.terminalReceipts.some(item=>!obj(item)||!validId(item.ruleId)||item.receiptId!==undefined&&!validId(item.receiptId)||!validDate(item.updatedAt))))return null;
 if(value.status==='acknowledged'&&(!validDate(value.acknowledgedAt)||!Array.isArray(value.terminalReceipts)||!value.terminalReceipts.length)||value.status==='pending'&&(value.acknowledgedAt!==undefined||value.terminalReceipts!==undefined))return null;
 const common={version:1 as const,eventId:value.eventId,capturedAt:new Date(value.capturedAt).toISOString(),name:value.name.trim(),status:value.status as 'pending'|'acknowledged',...(typeof value.acknowledgedAt==='string'?{acknowledgedAt:new Date(value.acknowledgedAt).toISOString()}:{}),...(Array.isArray(value.terminalReceipts)?{terminalReceipts:value.terminalReceipts as CaptureInboxEvent['terminalReceipts']}: {})};
 if(value.kind==='file'&&validId(value.sourceWorkspaceId)&&validId(value.widgetId)&&(value.resourceId===undefined||validId(value.resourceId)))return{...common,kind:'file',sourceWorkspaceId:value.sourceWorkspaceId,widgetId:value.widgetId,...(typeof value.resourceId==='string'?{resourceId:value.resourceId}:{})};
 if(value.kind==='idea'&&validId(value.sourceWorkspaceId)&&validId(value.widgetId)&&validId(value.documentId))return{...common,kind:'idea',sourceWorkspaceId:value.sourceWorkspaceId,widgetId:value.widgetId,documentId:value.documentId};
 if(value.kind==='link'&&validText(value.linkOrigin)&&validId(value.linkId)&&(value.url===undefined||validUrl(value.url))&&(value.sourceWorkspaceId===undefined||validId(value.sourceWorkspaceId))&&(value.widgetId===undefined||validId(value.widgetId))&&((value.sourceWorkspaceId===undefined)===(value.widgetId===undefined)))return{...common,kind:'link',linkOrigin:value.linkOrigin.trim(),linkId:value.linkId,...(typeof value.url==='string'?{url:value.url}:{}),...(typeof value.sourceWorkspaceId==='string'?{sourceWorkspaceId:value.sourceWorkspaceId,widgetId:value.widgetId as string}:{})};
 return null;
}
export function emptyCaptureInbox():CaptureInboxState{return{version:1,events:[]}}
/** Invalid/future data is left intact so no append/ack silently destroys the journal. */
export function loadCaptureInbox(storage:AutomationStorage,key=CAPTURE_INBOX_STORAGE_KEY):CaptureInboxLoadResult{
 let raw:string|null;try{raw=storage.getItem(key)}catch(error){return{ok:false,code:'storage',message:`Capture inbox could not be read: ${error instanceof Error?error.message:String(error)}`}}
 if(raw===null)return{ok:true,state:emptyCaptureInbox()};
 try{const parsed:unknown=JSON.parse(raw);if(!obj(parsed)||!Number.isInteger(parsed.version))return{ok:false,code:'corrupt',message:'Capture inbox is malformed and was preserved.'};if(parsed.version!==1)return{ok:false,code:'unsupported-version',message:'Capture inbox has a newer or unsupported version and was preserved.'};if(!Array.isArray(parsed.events)||parsed.events.length>CAPTURE_INBOX_LIMIT)return{ok:false,code:'corrupt',message:'Capture inbox event list is invalid and was preserved.'};const events=parsed.events.map(checkedEvent);if(events.some(event=>!event)||new Set((events as CaptureInboxEvent[]).map(event=>event.eventId)).size!==events.length)return{ok:false,code:'corrupt',message:'Capture inbox failed validation and was preserved.'};return{ok:true,state:{version:1,events:events as CaptureInboxEvent[]}}}catch{return{ok:false,code:'corrupt',message:'Capture inbox could not be parsed and was preserved.'}}
}
export function captureEventIdFor(input:NewCaptureEvent):string{
 if(input.eventId)return input.eventId;
 if(input.kind==='link')return`link:${encodeURIComponent(input.linkOrigin)}:${encodeURIComponent(input.linkId)}`;
 if(input.kind==='idea')return`idea:${input.sourceWorkspaceId}:${input.widgetId}:${input.documentId}`;
 return`file:${input.sourceWorkspaceId}:${input.widgetId}:${input.resourceId??'capture'}`;
}
/** Adapt the successful Library/PDF save callback into the journal's exact locator shape. */
export function captureEventFromSavedResource(captureId:string,capturedAt:string,resource:SavedCaptureResource):NewCaptureEvent{
 if(resource.kind==='link')return{eventId:captureId,kind:'link',capturedAt,name:resource.name,linkOrigin:resource.origin,linkId:resource.linkId,url:resource.url};
 if(resource.kind==='note')return{eventId:captureId,kind:'idea',capturedAt,name:resource.name,sourceWorkspaceId:resource.workspaceId,widgetId:resource.widgetId,documentId:resource.documentId};
 return{eventId:captureId,kind:'file',capturedAt,name:resource.name,sourceWorkspaceId:resource.workspaceId,widgetId:resource.widgetId,resourceId:resource.sourceId};
}
function validateNewCapture(input:NewCaptureEvent):CaptureInboxEvent|null{return checkedEvent({...input,eventId:captureEventIdFor(input),version:1,status:'pending'})}
function sameIdentity(a:CaptureInboxEvent,b:CaptureInboxEvent):boolean{
 // captureId remains stable when the saved callback is retried after an inbox
 // storage error, so its timestamp can differ slightly without creating a
 // conflict. Source identity and saved metadata must still match exactly.
 if(a.kind!==b.kind||a.eventId!==b.eventId||a.name!==b.name)return false;
 if(a.kind==='file'&&b.kind==='file')return a.sourceWorkspaceId===b.sourceWorkspaceId&&a.widgetId===b.widgetId&&a.resourceId===b.resourceId;
 if(a.kind==='idea'&&b.kind==='idea')return a.sourceWorkspaceId===b.sourceWorkspaceId&&a.widgetId===b.widgetId&&a.documentId===b.documentId;
 if(a.kind==='link'&&b.kind==='link')return a.linkOrigin===b.linkOrigin&&a.linkId===b.linkId&&a.url===b.url&&a.sourceWorkspaceId===b.sourceWorkspaceId&&a.widgetId===b.widgetId;
 return false;
}
function persist(storage:AutomationStorage,state:CaptureInboxState,key:string):CaptureInboxResult<CaptureInboxState>{try{storage.setItem(key,JSON.stringify(state));return{ok:true,value:state}}catch(error){return{ok:false,code:'storage',message:`Capture inbox could not be saved: ${error instanceof Error?error.message:String(error)}`}}}
/** Call only after the caller's actual link/file/idea save has completed successfully. */
export function appendSavedCapture(storage:AutomationStorage,input:NewCaptureEvent,options:{key?:string;notify?:(event:CaptureInboxEventNotification)=>void}={}):CaptureInboxResult<CaptureInboxEvent>{
 const key=options.key??CAPTURE_INBOX_STORAGE_KEY,loaded=loadCaptureInbox(storage,key);if(!loaded.ok)return loaded;
 const event=validateNewCapture(input);if(!event)return{ok:false,code:'invalid-event',message:'Capture event is missing a stable ID or exact source reference.'};
 const existing=loaded.state.events.find(item=>item.eventId===event.eventId);if(existing){if(!sameIdentity(existing,event))return{ok:false,code:'id-conflict',message:'Capture event ID already belongs to different saved content; the inbox was not changed.'};return{ok:true,value:existing,duplicate:true}}
 if(loaded.state.events.length>=CAPTURE_INBOX_LIMIT)return{ok:false,code:'queue-full',message:`Capture inbox is full (${CAPTURE_INBOX_LIMIT} events). The saved resource was not queued for automation.`};
 const value={...event,capturedAt:new Date(event.capturedAt).toISOString()};const saved=persist(storage,{version:1,events:[...loaded.state.events,value]},key);if(!saved.ok)return saved;
 options.notify?.({eventId:value.eventId});return{ok:true,value};
}
export function pendingCaptureEvents(storage:AutomationStorage,key=CAPTURE_INBOX_STORAGE_KEY):CaptureInboxResult<CaptureInboxEvent[]>{const loaded=loadCaptureInbox(storage,key);return loaded.ok?{ok:true,value:loaded.state.events.filter(event=>event.status==='pending')}:loaded}
export function getCaptureEvent(storage:AutomationStorage,eventId:string,key=CAPTURE_INBOX_STORAGE_KEY):CaptureInboxResult<CaptureInboxEvent|null>{const loaded=loadCaptureInbox(storage,key);return loaded.ok?{ok:true,value:loaded.state.events.find(event=>event.eventId===eventId)??null}:loaded}
/** ACK is terminal and idempotent, but only after every applicable rule has a durable success receipt. */
export function acknowledgeCaptureEvent(storage:AutomationStorage,eventId:string,receipts:AutomationReceipt[],options:{key?:string;now?:Date}={}):CaptureInboxResult<CaptureInboxEvent>{
 const key=options.key??CAPTURE_INBOX_STORAGE_KEY,loaded=loadCaptureInbox(storage,key);if(!loaded.ok)return loaded;
 const event=loaded.state.events.find(item=>item.eventId===eventId);if(!event)return{ok:false,code:'invalid-event',message:'Capture event is no longer in the inbox.'};if(event.status==='acknowledged')return{ok:true,value:event,duplicate:true};
 const occurrenceKey=`capture-event:${eventId}`;if(!receipts.length||receipts.some(receipt=>receipt.status!=='succeeded'||receipt.occurrenceKey!==occurrenceKey))return{ok:false,code:'invalid-event',message:'Only successful receipts for this exact capture event can acknowledge it.'};
 const now=options.now??new Date(),acknowledged:CaptureInboxEvent={...event,status:'acknowledged',acknowledgedAt:now.toISOString(),terminalReceipts:receipts.map(receipt=>({ruleId:receipt.ruleId,...(receipt.operationReceiptId?{receiptId:receipt.operationReceiptId}:{}),updatedAt:receipt.updatedAt}))};
 const state={version:1 as const,events:loaded.state.events.map(item=>item.eventId===eventId?acknowledged:item)},saved=persist(storage,state,key);return saved.ok?{ok:true,value:acknowledged}:saved;
}
