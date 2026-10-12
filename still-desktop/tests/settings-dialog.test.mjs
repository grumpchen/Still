import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const general=readFileSync(new URL('../src/GeneralSettings.tsx',import.meta.url),'utf8');
const tagStatus=readFileSync(new URL('../src/TagColorStatusWidget.tsx',import.meta.url),'utf8');
const canvasStyles=readFileSync(new URL('../src/canvas.css',import.meta.url),'utf8');

test('sidebar Settings opens a tabbed dialog with General, Appearance, and Plugins pages',()=>{
 assert.match(app,/title="Settings" aria-label="Settings" onClick=\{\(\)=>\{setSettingsTab\('general'\);setModal\('settings'\)\}\}/);
 assert.match(app,/role="tablist" aria-label="Settings pages"[\s\S]*?General[\s\S]*?Appearance[\s\S]*?Plugins/);
 assert.match(app,/settingsTab==='appearance'[\s\S]*?<AppearanceSettings/);
 assert.match(app,/settingsTab==='general'&&<GeneralSettings/);
 assert.match(general,/<h3>General settings<\/h3>/);
 assert.match(app,/settingsTab==='plugins'[\s\S]*?Sidebar plugins/);
 assert.match(app,/Widget plugins[\s\S]*?Widget Relaunch/);
 assert.match(app,/Widget plugins[\s\S]*?Screenshot[\s\S]*?Screenshot plugin scope[\s\S]*?Apply globally[\s\S]*?Apply by tag color[\s\S]*?Closed/);
 assert.match(app,/state\.screenshotPluginMode===\"tag-colors\"[\s\S]*?screenshot-plugin-colors/);
 const sidebarPluginSettings=app.slice(app.indexOf('<h3>Sidebar plugins</h3>'),app.indexOf('<h3>Widget plugins</h3>'));
 assert.doesNotMatch(sidebarPluginSettings,/tag color|Apply by tag/);
 assert.doesNotMatch(tagStatus,/Screenshot plugin scope|Apply by tag color|screenshotPluginMode/);
 assert.match(app,/Disable Widget Relaunch plugin[\s\S]*?Remove Widget Relaunch plugin[\s\S]*?Enable Widget Relaunch plugin/);
 assert.match(general,/aria-label="Widget relaunch mode"/);
 assert.match(general,/Apply to All/);
 assert.match(general,/aria-label=\{color\+' tag relaunch mode'\}/);
});

test('all checkboxes are compact circles without checkmarks',()=>{
 assert.match(canvasStyles,/(^|})\s*input\[type=checkbox\]\{appearance:none;[^}]*width:14px!important;height:14px!important;[^}]*border-radius:50%/);
 assert.match(canvasStyles,/(^|})\s*input\[type=checkbox\]:checked\{background:var\(--accent\);border-color:var\(--accent\)\}/);
});
