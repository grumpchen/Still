import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createElement,act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';
import {createInitialState,createWorkspace} from '../src/domain/workspaces.ts';

const vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,entries:[]}});
after(()=>vite.close());
const setGlobal=(key,value)=>Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
function setReactValue(node,value,elementType){Object.getOwnPropertyDescriptor(node.ownerDocument.defaultView[elementType].prototype,'value').set.call(node,value);const props=node[Object.keys(node).find(key=>key.startsWith('__reactProps$'))];props?.onChange?.({target:node,currentTarget:node})}
async function waitFor(predicate){const deadline=Date.now()+5000;while(Date.now()<deadline){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,10))}assert.ok(predicate(),'Timed out waiting for QuickCapture update')}
function setupDom(){const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true}),{window}=dom,keys=['window','document','navigator','localStorage','HTMLElement','Element','Node','MutationObserver','IS_REACT_ACT_ENVIRONMENT'],old=new Map(keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));for(const key of keys)setGlobal(key,key==='IS_REACT_ACT_ENVIRONMENT'?true:key==='localStorage'?window.localStorage:window[key]);return{dom,window,old,restore(){dom.window.close();for(const[key,descriptor]of old){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}}}}

test('QuickCapture rotates a pre-mutation failed link key and retries only the pending queue event',async()=>{
 const {dom,window,old,restore}=setupDom(),initial=createInitialState(),course=createWorkspace('Biology',[],'study');initial.workspaces.push(course);let current=initial,root,closed=0;const queued=[];
 try{
  const {default:QuickCapture}=await vite.ssrLoadModule('/src/QuickCapture.tsx'),{configureCollectionOperationHost}=await vite.ssrLoadModule('/src/platform/collectionOperations.ts');configureCollectionOperationHost({getState:()=>current,commitState:next=>{current=next}});
  root=createRoot(window.document.querySelector('#root'));
  await act(async()=>root.render(createElement(QuickCapture,{open:true,workspaces:current.workspaces,onClose:()=>closed++,onSavePdf:async()=>{throw new Error('unexpected PDF action')},onCaptureSaved:async(id,resource)=>{queued.push({id,resource});if(queued.length===1)throw new Error('capture inbox full')}})));
  await act(async()=>[...window.document.querySelectorAll('.quick-capture-tabs button')].find(button=>button.textContent==='Web link').click());
  await act(async()=>setReactValue(window.document.querySelector('[aria-label="Choose course"]'),course.id,'HTMLSelectElement'));
  await act(async()=>setReactValue(window.document.querySelector('input[placeholder="Name this link"]'),'Lecture','HTMLInputElement'));
  await act(async()=>setReactValue(window.document.querySelector('input[placeholder="https://"]'),'ftp://invalid.example/file','HTMLInputElement'));
  await act(async()=>window.document.querySelector('.quick-capture-dialog .primary').click());
  await waitFor(()=>window.document.querySelector('[role="alert"]')?.textContent.includes('HTTPS'));
  assert.equal(current.workspaces.find(item=>item.id===course.id).groups.length,0,'invalid link was not saved');
  await act(async()=>setReactValue(window.document.querySelector('input[placeholder="https://"]'),'https://example.edu/lecture','HTMLInputElement'));
  await act(async()=>window.document.querySelector('.quick-capture-dialog .primary').click());
  await waitFor(()=>window.document.querySelector('.quick-capture-dialog .primary')?.textContent==='Retry adding to Rules');
  const savedCourse=current.workspaces.find(item=>item.id===course.id);assert.equal(savedCourse.groups[0].shortcuts.length,1);assert.equal(queued.length,1);assert.equal(queued[0].resource.kind,'link');
  assert.equal(window.document.querySelector('input[placeholder="https://"]').disabled,true,'pending saved resource is locked against changing capture details');
  await act(async()=>window.document.querySelector('.quick-capture-dialog .primary').click());
  await waitFor(()=>closed===1);
  assert.equal(queued.length,2);assert.equal(queued[1].id,queued[0].id,'queue retry reuses the event ID');assert.deepEqual(queued[1].resource,queued[0].resource);
  const journal=JSON.parse(window.localStorage.getItem('still-collection-operation-receipts-v1'));assert.equal(journal.length,2);assert.notEqual(journal[0].key,journal[1].key,'pre-mutation failure gets a fresh attempt key after the input is corrected');
 }finally{if(root)await act(async()=>root.unmount());restore()}
});

test('QuickCapture retries PDF queueing with the actual saved source without selecting or saving another PDF',async()=>{
 const {dom,window,old,restore}=setupDom(),course=createWorkspace('History',[],'custom'),queued=[];let root,saveCalls=0,closed=0;
 try{
  const {default:QuickCapture}=await vite.ssrLoadModule('/src/QuickCapture.tsx');root=createRoot(window.document.querySelector('#root'));
  await act(async()=>root.render(createElement(QuickCapture,{open:true,workspaces:[course],onClose:()=>closed++,onSavePdf:async(workspaceId,file,captureId)=>{saveCalls++;assert.equal(workspaceId,course.id);return{widgetId:'pdf-card',name:file.name,sourceId:'actual-saved-source'}},onCaptureSaved:async(id,resource)=>{queued.push({id,resource});if(queued.length===1)throw new Error('capture inbox full')}})));
  await act(async()=>setReactValue(window.document.querySelector('[aria-label="Choose course"]'),course.id,'HTMLSelectElement'));
  await act(async()=>[...window.document.querySelectorAll('.quick-capture-tabs button')].find(button=>button.textContent==='PDF').click());
  const input=window.document.querySelector('input[type="file"]'),props=input[Object.keys(input).find(key=>key.startsWith('__reactProps$'))];
  const pdfFile=new window.File(['pdf bytes'],'exam.pdf',{type:'application/pdf'});await act(async()=>{props.onChange({target:{files:[pdfFile],value:''}})});
  await waitFor(()=>window.document.querySelector('.quick-capture-dialog .primary')?.textContent==='Retry adding to Rules');
  assert.equal(saveCalls,1);assert.equal(queued[0].resource.sourceId,'actual-saved-source');
  await act(async()=>window.document.querySelector('.quick-capture-dialog .primary').click());await waitFor(()=>closed===1);
  assert.equal(saveCalls,1,'retry only appends the saved resource; it does not choose or save another file');assert.equal(queued.length,2);assert.equal(queued[0].id,queued[1].id);assert.equal(queued[1].resource.sourceId,'actual-saved-source');
 }finally{if(root)await act(async()=>root.unmount());restore()}
});
