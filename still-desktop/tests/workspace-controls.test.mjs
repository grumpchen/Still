import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const canvas=readFileSync(new URL('../src/WorkspaceCanvas.tsx',import.meta.url),'utf8');
const styles=readFileSync(new URL('../src/canvas.css',import.meta.url),'utf8');

test('widget headers expose other workspace rows as transfer targets and reset invalid drops',()=>{
 assert.match(app,/data-workspace-drop-target=\{w\.id\}/);
 assert.match(canvas,/elementFromPoint\(e\.clientX,e\.clientY\).*data-workspace-drop-target/);
 assert.match(canvas,/transferWidget\(workspaceId,g\.id,destination\)/);
 assert.match(canvas,/if\(!cancel&&g\.mode==='move'&&destination/);
 assert.match(styles,/workspace-drop-active/);
});

test('compact focus state is temporary and keeps its exit control beside fullscreen',()=>{
 assert.match(app,/useState\(false\);const \[workspaceDropTarget/);
 assert.match(app,/aria-label=\{focusMode\?'Exit focus mode':'Enter focus mode'\}/);
 assert.match(app,/aria-pressed=\{focusMode\} onClick=\{\(\)=>setFocusMode/);
 assert.match(app,/focusMode\?' focus-mode':''/);
 assert.match(styles,/\.canvas-app\.focus-mode \.sidebar\{display:none\}/);
 assert.match(styles,/\.canvas-app\.focus-mode \.widget-tray\{display:none\}/);
 assert.doesNotMatch(readFileSync(new URL('../src/domain/workspaces.ts',import.meta.url),'utf8'),/focusMode\??:/);
});

test('sidebar and widget-tray visibility chevrons sit on their panel edges, outside the top bar',()=>{
 assert.match(app,/<button className="sidebar-edge-toggle"[\s\S]*aria-controls="workspace-sidebar"/);
 assert.match(app,/aria-expanded=\{sidebarVisible&&!state\.sidebarCollapsed\}[^>]*><Icon name="chevronRight"/);
 assert.match(styles,/\.sidebar-edge-toggle\[aria-expanded=true\] svg\{transform:rotate\(180deg\)\}/);
 assert.doesNotMatch(app,/<button className="sidebar-toggle"/);
 assert.doesNotMatch(app,/<button aria-label=\{widgetTrayVisible\?/);
 assert.match(canvas,/<div className="widget-tray-shell"><div id="workspace-tray"[\s\S]*className="tray-edge-toggle"[\s\S]*aria-controls="workspace-tray"/);
 assert.match(canvas,/aria-expanded=\{widgetTrayVisible\}[^>]*><Icon name="chevronDown"/);
 assert.match(styles,/\.tray-edge-toggle\[aria-expanded=true\] svg\{transform:rotate\(180deg\)\}/);
 assert.match(styles,/\.sidebar-edge-toggle\{position:absolute[^}]*background:transparent/);
 assert.match(styles,/\.tray-edge-toggle\{position:absolute[^}]*top:100%;left:50%;transform:translate\(-50%,0\)[^}]*background:transparent/);
});
