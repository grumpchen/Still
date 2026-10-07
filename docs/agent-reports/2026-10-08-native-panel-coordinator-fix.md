# Task: Native Browser and Apps panel synchronization

- Agent: Codex, GPT-6.1 Sol
- Time: 2026-10-08T00:06:36+13:00

## Done
- Addressed the cross-layer race where independent Browser/Apps placement paths could acknowledge stale visibility, move a visible native HWND before applying its new clip, or leave the last-updated HWND above the DOM's intended card order.
- Added monotonic per-panel presentation revisions, ignored stale native requests, and returned the native shown state to the frontend.
- Routed Windows move, resize, DPI, and foreground refreshes through one Browser → Apps → z-order pass. The shared z-order coordinator applies DOM card ranks to visible Chrome and Apps windows and skips unchanged ordering to avoid redundant native calls.
- Both panel types now hide during changed geometry/clip/occlusion updates and show only after placement and clipping. Apps now clips against overlapping higher cards as Chrome already did.
- Removed Apps screenshot capture's temporary HWND_TOP promotion, which could leave native stacking inconsistent with Still's widget order.

## Files
- `still-desktop/src-tauri/src/native_panels.rs`
- `still-desktop/src-tauri/src/main.rs`
- `still-desktop/src-tauri/src/app_panel.rs`
- `still-desktop/src-tauri/src/chrome_overlay.rs`
- `still-desktop/src/AppsWidget.tsx`
- `still-desktop/src/BrowserWidget.tsx`
- `still-desktop/src/domain/appPanel.ts`
- `still-desktop/src/platform/appPanel.ts`
- `still-desktop/src/platform/chromePanel.ts`

## Checks
- `corepack pnpm build` — passed (TypeScript check and Vite production build).
- `cargo check --manifest-path src-tauri/Cargo.toml` — passed for Windows.
- `corepack pnpm tauri build --no-bundle` — passed; test candidate: `still-desktop/src-tauri/target/release/ver0.21-test-native-panels.exe`.
- Tests and live GUI acceptance — not run; this handoff is for the user to test the native overlap, scroll, workspace-switch, and DPI cases.

## Handoff
- Baseline: `cd0208d21089674db12960d03282a1c44ce5bc3e`; branch: `agent/codex/native-panel-coordinator`.
- The test executable SHA-256 is `C2767F146875A1EE3609A4439A17F5E760EA846825A731DA37DA878381BD2987`.
- This is a test candidate, not an accepted release. The persistent compositor white-stripe mechanism was not independently proven; verify whether hide/apply/show and shared clipping/order remove the reported symptom before accepting the fix.
