# Direct Window Capture Implementation Plan

> For the implementer: execute only this feature in the assigned worktree. This handoff is planning-only; wait for the user's implementation instruction.

**Goal:** Ctrl+Shift-click attaches the exact external HWND/PID to one new Apps widget while preserving the original click and external focus.

**Architecture:** Observe mouse input, validate a transient window identity, and use the existing `appPanel.attach()` / `app_panel_attach()` route. Executable grants are optional and deferred until an explicit Save to tray action. Add a capture-specific focus policy; preserve existing picker focus behavior and all geometry, clipping, and movement policies.

**Tech stack:** React/TypeScript, Tauri 2, Rust, Windows low-level mouse hook and HWND APIs.

## Task control and baseline

- Task ID: `direct_window_capture_attach_edge_r2`.
- Source baseline: `afe209e5e2fe319b13f88e218cd4d1435f432b57` (`fix(native-panels): hide at workspace right edge`).
- Baseline executable: `C:\Users\haoka\Projects\Default Project\.worktrees\still-luna-attach-edge-phase1\still-desktop\src-tauri\target\release\ver0.21-test-attach-edge-r2.exe`.
- Verified SHA-256: `3E098E5719DEDE0A2AEBCD26AC722CDD41184CA2B5C385941CD529598CA06A6A`.
- Provenance: hash matches the committed Phase 1 build report. Subsequent commits through `e769413` change documentation only; the source tree is unchanged from `afe209e`. The executable does not provide an independently verified embedded commit manifest; this association comes from the matching build record and source history.
- Branch: `agent/codex/direct-window-capture`.
- Worktree: `C:\Users\haoka\Projects\Default Project\.worktrees\still-codex-direct-window-capture`.
- Treat attach-edge-r2 as the user's known-good behavioral baseline. Preserve `e04a45f` and later Phase 2 branches for reference only; do not merge/cherry-pick their feature commits.
- Recommended implementer: GPT-6 Luna, High. Difficulty: moderate to high because click delivery, focus, and duplicate suppression cross Windows/Tauri/React boundaries. Sol is justified for this analysis and a focused native review, not routine implementation.
- Scope ownership is exclusive during implementation. Do not edit the shared dirty checkout or other worktrees.

## Source-verified path diagnosis

| Step | Requested baseline | Later `e04a45f` reference | Required change |
|---|---|---|---|
| 1. Detect Ctrl+Shift left-click | `shortcuts.rs` installs only `WH_KEYBOARD_LL`; no global mouse observer | A mouse observer was added | Add an isolated observer without changing workspace shortcuts |
| 2. Exact root HWND/PID | No capture identity is produced | Uses `WindowFromPoint` and `GetAncestor(GA_ROOT)` | Capture click target, not a later foreground window or executable match |
| 3. Frontend delivery | No capture listener | Listener exists but subscription failure is swallowed | Listener-ready handshake and correlated, bounded diagnostics |
| 4. Revalidate | Picker uses exact selection, then prepares executable grant | Requires discovery-list membership and `appPanel.prepare()`; failures are swallowed | Exact-target validation independent of list limits and executable grants |
| 5. Create one widget | `managedAppWidget()` builds from a source-backed preset | Creation happens only after executable preparation succeeds | Source-free Apps instance plus transient attachment map; deduplicate in-flight identities |
| 6. Direct native attach | `appPanel.attach()` passes exact HWND/PID; native command accepts `executable: None` and uses an empty `source_id` | Reaches this only if all preparation steps succeed | Call the direct path unconditionally for valid controllable targets; never call app open/launch |

Additional focus blockers: `app_panel_attach()` explicitly calls `SetForegroundWindow(main)`. `position()` returns focus to main when restoring a focused maximized/minimized target. Merely forwarding the mouse hook is insufficient: ownership/hide/show can also disturb focus. Capture must opt into a narrow focus-preservation policy at these existing attachment transitions; ordinary picker behavior stays unchanged.

This is static code diagnosis, not a claimed live reproduction. No executable was launched during planning. On the baseline, steps 1-3 are absent, so there is no live capture pipeline to trace yet. Implementation must record all six boundaries and prove external click/focus behavior in Windows acceptance.

## Owned files

Paths below are relative to the new worktree.

- Create `still-desktop/src-tauri/src/app_capture.rs`: mouse observer, readiness, exact-target validation, bounded capture diagnostics.
- Modify `still-desktop/src-tauri/src/main.rs`, `still-desktop/src-tauri/build.rs`, `still-desktop/src-tauri/capabilities/main.json`: register only new capture commands/events and startup/shutdown handling; review generated permissions for only the required commands.
- Modify `still-desktop/src-tauri/src/app_panel.rs`: capture-specific focus option, exact identity reservation/duplicate rejection, and managed-target lookup for explicit lazy saving. Do not change positioning math, region construction, presentation revisions, edge policy or z-order rules.
- Modify `still-desktop/src-tauri/src/app_picker.rs`: reuse metadata helpers and permit explicit executable preparation for an exact, currently managed capture target. No picker redesign or discovery behavior change.
- Create `still-desktop/src/platform/appCapture.ts`, `still-desktop/src/domain/appCapture.ts`: capture bridge/orchestration and bounded single-flight handling. Reuse the existing app attachment state rather than a second native-panel manager.
- Modify `still-desktop/src/platform/appPanel.ts`: optional capture identity/focus metadata on attachment; default ordinary attach behavior unchanged.
- Modify `still-desktop/src/domain/appPicker.ts`: source-free Apps widget construction using existing widget defaults/placement helpers.
- Modify `still-desktop/src/App.tsx`, `still-desktop/src/AppsWidget.tsx`: capture listener, functional widget creation, direct transient attach, failure feedback and explicit lazy Save.
- Create `still-desktop/tests/app-capture.test.mjs`; add narrowly named native capture tests in the native files above. Reuse existing test tools.
- Update this plan's checkboxes and add `docs/agent-reports/2026-10-08-direct-window-capture-implementation.md` during implementation.

Do not modify `WorkspaceCanvas.tsx`, Group components, layout/containment helpers, `chrome_overlay.rs`, `native_panels.rs`, styles/tray design, workspace shortcuts, Phase 2.5, or the broader roadmap. If a needed change would cross those boundaries, report the concrete blocker before proceeding.

## Milestone 1 — Observe and validate the exact click

1. Add focused failing tests for modifier matching, injected-event rejection, Still/managed exclusions, root HWND/PID identity, stale PID/closed HWND rejection, no executable requirement, and bounded request cleanup.
2. Install a separate `WH_MOUSE_LL` observer on a thread with a message loop. Keep normal workspace keyboard hooks unchanged. Check Ctrl+Shift before doing target work; no discovery enumeration, executable lookup, icon extraction, file IO or blocking locks in the hook.
3. Capture the root HWND/PID from the physical left-button-down point; always return `CallNextHookEx`. Record the clicked identity through release and dispatch attachment work outside the hook after forwarding the matching button-up. Do not hide/move/activate the app inside either callback. Modifier release or cancelled input cancels the pending gesture. Do not substitute a later foreground HWND.
4. Frontend subscribes before enabling capture. Add a small authenticated readiness/validation interface, gate capture until ready, and report installation/subscription failure through the existing nonactivating notification UI. Keep the rest of Still usable if capture cannot start.
5. Revalidate the exact root HWND/PID after event delivery and again immediately before native mutation. Reject Still process/owned windows, existing Apps/Chrome-managed windows and desktop/system/tool targets. Treat app name/icon as optional metadata. A valid controllable window with no executable identity must pass.
6. Give each gesture a correlation ID. Bound diagnostics to the last 64 requests and expire pending entries. Record stage/outcome/error; no window identity in saved layouts or tray presets. Native emit failure and listener initialization failure must be observable, not discarded.

## Milestone 2 — One transient widget, direct attach, preserved focus

1. Add orchestration tests with injected bridge operations. A source-free target must produce exactly one Apps widget and one direct attach using the original HWND/PID. Assert zero calls to `appPanel.open()`, launch, discovery-list matching or executable preparation.
2. Use the existing `createWidget('apps')` defaults and placement helpers. Set title/optional icon, `appKey: null`, `appPanelOpen: true`, `appReuseExisting: false`. Keep HWND/PID/request ID in the existing runtime attachment map only. Persisted reload must not replay stale handles or start an app; the baseline already clears open intent without an appKey.
3. Capture the intended workspace ID when the event is received. Serialize/deduplicate by exact HWND/PID before async work and use functional state updates/current widget lists for IDs, counts and placement. If workspace disappears or target becomes stale, cancel with actionable feedback. Ignore already-attached/Still targets without creating a widget.
4. Pass optional capture metadata through the existing `AppAttachment` object. `AppsWidget` calls `appPanel.attach()` directly even when appKey is null. Keep launch disabled for this path; consume the pending attachment once. Retain the existing per-widget command queue and geometry measurement.
5. Prevent concurrent native claims with an atomic target reservation/check covering validation through insertion, and release that reservation on every failure. Avoid holding the panel mutex across blocking Windows work. Existing marker rejection remains the final cross-instance guard. Duplicate input or React subscription/effect replay must not produce duplicate widgets/attachments.
6. Add optional capture focus policy to the direct native command; preserve the current picker default. Remove explicit main-window activation for capture only. Audit hide/restore/show and the maximized normalization branch. Preserve the clicked window's focus after its first safe presentation; do not activate a hidden target or override a later user-selected external foreground window. Use a bounded, request-specific completion tied to actual presentation, not repeated timers or global focus repair. If this requires geometry/z-order redesign, STOP BLOCKED.
7. All failures identify the stage: detection/bridge, validation, widget creation, or direct attach. Use the existing toast (no foreground activation) and the widget's inline error with actions such as retry the chord, reopen a closed window, or match Windows permission levels. Keep a failed attachment card retryable, with no automatic executable fallback.

## Milestone 3 — Lazy Save without disturbing live attachment

1. Keep a source-free capture attached when executable lookup is unavailable. Show a clear session-only explanation; lack of relaunch identity is not an attachment error.
2. On explicit Save to tray, resolve the exact live managed target and only then call the existing preparation/grant mechanism. Extend that lookup to managed windows because the normal enumeration excludes attached/marked windows.
3. If reusable identity exists, construct the saved preset from the returned source ID. Do not change the live widget's appKey just to save: the baseline AppsWidget effect depends on appKey and would release/reinitialize the panel. Save the preset independently of the live transient attachment.
4. If identity cannot be resolved, leave the attachment intact and explain that the window can be used this session but cannot be saved/relaunched. Never persist HWND/PID, fabricate an executable, or launch a replacement.

## Milestone 4 — Focused checks, one candidate, stop

1. Run only feature-focused tests (planned commands):
   - From `still-desktop`: `node --test tests/app-capture.test.mjs`.
   - From `still-desktop/src-tauri`: `cargo test --locked capture_` (name every new native test with `capture_`). Include a native fixture for exact identity/revalidation/claim failure; keep any real external-click GUI test explicit and opt-in.
   - From `still-desktop`: `corepack pnpm check` and `corepack pnpm build`.
   - `git diff --check` and a diff audit against the exact baseline for forbidden paths and launch/focus side effects.
2. Build with `corepack pnpm tauri build --no-bundle` in this fresh worktree. Preserve all prior binaries. Copy only a successful artifact to the unused name `ver0.21-test-direct-window-capture.exe`; use `-r2` only for a subsequent explicitly scoped fix.
3. Record build-source commit, clean/dirty state, commands/results, absolute path, byte count and SHA-256. Restore only this build's unrelated generated file noise. Do not claim mouse/focus success from pure helper tests.
4. Stop READY TO TEST. Do not launch, merge, push, accept a release or start another feature. The user performs live Windows verification.

## Windows acceptance

1. Confirm the test source descends from `afe209e` and contains only this feature plus its tests/report.
2. Keep Still visible but unfocused. Hold Ctrl+Shift and click a normal external app control with an observable normal click action. Verify the action happens, that app receives/retains focus, and no picker/modal opens.
3. Verify the attached HWND/PID and widget ID in bounded diagnostics: exactly one clicked window, one widget, one `app_panel_attach()` call. For two document windows in one process, clicking the second must attach the second.
4. Repeat quickly/double-click with modifiers. Ignore an already-managed app and Still's own windows. Confirm no duplicate widget/claim/app launch.
5. Test a controllable fixture with executable identity unavailable: attach succeeds; Save limitation is clear. Close the target between capture and attach: visible stage-specific error, no substitute window or launch.
6. Test a maximized external app, an unsupported/system target and an elevated-permission mismatch. Focus must not jump to Still; errors must identify the reason. Switch focus elsewhere while async capture runs: do not forcibly reclaim it.
7. Explicit Save succeeds where identity is available and never detaches/reloads the currently captured window. Restart never reuses persisted HWND/PID.
8. Compare ordinary Attach Open App and existing Browser/Apps drag/resize/workspace/edge behavior with attach-edge-r2. Smoothness and baseline clipping behavior must remain unchanged. This feature does not claim to solve the white stripe.

**State: PLAN COMPLETE / WAITING FOR USER.** No implementation or test build in the planning turn. Next action: waiting for user.
