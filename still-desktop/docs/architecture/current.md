# Current application architecture

Still is a Windows-first Tauri 2 desktop application. React and TypeScript render the workspace; Rust owns Windows integration and validates privileged desktop operations. The frontend is a modular monolith rather than a third-party plugin host.

## Main modules

- `src/App.tsx` composes the application, workspace state, dialogs, persistence, and native adapters.
- `src/domain/` contains serializable workspace, widget, layout, shortcut, preset, and appearance rules. These modules should remain independent of React and Tauri.
- `src/widgets.tsx` binds the widget catalog to first-party renderers. `src/domain/widgetCatalog.ts` supplies widget metadata. `src/Icon.tsx` is a leaf renderer shared by the widget shell and editors.
- `src/WorkspaceCanvas.tsx` owns card interaction and presentation. Browser and Apps widgets send geometry through `src/platform/` adapters.
- `src/platform/` contains narrow adapters for Tauri commands, events, native files, capture, browser panels, and workspace shortcuts.
- `src-tauri/src/main.rs` wires Tauri commands and state. Native behavior is grouped into Rust modules for browser views, attached Apps, file grants, capture, shortcuts, and z-order coordination.
- `src-tauri/capabilities/main.json` limits privileged commands to the local main webview. Native file and app access uses opaque grants rather than serializing raw file paths or HWND/PID identities into workspace state.

## State and recovery

Workspace data is versioned JSON in the main webview's local storage (`still-workspace-v2`, schema version 4). `parseState` validates and migrates the supported historical schemas. Startup keeps a recovery copy when parsing fails; saves report quota or storage errors in the UI. Native folder/document/app grants are stored separately by Rust. Attached HWND/PID values are transient and are reacquired or explicitly reopened after Still restarts.

This is a local-first state path, not a durable transactional repository. It has no automatic cloud sync, backup rotation, import/export, or multi-process writer coordination. A storage failure leaves edits in the current React session and displays a warning; it cannot guarantee those edits survive a crash.

## Native presentation and DPI

The React canvas measures widget and viewport rectangles in CSS pixels. Windows adapters convert the main window's client origin and current DPI to physical screen coordinates, then update the same top-level native window. Apps and Chrome retain their own window lifecycles; native panels are clipped and ordered by the shared coordinator. Windows move, resize, scale-factor, focus, workspace, and minimize events trigger presentation refreshes.

The native test suite exercises coordinate and size conversion at 100%, 125%, 150%, 175%, 200%, and 300% scaling factors, including negative monitor origins. These are deterministic conversion tests. The repository does not provide automated multi-monitor hardware, Retina, or visual clipping tests. Live Windows acceptance at each display scale remains a manual check.

The main window minimum is 780 × 660 logical pixels. The canvas bounds its interactive area to the viewport and clamps widget placements; the app picker has a narrow-window layout rule. Font sizes and many card dimensions remain explicit CSS pixel values. There is no user-controlled global UI scale, and visual accessibility/layout has not been verified at every resolution or OS text scale.

## Extension and security model

The current extension points are first-party registries: `widgetCatalog` plus the renderer table, saved widget presets, and allow-listed sidebar plugin IDs (`stack`, `layout`). The Plugins settings page enables or removes these built-in actions. This does not implement third-party discovery, installation, arbitrary plugin code, plugin-specific configuration, or an external lifecycle API. Adding a first-party widget currently requires code and schema changes.

Still deliberately does not evaluate third-party JavaScript in the privileged main webview. A future third-party host needs a sandboxed view/process, a versioned message protocol, per-plugin permission grants, config isolation, and failure containment before loading plugin code. Tauri commands must remain unavailable to untrusted plugin views. The current built-in registries are safe extension seams for maintainers, not a claim of user-installable plugins.

## Verification

Run frontend tests serially because multiple rendering tests reserve the same Vite port: `pnpm test`. Run the Windows native fixture suite serially because it creates and manipulates desktop windows: `cargo test --offline -- --test-threads=1`. Type checking and production frontend build are `pnpm check` and `pnpm build`. A green automated suite does not replace real app acceptance for external windows, monitor transitions, assistive technology, or signed-in web sessions.
