# Task: Relax AI action matching

- Agent: Codex
- Time: 2026-11-17T14:56:03+08:00 (Asia/Shanghai)

## Done
- Changed valid assistant actions that do not exactly match the local wording classifier from hard failures into reviewable suggestions.
- Applied the same rule to provider agent actions: valid actions in the existing limited proposal set can be shown for approval without failing on semantic wording checks.
- Kept action type/field validation, current workspace and target validation, stale-state checks, and explicit approval before these agent actions execute.

## Files
- `still-desktop/src/AssistantPanel.tsx`
- `still-desktop/src/domain/assistantTools.ts`
- `still-desktop/tests/assistant-panel.test.mjs`
- `still-desktop/tests/assistant-tools.test.mjs`

## Checks
- `pnpm check` — passed.
- `pnpm build` — passed; Vite reported its existing large-chunk warning.
- Focused AI suite — 97 passed across assistant action, panel, agent, and tool tests.

## Handoff
- This removes local semantic-mismatch failures; provider authentication, network, rate-limit, and quota errors still surface as errors.
- The agent action proposal list remains intentionally limited; filesystem operations and arbitrary code execution are not enabled.
