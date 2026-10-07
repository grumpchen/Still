# Phase 1 — Attach Open App and right-edge containment plan

> **For agentic workers:** Use superpowers:executing-plans for sequential implementation in Luna's next session. No implementation is authorized in this planning turn. Steps use checkbox syntax for tracking.

**Goal:** Restore app attachment and test deterministic native hiding at the workspace right edge in one focused Windows candidate.

**Architecture:** Reuse the React picker, Tauri app discovery/attachment commands, per-widget command queues and revision checks already present. Implement the edge guard in the existing Browser/Apps presentation path, with shared containment rules; do not introduce a second positioning owner or broad refactor. Keep the picker and native edge fix in separate commits.

**Tech Stack:** React/TypeScript, Tauri 2, Rust, Windows HWND APIs; Node test runner and Rust fixtures.

**Spec:** `docs/plans/still-roadmap.md`, current Phase 1.

## Task control

- Task: `phase1_attach_edge`.
- Source baseline: `45410ae570c0b5a62ed9e9d867808adee299f757`, the UI-cleanup test source. Documentation commits following it do not change this source baseline.
- Proposed implementation branch: `agent/luna/attach-edge-phase1`.
- Proposed implementation worktree: `C:\Users\haoka\Projects\Default Project\.worktrees\still-luna-attach-edge-phase1` (not created in this planning turn).
- Phase 1 only. Keep Phase 2–4 queued. Preserve current minimization, 80% lecture mode, tabs/session, workspace switching, normal overlap and drop rules.
- Baseline report recorded seven full-suite failures in older app-icon/canvas/scroll/tray expectations. Capture actual baseline output first; distinguish inherited failures from new regressions. Do not assume or suppress failures from that historical report.

## Review focus

- Window disappears or PID changes between discovery and attach: actionable Refresh error; no attachment to an unrelated HWND.
- Multiple windows of one application: attach the selected document/window, never relaunch merely because selection was ambiguous.
- Long list/short screen: fixed-size rows remain visible and selectable; list scrolls internally with Attach reachable.
- App enforces a larger native minimum/DPI changes: compare actual native geometry and workspace boundary in the same coordinate system.
- Stale queued present or native hook fires while hidden: it must not restore an unsafe, minimized or off-workspace panel.

## Task 1A — Restore Attach Open App, then tidy its list

**Owned files:** `still-desktop/src/AppWindowPicker.tsx`, `src/App.tsx` (app target/attachment delivery only), `src/AppsWidget.tsx` (attachment lifecycle only), `src/platform/appPanel.ts`, `src/domain/appPicker.ts`, `src-tauri/src/app_picker.rs`, `src-tauri/src/app_panel.rs` (discovery/attach only), `src/canvas.css` (picker only), `tests/app-picker.test.mjs`, `tests/app-panel.test.mjs` and native picker tests. Changes are conditional on evidence, not an instruction to edit every file.

**Existing interfaces:** `appPanel.choices(sourceId?)` → `AppWindowChoice[]`; `appPanel.prepare({hwnd,pid})` → granted app resource; `App.addManagedApp` delivers transient attachment intent; `AppsWidget` calls `appPanel.attach(id,{hwnd,pid},bounds,clip,grip)`. Keep HWND/PID transient and reuse source grants.

- [ ] Record baseline branch/HEAD/build identity and existing check results. Reproduce separately: Apps tray dialog, and replacement picker from an existing Apps widget.
- [ ] Trace `app_picker_windows` → UI selection → `app_picker_prepare` → target widget creation/replacement → transient attachment delivery → `app_panel_attach`. Include effect cleanup/re-entry and queued release versus attach if the selected window immediately disappears. Record where the failing path stops. Do not diagnose a native discovery failure solely from cropped UI rows.
- [ ] Inspect enumeration/filtering, sourceId filtering, managed-window status, HWND/PID revalidation, authorization and command registration/permissions; preserve distinctions between unavailable, closed, already attached and unsupported/permission-level windows.
- [ ] Add a regression for the evidenced failure before the focused fix. Cover stale identity rejection, two same-app windows preserving selected identity, refresh/search selection behavior, busy double-click prevention and replacing an existing widget without a duplicate launch. Use existing domain/native tests plus a component/mock harness only if needed to exercise the broken callback path.
- [ ] Fix discovery/selection/attach behavior first. Do not weaken identity checks, launch a duplicate as fallback, or mark preparation success as proof the native attach succeeded.
- [ ] Then refine layout: keep icon, app name, window title, search, refresh and one main Attach; non-shrinking consistent rows, ellipsis for long text, contained vertical list, footer outside list scrolling. Inspect `.app-picker-row` flex shrinking and constrained list sizing; these are hypotheses to verify, not a confirmed cause.
- [ ] Test 30+ rows and a short viewport: no cropped icons/rows, keyboard focus reaches every choice and main Attach, selection visible after search/refresh, actionable error without losing retry controls. Commit Task 1A independently.

## Task 1B — Right-edge blanking experiment for Browser and Apps

**Owned files:** `still-desktop/src/BrowserWidget.tsx`, `src/AppsWidget.tsx`, `src/domain/chromeOverlay.ts`, `src/domain/appPanel.ts`, `src/platform/chromePanel.ts`, `src/platform/appPanel.ts`, `src-tauri/src/chrome_overlay.rs`, `src-tauri/src/app_panel.rs`, `src-tauri/src/native_panels.rs`; existing geometry/native tests. WorkspaceCanvas.tsx only if the exact viewport boundary cannot be obtained through its existing DOM. No unrelated CSS/layout changes.

**Current evidence:** Both widget components measure the host and canvas viewport, calculate partial clips and use revisioned present requests. Rust also positions/hides/shows through native event refreshes. `native_panels::refresh_clipped_child_region` reapplies a region on child crossings; user reports the compositor stripe remains. This does not prove the DWM cause, and the new hide policy is an experiment requiring live acceptance.

**Interface decision:** Preserve existing `present` arguments and add the measured `viewportRight: number` in WebView logical coordinates through both frontend adapters and native commands if needed. Convert once with existing owner-client origin/DPI conversion. Share a pure physical-coordinate right-edge predicate in `native_panels.rs`; test its tolerance. Do not infer the workspace edge from a clip reduced by another widget's overlap.

- [ ] Log one bounded reproduction of desired bounds/clip, workspace right edge, actual GetWindowRect, scale, revision, visibility reason and show/hide operations. Inspect all native hook/refresh show paths, not only frontend drag completion. Avoid continuous timers or unbounded per-frame logging.
- [ ] Add tests: fits/touches right edge stays eligible; protrusion past a one-physical-pixel rounding tolerance is unsafe; move back becomes eligible; 100/150/200% scale conversions agree; actual app minimum exceeds requested rectangle; unrelated overlap is not treated as workspace-edge crossing.
- [ ] Trace existing latest-revision behavior and test stale show after newer unsafe snapshot, workspace switch/minimize during transition, and repeated identical snapshots. Reuse queues/revision checks; do not add a local delayed show callback.
- [ ] Implement one state path: unsafe/transient → native SW_HIDE → apply latest geometry/region while hidden → inspect actual native rectangle → show without activation only if safe, latest and otherwise eligible → reapply existing z-order. Store the edge state/boundary with the native entry so hook refreshes enforce the same rule.
- [ ] Keep the native HWND hidden while it still straddles the problematic right edge, even after scroll-end. Render the glass placeholder beneath it with a brief move-inside message. A safe move back restores the same window automatically; no Close/Open cycle, detach, loss of tabs/documents or persisted placement rewrite.
- [ ] If geometry application requires restoring a maximized/minimized native window, ensure that operation cannot expose its old position. If Windows geometry/DPI cannot be determined, remain hidden and report a retryable failure. A show failure must not leave a stale shown cache.
- [ ] Keep 80% lecture mode, resize grip cutouts, ordinary overlap clipping, off-workspace visibility and z-order paths intact. Do not replace transparent rendering or redesign the canvas as a stripe fix.
- [ ] If hidden reposition still leaves residue, record the failing transition and STOP BLOCKED for native review; do not stack timing guesses or claim compositor success from rectangle tests. Commit Task 1B independently.

## Verification and handoff gate

From `still-desktop/`, run relevant existing tests (minimum set):

```powershell
node --test tests/app-picker.test.mjs tests/app-panel.test.mjs tests/chrome-overlay.test.mjs tests/canvas-scroll.test.mjs tests/trayDrop.test.mjs
corepack pnpm build
cargo test --manifest-path src-tauri/Cargo.toml
corepack pnpm test
corepack pnpm tauri build --no-bundle
```

- [ ] Record exact results and baseline-versus-new failures. New regressions must be fixed; outdated tests need an explicit behavioral explanation, not deletion to make a run green.
- [ ] Copy a unique `ver0.21-test-attach-edge.exe` candidate, or next unused `-rN`; record source HEAD/hash/path, diagnostics location and limitations. Do not overwrite the UI-cleanup or other older build. Do not launch it automatically.
- [ ] Windows acceptance: Chrome plus one native app, attach exact same-app document window, replace attachment, stale/closed choice, long-list scroll. Drag/resize toward/past the visible right edge, pause while straddling, return inside, scroll horizontally, overlap another widget, switch workspace, minimize/restore Still and widget, 80% lecture mode and supported DPI/monitor changes. Unsafe right-edge content is blank; safe content returns in place without the stripe, duplicate launch or new lag.
- [ ] Produce factual task report and STOP at READY TO TEST. User acceptance is required before moving to Phase 2.

## Model recommendation

GPT-6 Luna High for implementation. Difficulty: medium/high; attachment is medium, native edge handling high risk. Sol is reserved for evidence-backed native/compositor escalation if the bounded experiment is insufficient. No Sol implementation is authorized by this plan.
