import {expect,test} from '@playwright/test';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createInitialState} from '../../src/domain/workspaces.ts';
import {mockAssistant} from './helpers/mock-assistant';

test('Ask AI executes the provider operation and reports the actual copied workspace',async({page})=>{
 const state=createInitialState(),design=state.workspaces.find(item=>item.name==='Design')!;
 await mockAssistant(page);
 await page.addInitScript(state=>{
  localStorage.setItem('still-workspace-v2',JSON.stringify(state));
  localStorage.setItem('still-first-run-tutorial-v1','done');
  localStorage.setItem('still-assistant-share-workspace-image','false');
  localStorage.setItem('still-assistant-model','deepseek::mock-model');
 },state);
 await page.goto('/design-preview.html');
 await page.evaluate(id=>{
  const ipc=(window as any).__TAURI_INTERNALS__,invoke=ipc.invoke;
  ipc.invoke=(cmd:string,args:any)=>cmd==='assistant_chat'?Promise.resolve({
   intent:'workspace_action',reply:'This speculative text should be discarded.',layout:[],actions:[],
   workbenchActions:[{operation:'workspace.duplicate',workspaceId:id,name:'Practice'}]
  }):invoke(cmd,args);
 },design.id);
 await page.getByRole('button',{name:'Ask AI',exact:true}).click();
 const assistant=page.locator('#ai-sidebar');
 await assistant.getByLabel('Message Still AI').fill('Make an independent copy of Design for practice.');
 await assistant.getByRole('button',{name:'Send',exact:true}).click();
 await expect(assistant).toContainText('Created “Practice” from “Design”.');
 await expect(assistant).not.toContainText('speculative');
 const copy=await page.evaluate(()=>JSON.parse(localStorage.getItem('still-workspace-v2')!).workspaces.find((item:any)=>item.name==='Practice'));
 expect(copy.widgets.map((widget:any)=>widget.type)).toEqual(design.widgets.map(widget=>widget.type));
 expect(copy.widgets[0].id).not.toBe(design.widgets[0].id);
});

test('Files view commands share the real preview, search and reading controls',async({page})=>{
 const state=createInitialState(),design=state.workspaces.find(item=>item.name==='Design')!;
 const filesId=design.widgets.find(widget=>widget.type==='files')!.id;
 const folder=mkdtempSync(join(tmpdir(),'still-files-view-'));
 writeFileSync(join(folder,'momentum.txt'),'Conservation of momentum');
 try{
  await page.addInitScript(state=>{
   localStorage.setItem('still-workspace-v2',JSON.stringify(state));
   localStorage.setItem('still-first-run-tutorial-v1','done');
  },state);
  await page.goto('/design-preview.html');
  await page.getByRole('button',{name:'Show sidebar'}).click();
  await page.locator('.nav button').filter({hasText:'Design'}).click();
  const files=page.locator('[data-widget-id="'+filesId+'"]');
  await files.locator('input[type=file]').setInputFiles(folder);
  await expect(files.getByRole('button',{name:'Preview file momentum.txt'})).toBeVisible();
  const run=(action:Record<string,string>)=>page.evaluate(async command=>{
   const path='/src/platform/filesViewCommands.ts';
   const {operateFilesView}=await import(path);
   return operateFilesView(command);
  },{widgetId:filesId,...action});
  await run({operation:'filesView.search',query:'momentum'});
  await expect(files.getByLabel('Cancel folder search')).toBeVisible();
  await run({operation:'filesView.exitSearch'});
  await run({operation:'filesView.open',path:'momentum.txt'});
  await expect(files.locator('.file-preview-text')).toHaveText('Conservation of momentum');
  await run({operation:'filesView.readingStatus',path:'momentum.txt',status:'done'});
  await expect(files.locator('.files-reading-status select')).toHaveValue('done');
  await run({operation:'filesView.closePreview'});
  await run({operation:'filesView.filter',status:'unread'});
  await expect(files.getByRole('button',{name:'Preview file momentum.txt'})).toHaveCount(0);
 }finally{rmSync(folder,{recursive:true,force:true})}
});
