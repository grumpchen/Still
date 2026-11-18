import type {Page} from '@playwright/test';

/** Install a deterministic Tauri IPC mock for assistant provider UI tests. */
export async function mockAssistant(page:Page,reply='Mock assistant reply'){
 await page.addInitScript(({reply})=>{
  (window as any).isTauri=true;
  (window as any).__TAURI_INTERNALS__={invoke:async(command:string,args:any)=>{
   if(command==='assistant_configured')return true;
   if(command==='assistant_models')return ['mock-model'];
   if(command==='assistant_chat')return {text:reply};
   if(command==='chatgpt_plan_status')return {connected:false,email:null};
   if(command==='chatgpt_plan_models')return [];
   if(command==='plugin_store_list')return [];
   if(command==='app_shutdown_behavior_set')return null;
   return null;
  }};
 },{reply});
}
