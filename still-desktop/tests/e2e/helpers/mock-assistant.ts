import type {Page} from '@playwright/test';

/** Install a deterministic Tauri IPC mock for assistant provider UI tests. */
export async function mockAssistant(page:Page,reply='Mock assistant reply'){
 await page.addInitScript(({reply})=>{
  (window as any).isTauri=true;
  const listeners=new Map<string,Set<(event:any)=>void>>();
  (window as any).__TAURI_INTERNALS__={
   metadata:{currentWindow:{label:'main',effects:{}},currentWebview:{label:'main',windowLabel:'main'}},
   transformCallback:(callback:(event:any)=>void)=>{const id=String(Math.random());(window as any).__TAURI_INTERNALS__.callbacks??={};(window as any).__TAURI_INTERNALS__.callbacks[id]=callback;return id},
   unregisterCallback:(id:string)=>{delete (window as any).__TAURI_INTERNALS__.callbacks?.[id]},
   invoke:async(command:string,args:any)=>{
   if(command==='plugin:window|is_fullscreen')return false;
   if(command==='plugin:event|listen'){const name=args.event,target=listeners.get(name)??new Set();target.add((window as any).__TAURI_INTERNALS__.callbacks?.[args.handler]);listeners.set(name,target);return 1}
   if(command==='plugin:event|unlisten'){listeners.get(args.event)?.clear();return true}
   if(command==='assistant_configured')return true;
   if(command==='assistant_models')return ['mock-model'];
   if(command==='assistant_chat')return {reply,layout:[]};
   if(command==='chatgpt_plan_status')return {connected:false,email:null};
   if(command==='chatgpt_plan_models')return [];
   if(command==='plugin_store_list')return [];
   if(command==='app_shutdown_behavior_set')return null;
   return null;
  }};
 },{reply});
}
