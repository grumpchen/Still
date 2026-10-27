# Task: notes-study-ai-actions

- Agent: Codex GPT-6
- Time: 2026-10-27T21:52:00+13:00

## Done
- Added Notes actions for Explain, Summarize, Flashcards, and Study outline.
- Each action opens Still AI with the current note attached as removable context and fills a task prompt. The user chooses whether to send it.
- AI context is bounded to 24,000 text characters. The assistant is instructed to offer study help without silently editing the source note.

## Files
- `still-desktop/src/NotesWidget.tsx`
- `still-desktop/src/AssistantPanel.tsx`
- `still-desktop/src/assistant.css`
- `still-desktop/src/styles.css`
- `still-desktop/src-tauri/src/assistant_protocol.rs`

## Checks
- `pnpm check` — passed.
- `pnpm build` — passed; Vite reported the large-chunk advisory (613.51 kB JS).
- `cargo check --manifest-path src-tauri/Cargo.toml` — passed with the existing unused-method warning in `dropped_files.rs`.
- `git diff --check` — passed.
- Tests not run per task instructions.

## Handoff
- AI returns suggestions in chat; it does not insert or overwrite note contents. Next add an explicit preview-and-apply path for note edits, then work through sidebar utilities and localization/settings/tags.
