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

async function setup(widgets,{identity={hwnd:451,pid:902},startupDeferredIds=new Set(),screenshotPluginMode='global',screenshotPluginColors=[],showAppAttachAction=false,showAppDetachAction=false,showAppSaveAction=false}={}){
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
 const state=createInitialState();state.workspaces[0].widgets=widgets;state.screenshotPluginMode=screenshotPluginMode;state.screenshotPluginColors=screenshotPluginColors;
 let currentState,root;
 function Host(){
  const [current,setCurrent]=useState(state);currentState=current;
  const [deferred,setDeferred]=useState(startupDeferredIds);
  const update=(id,patch)=>setCurrent(value=>({...value,workspaces:value.workspaces.map(workspace=>({...workspace,widgets:workspace.widgets.map(item=>item.id===id?{...item,...patch}:item)}))}));
  return createElement(WorkspaceCanvas,{workspaceId:current.workspaces[0].id,transferWidget(){},setWorkspaceDropTarget(){},openAppsDialog(){},editTray(){},presets:current.presets,savePresets(){},openPreset(){},editPreset(){},removePreset(){},renamePreset(){},renameGroup(){},widgets:current.workspaces[0].widgets,groups:[],updateGroup(){},saveToGroup(){},openGroup(){},editGroup(){},removeGroup(){},openGroupWidget(){},update,add(){},remove(){},begin(){},bringToFront(){},notify(){},obscured:false,openResource(){},openDropped(){},pickApp(){},saveApp(){},appAttachments:{},appAttachmentHandled(){},startupDeferredIds:deferred,startupRelaunch:id=>setDeferred(value=>new Set([...value].filter(item=>item!==id))),widgetRelaunchColors:current.widgetRelaunchColors,setRelaunchColor:(color,mode)=>setCurrent(value=>{const colors={...value.widgetRelaunchColors};if(mode)colors[color]=mode;else delete colors[color];return{...value,widgetRelaunchColors:colors}}),screenshotPluginMode:current.screenshotPluginMode,screenshotPluginColors:current.screenshotPluginColors,setScreenshotMode:mode=>setCurrent(value=>({...value,screenshotPluginMode:mode})),setScreenshotColor:(color,enabled)=>setCurrent(value=>({...value,screenshotPluginColors:enabled?[...new Set([...value.screenshotPluginColors,color])]:value.screenshotPluginColors.filter(item=>item!==color)})),showAppAttachAction,showAppDetachAction,showAppSaveAction});
 }
 root=createRoot(window.document.querySelector('#root'));
 await act(async()=>root.render(createElement(Host)));
 return{dom,window,calls,get currentState(){return currentState},root,cleanup:async()=>{if(root)await act(async()=>root.unmount());clearMocks();dom.window.close();for(const [key,descriptor]of oldGlobals){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}}};
}

async function setupStatusCard(widget,{screenshotPluginMode='global',screenshotPluginColors=[]}={}){
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true}),oldGlobals=new Map(),{window}=dom;
 for(const key of ['window','document','navigator','HTMLElement','Element','Node','IS_REACT_ACT_ENVIRONMENT'])oldGlobals.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
 setGlobal('window',window);setGlobal('document',window.document);setGlobal('navigator',window.navigator);setGlobal('HTMLElement',window.HTMLElement);setGlobal('Element',window.Element);setGlobal('Node',window.Node);setGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 const {default:TagColorStatusWidget}=await vite.ssrLoadModule('/src/TagColorStatusWidget.tsx');
 let currentWidget,currentState,root;
 function Host(){
  const [current,setCurrent]=useState(widget),[settings,setSettings]=useState({relaunchPluginStatus:'enabled',globalMode:'automatic',colors:{},screenshotPluginMode,screenshotPluginColors});
  currentWidget=current;currentState={widget:current,...settings};
  const setColorMode=(color,mode)=>setSettings(value=>{const colors={...value.colors};if(mode)colors[color]=mode;else delete colors[color];return{...value,colors}});
  return createElement(TagColorStatusWidget,{widget:current,update:patch=>setCurrent(value=>({...value,...patch})),widgetPluginContext:{relaunchPluginStatus:settings.relaunchPluginStatus,globalMode:settings.globalMode,colors:settings.colors,setGlobalMode:mode=>setSettings(value=>({...value,globalMode:mode})),setColorMode,screenshotMode:settings.screenshotPluginMode,screenshotColors:settings.screenshotPluginColors,setScreenshotMode:mode=>setSettings(value=>({...value,screenshotPluginMode:mode})),setScreenshotColor:(color,enabled)=>setSettings(value=>({...value,screenshotPluginColors:enabled?[...new Set([...value.screenshotPluginColors,color])]:value.screenshotPluginColors.filter(item=>item!==color)}))}});
 }
 root=createRoot(window.document.querySelector('#root'));await act(async()=>root.render(createElement(Host)));
 return{dom,window,get currentWidget(){return currentWidget},get currentState(){return currentState},root,cleanup:async()=>{if(root)await act(async()=>root.unmount());dom.window.close();for(const [key,descriptor]of oldGlobals){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}}};
}

test('Apps header actions are hidden by default and can be enabled individually',async()=>{
 const widget=createWidget('apps');widget.id='app-actions';widget.title='Attached app';widget.appKey='app-one';widget.appPanelOpen=true;
 const hidden=await setup([widget]);
 try{for(const label of ['Attach open app to Attached app','Detach app from Attached app','Save Attached app to tray'])assert.equal(hidden.window.document.querySelector(`[aria-label="${label}"]`),null,label+' starts hidden')}finally{await hidden.cleanup()}
 const visible=await setup([widget],{showAppAttachAction:true,showAppDetachAction:true,showAppSaveAction:true});
 try{for(const label of ['Attach open app to Attached app','Detach app from Attached app','Save Attached app to tray'])assert.ok(visible.window.document.querySelector(`[aria-label="${label}"]`),label+' can be shown')}finally{await visible.cleanup()}
});

test('Screenshot widget plugin supports global, selected-tag, and off scopes in rendered headers',async()=>{
 const red=createWidget('notes');red.id='red-note';red.tagColor='red';const blue=createWidget('notes');blue.id='blue-note';blue.tagColor='blue';const untagged=createWidget('notes');untagged.id='plain-note';
 const global=await setup([red,blue,untagged]);
 try{assert.equal(global.window.document.querySelectorAll('.widget-snapshot-control').length,3)}finally{await global.cleanup()}
 const selected=await setup([red,blue,untagged],{screenshotPluginMode:'tag-colors',screenshotPluginColors:['red']});
 try{assert.ok(selected.window.document.querySelector('[data-widget-id="red-note"] .widget-snapshot-control'));assert.equal(selected.window.document.querySelector('[data-widget-id="blue-note"] .widget-snapshot-control'),null);assert.equal(selected.window.document.querySelector('[data-widget-id="plain-note"] .widget-snapshot-control'),null)}finally{await selected.cleanup()}
 const off=await setup([red],{screenshotPluginMode:'off'});
 try{assert.equal(off.window.document.querySelector('.widget-snapshot-control'),null)}finally{await off.cleanup()}
});

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

test('Tag Color Status stacks controls from multiple registered widget plugins',async()=>{
 const status=createWidget('tagStatus');status.id='status-card';status.title='Launch status';
 const app=await setupStatusCard(status);
 try{
  await act(async()=>app.window.document.querySelector('[aria-label="Customize status controls"]').dispatchEvent(new app.window.MouseEvent('click',{bubbles:true})));
  const global=app.window.document.querySelector('input[type=checkbox]');assert.ok(global);assert.equal(global.checked,false,'global mode is an optional plugin control');
  await act(async()=>global.dispatchEvent(new app.window.MouseEvent('click',{bubbles:true})));
  const screenshotControl=app.window.document.querySelector('[aria-label="Show Screenshot settings"]');assert.ok(screenshotControl,'the registered Screenshot plugin adds a selectable status-card control');
  await act(async()=>screenshotControl.dispatchEvent(new app.window.MouseEvent('click',{bubbles:true})));
  assert.deepEqual(app.currentWidget.pluginControls,['widget-relaunch.tag-colors','widget-relaunch.global-mode','screenshot.settings']);
  assert.ok(app.window.document.querySelector('[aria-label="Status card global relaunch mode"]'));
  const allGlobal=app.window.document.querySelector('[aria-label="All tag colors follow global mode"]');assert.ok(allGlobal);assert.equal(allGlobal.checked,true,'all colors follow global by default');
  await act(async()=>allGlobal.dispatchEvent(new app.window.MouseEvent('click',{bubbles:true})));
  assert.equal(app.window.document.querySelector('[aria-label="All tag colors follow global mode"]').checked,false,'turning the switch off exposes color-specific rules');
  const addColor=app.window.document.querySelector('[aria-label="Add tag color relaunch setting"]');assert.ok(addColor);
  addColor.value='red';await act(async()=>addColor.dispatchEvent(new app.window.Event('change',{bubbles:true})));
  let redMode=app.window.document.querySelector('[aria-label="Status card red relaunch mode"]');assert.ok(redMode,'selected color settings stack as separate rows');
  redMode.value='manual';await act(async()=>redMode.dispatchEvent(new app.window.Event('change',{bubbles:true})));
  assert.equal(app.window.document.querySelector('[aria-label="All tag colors follow global mode"]').checked,false,'a color-specific choice turns off the all-global switch');
  const addSecondColor=app.window.document.querySelector('[aria-label="Add tag color relaunch setting"]');addSecondColor.value='purple';await act(async()=>addSecondColor.dispatchEvent(new app.window.Event('change',{bubbles:true})));
  assert.ok(app.window.document.querySelector('[aria-label="Status card red relaunch mode"]'));
  assert.ok(app.window.document.querySelector('[aria-label="Status card purple relaunch mode"]'));
  assert.match(app.window.document.querySelector('.tag-status-summary')?.textContent??'',/Manual: Red/);
  assert.ok(app.window.document.querySelector('[aria-label="Status card screenshot scope"]'),'the Screenshot settings appear alongside relaunch controls');
  const scope=app.window.document.querySelector('[aria-label="Status card screenshot scope"]');scope.value='tag-colors';
  await act(async()=>scope.dispatchEvent(new app.window.Event('change',{bubbles:true})));
  const red=app.window.document.querySelector('[aria-label="Status card red screenshot color"]');assert.ok(red);
  await act(async()=>red.dispatchEvent(new app.window.MouseEvent('click',{bubbles:true})));
  assert.equal(app.currentState.screenshotPluginMode,'tag-colors');assert.deepEqual(app.currentState.screenshotPluginColors,['red']);
  const globalSwitch=app.window.document.querySelector('[aria-label="All tag colors follow global mode"]');await act(async()=>globalSwitch.dispatchEvent(new app.window.MouseEvent('click',{bubbles:true})));
  assert.equal(app.window.document.querySelector('[aria-label="All tag colors follow global mode"]').checked,true,'turning global mode back on removes stacked per-color overrides');
  assert.equal(app.window.document.querySelector('[aria-label="Status card red relaunch mode"]'),null);
 }finally{await app.cleanup()}
});

test('Tag Color Status automatically exposes and stacks controls from a newly registered widget plugin',async()=>{
 const {widgetPluginCatalog}=await vite.ssrLoadModule('/src/domain/widgetPlugins.ts');
 const examplePlugin={id:'example-plugin',name:'Example plugin',description:'test extension point',controls:[{id:'example-plugin.status',pluginId:'example-plugin',label:'Example status',available:()=>true,StatusControl:()=>createElement('output',{'aria-label':'Example plugin status'},'Ready')}]};
 widgetPluginCatalog.push(examplePlugin);
 const status=createWidget('tagStatus');status.id='extensible-status-card';
 let app;
 try{
  app=await setupStatusCard(status);
  await act(async()=>app.window.document.querySelector('[aria-label="Customize status controls"]').dispatchEvent(new app.window.MouseEvent('click',{bubbles:true})));
  const choice=app.window.document.querySelector('[aria-label="Show Example status"]');assert.ok(choice,'new plugin controls automatically appear in the status-card customizer');
  await act(async()=>choice.dispatchEvent(new app.window.MouseEvent('click',{bubbles:true})));
  assert.deepEqual(app.currentWidget.pluginControls,['widget-relaunch.tag-colors','example-plugin.status']);
  assert.equal(app.window.document.querySelector('[aria-label="Example plugin status"]')?.textContent,'Ready','the plugin-provided renderer is stacked into the status card');
 }finally{if(app)await app.cleanup();widgetPluginCatalog.splice(widgetPluginCatalog.indexOf(examplePlugin),1)}
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
