import {invoke,isTauri} from '@tauri-apps/api/core';
import {listen,type Event as TauriEvent} from '@tauri-apps/api/event';

export interface BrowserPanelBounds {x:number;y:number;width:number;height:number}
export interface BrowserLocation {widgetId:string;url:string}
type Invoke = <T>(command:string,args?:Record<string,unknown>)=>Promise<T>;
type Listen = <T>(event:string,handler:(event:TauriEvent<T>)=>void)=>Promise<()=>void>;

/** Tiny command adapter kept injectable so tests can assert the native lifecycle calls. */
export function createBrowserPanel(api:{invoke:Invoke;listen:Listen;native:boolean}){
 const pending=new Map<string,Promise<unknown>>();
 const lastPresent=new Map<string,{key:string;promise:Promise<void>} >();
 function serial<T>(widgetId:string,operation:()=>Promise<T>):Promise<T>{
  const previous=pending.get(widgetId)??Promise.resolve();
  const current=previous.catch(()=>undefined).then(operation);
  pending.set(widgetId,current);
  const clear=()=>{if(pending.get(widgetId)===current)pending.delete(widgetId)};
  void current.then(clear,clear);
  return current;
 }
 return {
  native:api.native,
  present(widgetId:string,url:string,bounds:BrowserPanelBounds,visible:boolean){
   if(!api.native)return Promise.resolve();
   const key=JSON.stringify({url,bounds,visible}),last=lastPresent.get(widgetId);
   if(last?.key===key)return last.promise;
   const promise=serial(widgetId,()=>api.invoke<void>('browser_panel_present',{widgetId,url,bounds,visible}));
   lastPresent.set(widgetId,{key,promise});
   void promise.catch(()=>{if(lastPresent.get(widgetId)?.promise===promise)lastPresent.delete(widgetId)});
   return promise;
  },
  navigate(widgetId:string,url:string){return api.native?serial(widgetId,()=>api.invoke<void>('browser_panel_navigate',{widgetId,url})):Promise.resolve()},
  goBack(widgetId:string){return api.native?serial(widgetId,()=>api.invoke<void>('browser_panel_go_back',{widgetId})):Promise.resolve()},
  goForward(widgetId:string){return api.native?serial(widgetId,()=>api.invoke<void>('browser_panel_go_forward',{widgetId})):Promise.resolve()},
  reload(widgetId:string){return api.native?serial(widgetId,()=>api.invoke<void>('browser_panel_reload',{widgetId})):Promise.resolve()},
  close(widgetId:string){if(api.native){lastPresent.delete(widgetId);return serial(widgetId,()=>api.invoke<void>('browser_panel_close',{widgetId}))}return Promise.resolve()},
  onLocation(handler:(location:BrowserLocation)=>void){
   if(!api.native)return Promise.resolve(()=>{});
   return api.listen<BrowserLocation>('still-browser-url',event=>handler(event.payload));
  }
 };
}
export const browserPanel=createBrowserPanel({invoke,listen,native:isTauri()});
