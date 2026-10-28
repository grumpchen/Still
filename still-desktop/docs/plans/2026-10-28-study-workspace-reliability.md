# Study Workspace Reliability and Global Library Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restore reliable AI assistance, make Notes and folders a unified cross-workspace library, keep the app sidebar always user-controllable, and reduce widget drag stutter while assessing AI-generated study widgets without implementing them.

**Architecture:** Keep native file access scoped to user-selected roots and aggregate those roots plus saved note documents across every workspace in the Library page. New notes created while a folder is selected should be files in that folder; existing local notes remain intact and are presented under their workspace until the user files them. Keep the current static widget registry and use it as the trust boundary for future AI-created study widgets.

**Tech Stack:** React, TypeScript, Tauri, Rust, Windows Credential Manager, Node test runner, pnpm, Cargo.

---

## Task 1: Diagnose and repair AI availability
- Reproduce the provider and saved-key state without printing credentials.
- Verify native command registration, command permissions, credential read behavior, UI connection state, and user-visible error handling.
- Distinguish a missing key from a real Credential Manager failure; show a useful setup/reconnect path without logging credential contents.
- Run assistant panel and native credential tests; verify live app AI state if the user has a connected provider.

## Task 2: Make Library cross-workspace and folder-first
- Pass all workspaces into LibraryHome and aggregate every Files folder widget, Notes document, and saved study link with workspace/folder provenance.
- Replace the split Notes/Files navigation with one folder tree; show note files beneath their folders and local notes grouped under their owning workspace.
- Opening any note must route edits back to its originating Notes widget/file; preserve baseline checks for external file changes.
- When a folder is selected, create a Markdown note inside it. Keep existing local notes readable and provide a filing action that writes a selected local note to the chosen folder without losing content.
- Test multiple workspaces, folder and note provenance, cross-workspace open/edit, and save conflict behavior.

## Task 3: Make the sidebar controllable at all times
- Keep a visible expand/collapse control in both sidebar states.
- Preserve persisted collapse state, hover reveal behavior, existing navigation, fullscreen control, and all keyboard shortcuts.
- Test toggle accessibility, persistence, and navigation when collapsed/expanded.

## Task 4: Smooth widget dragging and restore Dashboard scrolling
- Profile the existing pointer-move scheduling and React updates.
- Avoid unnecessary per-frame full-tree work, preserve native Apps suspend/resume ordering, pointer capture, snap/resize behavior, and final persisted geometry.
- Scope a vertical scroll container to the fixed Dashboard content so long pages expose a scrollbar without changing the movable canvas.
- Verify pointer movement, cancellation, drop targets, native panel lifetime, and Dashboard scrolling.

## Task 5: AI-created study widget feasibility only
- Document a safe declarative design: model-generated validated study data, user review, trusted local renderers, bounded persistence, and explicit permission boundaries.
- Compare a generic Flashcards/Quiz widget with code-generated widgets; recommend the generic schema-driven route. Do not build the feature in this task.

## Delivery
- Finish each implementation task with focused checks, a concise agent report, a commit, and remote branch verification before starting the next task.
