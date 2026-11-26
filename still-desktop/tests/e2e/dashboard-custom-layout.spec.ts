import {expect,test} from '@playwright/test';
import {createInitialState} from '../../src/domain/workspaces.ts';

test('Dashboard starts full page, edits Browser modules transactionally, and resumes last workspace',async({page})=>{
 const state=createInitialState(),study=state.workspaces.find(item=>item.role==='study')!;
 await page.addInitScript(({saved,resumeId})=>{if(!sessionStorage.getItem('dashboard-test-seeded')){localStorage.setItem('still-first-run-tutorial-v1','done');localStorage.setItem('still-workspace-v2',saved);localStorage.setItem('still-last-workspace-v1',resumeId);sessionStorage.setItem('dashboard-test-seeded','yes')}}, {saved:JSON.stringify(state),resumeId:study.id});
 await page.setViewportSize({width:1440,height:1000});await page.goto('/design-preview.html');
 const home=page.locator('.dashboard-home');await expect(home).toBeVisible();await expect(page.locator('.app')).toHaveClass(/sidebar-hidden/);await expect(home.locator('.dashboard-today')).toBeVisible();
 await expect(home.getByRole('button',{name:'Resume Study'})).toBeVisible();
 await home.getByRole('button',{name:'Edit Layout'}).click();await home.getByLabel('Add module').selectOption('browser');await home.getByRole('button',{name:'Add module'}).click();
 const browser=home.locator('.dashboard-browser-module');await expect(browser).toBeVisible();await browser.getByRole('button',{name:'Saved links',exact:true}).click();await browser.getByRole('button',{name:'Add web shortcut'}).click();await browser.getByLabel('Shortcut name').fill('Course');await browser.getByLabel('Shortcut URL').fill('https://example.com');await browser.getByRole('button',{name:'Save shortcut'}).click();
 await home.locator('.dashboard-hero-actions').getByRole('button',{name:'Cancel'}).click();await expect(home.locator('.dashboard-browser-module')).toHaveCount(0);
 await home.getByRole('button',{name:'Edit Layout'}).click();await home.getByLabel('Add module').selectOption('browser');await home.getByRole('button',{name:'Add module'}).click();await home.getByRole('button',{name:'Done'}).click();
 await expect(home.locator('.dashboard-browser-module')).toBeVisible();await page.reload();await expect(page.locator('.dashboard-browser-module')).toBeVisible();
 await page.locator('.dashboard-hero-actions').getByRole('button',{name:'Resume Study'}).click();await expect(page.locator('.nav button.active .nav-name')).toHaveText('Study');
});
