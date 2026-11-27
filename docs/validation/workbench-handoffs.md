# Workbench implementation handoffs

Coordinator: Codex. User explicitly requested Luna implementation and coordinator integration/validation. All feature workers use GPT-6 Luna, with isolated worktrees starting from main `4121e8a`.

| Worker | Branch | Owned scope |
| --- | --- | --- |
| luna | agent/luna/dashboard | Startup, Dashboard editing, global layout templates, AI integration |
| luna_native | agent/luna/tray-runtime | Explicit system tray lifecycle, native background tick/replay, runtime status |
| luna_rules | agent/luna/automation-rules | Rule schemas, persistence, parsing, scheduling, execution receipts and duplicate prevention |
| luna_browser | agent/luna/embedded-browser | Interactive child webview, navigation, geometry/visibility lifecycle; original shortcut data retained |
| luna_library | agent/luna/global-library | Cross-workspace Library, QuickCapture, collection operations shared by manual/AI/rules, native file operations |

Coordinator branch: `agent/codex/still-workbench`. Main remains unchanged until reviewed integration is ready.

Shared integration contracts:
- Widget mutation resolves original IDs across all workspaces, not just the active workspace.
- Browser remote webviews have no Still command capability; main-owned commands validate URLs and owner IDs.
- Native automation tick: `still:automation-tick`; sequence/replay handles missed runtime notifications. Persistent rule receipts separately prevent duplicates across restart.
- Rules invoke the shared operation adapter and report actual outcomes. Existing frontend `files_organisation_*` facades have no native implementation in baseline and must not be treated as working commands.
- Native `main.rs`/Cargo registration overlaps are integrated by coordinator; workers do not edit another worker's worktree.
- Acceptance remains ordered by batch even where independent implementation runs concurrently.
