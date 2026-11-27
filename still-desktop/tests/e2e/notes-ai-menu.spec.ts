import {expect,test} from '@playwright/test';
import {createInitialState,createWidget} from '../../src/domain/workspaces.ts';
import {createNoteDocument} from '../../src/domain/noteDocuments.ts';

test('Notes hides study actions in the AI dropdown and sends the selected note for the chosen action',async({page})=>{
 const state=createInitialState(),design=state.workspaces.find(workspace=>workspace.name==='Design')!;
 const notes=createWidget('notes');
 const note=createNoteDocument('Exam notes');
 note.text='Work done equals force times distance.';
 notes.noteDocuments=[note];notes.activeNoteDocumentId=note.id;
 design.widgets=[notes];
 await page.addInitScript(state=>{
  localStorage.setItem('still-workspace-v2',JSON.stringify(state));
  localStorage.setItem('still-first-run-tutorial-v1','done');
 },state);
 await page.goto('/design-preview.html');
 await page.getByRole('button',{name:'Show sidebar'}).click();
 await page.locator('.nav button').filter({hasText:'Design'}).click();
 const widget=page.locator(`[data-widget-id="${notes.id}"]`);
 const ai=widget.getByRole('button',{name:'AI',exact:true});
 const menu=widget.getByRole('group',{name:'Study with AI'});
 await expect(menu).toHaveCount(0);
 await ai.click();
 await expect(menu).toBeVisible();
 await expect(menu.getByRole('button')).toHaveText(['Explain','Summarize','Flashcards','Study outline','Quiz']);
 await menu.getByRole('button',{name:'Quiz'}).press('Escape');
 await expect(ai).toBeFocused();
 await expect(menu).toHaveCount(0);
 await ai.click();
 await widget.getByRole('textbox',{name:'Note heading'}).click();
 await expect(menu).toHaveCount(0);
 await ai.click();
 await menu.getByRole('button',{name:'Summarize',exact:true}).click();
 await expect(menu).toHaveCount(0);
 const assistant=page.locator('#ai-sidebar');
 await expect(assistant).toHaveAttribute('aria-hidden','false');
 await expect(assistant.getByLabel('Message Still AI')).toHaveValue(/Summarize the selected note “Exam notes”/);
});
