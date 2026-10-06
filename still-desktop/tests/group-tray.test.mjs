import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as workspaces from '../src/domain/workspaces.ts';
import {shortcut} from '../src/domain/webShortcuts.ts';

test('a saved group stays in the tray when its canvas instance is removed and can be reopened',()=>{
 const state=workspaces.createInitialState();
 state.workspaces[0].widgets.push({...workspaces.createWidget('group'),title:'CHEM111',shortcuts:[shortcut({name:'Lecture',url:'https://example.com/lecture'})]});
 let workspace=workspaces.parseState(JSON.stringify(state)).workspaces[0];
 assert.equal(workspace.groups?.length,1);
 const group=workspace.groups[0];assert.equal(group.name,'CHEM111');assert.equal(group.shortcuts[0].name,'Lecture');
 workspace={...workspace,widgets:workspace.widgets.filter(w=>w.type!=='group')};
 const saved=workspaces.parseState(JSON.stringify({...state,workspaces:[workspace],activeId:workspace.id})).workspaces[0];
 assert.equal(saved.groups.length,1);
 const first=workspaces.openSavedGroup(saved,group.id,{x:10,y:20});
 const second=workspaces.openSavedGroup(first,group.id,{x:30,y:40});
 const instances=second.widgets.filter(w=>w.type==='group');
 assert.equal(instances.length,2);assert.notEqual(instances[0].id,instances[1].id);
 assert.equal(instances[0].groupId,group.id);assert.equal(instances[1].groupId,group.id);
 assert.equal(instances[0].title,'CHEM111');assert.equal(second.groups.length,1);
});

test('group widget entries open fresh instances and keep their catalogue after reopening',()=>{
 const workspace=workspaces.createWorkspace('Chemistry',['group']);
 assert.equal(workspace.groups?.length,1);
 const entry=workspaces.groupWidgetEntry({type:'notes',name:'Lab notes',icon:'N'});
 const group={...workspace.groups[0],name:'CHEM111',expanded:true,widgets:[entry]};
 const saved=workspaces.parseState(JSON.stringify({...workspaces.createInitialState(),workspaces:[{...workspace,groups:[group]}],activeId:workspace.id})).workspaces[0];
 assert.equal(saved.groups[0].expanded,true);assert.equal(saved.groups[0].widgets[0].name,'Lab notes');
 const first=workspaces.createWidgetFromGroupEntry(entry,saved.widgets,{x:0,y:0});
 const second=workspaces.createWidgetFromGroupEntry(entry,[...saved.widgets,first],{x:30,y:40});
 assert.equal(first.type,'notes');assert.equal(first.title,'Lab notes');assert.notEqual(first.id,second.id);
 assert.equal(second.instanceNumber,2);assert.equal(second.placement.x,30);
 first.text='One instance';assert.notEqual(second.text,first.text);assert.equal(saved.groups[0].widgets.length,1);
 assert.throws(()=>workspaces.groupWidgetEntry({type:'unknown'}));
 assert.throws(()=>workspaces.groupWidgetEntry({type:'group'}));
});

test('saving an open widget creates or appends a reusable group entry without changing the source',()=>{
 const workspace=workspaces.createWorkspace('Chemistry',['notes','group']);
 const source=workspace.widgets.find(widget=>widget.type==='notes');source.title='Lab notes';source.text='Keep these notes';
 const created=workspaces.saveWidgetToGroup(workspace,source);
 assert.equal(created.groups.length,2);
 const newGroup=created.groups.at(-1);
 assert.equal(newGroup.expanded,true);assert.equal(newGroup.widgets.length,1);
 assert.deepEqual(newGroup.widgets[0],{id:newGroup.widgets[0].id,type:'notes',name:'Lab notes',icon:'LA'});
 assert.equal(created.widgets.find(widget=>widget.id===source.id).text,'Keep these notes');
 assert.deepEqual(workspace.groups.at(-1).widgets,[]);
 const calculator=workspaces.createWidget('desmos');
 const appended=workspaces.saveWidgetToGroup(created,calculator,newGroup.id);
 assert.equal(appended.groups.at(-1).widgets.length,2);
 assert.equal(appended.groups.at(-1).widgets[1].name,'Calculator');
 assert.equal(appended.widgets.find(widget=>widget.id===source.id).text,'Keep these notes');
 const restored=workspaces.parseState(JSON.stringify({...workspaces.createInitialState(),workspaces:[appended],activeId:appended.id}));
 assert.deepEqual(restored.workspaces[0].groups.at(-1).widgets.map(entry=>entry.type),['notes','desmos']);
 assert.throws(()=>workspaces.saveWidgetToGroup(appended,workspaces.createWidget('group')));
 assert.throws(()=>workspaces.saveWidgetToGroup(appended,source,'missing-group'));
});

test('renaming a group updates its instances and duplicate workspaces keep independent group libraries',()=>{
 const original=workspaces.createWorkspace('Chemistry',['group']);assert.equal(original.groups?.length,1);
 const id=original.groups[0].id;
 const renamed=workspaces.updateSavedGroup(original,id,{name:'CHEM111',expanded:true});
 assert.equal(renamed.widgets[0].title,'CHEM111');assert.equal(original.widgets[0].title,'');
 const copy=workspaces.duplicateWorkspace(renamed,'Copy');
 assert.notEqual(copy.groups[0].id,id);assert.equal(copy.widgets[0].groupId,copy.groups[0].id);
 copy.groups[0].name='Other';assert.equal(renamed.groups[0].name,'CHEM111');
 const state={...workspaces.createInitialState(),workspaces:[renamed,copy],activeId:renamed.id};
 const roundtrip=workspaces.parseState(JSON.stringify(state));assert.equal(roundtrip.workspaces[1].groups[0].name,'Other');
 assert.equal(roundtrip.workspaces[0].groups[0].name,'CHEM111');
});

test('invalid group entries are discarded while valid groups and old notes survive migration',()=>{
 const workspace=workspaces.createWorkspace('Chemistry',['notes','group']);assert.equal(workspace.groups?.length,1);
 workspace.widgets[0].text='Keep my notes';
 workspace.groups[0].widgets=[{id:'ok',type:'desmos',name:'Calculator',icon:'∑'},{id:'bad',type:'missing'},null];
 workspace.groups[0].shortcuts=[{id:'safe',name:'Course',url:'https://example.com/'},{id:'bad-url',name:'Unsafe',url:'javascript:alert(1)'}];
 const state={...workspaces.createInitialState(),workspaces:[workspace],activeId:workspace.id};
 const saved=workspaces.parseState(JSON.stringify(state)).workspaces[0];
 assert.deepEqual(saved.groups[0].widgets.map(w=>w.type),['desmos']);assert.equal(saved.groups[0].shortcuts.length,1);
 assert.equal(saved.widgets[0].text,'Keep my notes');
});
