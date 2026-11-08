import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createElement,act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {mockIPC,clearMocks} from '@tauri-apps/api/mocks';
import {createServer} from 'vite';

const vite=await createServer({server:{middlewareMode:true,hmr:false,watch:{ignored:['**/src-tauri/**']}},appType:'custom',optimizeDeps:{noDiscovery:true,entries:[]}});
after(()=>vite.close());
const setGlobal=(key,value)=>Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});

test('Files creates a folder inside the current granted folder and opens it after refresh',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true}),{window}=dom;
 const globals={window,document:window.document,navigator:window.navigator,localStorage:window.localStorage,HTMLElement:window.HTMLElement,Element:window.Element,Node:window.Node,MutationObserver:window.MutationObserver,IS_REACT_ACT_ENVIRONMENT:true,isTauri:true};
 const old=Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]),calls=[];let root,refreshes=0;
 try{
  for(const [key,value] of Object.entries(globals))setGlobal(key,value);
  window.__TAURI_INTERNALS__={};
  mockIPC((command,args)=>{calls.push({command,args});if(command==='files_create_folder'){if(args.name==='CON')throw new Error('Choose a valid folder name.');return{rootName:'Course',location:'lectures',entries:[]}}return null},{shouldMockEvents:true});
  const {default:NotesLibraryExplorer}=await vite.ssrLoadModule('/src/NotesLibraryExplorer.tsx');
  root=createRoot(window.document.querySelector('#root'));
  await act(async()=>root.render(createElement(NotesLibraryExplorer,{widgetId:'course-library',connected:true,libraryName:'Course',entries:[{path:'lectures/one.md',name:'one.md',size:0}],busy:false,error:'',newName:'',onNewName(){},onRefresh:async()=>{refreshes++},onChoose(){},onCreate:async()=>null,onOpenNote:async()=>{},renderNoteEditor:()=>null})));
  const folder=window.document.querySelector('[data-file-path="lectures"]');assert.ok(folder);await act(async()=>folder.click());
  const openForm=[...window.document.querySelectorAll('button')].find(item=>item.textContent==='New folder');assert.ok(openForm);await act(async()=>openForm.click());
  const nameInput=window.document.querySelector('[aria-label="New folder name"]');assert.ok(nameInput,'the explorer exposes a folder creation control');
  const setName=async value=>{const input=window.document.querySelector('[aria-label="New folder name"]'),props=input[Object.keys(input).find(key=>key.startsWith('__reactProps$'))];await act(async()=>props.onChange({target:{value}}))};
  await setName('CON');
  const button=[...window.document.querySelectorAll('button')].find(item=>item.textContent==='Create folder');assert.ok(button);
  await act(async()=>{button.click();await new Promise(resolve=>setTimeout(resolve,30))});
  assert.match(window.document.querySelector('[role="alert"]')?.textContent??'',/valid folder name/,'native validation errors are shown in the Files explorer');
  assert.equal(refreshes,0,'failed folder creation does not refresh or move into a folder');
  await setName('Week 1');
  await act(async()=>{button.click();await new Promise(resolve=>setTimeout(resolve,30))});
  assert.deepEqual(calls.filter(call=>call.command==='files_create_folder').map(call=>call.args),[{id:'course-library',location:'lectures',name:'CON'},{id:'course-library',location:'lectures',name:'Week 1'}]);
  assert.equal(refreshes,1,'the folder listing refreshes after a successful create');
  assert.ok([...window.document.querySelectorAll('.note-library-location button')].some(item=>item.textContent==='Week 1'),'the newly created folder becomes the current location');
 }finally{
  if(root)await act(async()=>root.unmount());clearMocks();dom.window.close();
  for(const [key,descriptor] of old){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}
 }
});
