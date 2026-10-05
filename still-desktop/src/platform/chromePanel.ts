import {invoke,isTauri} from '@tauri-apps/api/core';
import {listen,type UnlistenFn} from '@tauri-apps/api/event';
import type {BrowserBounds} from './browser.ts';
const pending=new Map<string,Promise<unknown>>();
function command<T>(id:string,name:string,args:Record<string,unknown>={}):Promise<T>{
 const task=(pending.get(id)??Promise.resolve()).catch(()=>undefined).then(()=>invoke<T>(name,{id,...args}));pending.set(id,task);
 const clear=()=>{if(pending.get(id)===task)pending.delete(id)};task.then(clear,clear);return task;
}
export const chromePanel={
 available:isTauri(),
 open:(id:string,url:string,bounds:BrowserBounds)=>command<{hwnd:number;pid:number}>(id,'chrome_panel_open',{url,bounds}),
 present:(id:string,bounds:BrowserBounds,visible:boolean)=>command<void>(id,'chrome_panel_present',{bounds,visible}),
 navigate:(id:string,url:string)=>command<void>(id,'chrome_panel_navigate',{url}),
 close:(id:string)=>command<void>(id,'chrome_panel_close'),
 subscribe:(callback:(event:{id:string;open:boolean;error?:string|null})=>void):Promise<UnlistenFn>=>listen<{id:string;open:boolean;error?:string|null}>('chrome-state',event=>callback(event.payload)),
};
