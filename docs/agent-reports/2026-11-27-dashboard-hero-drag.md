# Task: Dashboard hero and drag layout

- Agent: Luna
- Time: 2026-11-27T07:27:19+00:00 (UTC)

## Done
- Removed the Hero Resume, Library, Add to calendar, and Plan study actions. The regular calendar event controls and Library workspace navigation remain available.
- Replaced edit-mode module reorder arrows and whole-card drag capture with a pointer drag handle in each module header. Dragging preserves embedded module interaction outside the gesture and remains part of the existing Done/Cancel draft.
- Updated Dashboard-focused E2E expectations and navigation to use the sidebar.

## Files
- `still-desktop/src/DashboardHome.tsx`, `src/App.tsx`, `src/styles.css`
- Dashboard layout and E2E tests

## Checks
- `pnpm check` — passed.
- `node --import tsx --test tests/dashboard-home-layout.test.mjs` — passed.
- `STILL_PLAYWRIGHT_EXECUTABLE_PATH=/usr/bin/chromium STILL_PLAYWRIGHT_PORT=4200 pnpm exec playwright test tests/e2e/dashboard-custom-layout.spec.ts --workers=1 --grep "Dashboard starts full page"` — passed, including both same-row reorder directions and Cancel rollback.
- Other affected E2E flows are being run; see follow-up commit.

## Handoff
- Dashboard hero action selectors were removed. Tests that previously used Resume actions are being switched to sidebar navigation.
- No Windows-specific verification was run.
