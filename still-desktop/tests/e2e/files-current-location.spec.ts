import {expect,test} from '@playwright/test';
import {mkdirSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {basename,join} from 'node:path';
import {createInitialState} from '../../src/domain/workspaces.ts';

test('Still AI reports the focused Files subdirectory and its actual preview without a provider',async({page})=>{
 const state=createInitialState(),design=state.workspaces.find(item=>item.name==='Design')!;
 const filesId=design.widgets.find(item=>item.type==='files')!.id;
 const folder=mkdtempSync(join(tmpdir(),'still-current-files-'));
 mkdirSync(join(folder,'Week 1'));
 writeFileSync(join(folder,'Week 1','lecture.txt'),'Course notes');
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
  await page.evaluate(()=>window.dispatchEvent(new Event('still-open-assistant')));
  const assistant=page.locator('#ai-sidebar');
  const ask=async()=>{
   await assistant.getByLabel('Message Still AI').fill('what page am i on  in the files widget');
   await assistant.getByRole('button',{name:'Send',exact:true}).click();
  };
  await ask();
  const folderReply=`Files is open to “${basename(folder)} / Week 1”.`;
  await expect(assistant.getByText(folderReply,{exact:true})).toBeVisible();
  await expect(assistant.getByText(/You’re previewing/)).toHaveCount(0);
  await files.getByRole('button',{name:'Preview file lecture.txt',exact:true}).click();
  await expect(files.locator('.file-preview-text')).toHaveText('Course notes');
  await ask();
  await expect(assistant.getByText(`${folderReply} You’re previewing “lecture.txt”.`,{exact:true})).toBeVisible();
 }finally{
  rmSync(folder,{recursive:true,force:true});
 }
});
