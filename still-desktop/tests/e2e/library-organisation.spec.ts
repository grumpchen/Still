import {expect,test} from '@playwright/test';
import {createInitialState} from '../../src/domain/workspaces';

test('names-only Library AI review makes no writes before Apply and exposes safe Undo (mock native boundary)',async({page})=>{
 const state=createInitialState();
 const fileWidget=state.workspaces.flatMap(workspace=>workspace.widgets).find(widget=>widget.type==='files')!;
 fileWidget.folderName='Course';fileWidget.fileNotes={'week.md':'Private annotation'};
 state.workspaces[0].widgets.find(widget=>widget.type==='notes')!.text='PRIVATE NOTE DO NOT SHARE';
 await page.addInitScript(state=>{localStorage.setItem('still-first-run-tutorial-v1','done');localStorage.setItem('still-workspace-v2',JSON.stringify(state))},state);
 await page.route('**/src/platform/libraryOrganisation.ts',route=>route.fulfill({contentType:'application/javascript',body:`
  const fixture=window.__libraryFixture={mutations:0,undo:0,requests:[],path:'week.md',history:[]};
  export const libraryOrganisation={available:true,
   async snapshot(){return {version:1,rootId:'root-1',rootName:'Course',truncated:false,entries:[{id:'entry-1',path:fixture.path,name:fixture.path,directory:false,size:20,revision:'rev-1'}]}},
   async history(){return fixture.history},
   async apply(id,rootId,operation){fixture.mutations++;const source=fixture.path;fixture.path=operation.name;const receipt={id:operation.id,rootId,type:operation.type,sourcePath:source,destinationPath:fixture.path,entryId:'entry-1',revision:'rev-1',undoToken:'undo-1',affectedCount:1};fixture.history=[receipt];return receipt},
   async undo(){fixture.undo++;const source=fixture.path;fixture.path='week.md';fixture.history=[];return{sourcePath:source,destinationPath:'week.md',removedFolder:false}}
  };
 `}));
 await page.route('**/src/platform/assistant.ts',route=>route.fulfill({contentType:'application/javascript',body:`
  export const geminiAssistant={available:true,async configured(){return true},async models(){return ['gemini-2.5-flash']},async send(request){window.__libraryFixture.requests.push(request);return {reply:'Review this rename; nothing has changed.',actions:[],layout:[],libraryProposal:{version:1,rootId:'root-1',operations:[{version:1,id:'rename-1',type:'rename',entryId:'entry-1',expectedRevision:'rev-1',name:'lecture.md',reason:'Use a clearer name'}]}}}};
  export async function widgetImage(){throw new Error('Names-only mode must not capture images')};
  export async function workspaceImage(){throw new Error('Names-only mode must not capture images')};
 `}));
 await page.goto('/design-preview.html');
 await page.getByRole('button',{name:'Ask AI',exact:true}).click();
 await page.getByText('Organise Library with AI',{exact:true}).click();
 await page.getByLabel('Assigned Library folder',{exact:true}).selectOption(fileWidget.id);
 await page.getByRole('button',{name:'Share folder names / Refresh',exact:true}).click();
 await expect(page.getByText('Course · 1 entries · names only',{exact:false})).toBeVisible();
 await page.getByLabel('Message Still AI',{exact:true}).fill('Rename week.md to lecture.md');
 await page.getByRole('button',{name:'Send',exact:true}).click();
 await expect(page.getByRole('region',{name:'Review Library changes'})).toBeVisible();
 expect(await page.evaluate(()=>(window as any).__libraryFixture.mutations)).toBe(0);
 const request=await page.evaluate(()=>(window as any).__libraryFixture.requests[0]);
 expect(request.image).toBeUndefined();expect(request.context).not.toContain('PRIVATE NOTE');expect(request.context).not.toContain('Private annotation');expect(JSON.parse(request.context).libraryOrganisation.contentShared).toBe(false);
 await page.getByRole('button',{name:'Apply selected changes',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).__libraryFixture.mutations)).toBe(1);
 await expect.poll(()=>page.evaluate(id=>JSON.parse(localStorage.getItem('still-workspace-v2')!).workspaces.flatMap((w:any)=>w.widgets).find((w:any)=>w.id===id).fileNotes['lecture.md'],fileWidget.id)).toBe('Private annotation');
 await page.getByText('Recent operations / safe Undo',{exact:true}).click();
 await page.locator('.assistant-library-tools').getByRole('button',{name:'Undo',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).__libraryFixture.undo)).toBe(1);
 await expect.poll(()=>page.evaluate(id=>JSON.parse(localStorage.getItem('still-workspace-v2')!).workspaces.flatMap((w:any)=>w.widgets).find((w:any)=>w.id===id).fileNotes['week.md'],fileWidget.id)).toBe('Private annotation');
});
