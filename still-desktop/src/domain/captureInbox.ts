import type {AutomationReceipt,AutomationStorage} from './automationRules.ts';

export const CAPTURE_INBOX_STORAGE_KEY='still.automation-capture-inbox.v1';
export const CAPTURE_INBOX_LIMIT=2000;
const ID_RE=/^[A-Za-z0-9][A-Za-z0-9._:@/%-]{0,499}$/;
const SAFE_TEXT=/^[^\u0000-\u001f\u007f]{1,500}$/;

export type CaptureLinkOrigin=
 | {kind:'group';workspaceId:string;groupId:string}
 | {kind:'browser';workspaceId:string;widgetId:string};
export interface LegacyUnknownLinkOrigin {kind:'legacy-unknown';value:string;workspaceId?:string}
interface CaptureEventBase {version:1;eventId:string;capturedAt:string;name:string;status:'pending'|'acknowledged'|'ignored';acknowledgedAt?:string;ignoredAt?:string;ignoredReason?:string;terminalReceipts?:Array<{ruleId:string;receiptId?:string;updatedAt:string}>}
export type CaptureInboxEvent=
 | (CaptureEventBase&{kind:'file';sourceWorkspaceId:string;widgetId:string;resourceId?:string})
 | (CaptureEventBase&{kind:'idea';sourceWorkspaceId:string;widgetId:string;documentId:string})
 | (CaptureEventBase&{kind:'link';origin:CaptureLinkOrigin|LegacyUnknownLinkOrigin;linkId:string;name:string;url?:string});
export type NewCaptureEvent=
 | {eventId?:string;kind:'file';capturedAt:string;name:string;sourceWorkspaceId:string;widgetId:string;resourceId?:string}
 | {eventId?:string;kind:'idea';capturedAt:string;name:string;sourceWorkspaceId:string;widgetId:string;documentId:string}
 | {eventId?:string;kind:'link';capturedAt:string;name:string;origin:CaptureLinkOrigin;linkId:string;url?:string};
export type SavedCaptureResource=
 | {kind:'file';workspaceId:string;widgetId:string;name:string;sourceId:string}
 | {kind:'note';workspaceId:string;widgetId:string;documentId:string;name:string}
 | {kind:'link';origin:CaptureLinkOrigin;linkId:string;name:string;url:string};
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
function checkedOrigin(value:unknown,allowLegacy=false):CaptureLinkOrigin|LegacyUnknownLinkOrigin|null{
 if(!obj(value))return null;
 if(value.kind==='group'&&validId(value.workspaceId)&&validId(value.groupId))return{kind:'group',workspaceId:value.workspaceId,groupId:value.groupId};
 if(value.kind==='browser'&&validId(value.workspaceId)&&validId(value.widgetId))return{kind:'browser',workspaceId:value.workspaceId,widgetId:value.widgetId};
 if(allowLegacy&&value.kind==='legacy-unknown'&&validText(value.value)&&(value.workspaceId===undefined||validId(value.workspaceId)))return{kind:'legacy-unknown',value:value.value,...(typeof value.workspaceId==='string'?{workspaceId:value.workspaceId}:{})};
 return null;
}
function checkedEvent(value:unknown,allowLegacy=false):CaptureInboxEvent|null{
 if(!obj(value)||value.version!==1||!validId(value.eventId)||!validDate(value.capturedAt)||!validText(value.name)||!['pending','acknowledged','ignored'].includes(String(value.status)))return null;
 let normalized=value;
 // Earlier capture inbox records stored a free-form string linkOrigin. Preserve
 // those records, but terminally quarantine them: dispatch must never infer an
 // origin or execute an event without an exact tagged source pointer.
 if(allowLegacy&&value.kind==='link'&&value.origin===undefined&&validText(value.linkOrigin)&&validId(value.linkId))normalized={...value,origin:{kind:'legacy-unknown',value:value.linkOrigin,...(validId(value.sourceWorkspaceId)?{workspaceId:value.sourceWorkspaceId}:{})},status:value.status==='pending'?'ignored':value.status,ignoredAt:value.status==='pending'?new Date(String(value.capturedAt)).toISOString():value.ignoredAt,ignoredReason:value.status==='pending'?'Legacy string link origin is not exact enough for automatic dispatch.':value.ignoredReason};
 if(!validId(normalized.eventId)||!validDate(normalized.capturedAt)||!validText(normalized.name))return null;
 if(normalized.acknowledgedAt!==undefined&&!validDate(normalized.acknowledgedAt)||normalized.ignoredAt!==undefined&&!validDate(normalized.ignoredAt))return null;
 if(normalized.terminalReceipts!==undefined&&(!Array.isArray(normalized.terminalReceipts)||normalized.terminalReceipts.some(item=>!obj(item)||!validId(item.ruleId)||item.receiptId!==undefined&&!validId(item.receiptId)||!validDate(item.updatedAt))))return null;
 if(normalized.status==='acknowledged'&&(!validDate(normalized.acknowledgedAt)||!Array.isArray(normalized.terminalReceipts)||!normalized.terminalReceipts.length)||normalized.status==='ignored'&&(!validDate(normalized.ignoredAt)||!validText(normalized.ignoredReason))||normalized.status==='pending'&&(normalized.acknowledgedAt!==undefined||normalized.ignoredAt!==undefined||normalized.terminalReceipts!==undefined))return null;
 const common={version:1 as const,eventId:normalized.eventId,capturedAt:new Date(String(normalized.capturedAt)).toISOString(),name:String(normalized.name).trim(),status:normalized.status as CaptureInboxEvent['status'],...(typeof normalized.acknowledgedAt==='string'?{acknowledgedAt:new Date(normalized.acknowledgedAt).toISOString()}:{}),...(typeof normalized.ignoredAt==='string'?{ignoredAt:new Date(normalized.ignoredAt).toISOString()}:{}),...(typeof normalized.ignoredReason==='string'?{ignoredReason:normalized.ignoredReason.slice(0,500)}:{}),...(Array.isArray(normalized.terminalReceipts)?{terminalReceipts:normalized.terminalReceipts as CaptureInboxEvent['terminalReceipts']}: {})};
 if(normalized.kind==='file'&&validId(normalized.sourceWorkspaceId)&&validId(normalized.widgetId)&&(normalized.resourceId===undefined||validId(normalized.resourceId)))return{...common,kind:'file',sourceWorkspaceId:normalized.sourceWorkspaceId,widgetId:normalized.widgetId,...(typeof normalized.resourceId==='string'?{resourceId:normalized.resourceId}:{})};
 if(normalized.kind==='idea'&&validId(normalized.sourceWorkspaceId)&&validId(normalized.widgetId)&&validId(normalized.documentId))return{...common,kind:'idea',sourceWorkspaceId:normalized.sourceWorkspaceId,widgetId:normalized.widgetId,documentId:normalized.documentId};
 if(normalized.kind==='link'&&validId(normalized.linkId)&&(normalized.url===undefined||validUrl(normalized.url))){const origin=checkedOrigin(normalized.origin,allowLegacy);if(origin)return{...common,kind:'link',origin,linkId:normalized.linkId,...(typeof normalized.url==='string'?{url:normalized.url}:{})}}
 return null;
}
export function emptyCaptureInbox():CaptureInboxState{return{version:1,events:[]}}
/** Invalid/future data is left intact so no append/ack silently destroys the journal. */
export function loadCaptureInbox(storage:AutomationStorage,key=CAPTURE_INBOX_STORAGE_KEY):CaptureInboxLoadResult{
 let raw:string|null;try{raw=storage.getItem(key)}catch(error){return{ok:false,code:'storage',message:`Capture inbox could not be read: ${error instanceof Error?error.message:String(error)}`}}
 if(raw===null)return{ok:true,state:emptyCaptureInbox()};
 try{const parsed:unknown=JSON.parse(raw);if(!obj(parsed)||!Number.isInteger(parsed.version))return{ok:false,code:'corrupt',message:'Capture inbox is malformed and was preserved.'};if(parsed.version!==1)return{ok:false,code:'unsupported-version',message:'Capture inbox has a newer or unsupported version and was preserved.'};if(!Array.isArray(parsed.events)||parsed.events.length>CAPTURE_INBOX_LIMIT)return{ok:false,code:'corrupt',message:'Capture inbox event list is invalid and was preserved.'};const events=parsed.events.map(item=>checkedEvent(item,true));if(events.some(event=>!event)||new Set((events as CaptureInboxEvent[]).map(event=>event.eventId)).size!==events.length)return{ok:false,code:'corrupt',message:'Capture inbox failed validation and was preserved.'};return{ok:true,state:{version:1,events:events as CaptureInboxEvent[]}}}catch{return{ok:false,code:'corrupt',message:'Capture inbox could not be parsed and was preserved.'}}
}
export function captureEventIdFor(input:NewCaptureEvent):string{
 if(input.eventId)return input.eventId;
 if(input.kind==='link')return`link:${input.origin.kind}:${input.origin.kind==='group'?input.origin.groupId:input.origin.widgetId}:${input.linkId}`;
 if(input.kind==='idea')return`idea:${input.sourceWorkspaceId}:${input.widgetId}:${input.documentId}`;
 return`file:${input.sourceWorkspaceId}:${input.widgetId}:${input.resourceId??'capture'}`;
}
/** Adapt the successful Library/PDF save callback into the journal's exact locator shape. */
export function captureEventFromSavedResource(captureId:string,capturedAt:string,resource:SavedCaptureResource):NewCaptureEvent{
 if(resource.kind==='link')return{eventId:captureId,kind:'link',capturedAt,name:resource.name,origin:resource.origin,linkId:resource.linkId,url:resource.url};
 if(resource.kind==='note')return{eventId:captureId,kind:'idea',capturedAt,name:resource.name,sourceWorkspaceId:resource.workspaceId,widgetId:resource.widgetId,documentId:resource.documentId};
 return{eventId:captureId,kind:'file',capturedAt,name:resource.name,sourceWorkspaceId:resource.workspaceId,widgetId:resource.widgetId,resourceId:resource.sourceId};
}
function validateNewCapture(input:NewCaptureEvent):CaptureInboxEvent|null{return checkedEvent({...input,eventId:captureEventIdFor(input),version:1,status:'pending'})}
function sameIdentity(a:CaptureInboxEvent,b:CaptureInboxEvent):boolean{
 if(a.kind!==b.kind||a.eventId!==b.eventId||a.name!==b.name)return false;
 if(a.kind==='file'&&b.kind==='file')return a.sourceWorkspaceId===b.sourceWorkspaceId&&a.widgetId===b.widgetId&&a.resourceId===b.resourceId;
 if(a.kind==='idea'&&b.kind==='idea')return a.sourceWorkspaceId===b.sourceWorkspaceId&&a.widgetId===b.widgetId&&a.documentId===b.documentId;
 if(a.kind==='link'&&b.kind==='link'&&a.origin.kind!=='legacy-unknown'&&b.origin.kind!=='legacy-unknown')return JSON.stringify(a.origin)===JSON.stringify(b.origin)&&a.linkId===b.linkId&&a.url===b.url;
 return false;
}
function persist(storage:AutomationStorage,state:CaptureInboxState,key:string):CaptureInboxResult<CaptureInboxState>{try{storage.setItem(key,JSON.stringify(state));return{ok:true,value:state}}catch(error){return{ok:false,code:'storage',message:`Capture inbox could not be saved: ${error instanceof Error?error.message:String(error)}`}}}
/** Call only after the caller's actual link/file/idea save has completed successfully. */
export function appendSavedCapture(storage:AutomationStorage,input:NewCaptureEvent,options:{key?:string;notify?:(event:CaptureInboxEventNotification)=>void}={}):CaptureInboxResult<CaptureInboxEvent>{
 const key=options.key??CAPTURE_INBOX_STORAGE_KEY,loaded=loadCaptureInbox(storage,key);if(!loaded.ok)return loaded;
 const event=validateNewCapture(input);if(!event)return{ok:false,code:'invalid-event',message:'Capture event is missing a stable ID or exact source reference.'};
 const existing=loaded.state.events.find(item=>item.eventId===event.eventId);if(existing){if(!sameIdentity(existing,event))return{ok:false,code:'id-conflict',message:'Capture event ID already belongs to different saved content; the inbox was not changed.'};return{ok:true,value:existing,duplicate:true}}
 let events=[...loaded.state.events];while(events.length>=CAPTURE_INBOX_LIMIT){const terminalIndex=events.findIndex(item=>item.status!=='pending');if(terminalIndex<0)return{ok:false,code:'queue-full',message:`Capture inbox is full (${CAPTURE_INBOX_LIMIT} pending events). The saved resource was not queued for automation.`};events.splice(terminalIndex,1)}
 const value={...event,capturedAt:new Date(event.capturedAt).toISOString()};const saved=persist(storage,{version:1,events:[...events,value]},key);if(!saved.ok)return saved;
 options.notify?.({eventId:value.eventId});return{ok:true,value};
}
export function pendingCaptureEvents(storage:AutomationStorage,key=CAPTURE_INBOX_STORAGE_KEY):CaptureInboxResult<CaptureInboxEvent[]>{const loaded=loadCaptureInbox(storage,key);return loaded.ok?{ok:true,value:loaded.state.events.filter(event=>event.status==='pending')}:loaded}
export function ignoredCaptureEvents(storage:AutomationStorage,key=CAPTURE_INBOX_STORAGE_KEY):CaptureInboxResult<CaptureInboxEvent[]>{const loaded=loadCaptureInbox(storage,key);return loaded.ok?{ok:true,value:loaded.state.events.filter(event=>event.status==='ignored')}:loaded}
export function getCaptureEvent(storage:AutomationStorage,eventId:string,key=CAPTURE_INBOX_STORAGE_KEY):CaptureInboxResult<CaptureInboxEvent|null>{const loaded=loadCaptureInbox(storage,key);return loaded.ok?{ok:true,value:loaded.state.events.find(event=>event.eventId===eventId)??null}:loaded}
export function ignoreCaptureEvent(storage:AutomationStorage,eventId:string,reason:string,options:{key?:string;now?:Date}={}):CaptureInboxResult<CaptureInboxEvent>{
 const key=options.key??CAPTURE_INBOX_STORAGE_KEY,loaded=loadCaptureInbox(storage,key);if(!loaded.ok)return loaded;const event=loaded.state.events.find(item=>item.eventId===eventId);if(!event)return{ok:false,code:'invalid-event',message:'Capture event is no longer in the inbox.'};if(event.status!=='pending')return{ok:true,value:event,duplicate:true};if(!validText(reason))return{ok:false,code:'invalid-event',message:'An ignored capture needs a visible reason.'};const ignored:CaptureInboxEvent={...event,status:'ignored',ignoredAt:(options.now??new Date()).toISOString(),ignoredReason:reason.trim()};const state={version:1 as const,events:loaded.state.events.map(item=>item.eventId===eventId?ignored:item)},saved=persist(storage,state,key);return saved.ok?{ok:true,value:ignored}:saved;
}
/** ACK is terminal and idempotent, but only after every applicable rule has a durable success receipt. */
export function acknowledgeCaptureEvent(storage:AutomationStorage,eventId:string,receipts:AutomationReceipt[],options:{key?:string;now?:Date}={}):CaptureInboxResult<CaptureInboxEvent>{
 const key=options.key??CAPTURE_INBOX_STORAGE_KEY,loaded=loadCaptureInbox(storage,key);if(!loaded.ok)return loaded;
 const event=loaded.state.events.find(item=>item.eventId===eventId);if(!event)return{ok:false,code:'invalid-event',message:'Capture event is no longer in the inbox.'};if(event.status==='acknowledged'||event.status==='ignored')return{ok:true,value:event,duplicate:true};
 const occurrenceKey=`capture-event:${eventId}`;if(!receipts.length||receipts.some(receipt=>receipt.status!=='succeeded'||receipt.occurrenceKey!==occurrenceKey))return{ok:false,code:'invalid-event',message:'Only successful receipts for this exact capture event can acknowledge it.'};
 const now=options.now??new Date(),acknowledged:CaptureInboxEvent={...event,status:'acknowledged',acknowledgedAt:now.toISOString(),terminalReceipts:receipts.map(receipt=>({ruleId:receipt.ruleId,...(receipt.operationReceiptId?{receiptId:receipt.operationReceiptId}:{}),updatedAt:receipt.updatedAt}))};
 const state={version:1 as const,events:loaded.state.events.map(item=>item.eventId===eventId?acknowledged:item)},saved=persist(storage,state,key);return saved.ok?{ok:true,value:acknowledged}:saved;
}
