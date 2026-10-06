import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const canvas=readFileSync(new URL('../src/WorkspaceCanvas.tsx',import.meta.url),'utf8');
const presets=readFileSync(new URL('../src/PresetTray.tsx',import.meta.url),'utf8');
const groups=readFileSync(new URL('../src/GroupTray.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/canvas.css',import.meta.url),'utf8');

test('every type dropdown is rendered inline after its arrow in the single tray row',()=>{
 const row=canvas.slice(canvas.indexOf('<div className="tray-items">'),canvas.indexOf('<div className="tray-blank-gutter"'));
 assert.match(row,/presetMenu===type&&<PresetTray/);
 assert.ok(row.indexOf('tray-preset-arrow')<row.indexOf('presetMenu===type&&<PresetTray'));
 assert.ok(row.indexOf('presetMenu===type&&<PresetTray')<row.indexOf('<GroupTray'));
 assert.doesNotMatch(canvas,/tray-shelf-area|tray-group-shelves/);
 assert.match(presets,/preset-tray-entry/);
});

test('expanded groups render their actions and entries immediately after each group button',()=>{
 assert.match(groups,/groups\.map\(group=>[\s\S]*tray-group-button[\s\S]*group\.expanded&&[\s\S]*tray-group-inline-contents/);
 assert.match(groups,/data-group-drop-target="existing"/);
 for(const action of ['Edit ','Open group','Remove group','Add widget','Add link'])assert.ok(groups.includes(action),`missing ${action} action`);
});

test('the tray row scrolls horizontally and inline dropdowns do not form another shelf',()=>{
 assert.match(css,/\.tray-items\{[^}]*overflow-x:auto/);
 assert.match(css,/\.tray-widget-button\{[^}]*flex-shrink:0/);
 assert.doesNotMatch(css,/\.tray-shelf-area\{|\.tray-group-shelves\{/);
});
test('Apps shortcuts are icon-only and the single plus opens the combined Apps dialog',()=>{
 assert.match(presets,/preset-app-icon/);assert.match(presets,/apps-tray-add/);assert.match(presets,/aria-label=\{'Open '\+preset\.name\}/);
 assert.doesNotMatch(presets,/Attach open app/);assert.match(presets,/type==='apps'\?<button className="apps-tray-add"/);
 const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
 assert.match(app,/appsDialogMode==='attach'\?\s*<AppWindowPicker/);assert.match(app,/<PresetEditor[^>]*type="apps"/);
 assert.match(app,/setModal\('appsTray'\)/);
});

test('disclosure controls and expanded contents belong to one rounded in-row pill',()=>{
 const split=canvas.slice(canvas.indexOf('<div data-tray-type={type}'),canvas.indexOf('{groups.length>0'));
 assert.match(split,/tray-pill|tray-widget-button/);
 assert.match(css,/\.tray-widget-button[^}]*border-radius/);
 assert.doesNotMatch(css,/\.preset-tray\{[^}]*border-left/);
 assert.match(groups,/tray-group-inline/);assert.match(css,/\.tray-group-inline[^}]*border-radius/);
 assert.doesNotMatch(css,/\.tray-group-inline-contents\{[^}]*border-left/);
});

test('saved Apps shortcut launch passes only validated icon data and retains the accessible name',()=>{
 assert.match(presets,/aria-label=\{'Open '\+preset\.name\}/);assert.match(presets,/title=\{[^}]*preset\.appName/);
 const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
 assert.match(app,/checkedAppIconData\(preset\.iconData\)/);
});

test('minimize buttons affect live workspace widgets only and compact buttons stay out of tray hit targets',()=>{
 const live=canvas.slice(canvas.indexOf('{widgets.map('),canvas.indexOf('{!widgets.length'));
 assert.match(live,/minimizeWidget|Minimize/);assert.match(live,/onDoubleClick/);
 assert.match(canvas,/minimized-widgets|workspace-minimized/);
 assert.doesNotMatch(presets,/minimizeWidget|Minimize/);assert.doesNotMatch(groups,/minimizeWidget|Minimize/);
});

test('workspace overview is descriptive and cannot intercept workspace interaction',()=>{
 assert.match(canvas,/canvas-overview/);assert.match(canvas,/Workspace overview map/);assert.match(css,/\.canvas-overview\{[^}]*pointer-events:none/);
 assert.doesNotMatch(canvas,/scrollOffset\.x\+Math\.max/);
 assert.match(canvas,/overviewViewportRef|updateOverview/);
});
