import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');

test('sidebar Settings opens a tabbed dialog with General, Appearance, and Plugins pages',()=>{
 assert.match(app,/title="Settings" aria-label="Settings" onClick=\{\(\)=>\{setSettingsTab\('general'\);setModal\('settings'\)\}\}/);
 assert.match(app,/role="tablist" aria-label="Settings pages"[\s\S]*?General[\s\S]*?Appearance[\s\S]*?Plugins/);
 assert.match(app,/settingsTab==='appearance'[\s\S]*?<AppearanceSettings/);
 assert.match(app,/settingsTab==='general'[\s\S]*?General settings/);
 assert.match(app,/settingsTab==='plugins'[\s\S]*?Sidebar plugins/);
});
