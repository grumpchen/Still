import {after,test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement,act,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';
import {createInitialState,createWidget} from '../src/domain/workspaces.ts';
import {upsertSavedPresets} from '../src/domain/trayActions.ts';
import {setNoteText} from './fixtures.mjs';

const vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
after(()=>vite.close());
const rect=(left,top,width,height)=>({x:left,y:top,left,top,right:left+width,bottom:top+height,width,height,toJSON(){return this}});
const setGlobal=(key,value)=>Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});

test('dragging a canvas widget onto Saved + quick-saves it beside the button',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true});
 const oldGlobals=new Map();
 for(const key of ['window','document','navigator','HTMLElement','Element','Node','MutationObserver','ResizeObserver','requestAnimationFrame','cancelAnimationFrame','getComputedStyle','IS_REACT_ACT_ENVIRONMENT'])oldGlobals.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
 let root;
 try{
  const {window}=dom;setGlobal('window',window);setGlobal('document',window.document);setGlobal('navigator',window.navigator);setGlobal('HTMLElement',window.HTMLElement);setGlobal('Element',window.Element);setGlobal('Node',window.Node);setGlobal('MutationObserver',window.MutationObserver);setGlobal('ResizeObserver',class{observe(){}disconnect(){}});setGlobal('requestAnimationFrame',window.requestAnimationFrame.bind(window));setGlobal('cancelAnimationFrame',window.cancelAnimationFrame.bind(window));setGlobal('getComputedStyle',window.getComputedStyle.bind(window));setGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  window.document.elementFromPoint=()=>null;
  window.HTMLElement.prototype.setPointerCapture=function(){};
  Object.defineProperty(window.HTMLElement.prototype,'scrollWidth',{configurable:true,get(){return this.classList?.contains('tray-items')?1000:0}});
  Object.defineProperty(window.HTMLElement.prototype,'clientWidth',{configurable:true,get(){return this.classList?.contains('tray-items')?720:0}});
  window.HTMLElement.prototype.getBoundingClientRect=function(){
   if(this.classList.contains('widget-tray'))return rect(0,0,900,60);
   if(this.classList.contains('tray-items'))return rect(50,8,720,40);
   if(this.classList.contains('saved-plus'))return rect(700,10,34,34);
   if(this.classList.contains('canvas-viewport'))return rect(0,70,1000,700);
   if(this.classList.contains('workspace-canvas'))return rect(0,70,1000,700);
   if(this.classList.contains('canvas-card'))return rect(100,150,360,300);
   if(this.classList.contains('card-head'))return rect(100,150,360,45);
   if(this.classList.contains('widget-content'))return rect(100,195,360,255);
   if(this.classList.contains('widget-resize'))return rect(428,418,32,32);
   return rect(0,0,0,0);
  };
  const workspace=createInitialState().workspaces[0],note=createWidget('notes');note.title='Quick note';setNoteText(note,'Save me');note.placement={x:100,y:150,width:360,height:300};workspace.widgets=[note];
  const props={workspaceId:workspace.id,transferWidget(){},setWorkspaceDropTarget(){},openAppsDialog(){},editTray(){throw new Error('Saved + opened the editor instead of quick-saving')},presets:[],openPreset(){},editPreset(){},removePreset(){},renamePreset(){},renameGroup(){},widgets:workspace.widgets,groups:[],updateGroup(){},saveToGroup(){},openGroup(){},editGroup(){},removeGroup(){},openGroupWidget(){},update(){},add(){},remove(){},begin(){},bringToFront(){},notify(){},obscured:false,openResource(){},openDropped(){},pickApp(){},saveApp(){},appAttachments:{},appAttachmentHandled(){}};
  let currentPresets=[];
  function Host(){const [presets,setPresets]=useState([]);currentPresets=presets;return createElement(WorkspaceCanvas,{...props,presets,savePresets:items=>setPresets(existing=>upsertSavedPresets(existing,items))})}
  const {default:WorkspaceCanvas}=await vite.ssrLoadModule('/src/WorkspaceCanvas.tsx');
  root=createRoot(window.document.querySelector('#root'));
  await act(async()=>root.render(createElement(Host)));
  const header=window.document.querySelector('.canvas-card .card-head');
  assert.ok(header);assert.equal(window.document.querySelector('.preset-tray-entry'),null);
  const pointer=(type,x,y)=>{const event=new window.MouseEvent(type,{bubbles:true,cancelable:true,button:0,clientX:x,clientY:y});for(const [key,value]of Object.entries({pointerId:1,isPrimary:true}))Object.defineProperty(event,key,{value});return event};
  await act(async()=>{
   header.dispatchEvent(pointer('pointerdown',200,170));
   header.dispatchEvent(pointer('pointermove',710,25));
   header.dispatchEvent(pointer('pointerup',710,25));
  });
  await act(async()=>new Promise(resolve=>setTimeout(resolve,40)));
  assert.equal(currentPresets.length,1,'the drag saves without opening the editor');
  assert.equal(currentPresets[0].text,'Save me');
  assert.ok(window.document.querySelector('.preset-tray-entry'),'the saved widget is rendered before Saved +');
  assert.equal(window.document.querySelector('.tray-items').scrollLeft,280,'the tray scrolls to its actual rightmost position, keeping the new shortcut beside Saved +');
 }finally{
  if(root)await act(async()=>root.unmount());dom.window.close();
  for(const [key,descriptor]of oldGlobals){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}
 }
});

test('dragging a captured Chrome or Edge Apps widget onto Saved + creates a reusable app shortcut',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true});
 const oldGlobals=new Map();
 for(const key of ['window','document','navigator','HTMLElement','Element','Node','MutationObserver','ResizeObserver','requestAnimationFrame','cancelAnimationFrame','getComputedStyle','IS_REACT_ACT_ENVIRONMENT'])oldGlobals.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
 let root,restorePrepare;
 try{
  const {window}=dom;setGlobal('window',window);setGlobal('document',window.document);setGlobal('navigator',window.navigator);setGlobal('HTMLElement',window.HTMLElement);setGlobal('Element',window.Element);setGlobal('Node',window.Node);setGlobal('MutationObserver',window.MutationObserver);setGlobal('ResizeObserver',class{observe(){}disconnect(){}});setGlobal('requestAnimationFrame',window.requestAnimationFrame.bind(window));setGlobal('cancelAnimationFrame',window.cancelAnimationFrame.bind(window));setGlobal('getComputedStyle',window.getComputedStyle.bind(window));setGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  window.document.elementFromPoint=()=>null;window.HTMLElement.prototype.setPointerCapture=function(){};
  Object.defineProperty(window.HTMLElement.prototype,'scrollWidth',{configurable:true,get(){return this.classList?.contains('tray-items')?1000:0}});
  Object.defineProperty(window.HTMLElement.prototype,'clientWidth',{configurable:true,get(){return this.classList?.contains('tray-items')?720:0}});
  window.HTMLElement.prototype.getBoundingClientRect=function(){
   if(this.classList.contains('widget-tray'))return rect(0,0,900,60);
   if(this.classList.contains('tray-items'))return rect(50,8,720,40);
   if(this.classList.contains('saved-plus'))return rect(700,10,34,34);
   if(this.classList.contains('canvas-viewport')||this.classList.contains('workspace-canvas'))return rect(0,70,1000,700);
   if(this.classList.contains('canvas-card'))return rect(100,150,360,300);
   if(this.classList.contains('card-head'))return rect(100,150,360,45);
   if(this.classList.contains('widget-content'))return rect(100,195,360,255);
   if(this.classList.contains('widget-resize'))return rect(428,418,32,32);
   return rect(0,0,0,0);
  };
  const widget=createWidget('apps');widget.title='Google Chrome';widget.appName='Google Chrome';widget.appPanelOpen=true;widget.placement={x:100,y:150,width:360,height:300};
  const updates=[],attachment={hwnd:101,pid:202},props={workspaceId:'workspace',transferWidget(){},setWorkspaceDropTarget(){},openAppsDialog(){},editTray(){throw new Error('Saved + opened the editor instead of quick-saving')},presets:[],openPreset(){},editPreset(){},removePreset(){},renamePreset(){},renameGroup(){},widgets:[widget],groups:[],updateGroup(){},saveToGroup(){},openGroup(){},editGroup(){},removeGroup(){},openGroupWidget(){},update:(id,patch)=>updates.push({id,patch}),add(){},remove(){},begin(){},bringToFront(){},notify(){},obscured:false,openResource(){},openDropped(){},pickApp(){},saveApp(){},appAttachments:{},appAttachmentHandled(){}};
  const {default:WorkspaceCanvas}=await vite.ssrLoadModule('/src/WorkspaceCanvas.tsx');
  const {appPanel}=await vite.ssrLoadModule('/src/platform/appPanel.ts');const originalAvailable=appPanel.available,originalPrepare=appPanel.prepare,originalIdentity=appPanel.identity,originalRelease=appPanel.release,originalSuspend=appPanel.suspendForDrag,originalFinish=appPanel.finishDrag;restorePrepare=()=>{appPanel.available=originalAvailable;appPanel.prepare=originalPrepare;appPanel.identity=originalIdentity;appPanel.release=originalRelease;appPanel.suspendForDrag=originalSuspend;appPanel.finishDrag=originalFinish};
  appPanel.available=true;
  let dragSuspensions=0,dragFinishes=0;appPanel.suspendForDrag=async()=>{dragSuspensions++;return true};appPanel.finishDrag=()=>{dragFinishes++};
  let identifiedWidget;appPanel.identity=async id=>{identifiedWidget=id;return attachment};
  let preparedAttachment;appPanel.prepare=async value=>{preparedAttachment=value;return{sourceId:'app-chrome',name:'Google Chrome',kind:'app',extension:'exe'}};
  let releases=0;appPanel.release=async()=>{releases++};
  let currentPresets=[],notifications=[];
  function Host(){const [presets,setPresets]=useState([]);currentPresets=presets;return createElement(WorkspaceCanvas,{...props,presets,notify:message=>notifications.push(message),savePresets:items=>setPresets(existing=>upsertSavedPresets(existing,items))})}
  root=createRoot(window.document.querySelector('#root'));await act(async()=>root.render(createElement(Host)));
  const header=window.document.querySelector('.canvas-card .card-head');
  const pointer=(type,x,y)=>{const event=new window.MouseEvent(type,{bubbles:true,cancelable:true,button:0,clientX:x,clientY:y});for(const [key,value]of Object.entries({pointerId:1,isPrimary:true}))Object.defineProperty(event,key,{value});return event};
  await act(async()=>{header.dispatchEvent(pointer('pointerdown',200,170));header.dispatchEvent(pointer('pointermove',710,25));header.dispatchEvent(pointer('pointerup',710,25))});
  await act(async()=>new Promise(resolve=>setTimeout(resolve,40)));
  assert.equal(currentPresets.length,1,'a captured app obtains a reusable shortcut identity before quick-save');
  assert.equal(currentPresets[0].type,'apps');assert.equal(currentPresets[0].appSourceId,'app-chrome');assert.equal(currentPresets[0].appName,'Google Chrome');
  assert.equal(identifiedWidget,widget.id,'the current native manager supplies the identity after the one-time attach handoff is consumed');
  assert.equal(preparedAttachment,attachment,'the shortcut grant is derived from the exact still-attached HWND/PID');
  assert.equal(updates.some(({patch})=>'appKey'in patch),false,'saving does not change appKey and restart the attached HWND');
  assert.equal(releases,0,'quick-save must not release the attached Chrome HWND');
  assert.equal(dragSuspensions,1,'the native HWND is hidden while its card is dragged');
  assert.equal(dragFinishes,1,'quick-save resumes presentation after the drag ends');
  assert.ok(window.document.querySelector('.canvas-card'),'quick-save keeps the existing Apps card on the canvas');
  assert.equal(widget.appPanelOpen,true,'quick-save keeps the existing panel open');
  assert.deepEqual(notifications,[],'the captured Chrome window is not rejected as an unsaved transient app');
 }finally{
  restorePrepare?.();if(root)await act(async()=>root.unmount());dom.window.close();
  for(const [key,descriptor]of oldGlobals){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}
 }
});
