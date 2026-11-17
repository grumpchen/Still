# Task: Still Agent feasibility and test plan

- Agent: Codex (GPT-6.2 Sol)
- Time: 2026-11-17T19:37:31+00:00 (workspace time)
- Source reviewed: `a3c9af5` on `agent/codex/files-widget-refine`. The v0.2367 tag predates this commit.

## Done

- Reviewed standard assistant chat, the Agent loop and tool registry, the application action boundary, AI Command, and Windows release checks.
- The existing architecture supports a workspace assistant for chat, limited workspace inspection, and reviewed actions such as timer control, widget visibility, and local note creation. Standard chat also has separate layout and reviewed Library flows. Agent mode does not currently accept selected file or Library context. Daily and after-course execution are outside the current implementation.
- Agent tool proposals now reach review after a wording mismatch, but the tool executor still passes the original prompt to App, which reruns intent validation. A structurally valid proposal that mismatches the classifier can therefore fail after approval. Test this through the actual application state boundary.
- AI Command submits through an 80 ms timer. Its current tests cover saving and inspect the source for submit wiring. They do not behaviorally verify that a click sends the correct prompt once, especially during a pending request or workspace switch.

## Files

- `still-desktop/src/AssistantPanel.tsx`, `src/App.tsx`, `src/domain/assistantTools.ts`, `src/domain/agentLoop.ts` within the desktop project.
- `still-desktop/tests/ai-command-widget.test.mjs`, `tests/e2e/dashboard-assistant.spec.ts` within the desktop project.
- `.github/workflows/windows-release.yml`.

## Checks

- Read source and test coverage. No test execution or live API call in this review.
- Historical evidence: 97 focused AI tests passed when the wording change was implemented. The v0.2367 Windows release passed its configured checks, which did not include the Agent loop, adapter, tool, or rendered Agent panel suites. No native Windows interaction was verified at release.

## Handoff

1. Cloud Codex, mocked provider. Run TypeScript/build and targeted existing tests. From `still-desktop`: `pnpm check`, `pnpm build`, and `pnpm exec tsx --test --test-concurrency=1 tests/agent-loop.test.mjs tests/assistant-agent-adapter.test.mjs tests/assistant-tools.test.mjs tests/assistant-panel.test.mjs tests/assistant-agent-notes-panel.test.mjs tests/ai-command-widget.test.mjs`. Add this coverage to the next release gate.
2. Playwright, mocked provider and actual App state. Cover Chinese and English prompts, exact proposal approval, cancellation, stale targets, duplicate Run clicks, Run during an existing request or review, and workspace switching. Assert final widget state, provider call count, and displayed receipt. Include timeouts, malformed replies, unavailable models, and disconnected providers. Preserve drafts for retry and verify that failed operations never report success. The current Playwright config uses Edge. Use a checked-in Linux Chromium configuration if Edge is unavailable in Cloud Codex.
3. On an interactive Windows session, use a test workspace and one provider actually reachable from that machine. Start with a short DeepSeek text prompt in normal mode, then verify Agent preview separately. Exercise credential persistence after restart and a confirmed local action. If folder filing is in scope, use a disposable folder and verify actual file state before and after confirmation. Test Gemini and the other providers separately as claimed support warrants.
4. Release criteria. A valid approved action applies exactly once. Cancelled or stale proposals do not apply. Provider failures preserve the draft and give a clear recovery path. Archive redacted evidence, such as a Playwright trace and a Windows smoke result. Mocked cases use no provider tokens.
