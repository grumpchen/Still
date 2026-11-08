# Task: Pending agent review recovery

- Agent: Codex (GPT-6.1)
- Time: 2026-11-09T06:22:00+13:00

## Done
- Persisted per-workspace metadata for provider-agent proposals while awaiting review and while applying an approved action. The journal stores no prompt, proposal body, file path, provider trace, or credential.
- On restart, an expired review is recorded in the saved chat and requires a fresh proposal. An interrupted apply is recorded as uncertain. Recovery never recreates approvals or repeats actions.
- Approval is blocked when Still cannot persist recovery state. Recovery is cleared only after the chat receipt has saved; decline clears it without applying changes.
- Localized recovery messages in English and Simplified Chinese. Preserved existing inbox-move recovery and provider/tool execution paths.

## Files
- `still-desktop/src/domain/assistantRunRecovery.ts`
- `still-desktop/src/domain/assistantChat.ts`
- `still-desktop/src/AssistantPanel.tsx`
- `still-desktop/src/localization.tsx`
- `still-desktop/tests/assistant-run-recovery.test.mjs`
- `still-desktop/tests/assistant-agent-notes-panel.test.mjs`

## Checks
- `pnpm check` — passed.
- `pnpm build` — passed; Vite reported the existing large-chunk advisory.
- Focused assistant recovery/chat/panel tests — 20 passed, including workspace isolation, storage failure, stale recovery IDs, restart recovery for both awaiting-review and interrupted-apply states, and no replay.
- `git diff --check` — passed.
- Full `pnpm test` — failed on multiple existing UI/source assertions; the serial run also included several individual UI tests taking 1–3 minutes. Legacy Files pointer selection, PDF arithmetic/highlights, note tabs and summary, and workspace persistence tests passed in the run. The full failure set was not independently re-run against a clean baseline in this increment.
- Native preview check: port 4318 serves Vite from this checkout and the desktop window title is `Still · Live Development`. No restart or native recovery interaction was performed.

## Handoff
- This increment covers `ProviderAgentOutcome` review closures. Other UI proposals from the non-agent final-answer path and note/calendar/file review states still expire on restart without a recovery notice.
- Native restart acceptance for these new generic recovery notices remains open. Keep the current native preview running; do not mix it with a release executable.
