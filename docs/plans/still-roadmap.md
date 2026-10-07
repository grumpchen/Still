# Still current product roadmap

Updated: 2026-10-08, Pacific/Auckland. Owner: Codex coordinator. Implementer: GPT-6 Luna High in the user's next session.

**Current phase: Phase 1 — Fix Attach Open App and the right-edge white stripe.**
**Current state: PLAN COMPLETE / WAITING FOR USER.** No implementation started under this roadmap.

This replaces the phase ordering in the October 6 next-features plan. Earlier reports and builds remain historical evidence, not acceptance of these fixes. Do not automatically advance phases.

## Baseline and ownership

- Canonical repository: `C:\Users\haoka\Projects\Default Project`.
- Inspected current test source: `.worktrees/still-codex-ui-cleanup`, branch `agent/codex/ui-cleanup`, source baseline `45410ae570c0b5a62ed9e9d867808adee299f757`.
- Reproduction candidate: `.worktrees/still-codex-ui-cleanup/still-desktop/src-tauri/target/release/ver0.21-test-ui-cleanup.exe`. This is unaccepted and unlaunched by Codex.
- Shared root checkout is a different branch: `agent/opencode/app-resize-grip-cutout`, HEAD `6fe5e999e00b32d49d643fbba8ccd7e091e3b287`, with pending changes. Leave it and other task worktrees untouched.
- Use an isolated Phase 1 branch/worktree from the recorded source baseline. If the user's actual failing executable differs, record its source commit and reproduce there before coding; do not silently substitute the shared checkout.
- Keep each phase sequential. Phase 1A and 1B use separate focused commits in one candidate. No simultaneous edits to App.tsx, AppsWidget.tsx, WorkspaceCanvas.tsx or native attachment code by different implementers.
- No merge, push, release acceptance, executable auto-launch or overwriting old builds. Test candidate: `ver0.21-test-attach-edge.exe`; iterations use `-r2`, `-r3`, etc. Only an accepted release gets a new release version.

## Phase 1 — Fix first (CURRENT)

Task ID: `phase1_attach_edge`. Detailed handoff: `docs/superpowers/plans/2026-10-08-phase1-attach-and-edge.md`.

1. Restore working Attach Open App discovery, selection and attachment before layout refinement. Reuse the existing picker and native attachment flow. Preserve search, refresh, real icons, window names and the single main Attach action. Then ensure rows do not compress/crop and long lists scroll inside the dialog.
2. Test the proposed right-edge policy for Browser and Apps: hide the native HWND when it crosses the visible workspace's problematic right edge; apply the latest position/clip while hidden; restore only when the latest native geometry fits safely. Partial right-edge content remains blank until safe, including after scrolling settles. Do not close/relaunch the application or add global blanking for ordinary overlap.
3. Keep white-stripe work focused on native visibility/geometry. No sidebar, workspace, tray, theme, fullscreen or floating-tray redesign in this phase.
4. Run focused frontend/native checks, produce one combined test build with both focused commits, report limitations, and STOP at READY TO TEST. The user performs live Windows acceptance.

Gate: successful discovery/selection/attachment, contained list scrolling, and no right-edge stripe on Chrome and a native App while moving/resizing/scrolling at tested DPI. Passing automated tests alone does not satisfy the compositor check.

## Phase 2 — Settings entry and hotkey quick-add (QUEUED)

Dependency: user acceptance of Phase 1; start only on explicit instruction.

- Keep the bottom sidebar settings icon. Use it as the Settings/customization entry point, retaining existing appearance/shortcut access.
- Audit the actual accepted source for quick-add before coding. Inspected baseline already has Add Widget (`gallery`), Ctrl+K commands including Add widget, customizable workspace navigation shortcuts, and native shortcut handling; it has no dedicated configurable quick-add action in those inspected paths.
- Reuse the catalog and gallery for a compact quick-add panel (Browser, Group, Calculator, Notes, Folder/Files, Apps and remaining supported types). Reuse action dispatch rather than creating a second widget-creation route.
- Add a configurable quick-add shortcut to the existing shortcut settings/validation and native shortcut route, with browser/app focus support while Still is active. Avoid duplicate key handling, repeat-triggered additions, navigation/editing shortcut conflicts and activation while a modal is already open.
- Preserve current naming; do not rename widgets as part of this task.

Likely ownership: App.tsx, AppearanceSettings.tsx/Settings entry, ShortcutSettings.tsx, domain/shortcuts.ts, platform/shortcuts.ts, src-tauri/src/shortcuts.rs and focused shortcut tests. Stop at READY TO TEST.

## Phase 3 — Group floating trays (QUEUED)

Dependency: accepted Phase 2; separately plan the persisted draft contract before implementation.

- Clicking the normal top `Group` button still creates a normal Group widget.
- Dragging a saved named Group/collection from the top tray creates a movable floating tray containing a draft copy of that collection. Keep the permanent top tray and original saved Group.
- The floating tray moves within workspace bounds and supports collection edits through the existing Group entry/link controls.
- Dragging it back onto its original Group updates that Group with the current collection. On successful save, remove only the returned floating tray; keep widgets previously opened from it. A failed save leaves the floating tray available.
- Identify its origin with saved workspace/group IDs, not native HWND/PID. Reject a missing/different original target; do not silently overwrite a different group. If the original changes while a draft is open, prevent silent replacement of those edits.
- Reuse Group type/rendering and existing entries, resource validation and drag payloads. Do not add a second top widget tray or infer native/live application state from a saved group entry.
- Preserve existing open-widget-to-Group saving. Blank top tray removes the live instance only. Apps/Files/Browser/Notes/Calculator/etc. remain non-save targets for open widgets. Existing normal clicks continue working; external resource-drop rules are a separate behavior and are not changed incidentally.

Likely ownership: GroupTray.tsx, GroupWidget.tsx, GroupEditor.tsx, WorkspaceCanvas.tsx, App.tsx, domain/workspaces.ts, domain/trayDrop.ts and group/tray/persistence tests. Stop at READY TO TEST.

## Phase 4 — Customization (QUEUED)

Dependency: accepted Phase 3 and explicit start instruction.

- Use the bottom icon to open organized Settings: transparency/glass, widget opacity, theme, sidebar/tray appearance, floating-tray behavior, startup/session restore and the quick-add hotkey.
- Reuse existing appearance, glass, shortcut and persisted workspace state; migrate older saves with sensible defaults.
- Add the fully transparent workspace/Wallpaper Engine option here, as an explicit saved setting; preserve visible glass controls and no click-through.
- The reproduction baseline already forces desktop transparency. Do not expand or undo that experiment during Phase 1; Phase 4 turns it into a controlled user option.
- Startup/session restore concerns layout and supported panel recovery. Do not persist transient HWND/PID or promise to reopen unsaved application documents.
- Define the individual customization controls before this phase starts; do not invent unrelated preferences.

## Workflow and completion

Use GPT-6 Luna High for coding and routine fixes. Use a cheaper/free model for bounded mechanical work only after ownership is separated. Sol is justified for unresolved native/compositor architecture debugging, not routine UI implementation. ChatGPT is not a required reviewer.

Every task records baseline, branch/worktree, owned files, actual tests/results, unresolved limitations and candidate path. Stop at READY TO TEST, BLOCKED or WAITING FOR USER. NEXT ACTION: Waiting for user. No next-phase auto-start.
