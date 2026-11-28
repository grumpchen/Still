import { expect, test } from '@playwright/test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInitialState } from '../../src/domain/workspaces.ts';

function seededWorkspace() {
  const state = createInitialState();
  const workspace = state.workspaces.find(item => item.name === 'Design')!;
  state.activeId = workspace.id;
  const notes = workspace.widgets.find(item => item.type === 'notes')!;
  const note = notes.noteDocuments[0];
  note.title = 'Research notes';
  note.text = 'Existing note body mentions interim report deadlines';
  notes.title = note.title;
  notes.text = note.text;
  return { state, fileId: workspace.widgets.find(item => item.type === 'files')!.id, notesId: notes.id };
}

test('selecting text in Files offers workspace notes and saves the selection', async ({ page }) => {
  const { state, fileId, notesId } = seededWorkspace();
  const folder = mkdtempSync(join(tmpdir(), 'still-selection-e2e-'));
  writeFileSync(join(folder, 'agreement.txt'), 'Interim report is due September 30, 2025.');
  try {
    await page.addInitScript(({ state }) => {
      localStorage.setItem('still-workspace-v2', JSON.stringify(state));
      localStorage.setItem('still-first-run-tutorial-v1', 'done');
    }, { state });
    await page.goto('/design-preview.html');
    await page.getByRole('button',{name:'Show sidebar'}).click();await page.locator('.nav button').filter({hasText:'Design'}).click();

    const files = page.locator(`[data-widget-id="${fileId}"]`);
    const notes = page.locator(`[data-widget-id="${notesId}"]`);
    await expect(files).toBeVisible();
    await files.getByRole('button', { name: /choose folder/i }).click();
    await files.locator('input[type="file"]').setInputFiles(folder);
    await files.getByRole('button', { name: 'Preview file agreement.txt' }).click();

    const documentText = files.locator('.file-preview-text');
    await expect(documentText).toContainText('Interim report is due September 30, 2025.');
    await files.getByText('File actions', { exact: true }).click();
    await files.getByRole('menu').getByRole('menuitem', { name: 'Find related notes' }).click();
    await expect(files.getByRole('region', { name: 'Related notes' })).toContainText('Research notes');
    await documentText.evaluate(element => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
    });
    await documentText.evaluate(element => {
      element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse', button: 2 }));
      element.dispatchEvent(new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: 180,
        clientY: 180,
        button: 2,
      }));
    });

    const menu = page.getByRole('menu', { name: 'Save selection to note…' });
    await expect(menu).toBeVisible();
    await expect(menu).toContainText('Interim report is due September 30, 2025.');
    const target = menu.getByRole('menuitem');
    await expect(target).toHaveCount(1);
    await expect(target).toContainText('Research notes');
    await target.click();

    await expect(notes.locator('.note[contenteditable=true] p').nth(0)).toHaveText('Existing note body mentions interim report deadlines');
    await expect(notes.locator('.note[contenteditable=true] p').nth(1)).toHaveText('Interim report is due September 30, 2025.');
    const citation = notes.getByRole('button', { name: 'agreement.txt' });
    await expect(citation).toBeVisible();
    await notes.getByRole('textbox', { name: 'Note heading' }).click();
    await citation.click();
    await expect(files.getByRole('region', { name: 'Preview file agreement.txt' })).toBeVisible();
    await files.getByRole('combobox', { name: 'Reading status' }).selectOption('done');
    await files.getByRole('button', { name: 'Back to files' }).click();
    await files.getByRole('combobox', { name: 'Reading list' }).selectOption('done');
    await expect(files.getByRole('button', { name: 'Preview file agreement.txt' })).toBeVisible();
    await files.getByRole('combobox', { name: 'Reading list' }).selectOption('unread');
    await expect(files.getByRole('button', { name: 'Preview file agreement.txt' })).toHaveCount(0);
    await expect(page.getByRole('menu', { name: 'Save selection to note…' })).toHaveCount(0);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});
