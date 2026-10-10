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
const waitFor=async(predicate)=>{const end=Date.now()+3000;while(Date.now()<end){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,10))}assert.ok(predicate(),'Timed out waiting for BrowserWidget presentation')};
const setGlobal=(key,value)=>Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
const browser=(id)=>createElement(BrowserWidget,{widget:{id,type:'browser',title:id,url:'https://example.com',placement:{x:0,y:0,width:620,height:500}},update(){},notify(){},obscured:false,workspaceActive:true});
let BrowserWidget;

test('rendered BrowserWidgets hide only the lower native Chrome window under a higher card',async()=>{
 const dom=new JSDOM('<div class="workspace-canvas"><div class="canvas-viewport" data-test="viewport"><div class="canvas-card" data-test="browser-a" style="z-index:1"><div class="widget-content"><div id="root-a"></div><div class="widget-resize"></div></div></div><div class="canvas-card" data-test="browser-b" style="z-index:2"><div class="widget-content"><div id="root-b"></div><div class="widget-resize"></div></div></div></div></div>',{url:'http://localhost',pretendToBeVisual:true});
 const oldGlobals=new Map();
 for(const key of ['window','document','navigator','HTMLElement','Element','Node','MutationObserver','ResizeObserver','requestAnimationFrame','cancelAnimationFrame','getComputedStyle','isTauri','IS_REACT_ACT_ENVIRONMENT'])oldGlobals.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
 const calls=[];let rootA,rootB,browserBRect=rect(300,220,620,500);
 try{
  const {window}=dom;setGlobal('window',window);setGlobal('document',window.document);setGlobal('navigator',window.navigator);setGlobal('HTMLElement',window.HTMLElement);setGlobal('Element',window.Element);setGlobal('Node',window.Node);setGlobal('MutationObserver',window.MutationObserver);setGlobal('ResizeObserver',class{observe(){}disconnect(){}});setGlobal('requestAnimationFrame',callback=>setTimeout(()=>callback(Date.now()),0));setGlobal('cancelAnimationFrame',clearTimeout);setGlobal('getComputedStyle',window.getComputedStyle.bind(window));setGlobal('isTauri',true);setGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  window.HTMLElement.prototype.getBoundingClientRect=function(){
   if(this.dataset.test==='viewport')return rect(0,0,1000,700);
   const card=this.closest('.canvas-card'),id=card?.dataset.test;
   if(this.dataset.test==='browser-a')return rect(100,100,620,500);
   if(this.dataset.test==='browser-b')return browserBRect;
   if(this.classList.contains('widget-resize'))return id==='browser-b'?rect(browserBRect.right-32,browserBRect.bottom-32,32,32):rect(688,568,32,32);
   if(this.classList.contains('widget-content')||this.classList.contains('browser-host'))return id==='browser-b'?rect(browserBRect.left,browserBRect.top+50,browserBRect.width,browserBRect.height-50):rect(100,150,620,450);
   return rect(0,0,0,0);
  };
  mockIPC((command,args)=>{
   calls.push({command,args});
   if(command==='chrome_panel_open')return{hwnd:args.id==='browser-a'?451:452,pid:args.id==='browser-a'?902:903};
   if(command==='chrome_panel_present')return args.visible;
   if(command==='chrome_panel_close')return null;
   return null;
  },{shouldMockEvents:true});
  ({default:BrowserWidget}=await vite.ssrLoadModule('/src/BrowserWidget.tsx'));
  rootA=createRoot(window.document.querySelector('#root-a'));rootB=createRoot(window.document.querySelector('#root-b'));
  await act(async()=>{rootA.render(browser('browser-a'));rootB.render(browser('browser-b'))});
  const presentations=id=>calls.filter(call=>call.command==='chrome_panel_present'&&call.args.id===id);
  await waitFor(()=>presentations('browser-a').length>0&&presentations('browser-b').length>0);
  await waitFor(()=>presentations('browser-a').at(-1).args.revision>0&&presentations('browser-b').at(-1).args.revision>0);
  assert.deepEqual([presentations('browser-a').at(-1).args.visible,presentations('browser-b').at(-1).args.visible],[false,true], 'the lower Browser hides its attached Chrome HWND while the upper Browser remains visible');
  const moveHigher=async(next)=>{const previous=presentations('browser-a').length;browserBRect=next;const higher=window.document.querySelector('[data-test="browser-b"]');higher.style.left=String(next.left)+'px';higher.style.top=String(next.top)+'px';higher.style.setProperty('--test-revision',String(previous));await waitFor(()=>presentations('browser-a').length>previous);return presentations('browser-a').at(-1).args.visible};
  assert.equal(await moveHigher(rect(100,100,160,40)),true,'overlap with only the lower Browser header does not hide native content');
  assert.equal(await moveHigher(rect(300,220,620,500)),false,'returning a higher card to native content hides the lower window again');
  assert.equal(await moveHigher(rect(740,100,620,500)),true,'moving the higher card clear shows the same attached native window');
  assert.deepEqual(calls.filter(call=>call.command==='chrome_panel_open').map(call=>call.args.id).sort(),['browser-a','browser-b'],'visibility changes keep both original browser windows attached');
  assert.equal(calls.filter(call=>call.command==='chrome_panel_close').length,0,'visibility changes do not close or relaunch either browser');
  assert.ok(presentations('browser-a').every(call=>call.args.id==='browser-a'));
 }finally{
  if(rootB)await act(async()=>rootB.unmount());if(rootA)await act(async()=>rootA.unmount());
  clearMocks();dom.window.close();
  for(const [key,descriptor] of oldGlobals){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}
 }
});
