import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createInitialState,createGlobalWorkspaceLayout,createWidget} from '../src/domain/workspaces.ts';
import {planGlobalLayoutApply} from '../src/domain/globalLayoutApply.ts';

function fixture(){
 const state=createInitialState(),dashboard=state.workspaces.find(item=>item.role==='dashboard'),study=state.workspaces.find(item=>item.role==='study');
 const app={...createWidget('apps'),appPanelOpen:true,appWasCollected:true};
 const target={...study,widgets:[app]},source={...dashboard,widgets:[createWidget('notes')]};
 const sourceState={...state,workspaces:state.workspaces.map(item=>item.id===study.id?target:item.id===dashboard.id?source:item)};
 const layout=createGlobalWorkspaceLayout('Saved',source,sourceState,{widgetIds:source.widgets.map(item=>item.id),widgets:source.widgets});
 const initial={...sourceState,globalLayouts:[layout]};
 return{initial,layout,target,study,dashboard};
}

test('layout apply rebases onto latest state after app release and preserves concurrent workspace edits and selection',()=>{
 const {initial,layout,target,dashboard}=fixture(),released={...target,widgets:target.widgets.map(widget=>({...widget,appPanelOpen:false,appWasCollected:false}))};
 const editedDashboard={...dashboard,name:'Concurrent dashboard edit'},latestActive=initial.workspaces.find(item=>item.id!==target.id&&item.id!==dashboard.id),latest={...initial,activeId:latestActive.id,workspaces:initial.workspaces.map(item=>item.id===target.id?released:item.id===dashboard.id?editedDashboard:item)};
 const plan=planGlobalLayoutApply(initial,latest,layout.id,target.id,'replace',[target.widgets[0].id],true);
 assert.equal(plan.next.activeId,latestActive.id,'manual apply must not undo a workspace switch made while awaiting native close');
 assert.equal(plan.next.workspaces.find(item=>item.id===dashboard.id).name,'Concurrent dashboard edit');
 assert.equal(plan.before.workspaces.find(item=>item.id===target.id).widgets[0].appPanelOpen,false,'undo snapshot records the actual post-close state');
 assert.equal(plan.next.workspaces.find(item=>item.id===target.id).widgets[0].type,'notes');
 assert.equal(plan.shouldActivate,false);
});

test('layout apply rejects a target edit made while app release is pending and preserves latest state',()=>{
 const {initial,layout,target,dashboard}=fixture(),released={...target,widgets:target.widgets.map(widget=>({...widget,appPanelOpen:false,appWasCollected:false}))};
 const changedTarget={...released,name:'Edited while closing'},editedDashboard={...dashboard,name:'Also edited'};
 const latest={...initial,workspaces:initial.workspaces.map(item=>item.id===target.id?changedTarget:item.id===dashboard.id?editedDashboard:item)};
 assert.throws(()=>planGlobalLayoutApply(initial,latest,layout.id,target.id,'replace',[target.widgets[0].id],true),/target workspace changed/);
 assert.equal(latest.workspaces.find(item=>item.id===target.id).name,'Edited while closing');
 assert.equal(latest.workspaces.find(item=>item.id===dashboard.id).name,'Also edited');
});

test('layout apply rejects a template changed while app release is pending',()=>{
 const {initial,layout,target}=fixture(),released={...target,widgets:target.widgets.map(widget=>({...widget,appPanelOpen:false,appWasCollected:false}))};
 const changedLayout={...layout,name:'Edited template'},latest={...initial,globalLayouts:[changedLayout],workspaces:initial.workspaces.map(item=>item.id===target.id?released:item)};
 assert.throws(()=>planGlobalLayoutApply(initial,latest,layout.id,target.id,'replace',[target.widgets[0].id],true),/layout changed/);
});

test('automation prepare preserves latest active workspace after native close',()=>{
 const {initial,layout,target,dashboard}=fixture(),released={...target,widgets:target.widgets.map(widget=>({...widget,appPanelOpen:false,appWasCollected:false}))};
 const latest={...initial,activeId:dashboard.id,workspaces:initial.workspaces.map(item=>item.id===target.id?released:item)};
 const plan=planGlobalLayoutApply(initial,latest,layout.id,target.id,'replace',[target.widgets[0].id],false);
 assert.equal(plan.next.activeId,dashboard.id);
 assert.equal(plan.shouldActivate,false);
});

test('layout cannot be applied to the aggregate Library view',()=>{
 const {initial,layout,target}=fixture(),library=initial.workspaces.find(item=>item.role==='library'),latest={...initial,workspaces:initial.workspaces.map(item=>item.id===target.id?{...target,widgets:target.widgets.map(widget=>({...widget,appPanelOpen:false,appWasCollected:false}))}:item)};
 assert.throws(()=>planGlobalLayoutApply(initial,latest,layout.id,library.id,'replace',[],true),/Library is an aggregate view/);
});
