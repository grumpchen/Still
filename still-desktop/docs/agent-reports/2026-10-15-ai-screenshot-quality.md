# Task: AI screenshot quality

- Agent: Codex GPT-6
- Time: 2026-10-15T20:07:08+13:00

## Done
- Increased Still AI workspace and widget screenshot processing from a 1280-pixel maximum to 2560 pixels, with JPEG quality 0.92.
- Added adaptive quality and downscaling to preserve the existing 2.8 MB request limit.
- Changed OpenAI-compatible image requests from low to high detail.
- Added checks for the higher-detail protocol field and shared workspace/widget image encoding.

## Files
- `src/platform/assistant.ts`
- `src-tauri/src/assistant_protocol.rs`
- `tests/assistant-panel.test.mjs`

## Checks
- `pnpm check`: passed.
- `pnpm build`: passed; Vite reported its existing large-chunk advisory.
- Assistant protocol tests: 12 passed.
- Focused assistant frontend/domain tests: 33 passed before adding the new encoding assertions; the updated screenshot-target test then passed, including both workspace and widget image dimensions and quality.

## Handoff
- Larger captures still use the existing request-size limit and are reduced only as needed. Image fidelity depends on the selected model's image support and interpretation.
