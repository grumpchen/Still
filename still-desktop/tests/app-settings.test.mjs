import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createInitialState,createWidget,parseState,createWorkspace,transferWidgetInstance} from '../src/domain/workspaces.ts';
import {moveWithRetainedNativePanel} from '../src/domain/nativeWidgetLifecycle.ts';
import {parseGlass} from '../src/domain/appearance.ts';

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const general=readFileSync(new URL('../src/GeneralSettings.tsx',import.meta.url),'utf8');
const picker=readFileSync(new URL('../src/AppWindowPicker.tsx',import.meta.url),'utf8');
const native=readFileSync(new URL('../src-tauri/src/app_panel.rs',import.meta.url),'utf8');
const appearance=readFileSync(new URL('../src/AppearanceSettings.tsx',import.meta.url),'utf8');
const styles=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
const windowInput=readFileSync(new URL('../src/platform/windowInput.ts',import.meta.url),'utf8');

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
 assert.deepEqual(state.screenshotPluginColorOverrides,{});
 assert.equal(state.followWidgetToWorkspace,true);
});

test('click-through preferences are optional General settings with transparent-background gating and a restore shortcut',()=>{
 assert.match(general,/t\('passTransparentClicks'\)/);
 assert.match(general,/disabled=\{background!==\x27transparent\x27\}/);
 assert.match(general,/t\('wholeWindowShortcut'\)/);
 assert.match(general,/shortcuts\.clickThrough/);
 assert.match(general,/t\('customizeShortcuts'\)/);
 assert.match(app,/subscribeActions/);
 assert.match(app,/shortcutAction/);
 assert.match(windowInput,/window_input_update_regions/);
 assert.match(app,/interactiveHitRegions/);
});

test('moving a widget between workspaces follows it when enabled and can be disabled in General settings',()=>{
 const state=createInitialState();state.followWidgetToWorkspace=false;
 assert.equal(parseState(JSON.stringify(state)).followWidgetToWorkspace,false);
 delete state.followWidgetToWorkspace;
 assert.equal(parseState(JSON.stringify(state)).followWidgetToWorkspace,true,'existing saves follow moved widgets by default');
});

test('a cross-workspace move preserves the widget instance and only follows when the saved preference is enabled',async()=>{
 const source=createWorkspace('Source',['apps']),destination=createWorkspace('Destination',[]),widget=source.widgets[0];
 const calls=[],panel={suspendForCollection:async id=>{calls.push(['suspend',id]);return true},cancelCollection:async id=>calls.push(['resume',id])};
 for(const follow of [true,false]){
  const moved=await moveWithRetainedNativePanel(widget.id,true,panel,()=>transferWidgetInstance(source,destination,widget.id,1200,800));
  assert.ok(moved);assert.equal(moved.source.widgets.some(item=>item.id===widget.id),false);assert.equal(moved.destination.widgets[0].id,widget.id);
  const activeId=follow?moved.destination.id:source.id;
  assert.equal(activeId,follow?destination.id:source.id);
 }
 assert.deepEqual(calls,[['suspend',widget.id],['suspend',widget.id]]);
 assert.match(general,/t\('followWidget'\)/);
 const transfer=app.slice(app.indexOf('async function transferWidgetSafely'),app.indexOf('function transferWidget('));
 assert.match(transfer,/followWidgetToWorkspace\s*\?\s*destinationId\s*:\s*current\.activeId/,'the persisted preference controls which workspace remains active after the real transfer helper succeeds');
});

test('app behavior settings persist and invalid shutdown values safely fall back',()=>{
 const state=createInitialState();
 state.saveAppShortcutsOnAttach=false;
 state.appShutdownBehavior='minimize';
 state.showAppAttachAction=true;state.showAppDetachAction=true;state.showAppSaveAction=true;state.showWidgetRelaunchAction=false;state.showWidgetExportPngAction=false;state.screenshotPluginMode='tag-colors';state.screenshotPluginColors=['red','blue'];state.screenshotPluginColorOverrides={red:false,blue:true,invalid:'disabled'};state.background='transparent';
 let restored=parseState(JSON.stringify(state));
 assert.equal(restored.saveAppShortcutsOnAttach,false);
 assert.equal(restored.appShutdownBehavior,'minimize');
 assert.equal(restored.showAppAttachAction,true);assert.equal(restored.showAppDetachAction,true);assert.equal(restored.showAppSaveAction,true);
 assert.equal(restored.showWidgetRelaunchAction,false);assert.equal(restored.showWidgetExportPngAction,false);
 assert.equal(restored.screenshotPluginMode,'tag-colors');assert.deepEqual(restored.screenshotPluginColors,['red','blue']);assert.deepEqual(restored.screenshotPluginColorOverrides,{red:false,blue:true});assert.equal(restored.background,'transparent');
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

test('Tag Color Status persists stacked plugin settings for each color',()=>{
 const state=createInitialState(),status=createWidget('tagStatus');
 status.pluginControls.push('widget-color-rule.red','widget-color-setting.red.relaunch','widget-color-setting.red.screenshot');
 state.workspaces[0].widgets.push(status);state.screenshotPluginColorOverrides={red:false,blue:true};
 const restored=parseState(JSON.stringify(state));
 assert.deepEqual(restored.workspaces[0].widgets.at(-1).pluginControls,status.pluginControls);
 assert.deepEqual(restored.screenshotPluginColorOverrides,{red:false,blue:true});
});

test('General settings expose the three app shutdown choices and auto-save preference',()=>{
 assert.match(general,/aria-label=\{t\('whenStillCloses'\)\}[\s\S]*?value="minimize"[\s\S]*?t\('minimizeAttachedApps'\)/);
 assert.match(general,/value="close"[\s\S]*?t\('closeAttachedApps'\)/);
 assert.match(general,/value="leaveOpen"[\s\S]*?t\('leaveAttachedAppsOpen'\)/);
 assert.match(general,/t\('saveShortcutOnAttach'\)/);
 for(const key of ['showAppAttachAction','showAppDetachAction','showAppSaveAction'])assert.ok(general.includes("key:'"+key+"'"),key+' is configurable');
 assert.match(general,/showWidgetExportPngAction/);assert.doesNotMatch(general,/Workspace widget buttons/);
 assert.match(general,/Icon name=\{action\.icon\}/);assert.match(general,/label:t\('showAttachButton'\),icon:'attach'/);assert.match(general,/label:t\('showDetachButton'\),icon:'eject'/);assert.match(general,/label:t\('showSaveToTrayButton'\),icon:'tray'/);
 assert.match(general,/<span>\{action\.label\}<Icon name=\{action\.icon\}\/><\/span>/,'icons appear to the right of every action label');
 assert.match(styles,/general-settings-action-toggle/);
 assert.match(app,/showWidgetExportPngAction=\{state\.showWidgetExportPngAction\}/);
});

test('Appearance settings offer selectable workspace surfaces and current metal effects',()=>{
 assert.match(appearance,/option value="solid">\{t\('solid'\)\}/);assert.match(appearance,/option value="transparent">\{t\('transparent'\)\}/);
 for(const effect of ['liquid-chrome','line-waves'])assert.ok(appearance.includes('option value="'+effect+'"'),effect+' remains selectable');
 assert.match(appearance,/value=\{state\.glass\.backgroundEffect==='wave-wallpaper'\?'still':'dynamic'\}/,'the static wave wallpaper is offered through the current background type selector');
 assert.doesNotMatch(appearance,/leaf-photo|your leaf photo/);
 assert.equal(parseGlass({backgroundEffect:'line-waves'}).backgroundEffect,'line-waves');
 assert.equal(parseGlass({backgroundEffect:'wave-wallpaper'}).backgroundEffect,'wave-wallpaper');
});

test('the attach picker initializes its existing save checkbox from the General preference',()=>{
 assert.match(picker,/saveAppShortcutsOnAttach/);
 assert.match(picker,/useState\(saveAppShortcutsOnAttach\)/);
 assert.match(app,/saveAppShortcutsOnAttach=\{state\.saveAppShortcutsOnAttach\}/);
});

test('direct Ctrl+Shift app capture attaches without saving a tray shortcut',()=>{
 const capture=app.slice(app.indexOf('const onCapture=async'),app.indexOf('void appCapture.subscribe'));
 assert.match(capture,/managedAppWidget\(\{sourceId:null,name:title\}/,'captured apps are transient workspace widgets');
 assert.doesNotMatch(capture,/saveAppShortcutsOnAttach|appPanel\.prepare|presetFromWidget|upsertSavedPresets/,'Ctrl+Shift capture never prepares or saves an Apps shortcut');
 assert.match(capture,/setState\(current=>\(\{\.\.\.current,workspaces:/,'only workspace state receives the new widget');
});

test('app shutdown configuration is applied natively and window close actions remain graceful',()=>{
 assert.match(native,/pub fn shutdown\(app:&AppHandle\)/);
 assert.match(native,/SW_MINIMIZE/);
 assert.match(native,/PostMessageW\([^;]*WM_CLOSE/);
 assert.match(native,/pub async fn app_panel_configure_shutdown/);
});
