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

test('native Apps collection requires a confirmed hide and persists only recovery intent',()=>{
 const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
 const apps=readFileSync(new URL('../src/AppsWidget.tsx',import.meta.url),'utf8');
 const panel=readFileSync(new URL('../src/platform/appPanel.ts',import.meta.url),'utf8');
 assert.match(app,/const suspended=await appPanel\.suspendForCollection\(widget\.id\);if\(widget\.appPanelOpen&&!suspended\)throw new Error/);
 assert.match(panel,/suspendForCollection:async\(id:string\)=>\{const suspended=await command<boolean>\(id,'app_panel_suspend',\{forCollection:true\}\);if\(suspended\)retainedForCollection\.add\(id\);return suspended\}/);
 assert.match(apps,/if\(!appPanel\.isCollectionRetained\(widget\.id\)\)void appPanel\.release\(widget\.id\)/,'Successful Group collection keeps component cleanup from releasing the original native window');
 assert.match(apps,/retainedOnMount\|\|widget\.appWasCollected/);
 assert.match(apps,/current\.current\.update\(\{appPanelOpen:true,appWasCollected:false\}\)/);
});

test('native Apps collection blocks late presentations and refresh until explicit resume',()=>{
 const native=readFileSync(new URL('../src-tauri/src/app_panel.rs',import.meta.url),'utf8');
 const present=native.slice(native.indexOf('pub async fn app_panel_present('),native.indexOf('#[tauri::command]',native.indexOf('pub async fn app_panel_present(')));
 const place=native.slice(native.indexOf('fn place(app:'),native.indexOf('pub(crate) fn ordered_windows('));
 const suspend=native.slice(native.indexOf('pub async fn app_panel_suspend('),native.indexOf('#[tauri::command]',native.indexOf('pub async fn app_panel_suspend(')));
 const collect=native.slice(native.indexOf('fn mark_collected('),native.indexOf('fn prepare_collection_resume('));
 assert.match(present,/protect_collected_window\(entry\)/);
 assert.ok(present.indexOf('protect_collected_window')<present.indexOf('snapshot_is_stale')&&present.indexOf('protect_collected_window')<present.indexOf('entry.bounds=bounds'), 'Collected state is checked before revision or geometry can admit a presentation');
 assert.match(place,/protect_collected_window\(entry\)/);
 assert.ok(place.indexOf('protect_collected_window')<place.indexOf('position(entry,main,origin,scale)'), 'Native refresh enforces the same hidden state before positioning');
 assert.match(suspend,/if for_collection==Some\(true\)\{mark_collected\(entry,&id\)\?;\}/);
 assert.doesNotMatch(collect,/entry\.revision\s*=/,'Collection must preserve presentation revision ordering');
 assert.match(native,/fn prepare_collection_resume\([\s\S]*?clear_collection_marker\(entry\)[\s\S]*?entry\.revision=0/);
});
