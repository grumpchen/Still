import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const general=readFileSync(new URL('../src/GeneralSettings.tsx',import.meta.url),'utf8');

test('sidebar Settings opens a tabbed dialog with General, Appearance, and Plugins pages',()=>{
 assert.match(app,/title="Settings" aria-label="Settings" onClick=\{\(\)=>\{setSettingsTab\('general'\);setModal\('settings'\)\}\}/);
 assert.match(app,/role="tablist" aria-label="Settings pages"[\s\S]*?General[\s\S]*?Appearance[\s\S]*?Plugins/);
 assert.match(app,/settingsTab==='appearance'[\s\S]*?<AppearanceSettings/);
 assert.match(app,/settingsTab==='general'&&<GeneralSettings/);
 assert.match(general,/<h3>General settings<\/h3>/);
 assert.match(app,/settingsTab==='plugins'[\s\S]*?Sidebar plugins/);
 assert.match(app,/Widget plugins[\s\S]*?Widget Relaunch/);
 assert.match(app,/Disable Widget Relaunch plugin[\s\S]*?Remove Widget Relaunch plugin[\s\S]*?Enable Widget Relaunch plugin/);
 assert.match(general,/aria-label="Widget relaunch mode"/);
 assert.match(general,/Apply to All/);
 assert.match(general,/aria-label=\{color\+' tag relaunch mode'\}/);
});
