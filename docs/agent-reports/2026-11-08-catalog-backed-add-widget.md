# Task: Catalog-backed add_widget proposals

- Agent: Codex with Luna
- Time: 2026-11-08T16:40:39+13:00

## Done
- Replaced the Notes-only add_widget proposal with one catalog-backed widget type, retaining snapshot revision checks, existing validation, exact proposal identity, explicit approval, and single-use execution.
- Updated Rust provider declarations and validation to allow only the supported widget catalog types across compatible, Gemini, and ChatGPT provider paths.
- Updated the proposal summary to use the chosen widget type and generalized the confirmation wording in English and Simplified Chinese.
- Added regression coverage for catalog acceptance, unsupported type rejection, proposal data, and approved execution.

## Files
- still-desktop/src/domain/assistantTools.ts
- still-desktop/src/AssistantPanel.tsx
- still-desktop/src/localization.tsx
- still-desktop/src-tauri/src/assistant_agent_protocol.rs
- still-desktop/tests/assistant-tools.test.mjs

## Checks
- `pnpm exec tsx --test tests/assistant-tools.test.mjs` — 12 passed.
- `pnpm exec tsc --noEmit` — passed.
- `cargo test --offline assistant_agent_protocol` — not run; `cargo` is unavailable in this environment.

## Handoff
- Rust schema enum mirrors the current widget catalog (`group`, `desmos`, `notes`, `focus`, `files`, `apps`, `timetable`, `calendar`, `ai`, `tagStatus`); keep it synchronized when catalog types change.
