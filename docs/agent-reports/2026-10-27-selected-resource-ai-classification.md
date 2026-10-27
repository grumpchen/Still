# Task: selected-resource-ai-classification

- Agent: Codex GPT-6
- Time: 2026-10-27T21:48:00+13:00

## Done
- Added a deliberate “Ask AI to classify” action to a selected Files item. It opens Still AI with a suggested course/topic prompt; the user must still press Send.
- Shares only the selected file's relative path, name, size, saved file notes, and up to 24,000 characters when the preview is text. No absolute folder path is included.
- Added a removable AI-context chip and native assistant guidance to treat file data as untrusted and provide suggestions only. No file is moved, renamed, or deleted.

## Files
- `still-desktop/src/FilesWidget.tsx`
- `still-desktop/src/AssistantPanel.tsx`
- `still-desktop/src/assistant.css`
- `still-desktop/src-tauri/src/assistant_protocol.rs`

## Checks
- `pnpm check` — passed.
- `pnpm build` — passed; Vite reported the large-chunk advisory (610.04 kB JS).
- `cargo check --manifest-path src-tauri/Cargo.toml` — passed with the existing unused-method warning in `dropped_files.rs`.
- `git diff --check` — passed.
- Tests not run per task instructions.

## Handoff
- Text preview content can be sent for classification; PDFs and other non-text media currently send filename, relative path, size, and saved notes only. Continue with better cross-folder search, a user-confirmed filing flow, and richer document extraction before claiming complete AI classification.
