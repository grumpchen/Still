import {expect,test,type Page} from '@playwright/test';
import {createInitialState,createWorkspace} from '../../src/domain/workspaces.ts';

async function state(page:Page){return page.evaluate(()=>JSON.parse(localStorage.getItem('still-workspace-v2')!))}
async function waitForState(page:Page,predicate:(value:any)=>boolean){await expect.poll(async()=>predicate(await state(page))).toBe(true);return state(page)}
async function openModes(page:Page){await page.locator('.topbar').getByRole('button',{name:'Edit modes'}).click();return page.getByRole('dialog',{name:'Instructions and folders'})}
async function switchWorkspace(page:Page,name:string){const toggle=page.locator('.topbar .sidebar-toggle');if(await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();await page.locator('.nav button').filter({has:page.locator('.nav-name',{hasText:new RegExp(`^${name}$`)})}).click()}

test('AI modes save instructions and directories and persist global and course defaults',async({page})=>{
 const saved=createInitialState(),physics=createWorkspace('Physics',[]);saved.workspaces.push(physics);
 await page.addInitScript(value=>{if(!localStorage.getItem('still-workspace-v2'))localStorage.setItem('still-workspace-v2',JSON.stringify(value));localStorage.setItem('still-first-run-tutorial-v1','done')},saved);
 await page.setViewportSize({width:1440,height:1000});await page.goto('/design-preview.html');
 let dialog=await openModes(page);await dialog.getByRole('button',{name:/New mode/}).click();await dialog.getByLabel('Mode name').fill('Physics');await dialog.getByLabel('Instructions for every AI request').fill('Cite formulas and state units.');await dialog.getByLabel('Default mode').selectOption({label:'Physics'});await dialog.getByRole('button',{name:'Save modes'}).click();await expect(dialog).not.toBeVisible();
 let current=await waitForState(page,(value:any)=>value.studyModes.some((mode:any)=>mode.name==='Physics'&&mode.instructions==='Cite formulas and state units.'));expect(current.defaultStudyModeId).toBe(current.studyModes.find((mode:any)=>mode.name==='Physics').id);
 await switchWorkspace(page,'Physics');await page.getByLabel('AI mode',{exact:true}).selectOption({label:'General'});current=await waitForState(page,(value:any)=>value.courseStudyModeDefaults[physics.id]==='general');
 dialog=await openModes(page);await dialog.getByLabel('Default for Physics').selectOption({label:'Physics'});await dialog.getByRole('button',{name:'Save modes'}).click();current=await waitForState(page,(value:any)=>value.courseStudyModeDefaults[physics.id]===value.studyModes.find((mode:any)=>mode.name==='Physics').id);const physicsMode=current.studyModes.find((mode:any)=>mode.name==='Physics');
 await page.reload();current=await waitForState(page,(value:any)=>value.courseStudyModeDefaults[physics.id]===physicsMode.id);await switchWorkspace(page,'Physics');await expect(page.getByLabel('AI mode',{exact:true})).toHaveValue(physicsMode.id);
});

test('Still AI switches a named mode and sends its instructions on the next request',async({page})=>{
 const {mockAssistant}=await import('./helpers/mock-assistant');
 await mockAssistant(page);
 const saved=createInitialState();
 saved.studyModes=[...saved.studyModes!,{id:'physics',name:'Physics',instructions:'Cite the relevant formula and units.',downloadDirectory:null,saveDirectory:null}];
 await page.addInitScript(state=>{
  localStorage.setItem('still-workspace-v2',JSON.stringify(state));
  localStorage.setItem('still-first-run-tutorial-v1','done');
  localStorage.setItem('still-assistant-share-workspace-image','false');
  localStorage.setItem('still-assistant-model','deepseek::mock-model');
 },saved);
 await page.goto('/design-preview.html');
 await page.evaluate(()=>{
  const ipc=(window as any).__TAURI_INTERNALS__,invoke=ipc.invoke;
  ipc.invoke=(command:string,args:any)=>{
   if(command==='assistant_chat')return Promise.resolve({reply:args.request.mode_instructions,layout:[]});
   return invoke(command,args);
  };
 });
 await page.getByRole('button',{name:'Ask AI',exact:true}).click();
 const assistant=page.locator('#ai-sidebar'),composer=assistant.getByLabel('Message Still AI');
 await composer.fill('Switch to Physics mode');
 await assistant.getByRole('button',{name:'Send',exact:true}).click();
 await expect(assistant).toContainText('Switched to “Physics” mode.');
 await expect(page.getByLabel('AI mode',{exact:true})).toHaveValue('physics');
 await composer.fill('Explain how to calculate acceleration.');
 await assistant.getByRole('button',{name:'Send',exact:true}).click();
 await expect(assistant).toContainText('Cite the relevant formula and units.');
});
