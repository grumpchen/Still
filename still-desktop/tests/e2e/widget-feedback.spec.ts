import {expect, test} from '@playwright/test';
import {createInitialState, createWidget} from '../../src/domain/workspaces.ts';

test('a finished AI Command minimizes, single click runs, and double-click only edits', async ({page}) => {
  const state = createInitialState();
  const study = state.workspaces.find(item => item.role === 'study')!;
  const command = createWidget('aiCommand');
  command.title = 'Quick command';
  command.placement = {x: 65, y: 110, width: 480, height: 420};
  study.widgets = [command];
  await page.addInitScript(({state}) => {
    localStorage.setItem('still-workspace-v2', JSON.stringify(state));
    localStorage.setItem('still-first-run-tutorial-v1', 'done');
  }, {state});
  await page.goto('/design-preview.html');
  await page.getByRole('button', {name: 'Show sidebar', exact: true}).click();
  await page.locator('.nav button').filter({has: page.locator('.nav-name', {hasText: /^Study$/})}).click();
  const card = page.locator(`[data-widget-id="${command.id}"]`);
  await card.getByRole('textbox', {name: 'Command for Still AI'}).fill('add 2 notes');
  await expect(card.locator('.widget-relaunch-control')).toHaveCount(0);
  await card.getByRole('button', {name: 'Done', exact: true}).click();
  await expect(card).toHaveClass(/widget-minimized/);
  await expect(card.locator('.widget-minimized-relaunch')).toHaveCount(0);

  await page.evaluate(() => {
    const observed = {count: 0};
    Object.assign(window, {observedCommandRuns: observed});
    window.addEventListener('still-run-ai-command', event => {
      observed.count++;
      event.stopImmediatePropagation();
    }, true);
  });
  const runs = () => page.evaluate(() => (window as Window & {observedCommandRuns?: {count: number}}).observedCommandRuns!.count);
  await card.locator('.widget-minimized-button').dblclick();
  await expect(card.getByRole('textbox', {name: 'Command for Still AI'})).toHaveValue('add 2 notes');
  await card.getByRole('button', {name: 'Done', exact: true}).click();
  await card.locator('.widget-minimized-button').click();
  await expect.poll(runs).toBe(1);
  await expect(card).toHaveClass(/widget-minimized/);

  await card.click({button: 'right'});
  await expect(page.getByRole('menu', {name: 'Add widget'})).toHaveCount(0);
});
