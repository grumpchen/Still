import type {WidgetInstance, Workspace} from './workspaces.ts';
import {widgetCatalog} from './widgetCatalog.ts';
import type {Placement} from './layout.ts';

export type AssistantMode = 'chat' | 'read' | 'layout';
export type ChatMessage = {role:'user'|'model'; text:string};
export type LayoutItem = Placement & {id:string};
export type AssistantReply = {reply:string; layout:LayoutItem[]};
export type LayoutPlan = {workspaceId:string; fingerprint:string; width:number; height:number; items:LayoutItem[]};
export const DEFAULT_MODEL = 'gemini-2.5-flash';
export const HISTORY_LIMIT = 12;
export function assistantKeyError(reason:unknown):string {
  const detail=reason instanceof Error?reason.message:typeof reason==='string'?reason:'';
  return detail.trim()||'Could not verify the Gemini API key.';
}

export function widgetLabel(widget:WidgetInstance):string {
  return widget.title || widgetCatalog[widget.type].name+' '+widget.instanceNumber;
}
// No resource grants, local paths, bookmarks, or content from other widgets.
export function widgetContext(widget:WidgetInstance):Record<string,unknown> {
  const result:Record<string,unknown> = {type:widget.type, title:widgetLabel(widget)};
  if(widget.type==='notes'||widget.type==='ai')result.text=widget.text.slice(0,12000);
  if(widget.type==='timetable')result.schedule=widget.schedule.slice(0,80);
  if(widget.type==='focus')result.remainingSeconds=widget.end?Math.max(0,Math.ceil((widget.end-Date.now())/1000)):widget.remaining;
  if(widget.type==='browser')result.pageTitle=widget.pageTitle;
  if(widget.type==='apps'||widget.type==='browser'||widget.type==='desmos'||widget.type==='files')result.reading='Only metadata is available unless a visible screenshot is included. Do not infer unseen window or file contents.';
  return result;
}
export function layoutFingerprint(workspace:Workspace):string {
  return JSON.stringify(workspace.widgets.map(w=>[w.id,w.type,w.minimized,w.placement,w.appPanelOpen,w.appMinWidth,w.appMinHeight]));
}
export function layoutContext(workspace:Workspace,width:number,height:number) {
  return {canvas:{width,height,padding:20},widgets:workspace.widgets.map(w=>({
    id:w.id,title:widgetLabel(w),type:w.type,placement:w.placement,minimized:w.minimized,
    minimumWidth:Math.max(widgetCatalog[w.type].minWidth,w.appPanelOpen?w.appMinWidth??0:0),
    minimumHeight:Math.max(widgetCatalog[w.type].minHeight,w.appPanelOpen?w.appMinHeight??0:0),
  }))};
}
export function parseAssistantReply(value:unknown):AssistantReply {
  if(!value||typeof value!=='object')throw new Error('Gemini returned an invalid response. Try again.');
  const {reply,layout}=value as AssistantReply;
  if(typeof reply!=='string'||!reply.trim()||reply.length>24000||!Array.isArray(layout)||layout.length>100)throw new Error('Gemini returned an incomplete response. Try again.');
  const items=layout.map(item=>{
    if(!item||typeof item.id!=='string'||item.id.length>80||[item.x,item.y,item.width,item.height].some(n=>!Number.isSafeInteger(n)))throw new Error('Gemini returned an invalid layout. Try again.');
    return {id:item.id,x:item.x,y:item.y,width:item.width,height:item.height};
  });
  return {reply,layout:items};
}
export function validateLayout(workspace:Workspace,items:LayoutItem[],width:number,height:number):void {
  const movable=workspace.widgets.filter(w=>!w.minimized),ids=new Set<string>();
  if(!movable.length||items.length!==movable.length)throw new Error('The proposal must include every expanded widget exactly once.');
  for(const item of items){
    const widget=movable.find(w=>w.id===item.id);
    if(!widget||ids.has(item.id))throw new Error('The proposal contains a missing or duplicate widget.');
    ids.add(item.id);
    const meta=widgetCatalog[widget.type],minimumWidth=Math.max(meta.minWidth,widget.appPanelOpen?widget.appMinWidth??0:0),minimumHeight=Math.max(meta.minHeight,widget.appPanelOpen?widget.appMinHeight??0:0);
    if([item.x,item.y,item.width,item.height].some(n=>!Number.isSafeInteger(n))||item.x<0||item.y<0||item.width<minimumWidth||item.height<minimumHeight||item.width>3000||item.height>3000||item.x+item.width>width-20||item.y+item.height>height-20)throw new Error('The proposed layout does not fit the canvas or widget minimum sizes. Try requesting a different arrangement.');
  }
  const rectangles=[...items,...workspace.widgets.filter(w=>w.minimized).map(w=>({...w.placement,id:w.id}))];
  for(let i=0;i<rectangles.length;i++)for(let j=i+1;j<rectangles.length;j++){
    const a=rectangles[i],b=rectangles[j];
    if(a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y)throw new Error('The proposed layout overlaps widgets. Ask Gemini to leave more space.');
  }
}
export function applyLayoutPlan(workspace:Workspace,plan:LayoutPlan,width:number,height:number):Workspace {
  if(workspace.id!==plan.workspaceId||layoutFingerprint(workspace)!==plan.fingerprint||width!==plan.width||height!==plan.height)throw new Error('The workspace changed. Request a fresh layout before applying it.');
  validateLayout(workspace,plan.items,width,height);
  const positions=new Map(plan.items.map(({id,...p})=>[id,p]));
  return {...workspace,widgets:workspace.widgets.map(w=>positions.has(w.id)?{...w,placement:positions.get(w.id)!,lectureRestore:null}:w)};
}
