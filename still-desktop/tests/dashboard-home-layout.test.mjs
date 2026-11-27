import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const dashboard=readFileSync(new URL('../src/DashboardHome.tsx',import.meta.url),'utf8');
const styles=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');

test('Dashboard routes to a fixed study page with a distinct responsive layout',()=>{
 assert.match(app,/w\.role==='dashboard'\?<DashboardHome[\s\S]*?w\.role==='library'\?<LibraryHome[\s\S]*?<WorkspaceCanvas/,'the fixed Dashboard and Library use page components while normal workspaces use the canvas');
 assert.match(dashboard,/className="dashboard-home"[\s\S]*?className="dashboard-grid"/);
 assert.match(dashboard,/className=\{'dashboard-module dashboard-'\+widget\.type\+'-module'/,'Dashboard modules render from the selected widget instances');
 assert.match(dashboard,/className="dashboard-drag-handle"[\s\S]*?onPointerDown=\{event=>beginPointerDrag\(event,widget\.id\)\}/,'Dashboard modules reorder by dragging an edit handle');
 assert.doesNotMatch(dashboard,/Move earlier|Move later|draggable=\{editing\}/,'Dashboard has no arrow reorder controls or whole-card drag capture');
 assert.match(dashboard,/widgetTypes\.filter\(type=>type!=='group'\)/,'the Dashboard editor can add supported widget types');
 assert.match(dashboard,/widgetRegistry\[widget\.type\]\.component/,'Dashboard can render each supported widget component');

 const dashboardStyles=styles.slice(styles.indexOf('/* Dashboard is a fixed study page'));
 assert.match(styles,/\.dashboard-grid\{[^}]*display:flex;flex-wrap:wrap/,'both modes use the same responsive flow');
 assert.match(dashboardStyles,/\.dashboard-module\{[^}]*border:0;border-top:[^}]*border-radius:0;background:transparent;box-shadow:none/,'Dashboard sections use page styling instead of floating widget-card surfaces');
 assert.match(dashboardStyles,/@media\(max-width:720px\)[^\n]*\.dashboard-module:nth-child\(n\)\{width:100%/,'auto-sized cards use a single column on narrow windows');
});
