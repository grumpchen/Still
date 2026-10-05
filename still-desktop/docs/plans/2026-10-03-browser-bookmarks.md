# Embedded browser, bookmarks and lecture mode

Restore the original native WebView2 browser within the existing free widget canvas. Keep Liquid Glass, tray interactions, independent instances, Files, screenshots and saved layouts. Browser controls belong at the top of the widget: back, forward, reload, home, address/search, bookmark current page, collapsible bookmarks and 80% Lecture mode.

Bookmarks are per widget, editable HTTPS links. Save the actual current page after navigation, preserve existing launcher shortcuts during migration, and persist the panel state. Lecture mode expands the selected browser to 80% of the visible canvas width and the available height; its previous geometry is saved so the same button restores it. Normal corner resizing stays available.

Native child views share the existing app browser profile, with local-only command permissions. Reuse the original native adapter and attach workspace shortcuts to each child. Hide views under dialogs, gestures, overlaps or viewport clipping. Composite native browser pixels into widget screenshots rather than returning an empty browser host.

Validate bookmark URL safety, launcher migration, navigation state, lecture sizing/restoration and capture composition. Run frontend and Rust tests, production build, inspect the preview toolbar/panel/lecture interaction, then package the Windows executable. Actual website playback and sign-in require native manual acceptance if native UI access remains unavailable.
