import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createInitialState,parseState} from '../src/domain/workspaces.ts';

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const general=readFileSync(new URL('../src/GeneralSettings.tsx',import.meta.url),'utf8');
const picker=readFileSync(new URL('../src/AppWindowPicker.tsx',import.meta.url),'utf8');
const native=readFileSync(new URL('../src-tauri/src/app_panel.rs',import.meta.url),'utf8');

test('app behavior settings default to automatic shortcut saving and preserve the existing leave-open shutdown behavior',()=>{
 const state=createInitialState();
 assert.equal(state.saveAppShortcutsOnAttach,true);
 assert.equal(state.appShutdownBehavior,'leaveOpen');
});

test('app behavior settings persist and invalid shutdown values safely fall back',()=>{
 const state=createInitialState();
 state.saveAppShortcutsOnAttach=false;
 state.appShutdownBehavior='minimize';
 let restored=parseState(JSON.stringify(state));
 assert.equal(restored.saveAppShortcutsOnAttach,false);
 assert.equal(restored.appShutdownBehavior,'minimize');
 state.appShutdownBehavior='invalid';
 restored=parseState(JSON.stringify(state));
 assert.equal(restored.appShutdownBehavior,'leaveOpen');
 delete state.saveAppShortcutsOnAttach;
 assert.equal(parseState(JSON.stringify(state)).saveAppShortcutsOnAttach,true);
});

test('General settings expose the three app shutdown choices and auto-save preference',()=>{
 assert.match(general,/aria-label="When Still closes"[\s\S]*?value="minimize"[\s\S]*?Minimize attached apps/);
 assert.match(general,/value="close"[\s\S]*?Close attached app windows/);
 assert.match(general,/value="leaveOpen"[\s\S]*?Leave attached apps open/);
 assert.match(general,/Save an Apps shortcut automatically when attaching/);
});

test('the attach picker initializes its existing save checkbox from the General preference',()=>{
 assert.match(picker,/saveAppShortcutsOnAttach/);
 assert.match(picker,/useState\(saveAppShortcutsOnAttach\)/);
 assert.match(app,/saveAppShortcutsOnAttach=\{state\.saveAppShortcutsOnAttach\}/);
});

test('direct Ctrl+Shift app capture also prepares and saves a shortcut when enabled',()=>{
 assert.match(app,/if\(snapshot\.saveAppShortcutsOnAttach\)\{try\{source=await appPanel\.prepare\(\{hwnd:result\.hwnd,pid:result\.pid\}\)/);
 assert.match(app,/const preset=source\?\.sourceId\?presetFromWidget\(widget\):null/);
});

test('app shutdown configuration is applied natively and window close actions remain graceful',()=>{
 assert.match(native,/pub fn shutdown\(app:&AppHandle\)/);
 assert.match(native,/SW_MINIMIZE/);
 assert.match(native,/PostMessageW\([^;]*WM_CLOSE/);
 assert.match(native,/pub async fn app_panel_configure_shutdown/);
});
