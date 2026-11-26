# Task: Automation capture inbox

- Agent: Luna automation capture worker
- Time: 2026-11-26 UTC (timezone offset unknown)

## Done
- Added a versioned, local capture journal with stable event IDs, exact source pointers for files, links and ideas, pending enumeration, terminal ACK records, and exact event lookup for operation adapters.
- New record APIs are named `appendSavedCapture` / `recordSavedCapture` and are documented for use only after the Library/PDF save callback has committed. The confirmed QuickCapture callback contract is `onCaptureSaved(captureId, resource)` after successful commit; `captureId` is used as the stable event ID, making callback retry idempotent.
- ACK requires successful operation receipts for the exact `capture-event:<eventId>`, and retains an acknowledged event record. Failed operation outcomes, unknown outcomes, failed ACK writes and invalid selectors leave the event pending/visible. Full queue returns explicit `queue-full`; corrupt/future data is preserved without replacement.
- Added a same-window notification emitted only after durable append. The runner subscribes to it in addition to native ticks, and the hook uses the persistent inbox by default while still allowing injection.
- Runner action evaluation carries the exact event ID to the service adapter and filters by the event's kind/name/source workspace; it never scans older workspace files or links. Ideas are journaled and visible, but are not yet a supported filing-rule target.

## Files
- `still-desktop/src/domain/captureInbox.ts`
- `still-desktop/src/platform/automationCaptureInbox.ts`
- `still-desktop/src/domain/automationRules.ts`
- `still-desktop/src/domain/automationRunner.ts`
- `still-desktop/src/useAutomationRunner.ts`
- `still-desktop/tests/capture-inbox.test.mjs`
- `still-desktop/tests/automation-runner.test.mjs`

## Checks
- Focused automation + inbox suite — 23 tests passed.
- `pnpm check` — passed.
- `pnpm build` — passed; Vite emitted its large-chunk advisory.
- The library callback exists on the separate Library branch and is not wired into App/QuickCapture on this branch; no end-to-end capture flow is claimed.

## Handoff
- Library worker confirmed resources passed after commit: link `{kind:'link',origin,linkId,name,url}`, PDF `{kind:'file',workspaceId,widgetId,name,sourceId}`, note `{kind:'note',workspaceId,widgetId,documentId,name}`. Call `automationCaptureInbox.recordSavedCapture(captureId, resource)` from the post-commit `onCaptureSaved` callback. If it returns `{ok:false}`, throw/display `message` and keep the quick-capture UI open so it can retry with the same captureId.
- Operation adapter can retrieve the exact pointer with `automationCaptureInbox.get(eventId)` (structured result) or domain `getCaptureEvent(storage,eventId)`. Runner sends `context.captureEventId` and `occurrenceKey: capture-event:<eventId>`; map only this saved pointer through the normal shared operation service.
- Store key is `still.automation-capture-inbox.v1`; maximum 2,000 retained events. ACKed records remain for receipt/audit lookup. At capacity, the saved resource remains saved but is not queued; caller must surface the explicit queue-full message.
- App-level runner mounting and QuickCapture callback integration remain owned by root/Library integration. Native tray acceptance remains pending.

## Follow-up review fixes
- Link captures now persist the Library's tagged `origin` object (`group` with `workspaceId/groupId`, or `browser` with `workspaceId/widgetId`); runner events carry the exact `sourceWorkspaceId`. Legacy free-form `linkOrigin` records are retained as `legacy-unknown` and quarantined as ignored, so they can never be automatically dispatched.
- Unmatched captures and idea captures become a visible `ignored` terminal state without inventing operation receipts. The journal prunes only terminal history when it needs capacity; pending entries are never discarded, and a queue containing only pending entries fails explicitly.
- Each native tick refreshes runtime status; tray hiding also refreshes it.
- Added tests for legacy quarantine, ignored semantics, terminal-only pruning, idea/unmatched captures, and per-tick runtime status refresh.
- Follow-up checks: focused inbox/runner suite — 13 tests passed; `pnpm check` — passed; `pnpm build` — passed with the existing large-chunk advisory; `git diff --check` — passed.
