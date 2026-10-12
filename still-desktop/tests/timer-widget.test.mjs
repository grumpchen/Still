import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createElement,act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';
import {createWidget} from '../src/domain/workspaces.ts';

const vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,entries:[]}});
after(()=>vite.close());

test('the Clock add-on exposes the duration dial and commits selected time without starting it',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true});
 const old={window:globalThis.window,document:globalThis.document,IS_REACT_ACT_ENVIRONMENT:globalThis.IS_REACT_ACT_ENVIRONMENT};
 globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const {default:TimerWidget}=await vite.ssrLoadModule('/src/TimerWidget.tsx');
 const root=createRoot(dom.window.document.querySelector('#root'));
 const widget=createWidget('notes');widget.clockPluginEnabled=true;const updates=[];
 try{
  await act(async()=>root.render(createElement(TimerWidget,{widget,variant:'clock',update:patch=>updates.push(patch),notify:()=>{}})));
  assert.ok(dom.window.document.querySelector('[aria-label="Set timer duration"]'));
  const hourButton=[...dom.window.document.querySelectorAll('button')].find(button=>button.getAttribute('aria-label')==='Set 1 hour');
  assert.ok(hourButton,'the dial exposes a selectable one-hour position');
  await act(async()=>hourButton.click());
  await act(async()=>[...dom.window.document.querySelectorAll('button')].find(button=>button.textContent==='Set Time').click());
  assert.deepEqual(updates.at(-1),{remaining:5100,end:null});
  assert.equal(updates.some(update=>update.end&&update.end>Date.now()),false,'setting a duration does not start the timer');
 }finally{
  await act(async()=>root.unmount());dom.window.close();
  if(old.window===undefined)delete globalThis.window;else globalThis.window=old.window;
  if(old.document===undefined)delete globalThis.document;else globalThis.document=old.document;
  if(old.IS_REACT_ACT_ENVIRONMENT===undefined)delete globalThis.IS_REACT_ACT_ENVIRONMENT;else globalThis.IS_REACT_ACT_ENVIRONMENT=old.IS_REACT_ACT_ENVIRONMENT;
 }
});

test('the Focus widget uses the same clock dial surface',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true});
 const old={window:globalThis.window,document:globalThis.document,IS_REACT_ACT_ENVIRONMENT:globalThis.IS_REACT_ACT_ENVIRONMENT};
 globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const {default:TimerWidget}=await vite.ssrLoadModule('/src/TimerWidget.tsx');
 const root=createRoot(dom.window.document.querySelector('#root')),widget=createWidget('focus');
 try{
  await act(async()=>root.render(createElement(TimerWidget,{widget,variant:'focus',update:()=>{},notify:()=>{}})));
  assert.ok(dom.window.document.querySelector('[aria-label="Set timer duration"]'));
  assert.ok([...dom.window.document.querySelectorAll('button')].some(button=>button.textContent==='Set Time'));
 }finally{
  await act(async()=>root.unmount());dom.window.close();
  if(old.window===undefined)delete globalThis.window;else globalThis.window=old.window;
  if(old.document===undefined)delete globalThis.document;else globalThis.document=old.document;
  if(old.IS_REACT_ACT_ENVIRONMENT===undefined)delete globalThis.IS_REACT_ACT_ENVIRONMENT;else globalThis.IS_REACT_ACT_ENVIRONMENT=old.IS_REACT_ACT_ENVIRONMENT;
 }
});
