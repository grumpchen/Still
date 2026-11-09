# Task: Let the Library agent browse real folders

- Agent: Codex
- Time: 2026-11-09T13:01:09+13:00 (Pacific/Auckland)

## Done
- Added the read-only `list_library_folder` agent tool. It lists immediate child folders and files in the selected Library, including empty directories and formats the note-content index does not read.
- The tool accepts only a relative folder location within the current opaque Library grant and calls the same canonical-path, symlink-aware Files listing helper used by the explorer. Its response contains relative paths and bounded metadata only; it omits the selected folder's absolute path and file contents.
- Added 20-entry pages with `nextOffset`, truncation signaling, provider schema/gate validation, the Tauri command and generated permission, and frontend dispatch. This keeps tool results bounded while allowing the agent to continue through larger folders.
- Added the generated command's allow entry to the main Tauri capability. The first native run caught this missing grant when IPC returned `not allowed`; the same isolated fixture passed after the capability was corrected.
- Existing recursive Markdown/text inspection, search, read, and approval-gated writes are preserved.

## Files
- `still-desktop/src-tauri/src/files.rs`
- `still-desktop/src-tauri/src/assistant_agent_protocol.rs`
- `still-desktop/src-tauri/capabilities/main.json`
- `still-desktop/src/platform/assistant.ts`
- `still-desktop/src/platform/notesLibrary.ts`
- `still-desktop/src/AssistantPanel.tsx`
- `still-desktop/tests/assistant-agent-adapter.test.mjs`
- `still-desktop/tests/native/assistant-reliability.mjs`
- `still-desktop/tests/native/README.md`

## Checks
- `pnpm check` — passed.
- `node --import tsx --test tests/assistant-agent-adapter.test.mjs` — 21 passed, including new agent folder browsing coverage.
- Rust `files::tests::agent_library_tools_are_bounded_grant_scoped_and_compare_before_write` — passed, including empty directory visibility, nested listing, pagination, missing/outside path rejection, and grant change rejection.
- Rust `assistant_agent_protocol::tests::library_tool_schemas_are_bounded_and_edit_requires_its_separate_explicit_gate` — passed, including tool schema and input bounds.
- Native Windows `library-folder-browse` fixture — passed in an isolated Tauri app after fixing the capability grant. It made root and nested folder tool calls against a disposable Library, observed an empty directory and DOCX metadata, and verified that file contents were not returned.
- `git diff --check` — passed.
- No live model account request was made. The user's existing Still development window was left untouched.

## Handoff
- The agent can now browse the chosen Library's directory structure and identify arbitrary attachments by metadata, while reading only supported text through the existing read tool. Binary document contents and their native rendering remain outside this increment.
