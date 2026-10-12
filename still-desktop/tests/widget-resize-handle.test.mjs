import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('every expanded widget uses the shared accessible bottom-right resize handle',()=>{
 const canvas=source('../src/WorkspaceCanvas.tsx'),styles=source('../src/canvas.css');
 assert.match(canvas,/!w\.minimized&&<button className="widget-resize"[^>]*onPointerDown=\{e=>start\(e,w,'resize'\)\}/);
 assert.match(canvas,/onKeyDown=\{e=>key\(e,w,'resize'\)\}/);
 assert.match(styles,/\.canvas-card \.widget-resize\{position:absolute;bottom:0;right:0;[^}]*display:grid[^}]*z-index:2/);
 assert.match(styles,/\.canvas-card \.widget-resize\{[^}]*width:30px;height:30px/);
 assert.match(styles,/\.canvas-card\.widget-apps \.widget-resize\{width:32px;height:32px\}/);
 assert.match(styles,/\.canvas-card\.group-collapsed \.widget-content,\.canvas-card\.group-collapsed \.widget-resize\{display:none!important\}/);
 assert.match(styles,/\.widget-minimized \.widget-content,\.widget-minimized \.widget-resize\{display:none!important\}/);
});

test('Browser forwards the measured resize handle so native Chrome leaves it uncovered',()=>{
 const browser=source('../src/BrowserWidget.tsx');
 assert.match(browser,/querySelector<HTMLElement>\('\.widget-resize'\)\?\.getBoundingClientRect\(\)\?\?null/);
 assert.match(browser,/chromeClipGeometry\(r,v,content,higher,current\.current\.workspaceActive,current\.current\.obscured,grip\)/);
});
