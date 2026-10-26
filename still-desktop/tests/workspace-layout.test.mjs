import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createElement,act,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {mockIPC,clearMocks} from '@tauri-apps/api/mocks';
import {createWidget,minimizeWidgetInstance} from '../src/domain/workspaces.ts';
import {createServer} from 'vite';

const rect=(left,top,width,height)=>({x:left,y:top,left,top,right:left+width,bottom:top+height,width,height,toJSON(){return this}});
const setGlobal=(key,value)=>Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
const vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,entries:[]}});
after(()=>vite.close());

async function setup(widgets,canvasFrameRate='display'){
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true}),oldGlobals=new Map(),{window}=dom;
 for(const key of ['window','document','navigator','HTMLElement','Element','Node','CustomEvent','MutationObserver','ResizeObserver','requestAnimationFrame','cancelAnimationFrame','getComputedStyle','isTauri','IS_REACT_ACT_ENVIRONMENT'])oldGlobals.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
 const pendingFrames=new Set();setGlobal('window',window);setGlobal('document',window.document);setGlobal('navigator',window.navigator);setGlobal('HTMLElement',window.HTMLElement);setGlobal('Element',window.Element);setGlobal('Node',window.Node);setGlobal('CustomEvent',window.CustomEvent);setGlobal('MutationObserver',window.MutationObserver);setGlobal('ResizeObserver',class{observe(){}disconnect(){}});setGlobal('requestAnimationFrame',callback=>{const timer=setTimeout(()=>{pendingFrames.delete(timer);callback(Date.now())},0);pendingFrames.add(timer);return timer});setGlobal('cancelAnimationFrame',timer=>{pendingFrames.delete(timer);clearTimeout(timer)});setGlobal('getComputedStyle',window.getComputedStyle.bind(window));setGlobal('isTauri',false);setGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 const placementFlushes=[];window.HTMLElement.prototype.getBoundingClientRect=function(){if(this.classList.contains('canvas-viewport'))return rect(0,0,1200,700);if(this.classList.contains('workspace-canvas'))return rect(0,0,1800,700);const card=this.closest('.canvas-card');if(!card)return rect(0,0,0,0);const left=Number.parseFloat(card.style.left)||0,top=Number.parseFloat(card.style.top)||0,width=Number.parseFloat(card.style.width)||420,height=Number.parseFloat(card.style.height)||320;if(this===card){if(card.style.transition==='none'&&!card.style.transform)placementFlushes.push({left,top,width,height,gestureActive:card.classList.contains('gesture-card')});return rect(left,top,width,height)}return rect(left,top,width,height)};
 Object.defineProperties(window.HTMLElement.prototype,{clientWidth:{configurable:true,get(){return this.classList.contains('canvas-viewport')?1200:0}},clientHeight:{configurable:true,get(){return this.classList.contains('canvas-viewport')?700:0}},scrollLeft:{configurable:true,writable:true,value:0},scrollTop:{configurable:true,writable:true,value:0},setPointerCapture:{configurable:true,value(){}},hasPointerCapture:{configurable:true,value(){return true}},releasePointerCapture:{configurable:true,value(){}}});
 documentElement(window.document).elementFromPoint=()=>null;
 mockIPC(()=>null,{shouldMockEvents:true});
 const {default:WorkspaceCanvas}=await vite.ssrLoadModule('/src/WorkspaceCanvas.tsx');
 let currentState,root,updates=0,lastCommitStyle;
 function Host(){const [current,setCurrent]=useState(widgets),[mode,setMode]=useState('picker');currentState={widgets:current,mode};const update=(id,patch)=>{updates++;const card=window.document.getElementById('widget-'+id);lastCommitStyle=card?{left:card.style.left,top:card.style.top,transform:card.style.transform}:undefined;setCurrent(items=>items.map(item=>item.id===id?{...item,...patch}:item))};return createElement(WorkspaceCanvas,{workspaceId:'study',canvasFrameRate,transferWidget(){},setWorkspaceDropTarget(){},openAppsDialog(){},editTray(){},presets:[],savePresets(){},openPreset(){},editPreset(){},removePreset(){},renamePreset(){},widgets:current,groups:[],updateGroup(){},saveToGroup(){},openGroup(){},editGroup(){},removeGroup(){},openGroupWidget(){},update,add(){},remove(){},begin(){},bringToFront(id){setCurrent(items=>[...items.filter(item=>item.id!==id),...items.filter(item=>item.id===id)])},notify(){},obscured:false,openResource(){},openDropped(){},pickApp(){},saveApp(){},appAttachments:{},appAttachmentHandled(){},layoutMode:mode,setLayoutMode:setMode})}
 root=createRoot(window.document.querySelector('#root'));await act(async()=>root.render(createElement(Host)));
 const pointer=(type,x,y)=>{const event=new window.Event(type,{bubbles:true,cancelable:true});Object.defineProperties(event,{button:{value:0},pointerId:{value:1},clientX:{value:x},clientY:{value:y}});return event};
 return{dom,window,get currentState(){return currentState},get updates(){return updates},get lastCommitStyle(){return lastCommitStyle},get placementFlushes(){return placementFlushes},root,pointer,cleanup:async()=>{if(root)await act(async()=>root.unmount());for(const timer of pendingFrames)clearTimeout(timer);pendingFrames.clear();await new Promise(resolve=>setTimeout(resolve,0));clearMocks();dom.window.close();for(const [key,descriptor]of oldGlobals){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}}};
}
function documentElement(document){return document}

test('bursts of pointer movement coalesce into one canvas update and pointer-up flushes the final position',async()=>{
 const notes=createWidget('notes');notes.id='notes';const app=await setup([notes],'display');
 try{
  const header=app.window.document.querySelector('#widget-notes .widget-move');
  await act(async()=>header.dispatchEvent(app.pointer('pointerdown',20,20)));
  await act(async()=>{for(const x of [30,40,50,60])header.dispatchEvent(app.pointer('pointermove',x,20));await new Promise(resolve=>setTimeout(resolve,10))});
  assert.equal(app.updates,0,'pointer movement updates the visual preview without rewriting workspace state');
  assert.equal(app.currentState.widgets[0].placement.x,0,'the saved placement stays unchanged during the gesture');
  assert.equal(app.window.document.querySelector('#widget-notes').style.transform,'translate3d(40px,0px,0)','the card follows the pointer using a compositor transform');
  await act(async()=>header.dispatchEvent(app.pointer('pointerup',70,20)));
  assert.equal(app.updates,1,'the final placement is committed once when the gesture ends');
  assert.equal(app.window.document.querySelector('#widget-notes').style.transform,'','the compositor transform is cleared when the final layout is committed');
  assert.equal(app.lastCommitStyle.left,'50px','the visual position is already at the destination before React commits it');
  assert.equal(app.lastCommitStyle.transform,'','the visual transform is cleared only after the destination geometry is applied');
  const finalPlacement=app.currentState.widgets[0].placement;
  assert.deepEqual(app.placementFlushes.at(-1),{left:50,top:0,width:finalPlacement.width,height:finalPlacement.height,gestureActive:true},'the destination geometry is laid out while drag transitions are still disabled');
  assert.equal(app.window.document.querySelector('#widget-notes').style.left,'50px','the saved card position matches the final pointer location');
  assert.equal(app.currentState.widgets[0].placement.x,50,'pointer-up applies the exact final position even if a frame was pending');
 }finally{await app.cleanup()}
});

test('drag release applies destination geometry before clearing the visual transform',()=>{
 const canvas=readFileSync(new URL('../src/WorkspaceCanvas.tsx',import.meta.url),'utf8');
 assert.match(canvas,/function writeCardPlacement\(id:string,p:Placement\)\{const card=document\.getElementById\('widget-'\+id\);if\(!card\)return;card\.style\.transition='none';card\.style\.left=[\s\S]*?card\.style\.height=[\s\S]*?card\.style\.transform='';card\.style\.transformOrigin='';void card\.getBoundingClientRect\(\);card\.style\.removeProperty\('transition'\)\}/);
});

test('lost pointer capture commits the Notes drag instead of restoring its original position',async()=>{
 const notes=createWidget('notes');notes.id='notes';const app=await setup([notes],'display');
 try{
  const header=app.window.document.querySelector('#widget-notes .widget-move');
  await act(async()=>header.dispatchEvent(app.pointer('pointerdown',20,20)));
  await act(async()=>{header.dispatchEvent(app.pointer('pointermove',40,20));await new Promise(resolve=>setTimeout(resolve,10))});
  await act(async()=>header.dispatchEvent(app.pointer('lostpointercapture',50,20)));
  assert.equal(app.updates,1,'losing pointer capture finishes the active drag once');
  assert.equal(app.currentState.widgets[0].placement.x,30,'the last pointer position is kept instead of rolling back');
  assert.equal(app.window.document.querySelector('#widget-notes').style.left,'30px');
 }finally{await app.cleanup()}
});

test('resizing a Notes widget keeps its top-left corner anchored',async()=>{
 const notes=createWidget('notes');notes.id='notes';const original={...notes.placement},app=await setup([notes],'display');
 try{
  const handle=app.window.document.querySelector('#widget-notes .widget-resize'),card=app.window.document.querySelector('#widget-notes');
  await act(async()=>handle.dispatchEvent(app.pointer('pointerdown',original.x+original.width,original.y+original.height)));
  await act(async()=>{handle.dispatchEvent(app.pointer('pointermove',original.x+original.width+40,original.y+original.height+50));await new Promise(resolve=>setTimeout(resolve,10))});
  assert.equal(card.style.left,original.x+'px','resizing must not change the widget left edge');
  assert.equal(card.style.top,original.y+'px','resizing must not change the widget top edge');
  assert.equal(card.style.transformOrigin,'top left','the preview scales outward from the fixed top-left corner');
  await act(async()=>handle.dispatchEvent(app.pointer('pointerup',original.x+original.width+40,original.y+original.height+50)));
  assert.equal(app.currentState.widgets[0].placement.x,original.x);
  assert.equal(app.currentState.widgets[0].placement.y,original.y);
  assert.equal(card.style.transformOrigin,'','the temporary resize origin is cleared after committing');
 }finally{await app.cleanup()}
});

test('duplicate widget labels keep their instance numbers after canvas counts are precomputed',async()=>{
 const first=createWidget('notes');first.id='notes-1';first.instanceNumber=1;
 const second=createWidget('notes');second.id='notes-2';second.instanceNumber=2;
 const app=await setup([first,second]);
 try{
  assert.equal(app.window.document.querySelector('#widget-notes-1 .widget-move')?.getAttribute('aria-label'),'Move Notes 1');
  assert.equal(app.window.document.querySelector('#widget-notes-2 .widget-move')?.getAttribute('aria-label'),'Move Notes 2');
 }finally{await app.cleanup()}
});

test('canvas placement reconciliation pauses while a widget is moving',()=>{
 const canvas=readFileSync(new URL('../src/WorkspaceCanvas.tsx',import.meta.url),'utf8');
 assert.match(canvas,/useEffect\(\(\)=>\{if\(active\|\|!workspaceActive\|\|viewportWidth<=0\|\|viewportHeight<=0\)return;for\(const w of widgets\)/);
 assert.match(canvas,/\},\[active,workspaceActive,viewportWidth,viewportHeight,extent,height,widgets,update\]\)/);
});

test('a dragged widget snaps to a highlighted zone and Snap Assist places another in an open zone',async()=>{
 const notes=createWidget('notes');notes.id='notes';const apps=createWidget('apps');apps.id='apps';
 const app=await setup([notes,apps]);
 try{
  await act(async()=>app.window.document.querySelector('[aria-label="Side by side"]').click());
  assert.equal(app.window.document.querySelectorAll('[data-snap-zone]').length,2);
  const header=app.window.document.querySelector('#widget-notes .widget-move');
  await act(async()=>header.dispatchEvent(app.pointer('pointerdown',20,20)));
  await act(async()=>{header.dispatchEvent(app.pointer('pointermove',900,320));await new Promise(resolve=>setTimeout(resolve,10))});
  assert.equal(app.window.document.querySelector('[data-snap-zone="1"]').classList.contains('snap-layout-zone-hover'),true);
  await act(async()=>header.dispatchEvent(app.pointer('pointerup',900,320)));
  assert.equal(app.currentState.widgets.find(widget=>widget.id==='notes').placement.x,606);
  assert.equal(app.currentState.widgets.find(widget=>widget.id==='apps').minimized,false,'unselected widgets remain open for Snap Assist');
  const appsOffer=app.window.document.querySelector('.snap-assist-widgets button');
  assert.equal(appsOffer.textContent,'Apps');
  await act(async()=>appsOffer.click());
  const snappedApps=app.currentState.widgets.find(widget=>widget.id==='apps');
  assert.deepEqual([snappedApps.placement.x,snappedApps.placement.width],[6,588]);
  assert.equal(snappedApps.minimized,false);
  assert.equal(app.currentState.mode,null,'finishing the last zone exits layout mode');
  assert.equal(app.window.document.querySelector('.canvas-viewport').classList.contains('layout-scroll-locked'),false,'canvas scrolling is restored when the layout is complete');
  assert.equal(app.window.document.querySelector('[data-snap-zone]'),null,'completed layout highlights are dismissed');
 }finally{await app.cleanup()}
});

test('dragging into an occupied zone leaves the blocker in empty space until the user chooses it in Snap Assist',async()=>{
 const notes=createWidget('notes');notes.id='notes';notes.placement={x:20,y:20,width:400,height:300};
 const apps=createWidget('apps');apps.id='apps';apps.placement={x:80,y:80,width:400,height:300};
 const app=await setup([notes,apps]);
 try{
  await act(async()=>app.window.document.querySelector('[aria-label="Side by side"]').click());
  const header=app.window.document.querySelector('#widget-notes .widget-move');
  await act(async()=>header.dispatchEvent(app.pointer('pointerdown',20,20)));
  await act(async()=>{header.dispatchEvent(app.pointer('pointermove',120,180));await new Promise(resolve=>setTimeout(resolve,10))});
  await act(async()=>header.dispatchEvent(app.pointer('pointerup',120,180)));
  assert.deepEqual([app.currentState.widgets.find(widget=>widget.id==='notes').placement.x,app.currentState.widgets.find(widget=>widget.id==='notes').placement.width],[6,588]);
  const movedApps=app.currentState.widgets.find(widget=>widget.id==='apps');
  assert.equal(movedApps.placement.width,400,'displaced widgets keep their original size until selected');
  assert.notDeepEqual([movedApps.placement.x,movedApps.placement.y,movedApps.placement.width,movedApps.placement.height],[606,6,588,688],'the displaced widget is not auto-arranged into the next layout zone');
  const snappedNotes=app.currentState.widgets.find(widget=>widget.id==='notes');
  assert.equal(movedApps.placement.x<snappedNotes.placement.x+snappedNotes.placement.width&&movedApps.placement.x+movedApps.placement.width>snappedNotes.placement.x&&movedApps.placement.y<snappedNotes.placement.y+snappedNotes.placement.height&&movedApps.placement.y+movedApps.placement.height>snappedNotes.placement.y,false,'the blocker moves into empty visible space');
  assert.equal(app.window.document.querySelector('.snap-assist-widgets button')?.textContent,'Apps','the blocker stays available for the user to choose next');
  assert.equal(app.currentState.mode,'halves','layout stays active while there is still an unfilled zone');
  await act(async()=>app.window.document.querySelector('.snap-assist-widgets button').click());
  assert.deepEqual([app.currentState.widgets.find(widget=>widget.id==='apps').placement.x,app.currentState.widgets.find(widget=>widget.id==='apps').placement.width],[606,588]);
  assert.equal(app.currentState.mode,null,'choosing the final widget exits layout mode');
  assert.equal(app.window.document.querySelector('.canvas-viewport').classList.contains('layout-scroll-locked'),false,'scrolling resumes after the layout is complete');
 }finally{await app.cleanup()}
});

test('a minimized widget remains draggable while layout mode is active',async()=>{
 const notes=createWidget('notes');notes.id='notes';const minimized=minimizeWidgetInstance(notes,1200,700);minimized.placement={x:20,y:20,width:136,height:42};minimized.restorePlacement={...notes.placement,x:20,y:20};
 const app=await setup([minimized]);
 try{
  await act(async()=>app.window.document.querySelector('[aria-label="Side by side"]').click());
  const button=app.window.document.querySelector('#widget-notes .widget-minimized-button');
  await act(async()=>button.dispatchEvent(app.pointer('pointerdown',20,20)));
  await act(async()=>{button.dispatchEvent(app.pointer('pointermove',140,100));await new Promise(resolve=>setTimeout(resolve,10))});
  await act(async()=>button.dispatchEvent(app.pointer('pointerup',140,100)));
  assert.deepEqual([app.currentState.widgets[0].placement.x,app.currentState.widgets[0].placement.y],[140,100]);
  assert.deepEqual([app.currentState.widgets[0].restorePlacement.x,app.currentState.widgets[0].restorePlacement.y],[140,100]);
  assert.equal(app.currentState.mode,'halves','moving a minimized card does not consume a layout zone or end layout mode');
 }finally{await app.cleanup()}
});

test('layout moves a minimized blocker and keeps its restore position in sync',async()=>{
 const notes=createWidget('notes');notes.id='notes';const minimized=minimizeWidgetInstance(notes,1200,700);minimized.placement={x:20,y:20,width:136,height:42};
 const apps=createWidget('apps');apps.id='apps';apps.placement={x:20,y:20,width:400,height:300};
 const app=await setup([minimized,apps]);
 try{
  await act(async()=>app.window.document.querySelector('[aria-label="Side by side"]').click());
  const header=app.window.document.querySelector('#widget-apps .widget-move');
  await act(async()=>header.dispatchEvent(app.pointer('pointerdown',20,20)));
  await act(async()=>{header.dispatchEvent(app.pointer('pointermove',300,300));await new Promise(resolve=>setTimeout(resolve,10))});
  await act(async()=>header.dispatchEvent(app.pointer('pointerup',300,300)));
  const moved=app.currentState.widgets.find(widget=>widget.id==='notes'),snapped=app.currentState.widgets.find(widget=>widget.id==='apps');
  assert.equal(moved.minimized,true);
  assert.equal(moved.placement.width,136);
  assert.deepEqual([moved.restorePlacement.x,moved.restorePlacement.y],[moved.placement.x,moved.placement.y],'restoring the widget keeps it at the visible moved location');
  assert.equal(moved.placement.x<snapped.placement.x+snapped.placement.width&&moved.placement.x+moved.placement.width>snapped.placement.x&&moved.placement.y<snapped.placement.y+snapped.placement.height&&moved.placement.y+moved.placement.height>snapped.placement.y,false,'the compact blocker is placed outside the chosen zone');
  assert.equal(app.window.document.querySelector('#widget-notes .widget-minimized-button')!==null,true,'the minimized widget remains available to drag');
 }finally{await app.cleanup()}
});

test('choosing a layout temporarily disables canvas scrolling until layout mode closes',async()=>{
 const notes=createWidget('notes');notes.id='notes';const app=await setup([notes]);
 try{
  const viewport=app.window.document.querySelector('.canvas-viewport');
  assert.equal(viewport.classList.contains('layout-scroll-locked'),false);
  assert.equal(app.window.document.querySelector('.canvas-overview'),null,'the layout picker keeps the map out of the control area');
  await act(async()=>app.window.document.querySelector('[aria-label="Side by side"]').click());
  assert.equal(viewport.classList.contains('layout-scroll-locked'),true);
  assert.equal(app.window.document.querySelector('.canvas-overview'),null,'the workspace map is hidden so it cannot cover Snap Assist');
  await act(async()=>app.window.document.querySelector('[aria-label="Exit layout mode"]').click());
  assert.equal(viewport.classList.contains('layout-scroll-locked'),false);
  assert.notEqual(app.window.document.querySelector('.canvas-overview'),null,'the workspace map returns after layout mode closes');
 }finally{await app.cleanup()}
});
