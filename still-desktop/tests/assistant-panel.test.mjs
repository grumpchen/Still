import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createElement,act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {mockIPC,clearMocks} from '@tauri-apps/api/mocks';
import {createServer} from 'vite';
import {createWidget,createWorkspace} from '../src/domain/workspaces.ts';
import {assistantAddedWidgetReceipt,validateAssistantActionIntent} from '../src/domain/assistant.ts';

const vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,entries:[]}});
after(()=>vite.close());
function setGlobal(key,value){Object.defineProperty(globalThis,key,{configurable:true,writable:true,value})}
function setReactValue(node,value,elementType,caret){Object.getOwnPropertyDescriptor(node.ownerDocument.defaultView[elementType].prototype,'value').set.call(node,value);if(caret!==undefined)node.setSelectionRange(caret,caret);const props=node[Object.keys(node).find(key=>key.startsWith('__reactProps$'))];props?.onChange?.({target:node,currentTarget:node})}
function setReactChecked(node,value){Object.getOwnPropertyDescriptor(node.ownerDocument.defaultView.HTMLInputElement.prototype,'checked').set.call(node,value);const props=node[Object.keys(node).find(key=>key.startsWith('__reactProps$'))];props?.onChange?.({target:node,currentTarget:node})}
async function waitFor(predicate){const deadline=Date.now()+3000;while(Date.now()<deadline){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,10))}assert.ok(predicate(),`Timed out waiting for assistant UI; visible error: ${globalThis.document?.querySelector('.assistant-error')?.textContent??'none'}`)}

test('the single chat can use workspace widgets; @ is optional quick selection and screenshot target',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true}),{window}=dom,old=new Map();
 for(const key of ['window','document','navigator','localStorage','innerWidth','innerHeight','HTMLElement','Element','Node','MutationObserver','requestAnimationFrame','cancelAnimationFrame','IS_REACT_ACT_ENVIRONMENT','isTauri','createImageBitmap'])old.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
 const calls=[],encodedImages=[];let root;
 try{
  for(const [key,value] of Object.entries({window,document:window.document,navigator:window.navigator,localStorage:window.localStorage,innerWidth:window.innerWidth,innerHeight:window.innerHeight,HTMLElement:window.HTMLElement,Element:window.Element,Node:window.Node,MutationObserver:window.MutationObserver,requestAnimationFrame:callback=>setTimeout(()=>callback(Date.now()),0),cancelAnimationFrame:clearTimeout,IS_REACT_ACT_ENVIRONMENT:true,isTauri:true,createImageBitmap:async()=>({width:3840,height:2160,close(){}})}))setGlobal(key,value);
  window.HTMLElement.prototype.scrollTo=function(){};
  window.HTMLTextAreaElement.prototype.focus=function(){};
  window.HTMLCanvasElement.prototype.getContext=function(){return{drawImage(){}}};window.HTMLCanvasElement.prototype.toDataURL=function(type,quality){encodedImages.push({width:this.width,height:this.height,type,quality});return 'data:image/jpeg;base64,/9j/AA=='};
  window.__TAURI_INTERNALS__={};
  const canvas=window.document.createElement('div');canvas.className='canvas-viewport';canvas.getBoundingClientRect=()=>({left:0,top:0,right:800,bottom:600,width:800,height:600,x:0,y:0,toJSON(){}});window.document.body.append(canvas);
  mockIPC((command,args)=>{calls.push({command,args});
   if(command==='assistant_configured')return args.provider==='gemini';
   if(command==='assistant_models')return args.provider==='gemini'?['gemini-2.5-flash']:[];
   if(command==='assistant_set_key')return args.provider==='openai'?['gpt-4o-mini']:['gemini-2.5-flash'];
   if(command==='assistant_chat')return{reply:'I can help with that.',layout:[]};
   if(command==='widget_capture')return[137,80,78,71];
   return null;
  },{shouldMockEvents:true});
  const {default:AssistantPanel}=await vite.ssrLoadModule('/src/AssistantPanel.tsx');
  const workspace=createWorkspace('Study',[]),note=createWidget('notes'),timer=createWidget('focus'),app=createWidget('apps'),timetable=createWidget('timetable');note.text='My private note';note.placement={x:0,y:0,width:300,height:250};timer.placement={x:330,y:0,width:300,height:350};app.placement={x:660,y:0,width:300,height:350};app.title='Microsoft Edge';workspace.widgets=[note,timer,app,timetable];
  const appCard=window.document.createElement('article');appCard.id='widget-'+app.id;appCard.className='canvas-card';appCard.getBoundingClientRect=()=>({left:100,top:100,right:400,bottom:300,width:300,height:200,x:100,y:100,toJSON(){}});const nativeHost=window.document.createElement('div');nativeHost.dataset.nativeAppId=app.id;nativeHost.dataset.nativeVisible='true';nativeHost.getBoundingClientRect=()=>({left:110,top:130,right:390,bottom:290,width:280,height:160,x:110,y:130,toJSON(){}});appCard.append(nativeHost);canvas.append(appCard);
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
  assert.equal(geminiRequest.image,'/9j/AA==','the default workspace screenshot is attached to the current request');
  assert.deepEqual(encodedImages[0],{width:2560,height:1440,type:'image/jpeg',quality:0.92},'workspace screenshots retain high-resolution, high-quality color detail');
  assert.equal(window.localStorage.getItem('still-assistant-chat-v1:'+encodeURIComponent(workspace.id)).includes('/9j/AA=='),false,'the screenshot is excluded from saved chat history');
  assert.equal(context.canvasAndWidgets.widgets.length,4,'layout requests always include all widget geometry');
  assert.equal(context.widgetData.length,4,'all current workspace widget data is available for assistant requests');
  assert.equal(context.widgetData.find(widget=>widget.type==='notes').text,'My private note');
  assert.equal(context.widgetData.find(widget=>widget.type==='focus').remainingSeconds,1500,'the assistant can access Focus state without requiring @');
  assert.equal(context.widgetData.find(widget=>widget.title==='Microsoft Edge').quickSelected,false);
  assert.equal(window.document.querySelector('[aria-label="Read widget"]'),null);
  assert.equal(window.document.querySelector('[aria-label="Arrange layout"]'),null);

  await act(async()=>setReactValue(input,'@Microsoft Edge @Timetable can you create timetable according to my edge','HTMLTextAreaElement'));
  assert.deepEqual([...window.document.querySelectorAll('.assistant-mentions button')].map(button=>button.textContent.trim()),['@ Microsoft Edge ×','@ Timetable 1 ×']);
  assert.ok(window.document.querySelector('.assistant-check input[type="checkbox"]'),'the Edge screenshot stays selectable alongside the Timetable content');

  await act(async()=>window.document.querySelector('[aria-label="AI settings"]').click());
  const workspaceImageSetting=window.document.querySelector('[aria-label="Share workspace screenshot with Still AI"]');assert.ok(workspaceImageSetting?.checked,'workspace image sharing is enabled by default in Still AI settings');
  await act(async()=>setReactChecked(workspaceImageSetting,false));assert.equal(window.localStorage.getItem('still-assistant-share-workspace-image'),'false','the setting remembers when sharing is turned off');
  await act(async()=>setReactChecked(workspaceImageSetting,true));
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
  const appOption=[...window.document.querySelectorAll('[role="option"]')].find(item=>item.textContent.includes('Microsoft Edge'));
  assert.ok(appOption,'the app widget is available in the @ picker');
  await act(async()=>appOption.click());
  const visualToggle=window.document.querySelector('.assistant-check input[type="checkbox"]');
  assert.ok(visualToggle,'the per-message visual toggle is available with OpenAI selected');
  await act(async()=>setReactChecked(visualToggle,false));
  assert.equal(visualToggle.checked,false,'a selected app image is not required when workspace visual sharing is on');
  assert.equal(calls.filter(call=>call.command==='assistant_chat').length,1,'toggling visual sharing never sends a request on its own');
  await act(async()=>window.document.querySelector('.assistant-compose').requestSubmit());
  await waitFor(()=>calls.filter(call=>call.command==='assistant_chat').length===2);
  const appCapture=calls.filter(call=>call.command==='widget_capture').at(-1);
  assert.deepEqual(appCapture.args.appRegion,{id:app.id,x:110,y:130,width:280,height:160},'@-selecting an attached app automatically includes its visible native pixels');
  assert.equal(calls.filter(call=>call.command==='assistant_chat').at(-1).args.request.image,'/9j/AA==');
  assert.deepEqual(encodedImages[1],{width:2560,height:1440,type:'image/jpeg',quality:0.92},'widget screenshots use the same high-quality encoding');
 }finally{
  if(root)await act(async()=>root.unmount());clearMocks();dom.window.close();
  for(const key of old.keys()){const descriptor=old.get(key);if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}
 }
});

test('widget add commands show replies and provider chat carries complete action history',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true}),{window}=dom,old=new Map();
 for(const key of ['window','document','navigator','localStorage','HTMLElement','Element','Node','MutationObserver','requestAnimationFrame','cancelAnimationFrame','IS_REACT_ACT_ENVIRONMENT','isTauri'])old.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
 const calls=[],actions=[];let root;
 try{
  for(const [key,value] of Object.entries({window,document:window.document,navigator:window.navigator,localStorage:window.localStorage,HTMLElement:window.HTMLElement,Element:window.Element,Node:window.Node,MutationObserver:window.MutationObserver,requestAnimationFrame:callback=>setTimeout(()=>callback(Date.now()),0),cancelAnimationFrame:clearTimeout,IS_REACT_ACT_ENVIRONMENT:true,isTauri:true}))setGlobal(key,value);
  window.HTMLElement.prototype.scrollTo=function(){};window.HTMLTextAreaElement.prototype.focus=function(){};window.__TAURI_INTERNALS__={};
  window.localStorage.setItem('still-assistant-share-workspace-image','false');
  mockIPC((command,args)=>{calls.push({command,args});if(command==='assistant_configured')return true;if(command==='assistant_models')return['gemini-2.5-flash'];if(command==='assistant_chat'){
    const prompt=args.request.messages.at(-1).text;
    if(prompt==='hi')return{intent:'chat',reply:'Hello! I am here to help.',layout:[{id:timetable.id,x:0,y:0,width:350,height:400}],actions:[{type:'edit_widget',ids:[timetable.id],title:'Unexpected edit'}]};
    if(prompt==='what is a black hole?')return{intent:'chat',reply:'It is a region where gravity is so strong that light cannot escape.',layout:[],actions:[{type:'remove_widget',ids:[timetable.id]}]};
    if(prompt==='make notes widget')throw new Error('Gemini returned an oversized or empty answer.');
    if(prompt==='edit timetable with details')return{reply:'Which class should I add?',layout:[],actions:[{type:'edit_widget',ids:[timetable.id],schedule:[{id:'class-1',day:1,time:'09:00',title:'Chemistry',location:'Room 1'}]}]};
    if(prompt==='I need somewhere to take notes')return{reply:'',layout:[],actions:[{type:'add_widget',ids:['notes'],title:'My notes',text:'Ready to write.'}]};
    if(prompt==='create notes with content')return{reply:'What would you like the note to contain?',layout:[],actions:[]};
    if(prompt==='open focus with details')return{reply:'I can restore Focus.',layout:[],actions:[{type:'restore',ids:[workspace.widgets.find(widget=>widget.type==='focus').id]}]};
    return{reply:'Still is ready.',layout:[],actions:[]};
  }return null},{shouldMockEvents:true});
  const {default:AssistantPanel}=await vite.ssrLoadModule('/src/AssistantPanel.tsx');
  const workspace=createWorkspace('Study',[]),timetable=createWidget('timetable');workspace.widgets=[timetable];root=createRoot(window.document.querySelector('#root'));
  const props={workspace,trayItems:[],open:true,close(){},dimensions:()=>({width:900,height:700}),apply(){},undo(){},startTimer:async()=>'',clearTray:async()=>'',deleteWidgets:async()=>'',act:async(_id,items,prompt)=>{validateAssistantActionIntent(prompt,workspace,items);actions.push(...items);return items.some(item=>item.type==='add_widget')?assistantAddedWidgetReceipt(items):'Applied widget changes. Undo change restores the widgets.'}};
  await act(async()=>root.render(createElement(AssistantPanel,props)));
  await waitFor(()=>window.document.querySelector('#ai-model option[value="gemini::gemini-2.5-flash"]'));
  const composer=window.document.querySelector('#ai-message');
  await act(async()=>setReactValue(composer,'edit the timetable','HTMLTextAreaElement'));
  await act(async()=>window.document.querySelector('.assistant-compose').requestSubmit());
  await waitFor(()=>[...window.document.querySelectorAll('.assistant-message.model p')].some(message=>/what should I change in the timetable/i.test(message.textContent)));
  assert.equal(actions.length,0,'an unspecified timetable edit makes no workspace change');
  assert.equal(calls.filter(call=>call.command==='assistant_chat').length,0,'the user gets a clarification before a model can guess an edit');
  await act(async()=>setReactValue(composer,'make the notes better','HTMLTextAreaElement'));
  await act(async()=>window.document.querySelector('.assistant-compose').requestSubmit());
  await waitFor(()=>[...window.document.querySelectorAll('.assistant-message.model p')].some(message=>/what should I change in the note/i.test(message.textContent)));
  assert.equal(actions.length,0,'vague make requests cannot be mistaken for widget creation');
  assert.equal(calls.filter(call=>call.command==='assistant_chat').length,0);
  await act(async()=>setReactValue(composer,'edit timetable with details','HTMLTextAreaElement'));
  await act(async()=>window.document.querySelector('.assistant-compose').requestSubmit());
  await waitFor(()=>[...window.document.querySelectorAll('.assistant-message.model p')].some(message=>message.textContent==='Which class should I add?'));
  assert.equal(actions.length,0,'a model clarification question suppresses any accompanying edit action');
  await act(async()=>setReactValue(composer,'add focus widget','HTMLTextAreaElement'));
  await act(async()=>window.document.querySelector('.assistant-compose').requestSubmit());
  await waitFor(()=>[...window.document.querySelectorAll('.assistant-message.model p')].some(message=>message.textContent==='Added a Focus widget.'));
  assert.deepEqual(actions,[{type:'add_widget',ids:['focus']}]);
  assert.ok([...window.document.querySelectorAll('.assistant-message.model p')].every(message=>message.textContent.trim()),'the add operation never creates a blank model turn');
  await act(async()=>setReactValue(composer,'make notes widget','HTMLTextAreaElement'));
  await act(async()=>window.document.querySelector('.assistant-compose').requestSubmit());
  await waitFor(()=>actions.length===2&&[...window.document.querySelectorAll('.assistant-message.model p')].some(message=>message.textContent==='Added a Notes widget.'));
  assert.deepEqual(actions[1],{type:'add_widget',ids:['notes']});
  assert.equal(calls.filter(call=>call.command==='assistant_chat').length,1,'make notes widget creates locally; only the preceding specified edit called the model');
  await act(async()=>setReactValue(composer,'hi','HTMLTextAreaElement'));
  await act(async()=>window.document.querySelector('.assistant-compose').requestSubmit());
  await waitFor(()=>calls.filter(call=>call.command==='assistant_chat').length===2);
  await waitFor(()=>[...window.document.querySelectorAll('.assistant-message.model p')].some(message=>message.textContent==='Hello! I am here to help.'));
  assert.equal(window.document.querySelector('.assistant-error'),null,'a greeting is answered as chat rather than shown as a workspace-operation error');
  assert.equal(actions.length,2,'spurious layout and widget-edit suggestions from a greeting are discarded');
  await act(async()=>setReactValue(composer,'what is a black hole?','HTMLTextAreaElement'));
  await act(async()=>window.document.querySelector('.assistant-compose').requestSubmit());
  await waitFor(()=>calls.filter(call=>call.command==='assistant_chat').length===3);
  await waitFor(()=>[...window.document.querySelectorAll('.assistant-message.model p')].some(message=>message.textContent==='It is a region where gravity is so strong that light cannot escape.'));
  assert.equal(actions.length,2,'an unrelated freeform question stays conversational without phrase-specific rules');
  const history=calls.filter(call=>call.command==='assistant_chat').at(-1).args.request.messages;
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
  const beforeIndirect=actions.length;
  await act(async()=>setReactValue(composer,'I need somewhere to take notes','HTMLTextAreaElement'));
  await act(async()=>window.document.querySelector('.assistant-compose').requestSubmit());
  await waitFor(()=>window.document.querySelector('[aria-label="Confirm suggested widget changes"]'));
  assert.equal(actions.length,beforeIndirect,'indirect requests offer useful actions without silently applying changes');
  assert.ok(window.document.querySelector('[aria-label="Confirm suggested widget changes"]').textContent.includes('My notes'));
  await act(async()=>window.document.querySelector('[aria-label="Confirm suggested widget changes"] button.primary').click());
  await waitFor(()=>actions.length===beforeIndirect+1);
  assert.equal(actions.at(-1).text,'Ready to write.');
  await act(async()=>setReactValue(composer,'create notes with content','HTMLTextAreaElement'));
  await act(async()=>window.document.querySelector('.assistant-compose').requestSubmit());
  await waitFor(()=>[...window.document.querySelectorAll('.assistant-message.model p')].some(message=>message.textContent.includes('What would you like the note to contain?')));
  assert.equal(actions.length,beforeIndirect+1,'a helpful follow-up question does not execute an action');
  const beforeRestore=actions.length;
  await act(async()=>setReactValue(composer,'open focus with details','HTMLTextAreaElement'));
  await act(async()=>window.document.querySelector('.assistant-compose').requestSubmit());
  await waitFor(()=>window.document.querySelector('[aria-label="Confirm suggested widget changes"]'));
  assert.equal(actions.length,beforeRestore,'semantic differences are offered for review instead of failing the wording gate');
  await act(async()=>window.document.querySelector('[aria-label="Confirm suggested widget changes"] button.primary').click());
  await waitFor(()=>actions.length===beforeRestore+1);
  assert.equal(actions.at(-1).type,'restore','confirmed model interpretation passes the same action checks as App');
 }finally{
  if(root)await act(async()=>root.unmount());clearMocks();dom.window.close();
  for(const key of old.keys()){const descriptor=old.get(key);if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}
 }
});
