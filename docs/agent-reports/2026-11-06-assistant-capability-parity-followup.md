# Task: assistant capability parity follow-up

- Agent: Codex
- Time: 2026-11-06T04:45:33+13:00

## Done
- Added a bounded `control_timer` action for pausing, resuming, and resetting one existing Focus or Clock timer. Ambiguous or missing targets receive a local clarification before a provider request.
- Added Notes font and text-size changes through the existing widget edit path. Supported fonts are Sans serif, Serif, and Monospace; sizes are 12, 14, 16, 18, 20, 24, or 28px. Unclear targets or invalid values are clarified without changing state.
- Added Notes tag edits to one exact note document. Still AI can add, remove, and clear tags, preserves the other document fields, and asks which note to change when the target is ambiguous. Tag values remain within the Notes limits of 12 tags and 32 characters per tag.
- Updated assistant context, provider instructions/schema, validation, application receipts, and English/Simplified Chinese strings for these controls.
- Retained the maximized/narrow assistant prompt-to-receipt Playwright regression check; it passed.

## Files
- `still-desktop/src/domain/assistant.ts`
- `still-desktop/src/AssistantPanel.tsx`
- `still-desktop/src/App.tsx`
- `still-desktop/src/localization.tsx`
- `still-desktop/src-tauri/src/assistant_protocol.rs`
- `still-desktop/tests/assistant.test.mjs`
- `docs/agent-reports/2026-11-06-assistant-capability-parity-followup.md`
- `still-desktop/tests/e2e/dashboard-assistant.spec.ts` (pre-existing focused regression used for verification)

## Checks
- `pnpm exec tsc --noEmit` — passed.
- `pnpm exec tsx --test tests/assistant.test.mjs` — 45 passed.
- `cargo test --offline assistant_protocol::tests` — 13 passed; existing `set_chrome_profile` dead-code warning remains. The focused action-schema test including Notes tags also passed.
- `pnpm build` — passed; Vite reports the existing large JavaScript chunk warning.
- `pnpm exec tauri build --target x86_64-pc-windows-msvc --no-bundle` (with Cargo added to `PATH`) — passed; Rust reports the existing unused `set_chrome_profile` warning.
- Fresh executable copied to `D:\Still\builds\still-latest-2026-11-06-assistant-controls\release\still-desktop.exe` (20,148,736 bytes; SHA-256 `05E3A6168ACDD4D633B645A62E3B86FA031E0245F9ADE23A73C85BBBD840C937`). It was not launched.
- `pnpm exec playwright test tests/e2e/dashboard-assistant.spec.ts --grep "maximized and narrow assistant keeps" --timeout 60000` — 1 passed. An earlier run timed out waiting for the Vite page's `load` event before assistant interaction; the fresh rerun passed without code changes.
- `git diff --check` — passed; Git printed existing LF-to-CRLF notices for unrelated dirty files.
- Native Windows behavior was not manually exercised in this pass.

## Handoff
- The checkout already contains extensive unrelated and overlapping edits. No commit or push was made to avoid bundling or staging that work.
- The capability parity audit remains open. Notes formatting and document tags plus timer control are covered; remaining Still-managed UI controls still need review. Arbitrary native Windows application control remains outside the assistant action boundary.
