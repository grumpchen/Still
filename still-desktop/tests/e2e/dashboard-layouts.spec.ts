import {expect,test} from '@playwright/test';
import {createInitialState,createWorkspace,createWidget} from '../../src/domain/workspaces.ts';

test('Dashboard layout saves across reloads and copies without replacing target widgets, with undo',async({page})=>{
 const state=createInitialState(),dashboard=state.workspaces.find(workspace=>workspace.role==='dashboard')!,target=createWorkspace('Project',[]);target.widgets=[createWidget('notes')];const existingId=target.widgets[0].id;state.workspaces.push(target);
 await page.addInitScript(data=>{localStorage.setItem('still-first-run-tutorial-v1','done');localStorage.setItem('still-workspace-v2',JSON.stringify(data))},state);
 await page.setViewportSize({width:1440,height:1000});await page.goto('/design-preview.html');
 let home=page.locator('.dashboard-home');await home.getByRole('button',{name:'Edit Layout'}).click();await home.getByRole('button',{name:'Layouts'}).click();
 await page.getByLabel('Layout name',{exact:true}).fill('Study layout');await page.getByRole('button',{name:'Save',exact:true}).click();
 await expect(page.getByRole('button',{name:'Study layout'})).toBeVisible();await page.reload();
 home=page.locator('.dashboard-home');await home.getByRole('button',{name:'Layouts'}).click();await expect(page.getByRole('button',{name:'Study layout'})).toBeVisible();
 await page.getByRole('button',{name:'Study layout'}).click();await page.getByLabel('Target workspace').selectOption(target.id);await page.getByRole('button',{name:'Copy layout'}).click();
 await expect.poll(()=>page.evaluate(({id,existingId})=>{const state=JSON.parse(localStorage.getItem('still-workspace-v2')!);const w=state.workspaces.find((item:any)=>item.id===id);return {count:w.widgets.length,preserved:w.widgets.some((item:any)=>item.id===existingId),types:w.widgets.filter((item:any)=>['calendar','focus','timetable'].includes(item.type)).length}},{id:target.id,existingId})).toEqual({count:4,preserved:true,types:3});
 await page.getByRole('button',{name:'Undo copy'}).click();
 await expect.poll(()=>page.evaluate(({id,existingId})=>{const state=JSON.parse(localStorage.getItem('still-workspace-v2')!);const w=state.workspaces.find((item:any)=>item.id===id);return {count:w.widgets.length,preserved:w.widgets.some((item:any)=>item.id===existingId)}},{id:target.id,existingId})).toEqual({count:1,preserved:true});
});

test('global layouts capture only visible Dashboard modules and restore measured geometry',async({page})=>{
 const state=createInitialState(),dashboard=state.workspaces.find(item=>item.role==='dashboard')!,target=createWorkspace('Target',['notes']);state.workspaces.push(target);
 dashboard.dashboardLayout={order:dashboard.widgets.filter(item=>item.type!=='notes').map(item=>item.id),sizes:{}};
 await page.addInitScript(data=>{localStorage.setItem('still-first-run-tutorial-v1','done');localStorage.setItem('still-workspace-v2',JSON.stringify(data))},state);
 await page.setViewportSize({width:1440,height:1000});await page.goto('/design-preview.html');const home=page.locator('.dashboard-home');await home.getByRole('button',{name:'Layouts'}).click();
 await page.getByLabel('Global layout name').fill('Visible Dashboard');await page.getByRole('button',{name:'Save complete layout'}).click();
 await expect(page.getByRole('button',{name:/Visible Dashboard/})).toBeVisible();
 const saved=await page.evaluate(()=>{const state=JSON.parse(localStorage.getItem('still-workspace-v2')!);const layout=state.globalLayouts.find((item:any)=>item.name==='Visible Dashboard');return{types:layout.widgets.map((item:any)=>item.type),dashboardLayout:layout.dashboardLayout,placements:layout.widgets.map((item:any)=>item.placement)}});
 expect(saved.types).not.toContain('notes');expect(saved.dashboardLayout.order).toHaveLength(saved.types.length);expect(saved.placements.every((item:any)=>item.width>0&&item.height>0)).toBeTruthy();
 await page.getByRole('button',{name:/Visible Dashboard/}).click();await page.getByLabel('Apply target workspace').selectOption(target.id);await page.getByLabel('Apply mode').selectOption('replace');await page.getByRole('button',{name:'Apply layout'}).click();
 await expect.poll(()=>page.evaluate(id=>{const state=JSON.parse(localStorage.getItem('still-workspace-v2')!);return state.workspaces.find((item:any)=>item.id===id).widgets.map((item:any)=>item.type)},target.id)).toEqual(saved.types);
});
