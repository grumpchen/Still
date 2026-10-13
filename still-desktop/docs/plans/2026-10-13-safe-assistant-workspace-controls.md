# Safe Assistant Workspace Controls Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let Still AI perform the common widget and tray operations available in the active workspace without granting arbitrary operating-system access.

**Architecture:** Extend the existing JSON action protocol with narrowly typed widget creation and saved-tray restoration operations. Supply only safe tray metadata, validate every requested widget type and saved-item ID against current app state, apply changes atomically, and keep Undo snapshots. Preserve explicit confirmation for bulk destructive actions and any action that launches an external app.

**Tech Stack:** React, TypeScript, domain workspace helpers, Rust/Tauri JSON protocol, Node tests, Cargo tests.

---

### Task 1: Publish safe workspace context

**Files:** `src/domain/assistant.ts`, `src/AssistantPanel.tsx`, `tests/assistant.test.mjs`

- Include preset and Group names/types plus opaque local IDs in assistant context; never include resource paths, grants, URLs, app window handles, or saved content.
- Test that the saved-tray manifest contains only safe fields and is omitted from unrelated widget-content sharing.
- Resolve saved names and "open all" locally so item IDs come from current Still state, not model guesses.

### Task 2: Extend and validate the action protocol

**Files:** `src/domain/assistant.ts`, `src-tauri/src/assistant_protocol.rs`, `src-tauri/src/assistant.rs`, `tests/assistant.test.mjs`

- Add `add_widget` and `open_saved` to both provider prompts and Rust/TypeScript parsers.
- Validate widget types against the first-party registry and saved IDs against the active workspace's current tray inventory; reject stale/duplicate saved IDs, oversized actions, and mixed proposals before state changes. Repeated widget type names represent a bounded request for several instances of that type.
- Enforce a 10-item combined add/open batch limit in the UI, TypeScript response parser, and Rust response parser; reject oversized prompts before sending them to a provider.
- Enforce a 100-card workspace ceiling before any creation, including automatic Focus creation for timer requests.
- Retain existing action limits and exclusive layout/action responses.

### Task 3: Apply actions safely

**Files:** `src/App.tsx`, `src/domain/assistant.ts`, `src/AssistantPanel.tsx`, `tests/assistant-sidebar.test.mjs`

- Handle add/open requests as one immutable state update with one Undo snapshot and bounded placements.
- Resolve “open all saved widgets” locally from the tray inventory; avoid depending on model-invented IDs.
- Confirm bulk actions that can launch external apps or discard saved data; keep app/window lifecycle calls on existing adapters.
- Explain over-limit requests in the chat composer; opening saved app shortcuts requires an explicit on-screen confirmation.

### Task 4: Verify, document, hand off

**Files:** `docs/plans/2026-10-11-gemini-sidebar.md`, `docs/agent-reports/2026-10-13-safe-assistant-workspace-controls.md`

- Run focused frontend tests, TypeScript/build checks, and assistant Rust protocol tests.
- Update usage and safety limits, report tested behavior and any still-unsupported app controls, then commit only task-related changes without staging unrelated workspace edits.

### Implementation notes

- Completed typed actions: add built-in widgets, reopen saved presets and Groups, minimize/restore cards, save reusable shortcuts, and set timers. Layout remains a validated proposal with an explicit Apply step. Saved app shortcuts require confirmation; deleting all cards or clearing the tray uses the existing confirmation and Undo flow.
- The UI rejects explicit add/open batches above 10 before provider requests. The response parsers and state boundary repeat the limit, and the workspace is capped at 100 cards for assistant-driven creation.
- The assistant continues to receive only selected widget contents through @; the saved tray context contains names, types, and opaque item IDs only. Arbitrary code and operating-system actions are outside the workspace action protocol.
- Focused tests and Rust protocol tests pass. `pnpm test` currently reports 28 failures in unrelated work already present in this shared tree, including stale tests for the removed Browser widget and legacy state/schema expectations; 235 tests pass.
