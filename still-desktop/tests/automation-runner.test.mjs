import test from 'node:test';
import assert from 'node:assert/strict';
import { AutomationRunnerController } from '../src/domain/automationRunner.ts';
import { createAutomationRuntime, AUTOMATION_TICK_EVENT } from '../src/platform/automationRuntime.ts';
import { emptyAutomationState, saveAutomationState } from '../src/domain/automationRules.ts';

class MemoryStorage { values=new Map();getItem(key){return this.values.get(key)??null}setItem(key,value){this.values.set(key,value)} }
const catalog={workspaces:[{id:'w',name:'Biology'}],courses:[],layouts:[{id:'layout',name:'Lab',workspaceId:'w'}]};
const layoutRule={version:1,id:'daily',enabled:true,createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z',sourceText:'daily lab',trigger:{kind:'daily',time:'09:00',timeZone:'UTC'},action:{kind:'prepareWorkspaceLayout',workspaceId:'w',layoutId:'layout'}};
const status=(runtimeId,latestSequence)=>({runtimeId,tickIntervalMs:15000,replayCapacity:256,latestSequence,lastTickScheduledAtUnixMs:null,hiddenToTray:true,trayAvailable:true,trayError:null,mainWindowVisible:false,mainWindowMinimized:true});
const tick=(runtimeId,sequence,iso)=>({runtimeId,sequence,scheduledAtUnixMs:Date.parse(iso)});

test('platform runtime adapter calls exact native commands and filters malformed tick events', async()=>{
 const calls=[],listeners=new Map();const bridge={native:true,invoke:async(command,args)=>{calls.push({command,args});if(command==='automation_runtime_status')return status('rid',3);if(command==='automation_ticks_since')return{runtimeId:'rid',requestedAfterSequence:2,oldestAvailableSequence:1,latestSequence:3,ticks:[]};return undefined},listen:async(event,callback)=>{listeners.set(event,callback);return()=>listeners.delete(event)}};
 const runtime=createAutomationRuntime(bridge);assert.equal(runtime.native,true);assert.equal((await runtime.runtimeStatus()).runtimeId,'rid');
 await runtime.ticksSince({runtimeId:'old',sequence:9});await runtime.hideToTray();let seen=[];const unlisten=await runtime.subscribeTicks(value=>seen.push(value));
 listeners.get(AUTOMATION_TICK_EVENT)({runtimeId:'rid',sequence:4,scheduledAtUnixMs:100});listeners.get(AUTOMATION_TICK_EVENT)({runtimeId:'',sequence:-1,scheduledAtUnixMs:NaN});
 assert.deepEqual(seen,[{runtimeId:'rid',sequence:4,scheduledAtUnixMs:100}]);await unlisten();
 assert.deepEqual(calls.map(x=>x.command),['automation_runtime_status','automation_ticks_since','window_minimize_to_tray']);assert.deepEqual(calls[1].args,{runtimeId:'old',sequence:9});assert.equal(listeners.size,0);
});

test('native status replay and tick events drive the runner with no panel mounted or web timer', async()=>{
 const storage=new MemoryStorage();saveAutomationState(storage,{...emptyAutomationState(),rules:[layoutRule]});let listener,intervalCalls=0,calls=0;
 const runtime={native:true,runtimeStatus:async()=>status('runtime-a',2),ticksSince:async cursor=>({runtimeId:'runtime-a',requestedAfterSequence:cursor.sequence,oldestAvailableSequence:1,latestSequence:2,ticks:[tick('runtime-a',1,'2026-11-26T10:00:00Z'),tick('runtime-a',2,'2026-11-27T10:00:00Z')]}),subscribeTicks:async callback=>{listener=callback;return()=>{listener=null}},hideToTray:async()=>{}};
 let snapshot;const runner=new AutomationRunnerController({storage,runtime,getService:()=>({execute:async()=>{calls++;return{status:'succeeded'}}}),setPreviewInterval:()=>{intervalCalls++;return 1},clearPreviewInterval:()=>{},onSnapshot:value=>snapshot=value});
 await runner.start();assert.equal(snapshot.cursor.sequence,2);assert.equal(snapshot.cursor.runtimeId,'runtime-a');assert.equal(calls,2);assert.equal(intervalCalls,0);assert.equal(snapshot.mode,'native-tray-runtime');
 listener(tick('runtime-a',3,'2026-11-28T10:00:00Z'));await new Promise(resolve=>setTimeout(resolve,0));assert.equal(snapshot.cursor.sequence,3);assert.equal(calls,3);runner.stop();
});

test('new runtime IDs request replay from sequence zero after restart', async()=>{
 const storage=new MemoryStorage();storage.setItem('still.automation-runtime-cursor.v1',JSON.stringify({runtimeId:'old-runtime',sequence:255}));saveAutomationState(storage,{...emptyAutomationState(),rules:[layoutRule]});let request;
 const runtime={native:true,runtimeStatus:async()=>status('new-runtime',1),ticksSince:async cursor=>{request=cursor;return{runtimeId:'new-runtime',requestedAfterSequence:0,oldestAvailableSequence:1,latestSequence:1,ticks:[tick('new-runtime',1,'2026-11-26T10:00:00Z')]}},subscribeTicks:async()=>()=>{},hideToTray:async()=>{}};
 const runner=new AutomationRunnerController({storage,runtime,getService:()=>({execute:async()=>({status:'succeeded'})}),onSnapshot:()=>{}});await runner.start();assert.deepEqual(request,{runtimeId:'old-runtime',sequence:255});assert.deepEqual(JSON.parse(storage.getItem('still.automation-runtime-cursor.v1')),{runtimeId:'new-runtime',sequence:1});runner.stop();
});

test('capture queue uses stable business event IDs and failed ACK stays visible without repeating success', async()=>{
 const storage=new MemoryStorage(),captureRule={version:1,id:'capture',enabled:true,createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z',sourceText:'capture lecture',trigger:{kind:'onCapture'},action:{kind:'fileResourcesToCourse',courseId:'course',workspaceId:'w',resourceKinds:['link'],queryPattern:'lecture'}};
 saveAutomationState(storage,{...emptyAutomationState(),rules:[captureRule]});let ackAttempts=0,calls=0;
 const event={eventId:'capture-42@created-at',capturedAt:'2026-11-26T10:00:00Z',resourceKind:'link',name:'lecture video'};
 const queue={listPending:async()=>[event],acknowledge:async()=>{ackAttempts++;if(ackAttempts===1)throw new Error('journal lock')}};
 const runner=new AutomationRunnerController({storage,runtime:{native:false,runtimeStatus:async()=>status('web',0),ticksSince:async()=>({runtimeId:'web',requestedAfterSequence:0,oldestAvailableSequence:null,latestSequence:0,ticks:[]}),subscribeTicks:async()=>()=>{},hideToTray:async()=>{}},getCaptureQueue:()=>queue,getService:()=>({execute:async(action,context)=>{calls++;assert.equal(context.captureEventId,event.eventId);return{status:'succeeded',receiptId:'real-op'}}}),setPreviewInterval:()=>1,clearPreviewInterval:()=>{},onSnapshot:()=>{}});
 await runner.start();assert.equal(runner.getSnapshot().mode,'web-preview-page-open');assert.match(runner.getSnapshot().error,/acknowledged/);assert.equal(runner.getSnapshot().pendingCaptures.length,1);assert.equal(calls,1);
 await runner.runDueNow();assert.equal(ackAttempts,2);assert.equal(calls,1);assert.equal(runner.getSnapshot().pendingCaptures.length,0);runner.stop();
});
