import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('Apps content begins below the shared header without a secondary bar',()=>{
 const apps=source('../src/AppsWidget.tsx');
 assert.doesNotMatch(apps,/app-panel-tools|app-panel-status/);
 assert.match(apps,/app-panel-host/);
});

test('shared widget header keeps configurable Apps actions accessible',()=>{
 const canvas=source('../src/WorkspaceCanvas.tsx');
 assert.match(canvas,/w\.type==='apps'&&showAppAttachAction&&<button[^>]*aria-label=\{t\('attachOpenAppTo'\)\.replace\('\{title\}',title\)\}/);
 assert.match(canvas,/w\.type==='apps'&&showAppDetachAction&&w\.appPanelOpen&&<button[^>]*aria-label=\{t\('detachAppFrom'\)\.replace\('\{title\}',title\)\}/);
 assert.match(canvas,/w\.type==='apps'&&showAppSaveAction&&w\.appKey&&<button[^>]*aria-label=\{t\('saveWidgetToTray'\)\.replace\('\{title\}',title\)\}/);
 assert.match(canvas,/showAppAttachAction=false,showAppDetachAction=false,showAppSaveAction=false/,'all Apps header actions default to hidden');
 const apps=source('../src/AppsWidget.tsx');
 assert.match(apps,/onClick=\{\(\)=>void choose\(\)\}/,'app selection remains available in its empty state');
 assert.match(apps,/widget\.appKey\?t\('changeApp'\):t\('chooseApp'\)/,'changing or choosing an app remains available without restoring a secondary toolbar');
 assert.match(apps,/widget\.appKey&&!ready&&!opening&&!widget\.appPanelOpen&&<button className=\{'primary'\+\(relaunchFailed\?/,'saved apps expose a clear action to reopen only when native recovery is not already underway');
 assert.match(apps,/app-panel-relaunch-failed/);assert.match(apps,/t\('retryOpeningApp'\)/,'a failed relaunch leaves a clearly styled retry action');
 assert.match(apps,/!ready&&\(widget\.appWasCollected\|\|\(!widget\.appKey&&widget\.appName\)\)&&<button[\s\S]*?t\('reattachOpenApp'\)/,'attached windows can be reselected after a Still restart');
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
