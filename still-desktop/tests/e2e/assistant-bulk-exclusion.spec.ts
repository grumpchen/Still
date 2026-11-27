import {expect,test} from '@playwright/test';
import {createInitialState,createWidget} from '../../src/domain/workspaces.ts';

test('delete all widget except ai command keeps the AI Command and supports Undo',async({page})=>{
 const state=createInitialState(),design=state.workspaces.find(item=>item.name==='Design')!;
 const command=createWidget('aiCommand');
 command.title='My reusable command';
 design.widgets.push(command);
 const before=design.widgets.map(widget=>widget.id).sort();
 await page.addInitScript(state=>{
  localStorage.setItem('still-workspace-v2',JSON.stringify(state));
  localStorage.setItem('still-first-run-tutorial-v1','done');
 },state);
 await page.goto('/design-preview.html');
 await page.getByRole('button',{name:'Show sidebar'}).click();
 await page.locator('.nav button').filter({hasText:'Design'}).click();
 await page.evaluate(()=>window.dispatchEvent(new Event('still-open-assistant')));
 const assistant=page.locator('#ai-sidebar');
 await assistant.getByLabel('Message Still AI').fill('delete all widget except ai command');
 await assistant.getByRole('button',{name:'Send',exact:true}).click();
 await expect(assistant).toContainText(/Removed .* from Design\./);
 const result=()=>page.evaluate(id=>{
  const state=JSON.parse(localStorage.getItem('still-workspace-v2')!);
  return state.workspaces.find((workspace:{id:string})=>workspace.id===id).widgets.map((widget:{id:string})=>widget.id).sort();
 },design.id);
 await expect.poll(result).toEqual([command.id]);
 await assistant.getByRole('button',{name:'Undo change',exact:true}).click();
 await expect.poll(result).toEqual(before);
});
