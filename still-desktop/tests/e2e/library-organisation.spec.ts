import {expect,test} from '@playwright/test';
import {createInitialState,createWorkspace} from '../../src/domain/workspaces.ts';

test('Still AI routes a structured saved-link rename through the shared Workbench operation service',async({page})=>{
 const state=createInitialState(),workspace=createWorkspace('Physics',['notes']);
 const groupId='physics-links',linkId='lecture-link';workspace.groups=[{id:groupId,name:'Study links',shortcuts:[{id:linkId,name:'Original resources',url:'https://example.edu/course'}],widgets:[],expanded:false}];state.workspaces.push(workspace);
 await page.addInitScript(data=>{localStorage.setItem('still-first-run-tutorial-v1','done');localStorage.setItem('still-workspace-v2',JSON.stringify(data));localStorage.setItem('still-assistant-model','gemini::gemini-2.5-flash');localStorage.setItem('still-assistant-gemini-agent-preview','false');localStorage.setItem('still-assistant-share-workspace-image','false')},state);
 await page.route('**/src/platform/assistant.ts',route=>route.fulfill({contentType:'application/javascript',body:`
  export const chatgptPlan={async status(){return {connected:false,email:null}},async connect(){return {connected:false,email:null}},async disconnect(){return true},async models(){return []}};
  export async function runProviderAgent(){throw new Error('This test exercises a structured standard Workbench reply')};
  export const geminiAssistant={available:true,async configured(){return true},async models(){return ['gemini-2.5-flash']},async send(request){window.__workbenchFixture={request};return {intent:'workspace_action',reply:'',actions:[],layout:[],workbenchActions:[{operation:'link.rename',origin:{kind:'group',workspaceId:'${workspace.id}',groupId:'${groupId}'},linkId:'${linkId}',name:'Updated resources'}]}}};
  export async function widgetImage(){throw new Error('This request must not capture images')};
  export async function workspaceImage(){throw new Error('This request must not capture images')};
 `}));
 await page.goto('/design-preview.html');await page.getByRole('button',{name:'Ask AI',exact:true}).click();
 const assistant=page.locator('#ai-sidebar');await expect(assistant.getByLabel('AI model')).toHaveValue('gemini::gemini-2.5-flash');await assistant.getByLabel('Message Still AI').fill('Please help organize my saved resources');await assistant.getByRole('button',{name:'Send',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as any).__workbenchFixture?.request!==undefined)).toBe(true);
 await expect(assistant).toContainText('Renamed saved link to Updated resources.');
 await expect.poll(()=>page.evaluate(({workspaceId,groupId,linkId})=>{const state=JSON.parse(localStorage.getItem('still-workspace-v2')!);return state.workspaces.find((item:any)=>item.id===workspaceId).groups.find((item:any)=>item.id===groupId).shortcuts.find((item:any)=>item.id===linkId).name},{workspaceId:workspace.id,groupId,linkId})).toBe('Updated resources');
 const request=await page.evaluate(()=>(window as any).__workbenchFixture.request);expect(request.context).toContain('Original resources');expect(request.context).toContain(workspace.name);await expect(assistant.locator('.assistant-error')).toHaveCount(0);
});
