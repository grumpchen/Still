import {expect,test} from '@playwright/test';
import {createInitialState} from '../../src/domain/workspaces';

for(const theme of ['light','dark'] as const){
 test(`glass dashboard has bright neutral text and readable controls in ${theme} mode`,async({page})=>{
  const state=createInitialState();
  state.theme=theme;
  state.glass.backgroundEffect='wave-wallpaper';
  await page.addInitScript(state=>{
   localStorage.setItem('still-first-run-tutorial-v1','done');
   localStorage.setItem('still-workspace-v2',JSON.stringify(state));
  },state);
  await page.goto('/design-preview.html');
  const dashboard=page.locator('.dashboard-home');
  await expect(dashboard).toBeVisible();
  await expect(dashboard.locator('h2')).toHaveCSS('color','rgb(255, 255, 255)');
  await expect(dashboard.locator('.dashboard-module-head h3').first()).toHaveCSS('color','rgb(255, 255, 255)');
  await expect(dashboard.locator('.study-calendar-grid > button:not(.outside-month):not(.is-selected)').first()).toHaveCSS('color','rgb(255, 255, 255)');
  await expect(dashboard.locator('.dashboard-eyebrow')).toHaveCSS('color','rgb(203, 209, 216)');
  const surfaces=await dashboard.evaluate(el=>{
   const style=getComputedStyle(el);
   const button=getComputedStyle(el.querySelector('.dashboard-hero-actions button')!);
   const sidebar=getComputedStyle(document.querySelector('.sidebar')!);
   return {scheme:style.colorScheme,background:style.backgroundColor,texture:style.backgroundImage,blur:style.backdropFilter,sidebarBlur:sidebar.backdropFilter,sidebarBackground:sidebar.backgroundColor,sidebarTexture:sidebar.backgroundImage,buttonColor:button.color,buttonBackground:button.backgroundColor};
  });
  expect(surfaces.scheme).toBe('dark');
  expect(surfaces.background).toBe(surfaces.sidebarBackground);
  expect(surfaces.texture).toBe(surfaces.sidebarTexture);
  expect(surfaces.blur).toBe(surfaces.sidebarBlur);
  expect(surfaces.blur).toContain('blur(');
  expect(surfaces.buttonColor).toBe('rgb(255, 255, 255)');
  expect(surfaces.buttonBackground).not.toBe('rgba(0, 0, 0, 0)');
  await expect(dashboard.locator('.dashboard-hero-actions .primary')).toHaveCSS('color','rgb(255, 255, 255)');
  await expect(dashboard.locator('.dashboard-hero-actions .primary')).toHaveCSS('background-image',/linear-gradient/);
  await expect(dashboard.locator('.study-calendar-grid > button:not(.is-selected)').first()).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
  await page.screenshot({path:test.info().outputPath(`dashboard-${theme}-desktop.png`),fullPage:true,animations:'disabled'});
  await page.setViewportSize({width:800,height:900});
  expect(await dashboard.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await page.screenshot({path:test.info().outputPath(`dashboard-${theme}-narrow.png`),fullPage:true,animations:'disabled'});
 });
}

test('minimal light dashboard retains its light palette',async({page})=>{
 const state=createInitialState();state.appearance='minimal';state.theme='light';
 await page.addInitScript(state=>{
  localStorage.setItem('still-first-run-tutorial-v1','done');
  localStorage.setItem('still-workspace-v2',JSON.stringify(state));
 },state);
 await page.goto('/design-preview.html');
 await expect(page.locator('.dashboard-home h2')).toHaveCSS('color','rgb(35, 43, 56)');
});
