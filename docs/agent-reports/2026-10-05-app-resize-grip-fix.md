# Task: Keep app widget resize grip accessible

- Agent: OpenCode assistant (GPT-6 Luna)
- Time: 2026-10-05T22:12:38.254+13:00 (local time)

## Done
- Measure Still's resize button and send its bounds with attached-app open, attach, and present calls.
- Subtract the grip's overlap from the native Windows window region using GDI `CombineRgn`/`RGN_DIFF`, so the underlying Still resize control stays visible and clickable without hiding other app content.
- Added frontend geometry coverage and extended the Windows native fixture to verify the grip point is excluded while a neighboring app-content point remains included.

## Files
- `still-desktop/src/AppsWidget.tsx`
- `still-desktop/src/domain/appPanel.ts`
- `still-desktop/src/platform/appPanel.ts`
- `still-desktop/src-tauri/src/app_panel.rs`
- `still-desktop/tests/app-panel.test.mjs`
- `still-desktop/docs/plans/2026-10-05-app-resize-grip-cutout.md`
- This report

## Checks
- `corepack pnpm test` — 54 passed, 0 failed.
- `corepack pnpm build` — TypeScript and Vite production build passed.
- `cargo test` (Windows/MSVC) — 27 passed, 1 ignored; the real-window clipping fixture passed.
- `git diff --check` — passed.

## Handoff
- Changes are on `agent/opencode/app-resize-grip-cutout`; no release executable was built or run.
- Please verify in the desktop app by shrinking an attached Codex/ChatGPT panel and dragging its bottom-right grip. Native unit coverage verifies region hit-testing, but no interactive Still GUI smoke test was performed.
