# Live desktop development

From `still-desktop`, run:

```powershell
pnpm dev:desktop
```

This starts Still as a Windows desktop app. React, TypeScript, and CSS edits are served by Vite and update through HMR. Rust edits are watched by the Tauri CLI; it recompiles and restarts the development app. The terminal shows Tauri and Rust output, and Rust panics include backtraces. WebView2 DevTools are enabled in the development window; use **F12** or **Ctrl+Shift+I**.

Stop the session with **Ctrl+C** in the terminal. A Rust-triggered restart briefly closes the development app, so any external app attached during that session is released by Still and may need to be attached again. Workspace data is saved in the development WebView profile and survives normal frontend HMR.

The development config uses the distinct `nz.personal.still.dev` app identifier and `Still Dev` name. Tauri uses that identity for separate app data and WebView2 storage, including workspace localStorage and the embedded browser profile. This keeps the development workspace separate from the installed Still release. Native HWND attachments are transient and belong to the running process; do not attach the same external app window in both the release app and development app at once.

`pnpm dev` remains available for a browser-only Vite preview. Release builds continue to use the production Tauri config and identifier.
