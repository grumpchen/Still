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

test('sidebar hover reveal zone and Apps reveal rail sit on their panel edges',()=>{
 assert.match(app,/<div className="sidebar-reveal-zone" aria-hidden="true" onPointerEnter=\{openSidebarPeek\}\/\>/);
 assert.match(app,/<aside id="workspace-sidebar" className="sidebar" onPointerEnter=\{openSidebarPeek\} onPointerLeave=\{closeSidebarPeek\}/);
 const dock=readFileSync(new URL('../src/WorkspaceDock.tsx',import.meta.url),'utf8');
 assert.match(canvas,/<WorkspaceDock trayRef=\{tray\}/);
 assert.match(dock,/className="dock-reveal-rail" aria-label=\{expanded\?t\('dockExpandedAria'\):t\('dockShowApps'\)\} aria-expanded=\{expanded\}/);
 assert.match(styles,/\.sidebar-reveal-zone\{position:fixed[^}]*inset:0 auto 0 0/);
 assert.match(readFileSync(new URL('../src/canvas.css',import.meta.url),'utf8'),/\.dock-reveal-rail\{position:absolute;top:0/);
});
