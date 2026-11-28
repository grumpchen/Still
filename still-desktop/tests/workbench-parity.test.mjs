import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialState,createWorkspace} from '../src/domain/workspaces.ts';
import {parseWorkbenchActions,validateWorkbenchActionBatch} from '../src/domain/workbenchActions.ts';
import {createWorkbenchService} from '../src/platform/workbenchOperations.ts';
const layoutHandlers={save:()=> 'Saved layout.',apply:()=> 'Applied layout.',rename:()=> 'Renamed layout.',duplicate:()=> 'Duplicated layout.',delete:()=> 'Deleted layout.'};

test('parity workbench wire actions validate Dashboard, Groups, and rule admin targets',()=>{
 const parsed=parseWorkbenchActions([{operation:'dashboard.module.add',widgetType:'notes'},{operation:'group.list',workspaceId:'workspace-1'},{operation:'rule.enable',ruleId:'rule-1',enabled:false}]);assert.equal(parsed.length,3);assert.throws(()=>parseWorkbenchActions([{operation:'dashboard.module.add',widgetType:'group'}]));assert.throws(()=>parseWorkbenchActions([{operation:'dashboard.module.resize',widgetId:'widget-1',width:5000,height:50}]));assert.throws(()=>parseWorkbenchActions([{operation:'group.delete',workspaceId:'workspace-1',groupId:'group-1'}]));assert.throws(()=>validateWorkbenchActionBatch(parsed));
});

test('Dashboard module actions add, reorder, resize and hide modules while preserving their data',async()=>{
 let state=createInitialState();const dashboard=state.workspaces.find(item=>item.role==='dashboard');const existing=dashboard.widgets[0],other=dashboard.widgets[1];let commits=0;
 const service=createWorkbenchService({getState:()=>state,commitState:next=>{state=next;commits++},layoutHandlers,saveRule:async()=>({kind:'error',message:'unsupported'}),getCaptureEvent:async()=>null});
 const [listed]=await service.executeWorkbenchActions([{operation:'dashboard.list'}]);assert.equal(listed.data.some(item=>item.id===existing.id),true);
 const [added]=await service.executeWorkbenchActions([{operation:'dashboard.module.add',widgetType:'notes'}]);assert.equal(added.status,'succeeded');const dashboardAfterAdd=state.workspaces.find(item=>item.role==='dashboard');const note=dashboardAfterAdd.widgets.find(item=>item.id===added.data.widgetId);assert.equal(note.type,'notes');assert.equal(dashboardAfterAdd.dashboardLayout.order.includes(note.id),true);
 const [reordered]=await service.executeWorkbenchActions([{operation:'dashboard.module.reorder',widgetId:note.id,targetWidgetId:other.id,position:'before'}]);assert.equal(reordered.status,'succeeded');assert.ok(state.workspaces.find(item=>item.role==='dashboard').dashboardLayout.order.indexOf(note.id)<state.workspaces.find(item=>item.role==='dashboard').dashboardLayout.order.indexOf(other.id));
 const [resized]=await service.executeWorkbenchActions([{operation:'dashboard.module.resize',widgetId:note.id,width:420,height:300}]);assert.equal(resized.status,'succeeded');assert.deepEqual(state.workspaces.find(item=>item.role==='dashboard').dashboardLayout.sizes[note.id],{width:420,height:300});
 const [tooSmall]=await service.executeWorkbenchActions([{operation:'dashboard.module.resize',widgetId:note.id,width:80,height:80}]);assert.equal(tooSmall.status,'needs_clarification');
 const [removed]=await service.executeWorkbenchActions([{operation:'dashboard.module.remove',widgetId:note.id}]);assert.equal(removed.status,'succeeded');const after=state.workspaces.find(item=>item.role==='dashboard');assert.equal(after.widgets.some(item=>item.id===note.id),true,'module is hidden from Dashboard but widget data remains');assert.equal(after.dashboardLayout.order.includes(note.id),false);assert.equal(commits,4);
});

test('Group actions create, rename and require explicit contents removal before deletion',async()=>{
 let state=createInitialState();const owner=createWorkspace('Biology',[],'study');state.workspaces.push(owner);const service=createWorkbenchService({getState:()=>state,commitState:next=>{state=next},layoutHandlers,saveRule:async()=>({kind:'error',message:'unsupported'}),getCaptureEvent:async()=>null});
 const [created]=await service.executeWorkbenchActions([{operation:'group.create',workspaceId:owner.id,name:'Lectures'}]);assert.equal(created.status,'succeeded');const id=created.data.groupId;assert.equal(state.workspaces.find(item=>item.id===owner.id).groups.find(item=>item.id===id).name,'Lectures');
 const [renamed]=await service.executeWorkbenchActions([{operation:'group.rename',workspaceId:owner.id,groupId:id,name:'Week 1'}]);assert.equal(renamed.status,'succeeded');
 const group=state.workspaces.find(item=>item.id===owner.id).groups.find(item=>item.id===id);group.shortcuts.push({id:'link-1',name:'Lecture',url:'https://example.edu/lecture'});
 const [blocked]=await service.executeWorkbenchActions([{operation:'group.delete',workspaceId:owner.id,groupId:id,removeContents:false}]);assert.equal(blocked.status,'needs_clarification');assert.equal(state.workspaces.find(item=>item.id===owner.id).groups.some(item=>item.id===id),true);
 const [deleted]=await service.executeWorkbenchActions([{operation:'group.delete',workspaceId:owner.id,groupId:id,removeContents:true}]);assert.equal(deleted.status,'succeeded');assert.equal(state.workspaces.find(item=>item.id===owner.id).groups.some(item=>item.id===id),false);assert.equal(state.workspaces.find(item=>item.id===owner.id).widgets.some(item=>item.groupId===id),false);
});

test('rule list and administration delegate to the persisted Rules runner callbacks',async()=>{
 let state=createInitialState(),runs=0;const rules=[{id:'rule-1',enabled:true,sourceText:'every day',trigger:{kind:'daily'},action:{kind:'prepareWorkspaceLayout'}}],admin={list:()=>rules,enable:(id,value)=>{assert.equal(id,'rule-1');rules[0].enabled=value;return value?'Enabled.':'Disabled.'},setLayoutMode:(id,mode)=>`Saved ${mode}.`,delete:id=>{rules.splice(0,1);return'Deleted.'},runDue:async()=>{runs++;return{ok:true,dueCount:1,succeededCount:1,attentionCount:0,notConfirmedCount:0}}};
 const service=createWorkbenchService({getState:()=>state,commitState:next=>{state=next},layoutHandlers,saveRule:async()=>({kind:'error',message:'unsupported'}),getCaptureEvent:async()=>null,ruleAdmin:admin});
 assert.equal((await service.executeWorkbenchActions([{operation:'rule.list'}]))[0].data[0].id,'rule-1');assert.match((await service.executeWorkbenchActions([{operation:'rule.enable',ruleId:'rule-1',enabled:false}]))[0].summary,/Disabled/);assert.equal(rules[0].enabled,false);assert.match((await service.executeWorkbenchActions([{operation:'rule.layoutMode',ruleId:'rule-1',mode:'append'}]))[0].summary,/append/);assert.equal((await service.executeWorkbenchActions([{operation:'rule.runDue'}]))[0].data.succeededCount,1);assert.equal(runs,1);assert.match((await service.executeWorkbenchActions([{operation:'rule.delete',ruleId:'rule-1'}]))[0].summary,/Deleted/);assert.equal(rules.length,0);
});
