# Task: Standard Still review recovery

- Agent: Codex (GPT-6 Luna)
- Time: 2026-11-09

## Done
- Extended the per-workspace recovery marker to ordinary Still confirmation cards and layout previews, in addition to provider-agent proposals.
- Recovery metadata remains content-free. An approval awaiting review expires on restart; an interrupted apply is reported as uncertain and never replayed.
- Persisted the successful action receipt before clearing recovery state. Interrupted applies remain blocked until the user inspects the workspace and acknowledges the result.
- Localized recovery messaging in English and Simplified Chinese.
- Preserved existing Files/Notes actions and their existing receipt behavior.

## Files
- `still-desktop/src/AssistantPanel.tsx`
- `still-desktop/src/domain/assistantRunRecovery.ts`
- `still-desktop/src/localization.tsx`
- `still-desktop/tests/assistant-panel.test.mjs`
- `still-desktop/tests/assistant-run-recovery.test.mjs`

## Checks
- `pnpm check` — passed.
- `pnpm build` — passed; Vite reported the existing large-chunk advisory.
- `tests/assistant-run-recovery.test.mjs` — 6 passed.
- Focused AssistantPanel layout/restart recovery UI test — 1 passed (187 seconds, dominated by Vite test setup); verifies success receipts, marker retention after simulated restart, no replay, and explicit acknowledgement.
- Existing Files-first, Markdown tabs/editing, and AI summary-note regression tests — 3 passed (191 seconds for folder-first/Vite setup; remaining tests completed in under one second).
- `git diff --check` — passed.
- Native desktop preview — not restarted or interactively tested in this increment.

## Handoff
- This increment covers generic confirmation cards and layout previews. Other review surfaces (file and note proposals, calendar actions, Library organization) still have their own persistence behavior and should be assessed separately.
- Verify the focused UI test, commit and push this increment to the current task branch, and verify the remote SHA before calling it saved.
