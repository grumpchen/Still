import {expect,test} from '@playwright/test';

test('Downloads inbox is a Library contents page rather than a Files toolbar button',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('still-first-run-tutorial-v1','done'));
 await page.goto('/design-preview.html');
 await page.getByRole('button',{name:'Library',exact:true}).click();
 const library=page.locator('.library-home');
 const inbox=library.locator('.library-rail-group').getByRole('button',{name:'Downloads Inbox',exact:true});
 await expect(inbox).toBeVisible();
 await library.getByRole('button',{name:'Search library',exact:true}).click();
 await inbox.click();
 await expect(inbox).toHaveAttribute('aria-current','page');
 await expect(library.locator('.library-page-header h2')).toHaveText('Downloads Inbox');
 await expect(library.locator('.files-toolbar').getByRole('button',{name:'Use Still Downloads inbox'})).toHaveCount(0);
});
