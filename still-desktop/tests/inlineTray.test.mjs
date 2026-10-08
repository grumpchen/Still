import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const canvas=readFileSync(new URL('../src/WorkspaceCanvas.tsx',import.meta.url),'utf8');
const presets=readFileSync(new URL('../src/PresetTray.tsx',import.meta.url),'utf8');
const groups=readFileSync(new URL('../src/GroupTray.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/canvas.css',import.meta.url),'utf8');

const editor=readFileSync(new URL('../src/TrayEditor.tsx',import.meta.url),'utf8');

test('compact tray has fixed Saved +, Edit and Trash, with explicit independent targets',()=>{
 const row=canvas.slice(canvas.indexOf('<div className="tray-main-row">'),canvas.indexOf('<span id="widget-tray-help"'));
 assert.match(row,/data-saved-target/);assert.match(row,/data-trash-target/);
 assert.ok(row.indexOf('<PresetTray')<row.indexOf('data-saved-target'));
 assert.ok(row.indexOf('Edit widget tray')<row.indexOf('data-trash-target'));
 assert.doesNotMatch(row,/tray-blank-gutter|widgetTypes\.filter|Add widget|Add link/);
 assert.match(css,/\.tray-items\{[^}]*overflow-x:auto/);
 assert.match(css,/\.tray-control\{[^}]*flex:0 0 34px/);
});

test('expanded Group entries stay inline, with management actions retained in Edit',()=>{
 assert.match(groups,/groups\.map\(group=>[\s\S]*tray-group-button[\s\S]*group\.expanded&&[\s\S]*tray-group-inline-contents/);
 assert.match(groups,/data-group-drop-target="existing"/);
 assert.doesNotMatch(groups,/tray-group-inline-title|tray-group-add|Remove group|Open group/);
 for(const action of ['Edit','Add widget','Add link','Remove group','Attach open app','Focus'])assert.ok(editor.includes(action),action);
});

test('saved shortcuts use app logos, accessible titles and a single label without entry management clutter',()=>{
 assert.match(presets,/preset-app-icon/);assert.match(presets,/aria-label=\{'Open '\+accessibleName\}/);
 assert.match(presets,/title=\{accessibleName\}/);assert.match(presets,/!app&&<span>\{displayName\}<\/span>/);
 assert.doesNotMatch(presets,/className="preset-action"|className="preset-kind"|apps-tray-add/);
 assert.match(editor,/Remove shortcut/);
});

test('Group drop collection and saved-app launch guard retain existing pipelines',()=>{
 const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
 assert.match(app,/collectWidgetIntoGroup/);assert.match(app,/restoreCollectedWidget/);
 assert.match(app,/savedAppInUse\(s,preset\)/);assert.match(app,/checkedAppIconData\(preset\.iconData\)/);
 assert.match(canvas,/action==='save'&&original\)savePresets\(\[presetFromWidget\(original\)\]/);
 assert.match(app,/modal==='delete'&&pendingRemoval/);
});

test('minimize buttons affect live workspace widgets only and compact buttons stay out of tray hit targets',()=>{
 const live=canvas.slice(canvas.indexOf('{widgets.map('),canvas.indexOf('{!widgets.length'));
 assert.match(live,/minimizeWidget|Minimize/);assert.match(live,/onDoubleClick/);
 assert.match(canvas,/if\(!w\.minimized\)e\.preventDefault\(\)/);
 assert.match(canvas,/widget-minimized/);assert.match(canvas,/target\.insideTray/);
 assert.doesNotMatch(presets,/minimizeWidget|Minimize/);assert.doesNotMatch(groups,/minimizeWidget|Minimize/);
});

test('workspace overview is descriptive and cannot intercept workspace interaction',()=>{
 assert.match(canvas,/canvas-overview/);assert.match(canvas,/Workspace overview map/);assert.match(css,/\.canvas-overview\{[^}]*pointer-events:none/);
 assert.doesNotMatch(canvas,/scrollOffset\.x\+Math\.max/);
 assert.match(canvas,/overviewViewportRef|updateOverview/);
});
