import {after,test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement,act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';
import {createWidget} from '../src/domain/workspaces.ts';

const vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,entries:[]}});after(()=>vite.close());
const setGlobal=(key,value)=>Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
async function renderFile(file){
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true}),{window}=dom;
 const keys=['window','document','navigator','HTMLElement','Element','Node','MutationObserver','ResizeObserver','requestAnimationFrame','cancelAnimationFrame','getComputedStyle','IS_REACT_ACT_ENVIRONMENT','isTauri'];
 const old=new Map(keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));let root;
 for(const key of keys)setGlobal(key,key==='IS_REACT_ACT_ENVIRONMENT'?true:key==='isTauri'?false:key==='ResizeObserver'?class{observe(){}disconnect(){}}:key==='requestAnimationFrame'?window.requestAnimationFrame.bind(window):key==='cancelAnimationFrame'?window.cancelAnimationFrame.bind(window):key==='getComputedStyle'?window.getComputedStyle.bind(window):window[key]);
 try{
  const {localFiles}=await vite.ssrLoadModule('/src/platform/files.ts');
  Object.defineProperty(file,'webkitRelativePath',{value:`Course/${file.name}`});
  const id='files-preview-context-test';localFiles.select(id,[file]);
  const widget=createWidget('files');widget.id=id;widget.folderName='Course';
  const {default:FilesWidget}=await vite.ssrLoadModule('/src/FilesWidget.tsx');
  root=createRoot(window.document.querySelector('#root'));
  await act(async()=>root.render(createElement(FilesWidget,{widget,update(){},notify(){},obscured:false,workspaceWidgets:[]})));
  await act(async()=>new Promise(resolve=>setTimeout(resolve,0)));
  const fileButton=window.document.querySelector('.file-row');assert.ok(fileButton,'the selected local fixture is shown in Files');
  await act(async()=>fileButton.click());await act(async()=>new Promise(resolve=>setTimeout(resolve,0)));
  return{dom,window,localFiles,id,root,old,cleanup:async()=>{if(root)await act(async()=>root.unmount());localFiles.release(id);dom.window.close();for(const[key,descriptor]of old){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}}};
 }catch(error){dom.window.close();for(const[key,descriptor]of old){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}throw error}
}

test('right-clicking a readable file opens file-specific actions wired to the existing AI and open handlers',async()=>{
 const file=new File(['Course text for the assistant.'],'reading.txt',{type:'text/plain'}),ui=await renderFile(file);
 try{
  assert.equal(ui.window.document.querySelectorAll('.files-ai-menu').length,1,'the AI actions are consolidated into one dropdown');
  assert.equal(ui.window.document.querySelectorAll('.files-study-actions').length,0,'duplicate action rows are gone');
  const preview=ui.window.document.querySelector('.folder-file-preview .document-preview');assert.ok(preview);
  const event=new ui.window.MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:45,clientY:50});await act(async()=>preview.dispatchEvent(event));
  assert.equal(event.defaultPrevented,true);assert.ok(ui.window.document.querySelector('.files-preview-context-menu'));
  const actions=[...ui.window.document.querySelectorAll('.files-preview-context-menu button')].map(button=>button.textContent);
  assert.ok(actions.includes('Open externally'));assert.ok(actions.some(value=>value.includes('Ask Still AI')));assert.ok(actions.includes('Find related notes'));
  assert.ok([...ui.window.document.querySelectorAll('.files-ai-menu button')].some(button=>button.textContent.includes('Ask Still AI')));
 }finally{await ui.cleanup()}
});

test('image previews keep applicable open actions and hide text-only AI actions',async()=>{
 const file=new File(['image bytes'],'photo.png',{type:'image/png'}),ui=await renderFile(file);
 try{
  const preview=ui.window.document.querySelector('.folder-file-preview .document-preview');await act(async()=>preview.dispatchEvent(new ui.window.MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:40,clientY:40})));
  const actions=[...ui.window.document.querySelectorAll('.files-preview-context-menu button')];
  assert.ok(actions.some(button=>button.textContent==='Open externally'));assert.equal(actions.some(button=>button.textContent.includes('Ask Still AI')),false);assert.equal(ui.window.document.querySelectorAll('.files-ai-menu').length,1);
  let opened;const originalOpen=ui.localFiles.open;ui.localFiles.open=async(...args)=>{opened=args};
  await act(async()=>actions.find(button=>button.textContent==='Open externally').click());assert.deepEqual(opened,[ui.id,'photo.png']);ui.localFiles.open=originalOpen;
 }finally{await ui.cleanup()}
});
