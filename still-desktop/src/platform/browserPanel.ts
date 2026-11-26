import {invoke,isTauri} from '@tauri-apps/api/core';
import {listen,type Event as TauriEvent} from '@tauri-apps/api/event';

export interface BrowserPanelBounds {x:number;y:number;width:number;height:number}
export interface BrowserLocation {widgetId:string;url:string}
type Invoke = <T>(command:string,args?:Record<string,unknown>)=>Promise<T>;
type Listen = <T>(event:string,handler:(event:TauriEvent<T>)=>void)=>Promise<()=>void>;

/** Tiny command adapter kept injectable so tests can assert the native lifecycle calls. */
export function createBrowserPanel(api:{invoke:Invoke;listen:Listen;native:boolean}){
 return {
  native:api.native,
  present(widgetId:string,url:string,bounds:BrowserPanelBounds,visible:boolean){
   if(!api.native)return Promise.resolve();
   return api.invoke<void>('browser_panel_present',{widgetId,url,bounds,visible});
  },
  navigate(widgetId:string,url:string){return api.native?api.invoke<void>('browser_panel_navigate',{widgetId,url}):Promise.resolve()},
  goBack(widgetId:string){return api.invoke<void>('browser_panel_go_back',{widgetId})},
  goForward(widgetId:string){return api.invoke<void>('browser_panel_go_forward',{widgetId})},
  reload(widgetId:string){return api.invoke<void>('browser_panel_reload',{widgetId})},
  close(widgetId:string){if(api.native)return api.invoke<void>('browser_panel_close',{widgetId});return Promise.resolve()},
  onLocation(handler:(location:BrowserLocation)=>void){
   if(!api.native)return Promise.resolve(()=>{});
   return api.listen<BrowserLocation>('still-browser-url',event=>handler(event.payload));
  }
 };
}
export const browserPanel=createBrowserPanel({invoke,listen,native:isTauri()});
