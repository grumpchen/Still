# Agent Rules for Still

## Project brief

Still is a Windows desktop workspace app with movable widgets, saved shortcuts, workspaces, and managed application panels. The copied project notes describe version 0.18. Source code is in `still-desktop/`; the original archive is retained at `archive/source-archives/still-desktop-source.zip`. Read the source project notes before making code changes. Do not assume that the copied release executables are source code or tests.

## Shared workspace and coordination

- This repository is the canonical shared workspace: `C:\Users\haoka\Projects\Default Project`.
- Read this file, `README.md`, and relevant design/implementation notes before starting a task.
- Give each agent a clearly scoped task. Use a separate Git worktree and branch per concurrent agent; do not have concurrent agents edit the same working tree or task files.
- Keep `main` stable. Workers push their own task branches for coordinator review. The coordinator merges to `main` and publishes releases with the user's authorization. Shared history rewrites and force pushes require separate authorization.
- Record durable decisions, task assignments, and handoffs in repository files. Agent conversations are not shared memory.
- Do not overwrite another agent's report or unrelated work. The coordinator assigns an order when tasks overlap.

## UI A and AI A workflow

- UI A leads interface tasks. AI A leads Still Agent behavior and tooling tasks. Start each task branch from the latest `origin/main`.
- The worker leading a feature implements and validates a usable version, then pushes their branch. They can edit the files needed for their task, including shared wiring such as `App.tsx`. Routine implementation decisions are theirs.
- After pushing, the worker sends one handoff with the branch, commit SHA, user-facing changes, checks and results, and any concrete limitation. If blocked, complete independent work and report the specific blocker and the evidence.
- The coordinator reviews what shipped on the branch and assigns follow-up work only when needed. For UI-led work, AI A takes any AI integration after UI A hands off. For AI-led work, UI A takes any interface integration after AI A hands off. The coordinator gives the next worker the baseline containing the lead changes.
- Independent tasks can run in parallel. For changes to the same feature or shared integration points, use the handoff order above. The coordinator owns integration and release.

## Naming conventions

- Name task branches `agent/<agent-name>/<short-task>` using lowercase kebab-case (example: `agent/codex/fix-app-picker`).
- Name sibling worktree folders `../still-<agent-name>-<short-task>` (example: `../still-codex-fix-app-picker`).
- Use one short task per branch/worktree; avoid spaces and dates in branch names.
- Write commits as `type(scope): short description`, with types such as `feat`, `fix`, `docs`, `test`, or `chore` (example: `fix(app-picker): preserve selected window`).
- Keep `main` for reviewed integration; do not merge without user approval.

## Safety and change discipline

- Treat the original `outputs` folder as read-only; make changes only in this repository or an explicitly assigned worktree.
- Never run copied `.exe` files. Do not delete or replace copied source/artifact files without the user's approval.
- Do not commit copied installers/release `.exe` files or the source `.zip` as routine code changes unless the user explicitly asks to version those artifacts. Keep them available locally; do not remove them as part of this rule.
- Avoid destructive Git commands and do not discard changes you did not make.
- Make the smallest change that satisfies the task. Run relevant tests/checks when available; do not claim checks passed unless actually run.

## Required task report

After every task, add a report at `docs/agent-reports/YYYY-MM-DD-short-task-name.md` and commit it with that task's changes. Use this structure:

```markdown
# Task: <short name>

- Agent: <agent name and model, if known>
- Time: <local ISO 8601 timestamp with UTC offset; state if timezone is unknown>

## Done
- <what changed or was completed>

## Files
- <important files changed>

## Checks
- <commands/checks and results, or "Not run" with reason>

## Handoff
- <decisions, limitations, and next steps; "None" if none>
```

Keep reports factual and concise. Do not include secrets, credentials, or unnecessary personal data. If no code changed, still report the work and explicitly say so. Reports are the durable handoff for future agents.
