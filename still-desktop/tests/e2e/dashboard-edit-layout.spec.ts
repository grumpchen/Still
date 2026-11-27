import {expect,test} from '@playwright/test';

test('Dashboard modules resize only in Edit Layout and Cancel restores geometry',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('still-first-run-tutorial-v1','done'));
 await page.setViewportSize({width:1440,height:1000});await page.goto('/design-preview.html');
 const dashboard=page.locator('.dashboard-home');
 const calendar=dashboard.locator('.dashboard-calendar-module');
 await expect(calendar).toBeVisible();
 expect(await calendar.evaluate(node=>getComputedStyle(node).resize)).toBe('none');
 const before=await calendar.boundingBox();expect(before).not.toBeNull();
 await dashboard.getByRole('button',{name:'Edit Layout'}).click();
 expect(await calendar.evaluate(node=>getComputedStyle(node).resize)).toBe('both');
 await page.mouse.move(before!.x+before!.width-2,before!.y+before!.height-2);
 await page.mouse.down();await page.mouse.move(before!.x+before!.width+80,before!.y+before!.height+70,{steps:8});await page.mouse.up();
 await expect.poll(async()=>{const box=await calendar.boundingBox();return box?.width??0}).toBeGreaterThan(before!.width+20);
 await dashboard.locator('.dashboard-hero-actions').getByRole('button',{name:'Cancel'}).click();
 const after=await calendar.boundingBox();expect(after?.width).toBeCloseTo(before!.width,0);expect(after?.height).toBeCloseTo(before!.height,0);
 expect(await calendar.evaluate(node=>getComputedStyle(node).resize)).toBe('none');
});


for (const width of [1440, 720]) {
 test(`Dashboard cards keep their positions and dimensions across Edit Layout at ${width}px`, async ({page}) => {
  await page.addInitScript(()=>localStorage.setItem('still-first-run-tutorial-v1','done'));
  await page.setViewportSize({width,height:1000});
  await page.goto('/design-preview.html');
  const home=page.locator('.dashboard-home');
  const cards=home.locator('.dashboard-grid > article');
  await expect(cards.first()).toBeVisible();
  const bounds=()=>cards.evaluateAll(nodes=>nodes.map(node=>{
   const {x,y,width,height}=node.getBoundingClientRect();
   return {x,y,width,height};
  }));
  const identities=()=>cards.evaluateAll(nodes=>nodes.map(node=>(node as HTMLElement).dataset.moduleId));
  const initial=await bounds();
  const initialOrder=await identities();
  await home.getByRole('button',{name:'Edit Layout'}).click();
  await expect.poll(bounds).toEqual(initial);
  await home.getByRole('button',{name:'Done',exact:true}).click();
  await expect.poll(bounds).toEqual(initial);
  if(width===1440){
   await home.getByRole('button',{name:'Edit Layout'}).click();
   const calendarHead=home.locator('.dashboard-calendar-module .dashboard-module-head');
   await home.locator('.dashboard-focus-module .dashboard-drag-handle').dragTo(calendarHead,{targetPosition:{x:4,y:4}});
   await expect.poll(identities).not.toEqual(initialOrder);
   const editedOrder=await identities();
   const edited=await bounds();
   await home.getByRole('button',{name:'Done',exact:true}).click();
   await expect.poll(bounds).toEqual(edited);
   await page.reload();
   await expect.poll(identities).toEqual(editedOrder);
   await expect.poll(bounds).toEqual(edited);
  }
 });
}
