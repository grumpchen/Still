import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWidget,createInitialState,parseState,workspaceHasFinishedTimer,createWidgetFromPreset} from '../src/domain/workspaces.ts';
import {presetFromWidget} from '../src/domain/presets.ts';

test('workspace status turns red only after a Focus or Clock add-on timer has finished',()=>{
 const workspace=createInitialState().workspaces[0];
 const focus=createWidget('focus');
 workspace.widgets=[focus];
 assert.equal(workspaceHasFinishedTimer(workspace,10_000),false);

 focus.end=20_000;
 focus.remaining=15;
 assert.equal(workspaceHasFinishedTimer(workspace,19_999),false);
 assert.equal(workspaceHasFinishedTimer(workspace,20_000),true);

 focus.end=null;
 focus.remaining=0;
 assert.equal(workspaceHasFinishedTimer(workspace,20_001),true);
});

test('Clock add-on timer state survives workspace persistence',()=>{
 const state=createInitialState(),clock=createWidget('notes');clock.clockPluginEnabled=true;
 clock.remaining=3660;
 state.workspaces[0].widgets.push(clock);

 const loaded=parseState(JSON.stringify(state));
 const saved=loaded.workspaces[0].widgets.find(widget=>widget.id===clock.id);
 assert.equal(saved.type,'notes');
 assert.equal(saved.clockPluginEnabled,true);
 assert.equal(saved.remaining,3660);
 assert.equal(workspaceHasFinishedTimer(loaded.workspaces[0],0),false);
 saved.end=20_000;saved.remaining=1;
 assert.equal(workspaceHasFinishedTimer(loaded.workspaces[0],19_999),false);
 assert.equal(workspaceHasFinishedTimer(loaded.workspaces[0],20_000),true);
 saved.end=null;
 saved.remaining=0;
 assert.equal(workspaceHasFinishedTimer(loaded.workspaces[0],0),true);
});

test('Clock add-on and timer duration are preserved by a saved tray shortcut',()=>{
 const clock=createWidget('notes');clock.clockPluginEnabled=true;clock.remaining=5400;
 const preset=presetFromWidget(clock);
 assert.deepEqual({type:preset.type,remaining:preset.remaining,clockPluginEnabled:preset.clockPluginEnabled},{type:'notes',remaining:5400,clockPluginEnabled:true});
 const restored=createWidgetFromPreset(preset,[]);
 assert.equal(restored.clockPluginEnabled,true);
 assert.equal(restored.remaining,5400);
});

test('completed-timer status ignores non-timer widgets without the Clock add-on',()=>{
 const workspace=createInitialState().workspaces[0];
 workspace.widgets=[createWidget('notes')];workspace.widgets[0].remaining=0;
 assert.equal(workspaceHasFinishedTimer(workspace,1_000_000),false);
});
