# Task: Assistant workspace visual context

- Agent: Codex GPT-6
- Time: 2026-10-14T21:27:00+13:00

## Done
- Added an AI setting, enabled by default, that includes a downscaled capture of the visible Still workspace canvas with AI requests.
- Workspace images are excluded from saved chat and workspace data, not written to disk by this feature, and released from the request state after completion. The selected provider receives the image; provider-side retention follows its policy.
- Kept structured widget geometry authoritative and clarified that an image alone does not authorize workspace changes.
- Layout requests now retry once after an invalid overlapping proposal; ordinary conversation cannot show a layout proposal. Updated overlap error copy.

## Files
- `src/AssistantPanel.tsx`, `src/platform/assistant.ts`, `src/platform/capture.ts`
- `src-tauri/src/assistant_protocol.rs`, `src/domain/assistant.ts`
- `tests/assistant-panel.test.mjs`, `tests/assistant-sidebar.test.mjs`

## Checks
- `pnpm check`: passed.
- `pnpm build`: passed; Vite reported its existing large-chunk advisory.
- Focused assistant panel, sidebar, and domain tests: 39 passed.
- Full frontend suite: 264 passed, 35 failed across existing unrelated tests including removed BrowserWidget references and workspace migration expectations.
- Rust suite: 85 passed, 1 native resize/window-handle test failed in the full run; isolated rerun of that test passed.
- Live Still desktop preview remained open and Vite hot-reloaded the AssistantPanel changes.

## Handoff
- Screenshot sharing defaults on and can be disabled in Still AI settings. Image-capable models are required. Still cannot erase data retained by the selected provider.
