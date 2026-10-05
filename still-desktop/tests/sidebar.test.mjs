import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createInitialState,parseState} from '../src/domain/workspaces.ts';
test('sidebar collapse persists while older saved layouts retain workspaces and notes',()=>{
 const state=createInitialState();assert.equal(state.sidebarCollapsed,false);
 state.sidebarCollapsed=true;state.workspaces[0].widgets.find(w=>w.type==='notes').text='Keep these notes';
 const restored=parseState(JSON.stringify(state));assert.equal(restored.sidebarCollapsed,true);
 assert.equal(restored.workspaces[0].widgets.find(w=>w.type==='notes').text,'Keep these notes');
 delete state.sidebarCollapsed;assert.equal(parseState(JSON.stringify(state)).sidebarCollapsed,false);
 state.sidebarCollapsed='invalid';assert.equal(parseState(JSON.stringify(state)).sidebarCollapsed,false);
});
