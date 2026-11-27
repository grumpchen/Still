import { expect, test } from '@playwright/test';
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInitialState } from '../../src/domain/workspaces.ts';

test('PDF excerpts keep a clickable page citation and highlight presets are reusable', async ({ page }) => {
  test.setTimeout(60_000);
  const state = createInitialState();
  const workspace = state.workspaces.find(item => item.name === 'Design')!;
  state.activeId = workspace.id;
  const notes = workspace.widgets.find(item => item.type === 'notes')!;
  const note = notes.noteDocuments[0];
  note.title = 'Research notes';
  note.text = 'Existing agreement notes';
  notes.title = note.title;
  notes.text = note.text;
  const fileId = workspace.widgets.find(item => item.type === 'files')!.id;
  const notesId = notes.id;
  const folder = mkdtempSync(join(tmpdir(), 'still-pdf-citation-e2e-'));
  const fileName = 'citation-test.pdf';
  copyFileSync(join(process.cwd(), 'tests/fixtures/save-selection-citation.pdf'), join(folder, fileName));

  try {
    await page.addInitScript(({ state }) => {
      localStorage.setItem('still-workspace-v2', JSON.stringify(state));
      localStorage.setItem('still-first-run-tutorial-v1', 'done');
    }, { state });
    await page.goto('/design-preview.html');
    await page.getByRole('button',{name:'Show sidebar'}).click();await page.locator('.nav button').filter({hasText:'Design'}).click();
    const files = page.locator(`[data-widget-id="${fileId}"]`);
    const notesCard = page.locator(`[data-widget-id="${notesId}"]`);
    await files.getByRole('button', { name: /choose folder/i }).click();
    await files.locator('input[type="file"]').setInputFiles(folder);
    await files.getByRole('button', { name: `Preview file ${fileName}` }).click();

    const preset = files.getByRole('combobox', { name: 'Highlight preset' });
    const instruction = files.locator(`#pdf-highlight-${fileId}`);
    await preset.selectOption('deadlines');
    await expect(instruction).toHaveValue(/deadlines, due dates/);
    await instruction.fill('Find governing law and venue clauses.');
    await files.getByRole('textbox', { name: 'Preset name' }).fill('Legal clauses');
    await files.getByRole('button', { name: 'Save as preset' }).click();
    await expect(preset.locator('option', { hasText: 'Legal clauses' })).toHaveCount(1);
    await preset.selectOption({ label: 'Deadlines and dates' });
    await preset.selectOption({ label: 'Legal clauses' });
    await expect(instruction).toHaveValue('Find governing law and venue clauses.');

    const secondPage = files.locator('.pdf-render-page[aria-label="PDF page 2"]');
    await expect(secondPage.locator('.textLayer')).toContainText('recipient must retain records');
    await secondPage.evaluate(element => {
      const walker = document.createTreeWalker(element.querySelector('.textLayer')!, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const text = node.textContent ?? '';
        const index = text.indexOf('recipient must retain records');
        if (index < 0) continue;
        const range = document.createRange();
        range.setStart(node, index);
        range.setEnd(node, index + 'recipient must retain records'.length);
        const selection = window.getSelection()!;
        selection.removeAllRanges();
        selection.addRange(range);
        return;
      }
      throw new Error('PDF text could not be selected');
    });
    await files.locator('.document-preview').evaluate(element => {
      element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse', button: 2 }));
      element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: 220, clientY: 260 }));
    });

    const menu = page.getByRole('menu', { name: 'Save selection to note…' });
    await expect(menu).toContainText(`${fileName} · p. 2`);
    await menu.getByRole('menuitem', { name: /Research notes/ }).click();
    await expect(notesCard.locator('textarea.note')).toHaveValue('Existing agreement notes\n\nrecipient must retain records');
    const citation = notesCard.getByRole('button', { name: `${fileName} · p. 2` });
    await expect(citation).toBeVisible();
    await citation.evaluate(element => {
      const scroller = element.closest<HTMLElement>('.widget-content');
      if (scroller) scroller.scrollTop = scroller.scrollHeight;
    });
    await citation.click({ force: true });
    await expect(files.locator('.pdf-render-page[aria-label="PDF page 2"]')).toBeVisible();
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});
