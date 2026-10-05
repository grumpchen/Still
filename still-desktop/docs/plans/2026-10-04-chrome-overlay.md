# Real Chrome overlay and workspace shortcut repair

The user requested the existing Browser panel use a normal top-level Chrome window, with a dedicated persistent profile, native tabs/extensions and event-driven position synchronization. Reparenting, browser automation and unrelated widget redesign are excluded. This supersedes the proposed custom tab strip.

## Existing architecture and reuse

Still uses React 19, TypeScript, Vite and Tauri 2. BrowserWidget formerly created a child WebView2 surface. Its host rectangle comes from getBoundingClientRect inside WorkspaceCanvas; the canvas owns movable/resizable cards and 80% Lecture geometry. The trusted main webview owns native commands. These boundaries are reused.

## Implemented

- BrowserWidget retains its panel, saved website links, expansion control and Lecture mode. Chrome supplies the actual tab strip, address bar, navigation, bookmarks, downloads and extensions. The Still address field opens a new Chrome tab; Still shortcuts save an explicitly entered URL. Chrome Ctrl+D/star saves its actual current tab.
- chrome_overlay.rs launches installed Chrome with app_data_dir/chrome-profile, identifies a new Chrome HWND/PID, and verifies forwarded-process identity against the profile when necessary. Existing normal Chrome profiles are untouched. A marked, still-open window is recovered before launching a replacement.
- Windows ownership via GWLP_HWNDPARENT keeps Chrome above its Still owner. The window remains top-level, with WS_CHILD unset; SetParent and global topmost are not used. CSS client bounds are converted with ClientToScreen and GetDpiForWindow. Requested bounds must match Chrome's actual outer window rectangle or the overlay hides and asks for a larger panel.
- ResizeObserver, captured scroll events and canvas mutation events update panel geometry. Tauri move/resize/scale/focus events and Windows location/foreground events update screen placement. Only initial window discovery has a bounded 100 ms wait loop; no continuous window polling.
- Inactive workspaces, dialogs, dragging, higher overlapping widgets, clipped regions, minimization and unrelated foreground apps hide the managed window. Hiding retains Chrome pages; removing its widget or closing Still requests WM_CLOSE without killing Chrome. Native dialogs can complete after detachment. Fullscreen/maximized Chrome is left to Chrome; Esc/F11 or Chrome Restore returns to normal panel positioning.
- Visited canvases stay mounted. Background widget updates find their owning workspace by instance ID. Switching no longer destroys the browser/controller or calculator iframe.
- Workspace shortcuts use a fast physical-key hook filtered to Still or its dedicated Chrome PID. Exact modifiers, one event per physical key press, dialog pause, AltGr and Windows-key exclusions are retained. Shift-only bindings are accepted. A focus-role cache from Windows UI Automation pauses Shift-only navigation in editable fields; no input content is read.
- Browser screenshots composite the visible registered Chrome region into the existing widget capture. Fullscreen/off-position captures are rejected. Clipboard/PNG controls remain.

## Verification and acceptance limits

24 frontend tests and 11 Rust unit tests pass. A separate real-Chrome native smoke test passes for launch, HWND/PID, unchanged top-level style, owner, duplicate recovery, DPI bounds, movement/resizing, hide/show, minimize/restore and close/reopen. TypeScript, Vite and the Windows release build pass. The smoke test uses an isolated temporary profile and is explicitly invoked with cargo test --offline --release --manifest-path src-tauri/Cargo.toml real_chrome_launch_position_hide_recover_and_reopen -- --ignored --nocapture.

Native key presses while Chrome/Desmos have focus, AKO → EchoVideo, Google sign-in, extension installation, downloads, fullscreen/video playback, and clipboard/Save UI need interactive acceptance. Preview access to localhost timed out; no visual QA claim is made. Hiding does not close/reload a page, but individual sites can pause media when hidden. Chrome controls its own session restoration; Still saves panel geometry, launch URL and website links, not Chrome's live tab URLs. Detached tabs, popups and download dialogs retain normal Chrome behavior outside the managed panel. Use Still's resize handle for the docked region.
