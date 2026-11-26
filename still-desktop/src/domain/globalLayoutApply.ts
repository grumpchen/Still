import {cloneGlobalWorkspaceLayout,type GlobalWorkspaceLayout,type Workspace,type WorkspaceState} from './workspaces.ts';

function same(left:unknown,right:unknown):boolean{return JSON.stringify(left)===JSON.stringify(right)}

/** Clear persisted running flags after native panels were released, including collected Apps. */
export function markReleasedAppPanels(state:WorkspaceState,ids:readonly string[]):WorkspaceState{
 if(!ids.length)return state;
 const released=new Set(ids);
 return{...state,workspaces:state.workspaces.map(workspace=>({...workspace,
  widgets:workspace.widgets.map(widget=>released.has(widget.id)&&widget.type==='apps'?{...widget,appPanelOpen:false,appWasCollected:false}:widget),
  groups:workspace.groups.map(group=>({...group,widgets:group.widgets.map(entry=>entry.kind==='collected'&&released.has(entry.id)&&entry.instance?{...entry,instance:{...entry.instance,appPanelOpen:false,appWasCollected:false}}:entry)}))
 }))};
}

export interface GlobalLayoutApplyPlan {before:WorkspaceState;next:WorkspaceState;applied:Workspace;shouldActivate:boolean;template:GlobalWorkspaceLayout;target:Workspace}

/** Rebase an awaited native close onto the latest app state without overwriting concurrent edits. */
export function planGlobalLayoutApply(initial:WorkspaceState,latest:WorkspaceState,layoutId:string,targetId:string,mode:'append'|'replace',releasedPanelIds:readonly string[],activate:boolean):GlobalLayoutApplyPlan{
 const originalTemplate=initial.globalLayouts.find(layout=>layout.id===layoutId),template=latest.globalLayouts.find(layout=>layout.id===layoutId);
 const originalTarget=initial.workspaces.find(workspace=>workspace.id===targetId),normalizedLatest=markReleasedAppPanels(latest,releasedPanelIds),latestTarget=normalizedLatest.workspaces.find(workspace=>workspace.id===targetId);
 if(!originalTemplate||!originalTarget||!template||!latestTarget)throw new Error('The layout or target workspace changed while native apps were closing. The layout was not applied.');
 if(originalTarget.role==='library'||latestTarget.role==='library')throw new Error('Library is an aggregate view, so a workspace layout cannot be applied to it.');
 if(!same(originalTemplate,template))throw new Error('The selected layout changed while native apps were closing. The layout was not applied.');
 const expectedTarget=markReleasedAppPanels({...initial,workspaces:[originalTarget]},releasedPanelIds).workspaces[0];
 if(!same(expectedTarget,latestTarget))throw new Error('The target workspace changed while native apps were closing. Its current contents were preserved and the layout was not applied.');
 const before=normalizedLatest,target=before.workspaces.find(workspace=>workspace.id===targetId)!;
 const applied=cloneGlobalWorkspaceLayout(template,target,mode);
 const shouldActivate=activate&&latest.activeId===initial.activeId;
 const next:WorkspaceState={...before,activeId:shouldActivate?targetId:latest.activeId,
  workspaces:before.workspaces.map(workspace=>workspace.id===targetId?applied:workspace),
  theme:template.settings.theme,density:template.settings.density,background:template.settings.background,
  appearance:template.settings.appearance,glass:structuredClone(template.settings.glass)};
 return{before,next,applied,shouldActivate,template,target};
}
