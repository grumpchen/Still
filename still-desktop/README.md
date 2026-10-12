# Still — ver0.20 workspace visibility fix

## Still AI assistant

The current AI sidebar uses one chat flow for Gemini and OpenAI API models. Type `@` to select one or all widgets for explicit content sharing; ordinary layout requests include workspace geometry and produce reviewable proposals with Apply/Undo. Choose the model from the chat footer and connect each provider once per Still session in AI settings. API keys remain in desktop memory until Still closes; OpenAI API usage requires separate billing from a ChatGPT subscription. Browser previews do not send AI requests. Setup, privacy limits, and verification steps are in [the AI assistant notes](docs/plans/2026-10-11-gemini-sidebar.md).

## Existing desktop release

ver0.20 retains the ver0.19 minimum-size work and fixes attached Apps windows remaining over another workspace. Hidden DOM resize handles now produce no native grip rectangle, so the native hide request passes validation. The sidebar/header plan is paused; this build changes no layout controls.

Close ver0.19 and open `ver0.20.exe` from the shared project root. Attach Codex or another app in one workspace, switch to a different workspace repeatedly using the sidebar and workspace hotkeys, then return. The app should hide away from its workspace and return in its card with its minimum-size limit intact. Live desktop acceptance remains pending.

Source branch: `agent/codex/workspace-app-visibility`. Debug cause, checks, and OC integration steps are in `docs/agent-reports/2026-10-06-workspace-app-visibility-debug.md` at the repository root.

## ver0.19 minimum-size changes

This test build completes Luna's attached-app minimum-size work. Apps widgets read the native window's minimum tracking size on attachment/show and DPI changes, include Still's header/toolbar/footer in their limit, and apply it to pointer and keyboard resizing. A native clamp provides a second safeguard; unsupported minimum queries retain the observed-size fallback. Delayed position replies no longer restore an earlier, larger widget size. The existing header resize button and native corner cutout are retained.

Close the older Still window, open `ver0.19.exe` from the shared project root, attach a separate Codex window, and shrink its Apps card using the header or corner resize control. It should stop at the usable app minimum, still expand, and retain its limit after reopening. Detach should release the app without applying its resize limit to an empty card. The build uses Still's usual app identifier and saved profile; it was not launched automatically.

Source changes are on `agent/codex/app-minimum-resize`, without merging into `main`. Live Codex acceptance is pending; automated checks are recorded in the agent handoff report.

## Existing ver0.18 features

Close all older Still windows, then open ver0.18.exe. Existing layouts, Groups, notes, appearance, Chrome profile and saved shortcuts are retained.

ver0.18 adds an open-app picker to the managed application panels introduced in ver0.17.

- Click **Apps** in the top widget tray to open **Attach open app**. Search currently open desktop windows by app or document name, see app icons and window titles, and use Refresh when opening another app. Already attached app/Chrome windows have an Attached badge and cannot be attached twice.
- Select a window, optionally rename its widget and check **Save app to tray**, then click **Attach selected app**. Still positions that exact window in a new movable/resizable card. Existing Apps cards have the same picker for replacing their application. Windows handle and process identity are checked again before attachment and never stored in saved layouts.
- **Preview** requests a small image for one window on demand. Previews have a time limit and do not block attachment. Minimized or unsupported windows can still be attached without a preview; unresponsive previews report their limitation.
- The Apps arrow expands saved buttons. Clicking one reuses a single available matching app window, or launches the app if none exists. If several documents/windows match, the card asks you to use Attach open app and choose the intended one. A widget can be renamed and saved from its own toolbar. Dragging the main Apps button still adds an empty Apps card.
- **Open app…** uses the Windows file picker for an application or ordinary app shortcut when it is not running. You can also open the app normally from Windows and click Refresh. The actual application retains its normal controls and documents.
- Move or resize the widget using Still's header and bottom-right handle. Native movement, resize, DPI and focus events keep the app aligned. The card grows on first attachment if the app enforces a larger minimum size; a native clip keeps excess content inside the panel instead of hiding it merely because another widget overlaps.
- Still minimizes or changes workspace: the managed app hides with its panel and is shown again when appropriate. Open-panel intent and geometry persist; picker-created panels reuse a single available matching app after reopening Still, or launch if none exists.
- **Detach**, removing/changing the widget, or closing Still releases the app back to its desktop placement. Still restores ownership and clipping without closing documents or killing the application. Manually closed app windows can be reopened.
- Managed app focus is recognized by workspace hotkeys and Chrome visibility. Widget screenshot/export captures include the attached app region.

The ver0.16 tray and saved shortcut features remain:

- Drag a widget header onto its matching tray button: green saves a reusable preset and keeps the open widget. Empty tray space turns red and removes only that instance. Dropping onto a different type or saved button does neither.
- Drag a PDF, document, image, media file or folder onto Files to save a named shortcut automatically. Drag a Windows .exe or .lnk shortcut onto Apps. Names and PDF/File/Folder/App badges distinguish resources.
- Drop supported items directly onto the canvas to create fresh cards without saving tray buttons. Drag a card onto its matching green button when you want to save it.
- Expand a type's ▾ arrow to reopen saved buttons by clicking or dragging. Each adds an independent instance. Pencil edits a preset; × removes its saved button while keeping opened widgets. Presets are available across workspaces and persist after restart.
- Browser presets remember a starting HTTPS URL. Notes and Assistant preserve text, Focus preserves remaining duration, and Timetable preserves entries. Files and Apps retain native references to the original resource rather than copying it. Changing one Files instance's folder keeps other instances independent.
- PDF cards open in the default PDF viewer. Receiving an app drop saves a shortcut without launching it. Click Open in panel or explicitly attach an existing app window to use an Apps card. Files viewing is otherwise unchanged.
- Windows .url Internet Shortcuts with HTTPS destinations can be dropped onto Browser. Raw Chrome URL/text drags are not guaranteed in the native app; the Browser preset editor remains available.
- Groups still support named collections, expandable tray buttons, reusable widget entries and website links. Existing move/resize handles, 80% Lecture mode, sidebar collapse, screenshot/export actions and customizable workspace hotkeys remain.

Chrome still supplies real tabs, bookmarks, extensions, authentication, downloads and video through Still's dedicated profile. Its area must be fully visible, at least 500 × 220 and clear of higher widgets; managed windows hide during gestures or when Still/workspaces are hidden. Close old versions to avoid competing layout writes or hotkeys. Chrome recovery remains scoped to its Still owner and widget.

Validation: 53 frontend tests and 27 Rust tests passed, plus TypeScript, Vite and Windows release compilation. One explicit Chrome GUI smoke test remains ignored. A hidden real Windows fixture verified native move/resize at 150% scale, viewport clipping, restoring ownership/placement, and leaving the window alive on release. New regression checks cover search/attached ordering, transient window identity, saved reuse/open intent, zero/one/multiple app-window matching, safe names, real GDI icon PNG encoding, and rejecting stale/hidden/closed windows before previews. Previous tray/layout/shortcut checks remain passing.

The isolated web preview verified both tray/card picker entry points, search and save controls, Cancel, the saved Apps section and its collapse behavior, without console errors. ver0.18-app-picker-preview.png shows that web preview, whose desktop actions are intentionally disabled. Actual Word/third-party listings, live previews and attachment require manual Windows acceptance because native UI control was unavailable. Native Explorer drag/drop, default PDF viewer and real screenshot/clipboard/export actions were not retested. Apps that do not expose a normal controllable Windows window, or run at a different Windows permission level, may not attach; the panel reports the problem. Native Chrome resizing, signed-in AKO/EchoVideo, extensions and fullscreen/video were not retested. Preview file selections require reconnecting after reload; desktop grants persist. The app is unsigned and has no installer.

Design and acceptance steps: docs/plans/2026-10-05-open-app-picker.md and docs/plans/2026-10-05-managed-app-panels.md. The current release is `../ver0.18.exe`; its preview is `../ver0.18-app-picker-preview.png`. The original source archive is retained at `../archive/source-archives/still-desktop-source.zip`. Historical executables and preview proofs remain available under `../archive/`.

Development: Tauri 2 + React + TypeScript. Run frontend tests serially (`pnpm test`) because visual-rendering tests share a Vite port. Run the Windows native fixture suite serially (`cargo test --offline -- --test-threads=1`) because it creates and manipulates desktop windows. Type-check and build with `pnpm check` and `pnpm build`. See [the current architecture note](docs/architecture/current.md) for module ownership, plugin limits, persistence, and DPI verification scope.
