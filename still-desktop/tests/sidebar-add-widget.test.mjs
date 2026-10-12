import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');

test('the sidebar plugin plus opens plugin choices and sits directly above Settings',()=>{
 const sidebarBottom=app.match(/<div className="sidebar-bottom">([\s\S]*?)<\/div><\/aside>/)?.[1];
 assert.ok(sidebarBottom,'the sidebar has a bottom action area');
 assert.match(sidebarBottom,/className="sidebar-plugin-list"[\s\S]*?aria-label="Add sidebar plugin"[^>]*onClick=\{\(\)=>setModal\('sidebarPlugins'\)\}[^>]*><Icon name="add"\/>[\s\S]*?aria-label="Settings"/);
 assert.match(app,/className="sidebar-plugin-list"[\s\S]*?state\.sidebarPlugins\.map[\s\S]*?aria-label="Stack widgets" onClick=\{stackWidgets\}[\s\S]*?aria-label="Layout"[\s\S]*?Layout/);
 assert.match(app,/aria-label="Layout" aria-pressed=\{layoutMode!==null\} onClick=\{\(\)=>setLayoutMode\(current=>current===null\?'picker':null\)\}/);
 assert.match(app,/modal==='sidebarPlugins'[\s\S]*?Stack plugin[\s\S]*?Add Layout plugin[\s\S]*?Add plugin/);
});
