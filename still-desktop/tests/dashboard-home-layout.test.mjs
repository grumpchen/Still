import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const dashboard=readFileSync(new URL('../src/DashboardHome.tsx',import.meta.url),'utf8');
const styles=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');

test('Dashboard routes to a fixed study page with a distinct responsive layout',()=>{
 assert.match(app,/w\.role==='dashboard'\?<DashboardHome[\s\S]*?w\.role==='library'\?<LibraryHome[\s\S]*?<WorkspaceCanvas/,'the fixed Dashboard and Library use page components while normal workspaces use the canvas');
 assert.match(dashboard,/className="dashboard-home"[\s\S]*?className="dashboard-grid"/);
 for(const module of ['calendar','focus','notes','timetable','library'])assert.match(dashboard,new RegExp(`dashboard-${module}-module`),`${module} has a fixed Dashboard section`);
 assert.doesNotMatch(dashboard,/WorkspaceCanvas|canvas-card|draggable=/,'Dashboard modules are not rendered as movable canvas cards');

 const dashboardStyles=styles.slice(styles.indexOf('/* Dashboard is a fixed study page'));
 assert.match(dashboardStyles,/\.dashboard-grid\{grid-template-columns:[^}]*grid-template-areas:"calendar focus" "calendar notes" "timetable library"/,'the Dashboard uses its own structured study layout');
 assert.match(dashboardStyles,/\.dashboard-module\{[^}]*border:0;border-top:[^}]*border-radius:0;background:transparent;box-shadow:none/,'Dashboard sections use page styling instead of floating widget-card surfaces');
 assert.match(styles,/@media\(max-width:720px\)\{\.dashboard-grid\{grid-template-columns:minmax\(0,1fr\);grid-template-areas:"calendar" "focus" "notes" "timetable" "library"/,'the study page reflows into a single column on narrow windows');
 assert.ok(dashboardStyles.includes('@media(max-width:720px)')&&dashboardStyles.includes('.dashboard-grid{column-gap:0;row-gap:18px'),'the mobile page keeps consistent vertical spacing');
});
