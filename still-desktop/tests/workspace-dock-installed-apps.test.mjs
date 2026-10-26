import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement,createRef,act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';

test('Apps displays the catalog before icons finish and loads icons only when visible',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true});
 const old=new Map(),observers=[];
 for(const name of ['window','document','navigator','HTMLElement','Element','Node','IntersectionObserver','IS_REACT_ACT_ENVIRONMENT'])old.set(name,Object.getOwnPropertyDescriptor(globalThis,name));
 const assign=(name,value)=>Object.defineProperty(globalThis,name,{configurable:true,writable:true,value});
 assign('window',dom.window);assign('document',dom.window.document);assign('navigator',dom.window.navigator);assign('HTMLElement',dom.window.HTMLElement);assign('Element',dom.window.Element);assign('Node',dom.window.Node);assign('IS_REACT_ACT_ENVIRONMENT',true);
 assign('IntersectionObserver',class{constructor(callback){this.callback=callback;observers.push(this)}observe(node){this.node=node}disconnect(){}});
 const vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,entries:[]}});
 let root,appPanel,original;
 try{
  ({appPanel}=await vite.ssrLoadModule('/src/platform/appPanel.ts'));
  const {default:WorkspaceDock}=await vite.ssrLoadModule('/src/WorkspaceDock.tsx');
  original={available:appPanel.available,installed:appPanel.installed,installedIcon:appPanel.installedIcon};
  let calls=0,finishIcon;appPanel.available=true;appPanel.installed=async()=>[{id:'visible-app',name:'Example App',icon:[]}];
  appPanel.installedIcon=()=>{calls++;return new Promise(resolve=>{finishIcon=resolve})};
  root=createRoot(dom.window.document.getElementById('root'));
  await act(async()=>{root.render(createElement(WorkspaceDock,{trayRef:createRef(),shortcuts:null,status:null,expanded:true,onExpandedChange(){},onOpenInstalledApp(){},onEditShortcuts(){},onRemoveDrop:false}));await new Promise(resolve=>setImmediate(resolve))});
  assert.ok(dom.window.document.querySelector('[aria-label="Open Example App in Still"]'));
  assert.equal(calls,0,'offscreen icons do not block the catalog');
  await act(async()=>{for(const observer of observers)observer.callback([{isIntersecting:true}]);await new Promise(resolve=>setImmediate(resolve))});
  assert.equal(calls,1);assert.ok(dom.window.document.querySelector('[aria-label="Open Example App in Still"]'),'app remains usable while icon loads');
  await act(async()=>{finishIcon([137,80,78,71,13,10,26,10,1]);await new Promise(resolve=>setImmediate(resolve))});
  assert.ok(dom.window.document.querySelector('[aria-label="Open Example App in Still"] img'));
 }finally{
  if(root)await act(async()=>root.unmount());if(appPanel&&original)Object.assign(appPanel,original);await vite.close();dom.window.close();
  for(const [name,descriptor] of old){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name]}
 }
});
