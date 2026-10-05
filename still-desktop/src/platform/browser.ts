import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
export interface BrowserBounds { x: number; y: number; width: number; height: number }
export interface BrowserUpdate { id: string; url?: string; title?: string; loading?: boolean }
const pending=new Map<string,Promise<unknown>>();
function command<T>(id:string,name:string,args:Record<string,unknown>={}):Promise<T>{
  const task=(pending.get(id)??Promise.resolve()).catch(()=>undefined).then(()=>invoke<T>(name,{id,...args}));
  pending.set(id,task);
  const clear=()=>{if(pending.get(id)===task)pending.delete(id)};task.then(clear,clear);
  return task;
}
export const nativeBrowser = {
  available: isTauri(),
  open: (id: string, url: string, bounds: BrowserBounds) => command<void>(id,'browser_open', { url, bounds }),
  bounds: (id: string, bounds: BrowserBounds) => command<void>(id,'browser_bounds', { bounds }),
  visible: (id: string, visible: boolean) => command<void>(id,'browser_visible', { visible }),
  navigate: (id: string, url: string) => command<void>(id,'browser_navigate', { url }),
  current: (id:string)=>command<string>(id,'browser_current'),
  action: (id: string, action: 'back' | 'forward' | 'reload') => command<void>(id,'browser_action', { action }),
  close: (id: string) => command<void>(id,'browser_close'),
  subscribe: (callback: (event: BrowserUpdate) => void): Promise<UnlistenFn> => listen<BrowserUpdate>('browser-state', event => callback(event.payload)),
};
