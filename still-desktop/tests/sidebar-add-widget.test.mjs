import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');

test('the sidebar plugin plus opens plugin choices and sits directly above Settings',()=>{
 const sidebarBottom=app.match(/<div className="sidebar-bottom">([\s\S]*?)<div className="profile">/)?.[1];
 assert.ok(sidebarBottom,'the sidebar has a bottom action area');
 assert.match(sidebarBottom,/className="sidebar-plugin-list"[\s\S]*?<button title=\{translate\(state\.locale,'sidebarAddPlugin'\)\} aria-label=\{translate\(state\.locale,'sidebarAddPlugin'\)\} onClick=\{\(\)=>setModal\('sidebarPlugins'\)\}/);
 assert.match(app,/aria-label=\{translate\(state\.locale,'settings'\)\} onClick=\{\(\)=>\{setSettingsTab\('general'\);setModal\('settings'\)\}\}/);
 assert.match(app,/className="sidebar-plugin-list"[\s\S]*?state\.sidebarPlugins\.map[\s\S]*?onClick=\{stackWidgets\}[\s\S]*?sidebarAddPlugin[\s\S]*?studyTools[\s\S]*?sidebarPlugins\.includes\('stack'\)/);
 assert.match(app,/aria-label=\{translate\(state\.locale,'layout'\)\} aria-pressed=\{layoutMode!==null\} onClick=\{\(\)=>setLayoutMode\(current=>current===null\?'picker':null\)\}/);
 assert.match(app,/modal==='sidebarPlugins'[\s\S]*?addStackPlugin[\s\S]*?addLayoutPlugin[\s\S]*?addPlugin/);
});
