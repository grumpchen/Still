# Native app resize-grip cutout implementation plan

**Goal:** Keep app widgets resizable when an attached Windows app window overlaps the bottom-right resize grip.

**Architecture:** The frontend measures the resize button in screen-space CSS coordinates and sends that rectangle with every app-panel open, attach, and present request. The Windows backend subtracts the overlap from the attached window's clipped GDI region. Apps also get a second drag/keyboard resize button in the card header, outside the native app surface, so resizing remains available if a target app redraws its own native region.

**Tech stack:** React/TypeScript, Tauri 2 commands, Rust `windows` crate GDI region APIs, Node's built-in test runner.

## Implementation tasks

### 1. Add frontend geometry regression coverage

- Files: `src/domain/appPanel.ts`, `tests/app-panel.test.mjs`.
- Extend app-panel geometry to carry an optional resize-grip `PanelBounds` derived from a `PanelRect`.
- Add a test that verifies the exact grip rectangle is preserved; verify `null` when no grip is available.
- Run `corepack pnpm test` from `still-desktop/` and confirm the new test passes after the implementation.

### 2. Send grip geometry through the app-panel bridge

- Files: `src/AppsWidget.tsx`, `src/platform/appPanel.ts`.
- Measure `.widget-resize` alongside the app host and include the grip in `open`, `attach`, and `present` payloads. Continue observing the card so layout changes refresh both rectangles.
- Run `corepack pnpm build` from `still-desktop/` to check TypeScript and Vite.

### 3. Cut the grip out of the native region

- File: `src-tauri/src/app_panel.rs`.
- Accept an optional grip rectangle in Tauri commands, retain it on the panel entry, and update it on presentation.
- In `position`, intersect the scaled grip with the current visible app region, subtract only that overlap using `CombineRgn(..., RGN_DIFF)`, and preserve ownership/cleanup behavior on errors.
- Extend the Windows fixture to assert a point inside the grip is outside the native region while an adjacent app point remains inside.
- If the Rust Windows toolchain is available, run `cargo test` from `still-desktop/src-tauri/`; otherwise report that native compilation was not run.

### 4. Add a persistent header resize affordance

- Files: `src/WorkspaceCanvas.tsx`, `src/canvas.css`.
- Add an Apps-only resize button to the card header. Reuse the existing resize gesture and keyboard-arrow handlers so behavior matches the corner grip.
- Run `corepack pnpm build` from `still-desktop/` to verify the component and styles.

### 5. Verify and hand off

- Run `corepack pnpm test` and `corepack pnpm build` from `still-desktop/`.
- Inspect the staged diff, record test results and native-toolchain limitations in `docs/agent-reports/`, then commit the focused fix.
