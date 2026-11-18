import {expect,test} from '@playwright/test';
import {mockAssistant} from './helpers/mock-assistant';

test('assistant UI submits a prompt to the mocked provider and renders its response',async({page})=>{
 await mockAssistant(page,'Mock response: mitochondria produce cellular energy.');
 await page.addInitScript(()=>{localStorage.setItem('still-first-run-tutorial-v1','done');localStorage.setItem('still-assistant-share-workspace-image','false')});
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/design-preview.html');
 await page.getByRole('button',{name:'Ask AI',exact:true}).click();
 const panel=page.locator('#ai-sidebar'),input=panel.locator('#ai-message');
 await expect(panel).toBeVisible();
 await input.fill('Explain mitochondria');
 await input.press('Enter');
 await expect(panel.locator('.assistant-message.user').last()).toContainText('Explain mitochondria');
 await expect(panel.locator('.assistant-message:not(.user)').last()).toContainText('Mock response: mitochondria produce cellular energy.');
 await expect(input).toBeEmpty();
 await expect(panel.locator('.assistant-error')).toHaveCount(0);
});
