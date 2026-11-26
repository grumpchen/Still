import {expect,test} from '@playwright/test';
import {createInitialState} from '../../src/domain/workspaces.ts';

test('saved course session opens Dashboard and resumes with course content intact',async({page})=>{
 const state=createInitialState(),course=state.workspaces.find(w=>w.role==='study')!;
 course.name='Physics';state.activeId=course.id;
 const notes=course.widgets.find(w=>w.type==='notes')!;notes.title='Retained course notes';notes.noteDocuments[0].title='Retained course notes';notes.noteDocuments[0].text='Newton laws retained across restart';notes.text=notes.noteDocuments[0].text;
 await page.addInitScript(({state})=>{if(!sessionStorage.getItem('recovery-fixture')){localStorage.setItem('still-workspace-v2',JSON.stringify(state));localStorage.setItem('still-first-run-tutorial-v1','done');sessionStorage.setItem('recovery-fixture','1')}},{state});
 await page.goto('/design-preview.html');
 await expect(page.locator('.dashboard-home')).toBeVisible();
 await page.getByRole('button',{name:'Resume Physics',exact:true}).click();
 await expect(page.locator('.workspace-surface:not([hidden])')).toContainText('Retained course notes');
 await page.reload();
 await expect(page.locator('.dashboard-home')).toBeVisible();
 await page.getByRole('button',{name:'Resume Physics',exact:true}).click();
 await expect(page.locator('.workspace-surface:not([hidden])')).toContainText('Retained course notes');
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('still-workspace-v2')!));
 const savedNotes=saved.workspaces.find((w:any)=>w.id===course.id).widgets.find((w:any)=>w.id===notes.id);
 expect(savedNotes.title).toBe('Retained course notes');
 expect(savedNotes.noteDocuments[0].text).toBe('Newton laws retained across restart');
});
