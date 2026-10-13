import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const capability=readFileSync(new URL('../src-tauri/capabilities/main.json',import.meta.url),'utf8');
const canvasCss=readFileSync(new URL('../src/canvas.css',import.meta.url),'utf8');

test('whole-workspace fullscreen uses the native Still window and exposes an exit control',()=>{
 assert.match(app,/win\.setFullscreen\(next\)/);
 assert.match(app,/isTauri\(\)&&<button className="topbar-fullscreen"/);
 assert.match(app,/aria-label=\{fullscreen\?'Exit fullscreen':'Enter fullscreen'\}/);
 assert.match(app,/event\.key==='Escape'[\s\S]*toggleFullscreen\(\)/);
 assert.match(app,/win\.onResized/);
 assert.match(capability,/core:window:allow-is-fullscreen/);assert.match(capability,/core:window:allow-set-fullscreen/);
});

test('fullscreen is temporary and not stored in workspace preferences',()=>{
 const stateModule=readFileSync(new URL('../src/domain/workspaces.ts',import.meta.url),'utf8');
 assert.doesNotMatch(stateModule,/fullscreen\??:/i);
});

test('fullscreen masks the transparent taskbar bleed-through without intercepting input',()=>{
 assert.match(app,/classList\.toggle\('fullscreen-taskbar-covered',fullscreen\)/);
 assert.match(app,/screen\.height-screen\.availHeight/);
 assert.match(canvasCss,/\.canvas-app\.fullscreen-taskbar-covered::after\{[^}]*height:var\(--fullscreen-taskbar-height,40px\)[^}]*pointer-events:none[^}]*background:linear-gradient\(to bottom,transparent,var\(--canvas\)\)/);
});
