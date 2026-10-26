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
 assert.match(app,/title="Settings" aria-label="Settings" onClick=\{\(\)=>\{setSettingsTab\('general'\);setModal\('settings'\)\}\}/);
 assert.match(app,/role="tablist" aria-label="Settings pages"[\s\S]*?General[\s\S]*?Appearance[\s\S]*?Plugins/);
 assert.match(app,/settingsTab==='appearance'[\s\S]*?<AppearanceSettings/);
 assert.match(app,/settingsTab==='general'&&<GeneralSettings/);
 assert.match(general,/<h3>General settings<\/h3>/);
 assert.doesNotMatch(general,/Toggle workspace map|Minimize a widget with right-click/);
 assert.match(shortcuts,/\['overview','Toggle workspace map','Show or hide the map'\]/);
 assert.match(shortcuts,/Minimize a widget with right-click[\s\S]*?draft\.minimizeModifiers\[modifier\][\s\S]*?setDraft\(value=>\(\{\.\.\.value,minimizeModifiers:/);
 assert.match(general,/Customize keyboard shortcuts/);
 assert.match(general,/Workspace performance[\s\S]*?Widget drag and resize rate[\s\S]*?30 FPS[\s\S]*?60 FPS[\s\S]*?Display refresh/);
 assert.match(general,/className="shortcut-settings-link" onClick=\{openShortcuts\}/);
 assert.doesNotMatch(appearance,/shortcut-settings-link|Keyboard shortcuts/);
 assert.match(app,/settingsTab==='plugins'[\s\S]*?Sidebar plugins[\s\S]*?<WidgetPluginsSettings/);
 for(const [id,name] of [['color-tag','Color Tag'],['clock-timer','Clock Timer'],['screenshot','Screenshot'],['widget-relaunch','Widget Relaunch'],['lock','Lock']])assert.ok(widgetPluginCatalog.includes("id:'"+id+"',name:'"+name+"'"),name+' is registered');
 assert.match(widgetPlugins,/widgetPluginCatalog\.map\(plugin/,'registered widget plugins automatically get a settings section');
 assert.match(widgetPlugins,/plugin\.id==='lock'[\s\S]*?Add Lock from a widget’s \+ menu/);
 for(const id of ['color-tag','clock-timer','screenshot','widget-relaunch'])assert.ok(widgetPlugins.includes("plugin.id==='"+id+"'"),id+' settings are handled');
 assert.match(widgetPlugins,/Clock plugin scope[\s\S]*?Apply by tag color[\s\S]*?Closed/);
 assert.match(widgetPlugins,/Screenshot plugin scope[\s\S]*?Apply by tag color[\s\S]*?Closed/);
 assert.match(widgetPlugins,/Add a color tag with a widget’s \+ button[\s\S]*?click its tag dot/);
 const sidebarPluginSettings=app.slice(app.indexOf('<h3>Sidebar plugins</h3>'),app.indexOf('<WidgetPluginsSettings'));
 assert.doesNotMatch(sidebarPluginSettings,/tag color|Apply by tag/);
 assert.doesNotMatch(tagStatus,/Screenshot plugin scope|Apply by tag color|screenshotPluginMode/);
 assert.match(widgetPlugins,/Disable Widget Relaunch plugin[\s\S]*?Remove Widget Relaunch plugin[\s\S]*?Enable Widget Relaunch plugin/);
 assert.match(relaunchScope,/aria-label="Widget relaunch mode"/);
 assert.match(relaunchScope,/Apply to All/);
 assert.match(relaunchScope,/aria-label=\{color\+' tag relaunch mode'\}/);
});

test('all checkboxes are compact circles without checkmarks',()=>{
 assert.match(canvasStyles,/(^|})\s*input\[type=checkbox\]\{appearance:none;[^}]*width:14px!important;height:14px!important;[^}]*border-radius:50%/);
 assert.match(canvasStyles,/(^|})\s*input\[type=checkbox\]:checked\{background:var\(--accent\);border-color:var\(--accent\)\}/);
});
