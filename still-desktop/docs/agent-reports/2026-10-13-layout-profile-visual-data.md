# Visible-page layout, Chrome profiles, and visual AI sharing

## Changes

- Snap layout overflow now searches and stacks within the currently visible workspace page, including when the canvas is horizontally scrolled. Layout mode temporarily disables canvas scrolling, and overflow cards are raised so they remain reachable.
- The Installed Apps catalog now scans the Windows Desktop and Public Desktop shortcut folders as well as Start Menu folders. It keeps shortcuts to separate Chrome profiles distinct and preserves the shortcut label for profile entries. Profile-specific Chrome launches skip generic executable-only window reuse and request a new window, so Still can attach the requested profile window rather than an unrelated Chrome window.
- Still AI's existing per-message screenshot option now appears for eligible `@`-selected Apps, calculator, and Files widgets with either Gemini or OpenAI. Images are sent only when the checkbox is enabled and only in the latest user turn. The UI notes that the chosen model must accept images; the Rust request builder validates and formats OpenAI's image content part.
- Updated the Still AI documentation for visual sharing.

## Verification

- `pnpm.cmd check` — passed.
- `pnpm.cmd build` — passed.
- Focused assistant/layout React tests — 15 passed.
- Full Rust tests — 72 passed, including shortcut catalog, Chrome profile launch, and multimodal request tests.
- Full `pnpm.cmd test` — 219 passed, 28 failed. Failures are outside the edited paths and include Browser tests referencing the removed `src/BrowserWidget.tsx` and tests asserting older workspace defaults/migrations. The full-suite failures remain for separate cleanup.
- No real provider request or live external Chrome profile attachment was performed; Windows visual acceptance remains manual.
