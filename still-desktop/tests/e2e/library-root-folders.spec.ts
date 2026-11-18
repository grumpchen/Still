import {expect,test} from '@playwright/test';
import {createInitialState,createWorkspace,createWidget} from '../../src/domain/workspaces.ts';

test('Library shows root Files folders across workspaces without Notes workspace links',async({page})=>{
 const state=createInitialState();
 const first=state.workspaces.find(workspace=>workspace.role==='library')!;
 const firstFolder=createWidget('files');firstFolder.folderName='Biology';first.widgets.push(firstFolder);
 const second=createWorkspace('Research',[]),secondFolder=createWidget('files');secondFolder.folderName='Physics';second.widgets=[secondFolder];state.workspaces.push(second);
 await page.addInitScript(data=>{localStorage.setItem('still-first-run-tutorial-v1','done');localStorage.setItem('still-workspace-v2',JSON.stringify(data))},state);
 await page.goto('/design-preview.html');
 await page.getByRole('button',{name:'Library',exact:true}).click();
 const library=page.locator('.library-home'),rail=library.locator('.library-rail-group');
 await expect(rail.getByText('All workspaces')).toBeVisible();
 await expect(rail.getByRole('button',{name:'Biology',exact:true})).toBeVisible();
 await expect(rail.getByRole('button',{name:'Physics',exact:true})).toBeVisible();
 await expect(rail.getByRole('button',{name:'Notes',exact:true})).toHaveCount(0);
 await expect(rail.getByText('Research',{exact:true})).toHaveCount(0);
 await expect(rail.getByRole('button',{name:'Search library',exact:true})).toBeVisible();
 await rail.getByRole('button',{name:'Physics',exact:true}).click();
 await expect(library.locator('.library-page-header h2')).toHaveText('Physics');
});
