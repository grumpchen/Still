import test from 'node:test';
import assert from 'node:assert/strict';
import { CAPTURE_INBOX_EVENT,CAPTURE_INBOX_LIMIT,CAPTURE_INBOX_STORAGE_KEY,acknowledgeCaptureEvent,appendSavedCapture,captureEventFromSavedResource,getCaptureEvent,loadCaptureInbox,pendingCaptureEvents } from '../src/domain/captureInbox.ts';
import { createAutomationCaptureInbox } from '../src/platform/automationCaptureInbox.ts';
class MemoryStorage{values=new Map();getItem(key){return this.values.get(key)??null}setItem(key,value){this.values.set(key,value)}}
const receipt=(eventId,ruleId='rule',status='succeeded')=>({version:1,ruleId,occurrenceKey:`capture-event:${eventId}`,scheduledAt:'2026-11-26T00:00:00.000Z',status,attempts:1,startedAt:'2026-11-26T00:00:00.000Z',updatedAt:'2026-11-26T00:00:01.000Z',operationReceiptId:`op-${ruleId}`});

test('saved link, PDF, and note records retain exact origin/workspace/widget/resource references',()=>{
 const storage=new MemoryStorage();
 const link=appendSavedCapture(storage,captureEventFromSavedResource('capture-link-1','2026-11-26T10:00:00Z',{kind:'link',origin:'group',linkId:'link-7',name:'Lecture video',url:'https://example.test/lecture'}));
 const file=appendSavedCapture(storage,captureEventFromSavedResource('capture-file-1','2026-11-26T10:01:00Z',{kind:'file',workspaceId:'workspace-a',widgetId:'files-widget-3',sourceId:'source-9',name:'paper.pdf'}));
 const idea=appendSavedCapture(storage,captureEventFromSavedResource('capture-note-1','2026-11-26T10:02:00Z',{kind:'note',workspaceId:'workspace-a',widgetId:'notes-widget-2',documentId:'note-6',name:'Study question'}));
 assert.equal(link.ok,true);assert.deepEqual({kind:link.value.kind,origin:link.value.linkOrigin,id:link.value.linkId,url:link.value.url},{kind:'link',origin:'group',id:'link-7',url:'https://example.test/lecture'});
 assert.equal(file.value.eventId,'capture-file-1');assert.deepEqual([file.value.kind,file.value.sourceWorkspaceId,file.value.widgetId,file.value.resourceId],['file','workspace-a','files-widget-3','source-9']);
 assert.deepEqual([idea.value.kind,idea.value.sourceWorkspaceId,idea.value.widgetId,idea.value.documentId],['idea','workspace-a','notes-widget-2','note-6']);
 assert.equal(pendingCaptureEvents(storage).value.length,3);assert.equal(getCaptureEvent(storage,'capture-note-1').value.eventId,'capture-note-1');
});

test('stable captureId append is idempotent across inbox instances and callback retry',()=>{
 const storage=new MemoryStorage(),resource={kind:'file',workspaceId:'w',widgetId:'files-1',sourceId:'source-1',name:'handout.pdf'};
 const first=appendSavedCapture(storage,captureEventFromSavedResource('capture-retry','2026-11-26T10:00:00Z',resource));
 const restarted=appendSavedCapture(storage,captureEventFromSavedResource('capture-retry','2026-11-26T10:01:00Z',resource));
 assert.equal(first.ok,true);assert.equal(restarted.duplicate,true);assert.equal(restarted.value.capturedAt,first.value.capturedAt);assert.equal(loadCaptureInbox(storage).state.events.length,1);
 const collision=appendSavedCapture(storage,captureEventFromSavedResource('capture-retry','2026-11-26T10:01:00Z',{...resource,sourceId:'different-source'}));assert.equal(collision.ok,false);assert.equal(collision.code,'id-conflict');assert.equal(loadCaptureInbox(storage).state.events.length,1);
});

test('only successful receipts for the exact event can terminally ACK; pending remains on failures and ACK persistence errors',()=>{
 const storage=new MemoryStorage(),added=appendSavedCapture(storage,{eventId:'link-capture',kind:'link',capturedAt:'2026-11-26T10:00:00Z',name:'Course link',linkOrigin:'browser',linkId:'saved-link-1',url:'https://example.test'});assert.equal(added.ok,true);
 assert.equal(acknowledgeCaptureEvent(storage,'link-capture',[receipt('link-capture','r1','outcome_unknown')]).ok,false);assert.equal(pendingCaptureEvents(storage).value.length,1);
 assert.equal(acknowledgeCaptureEvent(storage,'link-capture',[{...receipt('link-capture'),occurrenceKey:'capture-event:other'}]).ok,false);assert.equal(pendingCaptureEvents(storage).value.length,1);
 const ack=acknowledgeCaptureEvent(storage,'link-capture',[receipt('link-capture','r1'),receipt('link-capture','r2')],{now:new Date('2026-11-26T10:05:00Z')});assert.equal(ack.ok,true);assert.equal(pendingCaptureEvents(storage).value.length,0);assert.equal(getCaptureEvent(storage,'link-capture').value.status,'acknowledged');
 const duplicate=acknowledgeCaptureEvent(storage,'link-capture',[]);assert.equal(duplicate.duplicate,true);
 const pendingStorage=new MemoryStorage();appendSavedCapture(pendingStorage,{eventId:'pending-fail',kind:'link',capturedAt:'2026-11-26T10:00:00Z',name:'pending',linkOrigin:'browser',linkId:'link-pending'});const failing={getItem:key=>pendingStorage.getItem(key),setItem(){throw new Error('storage denied')}};const ackFailure=acknowledgeCaptureEvent(failing,'pending-fail',[receipt('pending-fail')]);assert.equal(ackFailure.ok,false);assert.equal(ackFailure.code,'storage');assert.equal(pendingCaptureEvents(pendingStorage).value.length,1);
});

test('corrupt/future inbox data is preserved and capacity overflow is explicit',()=>{
 const storage=new MemoryStorage();storage.setItem(CAPTURE_INBOX_STORAGE_KEY,'{broken');const corrupt=appendSavedCapture(storage,{eventId:'e1',kind:'file',capturedAt:'2026-11-26T00:00:00Z',name:'a.pdf',sourceWorkspaceId:'w',widgetId:'f'});assert.equal(corrupt.code,'corrupt');assert.equal(storage.getItem(CAPTURE_INBOX_STORAGE_KEY),'{broken');
 const full=new MemoryStorage(),events=[];for(let index=0;index<CAPTURE_INBOX_LIMIT;index++)events.push({version:1,eventId:`capture-${index}`,kind:'file',capturedAt:'2026-11-26T00:00:00.000Z',name:'item.pdf',status:'pending',sourceWorkspaceId:'w',widgetId:`widget-${index}`});full.setItem(CAPTURE_INBOX_STORAGE_KEY,JSON.stringify({version:1,events}));const overflow=appendSavedCapture(full,{eventId:'overflow',kind:'file',capturedAt:'2026-11-26T00:00:00Z',name:'overflow.pdf',sourceWorkspaceId:'w',widgetId:'overflow'});assert.equal(overflow.ok,false);assert.equal(overflow.code,'queue-full');assert.equal(loadCaptureInbox(full).state.events.length,CAPTURE_INBOX_LIMIT);
});

test('platform inbox notifies same-window runner only after durable append',async()=>{
 const storage=new MemoryStorage(),target=new EventTarget(),queue=createAutomationCaptureInbox(storage,target),notifications=[];const unsubscribe=queue.subscribe(eventId=>notifications.push(eventId));
 const added=queue.recordSavedCapture('stable-attempt',{kind:'note',workspaceId:'w',widgetId:'notes-1',documentId:'doc-1',name:'Idea'});
 assert.equal(added.ok,true);assert.deepEqual(notifications,['stable-attempt']);assert.equal(queue.listPending instanceof Function,true);assert.equal((await queue.listPending())[0].eventId,'stable-attempt');
 unsubscribe();target.dispatchEvent(new CustomEvent(CAPTURE_INBOX_EVENT,{detail:{eventId:'ignored'}}));assert.deepEqual(notifications,['stable-attempt']);
 const failingStorage={getItem:()=>null,setItem(){throw new Error('quota')}};const failingQueue=createAutomationCaptureInbox(failingStorage,target);const failed=failingQueue.recordSavedCapture('not-stored',{kind:'file',workspaceId:'w',widgetId:'f',sourceId:'s',name:'not-stored.pdf'});assert.equal(failed.ok,false);assert.deepEqual(notifications,['stable-attempt']);
});
