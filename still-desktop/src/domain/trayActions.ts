import {widgetPreset,type WidgetPreset} from './presets.ts';
import type {WorkspaceState} from './workspaces.ts';

export function upsertSavedPresets(existing:WidgetPreset[],items:WidgetPreset[]):WidgetPreset[]{
 const presets=[...existing];
 for(const value of items){
  const item=widgetPreset(value);
  const fingerprint=(preset:WidgetPreset)=>JSON.stringify({...preset,id:'',name:''});
  const index=presets.findIndex(p=>p.id===item.id);
  if(index>=0){presets[index]=item;continue}
  if(presets.some(p=>fingerprint(p)===fingerprint(item)))continue;
  // Different contents with the same default title must not erase a saved note.
  let name=item.name,number=2;
  while(presets.some(p=>p.name===name)){const suffix=' '+number++;name=item.name.slice(0,60-suffix.length)+suffix;}
  presets.push({...item,name});
 }
 return presets;
}
export function renameSavedPreset(existing:WidgetPreset[],id:string,name:string):WidgetPreset[]{
 return existing.map(item=>item.id===id?widgetPreset({...item,name} as WidgetPreset):item);
}
export function removeSavedPreset(existing:WidgetPreset[],id:string):WidgetPreset[]{
 const next=existing.filter(item=>item.id!==id);
 return next.length===existing.length?existing:next;
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
