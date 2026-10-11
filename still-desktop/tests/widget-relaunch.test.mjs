import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createElement,act,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {mockIPC,clearMocks} from '@tauri-apps/api/mocks';
import {createInitialState,createWidget,minimizeWidgetInstance} from '../src/domain/workspaces.ts';
import {createServer} from 'vite';

const types=['browser','group','desmos','notes','focus','ai','files','apps','timetable','tagStatus'];
const rect=(left,top,width,height)=>({x:left,y:top,left,top,right:left+width,bottom:top+height,width,height,toJSON(){return this}});
const info=(args)=>({hwnd:args.id==='app-one'?451:452,pid:args.id==='app-one'?902:903,minWidth:0,minHeight:0,requiredWidth:null,requiredHeight:null,measured:false,probing:false,shown:args.visible??true});
const setGlobal=(key,value)=>Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
const vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,entries:[]}});
after(()=>vite.close());

async function setup(widgets,{identity={hwnd:451,pid:902},startupDeferredIds=new Set()}={}){
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true});
 const oldGlobals=new Map();
 for(const key of ['window','document','navigator','HTMLElement','Element','Node','MutationObserver','ResizeObserver','requestAnimationFrame','cancelAnimationFrame','getComputedStyle','isTauri','IS_REACT_ACT_ENVIRONMENT'])oldGlobals.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
 const {window}=dom;
 setGlobal('window',window);setGlobal('document',window.document);setGlobal('navigator',window.navigator);setGlobal('HTMLElement',window.HTMLElement);setGlobal('Element',window.Element);setGlobal('Node',window.Node);setGlobal('MutationObserver',window.MutationObserver);setGlobal('ResizeObserver',class{observe(){}disconnect(){}});setGlobal('requestAnimationFrame',callback=>setTimeout(()=>callback(Date.now()),0));setGlobal('cancelAnimationFrame',clearTimeout);setGlobal('getComputedStyle',window.getComputedStyle.bind(window));setGlobal('isTauri',true);setGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 window.HTMLElement.prototype.getBoundingClientRect=function(){
  if(this.classList.contains('canvas-viewport'))return rect(0,0,1400,900);
  if(this.classList.contains('workspace-canvas'))return rect(0,0,4000,3000);
  const card=this.closest('.canvas-card');
  if(!card)return rect(0,0,0,0);
  const left=Number.parseFloat(card.style.left)||0,top=Number.parseFloat(card.style.top)||0,width=Number.parseFloat(card.style.width)||420,height=Number.parseFloat(card.style.height)||320;
  if(this===card)return rect(left,top,width,height);
  if(this.classList.contains('widget-content'))return rect(left,top+43,width,height-43);
  if(this.classList.contains('widget-resize'))return rect(left+width-25,top+height-25,25,25);
  return rect(left,top,width,height);
 };
 const calls=[];
 mockIPC((command,args)=>{
  calls.push({command,args});
  if(command==='chrome_panel_open')return{hwnd:700,pid:800};
  if(command==='chrome_panel_present')return args.visible;
  if(command==='app_panel_open'||command==='app_panel_present')return info(args);
  if(command==='app_panel_identity')return identity;
  return null;
 },{shouldMockEvents:true});
 const {default:WorkspaceCanvas}=await vite.ssrLoadModule('/src/WorkspaceCanvas.tsx');
 const state=createInitialState();state.workspaces[0].widgets=widgets;
 let currentState,root;
 function Host(){
  const [current,setCurrent]=useState(state);currentState=current;
  const [deferred,setDeferred]=useState(startupDeferredIds);
  const update=(id,patch)=>setCurrent(value=>({...value,workspaces:value.workspaces.map(workspace=>({...workspace,widgets:workspace.widgets.map(item=>item.id===id?{...item,...patch}:item)}))}));
  return createElement(WorkspaceCanvas,{workspaceId:current.workspaces[0].id,transferWidget(){},setWorkspaceDropTarget(){},openAppsDialog(){},editTray(){},presets:current.presets,savePresets(){},openPreset(){},editPreset(){},removePreset(){},renamePreset(){},renameGroup(){},widgets:current.workspaces[0].widgets,groups:[],updateGroup(){},saveToGroup(){},openGroup(){},editGroup(){},removeGroup(){},openGroupWidget(){},update,add(){},remove(){},begin(){},bringToFront(){},notify(){},obscured:false,openResource(){},openDropped(){},pickApp(){},saveApp(){},appAttachments:{},appAttachmentHandled(){},startupDeferredIds:deferred,startupRelaunch:id=>setDeferred(value=>new Set([...value].filter(item=>item!==id)))});
 }
 root=createRoot(window.document.querySelector('#root'));
 await act(async()=>root.render(createElement(Host)));
 return{dom,window,calls,get currentState(){return currentState},root,cleanup:async()=>{if(root)await act(async()=>root.unmount());clearMocks();dom.window.close();for(const [key,descriptor]of oldGlobals){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}}};
}

test('every workspace widget, including a minimized card, exposes Relaunch',async()=>{
 const widgets=types.map((type,index)=>{const widget=createWidget(type);widget.id=`widget-${type}`;widget.title=type;return index===3?minimizeWidgetInstance(widget,1400,900):widget});
 const app=await setup(widgets);
 try{
  for(const widget of widgets)assert.ok(app.window.document.querySelector(`[data-widget-id="${widget.id}"] [aria-label="Relaunch ${widget.title}"]`),`${widget.type} card has a Relaunch control`);
 }finally{await app.cleanup()}
});

test('Relaunch remounts an ordinary widget view while preserving its saved content',async()=>{
 const note=createWidget('notes');note.id='saved-note';note.title='Quick note';note.text='Keep this saved text';
 const app=await setup([note]);
 try{
  const before=app.window.document.querySelector('.note');assert.ok(before);assert.equal(before.value,'Keep this saved text');
  const relaunch=app.window.document.querySelector('[aria-label="Relaunch Quick note"]');assert.ok(relaunch);
  await act(async()=>relaunch.dispatchEvent(new app.window.MouseEvent('click',{bubbles:true})));
  const after=app.window.document.querySelector('.note');assert.ok(after);assert.notEqual(after,before,'the widget view is remounted');
  assert.equal(after.value,'Keep this saved text','the saved widget model survives the restart');
  assert.equal(app.currentState.workspaces[0].widgets[0].text,'Keep this saved text');
 }finally{await app.cleanup()}
});

test('manual startup keeps the widget card and saved data in place until Relaunch',async()=>{
 const note=createWidget('notes');note.id='manual-note';note.title='Manual note';note.text='Keep this saved text';note.placement={x:700,y:360,width:400,height:340};
 const app=await setup([note],{startupDeferredIds:new Set(['manual-note'])});
 try{
  assert.ok(app.window.document.querySelector('[data-widget-id="manual-note"]'),'the card stays on its workspace');
  assert.equal(app.window.document.querySelector('.note'),null,'the widget view waits for manual relaunch');
  assert.ok(app.window.document.querySelector('[aria-label="Relaunch Manual note"]'));
  await act(async()=>app.window.document.querySelector('[aria-label="Relaunch Manual note"]').dispatchEvent(new app.window.MouseEvent('click',{bubbles:true})));
  assert.equal(app.window.document.querySelector('.note')?.value,'Keep this saved text');
  assert.equal(app.currentState.workspaces[0].widgets[0].id,'manual-note');assert.deepEqual(app.currentState.workspaces[0].widgets[0].placement,note.placement);
 }finally{await app.cleanup()}
});

test('manual startup delays Browser native Chrome creation until the user relaunches its card',async()=>{
 const widget=createWidget('browser');widget.id='manual-browser';widget.title='Manual browser';
 const app=await setup([widget],{startupDeferredIds:new Set(['manual-browser'])});
 try{
  await act(async()=>await new Promise(resolve=>setTimeout(resolve,30)));
  assert.equal(app.calls.filter(call=>call.command==='chrome_panel_open').length,0);
  assert.ok(app.window.document.querySelector('[data-widget-id="manual-browser"]'));
  await act(async()=>app.window.document.querySelector('[aria-label="Relaunch Manual browser"]').dispatchEvent(new app.window.MouseEvent('click',{bubbles:true})));
  await act(async()=>{for(let attempt=0;attempt<40&&!app.calls.some(call=>call.command==='chrome_panel_open');attempt++)await new Promise(resolve=>setTimeout(resolve,10))});
  assert.equal(app.calls.filter(call=>call.command==='chrome_panel_open').length,1);
 }finally{await app.cleanup()}
});

test('Tag Color Status lets users combine global and tag-color widget plugin controls',async()=>{
 const status=createWidget('tagStatus');status.id='status-card';status.title='Launch status';
 const app=await setup([status]);
 try{
  await act(async()=>app.window.document.querySelector('[aria-label="Customize status controls"]').dispatchEvent(new app.window.MouseEvent('click',{bubbles:true})));
  const global=app.window.document.querySelector('input[type=checkbox]');assert.ok(global);assert.equal(global.checked,false,'global mode is an optional plugin control');
  await act(async()=>global.dispatchEvent(new app.window.MouseEvent('click',{bubbles:true})));
  assert.deepEqual(app.currentState.workspaces[0].widgets[0].pluginControls,['widget-relaunch.tag-colors','widget-relaunch.global-mode']);
  assert.ok(app.window.document.querySelector('[aria-label="Status card global relaunch mode"]'));
  assert.ok(app.window.document.querySelector('[aria-label="Status card red relaunch mode"]'));
 }finally{await app.cleanup()}
});

test('Relaunch re-presents an Apps widget without detaching or launching a second HWND',async()=>{
 const widget=createWidget('apps');widget.id='app-one';widget.title='Test app';widget.appName='Test app';widget.appKey='test-source';widget.appPanelOpen=true;
 const app=await setup([widget]);
 try{
  await act(async()=>{for(let attempt=0;attempt<40&&!app.calls.some(call=>call.command==='app_panel_present');attempt++)await new Promise(resolve=>setTimeout(resolve,10))});
  const opens=app.calls.filter(call=>call.command==='app_panel_open').length;assert.equal(opens,1,'the Apps card initially attaches its app once');
  const relaunch=app.window.document.querySelector('[aria-label="Relaunch Test app"]');assert.ok(relaunch);
  await act(async()=>relaunch.dispatchEvent(new app.window.MouseEvent('click',{bubbles:true})));
  await act(async()=>{for(let attempt=0;attempt<40&&app.calls.filter(call=>call.command==='app_panel_present').length<2;attempt++)await new Promise(resolve=>setTimeout(resolve,10))});
  assert.equal(app.calls.filter(call=>call.command==='app_panel_open').length,opens,'Relaunch must not launch a second app process');
  assert.equal(app.calls.filter(call=>call.command==='app_panel_release').length,0,'Relaunch must keep the attached HWND managed');
  assert.deepEqual(app.calls.filter(call=>call.command==='app_panel_identity').map(call=>call.args.id),['app-one']);
  assert.ok(app.calls.filter(call=>call.command==='app_panel_present').length>=2,'the existing attachment receives a fresh presentation');
 }finally{await app.cleanup()}
});

test('an Apps widget that cannot reopen turns its Relaunch control red',async()=>{
 const widget=createWidget('apps');widget.id='unavailable-app';widget.title='Attached app';widget.appName='Attached app';
 const app=await setup([widget],{identity:null});
 try{
  const relaunch=app.window.document.querySelector('[aria-label="Relaunch Attached app"]');assert.ok(relaunch);
  await act(async()=>relaunch.dispatchEvent(new app.window.MouseEvent('click',{bubbles:true})));
  const failed=app.window.document.querySelector('[aria-label="Relaunch Attached app"]');assert.equal(failed.getAttribute('aria-invalid'),'true','an unavailable app is visibly marked as a failed relaunch');
  assert.equal(app.calls.filter(call=>call.command==='app_panel_open').length,0,'an attached app without a saved launch source is never replaced by another process');
 }finally{await app.cleanup()}
});

test('Relaunch re-presents the same Browser panel without closing or reopening Chrome',async()=>{
 const widget=createWidget('browser');widget.id='browser-one';widget.title='Work browser';
 const app=await setup([widget]);
 try{
  await act(async()=>{for(let attempt=0;attempt<40&&!app.calls.some(call=>call.command==='chrome_panel_present');attempt++)await new Promise(resolve=>setTimeout(resolve,10))});
  const opens=app.calls.filter(call=>call.command==='chrome_panel_open').length;assert.equal(opens,1,'the Browser card opens its native panel once');
  const presentations=app.calls.filter(call=>call.command==='chrome_panel_present').length;
  const relaunch=app.window.document.querySelector('[aria-label="Relaunch Work browser"]');assert.ok(relaunch);
  await act(async()=>relaunch.dispatchEvent(new app.window.MouseEvent('click',{bubbles:true})));
  await act(async()=>{for(let attempt=0;attempt<40&&app.calls.filter(call=>call.command==='chrome_panel_present').length<=presentations;attempt++)await new Promise(resolve=>setTimeout(resolve,10))});
  assert.equal(app.calls.filter(call=>call.command==='chrome_panel_open').length,opens,'the existing Chrome window is not reopened as a second window');
  assert.equal(app.calls.filter(call=>call.command==='chrome_panel_close').length,0,'Relaunch leaves the same Chrome HWND managed');
  assert.ok(app.calls.filter(call=>call.command==='chrome_panel_present').length>presentations,'Relaunch synchronizes the current Browser geometry again');
 }finally{await app.cleanup()}
});
