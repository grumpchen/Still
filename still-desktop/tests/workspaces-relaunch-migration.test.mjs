import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialState,createWidget,createWorkspace,collectWidgetIntoGroup,restoreCollectedWidget,parseState} from '../src/domain/workspaces.ts';
import {setNoteText} from './fixtures.mjs';

test('new workspace state defaults relaunch to automatic with the built-in plugin enabled',()=>{
 const state=createInitialState();assert.equal(state.version,10);assert.equal(state.workspaces[0].role,'dashboard');assert.equal(state.workspaces[1].role,'library');assert.equal(state.widgetRelaunchMode,'automatic');assert.equal(state.widgetRelaunchPluginStatus,'enabled');assert.deepEqual(state.widgetRelaunchColors,{});
 assert.equal(state.passThroughTransparentBackground,false);assert.equal(state.enableWholeWindowClickThrough,false);
});

test('workspace parser accepts already decoded state for startup without parsing large saved profiles twice',()=>{
 const state=createInitialState(),study=state.workspaces.find(workspace=>workspace.role==='study');study.widgets=[createWidget('notes')];
 const decoded=JSON.parse(JSON.stringify(state));
 assert.deepEqual(parseState(decoded),parseState(JSON.stringify(state)));
});

test('click-through preferences migrate safely and persist independently',()=>{
 const state=createInitialState();const legacy={...state,version:5};delete legacy.passThroughTransparentBackground;delete legacy.enableWholeWindowClickThrough;
 const restored=parseState(JSON.stringify(legacy));assert.equal(restored.passThroughTransparentBackground,false);assert.equal(restored.enableWholeWindowClickThrough,false);
 state.passThroughTransparentBackground=true;state.enableWholeWindowClickThrough=true;
 const roundTrip=parseState(JSON.stringify(state));assert.equal(roundTrip.passThroughTransparentBackground,true);assert.equal(roundTrip.enableWholeWindowClickThrough,true);
});

test('loading older workspace state keeps cards in place and adds safe relaunch defaults',()=>{
 const state=createInitialState(),widget=createWidget('notes');widget.id='saved-note';setNoteText(widget,'Keep this');widget.placement={x:640,y:320,width:400,height:340};state.workspaces[0].widgets=[widget];
 const old={...state,version:4};delete old.widgetRelaunchMode;delete old.widgetRelaunchPluginStatus;delete old.widgetRelaunchColors;
 const restored=parseState(JSON.stringify(old));assert.equal(restored.version,10);assert.equal(restored.workspaces[0].role,'dashboard');assert.equal(restored.workspaces[1].role,'library');assert.equal(restored.widgetRelaunchMode,'automatic');assert.equal(restored.widgetRelaunchPluginStatus,'enabled');
 assert.equal(restored.workspaces[0].widgets[0].id,'saved-note');assert.equal(restored.workspaces[0].widgets[0].text,'Keep this');assert.deepEqual(restored.workspaces[0].widgets[0].placement,widget.placement);
});

test('version 5 settings migrate to the new optional action defaults without losing workspace data',()=>{
 const state=createInitialState(),study=state.workspaces.find(workspace=>workspace.role==='study'),widget=createWidget('notes');widget.id='legacy-note';setNoteText(widget,'Still saved');study.widgets=[widget];
 const old={...state,version:5};delete old.showAppAttachAction;delete old.showAppDetachAction;delete old.showAppSaveAction;delete old.screenshotPluginMode;delete old.screenshotPluginColors;
 const restored=parseState(JSON.stringify(old));assert.equal(restored.version,10);assert.equal(restored.workspaces[0].role,'dashboard');assert.equal(restored.workspaces[1].role,'library');assert.equal(restored.showAppAttachAction,false);assert.equal(restored.showAppDetachAction,false);assert.equal(restored.showAppSaveAction,false);assert.equal(restored.screenshotPluginMode,'global');assert.equal(restored.workspaces.find(workspace=>workspace.id===study.id).widgets[0].text,'Still saved');
});

test('widget and relaunch settings survive persistence',()=>{
 const state=createInitialState(),widget=createWidget('notes');widget.id='saved-note';widget.relaunchOverride='automatic';state.workspaces[0].widgets=[widget];state.widgetRelaunchMode='manual';state.widgetRelaunchColors={red:'automatic',blue:'manual'};
 const restored=parseState(JSON.stringify(state));assert.equal(restored.workspaces[0].widgets[0].relaunchOverride,'automatic');assert.equal(restored.widgetRelaunchMode,'manual');assert.deepEqual(restored.widgetRelaunchColors,{red:'automatic',blue:'manual'});
});

test('a collected widget keeps its individual relaunch choice when restored from a Group',()=>{
 const workspace=createWorkspace('Study',['notes']),widget=workspace.widgets[0];widget.id='collected-note';widget.relaunchOverride='manual';
 const collected=collectWidgetIntoGroup(workspace,widget.id),entry=collected.groups[0].widgets[0];assert.equal(entry.instance.relaunchOverride,'manual');
 const restored=restoreCollectedWidget(collected,widget.id);assert.equal(restored.widgets[0].id,'collected-note');assert.equal(restored.widgets[0].relaunchOverride,'manual');
});

test('removed Widget Relaunch keeps its preferences for re-enabling later',()=>{
 const state=createInitialState();state.widgetRelaunchPluginStatus='removed';state.widgetRelaunchMode='manual';state.widgetRelaunchColors={green:'automatic'};
 const restored=parseState(JSON.stringify(state));assert.equal(restored.widgetRelaunchPluginStatus,'removed');assert.equal(restored.widgetRelaunchMode,'manual');assert.deepEqual(restored.widgetRelaunchColors,{green:'automatic'});
});

test('removing the optional Tag Color Status card preserves independent relaunch settings',()=>{
 const state=createInitialState(),workspace=createWorkspace('Plugin test',[]),status=createWidget('tagStatus');status.id='status';state.workspaces=[workspace];state.activeId=workspace.id;workspace.widgets=[status];state.widgetRelaunchColors={red:'automatic',blue:'manual'};
 const afterRemovingCard={...state,workspaces:state.workspaces.map(workspace=>({...workspace,widgets:workspace.widgets.filter(widget=>widget.id!=='status')}))};
 const restored=parseState(JSON.stringify(afterRemovingCard));assert.equal(restored.workspaces.find(item=>item.id===workspace.id).widgets.length,0);assert.deepEqual(restored.widgetRelaunchColors,{red:'automatic',blue:'manual'});
});
