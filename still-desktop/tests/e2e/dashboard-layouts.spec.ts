import {expect,test} from '@playwright/test';
import {createInitialState,createWorkspace,createWidget} from '../../src/domain/workspaces.ts';

test('Dashboard layout saves across reloads and copies without replacing target widgets, with undo',async({page})=>{
 const state=createInitialState(),dashboard=state.workspaces.find(workspace=>workspace.role==='dashboard')!,target=createWorkspace('Project',[]);target.widgets=[createWidget('notes')];const existingId=target.widgets[0].id;state.workspaces.push(target);
 await page.addInitScript(data=>{localStorage.setItem('still-first-run-tutorial-v1','done');localStorage.setItem('still-workspace-v2',JSON.stringify(data))},state);
 await page.setViewportSize({width:1440,height:1000});await page.goto('/design-preview.html');
 let home=page.locator('.dashboard-home');await home.getByRole('button',{name:'Edit Layout'}).click();await home.getByRole('button',{name:'Layouts'}).click();
 await page.getByLabel('Layout name').fill('Study layout');await page.getByRole('button',{name:'Save',exact:true}).click();
 await expect(page.getByRole('button',{name:'Study layout'})).toBeVisible();await page.reload();
 home=page.locator('.dashboard-home');await home.getByRole('button',{name:'Layouts'}).click();await expect(page.getByRole('button',{name:'Study layout'})).toBeVisible();
 await page.getByRole('button',{name:'Study layout'}).click();await page.getByLabel('Target workspace').selectOption(target.id);await page.getByRole('button',{name:'Copy layout'}).click();
 await expect.poll(()=>page.evaluate(({id,existingId})=>{const state=JSON.parse(localStorage.getItem('still-workspace-v2')!);const w=state.workspaces.find((item:any)=>item.id===id);return {count:w.widgets.length,preserved:w.widgets.some((item:any)=>item.id===existingId),types:w.widgets.filter((item:any)=>['calendar','focus','timetable'].includes(item.type)).length}},{id:target.id,existingId})).toEqual({count:4,preserved:true,types:3});
 await page.getByRole('button',{name:'Undo copy'}).click();
 await expect.poll(()=>page.evaluate(({id,existingId})=>{const state=JSON.parse(localStorage.getItem('still-workspace-v2')!);const w=state.workspaces.find((item:any)=>item.id===id);return {count:w.widgets.length,preserved:w.widgets.some((item:any)=>item.id===existingId)}},{id:target.id,existingId})).toEqual({count:1,preserved:true});
});
