# Task: Assistant access to Downloads Inbox

- Agent: Codex
- Time: 2026-11-07T21:22:27+13:00

## Done
- Added an on-demand names-only inbox inspection tool to the provider agent and enabled reviewed moves within the inbox.
- Revalidate the inbox root, source listing and destination before each approved move, and retain file notes and recent paths.
- Support moving files to the inbox root.

## Files
- still-desktop/src/AssistantPanel.tsx, src/App.tsx and assistant domain/provider code
- still-desktop/src-tauri/src/assistant_agent_protocol.rs and files.rs
- focused assistant adapter and panel tests

## Checks
- pnpm check passed.
- Assistant agent adapter tests: 12 passed.
- Mock ChatGPT inbox inspection and reviewed move panel test: 1 passed.
- Focused native agent protocol and granted-root file move tests passed.
- Live provider and native UI workflow not manually verified.

## Handoff
- The inbox tool is available in ChatGPT and provider agent mode; names and relative paths are shared with the selected provider only when the agent calls it. File contents are not included.
- File inspection is bounded and reports truncation. The pre-move check compares path and size rather than a content revision.
