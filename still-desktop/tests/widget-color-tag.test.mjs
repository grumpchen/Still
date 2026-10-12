import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement,act,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {createInitialState,createWidget,parseState} from '../src/domain/workspaces.ts';

test('the widget add-on button adds a color tag and clicking that tag edits its color',async()=>{
 const {createServer}=await import('vite');
 const vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,entries:[]}});
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true});
 const oldGlobals=new Map();
 for(const key of ['window','document','navigator','HTMLElement','Element','Node','MutationObserver','ResizeObserver','requestAnimationFrame','cancelAnimationFrame','getComputedStyle','IS_REACT_ACT_ENVIRONMENT'])oldGlobals.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
 let root,currentState;
 const setGlobal=(key,value)=>Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
 try{
  const {window}=dom;setGlobal('window',window);setGlobal('document',window.document);setGlobal('navigator',window.navigator);setGlobal('HTMLElement',window.HTMLElement);setGlobal('Element',window.Element);setGlobal('Node',window.Node);setGlobal('MutationObserver',window.MutationObserver);setGlobal('ResizeObserver',class{observe(){}disconnect(){}});setGlobal('requestAnimationFrame',window.requestAnimationFrame.bind(window));setGlobal('cancelAnimationFrame',window.cancelAnimationFrame.bind(window));setGlobal('getComputedStyle',window.getComputedStyle.bind(window));setGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  const state=createInitialState(),widget=createWidget('notes');widget.id='tagged-note';widget.title='Quick note';state.workspaces[0].widgets=[widget];
  const {default:WorkspaceCanvas}=await vite.ssrLoadModule('/src/WorkspaceCanvas.tsx');
  function Host(){const [current,setCurrent]=useState(state);currentState=current;return createElement(WorkspaceCanvas,{workspaceId:current.workspaces[0].id,transferWidget(){},setWorkspaceDropTarget(){},openAppsDialog(){},editTray(){},presets:current.presets,savePresets(){},openPreset(){},editPreset(){},removePreset(){},renamePreset(){},renameGroup(){},widgets:current.workspaces[0].widgets,groups:[],updateGroup(){},saveToGroup(){},openGroup(){},editGroup(){},removeGroup(){},openGroupWidget(){},update:(id,patch)=>setCurrent(s=>({...s,workspaces:s.workspaces.map(workspace=>({...workspace,widgets:workspace.widgets.map(item=>item.id===id?{...item,...patch}:item)}))})),add(){},remove(){},begin(){},bringToFront(){},notify(){},obscured:false,openResource(){},openDropped(){},pickApp(){},saveApp(){},appAttachments:{},appAttachmentHandled(){}})}
  root=createRoot(window.document.querySelector('#root'));await act(async()=>root.render(createElement(Host)));
  const customize=window.document.querySelector('[aria-label="Add widget add-on to Quick note"]');assert.ok(customize,'the widget header exposes its add-on button');assert.equal(customize.textContent,'+');
  let customizeRect={top:100,right:500,bottom:126,left:474,width:26,height:26,x:474,y:100,toJSON(){return this}};customize.getBoundingClientRect=()=>customizeRect;
  await act(async()=>customize.dispatchEvent(new window.MouseEvent('click',{bubbles:true})));
  const pluginMenu=window.document.querySelector('.widget-plugin-menu');assert.ok(pluginMenu,'the plus button opens the add-on list');assert.equal(window.document.querySelector('.widget-tag-palette'),null,'the plus button does not open tag colors');assert.equal(pluginMenu.closest('.canvas-card'),null,'the menu escapes card clipping and native content');assert.equal(pluginMenu.style.top,'60px','the menu opens above the widget header');assert.equal(pluginMenu.querySelectorAll('.widget-plugin-choice').length,1,'the plus menu contains plugin choices only');assert.equal(pluginMenu.textContent.includes('Startup behavior'),false,'startup policy is not part of the plugin adder');
  await act(async()=>{customizeRect={...customizeRect,top:150,right:520,bottom:176,left:494,y:150};window.document.querySelector('.canvas-card').style.left='32px';await new Promise(resolve=>setTimeout(resolve,0))});
  assert.equal(pluginMenu.style.top,'110px','the add-on list follows the widget when it moves');assert.equal(pluginMenu.style.right,String(window.innerWidth-520)+'px');
  const addTag=window.document.querySelector('[aria-label="Add Color tag plugin"]');assert.ok(addTag,'color tag is offered as an add-on');
  await act(async()=>addTag.dispatchEvent(new window.MouseEvent('click',{bubbles:true})));
  assert.equal(currentState.workspaces[0].widgets[0].tagColor,'blue');
  assert.equal(parseState(JSON.stringify(currentState)).workspaces[0].widgets[0].tagColor,'blue');
  let activeTag=window.document.querySelector('[aria-label="Change blue tag color"]');assert.ok(activeTag,'the added tag is directly clickable');
  let activeTagRect={top:100,right:474,bottom:126,left:452,width:22,height:26,x:452,y:100,toJSON(){return this}};activeTag.getBoundingClientRect=()=>activeTagRect;
  await act(async()=>activeTag.dispatchEvent(new window.MouseEvent('click',{bubbles:true})));
  const palette=window.document.querySelector('.widget-tag-palette');assert.ok(palette,'clicking the tag opens its color palette');assert.equal(palette.closest('.canvas-card'),null,'the palette escapes card clipping and native content');assert.equal(palette.style.position,'fixed');assert.equal(palette.style.top,'60px','the palette opens above the widget header');
  await act(async()=>{activeTagRect={...activeTagRect,top:200,right:540,bottom:226,left:518,y:200};window.document.querySelector('.canvas-card').style.left='64px';await new Promise(resolve=>setTimeout(resolve,0))});
  assert.equal(palette.style.top,'160px','the color palette follows the widget when it moves');assert.equal(palette.style.right,String(window.innerWidth-540)+'px');
  const red=window.document.querySelector('[aria-label="Set red tag color"]');assert.ok(red,'the color palette offers the red tag');
  await act(async()=>red.dispatchEvent(new window.MouseEvent('click',{bubbles:true})));
  assert.equal(currentState.workspaces[0].widgets[0].tagColor,'red');
  assert.equal(parseState(JSON.stringify(currentState)).workspaces[0].widgets[0].tagColor,'red');
  assert.equal(window.document.querySelector('.widget-active-tag')?.getAttribute('data-tag-color'),'red');
  activeTag=window.document.querySelector('[aria-label="Change red tag color"]');activeTagRect={top:100,right:474,bottom:126,left:452,width:22,height:26,x:452,y:100,toJSON(){return this}};activeTag.getBoundingClientRect=()=>activeTagRect;
  await act(async()=>activeTag.dispatchEvent(new window.MouseEvent('click',{bubbles:true})));
  const remove=window.document.querySelector('[aria-label="Remove color tag"]');assert.ok(remove,'the customization menu lets the user remove the selected tag');
  await act(async()=>remove.dispatchEvent(new window.MouseEvent('click',{bubbles:true})));
  assert.equal(currentState.workspaces[0].widgets[0].tagColor,null);
  assert.equal(window.document.querySelector('.widget-active-tag'),null);
 }finally{
  if(root)await act(async()=>root.unmount());dom.window.close();await vite.close();
  for(const [key,descriptor]of oldGlobals){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}
 }
});
