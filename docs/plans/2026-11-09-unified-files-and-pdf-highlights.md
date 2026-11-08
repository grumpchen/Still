# Unified Files and PDF Highlights Implementation Plan

**Goal:** Make Still’s combined Files workspace the folder-first home for notes, files, previews, and reviewable AI keyword highlights.

**Architecture:** Keep the selected folder grant as the only file boundary. Create notes as Markdown files beneath the active folder and edit them through the existing compare-before-save path. Keep Still preview, system-default opening, and user-selected external apps as distinct view actions. For PDF highlighting, use a local PDF.js canvas/text viewer; AI returns a bounded phrase list, Still validates it and matches it to page text for a reversible overlay. Never modify the original PDF.

**Tech Stack:** Existing React/Tauri file and Notes Library APIs, native Windows file dialog/opener, PDF.js (`pdfjs-dist`) if compatible with Still’s WebView/runtime.

---

## Phase 1: Folder-first notes

1. Remove the separate Notes-mode switch and note page from the combined Files card.
2. Keep folder selection as the setup state and `.md` creation inside the current breadcrumb directory.
3. After creation, refresh the list and open the new Markdown file in the Still editor without leaving Files mode.
4. Keep existing local note records intact; do not silently migrate or delete them.

## Phase 2: Choose a viewer

1. Preserve Still preview as the click-to-view behavior.
2. Keep “Open externally” for the Windows default application.
3. Add “Open with another app” using a user-driven `.exe` picker and a native command that revalidates the selected file against its existing folder grant before launching the selected application.
4. Block executables and shortcuts from being opened as documents; validate app path, target path, and errors.

## Phase 2.5: Preserve the existing Notes editor inside Files

Opening a Markdown note from the folder explorer must retain the useful note workflow that existed before Files became the default: multiple open-note tabs, open-note search, tags, note links and backlinks, heading/list/task/bold shortcuts, font controls, conflict-safe save/reload, and direct Explain/Summarize/Flashcards/Study outline/Quiz actions. Keep notes file-backed in their current folder and keep Files as the default workspace; do not restore a separate Notes page. Store note metadata through the existing widget note-document state and save text through the same conflict-checked Library API.

## Phase 3: PDF reading and AI highlights

1. Add a local PDF.js viewer with page navigation, fit/zoom, text selection, and a separate removable highlight layer.
2. Render visible pages on demand; debounce zoom commits, cancel superseded work, reuse extracted text, cap canvas pixels, and avoid loading all page bitmaps at once.
3. Add an AI action that sends only the selected PDF text after explicit user action. Request a bounded structured phrase list, validate exact phrases and limits, and never treat PDF text as instructions.
4. Match validated phrases against local PDF.js page text, show page/phrase review before applying, and store overlay annotations locally by file identity and PDF revision. Preserve the original PDF bytes.
5. Provide graceful behavior when a PDF is scanned, encrypted, damaged, too large, or has unreliable text positioning; offer OCR only as a future opt-in.

## Phase 4: On-demand number selection and calculation widget

1. Add a user-triggered PDF number-detection mode that can be dismissed; do not run detection or show overlays until requested.
2. Detect numeric tokens from PDF text with page coordinates, including decimal, signed, grouped, scientific, and common fraction formats. Make OCR a separate future opt-in for image-only scans.
3. Allow Ctrl-click to accumulate or remove detected numbers. Right-click the selection to open a compact radial arithmetic chooser for addition, subtraction, multiplication, or division.
4. Create a dedicated persisted calculation widget showing the selected values, chosen expression, and result. Validate finite numbers and division by zero; preserve selected number order and show a clear error for undefined results.
5. Keep detection overlays and calculation widget content separate from the source PDF; closing the overlay must not erase the calculation widget.

## Verification

- Run `pnpm check` and existing focused Notes Library/PDF extraction checks where available.
- Verify folder-grant containment, create/read/edit/reload behavior, collision errors, and that user data is unchanged on failure.
- Test PDF text and scanned fixtures, multiple pages, zoom, cancellation, and overlay alignment in the native Still app.
- Verify system-default and selected-app opening using safe document fixtures; do not launch arbitrary executables during development checks.
- Record native versus source-only evidence in the required task report. Keep provider/API and ChatGPT plan routes unchanged.
