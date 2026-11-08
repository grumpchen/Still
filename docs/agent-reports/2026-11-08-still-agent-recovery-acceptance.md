# Task: Still agent reliability and native acceptance

- Agent: GPT-6 Luna (recovery, Library, and controls); Codex (integration and acceptance)
- Time: 2026-11-08T17:53:14+13:00

## Done

- Journal reviewed Inbox batches before execution and reconcile interrupted moves against the current grant and recorded file identity. Show historical receipts and uncertain outcomes. Require fresh inspection and approval for any remaining move.
- Give explicit Library requests bounded browse, search, and read access to one selected Notes widget's grant. Review a replacement before saving and compare with the original text at save time.
- Review exact move and resize values for one selected widget and light/dark theme changes. Verify the persisted change before sending an applied receipt and offer undo.
- Add a native Windows Playwright fixture with isolated app state and synthetic provider responses. File operations, workspace persistence, and recovery use the real desktop app.

## Files

- `docs/plans/2026-11-08-still-agent-recovery.md`
- `still-desktop/src-tauri/src/assistant_journal.rs`, `files.rs`, `assistant_agent_protocol.rs`, `chatgpt_responses.rs`, and the Tauri capability files
- `still-desktop/src/AssistantPanel.tsx`, `src/platform/assistant.ts`, and `src/domain/assistantTools.ts`
- `still-desktop/tests/native/assistant-reliability.mjs` and `README.md`

## Checks

- `pnpm check` and `pnpm build` passed. The build reported the existing large frontend chunk advisory.
- Focused assistant tests: 115 passed.
- Broad frontend suite from a clean source snapshot: 447 passed and 40 failed. All 40 failing test names match the previous branch run.
- `cargo test --offline --bin still-desktop`: 141 passed, including interruption during a native attempt, changed file identity, and Library grant checks.
- All 10 native Windows WebView2 fixture cases passed: reviewed batch and widget continuation, stale source, provider timeout after verified moves, crash/restart, changed grant, theme, widget move, widget resize, Library edit, and Library write conflict.
- Live synthetic Library read and continuation passed with Gemini (`gemini-3-flash-preview`) and OpenCode Go (`mimo-v2.6-flash`). No personal files were sent. The separate OpenAI API key path was covered by protocol tests and mocks; no key was configured for a live check.
- ChatGPT subscription model listing passed. Live requests on the new Library path and the existing workspace inspection path failed before calling a tool, across multiple listed models. The stream reported an error without a usable provider error code. The namespace, schemas, and tool history passed protocol tests; live ChatGPT inference remains unverified for this increment.
- Restored the normal branch preview: the desktop window was titled `Still · Live Development`, the Vite preview responded on port 4318, and the WebView debug port was closed.

## Handoff

- Recovery covers reviewed Inbox moves. It does not restore provider conversations, pending widget reviews, or old approvals after restart.
- Library tools operate on Markdown and text in the selected grant. Controls added here cover move, resize, and light/dark theme.
- Native fixture cases are opt-in; run them on Windows with the normal preview stopped, as described in the fixture README.
