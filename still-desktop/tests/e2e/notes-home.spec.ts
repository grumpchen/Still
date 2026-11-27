import {expect,test} from '@playwright/test';
import {createInitialState,createWidget} from '../../src/domain/workspaces.ts';
import {createNoteDocument} from '../../src/domain/noteDocuments.ts';

test('Notes home shares closed notes and Markdown history across workspaces and reloads',async({page})=>{
 const state=createInitialState(),design=state.workspaces.find(workspace=>workspace.name==='Design')!,study=state.workspaces.find(workspace=>workspace.name==='Study')!;
 const first=createWidget('notes'),second=createWidget('notes');
 const current={...createNoteDocument('Physics revision'),text:'Original revision text.'};
 const linked={...createNoteDocument('Reading.md'),text:'Existing linked Markdown.',sourcePath:'Week 1/Reading.md'};
 first.noteDocuments=[current,linked];first.activeNoteDocumentId=current.id;first.title=current.title;first.text=current.text;
 design.widgets=[first];study.widgets=[second];
 await page.addInitScript(state=>{
  if(!localStorage.getItem('still-workspace-v2'))localStorage.setItem('still-workspace-v2',JSON.stringify(state));
  localStorage.setItem('still-first-run-tutorial-v1','done');
 },state);
 const showWorkspace=async(name:string)=>{
  const show=page.getByRole('button',{name:'Show sidebar',exact:true});
  if(await show.isVisible())await show.click();
  await page.locator('.nav button').filter({has:page.locator('.nav-name',{hasText:new RegExp('^'+name+'$')})}).click();
 };
 const widget=(id:string)=>page.locator(`[data-widget-id="${id}"]`);
 const home=page.getByRole('dialog',{name:'Notes home',exact:true});
 const openHome=async(id:string)=>{
  await widget(id).getByRole('button',{name:'Notes home',exact:true}).click();
  await expect(home).toBeVisible();
 };
 await page.goto('/design-preview.html');
 await showWorkspace('Design');
 await expect(widget(first.id).getByRole('button',{name:'Open library',exact:true})).toHaveCount(0);
 await widget(first.id).getByRole('button',{name:'Close Physics revision',exact:true}).click();
 await showWorkspace('Study');
 await openHome(second.id);
 await home.getByRole('button',{name:/Physics revision/}).click();
 await expect(home.getByRole('textbox',{name:'Note text'})).toHaveValue('Original revision text.');
 await home.getByRole('textbox',{name:'Note text'}).fill('Updated from a different workspace.');
 await home.locator('input[type=file]').setInputFiles({name:'Week 2.md',mimeType:'text/markdown',buffer:Buffer.from('# Week 2')});
 await expect(home.getByRole('textbox',{name:'Note text'})).toHaveValue('# Week 2');
 await expect(home.getByRole('button',{name:/Reading\.md/})).toBeVisible();
 await home.getByRole('button',{name:'Close dialog',exact:true}).click();
 await page.reload();
 await showWorkspace('Design');
 await openHome(first.id);
 await home.getByRole('button',{name:'Markdown history',exact:true}).click();
 await expect(home.getByRole('button',{name:/Week 2/})).toBeVisible();
 await home.getByRole('button',{name:'All notes',exact:true}).click();
 await home.getByRole('button',{name:/Physics revision/}).click();
 await expect(home.getByRole('textbox',{name:'Note text'})).toHaveValue('Updated from a different workspace.');
 page.once('dialog',dialog=>dialog.accept());
 await home.getByRole('button',{name:'Delete note',exact:true}).click();
 await expect(home.getByRole('button',{name:/Physics revision/})).toHaveCount(0);
});
