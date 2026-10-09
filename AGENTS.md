# Still — Agent Workflow

1. **Codex** confirms the baseline, task scope, dependencies and acceptance criteria. Keep routine plans brief.
2. **Integration** assigns the branch/worktree and owns Git operations, integration, release decisions and final Windows acceptance.
3. **Luna** implements only the assigned task, runs relevant checks, and returns the changed areas, results, limitations and test-build location. Stop at `READY TO TEST`, `BLOCKED` or `WAITING FOR USER`; do not start another phase automatically.
4. Use **Sol** only for difficult root-cause investigations or high-risk architecture decisions. **OC is unavailable**; do not make progress depend on it.
5. **ChatGPT is optional and read-only.** No ChatGPT login, review or PASS is required.

Keep work isolated to the assigned checkout. Preserve unrelated changes, user data and existing builds. Do not merge, push, rewrite history or release without Integration's authorization. Build only when the task calls for it; do not launch its executable unless explicitly authorized. Report checks exactly and identify native Windows behavior that still needs live acceptance.
