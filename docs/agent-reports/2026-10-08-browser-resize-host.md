# Task: Browser native panel resize

- Agent: Codex, GPT-6.1 Sol
- Time: 2026-10-08T00:34:45+13:00

## Done
- Traced the screenshot mismatch to the workspace Browser host inheriting the legacy `.browser-host` fixed `height:min(48vh,440px)` and `min-height:280px`. The card grew, but the host rectangle measured by `BrowserWidget` did not, so Chrome remained short and left unused space below.
- Scoped a flex-fill, auto-height, zero-minimum rule to the canvas Browser widget. Its existing ResizeObserver now observes the host at the card's actual available height and sends that geometry through the native panel coordinator.

## Files
- `still-desktop/src/canvas.css`
- `docs/agent-reports/2026-10-08-browser-resize-host.md`

## Checks
- `corepack pnpm build` — passed (TypeScript and Vite production build).
- `corepack pnpm tauri build --no-bundle` — passed; Cargo was made available only in the build process's temporary PATH.
- GUI resize acceptance — not run; the user should check the new candidate.

## Handoff
- Candidate: `still-desktop/src-tauri/target/release/ver0.21-test-native-panel-resize-r2.exe`.
- No native geometry or timing workaround was added; CSS now gives the native Browser host the full resized card content area.
