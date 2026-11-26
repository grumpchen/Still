# Recovery controls baseline repair

## Changes

- `WorkspaceCanvas` now accepts `showWidgetRelaunchAction` (defaults to `true`) and uses it to show or hide Relaunch on expanded and minimized cards. Expanded cards surface failed relaunches as invalid/red controls. Both controls call the existing `relaunch(w)` path, which delegates manually deferred startup widgets to `startupRelaunch` and re-presents existing Apps identities without opening a second native app.
- `NotesLibraryExplorer` now calls its existing `onOpenNote` callback from an explicit **Open note** action on Markdown/text previews. Unsaved preview edits are written with the existing revision checked write before opening. `NotesWidget` already reuses source backed tabs and reloads their latest text, so it needed no change.
- The Notes integration test now asserts the actual editable Markdown preview, opening beside the local tab, source writes after editing the opened tab, and reuse/refresh when reopening the same path.

The prior tests were stale because the workspace settings already held the Relaunch visibility flag but Canvas never received it, while the Notes explorer exposed an `onOpenNote` callback without invoking it. The prior Markdown assertion also looked for a static `.file-preview-text` element even though the current explorer renders `.note-library-editor`.

## App integration needed

`App.tsx` is intentionally unchanged here. Add this prop to its `WorkspaceCanvas` call:

```tsx
showWidgetRelaunchAction={state.showWidgetRelaunchAction}
```

The component defaults to visible for existing callers and tests; App must pass the persisted setting so the user preference takes effect.

## Verification

- `pnpm install --frozen-lockfile` completed in this worktree.
- `pnpm check` passed.
- `node --import tsx --test --test-concurrency=1 tests/widget-relaunch.test.mjs` passed: 23/23.
- Full `pnpm test`: 514 passed, 1 failed. Remaining failure is the explicitly out of scope `compact focus state is temporary and keeps its exit control beside fullscreen` assertion in `tests/widget-focus-layout.test.mjs`; it expects compact-focus markup removed from the current UI. No compact-focus UI or test was changed.
