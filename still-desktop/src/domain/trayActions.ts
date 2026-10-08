import {widgetPreset,type WidgetPreset} from './presets.ts';
import type {WorkspaceState} from './workspaces.ts';

export function upsertSavedPresets(existing:WidgetPreset[],items:WidgetPreset[]):WidgetPreset[]{
 const presets=[...existing];
 for(const value of items){
  const item=widgetPreset(value);
  // Same named configuration is an update; repeated drops do not add labels.
  const index=presets.findIndex(p=>p.id===item.id||(p.type===item.type&&p.name===item.name));
  if(index<0)presets.push(item);else presets[index]={...item,id:presets[index].id};
 }
 return presets;
}
export function savedAppInUse(state:WorkspaceState,preset:WidgetPreset):boolean{
 if(preset.type!=='apps')return false;
 return state.workspaces.some(workspace=>[...workspace.widgets,...workspace.groups.flatMap(g=>g.widgets.flatMap(e=>e.kind==='collected'&&e.instance?[e.instance]:[]))].some(w=>w.type==='apps'&&w.appPanelOpen&&w.appKey===preset.appSourceId));
}
export function deleteCanvasWidget(state:WorkspaceState,workspaceId:string,id:string):WorkspaceState{
 if(!state.workspaces.some(w=>w.id===workspaceId&&w.widgets.some(widget=>widget.id===id)))return state;
 // Group collections belong to the workspace, independently of their open card.
 return{...state,workspaces:state.workspaces.map(w=>w.id===workspaceId?{...w,widgets:w.widgets.filter(widget=>widget.id!==id)}:w)};
}
