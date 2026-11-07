import {expect,test} from '@playwright/test';
import {createInitialState} from '../../src/domain/workspaces';

test('Dashboard omits Notes and sidebar calendar shortcut without deleting saved notes',async({page})=>{
 const state=createInitialState();
 const dashboard=state.workspaces.find(workspace=>workspace.role==='dashboard')!;
 const notes=dashboard.widgets.find(widget=>widget.type==='notes')!;
 await page.addInitScript(state=>{
  localStorage.setItem('still-first-run-tutorial-v1','done');
  localStorage.setItem('still-workspace-v2',JSON.stringify(state));
 },state);
 await page.goto('/design-preview.html');
 await expect(page.locator('.dashboard-home')).toBeVisible();
 await expect(page.locator('.dashboard-notes-module')).toHaveCount(0);
 await expect(page.locator('.sidebar-study-tools').getByRole('button',{name:'Add to calendar'})).toHaveCount(0);
 await expect(page.locator('.dashboard-hero-actions').getByRole('button',{name:'Add to calendar'})).toBeVisible();
 for(const name of ['calendar','focus','timetable','library'])await expect(page.locator(`.dashboard-${name}-module`)).toBeVisible();
 const savedNotes=await page.evaluate(id=>{
  const saved=JSON.parse(localStorage.getItem('still-workspace-v2')!);
  return saved.workspaces.flatMap((workspace:{widgets:{id:string}[]})=>workspace.widgets).find((widget:{id:string})=>widget.id===id);
 },notes.id);
 expect(savedNotes).toEqual(notes);
 await page.setViewportSize({width:600,height:900});
 await expect(page.locator('.dashboard-notes-module')).toHaveCount(0);
 expect(await page.locator('.dashboard-home').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
});
