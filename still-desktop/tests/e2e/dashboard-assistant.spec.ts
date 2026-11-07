import {expect,test} from '@playwright/test';
import {createInitialState,createWidget,createWorkspace} from '../../src/domain/workspaces.ts';
import {createNoteDocument} from '../../src/domain/noteDocuments.ts';

test('selected Notes widget remains the target when the app applies a close request',async({page})=>{
 const state=createInitialState(),workspace=createWorkspace('Study selection',[]),first=createWidget('notes'),second=createWidget('notes');
 first.instanceNumber=1;second.instanceNumber=2;
 const extra=createNoteDocument();extra.text='keep this content';second.noteDocuments.push(extra);second.activeNoteDocumentId=extra.id;second.title=extra.title;second.text=extra.text;
 workspace.widgets=[first,second];state.workspaces.push(workspace);state.activeId=workspace.id;
 await page.addInitScript(data=>{localStorage.setItem('still-first-run-tutorial-v1','done');localStorage.setItem('still-workspace-v2',JSON.stringify(data))},state);
 await page.goto('/design-preview.html');
 await page.keyboard.press('Control+k');await page.getByRole('button',{name:'Open AI assistant',exact:true}).click();
 const message=page.locator('#ai-message');await message.fill('@Notes 2 close the current note');await message.press('Enter');
 await expect.poll(async()=>page.evaluate(({workspaceId,widgetId})=>{const state=JSON.parse(localStorage.getItem('still-workspace-v2')||'{}');return state.workspaces?.find((item:any)=>item.id===workspaceId)?.widgets.find((item:any)=>item.id===widgetId)?.noteDocuments.length},{workspaceId:workspace.id,widgetId:second.id})).toBe(1);
 const documents=await page.evaluate(({workspaceId,firstId,secondId})=>{const state=JSON.parse(localStorage.getItem('still-workspace-v2')||'{}'),widgets=state.workspaces.find((item:any)=>item.id===workspaceId).widgets;return [widgets.find((item:any)=>item.id===firstId).noteDocuments.map((doc:any)=>doc.id),widgets.find((item:any)=>item.id===secondId).noteDocuments.map((doc:any)=>doc.id)]},{workspaceId:workspace.id,firstId:first.id,secondId:second.id});
 expect(documents).toEqual([[first.noteDocuments[0].id],[second.noteDocuments[0].id]]);
 await expect(page.locator('#ai-sidebar .assistant-error')).toHaveCount(0);
});

test('dashboard Ask AI opens a usable panel beside the page when sidebar is hidden',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('still-first-run-tutorial-v1','done'));
 await page.goto('/design-preview.html');
 await page.getByRole('button',{name:'Ask AI',exact:true}).click();
 const panel=page.locator('#ai-sidebar');
 await expect(panel).toHaveAttribute('aria-hidden','false');
 await expect(panel.locator('#ai-message')).toBeVisible();
 await expect.poll(async()=>{const rect=await panel.boundingBox();return rect!.x+rect!.width}).toBeLessThanOrEqual(page.viewportSize()!.width+1);
 const rect=await panel.boundingBox();
 expect(rect).not.toBeNull();
 expect(rect!.y).toBeLessThan(10);
 expect(rect!.x+rect!.width).toBeLessThanOrEqual(page.viewportSize()!.width+1);
 expect(rect!.width).toBeGreaterThanOrEqual(280);
 await expect(panel.locator('#ai-message')).toBeInViewport();
});

test('assistant composer stays reachable when the desktop window is maximized or narrow',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('still-first-run-tutorial-v1','done'));
 await page.setViewportSize({width:1920,height:1080});
 await page.goto('/design-preview.html');
 await page.getByRole('button',{name:'Ask AI',exact:true}).click();
 const panel=page.locator('#ai-sidebar'),composer=panel.locator('.assistant-compose'),input=panel.locator('#ai-message');
 await expect(input).toBeVisible();
 for(const viewport of [{width:1920,height:1080},{width:780,height:660}]){
  await page.setViewportSize(viewport);
  await expect(input).toBeVisible();
  const panelBox=await panel.boundingBox(),composerBox=await composer.boundingBox(),inputBox=await input.boundingBox();
  expect(panelBox).not.toBeNull();expect(composerBox).not.toBeNull();expect(inputBox).not.toBeNull();
  expect(composerBox!.y+composerBox!.height).toBeLessThanOrEqual(panelBox!.y+panelBox!.height+1);
  expect(inputBox!.y+inputBox!.height).toBeLessThanOrEqual(composerBox!.y+composerBox!.height+1);
 }
});

test('maximized and narrow assistant keeps each local action receipt aligned with its prompt',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('still-first-run-tutorial-v1','done'));
 await page.setViewportSize({width:1920,height:1080});
 await page.goto('/design-preview.html');
 await page.getByRole('button',{name:'Ask AI',exact:true}).click();
 const panel=page.locator('#ai-sidebar'),message=panel.locator('#ai-message');
 for(const [viewport,prompt,receipt] of [
  [{width:1920,height:1080},'change theme to dark','Updated 1 setting.'],
  [{width:780,height:660},'change theme to light','Updated 1 setting.'],
 ] as const){
  await page.setViewportSize(viewport);
  await expect(message).toBeInViewport();
  await message.fill(prompt);await message.press('Enter');
  await expect(panel.locator('.assistant-message.user')).toHaveCount(prompt==='change theme to dark'?1:2);
  await expect(panel.locator('.assistant-message.user').last()).toContainText(prompt);
  await expect(panel.locator('.assistant-message:not(.user)').last()).toContainText(receipt);
  await expect(message).toBeEmpty();
 }
 await expect(page.locator('body')).not.toHaveClass(/\bdark\b/);
});

test('Still AI can navigate to in-app plugin settings without an API connection',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('still-first-run-tutorial-v1','done'));
 await page.goto('/design-preview.html');
 await page.getByRole('button',{name:'Ask AI',exact:true}).click();
 await page.locator('#ai-message').fill('open plugin settings');
 await page.locator('#ai-message').press('Enter');
 await expect(page.getByRole('tab',{name:'Plugins'})).toHaveAttribute('aria-selected','true');
 await expect(page.getByRole('heading',{name:'Settings'})).toBeVisible();
});

test('Still AI can change a supported in-app preference without an API connection',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('still-first-run-tutorial-v1','done'));
 await page.setViewportSize({width:1920,height:1080});
 await page.goto('/design-preview.html');
 await page.getByRole('button',{name:'Ask AI',exact:true}).click();
 await page.locator('#ai-message').fill('change theme to dark');
 await page.locator('#ai-message').press('Enter');
 await expect(page.locator('body')).toHaveClass(/\bdark\b/);
 await expect(page.locator('#ai-sidebar')).toContainText('theme');
 await page.locator('#ai-message').fill('set glass opacity to 72 percent');
 await page.locator('#ai-message').press('Enter');
 await expect(page.locator('body')).toHaveCSS('--glass-alpha','0.72');
 await expect(page.locator('#ai-sidebar')).toContainText('Updated 1 setting.');
});

test('Still AI can disable and undo automatic course environments',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('still-first-run-tutorial-v1','done'));
 await page.goto('/design-preview.html');await page.getByRole('button',{name:'Ask AI',exact:true}).click();
 const message=page.locator('#ai-message');await message.fill('disable automatic course environments');await message.press('Enter');
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('still-workspace-v2')||'{}').autoOpenCourseEnvironments)).toBe(false);
 await message.fill('undo');await message.press('Enter');
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('still-workspace-v2')||'{}').autoOpenCourseEnvironments)).toBe(true);
});

test('Still AI changes one linked course automatic opening and can undo it',async({page})=>{
 const state=createInitialState(),dashboard=state.workspaces.find(item=>item.role==='dashboard')!,timetable=dashboard.widgets.find(item=>item.type==='timetable')!,courseWorkspace=createWorkspace('Chemistry',[]);
 state.workspaces.push(courseWorkspace);state.activeId=dashboard.id;state.autoOpenCourseEnvironments=false;
 timetable.schedule=[{id:'chem-1',day:2,time:'09:00',title:'CHEM111',location:'Room 1',workspaceId:courseWorkspace.id,autoOpen:true},{id:'math-1',day:3,time:'11:00',title:'MATH120',location:'Room 2',workspaceId:courseWorkspace.id,autoOpen:true}];
 await page.addInitScript(data=>{localStorage.setItem('still-first-run-tutorial-v1','done');localStorage.setItem('still-workspace-v2',JSON.stringify(data))},state);
 await page.goto('/design-preview.html');await page.getByRole('button',{name:'Ask AI',exact:true}).click();
 const message=page.locator('#ai-message');await message.fill('turn off automatic opening for CHEM111');await message.press('Enter');
 const getFlags=()=>page.evaluate(({workspaceId,widgetId})=>{const state=JSON.parse(localStorage.getItem('still-workspace-v2')||'{}'),widget=state.workspaces?.find((item:any)=>item.id===workspaceId)?.widgets.find((item:any)=>item.id===widgetId);return widget?.schedule.map((item:any)=>item.autoOpen)},{workspaceId:dashboard.id,widgetId:timetable.id});
 await expect.poll(getFlags).toEqual([false,true]);await expect(page.locator('#ai-sidebar')).toContainText('Automatic opening disabled for CHEM111.');
 await message.fill('undo');await message.press('Enter');await expect.poll(getFlags).toEqual([true,true]);
});

test('Still AI continues an ambiguous course request after a timetable selection',async({page})=>{
 const state=createInitialState(),workspace=createWorkspace('Course selection',[]),first=createWidget('timetable'),second=createWidget('timetable'),destination=createWorkspace('Chemistry',[]);
 first.instanceNumber=1;second.instanceNumber=2;first.schedule=[{id:'class-1',day:2,time:'09:00',title:'CHEM111',location:'A',workspaceId:destination.id,autoOpen:true}];second.schedule=[{...first.schedule[0],id:'class-2',location:'B'}];workspace.widgets=[first,second];
 state.workspaces.push(workspace,destination);state.activeId=workspace.id;state.autoOpenCourseEnvironments=false;
 await page.addInitScript(data=>{localStorage.setItem('still-first-run-tutorial-v1','done');localStorage.setItem('still-workspace-v2',JSON.stringify(data))},state);
 await page.goto('/design-preview.html');await page.keyboard.press('Control+k');await page.getByRole('button',{name:'Open AI assistant',exact:true}).click();
 const message=page.locator('#ai-message');await message.fill('disable automatic opening for CHEM111');await message.press('Enter');
 await expect(page.locator('#ai-sidebar')).toContainText('Which linked course');
 await message.fill('Timetable 2');await message.press('Enter');
 await expect.poll(()=>page.evaluate(({workspaceId})=>{const state=JSON.parse(localStorage.getItem('still-workspace-v2')||'{}');return state.workspaces?.find((item:any)=>item.id===workspaceId)?.widgets.map((widget:any)=>widget.schedule[0].autoOpen)},{workspaceId:workspace.id})).toEqual([true,false]);
 await expect(page.locator('#ai-sidebar .assistant-message.user').last()).toContainText('Timetable 2');
 await message.fill('enable automatic opening for CHEM111');await message.press('Enter');await expect(page.locator('#ai-sidebar')).toContainText('Which linked course');
 await message.fill('@Timetable 2');await message.press('Enter');
 await expect.poll(()=>page.evaluate(({workspaceId})=>{const state=JSON.parse(localStorage.getItem('still-workspace-v2')||'{}');return state.workspaces?.find((item:any)=>item.id===workspaceId)?.widgets.map((widget:any)=>widget.schedule[0].autoOpen)},{workspaceId:workspace.id})).toEqual([true,true]);
 await message.fill('disable automatic opening for CHEM111');await message.press('Enter');await expect(page.locator('#ai-sidebar')).toContainText('Which linked course');
 await message.fill('@Timetable 1 open plugin settings');await message.press('Enter');await expect(page.getByRole('tab',{name:'Plugins'})).toHaveAttribute('aria-selected','true');
 await expect.poll(()=>page.evaluate(({workspaceId})=>{const state=JSON.parse(localStorage.getItem('still-workspace-v2')||'{}');return state.workspaces?.find((item:any)=>item.id===workspaceId)?.widgets.map((widget:any)=>widget.schedule[0].autoOpen)},{workspaceId:workspace.id})).toEqual([true,true]);
 await page.getByRole('button',{name:'Close dialog'}).click();
 await message.fill('add Lock plugin to Timetable');await message.press('Enter');await expect(page.locator('#ai-sidebar')).toContainText('Which widget should receive that plugin change?');
 await message.fill('Timetable 1');await message.press('Enter');
 await expect.poll(()=>page.evaluate(({workspaceId})=>{const state=JSON.parse(localStorage.getItem('still-workspace-v2')||'{}');return state.workspaces?.find((item:any)=>item.id===workspaceId)?.widgets.map((widget:any)=>widget.locked)},{workspaceId:workspace.id})).toEqual([true,false]);
});

test('Still AI links a course to an existing workspace and undoes the link',async({page})=>{
 const state=createInitialState(),dashboard=state.workspaces.find(item=>item.role==='dashboard')!,timetable=dashboard.widgets.find(item=>item.type==='timetable')!,destination=createWorkspace('Chemistry',[]);
 state.workspaces.push(destination);state.activeId=dashboard.id;state.autoOpenCourseEnvironments=false;
 timetable.schedule=[{id:'chem-1',day:2,time:'09:00',title:'CHEM111',location:'Room 1'},{id:'math-1',day:3,time:'11:00',title:'MATH120',location:'Room 2'}];
 await page.addInitScript(data=>{localStorage.setItem('still-first-run-tutorial-v1','done');localStorage.setItem('still-workspace-v2',JSON.stringify(data))},state);
 await page.goto('/design-preview.html');await page.getByRole('button',{name:'Ask AI',exact:true}).click();
 const message=page.locator('#ai-message');await message.fill('link CHEM111 to Chemistry workspace');await message.press('Enter');
 const getLinks=()=>page.evaluate(({workspaceId,widgetId})=>{const state=JSON.parse(localStorage.getItem('still-workspace-v2')||'{}'),widget=state.workspaces?.find((item:any)=>item.id===workspaceId)?.widgets.find((item:any)=>item.id===widgetId);return widget?.schedule.map((item:any)=>item.workspaceId??null)},{workspaceId:dashboard.id,widgetId:timetable.id});
 await expect.poll(getLinks).toEqual([destination.id,null]);await expect(page.locator('#ai-sidebar')).toContainText('Linked CHEM111 to Chemistry.');
 await message.fill('undo');await message.press('Enter');await expect.poll(getLinks).toEqual([null,null]);
});

test('Still AI can create a named workspace and start with the requested widget without an API connection',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('still-first-run-tutorial-v1','done'));
 await page.goto('/design-preview.html');
 await page.getByRole('button',{name:'Ask AI',exact:true}).click();
 await page.locator('#ai-message').fill('create a workspace named Chemistry with Notes');
 await page.locator('#ai-message').press('Enter');
 await expect(page.getByRole('heading',{name:'Chemistry'})).toBeVisible();
 await expect(page.locator('.canvas-card.widget-notes')).toHaveCount(1);
});

test('Still AI can switch between existing workspaces without an API connection',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('still-first-run-tutorial-v1','done'));
 await page.setViewportSize({width:1920,height:1080});
 await page.goto('/design-preview.html');
 await page.getByRole('button',{name:'Ask AI',exact:true}).click();
 const message=page.locator('#ai-message');
 await message.fill('create a blank workspace called Chemistry');
 await message.press('Enter');
 await expect(page.getByRole('heading',{name:'Chemistry'})).toBeVisible();
 await message.fill('create a blank workspace called Physics');
 await message.press('Enter');
 await expect(page.getByRole('heading',{name:'Physics'})).toBeVisible();
 await message.fill('switch to Chemistry workspace');
 await message.press('Enter');
 await expect(page.getByRole('heading',{name:'Chemistry'})).toBeVisible();
});

test('Still AI can undo its previous reversible workspace change without an API connection',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('still-first-run-tutorial-v1','done'));
 await page.setViewportSize({width:1920,height:1080});
 await page.goto('/design-preview.html');
 await page.getByRole('button',{name:'Ask AI',exact:true}).click();
 const notes=page.locator('.canvas-card.widget-notes'),message=page.locator('#ai-message');
 await message.fill('create a blank workspace called Undo Test');
 await message.press('Enter');
 await expect(page.getByRole('heading',{name:'Undo Test'})).toBeVisible();
 const before=await notes.count();
 await message.fill('add a Notes widget');
 await message.press('Enter');
 await expect(notes).toHaveCount(before+1);
 await message.fill('undo the last change');
 await message.press('Enter');
 await expect(notes).toHaveCount(before);
});

test('Still AI can replay the tutorial and change a workspace shortcut without an API connection',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('still-first-run-tutorial-v1','done'));
 await page.goto('/design-preview.html');
 await page.getByRole('button',{name:'Ask AI',exact:true}).click();
 const message=page.locator('#ai-message');
 await message.fill('run the tutorial again');await message.press('Enter');
 await expect(page.getByRole('heading',{name:'Welcome to Still'})).toBeVisible();
 await page.getByRole('button',{name:'Close dialog'}).click();
 await message.fill('set the shortcut for workspace 2 to Ctrl+Alt+K');await message.press('Enter');
 await expect(page.locator('#ai-sidebar')).toContainText('Changed workspace-2 to Ctrl + Alt + K.');
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('still-workspace-v2')!).shortcuts.numbered[1])).toEqual({key:'K',ctrl:true,alt:true,shift:false});
});

test('Still AI can move a widget between user workspaces without touching native app windows',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('still-first-run-tutorial-v1','done'));
 await page.setViewportSize({width:1920,height:1080});await page.goto('/design-preview.html');
 await page.getByRole('button',{name:'Ask AI',exact:true}).click();const message=page.locator('#ai-message');
 await message.fill('create a workspace named Transfer Source with Notes');await message.press('Enter');await expect(page.getByRole('heading',{name:'Transfer Source'})).toBeVisible();
 if(await page.locator('#ai-sidebar').getAttribute('aria-hidden')==='true')await page.getByRole('button',{name:'Ask AI',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>{const saved=JSON.parse(localStorage.getItem('still-workspace-v2')!);return saved.workspaces.find((item:any)=>item.id===saved.activeId)?.name})).toBe('Transfer Source');
 const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('still-workspace-v2')!));
 const source=before.workspaces.find((item:any)=>item.id===before.activeId),destination=before.workspaces.find((item:any)=>item.id!==source.id&&item.role!=='dashboard'&&item.role!=='library'),note=source.widgets.find((item:any)=>item.type==='notes');
 expect(source).toBeTruthy();expect(destination).toBeTruthy();expect(note).toBeTruthy();
 await message.fill(`move Notes widget to ${destination.name} workspace`);await message.press('Enter');
 await expect.poll(()=>page.evaluate(({sourceId,destinationId,widgetId})=>{const saved=JSON.parse(localStorage.getItem('still-workspace-v2')!);return{source:saved.workspaces.find((item:any)=>item.id===sourceId).widgets.some((item:any)=>item.id===widgetId),destination:saved.workspaces.find((item:any)=>item.id===destinationId).widgets.some((item:any)=>item.id===widgetId)}},{sourceId:source.id,destinationId:destination.id,widgetId:note.id})).toEqual({source:false,destination:true});
});

test('a timetable course can link to and open a Still workspace environment',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('still-first-run-tutorial-v1','done'));
 await page.setViewportSize({width:1920,height:1080});await page.goto('/design-preview.html');
 await page.getByRole('button',{name:'Ask AI',exact:true}).click();const message=page.locator('#ai-message');
 await message.fill('create a blank workspace called Course Focus');await message.press('Enter');await expect(page.getByRole('heading',{name:'Course Focus'})).toBeVisible();
 await page.getByRole('button',{name:'Show sidebar'}).click();await page.getByRole('button',{name:'Dashboard workspace'}).click();
 const timetable=page.locator('.dashboard-timetable-module');await timetable.getByRole('button',{name:/Class/}).click();
 await timetable.getByLabel('Class',{exact:true}).fill('EMTH118');
 await timetable.getByRole('combobox',{name:'Class day'}).selectOption('3');await timetable.getByRole('textbox',{name:'Class time'}).fill('13:00');
 await timetable.getByLabel('Course environment',{exact:true}).selectOption({label:'Course Focus'});
 await page.getByRole('button',{name:'Save class'}).click();
 const openEnvironment=page.getByRole('button',{name:'Open Course Focus'});await expect(openEnvironment).toBeVisible();await openEnvironment.click();
 await expect(page.getByRole('heading',{name:'Course Focus'})).toBeVisible();
});
