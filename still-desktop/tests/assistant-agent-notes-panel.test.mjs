import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createElement,act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {mockIPC as installMockIPC,clearMocks} from '@tauri-apps/api/mocks';
import {createServer} from 'vite';
import {createWidget,createWorkspace} from '../src/domain/workspaces.ts';

const vite=await createServer({server:{middlewareMode:true,hmr:false,watch:{ignored:['**/src-tauri/**']}},appType:'custom',optimizeDeps:{noDiscovery:true,entries:[]}});
after(()=>vite.close());
function mockIPC(handle,options){installMockIPC((command,args)=>{
 if(command==='assistant_journal_list')return [];
 if(command==='assistant_journal_start')return `fixture-${args.input.sequence}`;
 if(command==='assistant_journal_plan'||command==='assistant_journal_finish')return null;
 return handle(command,args);
},options)}
function setGlobal(key,value){Object.defineProperty(globalThis,key,{configurable:true,writable:true,value})}
function setReactValue(node,value,elementType){Object.getOwnPropertyDescriptor(node.ownerDocument.defaultView[elementType].prototype,'value').set.call(node,value);const props=node[Object.keys(node).find(key=>key.startsWith('__reactProps$'))];props?.onChange?.({target:node,currentTarget:node})}
async function waitFor(predicate){const deadline=Date.now()+5000;while(Date.now()<deadline){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,10))}assert.ok(predicate(),`Timed out waiting for assistant UI; error: ${globalThis.document?.querySelector('.assistant-error')?.textContent??'none'}`)}

test('ChatGPT plan asks for missing timer details and starts the requested Focus timer',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true}),{window}=dom;
 const globals={window,document:window.document,navigator:window.navigator,localStorage:window.localStorage,HTMLElement:window.HTMLElement,Element:window.Element,Node:window.Node,MutationObserver:window.MutationObserver,IS_REACT_ACT_ENVIRONMENT:true,isTauri:true};
 const old=Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]);
 const calls=[],executions=[],newTimers=[];
 let root;
 try{
  for(const [key,value] of Object.entries(globals))setGlobal(key,value);
  window.HTMLElement.prototype.scrollTo=function(){};
  window.HTMLTextAreaElement.prototype.focus=function(){};
  window.__TAURI_INTERNALS__={};
  window.localStorage.setItem('still-assistant-model','chatgpt::gpt-test');
  mockIPC(command=>{
   calls.push(command);
   if(command==='chatgpt_plan_status')return {connected:true,email:null};
   if(command==='chatgpt_plan_models')return [{slug:'gpt-test',display_name:'Test model'}];
   return null;
  },{shouldMockEvents:true});
  const {default:AssistantPanel}=await vite.ssrLoadModule('/src/AssistantPanel.tsx');
  const workspace=createWorkspace('Daily',[]),focus=createWidget('focus'),note=createWidget('notes');
  note.clockPluginEnabled=true;
  workspace.widgets=[focus,note];
  root=createRoot(window.document.querySelector('#root'));
  await act(async()=>root.render(createElement(AssistantPanel,{workspace,workspaces:[workspace],trayItems:[],sidebarPlugins:[],open:true,close(){},dimensions:()=>({width:900,height:700}),apply(){},undo(){},act:async(...args)=>{executions.push(args);return 'Started a 1 minute timer on Focus 1.'},startTimer:async(...args)=>{newTimers.push(args);return 'Added a Focus widget and started a timer.'}})));
  await waitFor(()=>window.document.querySelector('#ai-model option[value="chatgpt::gpt-test"]'));
  const send=async input=>{
   await act(async()=>setReactValue(window.document.querySelector('#ai-message'),input,'HTMLTextAreaElement'));
   await act(async()=>window.document.querySelector('.assistant-compose').requestSubmit());
  };
  await send('set a timer for 1 min');
  assert.match(window.document.querySelector('.assistant-message.model').textContent,/Which timer should I start/);
  assert.equal(executions.length,0);
  await send('the focus');
  assert.deepEqual(executions,[[workspace.id,[{type:'set_timer',ids:[focus.id],seconds:60}],'set a timer for 1 min',[focus.id]]]);
  assert.match(window.document.querySelector('.assistant-message.model:last-child').textContent,/Started a 1 minute timer/);
  await send('start a 2 minute Focus timer');
  assert.deepEqual(executions.at(-1),[workspace.id,[{type:'set_timer',ids:[focus.id],seconds:120}],'start a 2 minute Focus timer',[]]);
  await send('start the Focus 10 timer for 1 min');
  assert.equal(executions.length,2);
  assert.match(window.document.querySelector('.assistant-message.model:last-child').textContent,/find the requested timer/);
  await send('make a timer');
  assert.match(window.document.querySelector('.assistant-message.model:last-child').textContent,/How long should the timer run/);
  assert.equal(executions.length,2);
  await send('1 min');
  assert.match(window.document.querySelector('.assistant-message.model:last-child').textContent,/Which timer should I start/);
  await send('the focus');
  assert.deepEqual(executions.at(-1),[workspace.id,[{type:'set_timer',ids:[focus.id],seconds:60}],'make a timer for 60 seconds',[focus.id]]);
  workspace.widgets=[];
  await send('can you setup timer now');
  assert.match(window.document.querySelector('.assistant-message.model:last-child').textContent,/How long should the timer run/);
  assert.equal(newTimers.length,0);
  await send('one minute please');
  assert.deepEqual(newTimers,[[workspace.id,60]]);
  assert.equal(calls.includes('chatgpt_plan_agent_turn'),false);
 }finally{
  if(root)await act(async()=>root.unmount());clearMocks();dom.window.close();
  for(const [key,descriptor] of old){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}
 }
});

test('Notes proposal works with the default screenshot preference and requires Still review',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true}),{window}=dom,old=new Map();
 for(const key of ['window','document','navigator','localStorage','HTMLElement','Element','Node','MutationObserver','requestAnimationFrame','cancelAnimationFrame','IS_REACT_ACT_ENVIRONMENT','isTauri'])old.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
 const calls=[];let root,executions=0;
 try{
  for(const [key,value] of Object.entries({window,document:window.document,navigator:window.navigator,localStorage:window.localStorage,HTMLElement:window.HTMLElement,Element:window.Element,Node:window.Node,MutationObserver:window.MutationObserver,requestAnimationFrame:callback=>setTimeout(()=>callback(Date.now()),0),cancelAnimationFrame:clearTimeout,IS_REACT_ACT_ENVIRONMENT:true,isTauri:true}))setGlobal(key,value);
  window.HTMLElement.prototype.scrollTo=function(){};window.HTMLTextAreaElement.prototype.focus=function(){};window.__TAURI_INTERNALS__={};
  window.localStorage.setItem('still-assistant-model','openai::gpt-test');
  mockIPC((command,args)=>{
   calls.push({command,args});
   if(command==='assistant_configured')return true;
   if(command==='assistant_models')return ['gpt-test'];
   if(command!=='assistant_agent_turn')return null;
   const request=args.request;assert.equal(request.enable_add_widget_tool,true);
   if(calls.filter(call=>call.command==='assistant_agent_turn').length===1)return {kind:'tool_calls',assistantMessage:{role:'assistant',tool_calls:[{id:'inspect-1',type:'function',function:{name:'inspect_workspace',arguments:'{}'}}]},calls:[{id:'inspect-1',name:'inspect_workspace',input:{}}]};
   if(calls.filter(call=>call.command==='assistant_agent_turn').length===2){assert.equal(request.messages.at(-1).role,'tool',JSON.stringify(request.messages));const execution=JSON.parse(request.messages.at(-1).content);assert.equal(execution.status,'succeeded',JSON.stringify(execution));const inspected=execution.result;assert.ok(inspected?.revision,JSON.stringify(execution));return {kind:'tool_calls',assistantMessage:{role:'assistant',tool_calls:[{id:'add-1',type:'function',function:{name:'add_widget',arguments:JSON.stringify({widgetType:'notes',snapshotRevision:inspected.revision})}}]},calls:[{id:'add-1',name:'add_widget',input:{widgetType:'notes',snapshotRevision:inspected.revision}}]}}
   assert.deepEqual(JSON.parse(request.messages.at(-1).content),{status:'succeeded',mutation:'applied',result:{receipt:'Added a Notes widget (Notes 1).'}});
   return {kind:'final',response:{intent:'chat',reply:'Added a Notes widget (Notes 1).',layout:[],actions:[]}};
  },{shouldMockEvents:true});
  const {default:AssistantPanel}=await vite.ssrLoadModule('/src/AssistantPanel.tsx');
  root=createRoot(window.document.querySelector('#root'));
  const workspace=createWorkspace('Study',[]);
  let captures=0;
  await act(async()=>root.render(createElement(AssistantPanel,{workspace,workspaces:[{id:workspace.id,name:workspace.name}],trayItems:[],sidebarPlugins:[],open:true,close(){},dimensions:()=>({width:900,height:700}),apply(){},undo(){},workspaceImage:async()=>{captures++;return undefined},act:async()=>{executions++;return 'Added a Notes widget (Notes 1).'}})));
  await waitFor(()=>window.document.querySelector('#ai-model option[value="openai::gpt-test"]'));
  await act(async()=>window.document.querySelector('[aria-label="AI settings"]').click());
  await act(async()=>window.document.querySelectorAll('.assistant-settings input[type="checkbox"]')[1].click());
  const composer=window.document.querySelector('#ai-message');await act(async()=>setReactValue(composer,'Please add a Notes widget.','HTMLTextAreaElement'));
  await act(async()=>window.document.querySelector('.assistant-compose').requestSubmit());
  await waitFor(()=>window.document.querySelector('[aria-label="Add one widget?"]'));
  assert.equal(executions,0,'model tool call only creates a review proposal');
  assert.equal(captures,0,'agent mode skips automatic workspace capture');
  assert.equal(calls.some(call=>call.command==='assistant_chat'),false,'the agent path does not fall back to ordinary chat');
  await act(async()=>window.document.querySelector('[aria-label="Add one widget?"] button.primary').click());
  await waitFor(()=>executions===1&&calls.filter(call=>call.command==='assistant_agent_turn').length===3);
  await waitFor(()=>[...window.document.querySelectorAll('.assistant-message.model p')].some(node=>node.textContent==='Added a Notes widget (Notes 1).'));
  assert.equal(window.document.querySelector('.assistant-error'),null);
 }finally{
  if(root)await act(async()=>root.unmount());clearMocks();dom.window.close();
  for(const key of old.keys()){const descriptor=old.get(key);if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}
 }
});

test('declined Notes proposal does not execute or apply actions from the resumed model turn',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true}),{window}=dom,old=new Map();
 for(const key of ['window','document','navigator','localStorage','HTMLElement','Element','Node','MutationObserver','requestAnimationFrame','cancelAnimationFrame','IS_REACT_ACT_ENVIRONMENT','isTauri'])old.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
 const calls=[];let root,executions=0;
 try{
  for(const [key,value] of Object.entries({window,document:window.document,navigator:window.navigator,localStorage:window.localStorage,HTMLElement:window.HTMLElement,Element:window.Element,Node:window.Node,MutationObserver:window.MutationObserver,requestAnimationFrame:callback=>setTimeout(()=>callback(Date.now()),0),cancelAnimationFrame:clearTimeout,IS_REACT_ACT_ENVIRONMENT:true,isTauri:true}))setGlobal(key,value);
  window.HTMLElement.prototype.scrollTo=function(){};window.HTMLTextAreaElement.prototype.focus=function(){};window.__TAURI_INTERNALS__={};
  window.localStorage.setItem('still-assistant-share-workspace-image','false');window.localStorage.setItem('still-assistant-model','openai::gpt-test');
  mockIPC((command,args)=>{calls.push({command,args});if(command==='assistant_configured')return true;if(command==='assistant_models')return ['gpt-test'];if(command!=='assistant_agent_turn')return null;const count=calls.filter(call=>call.command==='assistant_agent_turn').length,request=args.request;assert.equal(request.enable_add_widget_tool,true);if(count===1)return {kind:'tool_calls',assistantMessage:{role:'assistant',tool_calls:[{id:'inspect-1',type:'function',function:{name:'inspect_workspace',arguments:'{}'}}]},calls:[{id:'inspect-1',name:'inspect_workspace',input:{}}]};if(count===2){const inspected=JSON.parse(request.messages.at(-1).content).result;return {kind:'tool_calls',assistantMessage:{role:'assistant',tool_calls:[{id:'add-1',type:'function',function:{name:'add_widget',arguments:JSON.stringify({widgetType:'notes',snapshotRevision:inspected.revision})}}]},calls:[{id:'add-1',name:'add_widget',input:{widgetType:'notes',snapshotRevision:inspected.revision}}]}}return {kind:'final',response:{intent:'workspace_action',reply:'I will also remove a widget.',layout:[],actions:[{type:'remove_widget',ids:['widget-that-is-not-present']}]}}},{shouldMockEvents:true});
  const {default:AssistantPanel}=await vite.ssrLoadModule('/src/AssistantPanel.tsx'),workspace=createWorkspace('Study',[]);root=createRoot(window.document.querySelector('#root'));
  await act(async()=>root.render(createElement(AssistantPanel,{workspace,workspaces:[{id:workspace.id,name:workspace.name}],trayItems:[],sidebarPlugins:[],open:true,close(){},dimensions:()=>({width:900,height:700}),apply(){},undo(){},act:async()=>{executions++;return 'Changed.'}})));
  await waitFor(()=>window.document.querySelector('#ai-model option[value="openai::gpt-test"]'));
  await act(async()=>window.document.querySelector('[aria-label="AI settings"]').click());await act(async()=>window.document.querySelectorAll('.assistant-settings input[type="checkbox"]')[1].click());
  const composer=window.document.querySelector('#ai-message');await act(async()=>setReactValue(composer,'Please add a Notes widget.','HTMLTextAreaElement'));await act(async()=>window.document.querySelector('.assistant-compose').requestSubmit());
  await waitFor(()=>window.document.querySelector('[aria-label="Add one widget?"]'));
  await act(async()=>window.document.querySelector('[aria-label="Add one widget?"] button').click());
  await waitFor(()=>calls.filter(call=>call.command==='assistant_agent_turn').length===3);
  await waitFor(()=>/No other suggested changes were applied/.test(window.document.querySelector('.assistant-error')?.textContent??''));
  assert.equal(executions,0,'declining the Notes proposal executes no mutation');
  assert.equal(window.document.querySelector('[aria-label="confirmSuggestedWidgetChanges"]'),null,'resumed model actions are not routed to apply/confirmation after decline');
 }finally{
  if(root)await act(async()=>root.unmount());clearMocks();dom.window.close();
  for(const key of old.keys()){const descriptor=old.get(key);if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}
 }
});

test('approved Notes receipt remains visible when resumed provider turn fails',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true}),{window}=dom,old=new Map();
 for(const key of ['window','document','navigator','localStorage','HTMLElement','Element','Node','MutationObserver','requestAnimationFrame','cancelAnimationFrame','IS_REACT_ACT_ENVIRONMENT','isTauri'])old.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
 const calls=[];let root,executions=0;
 try{
  for(const [key,value] of Object.entries({window,document:window.document,navigator:window.navigator,localStorage:window.localStorage,HTMLElement:window.HTMLElement,Element:window.Element,Node:window.Node,MutationObserver:window.MutationObserver,requestAnimationFrame:callback=>setTimeout(()=>callback(Date.now()),0),cancelAnimationFrame:clearTimeout,IS_REACT_ACT_ENVIRONMENT:true,isTauri:true}))setGlobal(key,value);
  window.HTMLElement.prototype.scrollTo=function(){};window.HTMLTextAreaElement.prototype.focus=function(){};window.__TAURI_INTERNALS__={};window.localStorage.setItem('still-assistant-share-workspace-image','false');window.localStorage.setItem('still-assistant-model','openai::gpt-test');
  mockIPC((command,args)=>{calls.push({command,args});if(command==='assistant_configured')return true;if(command==='assistant_models')return ['gpt-test'];if(command!=='assistant_agent_turn')return null;const count=calls.filter(call=>call.command==='assistant_agent_turn').length,request=args.request;assert.equal(request.enable_add_widget_tool,true);if(count===1)return {kind:'tool_calls',assistantMessage:{role:'assistant',tool_calls:[{id:'inspect-1',type:'function',function:{name:'inspect_workspace',arguments:'{}'}}]},calls:[{id:'inspect-1',name:'inspect_workspace',input:{}}]};if(count===2){const inspected=JSON.parse(request.messages.at(-1).content).result;return {kind:'tool_calls',assistantMessage:{role:'assistant',tool_calls:[{id:'add-1',type:'function',function:{name:'add_widget',arguments:JSON.stringify({widgetType:'notes',snapshotRevision:inspected.revision})}}]},calls:[{id:'add-1',name:'add_widget',input:{widgetType:'notes',snapshotRevision:inspected.revision}}]}}throw new Error('provider resume failed');},{shouldMockEvents:true});
  const {default:AssistantPanel}=await vite.ssrLoadModule('/src/AssistantPanel.tsx'),workspace=createWorkspace('Study',[]);root=createRoot(window.document.querySelector('#root'));
  await act(async()=>root.render(createElement(AssistantPanel,{workspace,workspaces:[{id:workspace.id,name:workspace.name}],trayItems:[],sidebarPlugins:[],open:true,close(){},dimensions:()=>({width:900,height:700}),apply(){},undo(){},act:async()=>{executions++;return 'Added a Notes widget (Notes 1).'}})));
  await waitFor(()=>window.document.querySelector('#ai-model option[value="openai::gpt-test"]'));await act(async()=>window.document.querySelector('[aria-label="AI settings"]').click());await act(async()=>window.document.querySelectorAll('.assistant-settings input[type="checkbox"]')[1].click());
  const composer=window.document.querySelector('#ai-message');await act(async()=>setReactValue(composer,'Please add a Notes widget.','HTMLTextAreaElement'));await act(async()=>window.document.querySelector('.assistant-compose').requestSubmit());
  await waitFor(()=>window.document.querySelector('[aria-label="Add one widget?"]'));await act(async()=>window.document.querySelector('[aria-label="Add one widget?"] button.primary').click());
  await waitFor(()=>executions===1&&window.document.querySelector('.assistant-error'));
  assert.ok([...window.document.querySelectorAll('.assistant-message.model p')].some(node=>node.textContent==='Added a Notes widget (Notes 1).'),'actual execution receipt is in chat despite provider resume failure');
  assert.equal(window.localStorage.getItem('still-assistant-run-recovery-v1:'+encodeURIComponent(workspace.id)),null,'a saved execution receipt clears the old applying marker before provider continuation');
 }finally{
  if(root)await act(async()=>root.unmount());clearMocks();dom.window.close();
  for(const key of old.keys()){const descriptor=old.get(key);if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}
 }
});

test('provider continuation stops when the approved action receipt cannot be saved locally',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true}),{window}=dom,old=new Map();
 for(const key of ['window','document','navigator','localStorage','HTMLElement','Element','Node','MutationObserver','requestAnimationFrame','cancelAnimationFrame','IS_REACT_ACT_ENVIRONMENT','isTauri'])old.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
 const calls=[];let root,executions=0;
 try{
  for(const [key,value] of Object.entries({window,document:window.document,navigator:window.navigator,localStorage:window.localStorage,HTMLElement:window.HTMLElement,Element:window.Element,Node:window.Node,MutationObserver:window.MutationObserver,requestAnimationFrame:callback=>setTimeout(()=>callback(Date.now()),0),cancelAnimationFrame:clearTimeout,IS_REACT_ACT_ENVIRONMENT:true,isTauri:true}))setGlobal(key,value);
  window.HTMLElement.prototype.scrollTo=function(){};window.HTMLTextAreaElement.prototype.focus=function(){};window.__TAURI_INTERNALS__={};window.localStorage.setItem('still-assistant-share-workspace-image','false');window.localStorage.setItem('still-assistant-model','openai::gpt-test');
  mockIPC((command,args)=>{calls.push({command,args});if(command==='assistant_configured')return true;if(command==='assistant_models')return ['gpt-test'];if(command!=='assistant_agent_turn')return null;const request=args.request,count=calls.filter(call=>call.command==='assistant_agent_turn').length;assert.equal(request.enable_add_widget_tool,true);if(count===1)return {kind:'tool_calls',assistantMessage:{role:'assistant',tool_calls:[{id:'inspect-1',type:'function',function:{name:'inspect_workspace',arguments:'{}'}}]},calls:[{id:'inspect-1',name:'inspect_workspace',input:{}}]};if(count===2){const inspected=JSON.parse(request.messages.at(-1).content).result;return {kind:'tool_calls',assistantMessage:{role:'assistant',tool_calls:[{id:'add-1',type:'function',function:{name:'add_widget',arguments:JSON.stringify({widgetType:'notes',snapshotRevision:inspected.revision})}}]},calls:[{id:'add-1',name:'add_widget',input:{widgetType:'notes',snapshotRevision:inspected.revision}}]}}throw new Error('Provider continuation must stop when the receipt cannot be persisted.');},{shouldMockEvents:true});
  const {default:AssistantPanel}=await vite.ssrLoadModule('/src/AssistantPanel.tsx'),workspace=createWorkspace('Study',[]);root=createRoot(window.document.querySelector('#root'));
  await act(async()=>root.render(createElement(AssistantPanel,{workspace,workspaces:[{id:workspace.id,name:workspace.name}],trayItems:[],sidebarPlugins:[],open:true,close(){},dimensions:()=>({width:900,height:700}),apply(){},undo(){},act:async()=>{executions++;return 'Added a Notes widget (Notes 1).'}})));
  await waitFor(()=>window.document.querySelector('#ai-model option[value="openai::gpt-test"]'));await act(async()=>window.document.querySelector('[aria-label="AI settings"]').click());await act(async()=>window.document.querySelectorAll('.assistant-settings input[type="checkbox"]')[1].click());
  const composer=window.document.querySelector('#ai-message');await act(async()=>setReactValue(composer,'Please add a Notes widget.','HTMLTextAreaElement'));await act(async()=>window.document.querySelector('.assistant-compose').requestSubmit());
  await waitFor(()=>window.document.querySelector('[aria-label="Add one widget?"]'));
  const storagePrototype=Object.getPrototypeOf(window.localStorage),originalSet=storagePrototype.setItem;Object.defineProperty(storagePrototype,'setItem',{configurable:true,writable:true,value:function(key,value){if(key.startsWith('still-assistant-chat-v1:'))throw new Error('quota exceeded');return originalSet.call(this,key,value)}});
  await act(async()=>window.document.querySelector('[aria-label="Add one widget?"] button.primary').click());
  await waitFor(()=>executions===1&&/could not save the verified action receipt/i.test(window.document.querySelector('.assistant-error')?.textContent??''));
  assert.equal(calls.filter(call=>call.command==='assistant_agent_turn').length,2,'the provider is not resumed after receipt persistence fails');
  assert.match(window.localStorage.getItem('still-assistant-run-recovery-v1:'+encodeURIComponent(workspace.id)),/"stage":"applying"/,'the applying marker remains for cautious recovery');
 }finally{
  if(root)await act(async()=>root.unmount());clearMocks();dom.window.close();for(const key of old.keys()){const descriptor=old.get(key);if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}
 }
});

test('separately opted-in minimize action is described, reviewed, and applied through Still',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true}),{window}=dom,old=new Map();
 for(const key of ['window','document','navigator','localStorage','HTMLElement','Element','Node','MutationObserver','requestAnimationFrame','cancelAnimationFrame','IS_REACT_ACT_ENVIRONMENT','isTauri'])old.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
 const calls=[];let root,executions=0;
 try{
  for(const [key,value] of Object.entries({window,document:window.document,navigator:window.navigator,localStorage:window.localStorage,HTMLElement:window.HTMLElement,Element:window.Element,Node:window.Node,MutationObserver:window.MutationObserver,requestAnimationFrame:callback=>setTimeout(()=>callback(Date.now()),0),cancelAnimationFrame:clearTimeout,IS_REACT_ACT_ENVIRONMENT:true,isTauri:true}))setGlobal(key,value);
  window.HTMLElement.prototype.scrollTo=function(){};window.HTMLTextAreaElement.prototype.focus=function(){};window.__TAURI_INTERNALS__={};window.localStorage.setItem('still-assistant-share-workspace-image','false');window.localStorage.setItem('still-assistant-model','openai::gpt-test');
  mockIPC((command,args)=>{calls.push({command,args});if(command==='assistant_configured')return true;if(command==='assistant_models')return ['gpt-test'];if(command!=='assistant_agent_turn')return null;const count=calls.filter(call=>call.command==='assistant_agent_turn').length,request=args.request;assert.equal(request.enable_add_widget_tool,true);assert.equal(request.enable_safe_workspace_action_tool,true);if(count===1)return {kind:'tool_calls',assistantMessage:{role:'assistant',tool_calls:[{id:'inspect-1',type:'function',function:{name:'inspect_workspace',arguments:'{}'}}]},calls:[{id:'inspect-1',name:'inspect_workspace',input:{}}]};if(count===2){const inspected=JSON.parse(request.messages.at(-1).content).result;return {kind:'tool_calls',assistantMessage:{role:'assistant',tool_calls:[{id:'action-1',type:'function',function:{name:'propose_workspace_action',arguments:JSON.stringify({snapshotRevision:inspected.revision,action:{type:'minimize',ids:[note.id]}})}}]},calls:[{id:'action-1',name:'propose_workspace_action',input:{snapshotRevision:inspected.revision,action:{type:'minimize',ids:[note.id]}}}]}}assert.deepEqual(JSON.parse(request.messages.at(-1).content),{status:'succeeded',mutation:'applied',result:{receipt:'Minimized Notes 1.'}});return {kind:'final',response:{intent:'chat',reply:'Minimized Notes 1.',layout:[],actions:[]}}},{shouldMockEvents:true});
  const {default:AssistantPanel}=await vite.ssrLoadModule('/src/AssistantPanel.tsx'),workspace=createWorkspace('Study',['notes']),note=workspace.widgets[0];root=createRoot(window.document.querySelector('#root'));
  await act(async()=>root.render(createElement(AssistantPanel,{workspace,workspaces:[{id:workspace.id,name:workspace.name}],trayItems:[],sidebarPlugins:[],open:true,close(){},dimensions:()=>({width:900,height:700}),apply(){},undo(){},act:async(_id,actions)=>{executions++;assert.deepEqual(actions,[{type:'minimize',ids:[note.id]}]);return 'Minimized Notes 1.'}})));
  await waitFor(()=>window.document.querySelector('#ai-model option[value="openai::gpt-test"]'));await act(async()=>window.document.querySelector('[aria-label="AI settings"]').click());
  const toggles=window.document.querySelectorAll('.assistant-settings input[type="checkbox"]');await act(async()=>toggles[1].click());
  await waitFor(()=>window.document.querySelectorAll('.assistant-settings input[type="checkbox"]').length===3);await act(async()=>window.document.querySelectorAll('.assistant-settings input[type="checkbox"]')[2].click());
  const composer=window.document.querySelector('#ai-message');await act(async()=>setReactValue(composer,'Minimize Notes.','HTMLTextAreaElement'));await act(async()=>window.document.querySelector('.assistant-compose').requestSubmit());
  await waitFor(()=>window.document.querySelector('[aria-label="Review workspace action"]'));
  assert.match(window.document.querySelector('[aria-label="Review workspace action"]').textContent,/Minimize/i);assert.equal(executions,0,'proposal is not applied before explicit review');
  await act(async()=>window.document.querySelector('[aria-label="Review workspace action"] button.primary').click());
  await waitFor(()=>executions===1&&calls.filter(call=>call.command==='assistant_agent_turn').length===3);
  assert.ok([...window.document.querySelectorAll('.assistant-message.model p')].some(node=>node.textContent==='Minimized Notes 1.'));
 }finally{
  if(root)await act(async()=>root.unmount());clearMocks();dom.window.close();
  for(const key of old.keys()){const descriptor=old.get(key);if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}
 }
});

test('Gemini preview is provider-specific and preserves its native tool round through approval',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true}),{window}=dom,old=new Map();
 for(const key of ['window','document','navigator','localStorage','HTMLElement','Element','Node','MutationObserver','requestAnimationFrame','cancelAnimationFrame','IS_REACT_ACT_ENVIRONMENT','isTauri'])old.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
 const calls=[];let root,executions=0;
 const inspectContent={role:'model',parts:[{functionCall:{name:'inspect_workspace',args:{},id:'gemini-inspect'}},{text:'inspect',thoughtSignature:'signature-inspect'}]};
 const addContent={role:'model',parts:[{functionCall:{name:'add_widget',args:{widgetType:'notes',snapshotRevision:'revision'},id:'gemini-add'}},{text:'add',thoughtSignature:'signature-add'}]};
 try{
  for(const [key,value] of Object.entries({window,document:window.document,navigator:window.navigator,localStorage:window.localStorage,HTMLElement:window.HTMLElement,Element:window.Element,Node:window.Node,MutationObserver:window.MutationObserver,requestAnimationFrame:callback=>setTimeout(()=>callback(Date.now()),0),cancelAnimationFrame:clearTimeout,IS_REACT_ACT_ENVIRONMENT:true,isTauri:true}))setGlobal(key,value);
  window.HTMLElement.prototype.scrollTo=function(){};window.HTMLTextAreaElement.prototype.focus=function(){};window.__TAURI_INTERNALS__={};window.localStorage.setItem('still-assistant-share-workspace-image','false');window.localStorage.setItem('still-assistant-model','gemini::gemini-test');window.localStorage.setItem('still-assistant-agent-preview','true');window.localStorage.setItem('still-assistant-gemini-agent-preview','false');
  mockIPC((command,args)=>{
   calls.push({command,args});if(command==='assistant_configured')return true;if(command==='assistant_models')return args.provider==='gemini'?['gemini-test']:['gpt-test'];if(command!=='assistant_agent_turn')return null;
   const request=args.request,count=calls.filter(call=>call.command==='assistant_agent_turn').length;assert.equal(request.provider,'gemini');assert.equal(request.enable_add_widget_tool,true);assert.equal(request.enable_safe_workspace_action_tool,false);
   if(count===1)return {kind:'tool_calls',assistantMessage:{role:'assistant',gemini_content:inspectContent},calls:[{id:'gemini-inspect',name:'inspect_workspace',input:{}}]};
   if(count===2){assert.deepEqual(request.messages.at(-2).gemini_content,inspectContent);const inspected=JSON.parse(request.messages.at(-1).content).result;return {kind:'tool_calls',assistantMessage:{role:'assistant',gemini_content:addContent},calls:[{id:'gemini-add',name:'add_widget',input:{widgetType:'notes',snapshotRevision:inspected.revision}}]};}
   assert.deepEqual(request.messages.at(-2).gemini_content,addContent);assert.equal(request.messages.at(-2).gemini_content.parts[1].thoughtSignature,'signature-add');assert.deepEqual(JSON.parse(request.messages.at(-1).content),{status:'succeeded',mutation:'applied',result:{receipt:'Added Notes 1.'}});return {kind:'final',response:{intent:'chat',reply:'Added Notes 1.',layout:[],actions:[]}};
  },{shouldMockEvents:true});
  const {default:AssistantPanel}=await vite.ssrLoadModule('/src/AssistantPanel.tsx'),workspace=createWorkspace('Study',[]);root=createRoot(window.document.querySelector('#root'));
  await act(async()=>root.render(createElement(AssistantPanel,{workspace,workspaces:[{id:workspace.id,name:workspace.name}],trayItems:[],sidebarPlugins:[],open:true,close(){},dimensions:()=>({width:900,height:700}),apply(){},undo(){},act:async()=>{executions++;return 'Added Notes 1.'}})));
  await waitFor(()=>window.document.querySelector('#ai-model option[value="gemini::gemini-test"]'));await act(async()=>window.document.querySelector('[aria-label="AI settings"]').click());
  const checkboxes=window.document.querySelectorAll('.assistant-settings input[type="checkbox"]');assert.equal(checkboxes[1].checked,false,'OpenAI opt-in does not enable Gemini');await act(async()=>checkboxes[1].click());
  const composer=window.document.querySelector('#ai-message');await act(async()=>setReactValue(composer,'Please add a Notes widget.','HTMLTextAreaElement'));await act(async()=>window.document.querySelector('.assistant-compose').requestSubmit());
  await waitFor(()=>window.document.querySelector('[aria-label="Add one widget?"]'));assert.equal(executions,0);assert.equal(calls.some(call=>call.command==='assistant_chat'),false);
  await act(async()=>window.document.querySelector('[aria-label="Add one widget?"] button.primary').click());await waitFor(()=>executions===1&&calls.filter(call=>call.command==='assistant_agent_turn').length===3);await waitFor(()=>[...window.document.querySelectorAll('.assistant-message.model p')].some(node=>node.textContent==='Added Notes 1.'));
 }finally{
  if(root)await act(async()=>root.unmount());clearMocks();dom.window.close();for(const key of old.keys()){const descriptor=old.get(key);if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}
 }
});

test('explicit memory request shows exact text and selected provider, then displays the actual saved receipt',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true}),{window}=dom,old=new Map();
 for(const key of ['window','document','navigator','localStorage','HTMLElement','Element','Node','MutationObserver','requestAnimationFrame','cancelAnimationFrame','IS_REACT_ACT_ENVIRONMENT','isTauri'])old.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
 const calls=[];let root;
 try{
  for(const [key,value] of Object.entries({window,document:window.document,navigator:window.navigator,localStorage:window.localStorage,HTMLElement:window.HTMLElement,Element:window.Element,Node:window.Node,MutationObserver:window.MutationObserver,requestAnimationFrame:callback=>setTimeout(()=>callback(Date.now()),0),cancelAnimationFrame:clearTimeout,IS_REACT_ACT_ENVIRONMENT:true,isTauri:true}))setGlobal(key,value);
  window.HTMLElement.prototype.scrollTo=function(){};window.HTMLTextAreaElement.prototype.focus=function(){};window.__TAURI_INTERNALS__={};window.localStorage.setItem('still-assistant-share-workspace-image','false');window.localStorage.setItem('still-assistant-model','gemini::gemini-test');window.localStorage.setItem('still-assistant-gemini-agent-preview','true');
  mockIPC((command,args)=>{calls.push({command,args});if(command==='assistant_configured')return true;if(command==='assistant_models')return ['gemini-test'];if(command!=='assistant_agent_turn')return null;const request=args.request,count=calls.filter(call=>call.command==='assistant_agent_turn').length;assert.equal(request.provider,'gemini');assert.equal(request.enable_assistant_memory_tool,true);if(count===1)return {kind:'tool_calls',assistantMessage:{role:'assistant',gemini_content:{role:'model',parts:[{functionCall:{name:'propose_assistant_memory',args:{text:'I prefer concise answers.'},id:'memory-call'}},{text:'proposing',thoughtSignature:'memory-ui-signature'}]}},calls:[{id:'memory-call',name:'propose_assistant_memory',input:{text:'I prefer concise answers.'}}]};assert.deepEqual(JSON.parse(request.messages.at(-1).content).result.entry.text,'I prefer concise answers.');return {kind:'final',response:{intent:'chat',reply:'I saved your preference.',layout:[],actions:[]}}},{shouldMockEvents:true});
  const {default:AssistantPanel}=await vite.ssrLoadModule('/src/AssistantPanel.tsx'),workspace=createWorkspace('Study',[]);root=createRoot(window.document.querySelector('#root'));
  await act(async()=>root.render(createElement(AssistantPanel,{workspace,workspaces:[{id:workspace.id,name:workspace.name}],trayItems:[],sidebarPlugins:[],open:true,close(){},dimensions:()=>({width:900,height:700}),apply(){},undo(){},act:async()=>''})));
  await waitFor(()=>window.document.querySelector('#ai-model option[value="gemini::gemini-test"]'));await act(async()=>window.document.querySelector('[aria-label="AI settings"]').click());
  const composer=window.document.querySelector('#ai-message');await act(async()=>setReactValue(composer,'Please remember: I prefer concise answers.','HTMLTextAreaElement'));await act(async()=>window.document.querySelector('.assistant-compose').requestSubmit());
  await waitFor(()=>window.document.querySelector('[aria-label="Save this to local assistant memory?"]'));
  const review=window.document.querySelector('[aria-label="Save this to local assistant memory?"]');assert.match(review.textContent,/Gemini/);assert.match(review.textContent,/I prefer concise answers/);assert.equal(JSON.parse(window.localStorage.getItem('still-assistant-memory-v1')??'[]').length,0,'proposal display does not save memory');
  await act(async()=>review.querySelector('button.primary').click());await waitFor(()=>JSON.parse(window.localStorage.getItem('still-assistant-memory-v1')??'[]').length===1);await waitFor(()=>[...window.document.querySelectorAll('.assistant-message.model p')].some(node=>node.textContent.includes('Saved this item to local assistant memory.')&&node.textContent.includes('I prefer concise answers.')));
  const saved=JSON.parse(window.localStorage.getItem('still-assistant-memory-v1'))[0];assert.equal(saved.text,'I prefer concise answers.');assert.equal(calls.filter(call=>call.command==='assistant_agent_turn').length,2);await waitFor(()=>[...window.document.querySelectorAll('.assistant-memory li')].some(node=>node.textContent.includes('I prefer concise answers.')));
 }finally{if(root)await act(async()=>root.unmount());clearMocks();dom.window.close();for(const key of old.keys()){const descriptor=old.get(key);if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}}
});

test('restart expires an agent approval, restores a recovery receipt, and never replays it',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true}),{window}=dom,old=new Map();
 for(const key of ['window','document','navigator','localStorage','HTMLElement','Element','Node','MutationObserver','requestAnimationFrame','cancelAnimationFrame','IS_REACT_ACT_ENVIRONMENT','isTauri'])old.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
 let root;const calls=[];
 try{
  for(const [key,value] of Object.entries({window,document:window.document,navigator:window.navigator,localStorage:window.localStorage,HTMLElement:window.HTMLElement,Element:window.Element,Node:window.Node,MutationObserver:window.MutationObserver,requestAnimationFrame:callback=>setTimeout(()=>callback(Date.now()),0),cancelAnimationFrame:clearTimeout,IS_REACT_ACT_ENVIRONMENT:true,isTauri:true}))setGlobal(key,value);
  window.HTMLElement.prototype.scrollTo=function(){};window.HTMLTextAreaElement.prototype.focus=function(){};window.__TAURI_INTERNALS__={};window.localStorage.setItem('still-assistant-model','openai::gpt-test');
  mockIPC(command=>{calls.push(command);if(command==='assistant_configured')return true;if(command==='assistant_models')return ['gpt-test'];if(command==='assistant_journal_list')return [];return null},{shouldMockEvents:true});
  const {default:AssistantPanel}=await vite.ssrLoadModule('/src/AssistantPanel.tsx'),workspace=createWorkspace('Recovery',[]),key='still-assistant-run-recovery-v1:'+encodeURIComponent(workspace.id);
  window.localStorage.setItem(key,JSON.stringify({version:1,workspaceId:workspace.id,runId:'crashed-review',stage:'awaiting_review',kind:'add_widget',updatedAt:Date.now()}));
  const props={workspace,workspaces:[{id:workspace.id,name:workspace.name}],trayItems:[],sidebarPlugins:[],open:true,close(){},dimensions:()=>({width:900,height:700}),apply(){},undo(){},act:async()=>{throw new Error('an expired approval must not execute')}};
  root=createRoot(window.document.querySelector('#root'));await act(async()=>root.render(createElement(AssistantPanel,props)));
  await waitFor(()=>window.document.querySelector('.assistant-message.model')?.textContent.includes('That approval expired'));
  assert.equal(window.document.querySelector('[aria-label="Add one widget?"]'),null);
  assert.equal(window.localStorage.getItem(key),null,'recovery receipt is saved before its marker is removed');
  const stored=JSON.parse(window.localStorage.getItem('still-assistant-chat-v1:'+encodeURIComponent(workspace.id)));
  assert.ok(stored.some(message=>message.text.includes('That approval expired')));
  assert.equal(calls.includes('assistant_agent_turn'),false,'restart does not recreate or replay the provider action');
  const applyingWorkspace=createWorkspace('Interrupted apply',[]),applyingKey='still-assistant-run-recovery-v1:'+encodeURIComponent(applyingWorkspace.id);
  window.localStorage.setItem(applyingKey,JSON.stringify({version:1,workspaceId:applyingWorkspace.id,runId:'crashed-apply',stage:'applying',kind:'workspace_action',updatedAt:Date.now()}));
  await act(async()=>root.render(createElement(AssistantPanel,{...props,workspace:applyingWorkspace,workspaces:[{id:applyingWorkspace.id,name:applyingWorkspace.name}]})));
  await waitFor(()=>[...window.document.querySelectorAll('.assistant-message.model')].some(message=>message.textContent.includes('Its result may be incomplete or uncertain')));
  assert.equal(window.localStorage.getItem(applyingKey),null);
  assert.equal(calls.includes('assistant_agent_turn'),false,'uncertain actions are never replayed automatically');
 }finally{
  if(root)await act(async()=>root.unmount());clearMocks();dom.window.close();for(const key of old.keys()){const descriptor=old.get(key);if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}
 }
});

test('memory storage failure is disclosed as uncertain and never resumes a success claim',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true}),{window}=dom,old=new Map();
 for(const key of ['window','document','navigator','localStorage','HTMLElement','Element','Node','MutationObserver','requestAnimationFrame','cancelAnimationFrame','IS_REACT_ACT_ENVIRONMENT','isTauri'])old.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
 const calls=[];let root;const originalSetItem=window.Storage.prototype.setItem;window.Storage.prototype.setItem=function(key,value){if(key==='still-assistant-memory-v1')throw new Error('storage unavailable');return originalSetItem.call(this,key,value)};
 try{
  for(const [key,value] of Object.entries({window,document:window.document,navigator:window.navigator,localStorage:window.localStorage,HTMLElement:window.HTMLElement,Element:window.Element,Node:window.Node,MutationObserver:window.MutationObserver,requestAnimationFrame:callback=>setTimeout(()=>callback(Date.now()),0),cancelAnimationFrame:clearTimeout,IS_REACT_ACT_ENVIRONMENT:true,isTauri:true}))setGlobal(key,value);
  window.HTMLElement.prototype.scrollTo=function(){};window.HTMLTextAreaElement.prototype.focus=function(){};window.__TAURI_INTERNALS__={};window.localStorage.setItem('still-assistant-share-workspace-image','false');window.localStorage.setItem('still-assistant-model','gemini::gemini-test');window.localStorage.setItem('still-assistant-gemini-agent-preview','true');
  mockIPC((command,args)=>{calls.push({command,args});if(command==='assistant_configured')return true;if(command==='assistant_models')return ['gemini-test'];if(command!=='assistant_agent_turn')return null;const request=args.request,count=calls.filter(call=>call.command==='assistant_agent_turn').length;assert.equal(request.enable_assistant_memory_tool,true);if(count>1)return {kind:'final',response:{intent:'chat',reply:'No memory saved.',layout:[],actions:[]}};return {kind:'tool_calls',assistantMessage:{role:'assistant',gemini_content:{role:'model',parts:[{functionCall:{name:'propose_assistant_memory',args:{text:'I prefer concise answers.'},id:'memory-call'}}]}},calls:[{id:'memory-call',name:'propose_assistant_memory',input:{text:'I prefer concise answers.'}}]}},{shouldMockEvents:true});
  const {default:AssistantPanel}=await vite.ssrLoadModule('/src/AssistantPanel.tsx'),workspace=createWorkspace('Study',[]);root=createRoot(window.document.querySelector('#root'));
  await act(async()=>root.render(createElement(AssistantPanel,{workspace,workspaces:[{id:workspace.id,name:workspace.name}],trayItems:[],sidebarPlugins:[],open:true,close(){},dimensions:()=>({width:900,height:700}),apply(){},undo(){},act:async()=>''})));
  await waitFor(()=>window.document.querySelector('#ai-model option[value="gemini::gemini-test"]'));const composer=window.document.querySelector('#ai-message');await act(async()=>setReactValue(composer,'Remember I prefer concise answers.','HTMLTextAreaElement'));await act(async()=>window.document.querySelector('.assistant-compose').requestSubmit());
  await waitFor(()=>window.document.querySelector('[aria-label="Save this to local assistant memory?"]'));await act(async()=>window.document.querySelector('[aria-label="Save this to local assistant memory?"] button.primary').click());
  await waitFor(()=>[...window.document.querySelectorAll('.assistant-message.model p')].some(node=>node.textContent.includes('could not confirm whether memory was saved')));assert.equal(calls.filter(call=>call.command==='assistant_agent_turn').length,1);assert.equal(window.localStorage.getItem('still-assistant-memory-v1'),null);assert.equal(window.document.querySelector('[aria-label="Save this to local assistant memory?"]'),null);
 }finally{if(root)await act(async()=>root.unmount());clearMocks();dom.window.close();for(const key of old.keys()){const descriptor=old.get(key);if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}}
});

for(const provider of ['chatgpt','openai'])test(provider+' reviews a move, resumes with its receipt, then proposes a widget',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true}),{window}=dom,old=new Map();
 const globals={window,document:window.document,navigator:window.navigator,localStorage:window.localStorage,HTMLElement:window.HTMLElement,Element:window.Element,Node:window.Node,MutationObserver:window.MutationObserver,IS_REACT_ACT_ENVIRONMENT:true,isTauri:true};
 for(const key of Object.keys(globals))old.set(key,Object.getOwnPropertyDescriptor(globalThis,key));let root;const requests=[],moves=[],actions=[];
 try{
  for(const [key,value] of Object.entries(globals))setGlobal(key,value);
  window.HTMLElement.prototype.scrollTo=function(){};window.HTMLTextAreaElement.prototype.focus=function(){};window.__TAURI_INTERNALS__={};window.localStorage.setItem('still-assistant-model',provider+'::gpt-test');window.localStorage.setItem('still-assistant-agent-preview','true');
  const entries=[{name:'lecture.pdf',path:'lecture.pdf',directory:false,size:100,blocked:false,revision:'100:1'},{name:'Courses',path:'Courses',directory:true,size:0,blocked:false}];
  mockIPC((command,args)=>{
   if(command==='assistant_configured')return true;if(command==='assistant_models')return ['gpt-test'];
   if(command==='chatgpt_plan_status')return {connected:true,email:null};if(command==='chatgpt_plan_models')return [{slug:'gpt-test',display_name:'Test model'}];
   if(command==='files_still_inbox')return {path:'C:/test/inbox',listing:{rootName:'Inbox',location:'',entries,truncated:false}};
   if(command==='files_list')return {rootName:'Inbox',location:args.location,entries:args.location===''?entries:[],truncated:false};
   if(command===(provider==='chatgpt'?'chatgpt_plan_agent_turn':'assistant_agent_turn')){
    requests.push(args.request);
    const call=(name,input,id)=>({kind:'tool_calls',assistantMessage:{role:'assistant',tool_calls:[{id,type:'function',function:{name,arguments:JSON.stringify(input)}}]},calls:[{id,name,input}]});
    if(requests.length===1)return call('inspect_inbox',{},'inspect-file');
    if(requests.length===2){
     assert.equal(args.request.enable_inbox_move_tool,true);
     return call('propose_inbox_moves',{fileProposals:[{sourceWidgetId:'inbox-1',sourcePath:'lecture.pdf',destinationFolder:'Courses',reason:'Requested folder.'}]},'move-file');
    }
    const result=JSON.parse(args.request.messages.at(-1).content);
    if(requests.length===3){
     assert.deepEqual(result.result.moved,[{sourcePath:'lecture.pdf',destinationPath:'Courses/lecture.pdf'}]);
     assert(!JSON.stringify(args.request).includes('C:/test/inbox'),'local root path is never sent to provider');
     return call('inspect_workspace',{},'inspect-workspace');
    }
    if(requests.length===4)return call('add_widget',{widgetType:'notes',snapshotRevision:result.result.revision},'add-widget');
    assert.equal(result.result.receipt,'Notes widget added.');
    return {kind:'final',response:{intent:'chat',reply:'Finished the fixture workflow.',layout:[],actions:[]}};
   }
   return null;
  },{shouldMockEvents:true});
  const {default:AssistantPanel}=await vite.ssrLoadModule('/src/AssistantPanel.tsx');const workspace=createWorkspace('Daily',[]);
  root=createRoot(window.document.querySelector('#root'));
  await act(async()=>root.render(createElement(AssistantPanel,{workspace,workspaces:[workspace],inboxWidgetId:'inbox-1',trayItems:[],sidebarPlugins:[],open:true,close(){},dimensions:()=>({width:900,height:700}),apply(){},undo(){},act:async(_owner,applied)=>{actions.push(...applied);return 'Notes widget added.'},moveFile:async(...args)=>{moves.push(args);return 'Courses/lecture.pdf'}})));
  await waitFor(()=>window.document.querySelector('#ai-model option[value="'+provider+'::gpt-test"]'));
  await act(async()=>setReactValue(window.document.querySelector('#ai-message'),'Move lecture.pdf to Courses in Downloads Inbox, then add a Notes widget.','HTMLTextAreaElement'));
  await act(async()=>window.document.querySelector('.assistant-compose').requestSubmit());
  await waitFor(()=>window.document.querySelector('.assistant-confirmation button.primary'));
  assert.equal(moves.length,0);assert.equal(requests[0].enable_inbox_tool,true);
  await act(async()=>window.document.querySelector('.assistant-confirmation button.primary').click());
  await waitFor(()=>moves.length===1);assert.deepEqual(moves[0],[workspace.id,'inbox-1','lecture.pdf','Courses',{rootPath:'C:/test/inbox',sourceRevision:'100:1'}]);
  await waitFor(()=>window.document.querySelector('.assistant-confirmation button.primary'));
  assert.equal(actions.length,0,'the second mutation still needs review');
  await act(async()=>window.document.querySelector('.assistant-confirmation button.primary').click());
  await waitFor(()=>window.document.body.textContent.includes('Finished the fixture workflow.'));
  assert.deepEqual(actions,[{type:'add_widget',ids:['notes']}]);
  assert.match(window.document.body.textContent,/1 of 1 file moves verified/);
 }finally{if(root)await act(async()=>root.unmount());clearMocks();dom.window.close();for(const [key,descriptor] of old)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}
});

test('selected Library context cannot widen the agent to the inbox or workspace mutations',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true}),{window}=dom,old=new Map();
 const globals={window,document:window.document,navigator:window.navigator,localStorage:window.localStorage,HTMLElement:window.HTMLElement,Element:window.Element,Node:window.Node,MutationObserver:window.MutationObserver,IS_REACT_ACT_ENVIRONMENT:true,isTauri:true};
 for(const key of Object.keys(globals))old.set(key,Object.getOwnPropertyDescriptor(globalThis,key));let root;const requests=[];
 try{
  for(const [key,value] of Object.entries(globals))setGlobal(key,value);
  window.HTMLElement.prototype.scrollTo=function(){};window.HTMLTextAreaElement.prototype.focus=function(){};window.__TAURI_INTERNALS__={};
  window.localStorage.setItem('still-assistant-model','chatgpt::gpt-test');
  mockIPC((command,args)=>{
   if(command==='chatgpt_plan_status')return {connected:true,email:null};
   if(command==='chatgpt_plan_models')return [{slug:'gpt-test',display_name:'Test model'}];
   if(command!=='chatgpt_plan_agent_turn')return null;
   requests.push(args.request);
   if(requests.length===1){
    assert.equal(args.request.enable_add_widget_tool,false);
    assert.equal(args.request.enable_safe_workspace_action_tool,false);
    assert.equal(args.request.enable_inbox_tool,false);
    assert.equal(args.request.enable_inbox_move_tool,false);
    assert.match(args.request.messages.at(-1).content,/fixture excerpt/);
    return {kind:'tool_calls',assistantMessage:{role:'assistant',tool_calls:[{id:'scoped',type:'function',function:{name:'inspect_workspace',arguments:'{}'}}]},calls:[{id:'scoped',name:'inspect_workspace',input:{}}]};
   }
   assert.deepEqual(JSON.parse(args.request.messages.at(-1).content).result,{scope:'selected_library_resources',workspaceInspectionAvailable:false});
   return {kind:'final',response:{intent:'workspace_action',reply:'Add a calendar.',layout:[],actions:[{type:'add_widget',ids:['calendar']}]}};
  },{shouldMockEvents:true});
  const {default:AssistantPanel}=await vite.ssrLoadModule('/src/AssistantPanel.tsx');const workspace=createWorkspace('Fixture',[]);
  root=createRoot(window.document.querySelector('#root'));
  let mutations=0;
  await act(async()=>root.render(createElement(AssistantPanel,{workspace,workspaces:[workspace],inboxWidgetId:'inbox-1',trayItems:[],sidebarPlugins:[],open:true,close(){},dimensions:()=>({width:900,height:700}),apply(){mutations++},undo(){},act:async()=>{mutations++;return 'Unexpected change.'},moveFile:async()=>{mutations++;return ''}})));
  await waitFor(()=>window.document.querySelector('#ai-model option[value="chatgpt::gpt-test"]'));
  await act(async()=>window.dispatchEvent(new window.CustomEvent('still-assistant-resource',{detail:{name:'fixture.md',path:'fixture.md',text:'fixture excerpt',prompt:'Summarize this selected file.'}})));
  await act(async()=>window.document.querySelector('.assistant-compose').requestSubmit());
  await waitFor(()=>window.document.body.textContent.includes('no changes were applied'));
  assert.equal(mutations,0);
  assert.equal(requests.length,2);
 }finally{if(root)await act(async()=>root.unmount());clearMocks();dom.window.close();for(const [key,descriptor] of old)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}
});

test('Study with AI hides its prompt, generates a summary, and saves only after review',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true}),{window}=dom,old=new Map();
 const globals={window,document:window.document,navigator:window.navigator,localStorage:window.localStorage,HTMLElement:window.HTMLElement,Element:window.Element,Node:window.Node,MutationObserver:window.MutationObserver,CustomEvent:window.CustomEvent,Event:window.Event,IS_REACT_ACT_ENVIRONMENT:true,isTauri:true};
 for(const key of Object.keys(globals))old.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
 let root;const requests=[],creates=[];
 try{
  for(const [key,value] of Object.entries(globals))setGlobal(key,value);
  window.HTMLElement.prototype.scrollTo=function(){};window.HTMLTextAreaElement.prototype.focus=function(){};window.__TAURI_INTERNALS__={};
  window.localStorage.setItem('still-assistant-model','gemini::gemini-test');
  window.localStorage.setItem('still-assistant-share-workspace-image','false');
  mockIPC((command,args)=>{
   if(command==='assistant_configured')return true;
   if(command==='assistant_models')return ['gemini-test'];
   if(command==='assistant_chat'){
    requests.push(args.request);
    return {intent:'chat',reply:'## Core ideas\n\n- A source backed idea.\n- A second key point.',layout:[],actions:[]};
   }
   return null;
  },{shouldMockEvents:true});
  const {default:AssistantPanel}=await vite.ssrLoadModule('/src/AssistantPanel.tsx'),workspace=createWorkspace('Study',[]),note=createWidget('notes');
  workspace.widgets=[note];root=createRoot(window.document.querySelector('#root'));
  await act(async()=>root.render(createElement(AssistantPanel,{workspace,workspaces:[workspace],trayItems:[],sidebarPlugins:[],open:true,close(){},dimensions:()=>({width:900,height:700}),apply(){},undo(){},act:async()=>''})));
  await waitFor(()=>window.document.querySelector('#ai-model option[value="gemini::gemini-test"]'));
  const title='Lecture 1';
  window.addEventListener('still-notes-create-ai-summary',event=>{
   const detail=event.detail;creates.push(detail);
   detail.resolve(`Created ${detail.title} in the same folder. The source note was unchanged.`);
  },{once:true});
  await act(async()=>window.dispatchEvent(new window.CustomEvent('still-assistant-resource',{detail:{name:'Lecture 1.md',path:'CHEM/lecture-1.md',size:120,text:'Source backed lecture text',notes:'',prompt:'Write a faithful summary of the selected lecture.',autoSubmit:true,workflow:'summary-note',requestId:'summary-1',fileWidgetId:note.id,fileActionAllowed:true,noteTarget:{widgetId:note.id,noteId:'lecture-note',expectedText:'Source backed lecture text'}}})));
  await waitFor(()=>requests.length===1&&window.document.querySelector('[aria-label="Review summary note"]'));
  assert.equal(requests[0].messages.at(-1).text,'Write a faithful summary of the selected lecture.');
  assert.equal(window.document.querySelectorAll('.assistant-message.user').length,0,'the auto-submit prompt stays hidden');
  assert.match(window.document.body.textContent,/Core ideas/,'the generated answer is visible in the review draft');
  assert.equal(creates.length,0,'generation alone does not write a file');
  const nameInput=window.document.querySelector('[aria-label="New note name"]');
  assert.ok(nameInput);assert.match(nameInput.value,/Lecture 1 - Summary/);
  const recoveryKey='still-assistant-run-recovery-v1:'+encodeURIComponent(workspace.id),pendingRecovery=JSON.parse(window.localStorage.getItem(recoveryKey));
  assert.equal(pendingRecovery.kind,'assistant_review');assert.equal(pendingRecovery.stage,'awaiting_review','the note review is recoverable before it is applied');
  await act(async()=>setReactValue(nameInput,title,'HTMLInputElement'));
  await act(async()=>window.document.querySelector('[aria-label="Review summary note"] button.primary').click());
  await waitFor(()=>creates.length===1&&window.document.body.textContent.includes('Created Lecture 1 in the same folder'));
  assert.equal(window.localStorage.getItem(recoveryKey),null,'the saved note receipt clears recovery after successful creation');
  assert.deepEqual({widgetId:creates[0].widgetId,sourceNoteId:creates[0].sourceNoteId,sourcePath:creates[0].sourcePath,expectedText:creates[0].expectedText,title:creates[0].title,draft:creates[0].draft},{widgetId:note.id,sourceNoteId:'lecture-note',sourcePath:'CHEM/lecture-1.md',expectedText:'Source backed lecture text',title, draft:'## Core ideas\n\n- A source backed idea.\n- A second key point.'});
 }finally{if(root)await act(async()=>root.unmount());clearMocks();dom.window.close();for(const [key,descriptor] of old)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}
});

test('Explain and Summarize answer directly without exposing their generated prompts',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true}),{window}=dom,old=new Map();
 const globals={window,document:window.document,navigator:window.navigator,localStorage:window.localStorage,HTMLElement:window.HTMLElement,Element:window.Element,Node:window.Node,MutationObserver:window.MutationObserver,CustomEvent:window.CustomEvent,Event:window.Event,IS_REACT_ACT_ENVIRONMENT:true,isTauri:true};
 for(const key of Object.keys(globals))old.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
 let root;const requests=[];let noteWrites=0;
 try{
  for(const [key,value] of Object.entries(globals))setGlobal(key,value);
  window.HTMLElement.prototype.scrollTo=function(){};window.HTMLTextAreaElement.prototype.focus=function(){};window.__TAURI_INTERNALS__={};
  window.localStorage.setItem('still-assistant-model','gemini::gemini-test');
  window.localStorage.setItem('still-assistant-share-workspace-image','false');
  mockIPC((command,args)=>{
   if(command==='assistant_configured')return true;
   if(command==='assistant_models')return ['gemini-test'];
   if(command==='assistant_chat'){
    const request=args.request;requests.push(request);
    const prompt=request.messages.at(-1).text;
    return {intent:'chat',reply:prompt.startsWith('Explain')?'ATP is the cell’s usable energy carrier.':'ATP stores energy that cells use for work.',layout:[],actions:[]};
   }
   return null;
  },{shouldMockEvents:true});
  window.addEventListener('still-notes-apply-ai-draft',()=>noteWrites++);
  window.addEventListener('still-notes-create-ai-summary',()=>noteWrites++);
  const {default:AssistantPanel}=await vite.ssrLoadModule('/src/AssistantPanel.tsx'),workspace=createWorkspace('Study',[]);
  root=createRoot(window.document.querySelector('#root'));
  await act(async()=>root.render(createElement(AssistantPanel,{workspace,workspaces:[workspace],trayItems:[],sidebarPlugins:[],open:true,close(){},dimensions:()=>({width:900,height:700}),apply(){},undo(){},act:async()=>''})));
  await waitFor(()=>window.document.querySelector('#ai-model option[value="gemini::gemini-test"]'));
  const actions=[
   {prompt:'Explain the selected note “ATP” clearly for a first-year student.',reply:'ATP is the cell’s usable energy carrier.'},
   {prompt:'Summarize the selected note “ATP” into its key ideas and a short recap.',reply:'ATP stores energy that cells use for work.'},
  ];
  for(const [index,action] of actions.entries()){
   await act(async()=>window.dispatchEvent(new window.CustomEvent('still-assistant-resource',{detail:{name:'ATP.md',path:'Biology/ATP.md',size:41,text:'ATP stores chemical energy used by cells.',notes:'',prompt:action.prompt,autoSubmit:true,fileWidgetId:'notes-widget',fileActionAllowed:true}})));
   await waitFor(()=>requests.length===index+1&&[...window.document.querySelectorAll('.assistant-message.model')].some(node=>node.textContent.includes(action.reply)));
   assert.equal(requests[index].messages.at(-1).text,action.prompt);
   assert.equal(requests[index].context.includes('ATP stores chemical energy used by cells.'),true,'the selected note text is sent as context');
   assert.equal(window.document.querySelectorAll('.assistant-message.user').length,0,'the generated instruction stays hidden');
  }
  assert.equal(noteWrites,0,'Explain and Summarize are read-only responses and do not write notes');
  assert.match(window.document.body.textContent,/ATP is the cell’s usable energy carrier/);
  assert.match(window.document.body.textContent,/ATP stores energy that cells use for work/);
 }finally{if(root)await act(async()=>root.unmount());clearMocks();dom.window.close();for(const [key,descriptor] of old)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}
});
