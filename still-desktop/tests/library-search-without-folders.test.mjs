import {after,test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement,act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';
import {createWidget,createWorkspace} from '../src/domain/workspaces.ts';

const vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,entries:[]}});after(()=>vite.close());
const setGlobal=(key,value)=>Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
function setReactValue(node,value,type){Object.getOwnPropertyDescriptor(node.ownerDocument.defaultView[type].prototype,'value').set.call(node,value);node[Object.keys(node).find(key=>key.startsWith('__reactProps$'))]?.onChange?.({target:node,currentTarget:node})}

test('Library search keeps saved links and PDF shortcuts visible when the course has no searchable folders',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true}),{window}=dom,keys=['window','document','navigator','HTMLElement','Element','Node','MutationObserver','IS_REACT_ACT_ENVIRONMENT'],old=new Map(keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));for(const key of keys)setGlobal(key,key==='IS_REACT_ACT_ENVIRONMENT'?true:window[key]);let root,searchCalls=0;
 try{
  const {default:LibraryHome}=await vite.ssrLoadModule('/src/LibraryHome.tsx'),{localFiles}=await vite.ssrLoadModule('/src/platform/files.ts'),original=localFiles.searchLibrary;localFiles.searchLibrary=async()=>{searchCalls++;return{results:[],unavailableWidgetIds:[],truncated:false}};
  const course=createWorkspace('Biology',[],'study'),pdf=createWidget('files');pdf.fileKey='opaque-pdf-ref';pdf.fileName='Exam PDF';course.widgets.push(pdf);
  const link={id:'exam-link',name:'Exam lecture',url:'https://example.edu/exam',icon:'E',workspaceId:course.id,workspaceName:course.name,groupName:'Saved links'};
  root=createRoot(window.document.querySelector('#root'));
  await act(async()=>root.render(createElement(LibraryHome,{workspace:course,workspaces:[course],update(){},notify(){},workspaceActive:true,links:[link],openLink(){},addFolder:()=>null,addInbox:()=>null,removeFolder(){}})));
  await act(async()=>[...window.document.querySelectorAll('.library-rail button')].find(button=>button.textContent.includes('Search library')).click());
  await act(async()=>setReactValue(window.document.querySelector('input[aria-label="Search library"]'),'exam','HTMLInputElement'));
  await act(async()=>window.document.querySelector('.library-search-form').requestSubmit());
  assert.equal(searchCalls,0,'without a folder, Library skips only the native folder search');
  assert.ok(window.document.body.textContent.includes('Exam lecture'),'saved link result remains visible');
  assert.ok(window.document.body.textContent.includes('Exam PDF'),'PDF reference result remains visible');
  assert.equal(window.document.body.textContent.includes('No matching files in this library.'),false,'folder search emptiness does not hide or contradict global matches');
  localFiles.searchLibrary=original;
 }finally{if(root)await act(async()=>root.unmount());dom.window.close();for(const[key,descriptor]of old){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}}
});
