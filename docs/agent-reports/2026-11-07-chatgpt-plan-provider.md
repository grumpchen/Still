# Task: Connect Still AI to ChatGPT plan usage

- Agent: Codex (GPT-6.1 Sol)
- Time: 2026-11-07T00:24:47+13:00

## Done

- Added ChatGPT plan to Still AI settings with explicit browser authorization, a verified account label, and sign-out.
- Added native loopback sign-in, PKCE and identity verification, Windows DPAPI storage, serialized token refresh, and best-effort server revocation.
- Added account-specific model discovery and a separate public Responses API transport. Still reuses the bounded tool loop and its local action and memory approval flows.

## Files

- `still-desktop/src-tauri/src/chatgpt_auth.rs`, `chatgpt_plan.rs`, and `chatgpt_responses.rs` in the same directory
- `still-desktop/src-tauri/build.rs`, `capabilities/main.json`, `src/main.rs`, and generated ChatGPT plan permissions
- `still-desktop/src/AssistantPanel.tsx`, `src/platform/assistant.ts`, `src/domain/assistant.ts`, and `src/localization.tsx`
- `still-desktop/tests/assistant-agent-adapter.test.mjs`

## Checks

- 13 native tests passed, including callback validation, Windows DPAPI tamper rejection, stateless Responses request shape, and complete-stream handling.
- 73 focused frontend tests, TypeScript checking, and Vite build passed.
- Launched the native Windows development app, selected ChatGPT plan, and initiated the browser sign-in. Still displayed the waiting state and created its encrypted host record.

## Handoff

- Browser consent and the first live inference are needed to verify the account and model entitlement.
- This local preview supports one saved registration. It uses the existing text and workspace metadata agent flow.
- Changes remain in the shared development worktree with the agent baseline they depend on.
