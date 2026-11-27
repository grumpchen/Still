import {expect,test} from '@playwright/test';
import {mkdirSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createInitialState} from '../../src/domain/workspaces.ts';

test('the Files search cross exits global search and restores the previous folder and filter',async({page})=>{
 const state=createInitialState(),design=state.workspaces.find(workspace=>workspace.name==='Design')!;
 const filesId=design.widgets.find(widget=>widget.type==='files')!.id;
 const folder=mkdtempSync(join(tmpdir(),'still-search-cancel-'));
 mkdirSync(join(folder,'Week 1'));
 mkdirSync(join(folder,'Week 2'));
 writeFileSync(join(folder,'Week 1','local-notes.txt'),'Week 1 notes');
 writeFileSync(join(folder,'Week 2','exam-guide.txt'),'Week 2 exam guide');
 try{
  await page.addInitScript(state=>{
   localStorage.setItem('still-workspace-v2',JSON.stringify(state));
   localStorage.setItem('still-first-run-tutorial-v1','done');
  },state);
  await page.goto('/design-preview.html');
  await page.getByRole('button',{name:'Show sidebar'}).click();
  await page.locator('.nav button').filter({hasText:'Design'}).click();
  const files=page.locator(`[data-widget-id="${filesId}"]`);
  await files.locator('input[type=file]').setInputFiles(folder);
  await files.getByRole('button',{name:'Open folder Week 1',exact:true}).click();
  const input=files.getByRole('textbox',{name:'Search',exact:true});
  const openSearch=files.getByRole('button',{name:'Search all folders',exact:true});
  await input.fill('local');
  await openSearch.click();
  await expect(input).toBeFocused();
  await expect(input).toHaveValue('');
  await input.fill('exam');
  await files.getByRole('button',{name:'Search',exact:true}).click();
  await expect(files.getByRole('button',{name:'Preview file exam-guide.txt'})).toBeVisible();
  await files.getByRole('button',{name:'Cancel folder search',exact:true}).click();
  await expect(files.locator('.files-location')).toContainText('Week 1');
  await expect(input).toHaveValue('local');
  await expect(files.getByRole('button',{name:'Preview file local-notes.txt'})).toBeVisible();
  await expect(files.getByRole('button',{name:'Preview file exam-guide.txt'})).toHaveCount(0);
  await openSearch.click();
  await expect(input).toHaveValue('');
  await input.press('Escape');
  await expect(openSearch).toBeVisible();
 }finally{
  rmSync(folder,{recursive:true,force:true});
 }
});
