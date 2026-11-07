import {expect,test} from '@playwright/test';
import {createInitialState,createWorkspace} from '../../src/domain/workspaces.ts';

function scheduledState(targets:string[],at:Date,workspaceIndexes=targets.map((_,index)=>index)){
 const state=createInitialState(),source=state.workspaces.find(item=>item.role==='dashboard')!,timetable=source.widgets.find(item=>item.type==='timetable')!;
 const destinations=targets.map(name=>createWorkspace(name,['notes']));state.workspaces.push(...destinations);
 const day=(at.getDay()+6)%7,time=`${String(at.getHours()).padStart(2,'0')}:${String(at.getMinutes()).padStart(2,'0')}`;
 timetable.schedule=targets.map((title,index)=>({id:`course-${index}`,day,time,title,location:'Room 1',workspaceId:destinations[workspaceIndexes[index]].id,autoOpen:true}));
 return {state,destinations};
}

async function startApp(page:any,state:ReturnType<typeof scheduledState>['state'],now:Date){
 await page.clock.install({time:now});
 await page.addInitScript(({data})=>{localStorage.setItem('still-first-run-tutorial-v1','done');localStorage.setItem('still-workspace-v2',data)}, {data:JSON.stringify(state)});
 await page.goto('/design-preview.html');
}

test('one linked class switches to its workspace automatically while Still is open',async({page})=>{
 const now=new Date();now.setSeconds(0,0);const classAt=new Date(now.getTime()+5*60_000),{state}=scheduledState(['Chemistry'],classAt);
 await startApp(page,state,now);
 await expect(page.locator('.nav button.active .nav-name')).toHaveText('Chemistry');
});

test('concurrent classes offer one grouped chooser and switch only after selection',async({page})=>{
 const now=new Date();now.setSeconds(0,0);const classAt=new Date(now.getTime()+5*60_000),{state}=scheduledState(['Zoology','Chemistry'],classAt);
 await startApp(page,state,now);
 const dialog=page.getByRole('dialog');await expect(dialog.getByRole('heading',{name:'Classes starting'})).toBeVisible();
 await expect(dialog.getByText('Several linked classes are starting.',{exact:false})).toBeVisible();
 await expect(page.locator('.nav button.active .nav-name')).toHaveText('Dashboard');
 await dialog.getByRole('button',{name:'Open Chemistry',exact:true}).click();
 await expect(page.locator('.nav button.active .nav-name')).toHaveText('Chemistry');
 await expect(dialog).not.toBeVisible();
});

test('global opt-out defers a due class until automatic opening is enabled again',async({page})=>{
 const now=new Date();now.setSeconds(0,0);const classAt=new Date(now.getTime()+5*60_000),{state}=scheduledState(['Chemistry'],classAt);state.autoOpenCourseEnvironments=false;
 await startApp(page,state,now);
 await expect(page.locator('.nav button.active .nav-name')).toHaveText('Dashboard');
 await page.keyboard.press('Control+k');
 await page.getByRole('button',{name:'Settings',exact:true}).click();
 const dialog=page.getByRole('dialog'),setting=dialog.getByRole('checkbox',{name:'Open linked course environments automatically'});
 await expect(setting).not.toBeChecked();await setting.check();
 await dialog.getByRole('button',{name:'Close dialog'}).click();
 await expect(page.locator('.nav button.active .nav-name')).toHaveText('Chemistry');
});

test('normal workspace deletion clears timetable links and undo restores the course environment',async({page})=>{
 const now=new Date();now.setSeconds(0,0);const future=new Date(now.getTime()+60*60_000),{state,destinations}=scheduledState(['Chemistry'],future);
 state.activeId=destinations[0].id;
 await page.addInitScript(({data})=>{localStorage.setItem('still-first-run-tutorial-v1','done');localStorage.setItem('still-workspace-v2',data)}, {data:JSON.stringify(state)});
 await page.goto('/design-preview.html');
 await page.keyboard.press('Control+k');
 await page.getByRole('button',{name:'Arrange workspace'}).click();
 await page.getByRole('button',{name:'Remove workspace'}).click();
 await expect(page.locator('.nav button').filter({hasText:'Chemistry'})).toHaveCount(0);
 await page.keyboard.press('Control+z');
 await expect(page.locator('.nav button.active .nav-name')).toHaveText('Chemistry');
});
