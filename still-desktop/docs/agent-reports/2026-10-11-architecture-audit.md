# Task: application architecture audit

- Agent: Codex GPT-6
- Time: 2026-10-11T14:43:19+13:00 (Pacific/Auckland)

## Done
- Broke the runtime import cycle between the widget renderer registry and widget editors by moving the shared SVG Icon renderer into a leaf module.
- Released preview-only File references when Files widgets close and when dropped documents are no longer referenced by current or undoable workspace state.
- Made the frontend test script serial to avoid port contention between visual tests; corrected two fixtures that contradicted the implementation's viewport height and app-icon size limits.
- Corrected Windows HWND fixture setup to match the production presentation/show sequence, added 125%, 175%, and 300% coverage to native geometry tests, and documented architecture and verification boundaries.
- Preserved current Group/native visibility behavior; no production Group visibility logic changed.

## Architecture Assessment
- Still is a React/TypeScript modular monolith backed by a Tauri 2/Rust Windows integration layer. Domain rules, platform adapters, and native command modules have useful separation.
- The widget renderer registry previously imported widget implementations that imported the registry's `Icon` export, creating runtime cycles. The shared icon now lives in `src/Icon.tsx`; static scan finds no runtime cycles across 48 TypeScript modules.
- `App.tsx`, `domain/workspaces.ts`, and native panel modules still centralize sizable responsibilities. State persistence is localStorage JSON with migrations and recovery, not a transactional or multi-writer store.
- No third-party plugin runtime exists. The widget catalog, renderer table, and allow-listed `stack` sidebar action are first-party extension points only. Third-party code needs a sandboxed webview/process and permissioned protocol before it can safely receive lifecycle hooks or capabilities.

## DPI & Responsiveness
- Native geometry converts CSS client coordinates and sizes to Windows physical pixels using window/target DPI-aware helpers. Conversion tests now include 100%, 125%, 150%, 175%, 200%, and 300% factors, plus negative monitor origins and target-DPI minimum sizes.
- These are deterministic math and Windows fixture tests. No live multi-monitor, mixed-DPI, Retina, 300% desktop, screen-reader, or full-resolution visual acceptance was run. The main window minimum remains 780 × 660 logical pixels, and many styles use explicit CSS pixel values; there is no global user UI-scale setting.

## Reliability
- Browser and Apps keep existing native attachment and directional visibility paths. Existing Group collect/restore tests remain in the suite and pass.
- Preview-mode Files widgets and dropped documents held `File` objects in module-level maps. Those references now have explicit cleanup based on live/undoable workspace and saved-preset references.
- Test fixtures now model actual native presentation behavior; test execution is serial because tests share a Vite port and Windows HWND state. localStorage remains best-effort: quota or process failure can still lose uncommitted session changes.

## Plugin Architecture
- Existing extension points: first-party `widgetCatalog` and renderer table; saved widget presets; the allow-listed sidebar `stack` action. New first-party widgets still require code and schema changes.
- There is no plugin install/discovery API, external lifecycle, plugin configuration store, compatibility negotiation, or third-party isolation. A minimal safe third-party host remains unimplemented; do not load untrusted JavaScript in the privileged main webview. A future host should use a sandbox plus narrow, versioned, permission-checked messages.
- Example current built-in plugin: `stack`, registered by its allow-listed ID and persisted in workspace preferences. It is not an independently installable plugin.

## Customization
- Existing appearance and workspace preferences include theme/material choices, wallpaper treatment, glass settings, widget colors, keyboard shortcuts, saved presets, and sidebar plugin selection. They persist in the versioned workspace state.
- There is no global UI scale/font setting, configuration import/export, or per-plugin configuration API. Add future preferences to the versioned domain state, migration/parser, settings UI, and focused persistence tests.

## Checks
- `node node_modules\\typescript\\bin\\tsc --noEmit` — passed.
- `node node_modules\\vite\\bin\\vite.js build` — passed; 77 modules transformed.
- `node --test --test-concurrency=1 tests/*.test.mjs` — passed; 154 passed, 0 failed.
- `C:\\Users\\haoka\\.cargo\\bin\\cargo.exe test --offline --manifest-path src-tauri\\Cargo.toml -- --test-threads=1` — passed; 54 passed, 1 ignored real-Chrome GUI test.
- `C:\\Users\\haoka\\.cargo\\bin\\cargo.exe check --offline --manifest-path src-tauri\\Cargo.toml` — passed.
- Static TypeScript runtime import scan — no cycles across 48 modules. `git diff --check` — passed.
- `pnpm` could not start in this worktree because its `node_modules` junction is not a real workspace-hoist directory; equivalent underlying Node test/typecheck/build commands ran successfully.
- No Tauri release bundle, real external-app session, or physical DPI/multi-monitor GUI test was run.

## Evidence-Based Evaluation
| Category | Score | Evidence |
| --- | ---: | --- |
| Architecture | 6/10 | Domain/platform/native seams and no runtime cycles; large central state/composition modules remain. |
| DPI & responsiveness | 5/10 | Six scale-factor conversion coverage; physical mixed-DPI and visual layouts unverified, fixed minimum and CSS pixel styles remain. |
| Reliability | 6/10 | 154 frontend and 54 native tests pass; file-reference cleanup added, but persistence is not transactional and crash recovery is limited. |
| Plugin extensibility | 2/10 | First-party registries only; no safe third-party discovery, lifecycle, or isolation. |
| Customizability | 6/10 | Several persisted appearance/layout/shortcut choices; no global scale, import/export, or plugin settings. |
| Maintainability | 6/10 | Import cycles removed and ownership documented; some modules remain highly centralized and compact. |
| Test coverage | 7/10 | Broad frontend/native suites pass; real Chrome test is ignored and visual/hardware acceptance is manual. |

## Files
- `src/Icon.tsx`, `src/widgets.tsx`, and renderer/editor imports — remove runtime registry cycle.
- `src/platform/files.ts`, `src/platform/resourceDrop.ts`, `src/App.tsx`, `tests/files-preview-lifecycle.test.mjs` — preview resource cleanup.
- `src-tauri/src/app_panel.rs`, `src-tauri/src/native_panels.rs` — native fixture and DPI coverage.
- `tests/app-picker.test.mjs`, `tests/canvas.test.mjs`, `package.json` — aligned fixtures and deterministic test execution.
- `README.md`, `docs/architecture/current.md` — development guidance and architecture record.

## Handoff
- Changes are local to the task branch and were not pushed or merged. The Windows integration session must still verify native browser/app rendering, mixed-DPI monitor transitions, accessibility scaling, and session preservation with real attached applications.
- Third-party plugins remain a documented architecture gap; implementing an isolated plugin host is a separate security-sensitive project.
