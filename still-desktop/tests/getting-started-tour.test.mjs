import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createElement,act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';
import {defaultShortcuts} from '../src/domain/shortcuts.ts';

const vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,entries:[]}});
after(()=>vite.close());
const setGlobal=(key,value)=>Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});

test('getting-started tour explains drag, current shortcuts, Ctrl+Shift right-click and Still AI',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true}),{window}=dom,old=new Map();let root;
 for(const key of ['window','document','navigator','HTMLElement','Element','Node','IS_REACT_ACT_ENVIRONMENT'])old.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
 try{
  for(const [key,value] of Object.entries({window,document:window.document,navigator:window.navigator,HTMLElement:window.HTMLElement,Element:window.Element,Node:window.Node,IS_REACT_ACT_ENVIRONMENT:true}))setGlobal(key,value);
  const {default:Tour}=await vite.ssrLoadModule('/src/GettingStartedTour.tsx');
  const shortcuts={...defaultShortcuts(),up:{key:'Q',ctrl:true,alt:false,shift:false}};let finished=0,openedAssistant=0;
  root=createRoot(window.document.querySelector('#root'));
  await act(async()=>root.render(createElement(Tour,{shortcuts,onFinish:()=>finished++,onOpenAssistant:()=>openedAssistant++})));
  assert.match(window.document.querySelector('.tour-page').textContent,/Drag a widget by its header/);
  await act(async()=>window.document.querySelector('.tour-step-actions button.primary').click());
  assert.match(window.document.querySelector('.tour-page').textContent,/Ctrl \+ Q/,'the displayed bindings follow customized shortcuts');
  await act(async()=>window.document.querySelector('.tour-step-actions button.primary').click());
  assert.match(window.document.querySelector('.tour-page').textContent,/Ctrl \+ Shift, then right-click/);
  await act(async()=>window.document.querySelector('.tour-step-actions button.primary').click());
  assert.match(window.document.querySelector('.tour-page').textContent,/@ is a quick way[\s\S]*optional/);
  await act(async()=>window.document.querySelector('[aria-label="Still getting started tutorial"] .tour-step-actions .primary').click());
  assert.equal(finished,0);assert.equal(openedAssistant,1,'the final action opens Still AI without marking through the ordinary Finish callback');
 }finally{
  if(root)await act(async()=>root.unmount());dom.window.close();
  for(const [key,descriptor] of old){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}
 }
});

test('first launch opens the tour and General Settings can run it again',async()=>{
 const {readFileSync}=await import('node:fs');
 const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8'),settings=readFileSync(new URL('../src/GeneralSettings.tsx',import.meta.url),'utf8');
 assert.match(app,/TUTORIAL_KEY='still-first-run-tutorial-v1'/);
 assert.match(app,/localStorage\.getItem\(TUTORIAL_KEY\)==='done'[\s\S]*?setModal\(current=>current\?\?'tutorial'\)/);
 assert.match(app,/localStorage\.setItem\(TUTORIAL_KEY,'done'\)/);
 assert.match(app,/modal==='tutorial'[\s\S]*?<GettingStartedTour/);
 assert.match(settings,/Run tutorial again/);
});

test('tutorial text stays inside its larger dialog at desktop and narrow widths',async()=>{
 const {readFileSync}=await import('node:fs');
 const styles=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
 assert.match(styles,/dialog:has\(\.getting-started-tour\)\{width:min\(720px,calc\(100vw - 48px\)\)/);
 assert.match(styles,/\.getting-started-tour\{width:100%;max-width:100%;min-width:0/);
 assert.match(styles,/\.tour-page>p:not\(\.tour-eyebrow\)\{[^}]*overflow-wrap:anywhere/);
 assert.match(styles,/@media\(max-width:520px\)\{dialog:has\(\.getting-started-tour\)\{width:calc\(100vw - 24px\)\}\.getting-started-tour\{width:100%;max-width:100%/);
});
