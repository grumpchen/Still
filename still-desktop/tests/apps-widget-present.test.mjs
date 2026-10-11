import {after,test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement,act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {mockIPC,clearMocks} from '@tauri-apps/api/mocks';
import {createServer} from 'vite';

const vite=await createServer({server:{middlewareMode:true},appType:'custom'});
after(()=>vite.close());
const rect=(left,top,width,height)=>({x:left,y:top,left,top,right:left+width,bottom:top+height,width,height,toJSON(){return this}});
const waitFor=async(predicate)=>{const end=Date.now()+3000;while(Date.now()<end){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,10))}assert.ok(predicate(),'Timed out waiting for AppsWidget presentation')};
const setGlobal=(key,value)=>Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
const app=(id,{open=true,update=()=>{}}={})=>createElement(AppsWidget,{widget:{id,type:'apps',title:id,appName:'Test app',appKey:'test-app',appPanelOpen:open,placement:{x:0,y:0,width:620,height:500}},update,notify(){},obscured:false,workspaceActive:true});
let AppsWidget;

test('rendered AppsWidgets hide only lower native content under a higher card and recover without reattaching',async()=>{
 const dom=new JSDOM('<div class="workspace-canvas"><div class="canvas-viewport" data-test="viewport"><div class="canvas-card" data-test="app-a" style="z-index:1"><div class="widget-content"><div id="root-a"></div><div class="widget-resize"></div></div></div><div class="canvas-card" data-test="app-b" style="z-index:2"><div class="widget-content"><div id="root-b"></div><div class="widget-resize"></div></div></div></div></div>',{url:'http://localhost',pretendToBeVisual:true});
 const oldGlobals=new Map();
 for(const key of ['window','document','navigator','HTMLElement','Element','Node','MutationObserver','ResizeObserver','requestAnimationFrame','cancelAnimationFrame','getComputedStyle','isTauri','IS_REACT_ACT_ENVIRONMENT'])oldGlobals.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
 const calls=[];let rootA,rootB,appBRect=rect(300,220,620,500);
 try{
  const {window}=dom;setGlobal('window',window);setGlobal('document',window.document);setGlobal('navigator',window.navigator);setGlobal('HTMLElement',window.HTMLElement);setGlobal('Element',window.Element);setGlobal('Node',window.Node);setGlobal('MutationObserver',window.MutationObserver);setGlobal('ResizeObserver',class{observe(){}disconnect(){}});setGlobal('requestAnimationFrame',callback=>setTimeout(()=>callback(Date.now()),0));setGlobal('cancelAnimationFrame',clearTimeout);setGlobal('getComputedStyle',window.getComputedStyle.bind(window));setGlobal('isTauri',true);setGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  window.HTMLElement.prototype.getBoundingClientRect=function(){
   if(this.dataset.test==='viewport')return rect(0,0,1000,700);
   const card=this.closest('.canvas-card'),id=card?.dataset.test;
   if(this.dataset.test==='app-a')return rect(100,100,620,500);
   if(this.dataset.test==='app-b')return appBRect;
   if(this.classList.contains('widget-resize'))return id==='app-b'?rect(appBRect.right-32,appBRect.bottom-32,32,32):rect(688,568,32,32);
   if(this.classList.contains('widget-content')||this.classList.contains('app-panel-host'))return id==='app-b'?rect(appBRect.left,appBRect.top+50,appBRect.width,appBRect.height-50):rect(100,150,620,450);
   return rect(0,0,0,0);
  };
  mockIPC((command,args)=>{
   calls.push({command,args});
   if(command==='app_panel_open')return{hwnd:args.id==='app-a'?451:452,pid:args.id==='app-a'?902:903,minWidth:0,minHeight:0,requiredWidth:null,requiredHeight:null,measured:false,probing:false,shown:true};
   if(command==='app_panel_present')return{hwnd:args.id==='app-a'?451:452,pid:args.id==='app-a'?902:903,minWidth:0,minHeight:0,requiredWidth:null,requiredHeight:null,measured:false,probing:false,shown:args.visible};
   return null;
  },{shouldMockEvents:true});
  ({default:AppsWidget}=await vite.ssrLoadModule('/src/AppsWidget.tsx'));
  rootA=createRoot(window.document.querySelector('#root-a'));rootB=createRoot(window.document.querySelector('#root-b'));
  await act(async()=>{rootA.render(app('app-a'));rootB.render(app('app-b'))});
  const presentations=id=>calls.filter(call=>call.command==='app_panel_present'&&call.args.id===id);
  await waitFor(()=>presentations('app-a').length>0&&presentations('app-b').length>0);
  await waitFor(()=>presentations('app-a').at(-1).args.revision>0&&presentations('app-b').at(-1).args.revision>0);
  assert.deepEqual([presentations('app-a').at(-1).args.visible,presentations('app-b').at(-1).args.visible],[false,true],'only the lower app HWND is hidden');
  const moveHigher=async(next)=>{const previous=presentations('app-a').length;appBRect=next;const higher=window.document.querySelector('[data-test="app-b"]');higher.style.left=String(next.left)+'px';higher.style.top=String(next.top)+'px';higher.style.setProperty('--test-revision',String(previous));await waitFor(()=>presentations('app-a').length>previous);return presentations('app-a').at(-1).args.visible};
  assert.equal(await moveHigher(rect(100,100,160,40)),true,'overlap with the lower card header does not hide native content');
  assert.equal(await moveHigher(rect(300,220,620,500)),false,'overlap with lower native content hides that HWND');
  assert.equal(await moveHigher(rect(740,100,620,500)),true,'moving the higher card clear shows the same attached HWND');
  assert.deepEqual(calls.filter(call=>call.command==='app_panel_open').map(call=>call.args.id).sort(),['app-a','app-b'],'visibility changes do not attach another window');
  assert.equal(calls.filter(call=>call.command==='app_panel_release').length,0,'visibility changes do not release either attached window');
 }finally{
  if(rootB)await act(async()=>rootB.unmount());if(rootA)await act(async()=>rootA.unmount());
  clearMocks();dom.window.close();
  for(const [key,descriptor] of oldGlobals){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}
 }
});

test('a saved Apps widget shows a reopen action and launches its app inside the widget when clicked',async()=>{
 const dom=new JSDOM('<div class="workspace-canvas"><div class="canvas-viewport"><div class="canvas-card" style="z-index:1"><div class="widget-content"><div id="root"></div><div class="widget-resize"></div></div></div></div></div>',{url:'http://localhost',pretendToBeVisual:true});
 const oldGlobals=new Map();
 for(const key of ['window','document','navigator','HTMLElement','Element','Node','MutationObserver','ResizeObserver','requestAnimationFrame','cancelAnimationFrame','getComputedStyle','isTauri','IS_REACT_ACT_ENVIRONMENT'])oldGlobals.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
 const calls=[],updates=[];let root;
 try{
  const {window}=dom;setGlobal('window',window);setGlobal('document',window.document);setGlobal('navigator',window.navigator);setGlobal('HTMLElement',window.HTMLElement);setGlobal('Element',window.Element);setGlobal('Node',window.Node);setGlobal('MutationObserver',window.MutationObserver);setGlobal('ResizeObserver',class{observe(){}disconnect(){}});setGlobal('requestAnimationFrame',callback=>setTimeout(()=>callback(Date.now()),0));setGlobal('cancelAnimationFrame',clearTimeout);setGlobal('getComputedStyle',window.getComputedStyle.bind(window));setGlobal('isTauri',true);setGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  window.HTMLElement.prototype.getBoundingClientRect=function(){return rect(100,100,this.classList.contains('widget-content')?620:620,this.classList.contains('widget-content')?450:500)};
  mockIPC((command,args)=>{calls.push({command,args});if(command==='app_panel_open')return{hwnd:451,pid:902,minWidth:0,minHeight:0,requiredWidth:null,requiredHeight:null,measured:false,probing:false,shown:true};if(command==='app_panel_present')return{hwnd:451,pid:902,minWidth:0,minHeight:0,requiredWidth:null,requiredHeight:null,measured:false,probing:false,shown:args.visible};return null},{shouldMockEvents:true});
  ({default:AppsWidget}=await vite.ssrLoadModule('/src/AppsWidget.tsx'));
  root=createRoot(window.document.querySelector('#root'));await act(async()=>root.render(app('app-reopen',{open:false,update:patch=>updates.push(patch)})));
  const reopen=window.document.querySelector('[aria-label="Reopen Test app in widget"]');assert.ok(reopen,'the closed saved app has an explicit reopen button');assert.equal(reopen.textContent,'Reopen app in widget');
  await act(async()=>reopen.dispatchEvent(new window.MouseEvent('click',{bubbles:true})));
  await waitFor(()=>calls.some(call=>call.command==='app_panel_open'));
  assert.ok(updates.some(patch=>patch.appPanelOpen===true),'clicking reopen sets the widget open state');
  assert.equal(calls.filter(call=>call.command==='app_panel_open').length,1,'the existing app source opens through this widget');
 }finally{
  if(root)await act(async()=>root.unmount());clearMocks();dom.window.close();
  for(const [key,descriptor]of oldGlobals){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}
 }
});
