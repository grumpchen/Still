# Task: Keep greetings chat-only

- Agent: Codex, GPT-6
- Time: 2026-10-14T10:26:34+13:00

## Done
- Standalone greetings, check-ins, thanks, and goodbyes now discard model-supplied workspace actions and layout proposals.
- Real workspace requests retain existing response validation, including rejection of mixed layout/action responses.
- Added a regression test reproducing the reported `hi` response shape and verifying no workspace mutation or error appears.

## Files
- `src/domain/assistant.ts`
- `src/platform/assistant.ts`
- `tests/assistant.test.mjs`
- `tests/assistant-panel.test.mjs`
- `docs/plans/2026-10-11-gemini-sidebar.md`

## Checks
- Focused assistant tests: 33 passed.
- `pnpm check`: passed.
- `pnpm build`: passed; Vite reported its existing large-chunk advisory.
- `pnpm test`: 267 passed, 31 failed across unrelated UI, browser, and migration tests. Reported failures include stale checks for removed `BrowserWidget.tsx`, expectations against older migration/layout behavior, and a Vite SSR module-load error. The focused assistant tests passed in the same run.
- `git diff --check`: passed.

## Handoff
- Changes are local to `agent/codex/gemini-sidebar-current`; no push or merge was performed.
- Full-suite failures are outside this greeting-handling change and remain for a separate cleanup task.
