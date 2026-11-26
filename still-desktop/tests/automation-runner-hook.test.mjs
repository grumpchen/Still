import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost'});
globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.HTMLElement=dom.window.HTMLElement;globalThis.MutationObserver=dom.window.MutationObserver;globalThis.requestAnimationFrame=callback=>setTimeout(callback,0);globalThis.cancelAnimationFrame=clearTimeout;Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=await import('react');const {createRoot}=await import('react-dom/client');const {useAutomationRunner}=await import('../src/useAutomationRunner.ts');const {loadAutomationState,saveAutomationState,emptyAutomationState}=await import('../src/domain/automationRules.ts');
class MemoryStorage{values=new Map();getItem(k){return this.values.get(k)??null}setItem(k,v){this.values.set(k,v)}}
const catalog={workspaces:[{id:'w',name:'Biology'}],courses:[],layouts:[{id:'l',name:'Lab',workspaceId:'elsewhere'}]};
const quietRuntime={native:true,runtimeStatus:async()=>({runtimeId:'r',tickIntervalMs:15000,replayCapacity:256,latestSequence:0,lastTickScheduledAtUnixMs:null,hiddenToTray:true,trayAvailable:true,trayError:null,mainWindowVisible:false,mainWindowMinimized:true}),ticksSince:async cursor=>({runtimeId:'r',requestedAfterSequence:cursor.sequence,oldestAvailableSequence:null,latestSequence:0,ticks:[]}),subscribeTicks:async()=>()=>{},hideToTray:async()=>{}};

test('root-mounted hook exposes createFromText and preserves storage on write failure',async()=>{
 const storage=new MemoryStorage();let api;function Probe(){api=useAutomationRunner({storage,getCatalog:()=>catalog,getService:()=>({execute:async()=>({status:'succeeded'})}),runtime:quietRuntime,timeZone:'Pacific/Auckland'});return React.createElement('div')}
 const root=createRoot(document.createElement('div'));
 await React.act(async()=>{root.render(React.createElement(Probe))});
 await React.act(async()=>{});
 const text='Every day at 09:00 prepare Biology workspace using Lab layout';
 const needsMode=await React.act(async()=>api.createFromText(text));assert.equal(needsMode.kind,'clarification');assert.equal(needsMode.code,'layout-mode-required');
 const created=await React.act(async()=>api.createFromText(text,'replace'));
 assert.equal(created.kind,'rule');assert.equal(created.rule.action.layoutId,'l');assert.equal(created.rule.action.mode,'replace');assert.equal(created.rule.trigger.timeZone,'Pacific/Auckland');assert.equal(created.rule.sourceText,text);assert.equal(loadAutomationState(storage).state.rules.length,1);
 const before=storage.getItem('still.automation-rules.v1');storage.setItem=()=>{throw new Error('disk full')};
 const failed=await React.act(async()=>api.createFromText('Every day at 10:00 prepare Biology workspace using Lab layout with append'));
 assert.equal(failed.kind,'error');assert.match(failed.message,/disk full/);assert.equal(storage.getItem('still.automation-rules.v1'),before);
 await React.act(async()=>root.unmount());
});

test('hook starts the native runner independently of an AutomationPanel instance',async()=>{
 const storage=new MemoryStorage();let api,calls=0;saveAutomationState(storage,{...emptyAutomationState(),rules:[{version:2,id:'due',enabled:true,createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z',sourceText:'prepare lab',trigger:{kind:'daily',time:'09:00',timeZone:'UTC'},action:{kind:'prepareWorkspaceLayout',workspaceId:'w',layoutId:'l',mode:'append'}}]});
 const runtime={...quietRuntime,runtimeStatus:async()=>({...await quietRuntime.runtimeStatus(),latestSequence:1}),ticksSince:async cursor=>({runtimeId:'r',requestedAfterSequence:cursor.sequence,oldestAvailableSequence:1,latestSequence:1,ticks:[{runtimeId:'r',sequence:1,scheduledAtUnixMs:Date.parse('2026-11-26T10:00:00Z')} ]})};
 function Probe(){api=useAutomationRunner({storage,getCatalog:()=>catalog,getService:()=>({execute:async()=>{calls++;return{status:'succeeded'}}}),runtime});return React.createElement('div')}
 const root=createRoot(document.createElement('div'));
 await React.act(async()=>{root.render(React.createElement(Probe))});await React.act(async()=>{});
 assert.equal(calls,1);assert.equal(api.mode,'native-tray-runtime');assert.equal(api.cursor.sequence,1);
 await React.act(async()=>root.unmount());
});

test('choosing a legacy rule mode migrates once and restores only its previously-enabled state',async()=>{
 const storage=new MemoryStorage();storage.setItem('still.automation-rules.v1',JSON.stringify({version:1,rules:[{version:1,id:'legacy-layout',enabled:true,createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z',sourceText:'old',trigger:{kind:'once',at:'2026-11-26T12:00:00.000Z'},action:{kind:'prepareWorkspaceLayout',workspaceId:'w',layoutId:'l'}}],receipts:[]}));let api;
 function Probe(){api=useAutomationRunner({storage,getCatalog:()=>catalog,getService:()=>({execute:async()=>({status:'succeeded'})}),runtime:quietRuntime});return React.createElement('div')}
 const root=createRoot(document.createElement('div'));await React.act(async()=>{root.render(React.createElement(Probe))});await React.act(async()=>{});
 assert.equal(api.state.rules[0].enabled,false);assert.equal(api.state.rules[0].requiresModeChoice,true);
 await React.act(async()=>api.setLayoutMode('legacy-layout','append'));
 const migrated=loadAutomationState(storage).state.rules[0];assert.equal(migrated.action.mode,'append');assert.equal(migrated.requiresModeChoice,undefined);assert.equal(migrated.enabled,true);
 await React.act(async()=>root.unmount());
});


test('creating the same enabled rule twice returns the existing rule without a second ID',async()=>{
 const storage=new MemoryStorage();let api;function Probe(){api=useAutomationRunner({storage,getCatalog:()=>catalog,getService:()=>({execute:async()=>({status:'succeeded'})}),runtime:quietRuntime,timeZone:'Pacific/Auckland'});return React.createElement('div')}
 const root=createRoot(document.createElement('div'));await React.act(async()=>{root.render(React.createElement(Probe))});await React.act(async()=>{});const text='Every day at 09:00 prepare Biology workspace using Lab layout with append';
 const first=await React.act(async()=>api.createFromText(text));const second=await React.act(async()=>api.createFromText(text));assert.equal(first.kind,'rule');assert.equal(second.kind,'rule');assert.equal(second.rule.id,first.rule.id);assert.equal(loadAutomationState(storage).state.rules.length,1);assert.equal(first.rule.trigger.timeZone,'Pacific/Auckland');
 await React.act(async()=>root.unmount());
});

test('a terminal successful once rule deduplicates even after its receipt is pruned',async()=>{
 const storage=new MemoryStorage();let api;const text='At 2026-11-27 09:00 prepare Biology workspace using Lab layout with append';function Probe(){api=useAutomationRunner({storage,getCatalog:()=>catalog,getService:()=>({execute:async()=>({status:'succeeded'})}),runtime:quietRuntime,timeZone:'Pacific/Auckland'});return React.createElement('div')}
 const root=createRoot(document.createElement('div'));await React.act(async()=>{root.render(React.createElement(Probe))});await React.act(async()=>{});const first=await React.act(async()=>api.createFromText(text));assert.equal(first.kind,'rule');const completed={...first.rule,enabled:false,onceTerminal:{at:first.rule.trigger.at,status:'succeeded'}};saveAutomationState(storage,{version:2,rules:[completed],receipts:[]});
 const repeated=await React.act(async()=>api.createFromText(text));assert.equal(repeated.kind,'rule');assert.equal(repeated.rule.id,first.rule.id);assert.equal(loadAutomationState(storage).state.rules.length,1);await React.act(async()=>root.unmount());
});
