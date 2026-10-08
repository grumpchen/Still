# Direct Ctrl+Shift-click attachment plan

> Plan only. Implementation starts only after the user asks to proceed.

## Goal and boundary

Holding Ctrl+Shift while pressing the left mouse button over an external Windows app captures that exact window. The click must continue normally to the app, and the app must receive focus normally. After mouse-up, Still revalidates the captured HWND/PID, creates exactly one transient Apps widget with `appKey: null`, and attaches it through the existing `app_panel_attach()` path.

This task excludes Save to tray, reusable shortcuts, executable preparation, relaunch behavior, and any broader diagnostics system. Do not change native containment/movement, Groups, white-stripe handling, tray behavior, or Phase 2.5.

## Baseline and ownership

- Source commit: `afe209e5e2fe319b13f88e218cd4d1435f432b57` (`fix(native-panels): hide at workspace right edge`).
- Known-good executable: `C:\Users\haoka\Projects\Default Project\.worktrees\still-luna-attach-edge-phase1\still-desktop\src-tauri\target\release\ver0.21-test-attach-edge-r2.exe`.
- SHA-256: `3E098E5719DEDE0A2AEBCD26AC722CDD41184CA2B5C385941CD529598CA06A6A`.
- Isolated branch/worktree: `agent/codex/direct-window-capture` at `C:\Users\haoka\Projects\Default Project\.worktrees\still-codex-direct-window-capture`.
- Keep later Phase 2 branches and builds unchanged. Do not edit the shared checkout.

## Verified failure in the baseline

1. `shortcuts.rs` has a low-level keyboard hook but no global mouse capture path.
2. The existing attach UI prepares an executable/source before attachment, which blocks transient attachment when that identity is unavailable.
3. `appPanel.attach()` already forwards the selected HWND/PID to native `app_panel_attach()`, which accepts a target without an executable identity.
4. The native attach path can activate Still. Capture-specific handling is therefore needed so the ordinary click and focus remain with the clicked app.

## Smallest implementation

1. Add an isolated low-level mouse observer. On Ctrl+Shift plus physical left-button-down, capture the root HWND and PID at the click point. Always call `CallNextHookEx`; never cancel or delay the click. Retain the captured intent through the matching left-button-up and dispatch work afterward. Releasing Ctrl or Shift before mouse-up must not cancel the pending capture.
2. Revalidate that exact root HWND/PID after mouse-up and immediately before attachment. Reject closed/reused windows, Still-owned windows, and already attached targets. Do not substitute the foreground window, enumerate for an executable, or require discovery-list membership.
3. Deduplicate by exact HWND/PID while work is in flight and against already attached panels. For one valid target, create one transient Apps widget with `appKey: null`, keep the HWND/PID only in runtime attachment state, then make one direct call through the existing `app_panel_attach()` path. Do not call app launch or executable preparation.
4. Preserve the clicked app's foreground focus through this capture-specific attachment path; leave normal Attach Open App behavior unchanged.
5. Add only minimal stage logging and a visible, actionable failure message. Do not add a diagnostic history, telemetry, or general-purpose capture subsystem.

## Expected code ownership

Touch only the smallest files needed after confirming the call path:

- Native mouse observer and HWND/PID checks, likely in a focused new capture module or the existing native shortcut module.
- Tauri command/event registration only if required for capture delivery.
- Existing frontend capture listener/widget creation and Apps attach bridge.
- `app_panel.rs` only for the capture-specific focus behavior and an attachment deduplication guard if the existing guard is insufficient.
- Focused capture tests and the implementation report.

Do not edit picker preparation, tray/group components, workspace geometry, clipping/containment, or unrelated files. If direct attachment cannot be wired without crossing those boundaries, stop and report the exact blocker before expanding scope.

## Focused verification and handoff

- Test modifier matching on mouse-down, including Ctrl/Shift released before mouse-up; passthrough of both mouse events; exact root HWND/PID revalidation; stale or reused HWND rejection; Still/already-attached rejection; duplicate suppression; one `appKey: null` widget; and exactly one direct attach call with the captured identity.
- Run the focused frontend/native tests, frontend check/build, and `git diff --check`.
- Build one Windows test executable named `ver0.21-test-direct-window-capture.exe`; do not overwrite earlier builds.
- Do not launch the build or claim live click/focus success from automated tests. Report source commit, changed files, checks, executable path, size, and SHA-256, then stop for the user's Windows test.

## Acceptance

- Ctrl+Shift-click on an external app performs the app's normal click and leaves focus with that app.
- After mouse-up, precisely the HWND/PID captured at mouse-down attaches to precisely one new transient Apps widget.
- Releasing Ctrl/Shift before mouse-up does not cancel capture.
- No picker, modal, app launch, executable preparation, or duplicate attachment occurs.
- Invalid/stale targets produce a visible failure message; failures are minimally stage-logged.
- Existing attach-edge-r2 behavior outside this feature remains unchanged.

**State: PLAN COMPLETE / WAITING FOR IMPLEMENTATION INSTRUCTION.** No source changes, tests, or build are part of this planning task.
