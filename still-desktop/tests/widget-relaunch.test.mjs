import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createElement,act,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {mockIPC,clearMocks} from '@tauri-apps/api/mocks';
import {createInitialState,createWidget,minimizeWidgetInstance} from '../src/domain/workspaces.ts';
import {createServer} from 'vite';
import {setNoteText} from './fixtures.mjs';

const types=['group','desmos','notes','focus','ai','files','apps','timetable','tagStatus'];
const rect=(left,top,width,height)=>({x:left,y:top,left,top,right:left+width,bottom:top+height,width,height,toJSON(){return this}});
const info=(args)=>({hwnd:args.id==='app-one'?451:452,pid:args.id==='app-one'?902:903,minWidth:0,minHeight:0,requiredWidth:null,requiredHeight:null,measured:false,probing:false,shown:args.visible??true});
const setGlobal=(key,value)=>Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
const vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,entries:[]}});
after(()=>vite.close());

async function setup(widgets,{identity={hwnd:451,pid:902},startupDeferredIds=new Set(),screenshotPluginMode='global',screenshotPluginColors=[],screenshotPluginColorOverrides={},clockPluginMode='global',clockPluginColors=[],clockPluginColorOverrides={},showAppAttachAction=false,showAppDetachAction=false,showAppSaveAction=false,showWidgetRelaunchAction=true,showWidgetExportPngAction=true,responses={}}={}){
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true});
 const oldGlobals=new Map();
 for(const key of ['window','document','navigator','HTMLElement','Element','Node','Event','CustomEvent','MutationObserver','ResizeObserver','requestAnimationFrame','cancelAnimationFrame','getComputedStyle','isTauri','IS_REACT_ACT_ENVIRONMENT'])oldGlobals.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
 const {window}=dom;
 setGlobal('window',window);setGlobal('document',window.document);setGlobal('navigator',window.navigator);setGlobal('HTMLElement',window.HTMLElement);setGlobal('Element',window.Element);setGlobal('Node',window.Node);setGlobal('Event',window.Event);setGlobal('CustomEvent',window.CustomEvent);setGlobal('MutationObserver',window.MutationObserver);setGlobal('ResizeObserver',class{observe(){}disconnect(){}});setGlobal('requestAnimationFrame',callback=>setTimeout(()=>callback(Date.now()),0));setGlobal('cancelAnimationFrame',clearTimeout);setGlobal('getComputedStyle',window.getComputedStyle.bind(window));setGlobal('isTauri',true);setGlobal('IS_REACT_ACT_ENVIRONMENT',true);
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
  if(Object.hasOwn(responses,command))return typeof responses[command]==='function'?responses[command](args):responses[command];
  return null;
 },{shouldMockEvents:true});
 const {default:WorkspaceCanvas}=await vite.ssrLoadModule('/src/WorkspaceCanvas.tsx');
 const state=createInitialState();state.workspaces[0].widgets=widgets;state.screenshotPluginMode=screenshotPluginMode;state.screenshotPluginColors=screenshotPluginColors;state.screenshotPluginColorOverrides=screenshotPluginColorOverrides;state.clockPluginMode=clockPluginMode;state.clockPluginColors=clockPluginColors;state.clockPluginColorOverrides=clockPluginColorOverrides;
 let currentState,root;
 function Host(){
  const [current,setCurrent]=useState(state);currentState=current;
  const [deferred,setDeferred]=useState(startupDeferredIds);
  const update=(id,patch)=>setCurrent(value=>({...value,workspaces:value.workspaces.map(workspace=>({...workspace,widgets:workspace.widgets.map(item=>item.id===id?{...item,...patch}:item)}))}));
   return createElement(WorkspaceCanvas,{workspaceId:current.workspaces[0].id,transferWidget(){},setWorkspaceDropTarget(){},openAppsDialog(){},editTray(){},presets:current.presets,savePresets(){},openPreset(){},editPreset(){},removePreset(){},renamePreset(){},widgets:current.workspaces[0].widgets,groups:[],updateGroup(){},saveToGroup(){},openGroup(){},editGroup(){},removeGroup(){},openGroupWidget(){},update,add(){},remove(){},begin(){},bringToFront(){},notify(){},obscured:false,openResource(){},openDropped(){},pickApp(){},saveApp(){},appAttachments:{},appAttachmentHandled(){},startupDeferredIds:deferred,startupRelaunch:id=>setDeferred(value=>new Set([...value].filter(item=>item!==id))),widgetRelaunchColors:current.widgetRelaunchColors,setRelaunchColor:(color,mode)=>setCurrent(value=>{const colors={...value.widgetRelaunchColors};if(mode)colors[color]=mode;else delete colors[color];return{...value,widgetRelaunchColors:colors}}),screenshotPluginMode:current.screenshotPluginMode,screenshotPluginColors:current.screenshotPluginColors,screenshotPluginColorOverrides:current.screenshotPluginColorOverrides,setScreenshotColorOverride:(color,enabled)=>setCurrent(value=>{const overrides={...value.screenshotPluginColorOverrides};if(enabled===null)delete overrides[color];else overrides[color]=enabled;return{...value,screenshotPluginColorOverrides:overrides}}),setScreenshotMode:mode=>setCurrent(value=>({...value,screenshotPluginMode:mode})),setScreenshotColor:(color,enabled)=>setCurrent(value=>({...value,screenshotPluginColors:enabled?[...new Set([...value.screenshotPluginColors,color])]:value.screenshotPluginColors.filter(item=>item!==color)})),clockPluginMode:current.clockPluginMode,clockPluginColors:current.clockPluginColors,clockPluginColorOverrides:current.clockPluginColorOverrides,showAppAttachAction,showAppDetachAction,showAppSaveAction,showWidgetRelaunchAction,showWidgetExportPngAction});
 }
 root=createRoot(window.document.querySelector('#root'));
 await act(async()=>root.render(createElement(Host)));
 return{dom,window,calls,get currentState(){return currentState},root,cleanup:async()=>{if(root)await act(async()=>root.unmount());clearMocks();dom.window.close();for(const [key,descriptor]of oldGlobals){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}}};
}

async function setupStatusCard(widget,{screenshotPluginMode='global',screenshotPluginColors=[],screenshotPluginColorOverrides={}}={}){
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true}),oldGlobals=new Map(),{window}=dom;
 for(const key of ['window','document','navigator','HTMLElement','Element','Node','IS_REACT_ACT_ENVIRONMENT'])oldGlobals.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
 setGlobal('window',window);setGlobal('document',window.document);setGlobal('navigator',window.navigator);setGlobal('HTMLElement',window.HTMLElement);setGlobal('Element',window.Element);setGlobal('Node',window.Node);setGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 const {default:TagColorStatusWidget}=await vite.ssrLoadModule('/src/TagColorStatusWidget.tsx');
 let currentWidget,currentState,root;
 function Host(){
  const [current,setCurrent]=useState(widget),[settings,setSettings]=useState({relaunchPluginStatus:'enabled',globalMode:'automatic',colors:{},screenshotPluginMode,screenshotPluginColors,screenshotPluginColorOverrides,clockPluginMode:'global',clockPluginColors:[],clockPluginColorOverrides:{}});
  currentWidget=current;currentState={widget:current,...settings};
  const setColorMode=(color,mode)=>setSettings(value=>{const colors={...value.colors};if(mode)colors[color]=mode;else delete colors[color];return{...value,colors}});
  return createElement(TagColorStatusWidget,{widget:current,update:patch=>setCurrent(value=>({...value,...patch})),widgetPluginContext:{relaunchPluginStatus:settings.relaunchPluginStatus,globalMode:settings.globalMode,colors:settings.colors,setGlobalMode:mode=>setSettings(value=>({...value,globalMode:mode})),setColorMode,screenshotMode:settings.screenshotPluginMode,screenshotColors:settings.screenshotPluginColors,screenshotColorOverrides:settings.screenshotPluginColorOverrides,setScreenshotColorOverride:(color,enabled)=>setSettings(value=>{const overrides={...value.screenshotPluginColorOverrides};if(enabled===null)delete overrides[color];else overrides[color]=enabled;return{...value,screenshotPluginColorOverrides:overrides}}),setScreenshotMode:mode=>setSettings(value=>({...value,screenshotPluginMode:mode})),setScreenshotColor:(color,enabled)=>setSettings(value=>({...value,screenshotPluginColors:enabled?[...new Set([...value.screenshotPluginColors,color])]:value.screenshotPluginColors.filter(item=>item!==color)})),clockMode:settings.clockPluginMode,clockColors:settings.clockPluginColors,clockColorOverrides:settings.clockPluginColorOverrides,setClockMode:mode=>setSettings(value=>({...value,clockPluginMode:mode})),setClockColor:(color,enabled)=>setSettings(value=>({...value,clockPluginColors:enabled?[...new Set([...value.clockPluginColors,color])]:value.clockPluginColors.filter(item=>item!==color)})),setClockColorOverride:(color,enabled)=>setSettings(value=>{const overrides={...value.clockPluginColorOverrides};if(enabled===null)delete overrides[color];else overrides[color]=enabled;return{...value,clockPluginColorOverrides:overrides}})}});
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

test('Notes opens a second tab and switching tabs keeps each page text separate',async()=>{
 const widget=createWidget('notes'),original=widget.noteDocuments[0],app=await setup([widget]);
 try{
  const add=app.window.document.querySelector('[aria-label="New note"]');assert.ok(add);
  await act(async()=>add.click());
  assert.equal(app.currentState.workspaces[0].widgets[0].noteDocuments.length,2);
  const tabs=[...app.window.document.querySelectorAll('[role="tab"]')];assert.equal(tabs.length,2);assert.equal(tabs[1].getAttribute('aria-selected'),'true');
  assert.equal(app.window.document.querySelector('[aria-label="Note text"]').value,'');
  await act(async()=>tabs[0].click());assert.equal(app.window.document.querySelector('[aria-label="Note text"]').value,original.text);
  await act(async()=>tabs[1].click());assert.equal(app.window.document.querySelector('[aria-label="Note text"]').value,'');
 }finally{await app.cleanup()}
});

test('Notes library opens Markdown tabs beside local notes and writes edits to the selected file',async()=>{
 const widget=createWidget('notes'),app=await setup([widget],{responses:{notes_library_choose:'Study',notes_library_list:[{name:'kinetics.md',path:'Chemistry/kinetics.md',size:12},{name:'lecture.pdf',path:'lecture.pdf',size:12}],notes_library_read:'Initial note',files_preview:{mimeType:'application/pdf',base64:'JVBERi0xLjQK'}}});
 try{
  const localId=widget.noteDocuments[0].id;
  await act(async()=>app.window.document.querySelector('.note-library-toggle').click());
  const buttons=[...app.window.document.querySelectorAll('.note-library-heading button')];
  await act(async()=>buttons.find(button=>button.textContent.includes('Choose folder')).click());
  assert.equal(app.currentState.workspaces[0].widgets[0].notesLibraryKey,widget.id);
  const pdf=[...app.window.document.querySelectorAll('.note-library-file')].find(button=>button.textContent.includes('lecture.pdf'));assert.ok(pdf,'the explorer lists PDF attachments');
  await act(async()=>pdf.click());assert.ok(app.window.document.querySelector('.file-preview-frame'),'PDF is previewed inside Notes');
  const folder=[...app.window.document.querySelectorAll('.note-library-file')].find(button=>button.textContent.includes('Chemistry'));assert.ok(folder,'the explorer presents nested folders');
  await act(async()=>folder.click());
  const file=[...app.window.document.querySelectorAll('.note-library-file')][0];assert.equal(file.querySelector('.note-library-file-name').textContent,'kinetics.md');
  await act(async()=>file.click());
  assert.equal(app.window.document.querySelector('.file-preview-text').textContent,'Initial note','Markdown is previewed inside the Notes library');
  await act(async()=>app.window.document.querySelector('.note-library-preview-head button').click());
  assert.equal(app.window.document.querySelector('[aria-label="Note text"]').value,'Initial note');
  assert.equal(app.window.document.querySelectorAll('[role="tab"]').length,2);
  assert.equal(app.currentState.workspaces[0].widgets[0].noteDocuments.find(note=>note.id===localId).text,widget.noteDocuments[0].text);
 }finally{await app.cleanup()}
});

test('AI summary notes use the selected folder and preserve the source note',async()=>{
 const widget=createWidget('notes');widget.notesLibraryKey=widget.id;widget.notesLibraryName='Study';const source={...widget.noteDocuments[0],id:'lecture-source',title:'Lecture',text:'Original lecture facts',sourcePath:'Chemistry/lecture.md'};widget.noteDocuments=[source];widget.activeNoteDocumentId=source.id;widget.title=source.title;widget.text=source.text;
 let summaryText='';const sourceEntry={name:'lecture.md',path:'Chemistry/lecture.md',size:22};
 const app=await setup([widget],{responses:{
  notes_library_list:()=>summaryText?[sourceEntry,{name:'Lecture - Summary.md',path:'Chemistry/Lecture - Summary.md',size:summaryText.length}]:[sourceEntry],
  notes_library_read:args=>args.path===sourceEntry.path?'Original lecture facts':summaryText,
  notes_library_create:args=>{summaryText=args.text;return{name:`${args.title}.md`,path:`${args.location}/${args.title}.md`,size:args.text.length}},
 }});
 try{
  const folder=[...app.window.document.querySelectorAll('.note-library-file')].find(button=>button.textContent.includes('Chemistry'));assert.ok(folder);await act(async()=>folder.click());
  const sourceButton=[...app.window.document.querySelectorAll('.note-library-file')].find(button=>button.textContent.includes('lecture.md'));assert.ok(sourceButton);
  await act(async()=>sourceButton.click());
  let request;app.window.addEventListener('still-assistant-resource',event=>{request=event.detail},{once:true});
  await act(async()=>app.window.document.querySelector('.note-ai-toggle').click());
  const summaryButton=[...app.window.document.querySelectorAll('.note-ai-actions-list button')].find(button=>button.textContent==='Create summary note');assert.ok(summaryButton);
  await act(async()=>summaryButton.click());
  assert.equal(request.workflow,'summary-note');assert.equal(request.autoSubmit,true);assert.equal(request.noteTarget.noteId,source.id);assert.equal(request.noteTarget.expectedText,'Original lecture facts');assert.equal(request.fileActionAllowed,true);
  let receipt='';let rejected;
  await act(async()=>{window.dispatchEvent(new app.window.CustomEvent('still-notes-create-ai-summary',{detail:{widgetId:widget.id,sourceNoteId:source.id,sourcePath:sourceEntry.path,expectedText:'Original lecture facts',title:'Lecture - Summary',draft:'## Key ideas\nVerified facts',resolve:value=>{receipt=value},reject:error=>{rejected=error}}}));await new Promise(resolve=>setTimeout(resolve,10))});
  assert.equal(rejected,undefined);assert.match(receipt,/Lecture - Summary\.md/);assert.equal(summaryText,'## Key ideas\nVerified facts');
  assert.deepEqual(app.calls.find(call=>call.command==='notes_library_create')?.args,{id:widget.id,location:'Chemistry',title:'Lecture - Summary',text:'## Key ideas\nVerified facts'});
  const summaryFile=[...app.window.document.querySelectorAll('.note-library-file')].find(button=>button.textContent.includes('Lecture - Summary.md'));assert.ok(summaryFile?.classList.contains('is-selected'),'the created summary opens in the Files preview');
  assert.equal(app.currentState.workspaces[0].widgets[0].noteDocuments.find(note=>note.id===source.id).text,'Original lecture facts');
  let staleError;await act(async()=>{app.window.dispatchEvent(new app.window.CustomEvent('still-notes-create-ai-summary',{detail:{widgetId:widget.id,sourceNoteId:source.id,sourcePath:sourceEntry.path,expectedText:'stale source',title:'Stale summary',draft:'Must not be written',resolve:()=>{},reject:error=>{staleError=error}}}));await new Promise(resolve=>setTimeout(resolve,5))});
  assert.ok(staleError?.message.includes('changed while the summary was being prepared'));assert.equal(app.calls.filter(call=>call.command==='notes_library_create').length,1);
 }finally{await app.cleanup()}
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

test('Clock add-on button follows global and tag-color visibility settings',async()=>{
 const red=createWidget('notes');red.id='clock-red';red.tagColor='red';red.clockPluginEnabled=true;
 const blue=createWidget('notes');blue.id='clock-blue';blue.tagColor='blue';blue.clockPluginEnabled=true;
 const selected=await setup([red,blue],{clockPluginMode:'tag-colors',clockPluginColors:['red']});
 try{assert.ok(selected.window.document.querySelector('[data-widget-id="clock-red"] .widget-clock-control'));assert.equal(selected.window.document.querySelector('[data-widget-id="clock-blue"] .widget-clock-control'),null)}finally{await selected.cleanup()}
 const override=await setup([red,blue],{clockPluginMode:'off',clockPluginColorOverrides:{blue:true}});
 try{assert.equal(override.window.document.querySelector('[data-widget-id="clock-red"] .widget-clock-control'),null);assert.ok(override.window.document.querySelector('[data-widget-id="clock-blue"] .widget-clock-control'))}finally{await override.cleanup()}
});

test('every workspace widget, including a minimized card, exposes Relaunch',async()=>{
 const widgets=types.map((type,index)=>{const widget=createWidget(type);widget.id=`widget-${type}`;widget.title=type;return index===3?minimizeWidgetInstance(widget,1400,900):widget});
 const app=await setup(widgets);
 try{
  for(const widget of widgets)assert.ok(app.window.document.querySelector(`[data-widget-id="${widget.id}"] [aria-label="Relaunch ${widget.title}"]`),`${widget.type} card has a Relaunch control`);
 }finally{await app.cleanup()}
});

test('Clock is added from a widget plus menu and opens its floating timer from the clock icon',async()=>{
 const note=createWidget('notes');note.id='clock-addon-note';note.title='Clock note';
 const app=await setup([note]);
 try{
  await act(async()=>app.window.document.querySelector('[aria-label="Add widget add-on to Clock note"]').click());
  const addClock=app.window.document.querySelector('[aria-label="Add Clock timer plugin"]');assert.ok(addClock,'Clock is available in the widget add-on menu');
  await act(async()=>addClock.click());
  assert.equal(app.currentState.workspaces[0].widgets[0].clockPluginEnabled,true);
  const clockButton=app.window.document.querySelector('[aria-label="Open clock timer for Clock note"]');assert.ok(clockButton,'adding Clock places a clock icon in the widget header');
   let cardRect=rect(470,600,420,320);const card=clockButton.closest('.canvas-card');card.getBoundingClientRect=()=>cardRect;
  await act(async()=>clockButton.click());
  let dialog=app.window.document.querySelector('[role="dialog"][aria-label="Clock timer for Clock note"]');assert.ok(dialog,'the clock icon opens a floating timer dialog');
  assert.ok(app.window.document.querySelector('[aria-label="Set timer duration"]'),'the floating panel contains the dial');
   assert.equal(dialog.style.top,'372px','the compact timer sits directly above its card when there is room');
   await act(async()=>{cardRect=rect(510,620,420,320);card.style.left='40px';await new Promise(resolve=>setTimeout(resolve,0))});
   assert.equal(dialog.style.top,'392px','the timer panel follows its widget when it moves');
  await act(async()=>app.window.document.querySelector('[aria-label="Close clock timer"]').click());
   cardRect=rect(470,20,420,320);
  await act(async()=>clockButton.click());
  dialog=app.window.document.querySelector('[role="dialog"][aria-label="Clock timer for Clock note"]');assert.ok(dialog);
   assert.equal(dialog.style.top,'348px','when there is not enough room above, it opens below the entire card without covering it');
   assert.ok(Number.parseFloat(dialog.style.top)>=cardRect.bottom,'the fallback position stays clear of the whole widget');
 }finally{await app.cleanup()}
});

test('Relaunch and Export PNG controls can be hidden independently without removing manual startup recovery',async()=>{
 const note=createWidget('notes');note.id='button-note';note.title='Button note';
 const minimized=minimizeWidgetInstance({...createWidget('focus'),id:'minimized-focus',title:'Minimized focus'},1400,900);
 const hidden=await setup([note,minimized],{showWidgetRelaunchAction:false,showWidgetExportPngAction:false,startupDeferredIds:new Set(['button-note'])});
 try{
  assert.equal(hidden.window.document.querySelector('[data-widget-id="button-note"] .widget-relaunch-control'),null,'the normal card Relaunch toolbar control can be hidden');
  assert.equal(hidden.window.document.querySelector('[data-widget-id="minimized-focus"] .widget-minimized-relaunch'),null,'the minimized-card Relaunch control follows the same setting');
  assert.equal(hidden.window.document.querySelector('[aria-label="Export Button note PNG"]'),null,'the PNG export button can be hidden');
  assert.ok([...hidden.window.document.querySelectorAll('[data-widget-id="button-note"] button')].some(button=>button.textContent==='Relaunch Button note'),'manual-startup recovery remains available when its toolbar button is hidden');
 }finally{await hidden.cleanup()}
 const onlyExport=await setup([note],{showWidgetRelaunchAction:false,showWidgetExportPngAction:true});
 try{assert.ok(onlyExport.window.document.querySelector('[aria-label="Export Button note PNG"]'),'PNG export can remain visible while Relaunch is hidden')}finally{await onlyExport.cleanup()}
 const onlyRelaunch=await setup([note],{showWidgetRelaunchAction:true,showWidgetExportPngAction:false});
 try{assert.ok(onlyRelaunch.window.document.querySelector('[aria-label="Relaunch Button note"]'),'Relaunch can remain visible while PNG export is hidden');assert.equal(onlyRelaunch.window.document.querySelector('[aria-label="Export Button note PNG"]'),null)}finally{await onlyRelaunch.cleanup()}
});

test('Relaunch remounts an ordinary widget view while preserving its saved content',async()=>{
 const note=createWidget('notes');note.id='saved-note';note.title='Quick note';setNoteText(note,'Keep this saved text');
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
 const note=createWidget('notes');note.id='manual-note';note.title='Manual note';setNoteText(note,'Keep this saved text');note.placement={x:700,y:360,width:400,height:340};
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

test('manual startup delays native app creation until the user relaunches its card',async()=>{
 const widget=createWidget('apps');widget.id='manual-app';widget.title='Manual app';widget.appKey='editor-grant';widget.appName='Editor.exe';widget.appPanelOpen=true;
 const app=await setup([widget],{startupDeferredIds:new Set(['manual-app'])});
 try{
  await act(async()=>await new Promise(resolve=>setTimeout(resolve,30)));
  assert.equal(app.calls.filter(call=>call.command==='app_panel_open').length,0);
  assert.ok(app.window.document.querySelector('[data-widget-id="manual-app"]'));
  await act(async()=>app.window.document.querySelector('[aria-label="Relaunch Manual app"]').dispatchEvent(new app.window.MouseEvent('click',{bubbles:true})));
  await act(async()=>{for(let attempt=0;attempt<40&&!app.calls.some(call=>call.command==='app_panel_open');attempt++)await new Promise(resolve=>setTimeout(resolve,10))});
  assert.equal(app.calls.filter(call=>call.command==='app_panel_open').length,1);
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
  let redSetting=app.window.document.querySelector('[aria-label="Add red plugin setting"]');assert.ok(redSetting,'a color rule can stack plugin settings through its dropdown');redSetting.value='relaunch';await act(async()=>redSetting.dispatchEvent(new app.window.Event('change',{bubbles:true})));
  let redMode=app.window.document.querySelector('[aria-label="Status card red relaunch mode"]');assert.ok(redMode,'selected color settings stack as separate rows');
  redMode.value='manual';await act(async()=>redMode.dispatchEvent(new app.window.Event('change',{bubbles:true})));
  assert.equal(app.window.document.querySelector('[aria-label="All tag colors follow global mode"]').checked,false,'a color-specific choice turns off the all-global switch');
  const addSecondColor=app.window.document.querySelector('[aria-label="Add tag color relaunch setting"]');addSecondColor.value='purple';await act(async()=>addSecondColor.dispatchEvent(new app.window.Event('change',{bubbles:true})));
  assert.ok(app.window.document.querySelector('[aria-label="Status card red relaunch mode"]'));
  const purpleSetting=app.window.document.querySelector('[aria-label="Add purple plugin setting"]');purpleSetting.value='relaunch';await act(async()=>purpleSetting.dispatchEvent(new app.window.Event('change',{bubbles:true})));
  assert.ok(app.window.document.querySelector('[aria-label="Status card purple relaunch mode"]'));
  assert.match(app.window.document.querySelector('.tag-status-summary')?.textContent??'',/Manual: Red/);
  redSetting=app.window.document.querySelector('[aria-label="Add red plugin setting"]');redSetting.value='screenshot';await act(async()=>redSetting.dispatchEvent(new app.window.Event('change',{bubbles:true})));
  const redScreenshot=app.window.document.querySelector('[aria-label="Status card red screenshot setting"]');assert.ok(redScreenshot,'Screenshot is available as another setting within Red');redScreenshot.value='disabled';await act(async()=>redScreenshot.dispatchEvent(new app.window.Event('change',{bubbles:true})));
  const {showScreenshotControl}=await vite.ssrLoadModule('/src/domain/screenshotPlugin.ts');
  assert.equal(showScreenshotControl('global',[],'red',app.currentState.screenshotPluginColorOverrides),false,'a red color override can hide its camera while global screenshot remains enabled');
  assert.equal(showScreenshotControl('global',[],'blue',app.currentState.screenshotPluginColorOverrides),true,'the color override leaves other colors unchanged');
  assert.ok(app.window.document.querySelector('[aria-label="Status card screenshot scope"]'),'the Screenshot settings appear alongside relaunch controls');
  const scope=app.window.document.querySelector('[aria-label="Status card screenshot scope"]');scope.value='tag-colors';
  await act(async()=>scope.dispatchEvent(new app.window.Event('change',{bubbles:true})));
  const red=app.window.document.querySelector('[aria-label="Status card red screenshot color"]');assert.ok(red);
  await act(async()=>red.dispatchEvent(new app.window.MouseEvent('click',{bubbles:true})));
  assert.equal(app.currentState.screenshotPluginMode,'tag-colors');assert.deepEqual(app.currentState.screenshotPluginColors,['red']);
  const globalSwitch=app.window.document.querySelector('[aria-label="All tag colors follow global mode"]');await act(async()=>globalSwitch.dispatchEvent(new app.window.MouseEvent('click',{bubbles:true})));
  assert.equal(app.window.document.querySelector('[aria-label="All tag colors follow global mode"]').checked,true,'turning global mode back on removes stacked per-color overrides');
  assert.deepEqual(app.currentState.screenshotPluginColorOverrides,{},'following global clears color-specific Screenshot overrides');
  assert.equal(app.window.document.querySelector('[aria-label="Status card red relaunch mode"]'),null);
 }finally{await app.cleanup()}
});

test('Tag Color Status exposes Clock timer globally and as a stacked tag-color setting',async()=>{
 const status=createWidget('tagStatus');status.id='clock-status-card';
 const app=await setupStatusCard(status);
 try{
  await act(async()=>app.window.document.querySelector('[aria-label="Customize status controls"]').dispatchEvent(new app.window.MouseEvent('click',{bubbles:true})));
  const clockControl=app.window.document.querySelector('[aria-label="Show Clock timer settings"]');
  assert.ok(clockControl,'Clock timer must be registered as a selectable widget-plugin control');
  await act(async()=>clockControl.dispatchEvent(new app.window.MouseEvent('click',{bubbles:true})));
  assert.ok(app.window.document.querySelector('[aria-label="Status card clock timer scope"]'),'Clock timer global settings render on the status card');
  const allGlobal=app.window.document.querySelector('[aria-label="All tag colors follow global mode"]');
  await act(async()=>allGlobal.dispatchEvent(new app.window.MouseEvent('click',{bubbles:true})));
  const color=app.window.document.querySelector('[aria-label="Add tag color relaunch setting"]');color.value='red';await act(async()=>color.dispatchEvent(new app.window.Event('change',{bubbles:true})));
  const setting=app.window.document.querySelector('[aria-label="Add red plugin setting"]');assert.ok(setting);
  setting.value='clock-timer';await act(async()=>setting.dispatchEvent(new app.window.Event('change',{bubbles:true})));
  const redClock=app.window.document.querySelector('[aria-label="Status card red clock timer setting"]');assert.ok(redClock,'Clock timer can be stacked under a tag color');
  redClock.value='disabled';await act(async()=>redClock.dispatchEvent(new app.window.Event('change',{bubbles:true})));
  assert.equal(app.currentState.clockPluginColorOverrides.red,false,'the color rule persists the disabled Clock override');
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

test('the rendered workspace responds to the overview shortcut event',async()=>{
 const widget=createWidget('notes');widget.id='map-note';widget.title='Map note';
 const app=await setup([widget]);
 try{
  assert.ok(app.window.document.querySelector('.canvas-overview'),'the map is visible by default');
  await act(async()=>app.window.document.dispatchEvent(new app.window.Event('still:workspace-overview-toggle')));
  assert.equal(app.window.document.querySelector('.canvas-overview'),null,'Ctrl+M hides the map');
  await act(async()=>app.window.document.dispatchEvent(new app.window.Event('still:workspace-overview-toggle')));
  assert.ok(app.window.document.querySelector('.canvas-overview'),'the native shortcut event restores the map');
 }finally{await app.cleanup()}
});

test('Ctrl+Shift+right-click on a workspace card minimizes it, while ordinary right-click does not',async()=>{
 const widget=createWidget('notes');widget.id='context-note';widget.title='Context note';
 const app=await setup([widget]);
 try{
  const card=app.window.document.querySelector('[data-widget-id="context-note"]');
  await act(async()=>card.dispatchEvent(new app.window.MouseEvent('contextmenu',{bubbles:true,cancelable:true,button:2,ctrlKey:true})));
  assert.equal(card.classList.contains('widget-minimized'),false,'ordinary right-click leaves the widget open');
  await act(async()=>card.dispatchEvent(new app.window.MouseEvent('contextmenu',{bubbles:true,cancelable:true,button:0,ctrlKey:true,shiftKey:true})));
  assert.equal(card.classList.contains('widget-minimized'),false,'the left-click gesture remains untouched');
  await act(async()=>card.dispatchEvent(new app.window.MouseEvent('contextmenu',{bubbles:true,cancelable:true,button:2,ctrlKey:true,shiftKey:true})));
  assert.equal(card.classList.contains('widget-minimized'),true,'Ctrl+Shift+right-click minimizes the widget');
 }finally{await app.cleanup()}
});
