import {expect,test} from '@playwright/test';
import {createInitialState} from '../../src/domain/workspaces.ts';

test('Dashboard starts full page, edits Browser modules transactionally, and resumes last workspace',async({page})=>{
 const state=createInitialState(),study=state.workspaces.find(item=>item.role==='study')!,dashboard=state.workspaces.find(item=>item.role==='dashboard')!;state.activeId=study.id;
 const today=new Date(),date=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`,weekday=(today.getDay()+6)%7;
 dashboard.widgets.find(item=>item.type==='calendar')!.calendarEvents=[{id:'today-event',date,title:'Exam review',time:'10:00',category:'exam'}];dashboard.widgets.find(item=>item.type==='timetable')!.schedule=[{id:'today-class',day:weekday,time:'09:00',title:'Chemistry',location:'Lab',workspaceId:study.id}];
 await page.addInitScript(({saved})=>{if(!sessionStorage.getItem('dashboard-test-seeded')){const seeded=JSON.parse(saved),weekday=(new Date().getDay()+6)%7;seeded.workspaces.find((item:any)=>item.role==='dashboard').widgets.find((item:any)=>item.type==='timetable').schedule[0].day=weekday;localStorage.setItem('still-first-run-tutorial-v1','done');localStorage.setItem('still-workspace-v2',JSON.stringify(seeded));sessionStorage.setItem('dashboard-test-seeded','yes')}}, {saved:JSON.stringify(state)});
 await page.setViewportSize({width:1440,height:1000});await page.goto('/design-preview.html');
 const home=page.locator('.dashboard-home');await expect(home).toBeVisible();await expect(page.locator('.app')).toHaveClass(/sidebar-hidden/);await expect(home.locator('.dashboard-today')).toContainText('Exam review');await expect(home.locator('.dashboard-today')).toContainText('Chemistry');
 await expect(home.getByRole('button',{name:'Resume Study'})).toBeVisible();
 await home.getByRole('button',{name:'Edit Layout'}).click();await home.getByLabel('Add module').selectOption('browser');await home.getByRole('button',{name:'Add module'}).click();
 const browser=home.locator('.dashboard-browser-module');await expect(browser).toBeVisible();await browser.getByRole('button',{name:'Add web shortcut'}).click();await browser.getByLabel('Shortcut name').fill('Course');await browser.getByLabel('Shortcut URL').fill('https://example.com');await browser.getByRole('button',{name:'Save shortcut'}).click();
 await home.locator('.dashboard-hero-actions').getByRole('button',{name:'Cancel'}).click();await expect(home.locator('.dashboard-browser-module')).toHaveCount(0);
 await home.getByRole('button',{name:'Edit Layout'}).click();await home.getByLabel('Add module').selectOption('browser');await home.getByRole('button',{name:'Add module'}).click();await home.getByRole('button',{name:'Done'}).click();
 await expect(home.locator('.dashboard-browser-module')).toBeVisible();await page.reload();await expect(page.locator('.dashboard-browser-module')).toBeVisible();
 await page.locator('.dashboard-hero-actions').getByRole('button',{name:'Resume Study'}).click();await expect(page.locator('.nav button.active .nav-name')).toHaveText('Study');
});

test('focus mode hides workspace chrome and keeps a visible exit control',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('still-first-run-tutorial-v1','done'));
 await page.goto('/design-preview.html');const app=page.locator('.app');await expect(app).not.toHaveClass(/focus-mode/);
 await page.getByRole('button',{name:'Enter focus mode'}).first().click();await expect(app).toHaveClass(/focus-mode/);
 const exit=page.getByRole('button',{name:'Exit focus mode'}).last();await expect(exit).toBeVisible();await exit.click();await expect(app).not.toHaveClass(/focus-mode/);
});
