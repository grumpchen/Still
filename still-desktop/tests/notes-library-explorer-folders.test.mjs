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
  mockIPC((command,args)=>{calls.push({command,args});if(command==='files_list')return{rootName:'Course',location:args.location,entries:args.location===''?[{name:'lectures',path:'lectures',directory:true,size:0,blocked:false}]:[],truncated:false};if(command==='files_create_folder'){if(args.name==='CON')throw new Error('Choose a valid folder name.');return{rootName:'Course',location:'lectures',entries:[]}}return null},{shouldMockEvents:true});
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

test('Files lists empty folders and unsupported documents with external viewer actions',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true}),{window}=dom;
 const globals={window,document:window.document,navigator:window.navigator,localStorage:window.localStorage,HTMLElement:window.HTMLElement,Element:window.Element,Node:window.Node,MutationObserver:window.MutationObserver,IS_REACT_ACT_ENVIRONMENT:true,isTauri:true};
 const old=Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]);let root;
 try{
  for(const [key,value] of Object.entries(globals))setGlobal(key,value);
  window.__TAURI_INTERNALS__={};mockIPC((command,args)=>{if(command==='files_list')return{rootName:'Course',location:args.location,entries:args.location===''?[{name:'Empty',path:'Empty',directory:true,size:0,blocked:false},{name:'Project',path:'Project',directory:true,size:0,blocked:false}]:[{name:'Report.docx',path:'Project/Report.docx',directory:false,size:42,blocked:false}],truncated:false};if(command==='files_preview')return{mimeType:'application/octet-stream',base64:''};if(command==='files_open')throw new Error('No default application is associated with this file.');return null},{shouldMockEvents:true});
  const {default:NotesLibraryExplorer}=await vite.ssrLoadModule('/src/NotesLibraryExplorer.tsx');
  root=createRoot(window.document.querySelector('#root'));
  await act(async()=>root.render(createElement(NotesLibraryExplorer,{widgetId:'course-library',connected:true,libraryName:'Course',entries:[{name:'Empty',path:'Empty',size:0,directory:true},{name:'Project',path:'Project',size:0,directory:true},{name:'Report.docx',path:'Project/Report.docx',size:42}],busy:false,error:'',newName:'',onNewName(){},onRefresh(){},onChoose(){},onCreate:async()=>null,onOpenNote:async()=>{},renderNoteEditor:()=>null})));
  assert.ok(window.document.querySelector('[data-file-path="Empty"]'),'an empty folder is listed explicitly');
  await act(async()=>window.document.querySelector('[data-file-path="Project"]').click());
  const documentRow=window.document.querySelector('[data-file-path="Project/Report.docx"]');assert.ok(documentRow,'unsupported documents remain visible in their folder');
  await act(async()=>{documentRow.click();await new Promise(resolve=>setTimeout(resolve,10))});
  assert.ok([...window.document.querySelectorAll('button')].some(button=>button.textContent==='Open default app'),'unsupported documents remain available to the system default viewer');
  const openDefault=[...window.document.querySelectorAll('button')].find(button=>button.textContent==='Open default app');
  await act(async()=>{openDefault.click();await new Promise(resolve=>setTimeout(resolve,10))});
  assert.match(window.document.querySelector('.unsupported-file-preview [role="alert"]')?.textContent??'',/No default application is associated/,'missing system handlers report their error in the preview area');
 }finally{if(root)await act(async()=>root.unmount());clearMocks();dom.window.close();for(const [key,descriptor] of old)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}
});

test('HTML preview is manual by default and can run in an isolated browser frame',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true}),{window}=dom;
 const globals={window,document:window.document,navigator:window.navigator,localStorage:window.localStorage,HTMLElement:window.HTMLElement,Element:window.Element,Node:window.Node,MutationObserver:window.MutationObserver,IS_REACT_ACT_ENVIRONMENT:true,isTauri:true};
 const old=Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]),calls=[];let root,previewAttempts=0;
 try{
  for(const [key,value] of Object.entries(globals))setGlobal(key,value);
  window.__TAURI_INTERNALS__={};mockIPC((command,args)=>{calls.push({command,args});if(command==='files_list')return{rootName:'Course',location:'',entries:[{name:'advanced.html',path:'advanced.html',directory:false,size:40,blocked:false}],truncated:false};if(command==='files_preview'){previewAttempts++;if(previewAttempts===1)throw new Error('HTML preview is not supported by the running native build');return{mimeType:'text/html',base64:Buffer.from('<html><head></head><body><script>alert(1)</script><p>Lecture</p></body></html>').toString('base64')}}return null},{shouldMockEvents:true});
  const {default:NotesLibraryExplorer}=await vite.ssrLoadModule('/src/NotesLibraryExplorer.tsx');root=createRoot(window.document.querySelector('#root'));
  await act(async()=>root.render(createElement(NotesLibraryExplorer,{widgetId:'course-library',connected:true,libraryName:'Course',entries:[{name:'advanced.html',path:'advanced.html',size:40}],busy:false,error:'',newName:'',onNewName(){},onRefresh(){},onChoose(){},onCreate:async()=>null,onOpenNote:async()=>{},renderNoteEditor:()=>null})));
  await act(async()=>{window.document.querySelector('[data-file-path="advanced.html"]').click();await new Promise(resolve=>setTimeout(resolve,10))});
  assert.equal(calls.filter(call=>call.command==='files_preview').length,0,'HTML contents are not read until the preview action is pressed');
  const previewButton=[...window.document.querySelectorAll('button')].find(button=>button.textContent==='Preview now');assert.ok(previewButton,'the user has an explicit on-demand preview button');
  await act(async()=>{previewButton.click();await new Promise(resolve=>setTimeout(resolve,20))});
  const retryButton=[...window.document.querySelectorAll('button')].find(button=>button.textContent==='Preview now');assert.ok(retryButton,'the on-demand button remains available after the native preview command fails');assert.match(window.document.querySelector('[role="alert"]')?.textContent??'',/not supported by the running native build/);
  await act(async()=>{retryButton.click();await new Promise(resolve=>setTimeout(resolve,20))});
  const frame=window.document.querySelector('.file-preview-html');assert.ok(frame,'HTML is displayed in Still after the user requests it');assert.equal(frame.getAttribute('sandbox'),'allow-scripts','page scripts can run in the isolated browser preview');assert.doesNotMatch(frame.getAttribute('sandbox'),/allow-same-origin/,'the page cannot access Still or local files through a shared origin');assert.match(frame.getAttribute('srcdoc'),/<script>alert\(1\)<\/script>/,'the browser receives the original HTML source');
  assert.ok([...window.document.querySelectorAll('button')].some(button=>button.textContent==='Open default app'),'system default app opening remains available');
  const settings=[...window.document.querySelectorAll('button')].find(button=>button.textContent.includes('Preview settings'));await act(async()=>settings.click());
  const htmlToggle=[...window.document.querySelectorAll('.note-library-preview-settings-menu label')].find(label=>label.textContent==='HTML')?.querySelector('input');assert.ok(htmlToggle);assert.equal(htmlToggle.checked,false,'HTML is manual by default');
  assert.equal([...window.document.querySelectorAll('.note-library-preview-settings-menu label')].find(label=>label.textContent==='PDF')?.querySelector('input')?.checked,true,'PDF is automatic by default');
  assert.equal([...window.document.querySelectorAll('.note-library-preview-settings-menu label')].find(label=>label.textContent==='Markdown and text')?.querySelector('input')?.checked,true,'Markdown and text are automatic by default');
  const reactProps=element=>element[Object.keys(element).find(key=>key.startsWith('__reactProps$'))];
  await act(async()=>{reactProps(htmlToggle).onChange({target:{checked:true}});await new Promise(resolve=>setTimeout(resolve,30))});
  assert.ok(JSON.parse(window.localStorage.getItem('still.files.autoPreviewTypes.v1')).includes('html'),'the chosen automatic preview types are saved on this device');
  const htmlToggleAfterEnable=[...window.document.querySelectorAll('.note-library-preview-settings-menu label')].find(label=>label.textContent==='HTML').querySelector('input');
  await act(async()=>{reactProps(htmlToggleAfterEnable).onChange({target:{checked:false}});await new Promise(resolve=>setTimeout(resolve,30))});
  assert.ok([...window.document.querySelectorAll('button')].some(button=>button.textContent==='Preview now'),'turning off automatic HTML preview restores the on-demand action');
 }finally{if(root)await act(async()=>root.unmount());clearMocks();dom.window.close();for(const [key,descriptor] of old)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}
});

test('Files selects rows with a pointer marquee and does not add checkbox controls',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true}),{window}=dom;
 const globals={window,document:window.document,navigator:window.navigator,localStorage:window.localStorage,HTMLElement:window.HTMLElement,Element:window.Element,Node:window.Node,Event:window.Event,CustomEvent:window.CustomEvent,MutationObserver:window.MutationObserver,IS_REACT_ACT_ENVIRONMENT:true,isTauri:true};
 const old=Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]);let root;
 try{
  for(const [key,value] of Object.entries(globals))setGlobal(key,value);
  window.__TAURI_INTERNALS__={};
  mockIPC(command=>command==='files_list'?{rootName:'Course',location:'',entries:[{name:'one.md',path:'one.md',directory:false,size:3,blocked:false},{name:'three.pdf',path:'three.pdf',directory:false,size:3,blocked:false},{name:'two.md',path:'two.md',directory:false,size:3,blocked:false}],truncated:false}:null,{shouldMockEvents:true});
  const {default:NotesLibraryExplorer}=await vite.ssrLoadModule('/src/NotesLibraryExplorer.tsx');
  root=createRoot(window.document.querySelector('#root'));
  await act(async()=>root.render(createElement(NotesLibraryExplorer,{widgetId:'course-library',connected:true,libraryName:'Course',entries:[{name:'one.md',path:'one.md',size:3},{name:'two.md',path:'two.md',size:3},{name:'three.pdf',path:'three.pdf',size:3}],busy:false,error:'',newName:'',onNewName(){},onRefresh(){},onChoose(){},onCreate:async()=>null,onOpenNote:async()=>{},renderNoteEditor:()=>null})));
  const list=window.document.querySelector('.note-library-files'),rows=[...list.querySelectorAll('[data-file-path]')];
  const rect=(left,top,width,height)=>({left,top,right:left+width,bottom:top+height,width,height,x:left,y:top,toJSON(){return this}});
  list.getBoundingClientRect=()=>rect(0,0,120,120);
  rows.forEach((row,index)=>row.getBoundingClientRect=()=>rect(0,index*40,120,40));
  await act(async()=>list.dispatchEvent(new window.MouseEvent('pointerdown',{bubbles:true,clientX:5,clientY:5,button:0})));
  await act(async()=>window.dispatchEvent(new window.MouseEvent('pointermove',{bubbles:true,cancelable:true,clientX:110,clientY:75,button:0})));
  await act(async()=>window.dispatchEvent(new window.MouseEvent('pointerup',{bubbles:true,clientX:110,clientY:75,button:0})));
  assert.deepEqual(rows.filter(row=>row.classList.contains('is-multiselected')).map(row=>row.dataset.filePath),['one.md','three.pdf']);
  assert.equal(window.document.querySelectorAll('.note-library-files input[type="checkbox"]').length,0,'selection is performed by dragging a box, not by persistent checkboxes');
 }finally{if(root)await act(async()=>root.unmount());clearMocks();dom.window.close();for(const [key,descriptor] of old)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}
});

test('Files keeps the newest Markdown selection when an older file read finishes last',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true}),{window}=dom;
 const globals={window,document:window.document,navigator:window.navigator,localStorage:window.localStorage,HTMLElement:window.HTMLElement,Element:window.Element,Node:window.Node,Event:window.Event,CustomEvent:window.CustomEvent,MutationObserver:window.MutationObserver,IS_REACT_ACT_ENVIRONMENT:true,isTauri:true};
 const old=Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]);let root;
 try{
  for(const [key,value] of Object.entries(globals))setGlobal(key,value);
  window.__TAURI_INTERNALS__={};
  mockIPC(async(command,args)=>{if(command==='files_list')return{rootName:'Course',location:args.location,entries:[{name:'slow.md',path:'slow.md',directory:false,size:14,blocked:false},{name:'fast.md',path:'fast.md',directory:false,size:14,blocked:false}],truncated:false};if(command==='notes_library_read'){await new Promise(resolve=>setTimeout(resolve,args.path==='slow.md'?70:5));return args.path==='slow.md'?'OLDER CONTENT':'NEWER CONTENT'}return null},{shouldMockEvents:true});
  const {default:NotesLibraryExplorer}=await vite.ssrLoadModule('/src/NotesLibraryExplorer.tsx');
  root=createRoot(window.document.querySelector('#root'));
  await act(async()=>root.render(createElement(NotesLibraryExplorer,{widgetId:'course-library',connected:true,libraryName:'Course',entries:[{name:'slow.md',path:'slow.md',size:14},{name:'fast.md',path:'fast.md',size:14}],busy:false,error:'',newName:'',onNewName(){},onRefresh(){},onChoose(){},onCreate:async()=>null,onOpenNote:async()=>{},renderNoteEditor:()=>null})));
  const older=window.document.querySelector('[data-file-path="slow.md"]'),newer=window.document.querySelector('[data-file-path="fast.md"]');
  await act(async()=>{older.click();newer.click();await new Promise(resolve=>setTimeout(resolve,100))});
  assert.equal(window.document.querySelector('.note-library-preview-head strong')?.textContent,'fast.md');
  assert.equal(window.document.querySelector('.note-library-editor')?.value,'NEWER CONTENT','the late response from the first file must not replace the latest selection');
 }finally{if(root)await act(async()=>root.unmount());clearMocks();dom.window.close();for(const [key,descriptor] of old)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}
});
