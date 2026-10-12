import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createElement,act,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {mockIPC,clearMocks} from '@tauri-apps/api/mocks';
import {createWidget} from '../src/domain/workspaces.ts';
import {createServer} from 'vite';

const rect=(left,top,width,height)=>({x:left,y:top,left,top,right:left+width,bottom:top+height,width,height,toJSON(){return this}});
const setGlobal=(key,value)=>Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
const vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,entries:[]}});
after(()=>vite.close());

async function setup(widgets){
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true}),oldGlobals=new Map(),{window}=dom;
 for(const key of ['window','document','navigator','HTMLElement','Element','Node','MutationObserver','ResizeObserver','requestAnimationFrame','cancelAnimationFrame','getComputedStyle','isTauri','IS_REACT_ACT_ENVIRONMENT'])oldGlobals.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
 setGlobal('window',window);setGlobal('document',window.document);setGlobal('navigator',window.navigator);setGlobal('HTMLElement',window.HTMLElement);setGlobal('Element',window.Element);setGlobal('Node',window.Node);setGlobal('MutationObserver',window.MutationObserver);setGlobal('ResizeObserver',class{observe(){}disconnect(){}});setGlobal('requestAnimationFrame',callback=>setTimeout(()=>callback(Date.now()),0));setGlobal('cancelAnimationFrame',clearTimeout);setGlobal('getComputedStyle',window.getComputedStyle.bind(window));setGlobal('isTauri',true);setGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 window.HTMLElement.prototype.getBoundingClientRect=function(){if(this.classList.contains('canvas-viewport'))return rect(0,0,1200,700);if(this.classList.contains('workspace-canvas'))return rect(0,0,1800,700);const card=this.closest('.canvas-card');if(!card)return rect(0,0,0,0);const left=Number.parseFloat(card.style.left)||0,top=Number.parseFloat(card.style.top)||0,width=Number.parseFloat(card.style.width)||420,height=Number.parseFloat(card.style.height)||320;if(this===card)return rect(left,top,width,height);return rect(left,top,width,height)};
 Object.defineProperties(window.HTMLElement.prototype,{clientWidth:{configurable:true,get(){return this.classList.contains('canvas-viewport')?1200:0}},clientHeight:{configurable:true,get(){return this.classList.contains('canvas-viewport')?700:0}},scrollLeft:{configurable:true,writable:true,value:0},scrollTop:{configurable:true,writable:true,value:0},setPointerCapture:{configurable:true,value(){}},hasPointerCapture:{configurable:true,value(){return true}},releasePointerCapture:{configurable:true,value(){}}});
 documentElement(window.document).elementFromPoint=()=>null;
 mockIPC(()=>null,{shouldMockEvents:true});
 const {default:WorkspaceCanvas}=await vite.ssrLoadModule('/src/WorkspaceCanvas.tsx');
 let currentState,root;
 function Host(){const [current,setCurrent]=useState(widgets),[mode,setMode]=useState('picker');currentState={widgets:current,mode};const update=(id,patch)=>setCurrent(items=>items.map(item=>item.id===id?{...item,...patch}:item));return createElement(WorkspaceCanvas,{workspaceId:'study',transferWidget(){},setWorkspaceDropTarget(){},openAppsDialog(){},editTray(){},presets:[],savePresets(){},openPreset(){},editPreset(){},removePreset(){},renamePreset(){},widgets:current,groups:[],updateGroup(){},saveToGroup(){},openGroup(){},editGroup(){},removeGroup(){},openGroupWidget(){},update,add(){},remove(){},begin(){},bringToFront(id){setCurrent(items=>[...items.filter(item=>item.id!==id),...items.filter(item=>item.id===id)])},notify(){},obscured:false,openResource(){},openDropped(){},pickApp(){},saveApp(){},appAttachments:{},appAttachmentHandled(){},layoutMode:mode,setLayoutMode:setMode})}
 root=createRoot(window.document.querySelector('#root'));await act(async()=>root.render(createElement(Host)));
 const pointer=(type,x,y)=>{const event=new window.Event(type,{bubbles:true,cancelable:true});Object.defineProperties(event,{button:{value:0},pointerId:{value:1},clientX:{value:x},clientY:{value:y}});return event};
 return{dom,window,get currentState(){return currentState},root,pointer,cleanup:async()=>{if(root)await act(async()=>root.unmount());clearMocks();dom.window.close();for(const [key,descriptor]of oldGlobals){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}}};
}
function documentElement(document){return document}

test('a dragged widget snaps to a highlighted zone and Snap Assist places another in an open zone',async()=>{
 const notes=createWidget('notes');notes.id='notes';const browser=createWidget('browser');browser.id='browser';
 const app=await setup([notes,browser]);
 try{
  await act(async()=>app.window.document.querySelector('[aria-label="Side by side"]').click());
  assert.equal(app.window.document.querySelectorAll('[data-snap-zone]').length,2);
  const header=app.window.document.querySelector('#widget-notes .widget-move');
  await act(async()=>header.dispatchEvent(app.pointer('pointerdown',20,20)));
  await act(async()=>header.dispatchEvent(app.pointer('pointermove',900,320)));
  assert.equal(app.window.document.querySelector('[data-snap-zone="1"]').classList.contains('snap-layout-zone-hover'),true);
  await act(async()=>header.dispatchEvent(app.pointer('pointerup',900,320)));
  assert.equal(app.currentState.widgets.find(widget=>widget.id==='notes').placement.x,606);
  assert.equal(app.currentState.widgets.find(widget=>widget.id==='browser').minimized,false,'unselected widgets remain open for Snap Assist');
  const browserOffer=app.window.document.querySelector('.snap-assist-widgets button');
  assert.equal(browserOffer.textContent,'Browser');
  await act(async()=>browserOffer.click());
  const snappedBrowser=app.currentState.widgets.find(widget=>widget.id==='browser');
  assert.deepEqual([snappedBrowser.placement.x,snappedBrowser.placement.width],[6,588]);
  assert.equal(snappedBrowser.minimized,false);
  assert.match(app.window.document.querySelector('.snap-assist-heading').textContent,/All areas are filled/);
 }finally{await app.cleanup()}
});
