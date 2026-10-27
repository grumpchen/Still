# Task: AI calendar proposals

- Agent: Codex
- Time: 2026-10-28T00:03:19+13:00

## Done
- Added validated, provider-neutral AI calendar event proposals with a 14-event limit and ISO date, time, title, and category checks in both the native protocol and frontend parser.
- Added an English and Simplified Chinese review card that lists every proposed event; events are only saved to the active workspace calendar after an explicit confirmation.
- Revalidate the active workspace, target calendar, existing event count, and proposal contents at confirmation time. Calendar updates participate in workspace undo.
- Kept the Dashboard as a distinct fixed study-home composition, with its Library view embedded separately from movable widget canvas layouts.

## Files
- `still-desktop/src-tauri/src/assistant_protocol.rs`
- `still-desktop/src/App.tsx`
- `still-desktop/src/AssistantPanel.tsx`
- `still-desktop/src/assistant.css`
- `still-desktop/src/domain/assistant.ts`
- `still-desktop/src/domain/studyCalendar.ts`
- `still-desktop/src/localization.tsx`

## Checks
- `pnpm check` — passed.
- `pnpm build` — passed; Vite reported the existing large-bundle advisory.
- `cargo check --offline` — passed; one unrelated existing dead-code warning in `dropped_files.rs`.
- `git diff --check` — passed.
- Live Windows UI interaction was not run.

## Handoff
- Drafts are saved in Still's existing local workspace calendar after confirmation; this does not sync to an external calendar service.
