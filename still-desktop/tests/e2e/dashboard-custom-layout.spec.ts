import {expect,test} from '@playwright/test';
import {createInitialState} from '../../src/domain/workspaces.ts';

test('Dashboard starts full page, edits Browser modules transactionally, and resumes last workspace',async({page})=>{
 const state=createInitialState(),study=state.workspaces.find(item=>item.role==='study')!,dashboard=state.workspaces.find(item=>item.role==='dashboard')!;state.activeId=study.id;
 const today=new Date(),date=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`,weekday=(today.getDay()+6)%7;
 dashboard.widgets.find(item=>item.type==='calendar')!.calendarEvents=[{id:'today-event',date,title:'Exam review',time:'10:00',category:'exam'}];dashboard.widgets.find(item=>item.type==='timetable')!.schedule=[{id:'today-class',day:weekday,time:'09:00',title:'Chemistry',location:'Lab',workspaceId:study.id}];
 await page.addInitScript(({saved})=>{if(!sessionStorage.getItem('dashboard-test-seeded')){const seeded=JSON.parse(saved),weekday=(new Date().getDay()+6)%7;seeded.workspaces.find((item:any)=>item.role==='dashboard').widgets.find((item:any)=>item.type==='timetable').schedule[0].day=weekday;localStorage.setItem('still-first-run-tutorial-v1','done');localStorage.setItem('still-workspace-v2',JSON.stringify(seeded));sessionStorage.setItem('dashboard-test-seeded','yes')}}, {saved:JSON.stringify(state)});
 await page.setViewportSize({width:1440,height:1000});await page.goto('/design-preview.html');
 const home=page.locator('.dashboard-home');await expect(home).toBeVisible();await expect(page.locator('.app')).toHaveClass(/sidebar-hidden/);await expect(home.locator('.dashboard-today')).toContainText('Exam review');await expect(home.locator('.dashboard-today')).toContainText('Chemistry');
 await expect(home.locator('.dashboard-hero-actions').getByRole('button',{name:/Resume/})).toHaveCount(0);
 await home.getByRole('button',{name:'Edit Layout'}).click();const originalOrder=await home.locator('.dashboard-grid').evaluate(el=>Array.from(el.children).map(child=>(child as HTMLElement).dataset.moduleId)),calendarHead=home.locator('.dashboard-calendar-module .dashboard-module-head');await home.locator('.dashboard-focus-module .dashboard-drag-handle').dragTo(calendarHead,{targetPosition:{x:4,y:4}});await expect.poll(()=>home.locator('.dashboard-grid').evaluate(el=>Array.from(el.children).map(child=>(child as HTMLElement).dataset.moduleId))).not.toEqual(originalOrder);const calendarHeadBox=await calendarHead.boundingBox();await home.locator('.dashboard-focus-module .dashboard-drag-handle').dragTo(calendarHead,{targetPosition:{x:calendarHeadBox!.width-4,y:4}});await expect.poll(()=>home.locator('.dashboard-grid').evaluate(el=>Array.from(el.children).map(child=>(child as HTMLElement).dataset.moduleId))).toEqual(originalOrder);await page.getByLabel('Add module').selectOption('browser');await page.getByRole('button',{name:'Add module'}).click();
 const browser=home.locator('.dashboard-browser-module');await expect(browser).toBeVisible();await browser.getByRole('button',{name:'Saved links',exact:true}).click();await browser.getByRole('button',{name:'Add web shortcut'}).click();await browser.getByLabel('Shortcut name').fill('Course');await browser.getByLabel('Shortcut URL').fill('https://example.com');await browser.getByRole('button',{name:'Save shortcut'}).click();
 await home.locator('.dashboard-hero-actions').getByRole('button',{name:'Cancel'}).click();await expect(home.locator('.dashboard-browser-module')).toHaveCount(0);await expect(home.locator('.dashboard-grid').evaluate(el=>Array.from(el.children).map(child=>(child as HTMLElement).dataset.moduleId))).resolves.toEqual(originalOrder);
 await home.getByRole('button',{name:'Edit Layout'}).click();await home.getByLabel('Add module').selectOption('browser');await home.getByRole('button',{name:'Add module'}).click();await home.getByRole('button',{name:'Done'}).click();
 await expect(home.locator('.dashboard-browser-module')).toBeVisible();await page.reload();await expect(page.locator('.dashboard-browser-module')).toBeVisible();
 await page.getByRole('button',{name:'Show sidebar'}).click();await page.locator('.nav button').filter({hasText:'Study'}).click();await expect(page.locator('.nav button.active .nav-name')).toHaveText('Study');
});

test('Dashboard keeps its Focus timer without a Focus Mode control',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('still-first-run-tutorial-v1','done'));
 await page.goto('/design-preview.html');
 await expect(page.locator('.dashboard-focus-module')).toBeVisible();
 await expect(page.getByRole('button',{name:/focus mode/i})).toHaveCount(0);
});
