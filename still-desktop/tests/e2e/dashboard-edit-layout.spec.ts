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
