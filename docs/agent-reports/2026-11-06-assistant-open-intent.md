# Task: assistant open intent alignment

- Agent: Codex
- Time: 2026-11-06T08:48:52+13:00 (Pacific/Auckland)

## Done
- Traced a failing assistant-panel regression to the creation classifier treating “open Focus with details” as a request to create a new Focus widget. That caused a valid provider-suggested restore action to be rejected as mismatched.
- Restricted widget creation from “open” phrasing to explicit widget/card requests. Existing “open Notes widget” creation wording remains supported; opening a named widget conversationally can now be handled by Still AI without a false add-widget intent.
- When a clear workspace request receives a non-clarification reply but no action, layout, or proposal, Still now asks a follow-up or returns a no-change clarification instead of echoing a provider's unsupported “Done” claim.
- Updated the regression fixture to represent Focus as minimized before asking Still AI to open it.

## Files
- still-desktop/src/domain/assistant.ts
- still-desktop/tests/assistant.test.mjs
- still-desktop/tests/assistant-panel.test.mjs
- still-desktop/src/AssistantPanel.tsx
- docs/agent-reports/2026-11-06-assistant-open-intent.md

## Checks
- pnpm exec tsx --test tests/assistant.test.mjs tests/assistant-panel.test.mjs — 49 passed, including the missing-action/no-false-success regression.
- pnpm exec playwright test tests/e2e/dashboard-assistant.spec.ts --grep "maximized and narrow assistant keeps|composer stays reachable" --timeout 60000 — 2 passed.
- pnpm build — passed; existing large JavaScript chunk warning remains.
- git diff --check — passed; existing line-ending notices remain.

## Handoff
- OpenCode Go credentials are expired, so no live provider request was made. Maximized and narrow composer geometry and local action receipts were exercised in Playwright.
- Broader assistant parity and live native acceptance remain open. No commit or push was made because the checkout contains many unrelated dirty changes.
