# Task: Agent widget catalog coverage

- Agent: Codex (GPT-6 Luna)
- Time: 2026-11-09

## Done
- Added execution coverage proving the agent tool can prepare and apply every workspace-available widget type through the confirmation-gated registry.
- Added a cross-layer assertion that the TypeScript workspace catalog, both native provider tool schemas, and Rust widget-type validation agree. The retired standalone `files` type stays unavailable for new widgets while the Notes widget keeps its user-facing Files name.
- Updated stale sidebar source assertions for the Codex subscription provider and receipt-before-clear recovery flow.

## Checks
- `assistant-tools.test.mjs` and `assistant-sidebar.test.mjs` — 22 passed.
- `git diff --check` — passed.

## Handoff
- This verifies catalog coverage and the gated registry lifecycle. It does not perform a native live-provider request for every widget or a live ChatGPT account round trip.
