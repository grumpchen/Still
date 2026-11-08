# Task: Save reviewed action receipts before continuation

- Agent: Codex (GPT-6.1)
- Time: 2026-11-09T06:38:00+13:00

## Done
- Found and fixed a crash-window issue in the provider approval flow. Still now synchronously saves the verified execution receipt, records that receipt in recovery state, and clears the old applying marker before asking the provider to continue.
- If the chat receipt cannot be saved, the provider continuation stops and the applying marker remains. Recovery distinguishes a saved receipt from an uncertain in-flight action.
- Added regression coverage for provider failure after an approved action, chat storage failure, and receipt-aware recovery.

## Files
- `still-desktop/src/AssistantPanel.tsx`
- `still-desktop/src/domain/assistantRunRecovery.ts`
- `still-desktop/src/localization.tsx`
- `still-desktop/tests/assistant-agent-notes-panel.test.mjs`
- `still-desktop/tests/assistant-run-recovery.test.mjs`

## Checks
- `pnpm check` — passed.
- Focused recovery, chat, and assistant panel tests — 22 passed.
- `git diff --check` — passed.

## Handoff
- The local recovery record still covers provider-agent approval closures only. Native app restart acceptance remains open; the existing live preview was not restarted.
