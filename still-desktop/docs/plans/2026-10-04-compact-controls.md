# ver0.10 — compact controls

The user requested optional URL/bookmark controls that collapse and expand, more compact spacing, and releases named ver0.10 / ver0.13 instead of feature names.

BrowserWidget now keeps a slim Links / Lecture · 80% row above Chrome. URL entry, shortcut actions and the bookmark panel are inside the expandable area. It starts collapsed for existing and new widgets, preserves saved URLs/bookmarks, and remembers each widget's expansion choice through browserToolsExpanded. Bookmark expansion remains independently stored. The duplicate status footer is omitted once native Chrome is ready. Bounds observers continue to resize the real Chrome window without restarting it.

Sidebar, topbar, workspace spacing, tray and card headers are slightly smaller. Widget geometry, native Chrome management, shortcuts and existing utilities are retained. State schema remains version 4 with a default for the added preference. Package, Cargo and Tauri versions are 0.10.0; the window title is Still · ver0.10. Packaging derives ver0.10.exe from package.json so future minor releases follow the same convention. Older executables are kept.

Validation: the saved-state regression fails before implementation, then passes for collapsed defaults, saved per-widget choices, independent duplicates and intact legacy bookmarks. All 25 frontend tests, TypeScript and 11 native unit tests pass. The production Vite and Windows release builds pass. Native window behavior is unchanged from the preceding Chrome smoke test. Interactive visual preview remains unavailable after the earlier localhost timeout.
