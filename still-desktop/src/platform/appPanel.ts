import {invoke,isTauri} from '@tauri-apps/api/core';
import {listen,type UnlistenFn} from '@tauri-apps/api/event';
import type {PanelBounds} from '../domain/appPanel.ts';
import type {AppWindowChoice} from '../domain/appPicker.ts';
import type {DroppedResource} from './resourceDrop.ts';
export interface AppWindow {hwnd:number;pid:number;title:string}
export interface AppAttachment {hwnd:number;pid:number}
export function appImageUrl(bytes:number[]):string{let binary='';for(let offset=0;offset<bytes.length;offset+=8192)binary+=String.fromCharCode(...bytes.slice(offset,offset+8192));return'data:image/png;base64,'+btoa(binary)}
export interface AppPanelInfo {hwnd:number;pid:number;minWidth:number;minHeight:number;requiredWidth:number|null;requiredHeight:number|null;measured:boolean}
const pending=new Map<string,Promise<unknown>>();
function command<T>(id:string,name:string,args:Record<string,unknown>={}):Promise<T>{
 const task=(pending.get(id)??Promise.resolve()).catch(()=>undefined).then(()=>invoke<T>(name,{id,...args}));pending.set(id,task);
 const clear=()=>{if(pending.get(id)===task)pending.delete(id)};task.then(clear,clear);return task;
}
export const appPanel={
 available:isTauri(),
 open:(id:string,sourceId:string,bounds:PanelBounds,clip:PanelBounds,grip:PanelBounds|null,reuseExisting=false)=>command<AppPanelInfo>(id,'app_panel_open',{sourceId,bounds,clip,grip,reuseExisting}),
 present:(id:string,bounds:PanelBounds,clip:PanelBounds,grip:PanelBounds|null,visible:boolean)=>command<AppPanelInfo>(id,'app_panel_present',{bounds,clip,grip,visible}),
 attach:(id:string,window:AppAttachment,bounds:PanelBounds,clip:PanelBounds,grip:PanelBounds|null)=>command<AppPanelInfo>(id,'app_panel_attach',{hwnd:window.hwnd,pid:window.pid,bounds,clip,grip}),
 windows:()=>invoke<AppWindow[]>('app_panel_windows'),
 choices:(sourceId?:string)=>invoke<AppWindowChoice[]>('app_picker_windows',{sourceId:sourceId??null}),
 prepare:(window:AppAttachment)=>invoke<DroppedResource>('app_picker_prepare',{hwnd:window.hwnd,pid:window.pid}),
 preview:async(window:AppAttachment)=>appImageUrl(await invoke<number[]>('app_picker_preview',{hwnd:window.hwnd,pid:window.pid})),
 release:(id:string)=>command<void>(id,'app_panel_release'),
 subscribe:(callback:(event:{id:string;open:boolean;error?:string|null})=>void):Promise<UnlistenFn>=>listen<{id:string;open:boolean;error?:string|null}>('app-panel-state',event=>callback(event.payload)),
};
