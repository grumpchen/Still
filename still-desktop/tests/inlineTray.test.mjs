import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const canvas=readFileSync(new URL('../src/WorkspaceCanvas.tsx',import.meta.url),'utf8');
const presets=readFileSync(new URL('../src/PresetTray.tsx',import.meta.url),'utf8');
const groups=readFileSync(new URL('../src/GroupTray.tsx',import.meta.url),'utf8');
const contextMenu=readFileSync(new URL('../src/SavedItemContextMenu.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/canvas.css',import.meta.url),'utf8');

const editor=readFileSync(new URL('../src/TrayEditor.tsx',import.meta.url),'utf8');

test('Saved + follows all saved items in the scrolling row while Edit and Trash stay fixed',()=>{
 const row=canvas.slice(canvas.indexOf('<div className="tray-main-row">'),canvas.indexOf('<span id="widget-tray-help"'));
 assert.match(row,/data-saved-target/);assert.match(row,/data-trash-target/);
 assert.ok(row.indexOf('<PresetTray')<row.indexOf('data-saved-target'));
 assert.ok(row.indexOf('<GroupTray')<row.indexOf('data-saved-target'));
 assert.ok(row.indexOf('data-saved-target')<row.indexOf('</div>'));
 assert.ok(row.indexOf('data-saved-target')<row.indexOf('Edit widget tray'));
 assert.ok(row.indexOf('data-trash-target')>row.indexOf('Edit widget tray'));
 assert.doesNotMatch(row,/tray-blank-gutter|widgetTypes\.filter|Add widget|Add link/);
 assert.match(css,/\.tray-items\{[^}]*overflow-x:auto/);
 assert.match(css,/\.tray-control\{[^}]*flex:0 0 34px/);
 assert.match(css,/\.tray-items \.saved-plus\{flex:0 0 34px/);
 assert.match(canvas,/const savedTarget=[^\n]*closest\('\.tray-items'\)/);
});

test('new saved shortcuts scroll into view immediately before Saved +',()=>{
 assert.match(canvas,/previousPresetIds/);
 assert.match(canvas,/presets\.some\(preset=>!previousPresetIds\.current\.has\(preset\.id\)\)/);
 assert.match(canvas,/scrollLeft\s*=\s*Math\.max\(0,items\.scrollWidth-items\.clientWidth\)/);
 assert.match(canvas,/ref=\{trayItems\}/);
 const row=canvas.slice(canvas.indexOf('<div className="tray-main-row">'),canvas.indexOf('<span id="widget-tray-help"'));
 assert.ok(row.indexOf('<PresetTray')<row.indexOf('data-saved-target'));
});

test('Quiet Minimal keeps the tray visible while offering transparent and opaque canvas choices',()=>{
 const styles=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
 assert.match(styles,/html\.native-transparent body:not\(\.liquid-glass\):not\(\.transparent-background\) \.canvas-app\{background:var\(--canvas\)\}/);
 assert.match(styles,/body\.transparent-background \.canvas-app[^}]*background:transparent/);
 assert.match(styles,/html\.native-transparent \.liquid-glass::after\{display:none\}/);
 assert.doesNotMatch(styles,/html\.native-transparent \.liquid-glass::before[^}]*display:none/);
 assert.match(css,/\.widget-tray\{[^}]*background:var\(--surface\)[^}]*box-shadow/);
});

test('Group card close removes the floating card immediately and preserves the saved Group',()=>{
 const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
 const canvas=readFileSync(new URL('../src/WorkspaceCanvas.tsx',import.meta.url),'utf8');
 assert.match(canvas,/aria-label=\{'Remove '\+title\}/);
 assert.match(canvas,/onClick=\{e=>\{e\.stopPropagation\(\);remove\(w\.id\)\}\}>×<\/button>/);
 const removal=app.slice(app.indexOf('function removeWidget('),app.indexOf('function addWidget('));
 assert.match(removal,/kind:'widget' as const/);
 assert.match(removal,/performRemoval\(target\)/);
 assert.doesNotMatch(removal,/setPendingRemoval|setModal\('delete'\)/);
 assert.match(app,/Remove this Group card from the workspace\? Its collected widgets remain in the saved Group/);
 assert.match(app,/target\.kind==='widget'\?deleteCanvasWidget/);
});

test('saved Widget, App and Group buttons expose Rename and Delete context actions',()=>{
 assert.match(presets,/onContextMenu/);
 assert.match(groups,/onContextMenu/);
 assert.match(contextMenu,/role="menu"/);assert.match(contextMenu,/Rename/);assert.match(contextMenu,/Delete/);
 assert.match(contextMenu,/Escape/);assert.match(contextMenu,/pointerdown/);
 assert.match(contextMenu,/removeEventListener\('pointerdown'/);assert.match(contextMenu,/removeEventListener\('keydown'/);
});

test('saved entry rename and deletion stay in the saved collection and Edit dialog',()=>{
 const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
 assert.match(app,/renameSavedPreset/);assert.match(app,/saveGroupName\(owner,savedRename\.id,nextName\)/);
 assert.match(app,/modal==='renameSaved'/);
 const actions=readFileSync(new URL('../src/domain/trayActions.ts',import.meta.url),'utf8');
 assert.match(actions,/renameSavedPreset/);assert.match(actions,/removeSavedPreset/);
 assert.match(editor,/Rename shortcut/);assert.match(editor,/Rename group/);
 assert.match(editor,/Remove shortcut/);assert.match(editor,/Remove group/);
 assert.match(app,/localStorage\.setItem\(KEY,JSON\.stringify\(state\)\)/);
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
 assert.match(presets,/function label\(preset:WidgetPreset\):string\s*\{\s*return preset\.name/);
 assert.doesNotMatch(presets,/className="preset-action"|className="preset-kind"|apps-tray-add/);
 assert.match(editor,/Remove shortcut/);
});

test('Group drop collection and saved-app launch guard retain existing pipelines',()=>{
 const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
 assert.match(app,/collectWidgetIntoGroup/);assert.match(app,/restoreCollectedWidget/);
 assert.match(app,/savedAppInUse\(s,preset\)/);assert.match(app,/checkedAppIconData\(preset\.iconData\)/);
 assert.match(canvas,/action==='save'&&original\)void saveWidgetToTray\(original\)/);
 assert.match(canvas,/appPanel\.prepare\(attachment\)/);
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
