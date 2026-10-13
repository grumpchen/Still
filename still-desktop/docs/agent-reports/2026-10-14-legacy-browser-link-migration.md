# Task: Legacy Browser link migration

- Agent: Codex, GPT-6
- Time: 2026-10-14T09:29:39+13:00

## Done
- Legacy Browser cards are still removed, but valid saved bookmarks and the last-opened HTTPS page migrate into a saved Group.
- The original preview migration uses the same conversion path. Unsafe and duplicate URLs are discarded; imported link counts are bounded.

## Files
- `src/domain/workspaces.ts`
- `tests/browser.test.mjs`
- `tests/canvas.test.mjs`

## Checks
- `node --test tests/browser.test.mjs` — passed (4 tests).
- `node --test --test-name-pattern="legacy Browser cards migrate" tests/canvas.test.mjs` — passed.
- Full `pnpm test` — 262 passed, 31 failed; remaining failures are unrelated stale Browser UI/settings expectations and other existing test drift.
- `pnpm check` and `pnpm build` — passed.

## Handoff
- Browser cards are intentionally not restored. Their safe links are now available in the Saved Groups tray after migration.
- Remaining full-suite failures need separate triage before release; Windows native installer validation remains outstanding.
