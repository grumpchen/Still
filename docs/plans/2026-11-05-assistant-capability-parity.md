# Still AI capability parity implementation plan

**Goal:** Make Still AI respond to the user's actual intent and support the same safe Still workspace operations that users can perform in the interface.

**Architecture:** Keep natural language generation at the provider boundary, then map the result into a typed, validated action protocol. Apply deterministic intent, target, quantity, and resource-limit checks before any state mutation; ask a short question for ambiguity and use the existing review/undo path for consequential operations. Keep arbitrary external Windows app control out of scope.

**Tech Stack:** React, TypeScript, Rust/Tauri, Playwright, Node test runner.

---

### Task 1: Reproduce current assistant failures

**Files:** `still-desktop/tests/e2e/`, `still-desktop/playwright.config.ts`, `still-desktop/src/AssistantPanel.tsx`

1. Capture browser console, page errors, failed requests, panel geometry, and the provider request/response for a minimal chat and an action prompt.
2. Reproduce the maximized panel send case and the screenshot case (`make three notes file`) without changing workspace state.
3. Record the concrete root cause and retain a focused regression test.

### Task 2: Enforce conversation and action intent boundaries

**Files:** `still-desktop/src/domain/assistant.ts`, `still-desktop/src/AssistantPanel.tsx`, `still-desktop/src-tauri/src/assistant_protocol.rs`, `still-desktop/tests/`

1. Add failing cases for ordinary chat, ambiguous workspace requests, spelled-out quantities, mismatched action targets, and over-limit batches.
2. Normalize common number words and determine whether the requested object means a widget, a note document, or a collection of notes.
3. Treat a clarification intent, unknown target, or action/result mismatch as no-op clarification; never apply model-proposed extra or under-count actions.
4. Align the system prompt and provider-specific guidance so general chat stays conversational and workspace operations use the full supported schema.

### Task 3: Reach user-visible Still action parity

**Files:** `still-desktop/src/domain/assistant.ts`, `still-desktop/src/AssistantPanel.tsx`, `still-desktop/src-tauri/src/assistant_protocol.rs`, `still-desktop/src/App.tsx`, `still-desktop/src/WorkspaceCanvas.tsx`, `still-desktop/src/GeneralSettings.tsx`

1. Inventory controls users can operate inside Still and map each to a typed action or explicitly identify platform-only operations.
2. Add missing bounded actions for Still-managed widget, workspace, plugin, and settings controls, reusing normal application state functions.
3. Keep destructive operations reviewable and undoable; validate IDs, fields, quantities, and final state in both frontend and native boundaries.

### Task 4: Stabilize maximized assistant layout and send flow

**Files:** `still-desktop/src/AssistantPanel.tsx`, `still-desktop/src/assistant.css`, `still-desktop/src/App.tsx`, `still-desktop/tests/e2e/`

1. Verify panel dimensions and composer visibility at normal, maximized, and narrow layouts.
2. Fix height/overflow/focus issues with one responsive layout; preserve scroll position and submission state.
3. Add Playwright coverage for resize/maximize, typing, Enter/send, and returned chat/action messages.

### Task 5: Validate and hand off

Run focused TypeScript/domain tests, Playwright checks, and Rust protocol checks where relevant. Run the production build and review the diff. Report pre-existing failures separately from regressions and preserve unrelated dirty work.

### Follow-up product idea: timetable-linked environments

Treat the Still environment/workspace as the primary thing linked to a timetable course; a filesystem folder is optional, not required. An environment can bring together its workspace layout, Files widgets, saved links, and other course-related widgets. When a scheduled class is approaching or starts, Still can offer or open the linked environment. Keep the trigger configurable so users can choose automatic opening or a prompt, and let them associate a folder only when useful.
