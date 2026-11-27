import {readFileSync} from 'node:fs';
import {expect,test,type Page} from '@playwright/test';
import {createInitialState,createWorkspace,createGlobalWorkspaceLayout} from '../../src/domain/workspaces.ts';
import {AUTOMATION_STORAGE_KEY} from '../../src/domain/automationRules.ts';

async function fixture(page:Page,withTemplate=false){
 const state=createInitialState(),physics=createWorkspace('Physics',['notes','files','focus']),chemistry=createWorkspace('Chemistry',['notes']);
 state.workspaces.push(physics,chemistry);
 if(withTemplate){const notes=physics.widgets.find(w=>w.type==='notes')!;notes.noteDocuments[0].text='Prepared course material';notes.text=notes.noteDocuments[0].text;state.globalLayouts.push(createGlobalWorkspaceLayout('Ready set',physics,state))}
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
 await page.getByRole('button',{name:'Show sidebar'}).click();await page.locator('.nav button').filter({hasText:'Library'}).click();const library=page.locator('.library-home');await expect(library.getByRole('button',{name:'Notes',exact:true})).toHaveCount(0);await library.getByRole('button',{name:'Saved links',exact:true}).click();const link=library.locator('.library-link-card').filter({hasText:'Lecture resources'});await link.getByRole('button',{name:'Rename',exact:true}).click();await link.locator('.library-link-edit input').fill('Week 1 materials');await link.getByRole('button',{name:'Save',exact:true}).click();
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


test('scheduled layout rule prepares a course automatically without changing the current workspace or firing twice',async({page})=>{
 test.setTimeout(60000);const {state,physics,chemistry}=await fixture(page,true);const before=chemistry.widgets.length;
 await page.locator('.dashboard-hero-actions').getByRole('button',{name:'Ask AI',exact:true}).click();const assistant=page.locator('#ai-sidebar');const at=new Date(Date.now()+1000).toISOString().slice(0,19)+'Z';await assistant.getByLabel('Message Still AI').fill(`Save a rule: at ${at} append Ready set layout to Chemistry workspace`);await assistant.getByRole('button',{name:'Send',exact:true}).click();await expect(assistant).toContainText('Saved the automation rule.');await assistant.locator('.assistant-heading button').last().click();
 await expect.poll(async()=>{const s=await saved(page);return s.workspaces.find((w:any)=>w.id===chemistry.id).widgets.length},{timeout:22000}).toBe(before+physics.widgets.length);
 expect((await saved(page)).activeId).toBe(state.workspaces.find(w=>w.role==='dashboard')!.id);
 await page.locator('.topbar').getByRole('button',{name:'Rules',exact:true}).click();const rules=page.getByRole('dialog',{name:'Rules',exact:true});await expect(rules).toContainText('succeeded');await rules.getByRole('button',{name:'Run due now',exact:true}).click();await rules.locator('.dialog-head button').click();await page.reload();await expect.poll(async()=>{const s=await saved(page);return s.workspaces.find((w:any)=>w.id===chemistry.id).widgets.length}).toBe(before+physics.widgets.length);
});

test('Rules panel saves a supported once rule and Run due now reports and performs its layout action',async({page})=>{
 test.setTimeout(60000);const {physics,chemistry}=await fixture(page,true),before=chemistry.widgets.length;
 await page.locator('.topbar').getByRole('button',{name:'Rules',exact:true}).click();const rules=page.getByRole('dialog',{name:'Rules',exact:true});
 await expect(rules.getByText('Supported rule examples')).toBeVisible();
 await expect(rules.getByText('No automation rules yet.')).toBeVisible();await rules.getByRole('button',{name:'Run due now',exact:true}).click();await expect(rules.getByRole('status')).toContainText('No scheduled rules were due.');
 await rules.getByLabel('Create a rule in one sentence').fill('When the moon is purple, reorganize everything');await rules.getByRole('button',{name:'Save rule',exact:true}).click();await expect(rules.getByRole('alert')).toContainText('Supported filing form');await expect(rules.getByText('No automation rules yet.')).toBeVisible();
 const past=new Date(Date.now()-60_000).toISOString().slice(0,16).replace('T',' '),sentence=`At ${past} append Ready set layout to Chemistry workspace`;
 await rules.getByLabel('Create a rule in one sentence').fill(sentence);await rules.getByRole('button',{name:'Save rule',exact:true}).click();await expect(rules.getByRole('status')).toContainText('Automation saved.');
 await expect(rules.locator('.automation-rule')).toHaveCount(1);await rules.getByRole('button',{name:'Run due now',exact:true}).click();await expect(rules.getByRole('status')).toContainText('due rule(s) ran successfully.');
 await expect.poll(async()=>{const s=await saved(page);return s.workspaces.find((w:any)=>w.id===chemistry.id).widgets.length}).toBe(before+physics.widgets.length);
 await expect(rules.locator('.automation-receipt-succeeded')).toBeVisible();
});

test('AI layout rule with missing mode asks for append or replace before saving',async({page})=>{
 const {chemistry}=await fixture(page,true);await page.locator('.dashboard-hero-actions').getByRole('button',{name:'Ask AI',exact:true}).click();const assistant=page.locator('#ai-sidebar');await assistant.getByLabel('Message Still AI').fill('Save a rule: Every day at 09:00 prepare Chemistry using Ready set layout');await assistant.getByRole('button',{name:'Send',exact:true}).click();const rules=page.getByRole('dialog',{name:'Rules',exact:true});await expect(rules.getByLabel('Layout application mode')).toBeVisible();expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'{"rules":[]}').rules.length,AUTOMATION_STORAGE_KEY)).toBe(0);await rules.getByLabel('Layout application mode').selectOption('replace');await rules.getByRole('button',{name:'Save with selected mode',exact:true}).click();const stored=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),AUTOMATION_STORAGE_KEY);expect(stored.rules).toHaveLength(1);expect(stored.rules[0].action).toMatchObject({kind:'prepareWorkspaceLayout',workspaceId:chemistry.id,mode:'replace'});
});
