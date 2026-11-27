import {expect,test} from '@playwright/test';

test('Still AI opens a named Windows app without a provider and asks when the name is ambiguous',async({page})=>{
 const launched:string[]=[];
 await page.exposeFunction('recordAppLaunch',(id:string)=>{
  if(id==='vlc')throw new Error('Windows could not open VLC.');
  launched.push(id);
 });
 await page.addInitScript(()=>{
  localStorage.setItem('still-first-run-tutorial-v1','done');
  Object.assign(window,{
   isTauri:true,
   __TAURI_INTERNALS__:{
    transformCallback:()=>1,
    unregisterCallback:()=>{},
    metadata:{currentWindow:{label:'main'},currentWebview:{label:'main'}},
    invoke:async(command:string,args:{id:string})=>{
     if(command==='app_picker_installed')return [
      {id:'chrome',name:'Google Chrome',icon:[]},
      {id:'chrome-beta',name:'Google Chrome Beta',icon:[]},
      {id:'studio',name:'Visual Studio',icon:[]},
      {id:'code',name:'Visual Studio Code',icon:[]},
      {id:'vlc',name:'VLC',icon:[]},
     ];
     if(command==='app_picker_launch_installed')return (window as unknown as {recordAppLaunch:(id:string)=>Promise<void>}).recordAppLaunch(args.id);
     return null;
    },
   },
   __TAURI_EVENT_PLUGIN_INTERNALS__:{unregisterListener:()=>{}},
  });
 });
 await page.goto('/design-preview.html');
 await page.getByRole('button',{name:'Ask AI',exact:true}).click();
 const assistant=page.locator('#ai-sidebar');
 const ask=async(prompt:string)=>{
  await assistant.getByLabel('Message Still AI').fill(prompt);
  await assistant.getByRole('button',{name:'Send',exact:true}).click();
 };
 await ask('帮我打开 Chrome');
 await expect(assistant).toContainText('Asked Windows to open “Google Chrome”.');
 expect(launched).toEqual(['chrome']);
 await ask('Open app Studio');
 await expect(assistant).toContainText('Matching apps: Visual Studio, Visual Studio Code.');
 expect(launched).toEqual(['chrome']);
 await ask('Open app Visual Studio Code');
 await expect(assistant).toContainText('Asked Windows to open “Visual Studio Code”.');
 expect(launched).toEqual(['chrome','code']);
 await ask('Open app VLC');
 await expect(assistant).toContainText('Windows could not open VLC.');
 await expect(assistant).not.toContainText('Asked Windows to open “VLC”.');
 await expect(page.getByRole('button',{name:'Ask AI',exact:true})).toBeVisible();
});
