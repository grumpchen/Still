# Task: Automation rules domain

- Agent: Luna automation-rules worker
- Time: 2026-11-26 UTC (timezone offset unknown)

## Done
- Added a standalone, typed automation rules domain for exactly two families: matching newly captured links/files into a course's linked workspace, and preparing a workspace with a saved layout on a one-time, daily, or weekly schedule.
- Literal English/Chinese parsers only accept documented request shapes. Ambiguous/missing course, workspace or layout names return clarification; arbitrary prose returns unsupported. Structured provider/tool drafts use exact current IDs and validate course-to-workspace and layout scope.
- Versioned local persistence validates every record and preserves malformed or future-version data without clearing it. Receipts are retained across restart; recurring runs use timezone-aware date keys; capture runs require a stable QuickCapture event identity (never a native tick sequence).
- Evaluation delegates to an injected `AutomationOperationService`; it does not implement resource or layout mutations. It persists a running receipt before calls, prevents concurrent same-process tick duplication, retries only explicit `failed/retryable` results, and converts a running receipt found after restart to terminal `outcome_unknown` rather than repeating a possibly applied mutation.

## Files
- `still-desktop/src/domain/automationRules.ts`
- `still-desktop/tests/automation-rules.test.mjs`

## Checks
- `pnpm exec tsx --test tests/automation-rules.test.mjs` — 7 tests passed.
- `pnpm check` — passed.

## Handoff
- Exported adapter contract: `AutomationOperationService.execute(action, context)` where context includes stable `idempotencyKey` (`ruleId/occurrenceKey`); result is structured `succeeded`, `failed` with retryable flag, `needs_clarification`, or `outcome_unknown`, with optional operation receipt ID. The coordinator must map `fileResourcesToCourse` to a real collection operation and `prepareWorkspaceLayout` to a real layout operation. Neither adapter is wired by this domain branch; no end-to-end or native tray acceptance is claimed.
- `fileResourcesToCourse` requires `resourceKinds`, a non-empty `queryPattern`, exact `courseId` and its `workspaceId`, and allows an optional exact `sourceWorkspaceId`. The service must enforce that selector and only process the referenced capture event. Provider calls must be validated through `validateAutomationRuleDraft` / `createAutomationRule` before saving.
- Capture evaluation takes `pendingCaptureEventId`, a durable business event identity (e.g. resource ID plus creation identity), and should be called while processing a pending QuickCapture journal. The 15-second native tick is only a wake-up/replay cue and must never be used as the capture event ID.
- For crash safety, the shared operation service must deduplicate durable `idempotencyKey`s and return its real operation receipt. The domain deliberately will not auto-retry a persisted `running` outcome after process restart; it records `outcome_unknown` and requires reconciliation. A failed result may retry only when the adapter certifies no mutation has happened and sets `retryable: true`.

## Review follow-up (commit pending)
- Layout catalog workspace IDs now describe layout provenance only; applying a saved layout to another target workspace is allowed.
- Evaluations serialize per storage instance in this JS runtime, reload before each action, verify that the live rule remains enabled and unchanged, and merge each final receipt into freshly loaded state after the awaited operation. This avoids stale whole-state writes over edits and concurrent evaluator runs.
- A one-time rule records a terminal watermark directly on its rule after success, clarification, or unknown outcome, so receipt pruning cannot make the one-time action due again.
- Parser constructors validate the normalized trigger before returning a rule, so impossible daily/weekly times return clarification.
- Follow-up checks: 9 focused tests and `pnpm check` pass.
