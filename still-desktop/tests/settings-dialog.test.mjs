import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const general=readFileSync(new URL('../src/GeneralSettings.tsx',import.meta.url),'utf8');
const relaunchScope=readFileSync(new URL('../src/WidgetRelaunchScope.tsx',import.meta.url),'utf8');
const shortcuts=readFileSync(new URL('../src/ShortcutSettings.tsx',import.meta.url),'utf8');
const appearance=readFileSync(new URL('../src/AppearanceSettings.tsx',import.meta.url),'utf8');
const tagStatus=readFileSync(new URL('../src/TagColorStatusWidget.tsx',import.meta.url),'utf8');
const widgetPlugins=readFileSync(new URL('../src/WidgetPluginsSettings.tsx',import.meta.url),'utf8');
const widgetPluginCatalog=readFileSync(new URL('../src/domain/widgetPlugins.ts',import.meta.url),'utf8');
const canvasStyles=readFileSync(new URL('../src/canvas.css',import.meta.url),'utf8');

test('sidebar Settings opens a tabbed dialog with General, Appearance, and Plugins pages',()=>{
 assert.match(app,/title=\{translate\(state\.locale,'settings'\)\} aria-label=\{translate\(state\.locale,'settings'\)\} onClick=\{\(\)=>\{setSettingsTab\('general'\);setModal\('settings'\)\}\}/);
 assert.match(app,/className="settings-dialog"><div className="settings-tabs" role="tablist" aria-label=\{translate\(state\.locale,'settingsPages'\)\}/);
 for(const id of ['general','appearance','plugins'])assert.ok(app.includes("{id:'"+id+"',label:translate(state.locale,'"+id+"')"),id+' is a localized settings tab');
 assert.match(app,/settingsTab==='appearance'&&<section[^>]*role="tabpanel"[^>]*><AppearanceSettings/);
 assert.match(app,/settingsTab==='general'&&<GeneralSettings/);
 assert.match(app,/settingsTab==='plugins'&&<section[^>]*role="tabpanel"[^>]*><h3>\{translate\(state\.locale,'sidebarPlugins'\)\}/);
 assert.match(general,/t\('generalSettings'\)/);
 assert.doesNotMatch(general,/Toggle workspace map|Minimize a widget with right-click/);
 assert.match(shortcuts,/\['overview','workspaceMap','showHideMap'\]/);
 assert.match(shortcuts,/t\('rightClickMinimize'\)[\s\S]*?draft\.minimizeModifiers\[modifier\]/);
 assert.match(general,/t\('keyboardShortcuts'\)/);
 assert.match(general,/t\('workspacePerformance'\)/);
 assert.match(general,/canvasFrameRate[\s\S]*?setFrameRate|canvasFrameRate[\s\S]*?update\(\{canvasFrameRate/);
 assert.match(general,/className="shortcut-settings-link" onClick=\{openShortcuts\}/);
 assert.doesNotMatch(appearance,/shortcut-settings-link|Keyboard shortcuts/);
 assert.match(app,/settingsTab==='plugins'[\s\S]*?<WidgetPluginsSettings/);
 for(const [id,name] of [['color-tag','Color Tag'],['clock-timer','Clock Timer'],['screenshot','Screenshot'],['widget-relaunch','Widget Relaunch'],['lock','Lock']])assert.ok(widgetPluginCatalog.includes("id:'"+id+"',name:'"+name+"'"),name+' is registered');
 assert.match(widgetPlugins,/widgetPluginCatalog\.map\(plugin/,'registered widget plugins automatically get a settings section');
 assert.match(widgetPlugins,/plugin\.id==='lock'[\s\S]*?t\('lockHelp'\)/);
 for(const id of ['color-tag','clock-timer','screenshot','widget-relaunch'])assert.ok(widgetPlugins.includes("plugin.id==='"+id+"'"),id+' settings are handled');
 assert.match(widgetPlugins,/plugin\.id==='clock-timer'[\s\S]*?t\('applyByTag'\)[\s\S]*?t\('showClockFor'\)/);
 assert.match(widgetPlugins,/plugin\.id==='screenshot'[\s\S]*?t\('applyByTag'\)[\s\S]*?t\('showScreenshotFor'\)/);
 assert.match(widgetPlugins,/plugin\.id==='color-tag'[\s\S]*?t\('tagHelp'\)/);
 const sidebarPluginSettings=app.slice(app.indexOf("translate(state.locale,'sidebarPlugins')"),app.indexOf('<WidgetPluginsSettings'));
 assert.doesNotMatch(sidebarPluginSettings,/tag color|Apply by tag/);
 assert.doesNotMatch(tagStatus,/screenshotPluginMode/);
 assert.match(widgetPlugins,/t\('disable'\)[\s\S]*?t\('remove'\)[\s\S]*?t\('enable'\)/);
 assert.match(relaunchScope,/aria-label=\{t\('widgetRelaunch'\)\}/);
 assert.match(relaunchScope,/applyModeToAll&&<button/);
 assert.match(relaunchScope,/aria-label=\{t\('tagBehavior'\)/);
});

test('all checkboxes are compact circles without checkmarks',()=>{
 assert.match(canvasStyles,/(^|})\s*input\[type=checkbox\]\{appearance:none;[^}]*width:14px!important;height:14px!important;[^}]*border-radius:50%/);
 assert.match(canvasStyles,/(^|})\s*input\[type=checkbox\]:checked\{background:var\(--accent\);border-color:var\(--accent\)\}/);
});
