# ver0.15 — custom Browser and Files presets

The existing Browser and Files tray buttons have a small disclosure arrow. Expanding it reveals named reusable buttons and a Custom Browser or Custom Files action. Browser presets store a display name and starting HTTPS URL. Files presets store a display name and a reference to a folder selected through the existing picker. Editing or removing a saved button does not change widgets already opened from it. Removal supports the existing Ctrl+Z undo.

Presets belong to the whole platform, so the same ChatGPT or course-folder button is available in every workspace. Clicking or dropping a saved button creates a fresh widget ID, placement and independent state. The tray accepts the saved preset ID through its existing HTML drag-and-drop system. Ordinary Browser and Files buttons still add their normal default widgets. Named Groups keep their existing per-workspace behavior.

The version-4 saved layout gains backward-compatible optional presets and Files folderKey fields. Older layouts receive an empty preset list. URL validation reuses the existing HTTPS-only normalization. Native folder reuse accepts opaque IDs and copies only an existing user-selected root; it cannot grant a new arbitrary path. Each newly opened Files widget gets its own root mapping, persisted in file-folders.json. Changing an instance's folder takes precedence over its preset on reopening and leaves other instances alone.

Folder edits are staged under fresh picker IDs. Cancelling the preset editor therefore keeps the original saved folder connection. Browser previews retain file selections only for the current page session, while the desktop app persists the selected roots.

Verification: three new model and migration tests were observed failing before implementation; the preview-folder reuse test also failed before that method was added. All 37 frontend tests and 12 Rust unit tests passed, including persisted folder-map reconstruction and per-instance overrides. TypeScript passed. The explicit real-Chrome GUI smoke test remained ignored.

Interactive preview checks covered the disclosure arrows, saving ChatGPT, multiple independent Browser instances, cross-workspace availability, reload persistence, editing a URL, removing a preset while keeping its opened widgets, undo, choosing a synthetic CHEM111 folder and opening two populated Files widgets. The preview reported no console warnings or errors. Automated drag gestures did not add an instance, so drag-to-add still requires desktop acceptance; the existing drop path is implemented but not claimed as interactively verified. Native folder-picker UI and native Chrome resizing remain user acceptance. No native Chrome or shortcut behavior was changed.

Preview proof: `../../../archive/older-versions/ver0.15-presets.png`. Production build and package validation are recorded in the release README.
