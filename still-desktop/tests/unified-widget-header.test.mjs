import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('Apps and Browser content begins below the shared header without a secondary bar',()=>{
 const apps=source('../src/AppsWidget.tsx');
 const browser=source('../src/BrowserWidget.tsx');
 assert.doesNotMatch(apps,/app-panel-tools|app-panel-status/);
 assert.doesNotMatch(browser,/browser-main-tools|browser-status/);
 assert.match(apps,/app-panel-host/);
 assert.match(browser,/browser-host/);
});

test('shared widget header keeps Apps attachment and detach plus Browser Lecture actions accessible',()=>{
 const canvas=source('../src/WorkspaceCanvas.tsx');
 const apps=source('../src/AppsWidget.tsx');
 assert.match(canvas,/aria-label=\{'Attach open app to '\+title\}/);
 assert.match(canvas,/aria-label=\{'Detach app from '\+title\}/);
 assert.match(canvas,/w\.type==='browser'&&<button[\s\S]*?lecture\(w\)/);
 assert.match(canvas,/w\.type==='apps'&&w\.appKey&&<button[\s\S]*?saveApp\(w\.id\)/);
 assert.match(apps,/onClick=\{\(\)=>void choose\(\)\}/,'app selection remains available in its empty state');
 assert.match(apps,/widget\.appKey\?'Change app…':'Choose app…'/,'changing or choosing an app remains available without restoring a secondary toolbar');
 assert.match(apps,/widget\.appKey&&!ready&&!opening&&!widget\.appPanelOpen&&<button className=\{'primary'/,'saved apps expose a clear action to reopen only when native recovery is not already underway');
 assert.match(apps,/app-panel-relaunch-failed[\s\S]*?Retry opening app/,'a failed relaunch leaves a clearly styled retry action');
 assert.match(apps,/!ready&&\(widget\.appWasCollected\|\|\(!widget\.appKey&&widget\.appName\)\)&&<button[\s\S]*?Reattach open app…/,'attached windows can be reselected after a Still restart');
});

test('Apps omits its PNG and header resize controls while keeping the standard corner resize handle',()=>{
 const canvas=source('../src/WorkspaceCanvas.tsx');
 assert.match(canvas,/w\.type!=='apps'&&<button[^>]*widget-export-control/);
 assert.doesNotMatch(canvas,/widget-resize-control/);
 assert.match(canvas,/className="widget-resize"/);
});

test('Group uses the shared header and places its expand control last inside the header controls',()=>{
 const canvas=source('../src/WorkspaceCanvas.tsx');
 const styles=source('../src/canvas.css');
 assert.doesNotMatch(canvas,/group-collapsed-head/);
 assert.match(canvas,/group-widget-count/);
 const controls=canvas.indexOf('className="widget-controls"');
 const expand=canvas.indexOf('className="group-collapse-toggle"');
 const close=canvas.indexOf('</div>',expand);
 assert.ok(controls>=0&&expand>controls&&close>expand,'Group expand control belongs inside shared controls');
 assert.doesNotMatch(canvas,/widget-controls[\s\S]{0,800}<\/div>\}\{w\.type==='group'&&/);
 assert.match(styles,/\.canvas-card\.group-collapsed::before/);
 assert.match(styles,/\.canvas-card\.group-collapsed \.widget-content/);
 assert.doesNotMatch(styles,/group-collapsed-head/);
});
