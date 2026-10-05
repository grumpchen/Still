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
test('the shared sidebar toggle updater flips state and its label matches the visible next action',async()=>{
 const {toggleSidebarCollapsed,sidebarToggleLabel}=await import('../src/domain/workspaces.ts');
 // The header toggle button and the command-palette action both call this updater.
 assert.equal(toggleSidebarCollapsed(false),true);
 assert.equal(toggleSidebarCollapsed(true),false);
 assert.equal(sidebarToggleLabel(true),'Expand sidebar');
 assert.equal(sidebarToggleLabel(false),'Collapse sidebar');
});
test('collapsed sidebar badges are name-derived and matching initials gain the sidebar order number',async()=>{
 const {workspaceInitials,sidebarBadges}=await import('../src/domain/workspaces.ts');
 assert.equal(workspaceInitials('Chemistry Hub'),'CH');
 assert.equal(workspaceInitials('Study'),'ST');
 assert.equal(workspaceInitials('Design'),'DE');
 assert.equal(workspaceInitials(''),'WS');
 assert.deepEqual(sidebarBadges(['Chemistry Hub','Study','Chem Help']),['CH1','ST','CH3']);
 assert.deepEqual(sidebarBadges(['Daily','Design']),['DA','DE']);
});
