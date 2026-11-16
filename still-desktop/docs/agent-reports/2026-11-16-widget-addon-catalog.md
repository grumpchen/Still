# Task: Widget add-on catalog

- Agent: Codex, GPT-6
- Time: 2026-11-16T11:48:17+08:00

## Done
- Added a first-party widget add-on catalog with labels, icons, availability rules, enabled-state readers, and toggle transitions.
- Replaced the hard-coded card add-on menu with catalog-driven rendering.
- Added removal support for Color Tag through the add-on menu; the selected color can still be changed from its palette.
- Documented the distinction between the widget add-on and plugin settings catalogs, and the remaining state/migration work for add-ons that need persistent data.

## Files
- `src/domain/widgetAddons.ts`
- `src/WorkspaceCanvas.tsx`
- `src/localization.tsx`
- `docs/architecture/current.md`

## Checks
- `pnpm check` — passed.
- Tests were not run.

## Handoff
- This is an internal first-party extension seam, not a third-party plugin runtime. Add-ons that introduce new persisted state still need schema parsing/migration and feature-specific behavior.
- Good follow-up candidates are a per-widget progress state (high value, modest scope), a focus spotlight (useful but canvas-wide behavior), and due-date reminders (more complex because of time zones and Windows notifications). Progress state is the recommended next add-on to prototype.
