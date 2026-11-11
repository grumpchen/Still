import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createElement,act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';

const vite=await createServer({server:{middlewareMode:true,hmr:false,watch:{ignored:['**/src-tauri/**']}},appType:'custom',optimizeDeps:{noDiscovery:true,entries:[]}});
after(()=>vite.close());

function setGlobal(key,value){Object.defineProperty(globalThis,key,{configurable:true,writable:true,value})}
const tick=()=>new Promise(resolve=>setTimeout(resolve,20));

async function setup(){
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true}),{window}=dom;
 const globals={window,document:window.document,navigator:window.navigator,HTMLElement:window.HTMLElement,Element:window.Element,Node:window.Node,Event:window.Event,KeyboardEvent:window.KeyboardEvent,MouseEvent:window.MouseEvent,getComputedStyle:window.getComputedStyle,requestAnimationFrame:callback=>setTimeout(callback,0),cancelAnimationFrame:id=>clearTimeout(id),IS_REACT_ACT_ENVIRONMENT:true};
 const old=Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]);
 for(const [key,value] of Object.entries(globals))setGlobal(key,value);
 // React's legacy input polyfill assumes attachEvent in this jsdom build; stub it so focus works.
 window.HTMLElement.prototype.attachEvent=()=>{};
 window.HTMLElement.prototype.detachEvent=()=>{};
 const {default:Casio}=await vite.ssrLoadModule('/src/CasioCalculator.tsx');
 const root=createRoot(window.document.querySelector('#root'));
 const widget={id:'casio',type:'casio570',placement:{x:0,y:0,width:400,height:720},instanceNumber:1};
 await act(async()=>root.render(createElement(Casio,{widget,update(){},obscured:false,workspaceActive:true,notify(){}})));
 return {window,cleanup:async()=>{
  await act(async()=>root.unmount());
  for(const [key,value] of old){if(value)Object.defineProperty(globalThis,key,value);else delete globalThis[key]}
 }};
}

async function click(window,element){
 await act(async()=>{
  element.dispatchEvent(new window.MouseEvent('pointerdown',{bubbles:true,cancelable:true}));
  element.dispatchEvent(new window.MouseEvent('mousedown',{bubbles:true,cancelable:true}));
  element.dispatchEvent(new window.MouseEvent('mouseup',{bubbles:true}));
  element.dispatchEvent(new window.MouseEvent('click',{bubbles:true}));
 });
 await act(tick);
}
function button(window,text){
 return [...window.document.querySelectorAll('button')].find(item=>item.querySelector('.casio-key-face')?.textContent===text||item.textContent.trim()===text);
}
async function selectSlot(window,input){
 await act(async()=>{input.dispatchEvent(new window.MouseEvent('pointerdown',{bubbles:true}))});
 input.focus();
}
async function fillSlot(window,input,text){
 await selectSlot(window,input);
 for(const character of text)await click(window,button(window,character==='-'?'−':character));
}
async function openMode(window,mode){
 await click(window,button(window,'MODE'));
 await click(window,[...window.document.querySelectorAll('.casio-mode-grid button')].find(item=>item.querySelector('b')?.textContent===mode));
}

test('every EQN slot accepts on-screen keypad input and Enter advances to the next slot',async()=>{
 const app=await setup();
 try{
  const {window}=app;
  await openMode(window,'EQN');
  await click(window,[...window.document.querySelectorAll('.casio-panel button')].find(item=>item.textContent.trim()==='3 unknowns'));
  const inputs=[...window.document.querySelectorAll('.casio-field input')];
  assert.equal(inputs.length,12,'the 3-unknown system has twelve coefficients');
  assert.deepEqual(inputs.map(input=>input.getAttribute('aria-label')),['a1','b1','c1','d1','a2','b2','c2','d2','a3','b3','c3','d3']);
  const grid=window.document.querySelector('.casio-eqn-grid');
  assert.ok(grid.closest('.casio-field-scroll'),'four-coefficient rows sit in a horizontal scroll container');
  assert.match(grid.style.gridTemplateColumns,/repeat\(4,/,'four coefficients share one row');

  const d1=inputs[3];
  await selectSlot(window,d1);
  await click(window,button(window,'7'));
  await click(window,button(window,'5'));
  await click(window,button(window,'DEL'));
  assert.equal(d1.value,'7','keypad digits and DEL edit the selected slot');
  assert.equal(window.document.querySelector('.casio-lcd-expression').textContent,'0','the LCD expression is left alone');

  await click(window,button(window,'AC'));
  assert.equal(d1.value,'','AC clears the selected slot');

  const setValue=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
  await act(async()=>{setValue.call(d1,'12');d1.dispatchEvent(new window.Event('input',{bubbles:true}))});
  assert.equal(d1.value,'12','typing into the slot still works');
  await act(async()=>{d1.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}))});
  assert.equal(window.document.activeElement.getAttribute('aria-label'),'a2','Enter moves to the next slot');
 }finally{await app.cleanup()}
});

test('a 2-unknown system entered with the keypad solves correctly',async()=>{
 const app=await setup();
 try{
  const {window}=app;
  await openMode(window,'EQN');
  await click(window,[...window.document.querySelectorAll('.casio-panel button')].find(item=>item.textContent.trim()==='2 unknowns'));
  const inputs=[...window.document.querySelectorAll('.casio-field input')];
  assert.equal(inputs.length,6);
  assert.match(window.document.querySelector('.casio-eqn-grid').style.gridTemplateColumns,/repeat\(3,/);
  const values=['1','1','5','1','-1','1'];
  for(const [index,value] of values.entries())await fillSlot(window,inputs[index],value);
  assert.deepEqual(inputs.map(input=>input.value),values);
  await click(window,[...window.document.querySelectorAll('.casio-panel button')].find(item=>item.textContent.trim()==='SOLVE'));
  const result=window.document.querySelector('.casio-panel-result')?.textContent??'';
  assert.match(result,/x1 = 3/);
  assert.match(result,/x2 = 2/);
 }finally{await app.cleanup()}
});

test('STAT and MAT slots accept on-screen keypad input too',async()=>{
 const app=await setup();
 try{
  const {window}=app;
  await openMode(window,'STAT');
  const stat=window.document.querySelector('.casio-stat-row input');
  await selectSlot(window,stat);
  await click(window,button(window,'9'));
  assert.equal(stat.value,'9','STAT x values accept keypad digits');

  await openMode(window,'MAT');
  const cell=window.document.querySelector('.casio-matrix-grid input');
  await selectSlot(window,cell);
  await click(window,button(window,'8'));
  assert.equal(cell.value,'8','MAT cells replace the default zero with keypad digits');
  assert.equal(window.document.querySelector('.casio-lcd-expression').textContent,'0');
 }finally{await app.cleanup()}
});
