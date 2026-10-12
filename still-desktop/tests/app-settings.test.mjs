import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createInitialState,parseState} from '../src/domain/workspaces.ts';
import {backgroundSettingsUpdate,backgroundSettingsValue} from '../src/domain/appearance.ts';

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const general=readFileSync(new URL('../src/GeneralSettings.tsx',import.meta.url),'utf8');
const picker=readFileSync(new URL('../src/AppWindowPicker.tsx',import.meta.url),'utf8');
const native=readFileSync(new URL('../src-tauri/src/app_panel.rs',import.meta.url),'utf8');
const appearance=readFileSync(new URL('../src/AppearanceSettings.tsx',import.meta.url),'utf8');
const styles=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');

test('app behavior settings default to automatic shortcut saving and preserve the existing leave-open shutdown behavior',()=>{
 const state=createInitialState();
 assert.equal(state.saveAppShortcutsOnAttach,true);
 assert.equal(state.appShutdownBehavior,'leaveOpen');
 assert.equal(state.showAppAttachAction,false);
 assert.equal(state.showAppDetachAction,false);
 assert.equal(state.showAppSaveAction,false);
 assert.equal(state.showWidgetRelaunchAction,true);
 assert.equal(state.showWidgetExportPngAction,true);
 assert.equal(state.screenshotPluginMode,'global');
 assert.deepEqual(state.screenshotPluginColors,[]);
});

test('app behavior settings persist and invalid shutdown values safely fall back',()=>{
 const state=createInitialState();
 state.saveAppShortcutsOnAttach=false;
 state.appShutdownBehavior='minimize';
 state.showAppAttachAction=true;state.showAppDetachAction=true;state.showAppSaveAction=true;state.showWidgetRelaunchAction=false;state.showWidgetExportPngAction=false;state.screenshotPluginMode='tag-colors';state.screenshotPluginColors=['red','blue'];state.background='transparent';
 let restored=parseState(JSON.stringify(state));
 assert.equal(restored.saveAppShortcutsOnAttach,false);
 assert.equal(restored.appShutdownBehavior,'minimize');
 assert.equal(restored.showAppAttachAction,true);assert.equal(restored.showAppDetachAction,true);assert.equal(restored.showAppSaveAction,true);
 assert.equal(restored.showWidgetRelaunchAction,false);assert.equal(restored.showWidgetExportPngAction,false);
 assert.equal(restored.screenshotPluginMode,'tag-colors');assert.deepEqual(restored.screenshotPluginColors,['red','blue']);assert.equal(restored.background,'transparent');
 state.screenshotPluginMode='invalid';state.screenshotPluginColors=['invalid','red','red'];restored=parseState(JSON.stringify(state));
 assert.equal(restored.screenshotPluginMode,'global');assert.deepEqual(restored.screenshotPluginColors,['red']);
 state.appShutdownBehavior='invalid';
 restored=parseState(JSON.stringify(state));
 assert.equal(restored.appShutdownBehavior,'leaveOpen');
 delete state.saveAppShortcutsOnAttach;
 assert.equal(parseState(JSON.stringify(state)).saveAppShortcutsOnAttach,true);
 delete state.showWidgetRelaunchAction;delete state.showWidgetExportPngAction;
 restored=parseState(JSON.stringify(state));
 assert.equal(restored.showWidgetRelaunchAction,true);assert.equal(restored.showWidgetExportPngAction,true,'older saved layouts keep the existing buttons visible');
});

test('General settings expose the three app shutdown choices and auto-save preference',()=>{
 assert.match(general,/aria-label="When Still closes"[\s\S]*?value="minimize"[\s\S]*?Minimize attached apps/);
 assert.match(general,/value="close"[\s\S]*?Close attached app windows/);
 assert.match(general,/value="leaveOpen"[\s\S]*?Leave attached apps open/);
 assert.match(general,/Save an Apps shortcut automatically when attaching/);
 for(const action of ['Attach','Detach','Save to tray'])assert.match(general,new RegExp('Show '+action+' button'));
 assert.match(general,/Show Relaunch button/);assert.match(general,/Show Export PNG button/);assert.doesNotMatch(general,/Workspace widget buttons/);
 assert.match(general,/Icon name=\{action\.icon\}/);assert.match(general,/showAppAttachAction',label:'Show Attach button',icon:'attach'/);assert.match(general,/showAppDetachAction',label:'Show Detach button',icon:'eject'/);assert.match(general,/showAppSaveAction',label:'Show Save to tray button',icon:'tray'/);
 assert.match(general,/<span>\{action\.label\}<Icon name=\{action\.icon\}\/><\/span>/,'icons appear to the right of every action label');
 assert.match(styles,/general-settings-action-toggle input\[type=checkbox\]\{appearance:none;[^}]*width:15px;height:15px;[^}]*border-radius:50%/);assert.match(styles,/general-settings-action-toggle input\[type=checkbox\]:checked\{background:var\(--accent\);border-color:var\(--accent\)\}/,'all five action toggles use a smaller filled circle with no checkmark');
 assert.match(app,/showWidgetRelaunchAction=\{state\.showWidgetRelaunchAction\}/);assert.match(app,/showWidgetExportPngAction=\{state\.showWidgetExportPngAction\}/);
});

test('Appearance settings offer transparent and solid backgrounds and the existing leaf-photo glass material',()=>{
 assert.match(appearance,/option value="solid">Solid/);assert.match(appearance,/option value="transparent">Transparent/);
 assert.match(appearance,/Liquid Glass · your leaf photo/);
 assert.match(appearance,/option value="leaf-photo">Leaf photo · Liquid Glass/);
 assert.deepEqual(backgroundSettingsUpdate('transparent'),{background:'transparent'},'changing background preserves the current appearance');
 assert.equal(backgroundSettingsValue('liquid-glass','transparent'),'transparent','transparent remains selectable while Liquid Glass is active');
 assert.deepEqual(backgroundSettingsUpdate('leaf-photo'),{appearance:'liquid-glass',background:'solid'});
 assert.match(styles,/body\.liquid-glass\.transparent-background::before[\s\S]*?display:\s*none/,'transparent Liquid Glass must hide its fixed leaf wallpaper layer');
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
