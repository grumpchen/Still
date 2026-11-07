import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createElement,act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {mockIPC,clearMocks} from '@tauri-apps/api/mocks';
import {createServer} from 'vite';
import {createWidget,createWorkspace} from '../src/domain/workspaces.ts';

const vite=await createServer({server:{middlewareMode:true,hmr:false,watch:{ignored:['**/src-tauri/**']}},appType:'custom',optimizeDeps:{noDiscovery:true,entries:[]}});
after(()=>vite.close());
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
  await waitFor(()=>window.document.querySelector('[aria-label="Add one Notes widget?"]'));
  assert.equal(executions,0,'model tool call only creates a review proposal');
  assert.equal(captures,0,'agent mode skips automatic workspace capture');
  assert.equal(calls.some(call=>call.command==='assistant_chat'),false,'the agent path does not fall back to ordinary chat');
  await act(async()=>window.document.querySelector('[aria-label="Add one Notes widget?"] button.primary').click());
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
  await waitFor(()=>window.document.querySelector('[aria-label="Add one Notes widget?"]'));
  await act(async()=>window.document.querySelector('[aria-label="Add one Notes widget?"] button').click());
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
  await waitFor(()=>window.document.querySelector('[aria-label="Add one Notes widget?"]'));await act(async()=>window.document.querySelector('[aria-label="Add one Notes widget?"] button.primary').click());
  await waitFor(()=>executions===1&&window.document.querySelector('.assistant-error'));
  assert.ok([...window.document.querySelectorAll('.assistant-message.model p')].some(node=>node.textContent==='Added a Notes widget (Notes 1).'),'actual execution receipt is in chat despite provider resume failure');
 }finally{
  if(root)await act(async()=>root.unmount());clearMocks();dom.window.close();
  for(const key of old.keys()){const descriptor=old.get(key);if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}
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

test('ChatGPT plan enables reviewed workspace actions by default',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true}),{window}=dom,old=new Map();
 for(const key of ['window','document','navigator','localStorage','HTMLElement','Element','Node','MutationObserver','requestAnimationFrame','cancelAnimationFrame','IS_REACT_ACT_ENVIRONMENT','isTauri'])old.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
 const calls=[];let root,executions=0;
 try{
  for(const [key,value] of Object.entries({window,document:window.document,navigator:window.navigator,localStorage:window.localStorage,HTMLElement:window.HTMLElement,Element:window.Element,Node:window.Node,MutationObserver:window.MutationObserver,requestAnimationFrame:callback=>setTimeout(()=>callback(Date.now()),0),cancelAnimationFrame:clearTimeout,IS_REACT_ACT_ENVIRONMENT:true,isTauri:true}))setGlobal(key,value);
  window.HTMLElement.prototype.scrollTo=function(){};window.HTMLTextAreaElement.prototype.focus=function(){};window.__TAURI_INTERNALS__={};window.localStorage.setItem('still-assistant-share-workspace-image','false');window.localStorage.setItem('still-assistant-model','chatgpt::gpt-test');
  mockIPC((command,args)=>{calls.push({command,args});if(command==='chatgpt_plan_status')return {connected:true,email:null};if(command==='chatgpt_plan_models')return [{slug:'gpt-test',display_name:'Test model'}];if(command!=='chatgpt_plan_agent_turn')return null;const count=calls.filter(call=>call.command==='chatgpt_plan_agent_turn').length,request=args.request;assert.equal(request.enable_add_widget_tool,true);assert.equal(request.enable_safe_workspace_action_tool,true);if(count===1)return {kind:'tool_calls',assistantMessage:{role:'assistant',tool_calls:[{id:'inspect-1',type:'function',function:{name:'inspect_workspace',arguments:'{}'}}]},calls:[{id:'inspect-1',name:'inspect_workspace',input:{}}]};if(count===2){const inspected=JSON.parse(request.messages.at(-1).content).result;return {kind:'tool_calls',assistantMessage:{role:'assistant',tool_calls:[{id:'action-1',type:'function',function:{name:'propose_workspace_action',arguments:JSON.stringify({snapshotRevision:inspected.revision,action:{type:'minimize',ids:[note.id]}})}}]},calls:[{id:'action-1',name:'propose_workspace_action',input:{snapshotRevision:inspected.revision,action:{type:'minimize',ids:[note.id]}}}]}}assert.deepEqual(JSON.parse(request.messages.at(-1).content),{status:'succeeded',mutation:'applied',result:{receipt:'Minimized Notes 1.'}});return {kind:'final',response:{intent:'chat',reply:'Minimized Notes 1.',layout:[],actions:[]}}},{shouldMockEvents:true});
  const {default:AssistantPanel}=await vite.ssrLoadModule('/src/AssistantPanel.tsx'),workspace=createWorkspace('Study',['notes']),note=workspace.widgets[0];root=createRoot(window.document.querySelector('#root'));
  await act(async()=>root.render(createElement(AssistantPanel,{workspace,workspaces:[{id:workspace.id,name:workspace.name}],trayItems:[],sidebarPlugins:[],open:true,close(){},dimensions:()=>({width:900,height:700}),apply(){},undo(){},act:async(_id,actions)=>{executions++;assert.deepEqual(actions,[{type:'minimize',ids:[note.id]}]);return 'Minimized Notes 1.'}})));
  await waitFor(()=>window.document.querySelector('#ai-model option[value="chatgpt::gpt-test"]'));
  const composer=window.document.querySelector('#ai-message');await act(async()=>setReactValue(composer,'Minimize Notes.','HTMLTextAreaElement'));await act(async()=>window.document.querySelector('.assistant-compose').requestSubmit());
  await waitFor(()=>window.document.querySelector('[aria-label="Review workspace action"]'));
  assert.match(window.document.querySelector('[aria-label="Review workspace action"]').textContent,/Minimize/i);assert.equal(executions,0,'proposal is not applied before explicit review');
  await act(async()=>window.document.querySelector('[aria-label="Review workspace action"] button.primary').click());
  await waitFor(()=>executions===1&&calls.filter(call=>call.command==='chatgpt_plan_agent_turn').length===3);
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
  await waitFor(()=>window.document.querySelector('[aria-label="Add one Notes widget?"]'));assert.equal(executions,0);assert.equal(calls.some(call=>call.command==='assistant_chat'),false);
  await act(async()=>window.document.querySelector('[aria-label="Add one Notes widget?"] button.primary').click());await waitFor(()=>executions===1&&calls.filter(call=>call.command==='assistant_agent_turn').length===3);await waitFor(()=>[...window.document.querySelectorAll('.assistant-message.model p')].some(node=>node.textContent==='Added Notes 1.'));
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
