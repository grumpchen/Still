# Task: Let the Library agent browse real folders

- Agent: Codex
- Time: 2026-11-09

## Done
- Added the read-only `list_library_folder` agent tool. It lists immediate child folders and files in the selected Library, including empty directories and formats the note-content index does not read.
- The tool accepts only a relative folder location within the current opaque Library grant and calls the same canonical-path, symlink-aware Files listing helper used by the explorer. Its response contains relative paths and bounded metadata only; it omits the selected folder's absolute path and file contents.
- Added 20-entry pages with `nextOffset`, truncation signaling, provider schema/gate validation, the Tauri command and generated permission, and frontend dispatch. This keeps tool results bounded while allowing the agent to continue through larger folders.
- Existing recursive Markdown/text inspection, search, read, and approval-gated writes are preserved.

## Checks
- `pnpm check` — passed.
- `node --import tsx --test tests/assistant-agent-adapter.test.mjs` — 21 passed, including new agent folder browsing coverage.
- Rust `files::tests::agent_library_tools_are_bounded_grant_scoped_and_compare_before_write` — passed, including empty directory visibility, nested listing, pagination, missing/outside path rejection, and grant change rejection.
- Rust `assistant_agent_protocol::tests::library_tool_schemas_are_bounded_and_edit_requires_its_separate_explicit_gate` — passed, including tool schema and input bounds.
- `git diff --check` — passed.
- No live model account request or native UI restart was performed. The currently running Still development window was left untouched.

## Handoff
- The agent can now browse the chosen Library's directory structure and identify arbitrary attachments by metadata, while reading only supported text through the existing read tool. Binary document contents and native-app rendering remain outside this increment.
