import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialState,createWidget,createWorkspace,collectWidgetIntoGroup,restoreCollectedWidget,parseState} from '../src/domain/workspaces.ts';

test('new workspace state defaults relaunch to automatic with the built-in plugin enabled',()=>{
 const state=createInitialState();assert.equal(state.version,5);assert.equal(state.widgetRelaunchMode,'automatic');assert.equal(state.widgetRelaunchPluginStatus,'enabled');assert.deepEqual(state.widgetRelaunchColors,{});
});

test('loading older workspace state keeps cards in place and adds safe relaunch defaults',()=>{
 const state=createInitialState(),widget=createWidget('notes');widget.id='saved-note';widget.text='Keep this';widget.placement={x:640,y:320,width:400,height:340};state.workspaces[0].widgets=[widget];
 const old={...state,version:4};delete old.widgetRelaunchMode;delete old.widgetRelaunchPluginStatus;delete old.widgetRelaunchColors;
 const restored=parseState(JSON.stringify(old));assert.equal(restored.version,5);assert.equal(restored.widgetRelaunchMode,'automatic');assert.equal(restored.widgetRelaunchPluginStatus,'enabled');
 assert.equal(restored.workspaces[0].widgets[0].id,'saved-note');assert.equal(restored.workspaces[0].widgets[0].text,'Keep this');assert.deepEqual(restored.workspaces[0].widgets[0].placement,widget.placement);
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
 const state=createInitialState(),status=createWidget('tagStatus');status.id='status';state.workspaces[0].widgets=[status];state.widgetRelaunchColors={red:'automatic',blue:'manual'};
 const afterRemovingCard={...state,workspaces:state.workspaces.map(workspace=>({...workspace,widgets:workspace.widgets.filter(widget=>widget.id!=='status')}))};
 const restored=parseState(JSON.stringify(afterRemovingCard));assert.equal(restored.workspaces[0].widgets.length,0);assert.deepEqual(restored.widgetRelaunchColors,{red:'automatic',blue:'manual'});
});
