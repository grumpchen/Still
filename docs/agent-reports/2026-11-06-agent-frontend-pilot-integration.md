# Task: agent frontend pilot integration

- Agent: Codex sub-agent
- Time: 2026-11-06T17:09:49+13:00 (Pacific/Auckland)

## Done
- Added a default-off experimental provider agent option for OpenAI and OpenCode Go. The existing standard assistant remains the default.
- Added a separate default-off Gemini preview checkbox. It is independent of the OpenAI/OpenCode preference and routes opted-in Gemini requests through the native agent-turn adapter.
- Gemini tool-call assistant content is retained as an ephemeral raw `gemini_content` object through inspect, approval, and resume rounds, including native `thoughtSignature` fields. It is not added to visible or persisted chat.
- Connected the bounded loop to `assistant_agent_turn`. The Notes tool flag is enabled only from the opted-in preview. A separate default-off checkbox controls `enable_safe_workspace_action_tool`.
- The frontend tool allowlist contains inspection and single Notes addition, plus `propose_workspace_action` only when its separate checkbox is enabled. Supported proposals are minimize/restore, timer controls, Still sidebar/Apps bar visibility, and one note document in an existing Notes widget. Other registry/backend actions remain gated off.
- Both Notes and safe action proposals preserve their exact one-use registry object and loop continuation. The review card renders the action description, selected targets, duration, and proposed note title/text where applicable. Approval rechecks workspace revision, validates the original user intent and action, calls the existing `act` callback, and resumes the provider with the exact receipt. Decline resumes with a known non-mutation result and cannot apply follow-on model actions.
- The actual executor receipt is written to chat before provider resume, so provider failure cannot hide a completed operation. Failed/stale tool results prevent model success claims.
- Inspection is refreshed from current workspace and UI props, and contains workspace metadata and note titles but no note bodies or local paths. Screenshot and selected file/Library content are explicitly unsupported and checked before capture or provider calls.

## Files
- `still-desktop/src/AssistantPanel.tsx`
- `still-desktop/src/platform/assistant.ts`
- `still-desktop/src/localization.tsx`
- `still-desktop/tests/assistant-agent-adapter.test.mjs`
- `still-desktop/tests/assistant-agent-notes-panel.test.mjs`
- `still-desktop/tests/assistant-panel.test.mjs`

## Checks
- `pnpm check` — passed after the Gemini UI integration.
- `pnpm exec tsx --test tests/assistant-agent-adapter.test.mjs tests/assistant-tools.test.mjs tests/agent-loop.test.mjs` — 29 passed, including Notes and minimize review/resume with exact receipts, default-off safe tool flag, stale approval rejection, and blocked success claims.
- `pnpm exec tsx --test tests/assistant-agent-adapter.test.mjs` — 8 passed, including Gemini native-content and signature preservation through three provider rounds.
- `pnpm exec tsx --test --test-name-pattern='Gemini preview is provider-specific' tests/assistant-agent-notes-panel.test.mjs` — 1 passed, verifying Gemini preference isolation, UI opt-in, confirmation, and resume with the actual receipt.
- The four existing panel cases also passed before the Gemini case was added: Notes approval, decline safety, receipt retention after provider resume failure, and separately opted-in minimize review/application.
- `cargo test --offline assistant_agent_protocol` — unavailable; `cargo` is not on the shell PATH.
- No real provider request or native Windows acceptance was run.

## Handoff
- This is an experimental, bounded tool-using assistant, not the full Still agent plan. Mutations beyond the listed safe proposals remain unavailable through tools.
- Gemini is enabled only through its explicit preview toggle. Its provider protocol was mock-tested; no live Gemini request was made.
- The additional safe action tool defaults off separately from the agent preview. Selected file/Library context and screenshots remain unsupported in agent mode.
- Changes remain uncommitted in the shared dirty worktree; unrelated existing work was preserved.
