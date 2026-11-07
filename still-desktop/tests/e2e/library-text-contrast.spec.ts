import {expect,test} from '@playwright/test';

test('liquid glass Library uses white text and a blue accent instead of green text',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('still-first-run-tutorial-v1','done'));
 await page.goto('/design-preview.html');
 await page.getByRole('button',{name:'Library',exact:true}).click();
 const library=page.locator('.library-home');
 await expect(library).toBeVisible();
 await expect.poll(()=>library.evaluate(element=>getComputedStyle(element).color)).toBe('rgb(255, 255, 255)');
 const colors=await library.evaluate(element=>({
  heading:getComputedStyle(element.querySelector('.library-page-header h2')!).color,
  secondary:getComputedStyle(element.querySelector('.library-page-header p')!).color,
  accent:getComputedStyle(element).getPropertyValue('--accent').trim(),
 }));
 expect(colors.heading).toBe('rgb(255, 255, 255)');
 expect(colors.secondary).toBe('rgba(255, 255, 255, 0.78)');
 expect(colors.accent).toBe('#8ab4ff');
});
