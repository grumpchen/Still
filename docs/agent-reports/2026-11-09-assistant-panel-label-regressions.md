# Task: Assistant panel Files label regressions

- Agent: Codex (GPT-6 Luna)
- Time: 2026-11-09

## Done
- Updated three AssistantPanel UI assertions to use the current Files catalog label while preserving the internal `notes` widget identifier and note functionality.
- This resolved two stale “Notes 1” assertions and the add-widget test timeout that was waiting for “Added a Notes widget” after the UI receipt changed to “Added a Files widget.”

## Checks
- Focused AssistantPanel UI tests — 3 passed: workspace selection/screenshot context, provider agent review, and widget additions plus continued chat history.
- `git diff --check` — passed.

## Handoff
- This was test expectation maintenance only; no product code or native window state changed.
