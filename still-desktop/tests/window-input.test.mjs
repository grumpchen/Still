import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {interactiveHitRegions} from '../src/domain/windowInput.ts';

const rect=(left,top,width,height)=>({left,top,right:left+width,bottom:top+height,width,height,x:left,y:top,toJSON(){return this}});

test('interactive regions include visible controls and clip widget cards to the canvas viewport',()=>{
 const dom=new JSDOM('<main><aside class="sidebar"></aside><div class="canvas-viewport"><article class="canvas-card"></article></div><article class="canvas-card"></article><button></button><div hidden class="topbar"></div></main>');
 const {document}=dom.window;const box=(selector,value)=>{const node=document.querySelector(selector);node.getClientRects=()=>[{}];node.getBoundingClientRect=()=>rect(...value)};
 box('.sidebar',[0,0,120,800]);box('.canvas-viewport',[120,100,600,500]);box('.canvas-viewport .canvas-card',[80,80,300,300]);box('main > .canvas-card',[740,100,50,100]);box('button',[200,20,30,24]);
 const regions=interactiveHitRegions(document.querySelector('main'),800,600);
 assert.deepEqual(regions,[{x:0,y:0,width:120,height:600},{x:120,y:100,width:260,height:280},{x:200,y:20,width:30,height:24}]);
 dom.window.close();
});

test('empty transparent areas are omitted so Windows can pass them through',()=>{
 const dom=new JSDOM('<main><div class="canvas-viewport"></div></main>');
 assert.deepEqual(interactiveHitRegions(dom.window.document.querySelector('main'),800,600),[]);
 dom.window.close();
});

test('scrollbar gutters remain interactive while the empty workspace stays pass-through',()=>{
 const dom=new JSDOM('<main><div class="canvas-viewport"></div></main>');const viewport=dom.window.document.querySelector('.canvas-viewport');
 viewport.getClientRects=()=>[{}];viewport.getBoundingClientRect=()=>rect(10,20,120,120);
 for(const [key,value] of Object.entries({clientLeft:2,clientTop:3,clientWidth:100,clientHeight:100,scrollWidth:300,scrollHeight:200}))Object.defineProperty(viewport,key,{value});
 assert.deepEqual(interactiveHitRegions(dom.window.document.querySelector('main'),800,600),[
  {x:12,y:123,width:100,height:14},{x:112,y:23,width:14,height:100},
 ]);
 dom.window.close();
});
