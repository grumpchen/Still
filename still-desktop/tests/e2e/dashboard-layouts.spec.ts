import {expect,test} from '@playwright/test';
import {createInitialState,createWorkspace,createWidget} from '../../src/domain/workspaces.ts';

test('legacy size-only preset upgrades current Dashboard content and applies saved sizes',async({page})=>{
 const state=createInitialState(),dashboard=state.workspaces.find(workspace=>workspace.role==='dashboard')!,target=createWorkspace('Project',[]),notes=createWidget('notes');notes.noteDocuments[0].title='Current notes';notes.noteDocuments[0].text='Content added today';dashboard.widgets.push(notes);dashboard.dashboardLayout={order:[notes.id],sizes:{}};state.workspaces.push(target);
 await page.addInitScript(({data,notesId})=>{localStorage.setItem('still-first-run-tutorial-v1','done');localStorage.setItem('still-workspace-v2',JSON.stringify(data));localStorage.setItem('still-dashboard-layouts-v1',JSON.stringify([{id:'old-preset',name:'Old sizes',sizes:{[notesId]:{width:610,height:420}}}]))},{data:state,notesId:notes.id});
 await page.setViewportSize({width:1440,height:1000});await page.goto('/design-preview.html');const home=page.locator('.dashboard-home');await home.getByRole('button',{name:'Layouts'}).click();
 await page.getByRole('button',{name:'Old sizes'}).click();await expect(page.getByText(/contains sizes only/)).toBeVisible();await expect(page.getByRole('button',{name:'Copy layout'})).toHaveCount(0);
 await page.getByLabel('Complete layout name').fill('Upgraded current content');await page.getByRole('button',{name:'Save complete layout'}).last().click();
 const saved=await page.evaluate(()=>{const state=JSON.parse(localStorage.getItem('still-workspace-v2')!);const layout=state.globalLayouts.find((item:any)=>item.name==='Upgraded current content');return{widgets:layout.widgets,dashboardLayout:layout.dashboardLayout}});
 expect(saved.widgets).toHaveLength(1);expect(saved.widgets[0].title).toBe('Current notes');expect(saved.widgets[0].noteDocuments[0].text).toBe('Content added today');expect(saved.widgets[0].placement.width).toBe(610);expect(saved.widgets[0].placement.height).toBe(420);expect(saved.dashboardLayout.order).toHaveLength(1);
 await page.getByRole('button',{name:/Upgraded current content/}).click();await page.getByLabel('Apply target workspace').selectOption(target.id);await page.getByLabel('Apply mode').selectOption('replace');await page.getByRole('button',{name:'Apply layout'}).click();
 await expect.poll(()=>page.evaluate(id=>{const state=JSON.parse(localStorage.getItem('still-workspace-v2')!);const widget=state.workspaces.find((item:any)=>item.id===id).widgets[0];return{title:widget.title,text:widget.noteDocuments[0].text,width:widget.placement.width,height:widget.placement.height}},target.id)).toEqual({title:'Current notes',text:'Content added today',width:610,height:420});
});

test('global layouts capture only visible Dashboard modules and restore measured geometry',async({page})=>{
 const state=createInitialState(),dashboard=state.workspaces.find(item=>item.role==='dashboard')!,target=createWorkspace('Target',['notes']);state.workspaces.push(target);
 dashboard.dashboardLayout={order:dashboard.widgets.filter(item=>item.type!=='notes').map(item=>item.id),sizes:{}};
 await page.addInitScript(data=>{localStorage.setItem('still-first-run-tutorial-v1','done');localStorage.setItem('still-workspace-v2',JSON.stringify(data))},state);
 await page.setViewportSize({width:1440,height:1000});await page.goto('/design-preview.html');const home=page.locator('.dashboard-home');await home.getByRole('button',{name:'Layouts'}).click();
 await page.getByLabel('Global layout name').fill('Visible Dashboard');await page.getByRole('button',{name:'Save complete layout'}).last().click();
 await expect(page.getByRole('button',{name:/Visible Dashboard/})).toBeVisible();
 const saved=await page.evaluate(()=>{const state=JSON.parse(localStorage.getItem('still-workspace-v2')!);const layout=state.globalLayouts.find((item:any)=>item.name==='Visible Dashboard');return{types:layout.widgets.map((item:any)=>item.type),dashboardLayout:layout.dashboardLayout,placements:layout.widgets.map((item:any)=>item.placement)}});
 expect(saved.types).not.toContain('notes');expect(saved.dashboardLayout.order).toHaveLength(saved.types.length);expect(saved.placements.every((item:any)=>item.width>0&&item.height>0)).toBeTruthy();
 await page.getByRole('button',{name:/Visible Dashboard/}).click();await page.getByLabel('Apply target workspace').selectOption(target.id);await page.getByLabel('Apply mode').selectOption('replace');await page.getByRole('button',{name:'Apply layout'}).click();
 await expect.poll(()=>page.evaluate(id=>{const state=JSON.parse(localStorage.getItem('still-workspace-v2')!);return state.workspaces.find((item:any)=>item.id===id).widgets.map((item:any)=>item.type)},target.id)).toEqual(saved.types);
});
