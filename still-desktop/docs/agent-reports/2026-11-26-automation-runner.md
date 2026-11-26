# Task: Automation runner and panel

- Agent: Luna automation runner worker
- Time: 2026-11-26 UTC (timezone offset unknown)

## Done
- Added a Tauri runtime adapter for `automation_runtime_status`, `automation_ticks_since`, `window_minimize_to_tray` and `still:automation-tick`, with camelCase payload checks and injectable bridge for tests.
- Added a controller/hook intended to be mounted once by the app root, independently from the optional panel. Native ticks/replay drive the runner; a Web preview fallback is explicitly page-open-only and never presented as tray scheduling. Cursor is persisted by `(runtimeId, sequence)`, with replay on startup, gaps and runtime changes.
- Added a standalone AutomationPanel with one-sentence creation, enable/delete controls, Run due now, actual persisted receipt/status display and explicit runtime / capture-queue limitations.
- Added an injected pending-capture queue contract. Rules run only against durable event IDs and matching resource kind/name/source workspace; only all-success receipts are acknowledged. A thrown/false acknowledgement stays visible and retries acknowledgement without repeating successful operations. No pending capture queue currently exists in the application, so the runner does not fabricate one.
- Hook exposes `createFromText` for the later Still AI entry point and `getCatalog`/`getService` getters so operations use current state/service. Save errors are returned and displayed without clearing existing data.

## Files
- `still-desktop/src/platform/automationRuntime.ts`
- `still-desktop/src/domain/automationRunner.ts`
- `still-desktop/src/useAutomationRunner.ts`
- `still-desktop/src/AutomationPanel.tsx`
- `still-desktop/src/automationPanel.css`
- `still-desktop/tests/automation-runner.test.mjs`
- `still-desktop/tests/automation-runner-hook.test.mjs`
- `still-desktop/tests/automation-rules.test.mjs` (capture event payload contract update)

## Checks
- `pnpm exec tsx --test tests/automation-rules.test.mjs tests/automation-runner.test.mjs tests/automation-runner-hook.test.mjs` — 15 tests passed.
- `pnpm check` — passed.
- `pnpm build` — passed; Vite emitted its existing large-chunk advisory.
- Native commands/events were tested through the injected bridge, not a live Windows tray build.

## Handoff
- Root integration must mount `useAutomationRunner` once at App scope and pass the API to `AutomationPanel`; no App/AssistantPanel change was made here.
- Pass a stable `AutomationStorage`, latest catalog/service getters, and a real capture journal adapter if available. The current app's QuickCapture path has no pending event list or ACK; absent injection is shown as unavailable, and pending events are never invented from 15-second tray ticks.
- A source queue should expose stable `eventId`, `capturedAt`, `resourceKind`, `name`, and optional `sourceWorkspaceId`, plus `listPending`/`acknowledge`. The service adapter receives the same event ID as `context.captureEventId` and must honor operation idempotency.
- The native contract matches the tray runtime worker's reported payloads. Native tray acceptance and complete operation-service wiring remain pending; no end-to-end automation claim is made.

## Layout mode follow-up
- Scheduled layout actions now require `mode: 'append'|'replace'`, matching the shared `layout.apply { layoutId, targetWorkspaceId, mode }` contract; the rule adapter maps its `workspaceId` to `targetWorkspaceId`.
- English and Chinese literal grammars accept an explicit append/replace operation. A layout sentence without a mode returns a mode clarification with exact target IDs; the panel retains the original sentence and saves it after the user chooses once.
- Persistence is upgraded to envelope/rule version 2. The reader falls back to the v1 storage key, migrates legacy no-mode layout rules disabled, and marks them as requiring a choice. Choosing a mode restores the prior enabled intent and writes the migrated record to v2; previously-disabled rules remain disabled.
- No default replace is introduced. Validation now includes legacy migration, mode choice, preserved sentence, no-mode clarification, and application of a layout saved in another workspace.
- Follow-up checks: 17 focused tests, `pnpm check`, and `pnpm build` passed (Vite large-chunk advisory only).

## Local time and duplicate rule follow-up
- `createFromText` now parses scheduled phrases in the host's resolved local time zone, with an injectable `timeZone` option for tests/managed hosts; parser errors remain explicit if the zone is invalid.
- Repeating the same normalized trigger + action returns the existing enabled rule instead of creating a second rule ID. A completed one-time rule remains a dedupe hit using its durable `onceTerminal` marker even after receipt pruning.
- Hook tests cover a non-UTC injected zone, duplicate creation, and completed once-rule deduplication after its receipt is absent.
- Follow-up checks: hook suite — 5 tests passed; `pnpm check` and `git diff --check` passed.
