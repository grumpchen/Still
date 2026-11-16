import test from 'node:test';
import assert from 'node:assert/strict';
import {collectWidgetIntoGroup,createInitialState,createWidget,minimizeWidgetInstance,parseState,restoreCollectedWidget,restoreWidgetInstance} from '../src/domain/workspaces.ts';
import {checkedWidgetTaskStatus,matchesWidgetTaskStatus,widgetTaskStatusCounts} from '../src/domain/widgetTaskStatus.ts';

test('task status accepts only supported values and treats old or malformed values as unset',()=>{
 for(const status of ['todo','in-progress','done'])assert.equal(checkedWidgetTaskStatus(status),status);
 for(const status of [undefined,null,'blocked','DONE',42,{}])assert.equal(checkedWidgetTaskStatus(status),null);
});

test('task status quick-filter counts include unset widgets and match without changing data',()=>{
 const widgets=[{taskStatus:'todo'},{taskStatus:'in-progress'},{taskStatus:'done'},{taskStatus:null}];
 assert.deepEqual(widgetTaskStatusCounts(widgets),{all:4,unset:1,todo:1,'in-progress':1,done:1});
 assert.equal(matchesWidgetTaskStatus(widgets[2],'done'),true);
 assert.equal(matchesWidgetTaskStatus(widgets[0],'done'),false);
 assert.equal(matchesWidgetTaskStatus(widgets[3],'unset'),true);
 assert.equal(matchesWidgetTaskStatus({},'unset'),true,'missing legacy fields behave as unset');
 assert.equal(matchesWidgetTaskStatus(widgets[1],'all'),true);
});

test('task status round-trips, defaults safely for old saves, and survives Group collection',()=>{
 const state=createInitialState(),workspace=state.workspaces.find(item=>item.role==='study'),note=workspace.widgets.find(item=>item.type==='notes'),group=createWidget('group');
 note.taskStatus='in-progress';group.groupId='status-group';workspace.widgets.push(group);workspace.groups.push({id:'status-group',name:'Status',shortcuts:[],widgets:[],expanded:false});
 const roundTrip=parseState(JSON.stringify(state)),saved=roundTrip.workspaces.find(item=>item.id===workspace.id).widgets.find(item=>item.id===note.id);
 assert.equal(saved.taskStatus,'in-progress');
 const legacy=structuredClone(state);for(const item of legacy.workspaces.flatMap(owner=>owner.widgets))delete item.taskStatus;
 assert.equal(parseState(JSON.stringify(legacy)).workspaces.find(item=>item.id===workspace.id).widgets.find(item=>item.id===note.id).taskStatus,null);
 const collected=collectWidgetIntoGroup(workspace,note.id,'status-group');
 const persisted=parseState(JSON.stringify({...state,workspaces:state.workspaces.map(item=>item.id===workspace.id?collected:item)})),entry=persisted.workspaces.find(item=>item.id===workspace.id).groups.find(item=>item.id==='status-group').widgets[0];
 assert.equal(entry.instance.taskStatus,'in-progress');
 const restored=restoreCollectedWidget(persisted.workspaces.find(item=>item.id===workspace.id),note.id,1000,700);
 assert.equal(restored.widgets.find(item=>item.id===note.id).taskStatus,'in-progress');
});

test('task status stays attached to a widget through minimize and restore',()=>{
 const widget=createWidget('notes');widget.taskStatus='done';
 const minimized=minimizeWidgetInstance(widget,1200,900);
 assert.equal(minimized.taskStatus,'done');
 assert.equal(restoreWidgetInstance(minimized,1200,900).taskStatus,'done');
});
