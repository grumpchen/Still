# Still Agent Reliability Implementation Plan

**Goal:** Let a user inspect an authorized folder, review file and widget changes, and see what actually happened as the agent continues.

**Architecture:** Keep the existing provider routes and the Still-owned tool loop. Reuse Library grants and workspace action validation. Store approvals only for the current run, check the target again when applying a change, and return the actual outcome to the provider and the UI. A replacement CLI harness would duplicate existing provider and permission handling; a prompt-only change would leave execution unverified.

**Tech stack:** React, TypeScript, Tauri/Rust, existing provider adapters.

1. Establish a desktop baseline using a disposable folder. Verify the checkout, UI, provider route, and batch-move behavior independently.
2. Luna: generalize widget creation end to end in an isolated worktree. Use the existing catalog and action executor. Cover unknown types, stale approvals, provider schemas, and visible widget names.
3. Codex: harden continuation and outcome handling in `agentLoop.ts`, `platform/assistant.ts`, and `AssistantPanel.tsx`. Do not lose completed receipts when a later step fails; exercise repeat approval, decline, and provider failure.
4. Connect reviewed inbox moves to the provider loop, using the existing authorized listing and native move handler. Verify partial outcomes and reject uninspected paths; keep the existing final-answer proposal route compatible.
5. Extend the same boundary to Library file reading and editing, selected file context, and more workspace actions after the first mixed workflow is verified. Keep session context bounded and user-managed memory explicit.
6. Run focused TypeScript and Rust checks and the native fixture flow through ChatGPT subscription and an available API provider. Record precisely which routes ran, commit the report, and leave the branch local.
