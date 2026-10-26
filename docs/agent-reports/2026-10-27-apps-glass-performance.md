# Task: Apps loading and Notes glass

- Agent: Codex GPT-6.1 Terra; glass CSS assisted by GPT-6 Luna
- Time: 2026-10-27T12:51:17+13:00 Pacific/Auckland

## Done
- Removed the opaque gradient behind the Notes glass, kept a masked metallic rim, made the reflection coordinates inherit to the highlight and header, and improved text contrast and reduced-transparency behavior.
- Changed installed app discovery to return names and shortcut IDs before extracting icons. Visible icons load on demand with three requests at most, an in-memory cache, and a shared in-flight catalog request. The picker and Apps area use the same path.
- Extracted 256px icons from Windows shortcuts, recovering transparency using light and dark backgrounds. Chunked PNG-to-base64 conversion handles large supported icons without exceeding JavaScript argument limits.
- Updated outdated tray tests to target the Apps/Shortcuts area while preserving drag-to-save coverage.

## Files
- `still-desktop/src-tauri/src/app_picker.rs`, `src-tauri/build.rs`, and Tauri permissions.
- `still-desktop/src/InstalledAppIcon.tsx`, `src/platform/installedAppIcons.ts`, `src/platform/appPanel.ts`, `src/WorkspaceDock.tsx`, and `src/AppWindowPicker.tsx`.
- `still-desktop/src/canvas.css` and focused frontend and native tests.

## Checks
- Native catalog test on this computer: old scan including all icon extraction took 3.06 seconds; the new name/shortcut scan took 0.39 seconds. Icons now finish separately as needed; this is not total time to load every icon.
- Native preview showed the translucent Notes surface and a 99-item Apps list with loaded icons. Pointer movement, app launch, and every source icon were not manually checked.
- Rust app-picker tests: 10 passed. Focused frontend tests passed. Production build passed with the existing bundle-size warning.
- Full frontend suite: 305 passed, 0 failed.

## Handoff
- Some Windows shortcuts supply only small or generic source icons, which can still limit their apparent quality. Dragging and note placement still need live acceptance if the reported jump recurs.
