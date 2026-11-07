import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createElement,act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';
import {createWidget} from '../src/domain/workspaces.ts';

const vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,entries:[]}});
after(()=>vite.close());

test('the Clock add-on exposes a straight scroll picker and commits selected time without starting it',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true});
 const old={window:globalThis.window,document:globalThis.document,IS_REACT_ACT_ENVIRONMENT:globalThis.IS_REACT_ACT_ENVIRONMENT};
 globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const {default:TimerWidget}=await vite.ssrLoadModule('/src/TimerWidget.tsx');
 const root=createRoot(dom.window.document.querySelector('#root'));
 const widget=createWidget('notes');widget.clockPluginEnabled=true;const updates=[];
 try{
  await act(async()=>root.render(createElement(TimerWidget,{widget,variant:'clock',update:patch=>updates.push(patch),notify:()=>{}})));
  assert.ok(dom.window.document.querySelector('.timer-duration-editor[aria-label="Set timer duration"]'));
  assert.equal(dom.window.document.querySelector('input[type="range"]'),null,'duration no longer uses a drag slider');
  assert.equal(dom.window.document.querySelectorAll('.timer-value-wheel').length,2,'hours and minutes stay visible in adjacent columns');
  assert.equal(dom.window.document.querySelector('.timer-mode-switch'),null,'there is no mode switch');
  const hourButton=[...dom.window.document.querySelectorAll('button')].find(button=>button.getAttribute('aria-label')==='Set 1 hour');
  assert.ok(hourButton,'the picker exposes a selectable one-hour value');
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

test('scrolling the Focus picker updates its selected value and digital clock immediately',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true});
 const old={window:globalThis.window,document:globalThis.document,IS_REACT_ACT_ENVIRONMENT:globalThis.IS_REACT_ACT_ENVIRONMENT};
 globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const {default:TimerWidget}=await vite.ssrLoadModule('/src/TimerWidget.tsx');
 const root=createRoot(dom.window.document.querySelector('#root')),widget=createWidget('focus');
 try{
  await act(async()=>root.render(createElement(TimerWidget,{widget,variant:'focus',update:()=>{},notify:()=>{}})));
  assert.ok(dom.window.document.querySelector('.timer-duration-editor[aria-label="Set timer duration"]'));
  assert.ok([...dom.window.document.querySelectorAll('button')].some(button=>button.textContent==='Set Time'));
  const pickers=dom.window.document.querySelectorAll('.timer-value-wheel');
  assert.equal(pickers.length,2,'hours and minutes stay visible in separate columns');
  assert.ok(pickers[0].previousElementSibling?.classList.contains('timer-value-label'),'each scroll column has its own unit label');
  const picker=pickers[1];
  await act(async()=>picker.dispatchEvent(new dom.window.WheelEvent('wheel',{deltaY:100,cancelable:true,bubbles:true})));
  assert.ok([...picker.querySelectorAll('[role="option"]')].some(option=>option.getAttribute('aria-selected')==='true'&&option.textContent==='26'));
  assert.ok(dom.window.document.querySelector('.timer-duration-readout strong').textContent.includes('00:26'),'digital display follows scroll changes');
 }finally{
  await act(async()=>root.unmount());dom.window.close();
  if(old.window===undefined)delete globalThis.window;else globalThis.window=old.window;
  if(old.document===undefined)delete globalThis.document;else globalThis.document=old.document;
  if(old.IS_REACT_ACT_ENVIRONMENT===undefined)delete globalThis.IS_REACT_ACT_ENVIRONMENT;else globalThis.IS_REACT_ACT_ENVIRONMENT=old.IS_REACT_ACT_ENVIRONMENT;
 }
});

test('hidden workspace timers pause their display interval and resume on activation',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true});
 const old={window:globalThis.window,document:globalThis.document,IS_REACT_ACT_ENVIRONMENT:globalThis.IS_REACT_ACT_ENVIRONMENT,setInterval:globalThis.setInterval,clearInterval:globalThis.clearInterval};
 const {default:TimerWidget}=await vite.ssrLoadModule('/src/TimerWidget.tsx');
 globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 let started=0,cleared=0;globalThis.setInterval=()=>{started++;return started};globalThis.clearInterval=()=>{cleared++};
 const root=createRoot(dom.window.document.querySelector('#root')),widget=createWidget('focus');
 const render=workspaceActive=>createElement(TimerWidget,{widget,variant:'focus',workspaceActive,update:()=>{},notify:()=>{}});
 try{
  await act(async()=>root.render(render(false)));
  assert.equal(started,0,'inactive workspace widgets do not schedule a display tick');
  await act(async()=>root.render(render(true)));
  assert.equal(started,1,'activating a workspace starts one display tick');
  await act(async()=>root.render(render(false)));
  assert.equal(cleared,1,'switching away clears the display tick');
 }finally{
  await act(async()=>root.unmount());dom.window.close();
  for(const key of Object.keys(old)){if(old[key]===undefined)delete globalThis[key];else globalThis[key]=old[key]}
 }
});
