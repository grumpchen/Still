import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWidget,createInitialState,parseState,duplicateWorkspace,widgetTypes} from '../src/domain/workspaces.ts';
import {shortcut,reorderShortcuts} from '../src/domain/webShortcuts.ts';
import * as workspaces from '../src/domain/workspaces.ts';

test('custom groups are independent tray widgets with saved names, icons, links and order',()=>{
 assert.ok(widgetTypes.includes('group'));
 const group=createWidget('group');group.title='Engineering';
 const lecture=shortcut({name:'Lecture',url:'https://example.com/lecture',icon:'▶'});
 const formula=shortcut({name:'Formula sheet',url:'https://example.com/formula.pdf',icon:'∑'});
 group.shortcuts=reorderShortcuts([lecture,formula],formula.id,lecture.id);
 const state=createInitialState();state.workspaces[0].widgets.push(group);
 const restored=parseState(JSON.stringify(state));const saved=restored.workspaces[0].widgets.find(w=>w.id===group.id);
 assert.equal(saved.title,'Engineering');assert.deepEqual(saved.shortcuts.map(s=>s.name),['Formula sheet','Lecture']);assert.equal(saved.shortcuts[0].icon,'∑');
 const copy=duplicateWorkspace(restored.workspaces[0],'Copy');const cloned=copy.widgets.find(w=>w.type==='group');cloned.title='Different';cloned.shortcuts[0].url='https://example.com/changed';
 assert.equal(saved.title,'Engineering');assert.equal(saved.shortcuts[0].url,'https://example.com/formula.pdf');
 group.shortcuts=[];assert.deepEqual(parseState(JSON.stringify(state)).workspaces[0].widgets.find(w=>w.id===group.id).shortcuts,[]);
});

test('every group click creates a fresh named browser without changing existing browser tabs or geometry',()=>{
 assert.equal(typeof workspaces.createBrowserFromGroup,'function');
 const link=shortcut({name:'Formula sheet',url:'https://example.com/formula.pdf',icon:'∑'});
 const existing=[createWidget('browser')];const before=structuredClone(existing);
 const first=workspaces.createBrowserFromGroup(link,existing,{x:15,y:25});
 const second=workspaces.createBrowserFromGroup(link,[...existing,first],{x:15,y:25});
 assert.equal(first.type,'browser');assert.equal(first.title,'Formula sheet');assert.equal(first.url,link.url);
 assert.notEqual(first.id,existing[0].id);assert.notEqual(first.id,second.id);assert.equal(second.instanceNumber,3);
 assert.equal(first.placement.x,15);assert.equal(first.placement.y,25);assert.deepEqual(existing,before);
 assert.throws(()=>workspaces.createBrowserFromGroup({...link,url:'javascript:alert(1)'},existing));
});

test('older workspaces survive group support and invalid titles or URLs are normalized',()=>{
 const state=createInitialState();const group=createWidget('group');group.title={bad:true};group.shortcuts=[{name:'Unsafe',url:'javascript:alert(1)'},{name:'Valid',url:'example.com/guide',icon:'PDF'}];state.workspaces[0].widgets.push(group);
 const restored=parseState(JSON.stringify(state));const saved=restored.workspaces[0].widgets.find(w=>w.id===group.id);
 assert.equal(saved.title,'');assert.equal(saved.shortcuts.length,1);assert.equal(saved.shortcuts[0].url,'https://example.com/guide');
 assert.deepEqual(restored.workspaces[0].widgets[0].bookmarks,state.workspaces[0].widgets[0].bookmarks);
});
