import {createWidgetFromPreset,type WidgetInstance} from './workspaces.ts';
export interface AppWindowChoice {hwnd:number;pid:number;appName:string;title:string;attached:boolean;minimized:boolean;icon?:number[]}
export function filterAppWindows(windows:AppWindowChoice[],query:string):AppWindowChoice[]{
 const terms=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
 return windows.filter(window=>terms.every(term=>(window.appName+' '+window.title).toLocaleLowerCase().includes(term)))
  .sort((a,b)=>Number(a.attached)-Number(b.attached)||a.appName.localeCompare(b.appName)||a.title.localeCompare(b.title));
}
export function managedAppWidget(source:{sourceId:string|null;name:string},name:string,widgets:WidgetInstance[],at?:{x:number;y:number},width?:number,reuseExisting=false):WidgetInstance{
 const widget=createWidgetFromPreset({id:crypto.randomUUID(),type:'apps',name:name.trim()||source.name.slice(0,60),appSourceId:source.sourceId??'',appName:source.name},widgets,at,width);
 return{...widget,appPanelOpen:true,appReuseExisting:reuseExisting};
}
