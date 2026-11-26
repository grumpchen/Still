# Windows tray automation rule smoke extension

## Scope

Extended `scripts/windows-workbench-smoke.mjs` to exercise one real scheduled layout automation in the same candidate release executable. The script creates a complete layout through the Dashboard UI, creates a future-due one-time rule by sending the user-facing “Save a rule: …” request through the Still AI panel, hides Still with the native minimize-to-tray command before the due time, and waits for the native tick callback and persisted operation result.

## Assertions

- The saved rule is a one-time `prepareWorkspaceLayout` rule with `replace` mode, created from the AI input flow and confirmed by Still AI’s saved message.
- Before hiding, the rule has no receipt and the target widget IDs are unchanged. Its scheduled time is still in the future.
- While the main window is hidden, its succeeded receipt (with `startedAt >= hiddenAt`) and terminal watermark are written.
- The target workspace widget IDs change and its widget types match the saved layout.
- After a later hidden tick, the target widget IDs remain unchanged and the rule still has exactly one receipt.

The script continues to report the action accurately as `window_minimize_to_tray` and does not claim a physical tray icon/menu click.

## Implementation assumptions checked in source

- The initial workspaces include `Study` and `Design`; the Dashboard's Global workspace layouts form can save a layout sourced from `Design`.
- Automation rules are created through the existing Rules panel and persisted as `still.automation-rules.v2`.
- `AutomationRunnerController` subscribes to native ticks independently of the Rules modal and executes due operations from those ticks. One-time successful rules gain an `onceTerminal` marker and are omitted by `dueAutomationOccurrences` on later ticks.
- Tauri 2.12.1 `Context<R>` exposes `config_mut(&mut self) -> &mut Config` at `src/lib.rs:438`, and `Context` is generic over the runtime (`src/lib.rs:358`). This confirms the main-window argument injection uses the locked API.

## Checks and limits

- `node --check scripts/windows-workbench-smoke.mjs` — passed.
- `git diff --check` — passed.
- This Linux environment cannot run the Windows candidate. Rule execution, hidden renderer event delivery, and idempotency remain unverified until the GitHub Windows smoke run passes.
