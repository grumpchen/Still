# Task: Dashboard hero and drag layout

- Agent: Luna
- Time: 2026-11-27T07:27:19+00:00 (UTC)

## Done
- Removed the Hero Resume, Library, Add to calendar, and Plan study actions. The regular calendar event controls and Library workspace navigation remain available.
- Replaced edit-mode module reorder arrows and whole-card drag capture with a pointer drag handle in each module header. Dragging preserves embedded module interaction outside the gesture and remains part of the existing Done/Cancel draft.
- Updated Dashboard-focused E2E expectations and navigation to use the sidebar.
- Migrated legacy E2E Resume shortcuts to open the sidebar and select the corresponding workspace.

## Files
- `still-desktop/src/DashboardHome.tsx`, `src/App.tsx`, `src/styles.css`
- Dashboard layout and E2E tests

## Checks
- `pnpm check` — passed.
- `node --import tsx --test tests/dashboard-home-layout.test.mjs` — passed.
- `STILL_PLAYWRIGHT_EXECUTABLE_PATH=/usr/bin/chromium STILL_PLAYWRIGHT_PORT=4200 pnpm exec playwright test tests/e2e/dashboard-custom-layout.spec.ts --workers=1 --grep "Dashboard starts full page"` — passed, including both same-row reorder directions and Cancel rollback.
- The combined Dashboard/assistant/library acceptance run completed 21/23 passing. The Dashboard custom-layout test was subsequently fixed and passed in isolation; the simplification and 16 assistant tests passed. The remaining workbench Library flow timed out while the sidebar peek overlay intercepted Library content; root fixed the overlay in integration source after this branch baseline, and that flow awaits integrated rerun.
- Migrated Resume selectors in course-environments, files-contrast, pdf-citations-presets, save-selection-to-note, and workbench-recovery tests. Three additional Library CTA specs were fixed by root integration.

## Handoff
- Dashboard hero action selectors were removed. Tests that previously used Resume actions are being switched to sidebar navigation.
- No Windows-specific verification was run.
