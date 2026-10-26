import {test} from 'node:test';
import assert from 'node:assert/strict';
import {trayDropDecision} from '../src/domain/trayDrop.ts';
import {createInitialState,createWidget,parseState} from '../src/domain/workspaces.ts';
import {presetFromWidget} from '../src/domain/presets.ts';
import {setNoteText} from './fixtures.mjs';

test('Saved +, Group and Trash are mutually exclusive; blank space never deletes',()=>{
 const source={source:'widget',widgetType:'notes',insideTray:true};
 assert.equal(trayDropDecision({...source,savedTarget:true}),'save');
 assert.equal(trayDropDecision({...source,trashTarget:true}),'remove');
 assert.equal(trayDropDecision({...source,groupTarget:{kind:'existing',groupId:'course'}}),'save-group');
 assert.equal(trayDropDecision({...source,groupTarget:{kind:'create'}}),'create-group');
 assert.equal(trayDropDecision(source),'none');
 assert.equal(trayDropDecision({...source,trashTarget:true,insideTray:false}),'none');
 assert.equal(trayDropDecision({...source,targetType:'notes'}),'none');
 for(const type of ['browser','apps','files','group'])assert.equal(trayDropDecision({...source,widgetType:type,trashTarget:true}),'remove');
 for(const source of ['file','app','website'])assert.equal(trayDropDecision({source,insideTray:true,trashTarget:true}),'none');
});

test('Saved copies deduplicate, persist supported state and leave original placement/content intact',async()=>{
 const {upsertSavedPresets}=await import('../src/domain/trayActions.ts');
 const state=createInitialState(),note=state.workspaces[0].widgets.find(w=>w.type==='notes');
 note.title='math120';setNoteText(note,'Formula');const original=structuredClone(note);
 state.presets=upsertSavedPresets([], [presetFromWidget(note),presetFromWidget(note)]);
 assert.equal(state.presets.length,1);assert.deepEqual(note,original);
 const restored=parseState(JSON.stringify(state));assert.equal(restored.presets[0].text,'Formula');
 const id=state.presets[0].id;setNoteText(note,'Updated');
 state.presets=upsertSavedPresets(state.presets,[presetFromWidget(note)]);
 assert.equal(state.presets.length,2);assert.equal(state.presets[0].id,id);assert.equal(state.presets[0].text,'Formula');
 assert.equal(state.presets[1].text,'Updated');assert.equal(state.presets[1].name,'math120 2');
 state.presets=upsertSavedPresets(state.presets,[{...state.presets[0],name:'Edited name'}]);
 assert.equal(state.presets.length,2);assert.equal(state.presets[0].name,'Edited name');
});

test('exact canvas deletion retains other placements and Group contents through restart',async()=>{
 const {deleteCanvasWidget}=await import('../src/domain/trayActions.ts');
 const state=createInitialState(),workspace=state.workspaces[0],group=createWidget('group'),collected=createWidget('notes');
 group.groupId='course';workspace.widgets.push(group);
 workspace.groups=[{id:'course',name:'Course',expanded:false,shortcuts:[],widgets:[{id:collected.id,type:'notes',name:'Note',icon:'',kind:'collected',instance:collected}]}];
 const remaining=structuredClone(workspace.widgets.filter(w=>w.id!==group.id));
 const deleted=deleteCanvasWidget(state,workspace.id,group.id);
 assert.deepEqual(deleted.workspaces[0].widgets,remaining);
 const reopened=parseState(JSON.stringify(deleted));assert.ok(!reopened.workspaces[0].widgets.some(w=>w.id===group.id));
 assert.equal(reopened.workspaces[0].groups[0].widgets[0].instance.id,collected.id);
 assert.equal(deleteCanvasWidget(state,'missing',group.id),state);
});

test('saved Apps cannot create a second native launch if source is open or collected',async()=>{
 const {savedAppInUse}=await import('../src/domain/trayActions.ts');
 const state=createInitialState(),app=createWidget('apps');app.appKey='selected-app';app.appPanelOpen=true;
 const preset={id:'saved-app',type:'apps',name:'App',appSourceId:'selected-app',appName:'App.exe'};
 state.workspaces[0].widgets.push(app);assert.equal(savedAppInUse(state,preset),true);
 state.workspaces[0].widgets.pop();state.workspaces[0].groups=[{id:'course',name:'Course',expanded:false,shortcuts:[],widgets:[{id:app.id,type:'apps',name:'App',icon:'',kind:'collected',instance:app}]}];
 assert.equal(savedAppInUse(state,preset),true);assert.equal(savedAppInUse(state,{...preset,appSourceId:'other-app'}),false);
 app.appPanelOpen=false;assert.equal(savedAppInUse(state,preset),false);
 app.appKey=null;assert.throws(()=>presetFromWidget(app),/shortcut/);
});
