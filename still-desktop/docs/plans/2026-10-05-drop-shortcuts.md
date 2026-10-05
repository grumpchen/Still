# Drop shortcuts and reusable widgets

The existing tray now distinguishes saving a reusable widget from removing an open instance. Drag a widget by its header onto its matching type button: the button turns green, release saves a named preset, and the original widget returns to its previous position. Drag the header onto empty tray space: red indicates removal of that instance only. A different type button or an existing saved button does neither. Groups retain their existing saved-group behavior.

Saved presets appear under the type button's disclosure arrow. Clicking or dragging a saved button into the canvas creates a fresh independent widget. Browser presets remember the starting URL; Files presets remember the selected folder or document; Apps presets remember the selected app shortcut. Notes and Assistant preserve text, Focus preserves remaining duration without continuing the old running timer, and Timetable preserves its entries. Calculator preserves its named widget type. Editing or deleting a preset does not change instances already opened from it.

## User interaction

- Drag a PDF, document, image, media file or folder from Windows onto **Files**. Green means release will save a named reusable shortcut. Names come from the dropped item and can be edited under **Files ▾**.
- Drag a Windows `.exe` or `.lnk` app shortcut onto **Apps** to save it. Opening its saved button adds an Apps card; only **Launch app** launches the application, normally outside Still.
- Drop one or more supported items directly into empty workspace canvas to create fresh cards. This does not add saved tray buttons; drag each card onto its matching green tray button to save it later.
- PDFs display a PDF badge and an **Open in PDF viewer** action. Files open in their normal external default app; this release does not embed a PDF viewer or arbitrary application window.
- A Windows `.url` Internet Shortcut containing an HTTPS URL can be dropped onto **Browser** to save a named Browser preset, or onto the canvas to add a Browser card. Raw Chrome URL/text drags are not guaranteed in the native app. The web preview supports compatible HTTPS link drag data; the manual Browser preset editor remains available.

## Implementation

This document records ver0.16. In ver0.17 the Apps launcher described above is replaced by managed native app panels; see `2026-10-05-managed-app-panels.md`. Files/PDF opening and the tray drop rules remain as recorded here.

`domain/trayDrop.ts` defines matching green save and empty red remove decisions. `presetFromWidget` and `createWidgetFromPreset` validate and reconstruct typed reusable state with fresh instance IDs. Document and app fields extend the existing version-4 layout compatibly; earlier Browser and folder presets still load.

The Rust native drop handler converts physical Windows drop coordinates to CSS coordinates using the window scale. `WorkspaceCanvas` hit-tests those coordinates against the tray/canvas targets and provides typed feedback. Native Windows file-drop handling disables ordinary HTML dragging in the webview, so tray types, saved presets and group entries now use pointer capture through `TrayDragButton`. A movement threshold separates drag from click; cancellation and lost capture clean up the drag without adding an extra card.

`dropped_files.rs` handles paths only from native OS drop events or native pickers. Exact canonical document and app paths are persisted in separate native registries; the UI and saved layout retain opaque IDs. Folder grants reuse the existing Files root registry. Document opening revalidates its exact granted path and supported type. App grants accept `.exe` and `.lnk`; scripts and installers remain unsupported, and receiving a drop never executes an application. Files are referenced in place rather than copied or uploaded. Browser preview file selections remain page-session resources and may need reconnecting after reload; native grants persist for reopening.

Chrome positioning, Chrome ownership, lecture mode and workspace hotkey implementations are retained. No generic native-window attachment is introduced.

## Verification

49 frontend tests and 19 Rust tests passed, plus TypeScript, Vite and Windows release compilation. One explicit real-Chrome GUI smoke test remained ignored. Coverage includes target decisions, saved useful state, independent instances, dropped-resource classification, persisted exact grants, malformed website shortcuts, and rejected unsupported files.

Preview UI checks verified default-type and saved-preset drag-to-add; Notes header green-save, useful content reopening, and red instance removal keeping its preset; document and Apps picker names/type badges; Apps movement and resize to 434 × 337; and shortcut persistence after reload and across workspaces. No console warnings or errors were reported. Preview proof is `../../../archive/older-versions/ver0.16-drop-tray.png`.

BrowserWidget, chromeOverlay, chromePanel, native chrome_overlay and shortcuts implementation files are byte-identical to the ver0.15 source archive. Native Explorer drag/drop, real application launch and default PDF-viewer GUI acceptance remain untested. Chrome resizing, Lecture mode, signed-in websites, fullscreen/video and clipboard/Save acceptance were not retested. Final packaged artifact checks are recorded in the release task rather than claimed by this note.
