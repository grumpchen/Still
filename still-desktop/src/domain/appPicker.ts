import {checkedAppIconData,createWidget,createWidgetFromPreset,nextInstanceNumber,type WidgetInstance} from './workspaces.ts';
import {nextPlacement,placement} from './layout.ts';
export interface AppWindowChoice {hwnd:number;pid:number;appName:string;title:string;attached:boolean;minimized:boolean;icon?:number[]}
export interface InstalledAppChoice {id:string;name:string;icon:number[]}
export function appIconData(bytes:unknown):string|undefined {
 if(!Array.isArray(bytes)||bytes.length<8||bytes.length>192_000||bytes.some(value=>!Number.isInteger(value)||value<0||value>255))return undefined;
 if([137,80,78,71,13,10,26,10].some((value,index)=>bytes[index]!==value))return undefined;
 const encoded='data:image/png;base64,'+btoa(String.fromCharCode(...bytes));return checkedAppIconData(encoded);
}
export function filterAppWindows(windows:AppWindowChoice[],query:string):AppWindowChoice[]{
 const terms=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
 return windows.filter(window=>terms.every(term=>(window.appName+' '+window.title).toLocaleLowerCase().includes(term)))
  .sort((a,b)=>Number(a.attached)-Number(b.attached)||a.appName.localeCompare(b.appName)||a.title.localeCompare(b.title));
}
export function filterInstalledApps(apps:InstalledAppChoice[],query:string):InstalledAppChoice[]{
 const terms=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
 return apps.filter(app=>terms.every(term=>app.name.toLocaleLowerCase().includes(term))).sort((a,b)=>a.name.localeCompare(b.name));
}
export function refreshedAppSelection(current:AppWindowChoice|null,windows:AppWindowChoice[]):AppWindowChoice|null{
 if(!current)return null;
 return windows.find(window=>window.hwnd===current.hwnd&&window.pid===current.pid&&!window.attached)??null;
}
export function managedAppWidget(source:{sourceId:string|null;name:string},name:string,widgets:WidgetInstance[],at?:{x:number;y:number},width?:number,reuseExisting=false,icon?:number[]|string):WidgetInstance{
 if(source.sourceId===null){
  const displayName=(source.name.trim()||name.trim()||'Attached app').slice(0,60),widget=createWidget('apps');
  widget.title=(name.trim()||displayName).slice(0,60);widget.appName=displayName;widget.appPanelOpen=true;widget.appIconData=typeof icon==='string'?checkedAppIconData(icon):appIconData(icon);
  widget.instanceNumber=nextInstanceNumber('apps',widgets);widget.placement=at?placement('apps',{...widget.placement,...at}):nextPlacement('apps',widgets,width);
  return widget;
 }
 const widget=createWidgetFromPreset({id:crypto.randomUUID(),type:'apps',name:name.trim()||source.name.slice(0,60),appSourceId:source.sourceId??'',appName:source.name},widgets,at,width);
 return{...widget,appPanelOpen:true,appReuseExisting:reuseExisting,appIconData:typeof icon==='string'?checkedAppIconData(icon):appIconData(icon)};
}
