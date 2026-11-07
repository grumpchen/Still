import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createElement,act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {mockIPC,clearMocks} from '@tauri-apps/api/mocks';
import {createServer} from 'vite';
const vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,entries:[]}});
after(()=>vite.close());

test('Library tools require explicit names sharing and Apply, support Cancel and recover native Undo history',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true}),saved=new Map();
 const values={window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,Node:dom.window.Node,MutationObserver:dom.window.MutationObserver,IS_REACT_ACT_ENVIRONMENT:true,isTauri:true};
 for(const [key,value] of Object.entries(values)){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{configurable:true,writable:true,value})}
 let root;
 try{
  dom.window.__TAURI_INTERNALS__={};
  const snapshot={version:1,rootId:'root-1',rootName:'Course',entries:[],truncated:false},calls=[],contexts=[],messages=[];let history=[],applied=0,undone=0,proposal=null;
  mockIPC((command,args)=>{calls.push({command,args});if(command==='files_organisation_snapshot')return snapshot;if(command==='files_organisation_history')return history;return null});
  const {default:Tools}=await vite.ssrLoadModule('/src/AssistantLibraryTools.tsx');
  root=createRoot(dom.window.document.querySelector('#root'));
  const render=()=>root.render(createElement(Tools,{roots:[{widgetId:'files-1',name:'Course'}],proposal,busy:false,contextChanged:value=>contexts.push(value),clearProposal:()=>{proposal=null;render()},workingChanged(){},receipt:text=>messages.push(text),apply:async(id,rootId,operation)=>{applied++;const receipt={id:operation.id,rootId,type:operation.type,sourcePath:null,destinationPath:'Lectures',entryId:'created-1',revision:'created-rev',undoToken:'undo-1',affectedCount:1};history=[receipt];return receipt},undo:async()=>{undone++;history=[];return{sourcePath:'Lectures',destinationPath:'',removedFolder:true}}}));
  await act(async()=>render());
  const select=dom.window.document.querySelector('select');
  await act(async()=>{select.value='files-1';select.dispatchEvent(new dom.window.Event('change',{bubbles:true}))});
  assert.equal(calls.length,0,'choosing a root alone never scans or modifies files');
  const button=text=>[...dom.window.document.querySelectorAll('button')].find(button=>button.textContent.includes(text));
  await act(async()=>{button('Share folder names').click();await new Promise(resolve=>setTimeout(resolve,30))});
  assert.ok(contexts.at(-1)?.snapshot);assert.equal(applied,0);
  const change={version:1,rootId:'root-1',operations:[{version:1,id:'create-1',type:'create_folder',parentId:'root-1',name:'Lectures',reason:'Group lectures'}]};
  proposal=change;await act(async()=>render());
  await act(async()=>button('Cancel').click());assert.equal(applied,0,'Cancel leaves filesystem unchanged');
  proposal=change;await act(async()=>render());
  await act(async()=>{button('Apply selected').click();button('Apply selected')?.click();await new Promise(resolve=>setTimeout(resolve,30))});
  assert.equal(applied,1,'double Apply cannot replay the proposal');assert.match(messages.at(-1),/Completed 1/);assert.equal(contexts.at(-1),null,'stale names are revoked after mutation');
  await act(async()=>{button('Undo').click();await new Promise(resolve=>setTimeout(resolve,30))});
  assert.equal(undone,1);assert.match(messages.at(-1),/empty folder Lectures/);
 }finally{if(root)await act(async()=>root.unmount());clearMocks();dom.window.close();for(const [key,descriptor] of saved){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}}
});
