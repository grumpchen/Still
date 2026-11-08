# Task: agent finalization after tool budget

- Agent: Codex (GPT-6)
- Time: 2026-11-09T04:08:29+13:00, Pacific/Auckland

## Done
- Fixed the agent loop so it can request one provider response after the final permitted tool round. This lets the assistant explain the actual tool receipts instead of ending immediately with a step-limit status.
- Further tool requests at the limit are still refused, included in the receipt history, and never executed.
- Kept the existing Files explorer, in-folder note editor and study actions, PDF preview, keyword highlighting, number selection, and calculation widget paths intact; this change is limited to agent orchestration.

## Files
- `still-desktop/src/domain/agentLoop.ts`
- `still-desktop/tests/agent-loop.test.mjs`
- `docs/agent-reports/2026-11-09-agent-finalization-budget.md`

## Checks
- `pnpm.cmd exec tsx --test tests/agent-loop.test.mjs` — passed (14 tests).
- `pnpm.cmd check` — passed.
- `git diff --check` — passed.
- Native UI was not restarted or re-tested for this source-only agent-loop change.

## Handoff
- The configured limit still caps tool rounds and calls; a final provider response is allowed after the last successful round. If the provider requests another tool, Still returns `step_limit` with an explicit non-executed receipt.
- Codex subscription live reconnect/model entitlement/inference and native PDF interactions remain unverified as recorded in their task reports.
