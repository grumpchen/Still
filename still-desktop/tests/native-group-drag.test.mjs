import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('expanded native Browser and Apps panels suspend before canvas dragging and cancellation clears the gesture',()=>{
 const canvas=readFileSync(new URL('../src/WorkspaceCanvas.tsx',import.meta.url),'utf8');
 const browser=readFileSync(new URL('../src/platform/chromePanel.ts',import.meta.url),'utf8');
 const apps=readFileSync(new URL('../src/platform/appPanel.ts',import.meta.url),'utf8');
 const start=canvas.slice(canvas.indexOf('function start('),canvas.indexOf('function move('));
 const finish=canvas.slice(canvas.indexOf('function finish('),canvas.indexOf('function key('));
 assert.match(start,/mode==='move'&&!w\.minimized/);
 assert.match(start,/w\.type==='browser'&&chromePanel\.available\?chromePanel\.suspendForDrag\(w\.id\)/);
 assert.match(start,/w\.type==='apps'&&appPanel\.available\?appPanel\.suspendForDrag\(w\.id\)/);
 assert.ok(start.indexOf('suspendForDrag')<start.indexOf('setActive(w.id)'), 'native hide is queued before the active drag render');
 assert.match(browser,/suspendForDrag:\(id:string\)=>command<boolean>\(id,'chrome_panel_suspend'\)/);
 assert.match(apps,/suspendForDrag:\(id:string\)=>command<boolean>\(id,'app_panel_suspend'\)/);
 assert.match(finish,/gesture\.current=null;setActive\(null\)/);
 assert.match(finish,/if\(cancel\)\{if\(original\)update\(g\.id,\{placement:original\.placement,restorePlacement:original\.restorePlacement\}\)\}/);
 assert.match(canvas,/onPointerCancel=\{e=>finish\(e,true\)\}/);
});

test('expanded and minimized Browser or Apps instances enter the same move-to-Group finish path',()=>{
 const canvas=readFileSync(new URL('../src/WorkspaceCanvas.tsx',import.meta.url),'utf8');
 const finish=canvas.slice(canvas.indexOf('function finish('),canvas.indexOf('function key('));
 assert.match(finish,/const original=currentWidget\?\(currentWidget\.minimized\?moveMinimizedWidgetInstance\(currentWidget,\{x:g\.p\.x,y:g\.p\.y\},extent,height\):\{\.\.\.currentWidget,placement:g\.p\}\)/);
 assert.match(finish,/canvasTarget&&original\)\{void saveToGroup\(original,canvasTarget,true\);return\}/);
 assert.equal((canvas.match(/onPointerDown=\{e=>start\(e,w,'move'\)\}/g)||[]).length,2, 'expanded headers and minimized buttons both use the same drag handler');
});
