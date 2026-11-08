# Task: Files default-app viewers

- Agent: Codex GPT-6
- Time: 2026-11-09T11:19:13+13:00

## Done
- The Files widget now offers the native default app and another-app picker for regular unsupported file types, with a clear preview fallback message.
- Office `~$` lock files are identified without trying to preview them. When the matching document exists in the same folder, Still opens that original through the OS default app; without a match, it shows a notice and no open actions.
- Added an isolated native Windows acceptance case for the default-app invocation, viewer choices, matching Office document, and orphan lock file.

## Files
- `still-desktop/src/FilesWidget.tsx`
- `still-desktop/src/localization.tsx`
- `still-desktop/tests/native/assistant-reliability.mjs`
- `still-desktop/tests/native/README.md`

## Checks
- `pnpm check` — passed.
- `pnpm build` — passed; Vite reported its existing large-chunk advisory.
- `node --import tsx tests/native/assistant-reliability.mjs files-viewers` — passed in an isolated Tauri app and fixture workspace. Clicking the matched original completed through Still's native opener and produced the success receipt.
- The new jsdom unit test attempt was removed: the shared Vite SSR module cached the Files platform before the native mock setup, so its folder rows never loaded. The isolated native acceptance case verifies this path instead.

## Handoff
- The native test verifies Still's OS default-app invocation and success receipt; it does not visually inspect Word or validate a production user's file association.
- In-app rendering of DOCX/XLSX/PPTX remains unsupported. Use the default or another installed app from the Files preview header.
