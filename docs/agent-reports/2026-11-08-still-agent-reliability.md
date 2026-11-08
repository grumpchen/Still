# Task: Still agent reliability and native verification

- Agent: Codex with Luna (GPT-6 Luna)
- Time: 2026-11-08T17:09:00+13:00

## Done

- The agent can inspect the authorized Downloads Inbox, put a batch of moves up for one review, and continue with the actual result. The UI and provider receive verified destinations and distinguish partial completion from a failed or unverified move. The existing final-answer proposal route is still supported.
- Luna extended widget creation from Notes to the built-in widget catalog. It still adds one widget per user turn, after a separate review. Fixed Dashboard and Library pages reject additions before review. If the workspace closes or changes, its pending review cannot execute in a different workspace.
- A turn can use up to five explicitly selected Library resources as bounded context. Selected resource text is treated as data; the turn does not receive general workspace mutation, memory, or inbox tools. Existing selected-resource proposals remain subject to their own scope and review.
- Fixed the OpenCode Go adapter to accept provider metadata on the wire while still validating Still tool names, input, and call IDs. Replay carries only the supported fields.

## Files

- `AssistantPanel.tsx`, `App.tsx`, the assistant domain and platform adapters, native assistant protocol and file commands, and focused tests.
- [Implementation plan](../plans/2026-11-08-still-agent-reliability.md) and [reviewed move report](2026-11-08-reviewed-inbox-agent-moves.md).

## Checks

- Windows native development build from this checkout: Playwright attached to the WebView for a separate app identifier and disposable folder. It approved a real two-file Tauri move, verified both files on disk and their destinations in the receipt, then approved and verified a Calendar widget on a regular canvas. A second run edited the second source after review: the first file moved, the second stayed in place, and the agent received the partial result. Declining its subsequent widget proposal left the canvas unchanged. These UI runs used synthetic provider replies.
- Live provider checks with synthetic data: ChatGPT subscription completed workspace inspection and the inbox review/continuation with a dry-run receipt. OpenCode Go (`mimo-v2.6-flash`) and Gemini (`gemini-3-flash-preview`) each called workspace inspection and used its result in a final reply. Other Gemini models returned unavailable. The separate OpenAI API key connection had no key configured; its transport and move-to-widget workflow were exercised with mocks only.
- `pnpm build` passed. The focused TypeScript run passed 42 tests; `cargo test --offline --bin still-desktop` passed 135 tests on Windows.
- Browser Playwright: the Dashboard assistant and Library Downloads navigation suites passed all 17 cases when rerun with one worker. The initial run timed out. These cases exercise the browser UI; native filesystem coverage comes from the separate WebView fixture.
- Broad TypeScript suite before the final standalone ownership test: 440 passed and 40 failed. The starting commit `4d1876e`, run from an extracted copy against the same dependencies, had 432 passes and 41 failures. Every remaining failure matched a baseline failure by test name. The final ownership test passed in the focused run.

## Handoff

- The approval and continuation are scoped to the current session in memory. The next reliability job is a local run journal that preserves receipts across restart and forces a fresh review for unfinished changes. Follow that with bounded browse/search/read tools for the granted Library folder and reviewed, conflict-checked edits through the same file API as the UI. Broader settings operations and a full vault explorer are still open.
- Claudian references for that work: [pending interaction ledger](https://github.com/YishenTu/claudian/blob/3a094bc3b9454df2b586a6ce9764d89c3af9075f/src/core/execution/PendingInteractionLedger.ts) matches responses to a live interaction; [session runtime wiring](https://github.com/YishenTu/claudian/blob/3a094bc3b9454df2b586a6ce9764d89c3af9075f/src/features/chat/sessions/createChatSessionRuntime.ts) binds events to the current turn; [project memory path](https://github.com/YishenTu/claudian/blob/3a094bc3b9454df2b586a6ce9764d89c3af9075f/src/core/path/ProjectMemoryPath.ts) separates project memory paths. Keep ownership and approval state in Still, independent of provider transport.
- The normal `Still · Live Development` preview was restored on the task checkout at port 4318. The temporary WebView debug endpoint is no longer needed. No merge or push.
