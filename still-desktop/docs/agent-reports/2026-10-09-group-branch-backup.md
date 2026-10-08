# Group branch backup verification

- Agent: Codex
- Time: 2026-10-09T01:15:18+13:00 (project timezone; recorded during backup verification)

## Done
- Verified the user-tested Group executable `ver0.21-test-group-improvements.exe` is associated with the clean Group source worktree at `8a5782836651a3530b98d05405e4ec91a0e74858` (`feat(groups): add collapsed collection cards`). The executable SHA-256 is `E4D6AE8774EFBFBC7B8448D5773724501929D715EC91A9ABA5C325659673D055`.
- Confirmed the Group branch contains three commits after accepted `main` `d7be5fa9f54e6d801b7b9265cde8f00a91074fed`; the Group worktree has no uncommitted changes.
- Confirmed SSH access to `grumpchen/Still`, with remote `main` at `d7be5fa`. Unauthenticated GitHub metadata returns 404 and SSH can read the repository, consistent with its existing private visibility. The Group branch was absent remotely before this task.
- No application changes were needed before backup. The only local checkout changes are unrelated work on `agent/opencode/app-resize-grip-cutout` and were left untouched.

## Files
- This verification report only; no Still application source changed.

## Checks
- `node --test tests/group-tray.test.mjs tests/groups.test.mjs tests/trayDrop.test.mjs` — 30 passed.
- `corepack pnpm check` — passed.
- `corepack pnpm build` — passed (TypeScript and Vite production bundle).
- `cargo check --manifest-path src-tauri/Cargo.toml --offline` — passed.
- `git diff --check d7be5fa..8a57828` — passed.
- A broader targeted selection including `tests/canvas.test.mjs` had one known unrelated canvas-height expectation failure (actual 700, expected 1050); the Group-specific selection above passed.
- No live GUI test was run; the user previously reported that the Group test build runs smoothly.

## Handoff
- Push only `agent/codex/group-improvements`; do not merge it to `main`.
- Create the Apps UI cleanup worktree from the verified application source commit `8a5782836651a3530b98d05405e4ec91a0e74858` only after the remote backup is confirmed.
