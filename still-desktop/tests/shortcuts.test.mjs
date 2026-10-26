import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adjacentWorkspaceId, defaultShortcuts, shortcutAction, shortcutDirection, shortcutFromEvent, shortcutsError } from '../src/domain/shortcuts.ts';
import { createInitialState, createWorkspace, parseState } from '../src/domain/workspaces.ts';
import {setNoteText} from './fixtures.mjs';
const key=(key,modifiers={})=>({key,ctrlKey:false,altKey:false,shiftKey:false,metaKey:false,...modifiers});
test('Alt+W moves above, Alt+S below, and movement wraps through current sidebar order',()=>{
  const shortcuts=defaultShortcuts();const list=[{id:'one'},{id:'two'},{id:'custom'}];
  assert.equal(shortcutDirection(key('w',{altKey:true}),shortcuts),'up');
  assert.equal(shortcutDirection(key('s',{altKey:true}),shortcuts),'down');
  assert.equal(adjacentWorkspaceId(list,'two','up'),'one');
  assert.equal(adjacentWorkspaceId(list,'two','down'),'custom');
  assert.equal(adjacentWorkspaceId(list,'one','up'),'custom');
  assert.equal(adjacentWorkspaceId(list,'custom','down'),'one');
  assert.equal(adjacentWorkspaceId([{id:'one'}],'one','down'),'one');
  assert.equal(adjacentWorkspaceId([],'one','up'),'one');
  assert.equal(adjacentWorkspaceId(list.filter(w=>w.id!=='two'),'one','down'),'custom');
});
test('exact modifier matching preserves typing, IME composition, AltGr and other chords',()=>{
  const shortcuts=defaultShortcuts();
  for(const event of [key('w'),key('w',{altKey:true,shiftKey:true}),key('w',{ctrlKey:true,altKey:true}),key('w',{altKey:true,metaKey:true}),key('w',{altKey:true,isComposing:true}),key('w',{altKey:true,getModifierState:()=>true})])assert.equal(shortcutDirection(event,shortcuts),null);
  assert.equal(shortcutFromEvent(key('Control',{ctrlKey:true})),null);
  assert.equal(shortcutFromEvent(key('Shift',{shiftKey:true})),null);
});
test('custom bindings persist; older or invalid bindings migrate without losing workspaces or notes',()=>{
  const state=createInitialState();state.workspaces.push(createWorkspace('My custom space',['notes']));
  setNoteText(state.workspaces[0].widgets.find(w=>w.type==='notes'),'keep my lecture notes');
  state.shortcuts={...defaultShortcuts(),up:{key:'ArrowUp',ctrl:true,alt:false,shift:true},down:{key:'ArrowDown',ctrl:true,alt:false,shift:true},clickThrough:{key:'O',ctrl:true,alt:false,shift:true}};
  let restored=parseState(JSON.stringify(state));assert.deepEqual(restored.shortcuts,state.shortcuts);
  assert.equal(shortcutDirection(key('ArrowDown',{ctrlKey:true,shiftKey:true}),restored.shortcuts),'down');
  assert.equal(shortcutAction(key('o',{ctrlKey:true,shiftKey:true}),restored.shortcuts),'clickThrough');
  delete state.shortcuts;restored=parseState(JSON.stringify(state));assert.deepEqual(restored.shortcuts,defaultShortcuts());
  state.shortcuts={up:{key:'X',ctrl:false,alt:false,shift:false},down:{key:'S',ctrl:false,alt:true,shift:false}};
  restored=parseState(JSON.stringify(state));assert.deepEqual(restored.shortcuts,defaultShortcuts());
  assert.equal(restored.workspaces.length,5);assert.equal(restored.workspaces[0].widgets.find(w=>w.type==='notes').text,'keep my lecture notes');
});
test('right-click minimize modifier choices persist with the rest of keyboard shortcuts',()=>{
 const state=createInitialState();assert.deepEqual(state.shortcuts.minimizeModifiers,{ctrl:true,alt:false,shift:true});
 state.shortcuts.minimizeModifiers={ctrl:false,alt:true,shift:true};
 const restored=parseState(JSON.stringify(state));assert.deepEqual(restored.shortcuts.minimizeModifiers,state.shortcuts.minimizeModifiers);
});
test('duplicate and reserved shortcuts cannot be saved',()=>{
  const shortcuts=defaultShortcuts();assert.equal(shortcutsError(shortcuts),'');
  assert.match(shortcutsError({...shortcuts,down:shortcuts.up}),/different/);
  assert.match(shortcutsError({...shortcuts,down:{key:'W',ctrl:true,alt:false,shift:false}}),/reserved/);
  assert.match(shortcutsError({...shortcuts,down:{key:'ArrowLeft',ctrl:false,alt:true,shift:false}}),/browser navigation/);
  assert.match(shortcutsError({...shortcuts,down:{key:'F4',ctrl:false,alt:true,shift:false}}),/letter/);
});
test('Shift-only workspace bindings can be saved and survive reopening',()=>{
  const shifts={...defaultShortcuts(),up:{key:'W',ctrl:false,alt:false,shift:true},down:{key:'S',ctrl:false,alt:false,shift:true}};
  assert.equal(shortcutsError(shifts),'');
  const state=createInitialState();state.shortcuts=shifts;
  assert.deepEqual(parseState(JSON.stringify(state)).shortcuts,shifts);
});
test('Shift-only navigation preserves uppercase typing in editable fields',()=>{
  const shifts={...defaultShortcuts(),up:{key:'W',ctrl:false,alt:false,shift:true},down:{key:'S',ctrl:false,alt:false,shift:true}};
  assert.equal(shortcutDirection(key('S',{shiftKey:true}),shifts,true),null);
  assert.equal(shortcutDirection(key('S',{shiftKey:true}),shifts,false),'down');
});
test('all application shortcuts have unique editable defaults and dispatch to their actions',()=>{
 const shortcuts=defaultShortcuts();assert.equal(shortcutsError(shortcuts),'');
 assert.equal(shortcutAction(key('p',{ctrlKey:true,shiftKey:true}),shortcuts),'clickThrough');
 assert.equal(shortcutAction(key('m',{ctrlKey:true}),shortcuts),'overview');
 assert.equal(shortcutAction(key('k',{ctrlKey:true}),shortcuts),'commandPalette');
 assert.equal(shortcutAction(key('z',{ctrlKey:true}),shortcuts),'undo');
 assert.equal(shortcutAction(key('4',{ctrlKey:true}),shortcuts),'workspace:4');
 const changed={...shortcuts,clickThrough:{key:'O',ctrl:true,alt:false,shift:true}};
 assert.equal(shortcutAction(key('o',{ctrlKey:true,shiftKey:true}),changed),'clickThrough');
 assert.match(shortcutsError({...shortcuts,overview:shortcuts.commandPalette}),/different/);
});
test('repeated workspace navigation passes the third workspace and wraps in both directions',()=>{
 const list=[{id:'Study'},{id:'Design'},{id:'Daily'},{id:'Minimal'}];let active='Study';
 for(const expected of ['Design','Daily','Minimal','Study','Design','Daily','Minimal','Study']){active=adjacentWorkspaceId(list,active,'down');assert.equal(active,expected)}
 for(const expected of ['Minimal','Daily','Design','Study']){active=adjacentWorkspaceId(list,active,'up');assert.equal(active,expected)}
});
