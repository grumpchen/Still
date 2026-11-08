# Still Agent Recovery and Workspace Tools Implementation Plan

> **Execution:** Luna implements each increment in an isolated Git worktree; the coordinator reviews and runs native acceptance. Do not merge or push.

**Goal:** Recover an interrupted task without repeating mutations, then extend the agent to authorized Library files and reviewed widget/settings controls.

**Architecture:** Native Still owns durable operation state; approvals expire across sessions. UI and provider routes share reviewed executors and report what Still could verify. Keep file authority in existing Tauri grants and treat returned text as untrusted data.

**Tech Stack:** React/TypeScript, Tauri/Rust, Windows WebView2, pnpm, Playwright.

### 1. Durable reviewed inbox operations

- Add a bounded, versioned native journal under Still app data (e.g. `src-tauri/src/assistant_journal.rs`), and wire it in `src-tauri/src/main.rs` and `files.rs`. Store workspace/run IDs and relative paths, operation order, original identity/revision, and verified destination/outcome. Do not save prompts, API keys, provider traces, or file contents.
- Persist the attempt before dispatching each file operation. Capture the exact non-overwriting destination before the native move so reconciliation knows where to look, including collision suffixes. Use a crash-safe replace/flush or a recoverable record format. Refuse to start an operation if its pre-move record cannot be written. Treat a failed receipt write as uncertain.
- On startup, reconcile only against the same currently authorized root. Compare source and destination state to evidence captured before the move. Report ambiguity honestly when both/neither exists or identity cannot be established. Never replay an interrupted operation automatically. Present verified completed moves and an explicit way to dismiss/archive the record. A follow-up must re-inspect and receive fresh approval for the remaining steps; never resurrect a provider closure.
- Wire both inbox approval entry points in `src/AssistantPanel.tsx` through the same path (`src/domain/assistantInbox.ts`, `src/platform/files.ts`, and `src/App.tsx`). Keep recovered history scoped to the originating workspace. Start with a failing native recovery test for crash after first move, including interruption before receipt flush; then pass it and check revoked grants and a replaced destination. Run `cargo test --offline --bin still-desktop` and focused TypeScript tests. Commit separately.

### 2. Scoped Library tools and reviewed edits

- Reuse `src-tauri/src/files.rs`, `src/platform/notesLibrary.ts` and the Library's native grant. Add bounded browse/search/read of that grant only: use relative paths, cap results and text, reject traversal/symlink escape, and stop when the grant changes. Do not expose other folders or absolute paths.
- Reuse the existing compare-before-save text operation for reviewed Markdown/text edits. Show the file and before/after change before approval. After review recheck the grant and original text/revision; refuse conflicts and report the verified result. Bind proposals to files the agent read in the current run. Separate untrusted resource contents from agent instructions.
- Update `src/platform/assistant.ts`, `src/AssistantPanel.tsx`, `src-tauri/src/assistant_agent_protocol.rs`, and `chatgpt_plan.rs` together. Test traversal, missing/revoked grant, stale edit, bounded results, decline, and provider continuation. Commit separately.

### 3. Review more workspace controls

- Extend the validated action catalog in `src/domain/assistant.ts`, `src/domain/assistantTools.ts`, native agent protocol, and `src/App.tsx` to cover a focused set of existing UI actions: move/resize a selected regular widget and change a supported, reversible in-app preference. Reuse the current workspace/prefs executor and undo where supported. Never expose credentials, security grants, or native process controls.
- Review shows old/new values, rejects stale targets and fixed pages, and reports actual persisted outcomes. Test existing actions and the new cases, including bad input and stale snapshots. Commit separately.

### 4. Native acceptance

- Add a repeatable opt-in Windows Playwright WebView2 acceptance fixture under `still-desktop/tests/`. Use a separate Tauri app identifier, profile, grants, and disposable files. Use a loopback CDP port only for the fixture. Stub model traffic independently from real IPC/filesystem effects.
- Cover successful batch and widget review, crash after first of two moves, edited source during review, revoked grant, and provider error after a successful mutation. Assert outcomes on disk and in the UI. On restart: show the first move, no automatic second move or widget action, and no repeated execution. Run `pnpm check`, focused tests, native Rust tests, and separate synthetic live provider smoke checks where configured. Record actual results in the agent report and restore the normal preview.
