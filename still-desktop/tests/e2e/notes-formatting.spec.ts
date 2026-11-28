import { expect,test } from '@playwright/test';
import { createInitialState } from '../../src/domain/workspaces.ts';

test('Notes formats selected content in place and keeps Ctrl+Z inside the editor',async({page})=>{
 const state=createInitialState(),workspace=state.workspaces.find(item=>item.name==='Design')!;state.activeId=workspace.id;
 const widget=workspace.widgets.find(item=>item.type==='notes')!,note=widget.noteDocuments[0];note.title='Study notes';note.text='Important idea\n\nList entry';widget.title=note.title;widget.text=note.text;widget.activeNoteDocumentId=note.id;
 await page.addInitScript(({state})=>{localStorage.setItem('still-workspace-v2',JSON.stringify(state));localStorage.setItem('still-first-run-tutorial-v1','done')},{state});
 await page.goto('/design-preview.html');await page.getByRole('button',{name:'Show sidebar',exact:true}).click();await page.locator('.nav button').filter({hasText:'Design'}).click();
 const card=page.locator(`[data-widget-id="${widget.id}"]`),editor=card.locator('.note[contenteditable="true"]');await expect(editor).toContainText('Important idea');
 await editor.locator('p').first().evaluate(element=>{const range=document.createRange();range.selectNodeContents(element);const selection=window.getSelection()!;selection.removeAllRanges();selection.addRange(range)});
 await card.getByRole('button',{name:'Bold selection'}).click();await expect(editor.locator('b, strong')).toHaveText('Important idea');
 await editor.locator('p').first().evaluate(element=>{const range=document.createRange();range.selectNodeContents(element);const selection=window.getSelection()!;selection.removeAllRanges();selection.addRange(range)});
 await card.getByRole('button',{name:'Insert heading'}).click();await expect(editor.locator('h2')).toContainText('Important idea');
 await editor.locator('p').first().evaluate(element=>{const range=document.createRange();range.selectNodeContents(element);const selection=window.getSelection()!;selection.removeAllRanges();selection.addRange(range)});
 await card.getByRole('button',{name:'Insert bullet'}).click();await expect(editor.locator('ul li')).toContainText('List entry');
 await editor.evaluate(element=>{const range=document.createRange();range.selectNodeContents(element);range.collapse(false);const selection=window.getSelection()!;selection.removeAllRanges();selection.addRange(range)});await card.getByRole('button',{name:'Insert checklist item'}).click();const task=editor.locator('input[data-task-checkbox]').last();await expect(task).toBeVisible();await task.check();await expect(task).toBeChecked();await editor.pressSequentially('Review chapter');await editor.press('Enter');await expect(editor.locator('ul li[data-task]')).toHaveCount(2);await editor.press('Enter');await editor.pressSequentially('Outside task');await expect(editor).toContainText('Outside task');
 await editor.focus();await editor.press('End');await editor.press('!');await expect(editor).toContainText('!');await editor.press('Control+z');await expect(editor).not.toContainText('!');
});
