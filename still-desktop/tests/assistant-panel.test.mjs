import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createElement,act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {mockIPC,clearMocks} from '@tauri-apps/api/mocks';
import {createServer} from 'vite';
import {createWidget,createWorkspace} from '../src/domain/workspaces.ts';
import {assistantAddedWidgetReceipt} from '../src/domain/assistant.ts';

const vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,entries:[]}});
after(()=>vite.close());
function setGlobal(key,value){Object.defineProperty(globalThis,key,{configurable:true,writable:true,value})}
function setReactValue(node,value,elementType,caret){Object.getOwnPropertyDescriptor(node.ownerDocument.defaultView[elementType].prototype,'value').set.call(node,value);if(caret!==undefined)node.setSelectionRange(caret,caret);const props=node[Object.keys(node).find(key=>key.startsWith('__reactProps$'))];props?.onChange?.({target:node,currentTarget:node})}
function setReactChecked(node,value){Object.getOwnPropertyDescriptor(node.ownerDocument.defaultView.HTMLInputElement.prototype,'checked').set.call(node,value);const props=node[Object.keys(node).find(key=>key.startsWith('__reactProps$'))];props?.onChange?.({target:node,currentTarget:node})}
async function waitFor(predicate){const deadline=Date.now()+3000;while(Date.now()<deadline){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,10))}assert.ok(predicate(),'Timed out waiting for assistant UI')}

test('the single chat shares @-selected widgets, carries layout context and lists provider models at the bottom',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true}),{window}=dom,old=new Map();
 for(const key of ['window','document','navigator','HTMLElement','Element','Node','MutationObserver','requestAnimationFrame','cancelAnimationFrame','IS_REACT_ACT_ENVIRONMENT','isTauri'])old.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
 const calls=[];let root;
 try{
  for(const [key,value] of Object.entries({window,document:window.document,navigator:window.navigator,HTMLElement:window.HTMLElement,Element:window.Element,Node:window.Node,MutationObserver:window.MutationObserver,requestAnimationFrame:callback=>setTimeout(()=>callback(Date.now()),0),cancelAnimationFrame:clearTimeout,IS_REACT_ACT_ENVIRONMENT:true,isTauri:true}))setGlobal(key,value);
  window.HTMLElement.prototype.scrollTo=function(){};
  window.HTMLTextAreaElement.prototype.focus=function(){};
  window.__TAURI_INTERNALS__={};
  mockIPC((command,args)=>{calls.push({command,args});
   if(command==='assistant_configured')return args.provider==='gemini';
   if(command==='assistant_models')return args.provider==='gemini'?['gemini-2.5-flash']:[];
   if(command==='assistant_set_key')return args.provider==='openai'?['gpt-4o-mini']:['gemini-2.5-flash'];
   if(command==='assistant_chat')return{reply:'I can help with that.',layout:[]};
   return null;
  },{shouldMockEvents:true});
  const {default:AssistantPanel}=await vite.ssrLoadModule('/src/AssistantPanel.tsx');
  const workspace=createWorkspace('Study',[]),note=createWidget('notes'),timer=createWidget('focus'),app=createWidget('apps');note.text='My private note';note.placement={x:0,y:0,width:300,height:250};timer.placement={x:330,y:0,width:300,height:350};app.placement={x:660,y:0,width:300,height:350};app.title='Chrome';workspace.widgets=[note,timer,app];
  root=createRoot(window.document.querySelector('#root'));
  await act(async()=>root.render(createElement(AssistantPanel,{workspace,open:true,close(){},dimensions:()=>({width:900,height:700}),apply(){},undo(){}})));
  await waitFor(()=>window.document.querySelector('#ai-model')?.querySelector('option[value="gemini::gemini-2.5-flash"]'));
  const input=window.document.querySelector('#ai-message');
  await act(async()=>setReactValue(input,'@','HTMLTextAreaElement',1));
  await waitFor(()=>window.document.querySelector('[role="listbox"]'));
  assert.ok([...window.document.querySelectorAll('[role="option"]')].some(item=>item.textContent==='All widgets'));
  assert.ok([...window.document.querySelectorAll('[role="option"]')].some(item=>item.textContent==='Notes 1'));
  const noteOption=[...window.document.querySelectorAll('[role="option"]')].find(item=>item.textContent==='Notes 1');
  await act(async()=>noteOption.click());
  const composer=window.document.querySelector('#ai-message');
  await act(async()=>setReactValue(composer,composer.value+'Summarise this','HTMLTextAreaElement',composer.value.length+'Summarise this'.length));
  await act(async()=>window.document.querySelector('.assistant-compose').requestSubmit());
  await waitFor(()=>calls.some(call=>call.command==='assistant_chat'));
  const geminiRequest=calls.find(call=>call.command==='assistant_chat').args.request,context=JSON.parse(geminiRequest.context);
  assert.equal(context.canvasAndWidgets.widgets.length,3,'layout requests always include all widget geometry');
  assert.equal(context.selectedWidgets.length,1,'ordinary chat shares only the chosen widget contents');
  assert.equal(context.selectedWidgets[0].text,'My private note');
  assert.ok(!JSON.stringify(context.selectedWidgets).includes('88'));
  assert.equal(window.document.querySelector('[aria-label="Read widget"]'),null);
  assert.equal(window.document.querySelector('[aria-label="Arrange layout"]'),null);

  await act(async()=>window.document.querySelector('[aria-label="AI settings"]').click());
  const provider=window.document.querySelector('.assistant-settings select');
  await act(async()=>{provider.value='openai';provider.dispatchEvent(new window.Event('change',{bubbles:true}))});
  await waitFor(()=>calls.some(call=>call.command==='assistant_configured'&&call.args.provider==='openai'));
  const key=window.document.querySelector('.assistant-settings input[type="password"]');
  await act(async()=>setReactValue(key,'test-openai-key-123','HTMLInputElement'));
  await act(async()=>window.document.querySelector('.assistant-settings').requestSubmit());
  await waitFor(()=>window.document.querySelector('#ai-model option[value="openai::gpt-4o-mini"]'));
  assert.ok(calls.some(call=>call.command==='assistant_set_key'&&call.args.provider==='openai'&&call.args.key==='test-openai-key-123'));
  const model=window.document.querySelector('#ai-model');
  await act(async()=>{model.value='openai::gpt-4o-mini';model.dispatchEvent(new window.Event('change',{bubbles:true}))});
  assert.equal(model.value,'openai::gpt-4o-mini','model choice is offered in the chat footer');
  const visualComposer=window.document.querySelector('#ai-message');
  await act(async()=>setReactValue(visualComposer,'@','HTMLTextAreaElement',1));
  await waitFor(()=>window.document.querySelector('[role="listbox"]'));
  const appOption=[...window.document.querySelectorAll('[role="option"]')].find(item=>item.textContent.includes('Chrome'));
  assert.ok(appOption,'the app widget is available in the @ picker');
  await act(async()=>appOption.click());
  const visualToggle=window.document.querySelector('.assistant-check input[type="checkbox"]');
  assert.ok(visualToggle,'the per-message visual toggle is available with OpenAI selected');
  await act(async()=>setReactChecked(visualToggle,true));
  assert.equal(visualToggle.checked,true,'the screenshot can be opted in for this message');
  assert.equal(calls.filter(call=>call.command==='assistant_chat').length,1,'toggling visual sharing never sends a request on its own');
 }finally{
  if(root)await act(async()=>root.unmount());clearMocks();dom.window.close();
  for(const key of old.keys()){const descriptor=old.get(key);if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}
 }
});

test('widget add commands show replies and provider chat carries complete action history',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true}),{window}=dom,old=new Map();
 for(const key of ['window','document','navigator','HTMLElement','Element','Node','MutationObserver','requestAnimationFrame','cancelAnimationFrame','IS_REACT_ACT_ENVIRONMENT','isTauri'])old.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
 const calls=[],actions=[];let root;
 try{
  for(const [key,value] of Object.entries({window,document:window.document,navigator:window.navigator,HTMLElement:window.HTMLElement,Element:window.Element,Node:window.Node,MutationObserver:window.MutationObserver,requestAnimationFrame:callback=>setTimeout(()=>callback(Date.now()),0),cancelAnimationFrame:clearTimeout,IS_REACT_ACT_ENVIRONMENT:true,isTauri:true}))setGlobal(key,value);
  window.HTMLElement.prototype.scrollTo=function(){};window.HTMLTextAreaElement.prototype.focus=function(){};window.__TAURI_INTERNALS__={};
  mockIPC((command,args)=>{calls.push({command,args});if(command==='assistant_configured')return true;if(command==='assistant_models')return['gemini-2.5-flash'];if(command==='assistant_chat')return{reply:'Still is ready.',layout:[],actions:[]};return null},{shouldMockEvents:true});
  const {default:AssistantPanel}=await vite.ssrLoadModule('/src/AssistantPanel.tsx');
  const workspace=createWorkspace('Study',[]);root=createRoot(window.document.querySelector('#root'));
  const props={workspace,trayItems:[],open:true,close(){},dimensions:()=>({width:900,height:700}),apply(){},undo(){},startTimer:async()=>'',clearTray:async()=>'',deleteWidgets:async()=>'',act:async(_id,items)=>{actions.push(...items);return items.some(item=>item.type==='add_widget')?assistantAddedWidgetReceipt(items):'Removed Focus from Study. Undo change restores the widget.'}};
  await act(async()=>root.render(createElement(AssistantPanel,props)));
  await waitFor(()=>window.document.querySelector('#ai-model option[value="gemini::gemini-2.5-flash"]'));
  const composer=window.document.querySelector('#ai-message');
  await act(async()=>setReactValue(composer,'add focus widget','HTMLTextAreaElement'));
  await act(async()=>window.document.querySelector('.assistant-compose').requestSubmit());
  await waitFor(()=>[...window.document.querySelectorAll('.assistant-message.model p')].some(message=>message.textContent==='Added a Focus widget.'));
  assert.deepEqual(actions,[{type:'add_widget',ids:['focus']}]);
  assert.ok([...window.document.querySelectorAll('.assistant-message.model p')].every(message=>message.textContent.trim()),'the add operation never creates a blank model turn');
  await act(async()=>setReactValue(composer,'add note','HTMLTextAreaElement'));
  await act(async()=>window.document.querySelector('.assistant-compose').requestSubmit());
  await waitFor(()=>actions.length===2&&[...window.document.querySelectorAll('.assistant-message.model p')].some(message=>message.textContent==='Added a Notes widget.'));
  assert.deepEqual(actions[1],{type:'add_widget',ids:['notes']});
  await act(async()=>setReactValue(composer,'hello','HTMLTextAreaElement'));
  await act(async()=>window.document.querySelector('.assistant-compose').requestSubmit());
  await waitFor(()=>calls.some(call=>call.command==='assistant_chat'));
  const history=calls.find(call=>call.command==='assistant_chat').args.request.messages;
  assert.ok(history.every(message=>message.text.trim()),'legacy empty assistant replies are not sent to the provider');
  assert.equal(history.find(message=>message.text==='Added a Focus widget.')?.role,'model','the action receipt is included in future chat history');
  const focus=createWidget('focus');workspace.widgets.push(focus);
  await act(async()=>root.render(createElement(AssistantPanel,props)));
  await act(async()=>setReactValue(composer,'remove focus','HTMLTextAreaElement'));
  await act(async()=>window.document.querySelector('.assistant-compose').requestSubmit());
  await waitFor(()=>window.document.querySelector('[aria-label="Confirm removing selected widgets"]'));
  assert.equal(actions.filter(action=>action.type==='remove_widget').length,0,'the widget stays until removal is confirmed');
  await act(async()=>window.document.querySelector('[aria-label="Confirm removing selected widgets"] button.primary').click());
  await waitFor(()=>actions.some(action=>action.type==='remove_widget'&&action.ids[0]===focus.id));
 }finally{
  if(root)await act(async()=>root.unmount());clearMocks();dom.window.close();
  for(const key of old.keys()){const descriptor=old.get(key);if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}
 }
});
