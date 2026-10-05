# Managed application panels

The user tested ver0.16 with Word: Launch app opens a normal desktop window instead of displaying it in the Apps card. Reuse the Chrome strategy for application panels: a real top-level Windows window follows the card; do not use SetParent or recreate the application's interface.

1. Add native launch/discovery and an explicit existing-window attachment fallback. Resolve ordinary .lnk targets where possible, preserve shortcut arguments, and request a new Word instance using its documented /n switch. Automatically claim only a new window attributable to the launch. Never claim an unrelated pre-existing document window automatically.
2. Save app-panel open intent with each widget. Keep opaque grants and the current tray/file drop system. The Open in panel button starts attachment; reopening an active saved layout resumes its panel.
3. Follow Still movement, resizing, DPI, minimization, focus and workspace visibility. Clip the native window to the panel and viewport. Expose the app's measured minimum size so a small card can grow when first attached. Keep the header, footer and resize handle outside the native app region.
4. Removing/changing a widget, detaching, or closing Still restores the app's original window ownership, region and placement and shows it on the desktop. Do not close documents, kill app processes or send WM_CLOSE. Handle a manually closed app and allow reopening.
5. Include managed Apps in workspace hotkey focus and native screenshot capture. Leave Chrome's existing behavior intact apart from recognizing other Still-managed app focus.

Validation: meaningful geometry/state and window-selection regressions, native Windows fixture tests for positioning/clipping/release, all existing frontend/Rust checks, release compilation, and preview UI checks. Actual Word/other third-party application acceptance is reported separately from fixture verification. Some apps do not expose a normal controllable top-level window or run at a higher Windows permission level; offer explicit attachment/recovery instead of silently pretending they are embedded.

## ver0.17 implementation

`src/AppsWidget.tsx` owns each panel's open/attach/detach controls and reports host and viewport geometry through `src/platform/appPanel.ts`. The existing canvas ResizeObserver, mutation/scroll updates and layout persistence are reused. The native window is clipped to the host; card chrome and the bottom-right resize handle remain outside the app region. Ordinary widget overlap does not disable the Apps window.

`src-tauri/src/app_panel.rs` launches only an app previously granted through a picker/drop. Ordinary shortcuts are resolved with the Windows Shell Link API, preserving their arguments and working directory. Discovery snapshots all pre-existing top-level windows, including hidden ones, and automatically selects only a new window matching the launch process or resolved executable. Startup discovery is bounded; retries reuse their launch ticket. The explicit existing-window chooser handles applications that reuse an old window or cannot be identified automatically.

The window remains top-level and receives Still as its owner, following the documented [SetWindowLongPtr window ownership model](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setwindowlongptrw). Shell launch process information follows [SHELLEXECUTEINFO](https://learn.microsoft.com/en-us/windows/win32/api/shellapi/ns-shellapi-shellexecuteinfow); an existing-process handoff may not supply a process handle. Word uses its documented `/n` [startup switch](https://support.microsoft.com/en-us/office/lifecycle/command-line-switches-for-microsoft-office-products) to request a separate instance. No shell command composition, SetParent, document-close message or process termination is used.

Window events synchronize movement, resizing, DPI and foreground context. Visible app windows are clipped to the current panel/viewport; partially scrolled Apps stay clipped instead of disappearing. Still dialogs and pointer gestures temporarily hide native panels so its controls can receive input. Still minimization, workspace changes and unrelated foreground apps hide them. Native app/owned-dialog focus is accepted by the existing workspace hotkeys and Chrome visibility logic.

Open-panel intent is saved per instance. New saved-preset instances remain closed until explicitly opened. Detach, widget removal/change and Still close restore ownership, saved native region, visibility and original placement, leaving documents alive. Native screenshot composition includes the app's visible region.

## Verification and remaining acceptance

51 frontend tests and 23 Rust tests passed; one real-Chrome GUI test was intentionally ignored. TypeScript, Vite and Windows release compilation are required for the packaged executable. The native fixture is a pair of hidden Win32 test windows: it verifies real positioning and resize at 150% scale, clipping, restoration, and that the target HWND remains alive after release. It does not launch Word or touch existing documents.

The browser blocked the isolated preview origin with ERR_BLOCKED_BY_CLIENT, so no new preview screenshot or interactive Word result is claimed. Earlier tray proof belongs to ver0.16. Word, other third-party apps, native screenshot/clipboard/export, and real minimize/focus/workspace interaction still need manual acceptance.

For testing: close older Still windows and open ver0.17. In the saved Word card, select **Open in panel**; if Word is already running, **Attach open window → Word** attaches that exact window without another launch. Move the Still window, resize/move the card, switch workspaces, minimize/restore Still, and verify the app follows it. Edit a disposable document, then use **Detach**, remove the card, and close Still: its document must stay open on the desktop. Close the app manually and verify the panel offers reopening. Try camera copy/export and the saved workspace shortcuts while Word has focus.
