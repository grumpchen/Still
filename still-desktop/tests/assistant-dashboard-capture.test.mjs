import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {mockIPC,clearMocks} from '@tauri-apps/api/mocks';
import {createServer} from 'vite';
const vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,entries:[]}});
after(()=>vite.close());

test('dashboard default AI screenshot captures the visible page without requiring a widget canvas',async()=>{
 const dom=new JSDOM('<main class="main main-dashboard"><div class="content"><div class="workspace-surface"><section class="dashboard-home"></section></div></div></main><aside class="assistant-panel"></aside><div hidden><div class="canvas-viewport"></div></div>',{pretendToBeVisual:true});
 const saved=new Map(),calls=[];
 const values={window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,innerWidth:1200,innerHeight:900,isTauri:true,createImageBitmap:async()=>({width:800,height:600,close(){}})};
 for(const [key,value] of Object.entries(values)){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{configurable:true,writable:true,value})}
 try{
  dom.window.__TAURI_INTERNALS__={};
  dom.window.document.querySelector('.content').getBoundingClientRect=()=>({x:20,y:60,left:20,top:60,right:820,bottom:660,width:800,height:600});
  dom.window.HTMLCanvasElement.prototype.getContext=()=>({drawImage(){}});
  dom.window.HTMLCanvasElement.prototype.toDataURL=()=> 'data:image/jpeg;base64,/9j/AA==';
  mockIPC((command,args)=>{calls.push({command,args});if(command==='widget_capture')return [137,80,78,71];return null});
  const {workspaceImage}=await vite.ssrLoadModule('/src/platform/assistant.ts');
  assert.equal(await workspaceImage(),'/9j/AA==');
  assert.deepEqual(calls.find(call=>call.command==='widget_capture').args.bounds,{x:20,y:60,width:800,height:600,viewportWidth:1200,viewportHeight:900});
 }finally{clearMocks();dom.window.close();for(const [key,descriptor] of saved){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}}
});
