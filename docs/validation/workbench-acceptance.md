# Still workbench acceptance

Baseline: main `4121e8a70d358ee17288b33028ed176ab7bed9de` (2026-11-26).
Implementation: Luna. Integration and independent validation: Codex.

## Batch 1: startup, recovery, Dashboard

- Seed existing Calendar events, Focus state, Timetable, course workspace and last active workspace; relaunch opens Dashboard, retains old content, and offers one-click return.
- Add Browser in Edit Layout; move, resize and remove modules; Cancel restores the complete pre-edit snapshot, Done survives reload.
- Interact with Calendar, Focus and Browser outside edit mode.
- Compare startup and switch timings with the same browser, viewport, data and measurement method; label software GPU limitations.

## Batch 2: global layouts and collection

- Save a named layout from a course workspace containing non-default content, positions, sizes and settings.
- Dashboard renames, duplicates and deletes templates across all workspaces.
- Apply to another course with append and replace; verify actual source content, fresh instance IDs, existing destination data, undo and reload.
- Search and modify Files and saved links from multiple courses in Library; verify source workspace changes directly. Notes remain in their courses.
- Capture web link, PDF and thought with an explicit course choice on every save.

## Batch 3: AI and automation

- Exercise production dispatch with deterministic provider responses; verify receipt matches actual changed state, including failure and ambiguous target paths.
- Explicit move, close and delete execute without a second confirmation; attached applications receive normal close requests.
- A natural-language request persists an enabled rule; rule execution uses the same operation layer as manual actions.
- Exercise material/link organisation and workspace/layout preparation; verify persistent occurrence receipts prevent repeated effects after ticks and restart.
- Verify native tray wiring and background scheduling through Windows automated tests. Interactive tray, embedded windows, recovery and responsiveness require an operational remote Windows session and the exact candidate binary/hash.

## Evidence boundaries

Linux browser tests cannot establish native Windows tray or embedded application behaviour. Hosted Actions compilation cannot establish desktop responsiveness. No local Windows testing is requested from the user.
