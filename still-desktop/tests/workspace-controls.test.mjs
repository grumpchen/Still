import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const canvas=readFileSync(new URL('../src/WorkspaceCanvas.tsx',import.meta.url),'utf8');
const styles=readFileSync(new URL('../src/canvas.css',import.meta.url),'utf8');

test('widget headers expose other workspace rows as transfer targets and reset invalid drops',()=>{
 assert.match(app,/data-workspace-drop-target=\{w\.id\}/);
 assert.match(canvas,/elementFromPoint\(e\.clientX,e\.clientY\).*data-workspace-drop-target/);
 assert.match(canvas,/transferWidget\(workspaceId,g\.id,destination,g\.current,g\.currentRestorePlacement\)/);
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

test('sidebar chevron and Apps reveal rail sit on their panel edges',()=>{
 assert.match(app,/<button className="sidebar-edge-toggle"[\s\S]*aria-controls="workspace-sidebar"/);
 assert.match(app,/aria-expanded=\{sidebarVisible&&!state\.sidebarCollapsed\}[^>]*><Icon name="chevronRight"/);
 assert.match(styles,/\.sidebar-edge-toggle\[aria-expanded=true\] svg\{transform:rotate\(180deg\)\}/);
 assert.doesNotMatch(app,/<button className="sidebar-toggle"/);
 assert.doesNotMatch(app,/<button aria-label=\{widgetTrayVisible\?/);
 const dock=readFileSync(new URL('../src/WorkspaceDock.tsx',import.meta.url),'utf8');
 assert.match(canvas,/<WorkspaceDock trayRef=\{tray\}/);
 assert.match(dock,/className="dock-reveal-rail"[^>]*aria-expanded=\{expanded\}/);
 assert.match(styles,/\.sidebar-edge-toggle\{position:absolute[^}]*background:transparent/);
 assert.match(readFileSync(new URL('../src/canvas.css',import.meta.url),'utf8'),/\.dock-reveal-rail\{position:absolute/);
});
