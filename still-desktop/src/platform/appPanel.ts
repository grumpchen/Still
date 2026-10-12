import {invoke,isTauri} from '@tauri-apps/api/core';
import {listen,type UnlistenFn} from '@tauri-apps/api/event';
import type {PanelBounds} from '../domain/appPanel.ts';
import type {AppWindowChoice,InstalledAppChoice} from '../domain/appPicker.ts';
import type {DroppedResource} from './resourceDrop.ts';
import type {AppShutdownBehavior} from '../domain/appSettings.ts';
export interface AppWindow {hwnd:number;pid:number;title:string}
export interface AppAttachment {hwnd:number;pid:number;capture?:boolean}
export function appImageUrl(bytes:number[]):string{let binary='';for(let offset=0;offset<bytes.length;offset+=8192)binary+=String.fromCharCode(...bytes.slice(offset,offset+8192));return'data:image/png;base64,'+btoa(binary)}
export interface AppPanelInfo {hwnd:number;pid:number;minWidth:number;minHeight:number;requiredWidth:number|null;requiredHeight:number|null;measured:boolean;probing:boolean;shown:boolean}
const pending=new Map<string,Promise<unknown>>();
const retainedForCollection=new Set<string>();
function command<T>(id:string,name:string,args:Record<string,unknown>={}):Promise<T>{
 const task=(pending.get(id)??Promise.resolve()).catch(()=>undefined).then(()=>invoke<T>(name,{id,...args}));pending.set(id,task);
 const clear=()=>{if(pending.get(id)===task)pending.delete(id)};task.then(clear,clear);return task;
}
export const appPanel={
 available:isTauri(),
 open:(id:string,sourceId:string,bounds:PanelBounds,clip:PanelBounds,grip:PanelBounds|null,reuseExisting=false)=>command<AppPanelInfo>(id,'app_panel_open',{sourceId,bounds,clip,grip,reuseExisting}),
 present:(id:string,bounds:PanelBounds,clip:PanelBounds,grip:PanelBounds|null,occlusions:PanelBounds[],visible:boolean,stackingRank:number,revision:number,viewportRight:number)=>command<AppPanelInfo>(id,'app_panel_present',{bounds,clip,grip,occlusions,visible,stackingRank,revision,viewportRight}),
 attach:(id:string,window:AppAttachment,bounds:PanelBounds,clip:PanelBounds,grip:PanelBounds|null)=>command<AppPanelInfo>(id,'app_panel_attach',{hwnd:window.hwnd,pid:window.pid,bounds,clip,grip,preserveFocus:window.capture===true}),
 windows:()=>invoke<AppWindow[]>('app_panel_windows'),
 identity:(id:string)=>invoke<AppAttachment|null>('app_panel_identity',{id}),
 choices:(sourceId?:string)=>invoke<AppWindowChoice[]>('app_picker_windows',{sourceId:sourceId??null}),
 icon:(window:AppAttachment)=>invoke<number[]>('app_picker_icon',{hwnd:window.hwnd,pid:window.pid}),
 installed:()=>invoke<InstalledAppChoice[]>('app_picker_installed'),
 selectInstalled:(id:string)=>invoke<DroppedResource>('app_picker_select_installed',{id}),
 prepare:(window:AppAttachment)=>invoke<DroppedResource>('app_picker_prepare',{hwnd:window.hwnd,pid:window.pid}),
 preview:async(window:AppAttachment)=>appImageUrl(await invoke<number[]>('app_picker_preview',{hwnd:window.hwnd,pid:window.pid})),
 release:(id:string)=>command<void>(id,'app_panel_release'),
 configureShutdown:(behavior:AppShutdownBehavior)=>invoke<void>('app_panel_configure_shutdown',{behavior}),
 suspendForCollection:async(id:string)=>{const suspended=await command<boolean>(id,'app_panel_suspend',{forCollection:true});if(suspended)retainedForCollection.add(id);return suspended},
 isCollectionRetained:(id:string)=>retainedForCollection.has(id),
 consumeCollectionRetention:(id:string)=>{const retained=retainedForCollection.has(id);retainedForCollection.delete(id);return retained},
 resume:(id:string)=>command<AppPanelInfo>(id,'app_panel_resume'),
 cancelCollection:(id:string)=>{retainedForCollection.delete(id);return command<AppPanelInfo>(id,'app_panel_resume',{cancelCollection:true})},
 subscribe:(callback:(event:{id:string;open:boolean;error?:string|null})=>void):Promise<UnlistenFn>=>listen<{id:string;open:boolean;error?:string|null}>('app-panel-state',event=>callback(event.payload)),
 suspendForDrag:(id:string)=>command<boolean>(id,'app_panel_suspend'),
};
