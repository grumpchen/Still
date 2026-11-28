# AI study modes

## Delivered

- Added persisted named instruction profiles with a General default, a global default, and per-course defaults. Profile edits include AI instructions and optional download/save folder grants.
- Applied the selected profile to Still AI standard requests, agent requests, and direct Files study prompts. Instructions travel in a separate `mode_instructions` field and are injected as trusted guidance; widget/workspace material remains separately marked untrusted.
- Connected mode download folders to the Files inbox view and PNG export. Folder paths remain native opaque grants; saving files uses the selected directory and safe generated names.
- Replaced the standalone Capture topbar entry with a compact Mode picker/editor. Quick Note remains in the command palette and sidebar; Rules remains independent.
- Threaded `modeContext` through `WidgetProps` and `WorkspaceCanvas` for plugin integrations such as Flashcards.

## Verification

- `pnpm check` — passed.
- `pnpm exec tsx --test tests/study-modes.test.mjs tests/assistant-panel.test.mjs` — 17 passed.
- `STILL_PLAYWRIGHT_EXECUTABLE_PATH=/usr/bin/chromium STILL_PLAYWRIGHT_PORT=4183 pnpm exec playwright test tests/e2e/study-modes.spec.ts --workers=1` — 1 passed.
- Workbench E2E suite in the earlier focused run — 5 passed.
- Rust tests could not run in this Linux environment because `cargo` is not installed. Windows Rust compilation remains for CI.

## Notes

- Mode editing is user initiated; selecting a mode in a course updates that course's default, while Dashboard selection updates the global default.
- Directory selection and native writes depend on existing Tauri folder grant support. Browser preview falls back to its existing download behavior.
