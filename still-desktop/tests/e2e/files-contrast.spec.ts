import {expect,test} from '@playwright/test';
import {createInitialState,createWidget,createWorkspace} from '../../src/domain/workspaces.ts';

test('Files widget uses readable neutral text on the glass canvas',async({page})=>{
 const state=createInitialState(),workspace=createWorkspace('Files contrast',[]),files=createWidget('files');workspace.widgets=[files];state.workspaces.push(workspace);state.activeId=workspace.id;
 await page.addInitScript(data=>{localStorage.setItem('still-first-run-tutorial-v1','done');localStorage.setItem('still-workspace-v2',JSON.stringify(data))},state);
 await page.goto('/design-preview.html');
 const card=page.locator('.canvas-card.widget-files');await expect(card).toBeVisible();
 await expect(card.locator('.files-message')).toHaveCSS('color','rgb(222, 222, 222)');
 await expect(card.locator('.files-status')).toHaveCSS('color','rgb(222, 222, 222)');
 await expect(card.getByRole('button',{name:'Choose folder'})).toHaveCSS('color','rgb(245, 245, 245)');
});
