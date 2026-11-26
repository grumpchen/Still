import {readFileSync} from 'node:fs';
import {expect,test,type Page} from '@playwright/test';
import {createInitialState,createWorkspace} from '../../src/domain/workspaces.ts';
import {AUTOMATION_STORAGE_KEY} from '../../src/domain/automationRules.ts';

async function fixture(page:Page){
 const state=createInitialState(),physics=createWorkspace('Physics',['notes','files','focus']),chemistry=createWorkspace('Chemistry',['notes']);
 state.workspaces.push(physics,chemistry);
 await page.addInitScript(state=>{if(!sessionStorage.getItem('workbench-acceptance-seeded')){localStorage.setItem('still-workspace-v2',JSON.stringify(state));localStorage.setItem('still-first-run-tutorial-v1','done');sessionStorage.setItem('workbench-acceptance-seeded','1')}},state);
 await page.setViewportSize({width:1440,height:1000});await page.goto('/design-preview.html');
 return{state,physics,chemistry};
}
async function saved(page:Page){return page.evaluate(()=>JSON.parse(localStorage.getItem('still-workspace-v2')!))}
async function openCapture(page:Page){await page.locator('.topbar').getByRole('button',{name:'Capture',exact:true}).click();return page.locator('.quick-capture-dialog')}
async function saveLink(page:Page,workspaceId:string,name:string,url:string){const dialog=await openCapture(page);await dialog.getByRole('button',{name:'Web link',exact:true}).click();await dialog.getByLabel('Choose course').selectOption(workspaceId);await dialog.getByLabel('Link name').fill(name);await dialog.getByLabel('URL',{exact:true}).fill(url);await dialog.getByRole('button',{name:'Save',exact:true}).click();await expect(dialog).not.toBeVisible()}
async function navigate(page:Page,name:string){const toggle=page.locator('.topbar .sidebar-toggle');if(await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();await page.locator('.nav button').filter({has:page.locator('.nav-name',{hasText:new RegExp(`^${name}$`)})}).click()}

test('capture explicitly chooses courses; Library edits originals; full template appends, replaces and undoes',async({page})=>{
 test.setTimeout(60000);const {physics,chemistry}=await fixture(page);
 let capture=await openCapture(page);await capture.getByLabel('Title',{exact:true}).fill('Captured thought');await capture.getByLabel('Idea',{exact:true}).fill('Keep this idea in Physics.');await capture.getByRole('button',{name:'Save',exact:true}).click();await expect(capture.getByRole('alert')).toContainText('Choose a course');await capture.getByLabel('Choose course').selectOption(physics.id);await capture.getByRole('button',{name:'Save',exact:true}).click();await expect(capture).not.toBeVisible();
 await saveLink(page,physics.id,'Lecture resources','https://example.edu/lecture');
 capture=await openCapture(page);await expect(capture.getByLabel('Choose course')).toHaveValue('');await capture.getByRole('button',{name:'PDF',exact:true}).click();await capture.getByLabel('Choose course').selectOption(physics.id);await capture.locator('input[type=file]').setInputFiles({name:'lecture.pdf',mimeType:'application/pdf',buffer:readFileSync('tests/fixtures/save-selection-citation.pdf')});await expect(capture).not.toBeVisible();
 await expect.poll(async()=>{const s=await saved(page);return s.workspaces.find((w:any)=>w.id===physics.id).widgets.some((w:any)=>w.type==='files'&&w.fileKey&&w.fileName==='lecture.pdf')}).toBe(true);
 await page.locator('.dashboard-hero-actions').getByRole('button',{name:'Library',exact:true}).click();const library=page.locator('.library-home');await expect(library.getByRole('button',{name:'Notes',exact:true})).toHaveCount(0);await library.getByRole('button',{name:'Saved links',exact:true}).click();const link=library.locator('.library-link-card').filter({hasText:'Lecture resources'});await link.getByRole('button',{name:'Rename',exact:true}).click();await link.locator('.library-link-edit input').fill('Week 1 materials');await link.getByRole('button',{name:'Save',exact:true}).click();
 await expect.poll(async()=>{const s=await saved(page);return s.workspaces.find((w:any)=>w.id===physics.id).groups.flatMap((g:any)=>g.shortcuts).some((l:any)=>l.name==='Week 1 materials')}).toBe(true);
 await navigate(page,'Physics');await page.locator('.topbar').getByRole('button',{name:'Save layout',exact:true}).click();const saveDialog=page.getByRole('dialog',{name:'Save layout',exact:true});await saveDialog.getByLabel('Layout name').fill('Course setup');await saveDialog.getByRole('button',{name:'Save',exact:true}).click();await expect(saveDialog).not.toBeVisible();
 const before=await saved(page),template=before.globalLayouts.find((l:any)=>l.name==='Course setup'),original=before.workspaces.find((w:any)=>w.id===chemistry.id).widgets[0].id;
 expect(template.widgets.some((w:any)=>w.noteDocuments.some((d:any)=>d.text==='Keep this idea in Physics.'))).toBe(true);expect(template.widgets.some((w:any)=>w.fileName==='lecture.pdf'&&w.fileKey)).toBe(true);
 await navigate(page,'Dashboard');await page.locator('.dashboard-hero-actions').getByRole('button',{name:'Layouts',exact:true}).click();const manager=page.locator('.global-layout-manager');await manager.locator('.global-layout-select').filter({hasText:'Course setup'}).click();await manager.getByLabel('Apply target workspace').selectOption(chemistry.id);await manager.getByLabel('Apply mode').selectOption('append');await manager.getByRole('button',{name:'Apply layout',exact:true}).click();
 await expect.poll(async()=>{const s=await saved(page);return s.workspaces.find((w:any)=>w.id===chemistry.id).widgets.length}).toBe(template.widgets.length+1);
 let target=(await saved(page)).workspaces.find((w:any)=>w.id===chemistry.id);expect(target.widgets.some((w:any)=>w.id===original)).toBe(true);expect(target.widgets.some((w:any)=>w.noteDocuments.some((d:any)=>d.text==='Keep this idea in Physics.'))).toBe(true);
 await navigate(page,'Dashboard');await manager.getByRole('button',{name:'Undo last layout change',exact:true}).click();await expect.poll(async()=>{const s=await saved(page);return s.workspaces.find((w:any)=>w.id===chemistry.id).widgets.map((w:any)=>w.id)}).toEqual([original]);
 await manager.getByLabel('Apply target workspace').selectOption(chemistry.id);await manager.getByLabel('Apply mode').selectOption('replace');await manager.getByRole('button',{name:'Apply layout',exact:true}).click();target=(await saved(page)).workspaces.find((w:any)=>w.id===chemistry.id);expect(target.widgets).toHaveLength(template.widgets.length);expect(target.widgets.some((w:any)=>w.id===original)).toBe(false);
});

test('one sentence in Still AI saves a persistent rule and a real capture is filed once with receipts',async({page})=>{
 test.setTimeout(60000);const {physics,chemistry}=await fixture(page);
 await page.locator('.dashboard-hero-actions').getByRole('button',{name:'Ask AI',exact:true}).click();const assistant=page.locator('#ai-sidebar');await assistant.getByLabel('Message Still AI').fill('When I capture links matching "lecture", file them to Physics course');await assistant.getByRole('button',{name:'Send',exact:true}).click();await expect(assistant).toContainText('Saved the automation rule.');
 await expect.poll(()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).rules.length,AUTOMATION_STORAGE_KEY)).toBe(1);
 await assistant.locator('.assistant-heading button').last().click();
 await saveLink(page,chemistry.id,'lecture notes','https://example.edu/lecture-notes');
 await expect.poll(async()=>{const s=await saved(page);return s.workspaces.find((w:any)=>w.id===physics.id).groups.flatMap((g:any)=>g.shortcuts).filter((l:any)=>l.name==='lecture notes').length},{timeout:10000}).toBe(1);
 await expect.poll(()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).receipts.some((r:any)=>r.status==='succeeded'),AUTOMATION_STORAGE_KEY)).toBe(true);
 await page.locator('.topbar').getByRole('button',{name:'Rules',exact:true}).click();let rules=page.getByRole('dialog',{name:'Rules',exact:true});await expect(rules).toContainText('succeeded');await rules.getByRole('button',{name:'Run due now',exact:true}).click();await rules.locator('.dialog-head button').click();
 await page.reload();await page.locator('.topbar').getByRole('button',{name:'Rules',exact:true}).click();rules=page.getByRole('dialog',{name:'Rules',exact:true});await rules.getByRole('button',{name:'Run due now',exact:true}).click();const s=await saved(page);expect(s.workspaces.find((w:any)=>w.id===physics.id).groups.flatMap((g:any)=>g.shortcuts).filter((l:any)=>l.name==='lecture notes')).toHaveLength(1);expect(s.workspaces.find((w:any)=>w.id===chemistry.id).groups.flatMap((g:any)=>g.shortcuts).filter((l:any)=>l.name==='lecture notes')).toHaveLength(0);
});
