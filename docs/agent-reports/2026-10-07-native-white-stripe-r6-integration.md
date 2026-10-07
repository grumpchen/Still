# Task: Carry the white-stripe fix onto widget-tray-minimize r6

- Agent: Codex
- Time: 2026-10-07T22:55:48+13:00 (Pacific/Auckland)
- Task ID: `white_stripe_r6`
- Baseline: `01e529fdb409659ebc51944086eff8f34fd42f41` (`agent/opencode/widget-tray-minimize`, r6)
- Branch: `agent/codex/white-stripe-r6`

## Done
- Applied the native clipped-child region refresh and regression tests from `6fe5e999e00b32d49d643fbba8ccd7e091e3b287` on top of r6, retaining r6's tray, minimize, canvas sizing and native resize logic.
- Built a separate candidate for the combined feature set; prior r6 and white-stripe builds were left untouched.

## Files
- `still-desktop/src-tauri/src/app_panel.rs`
- `docs/agent-reports/2026-10-07-native-white-stripe-fix.md` (carried with the fix commit)
- `docs/agent-reports/2026-10-07-native-white-stripe-r6-integration.md`
- Candidate: `C:\Users\haoka\Projects\Default Project\ver0.21-test-white-stripe-r6.exe`
- SHA256: `2A8A8EFF373BE66E63083FF3EC7E8609258B75D96A9A719B0C0BA21A7AFD552A`

## Checks
- `corepack pnpm test`: 105 passed.
- `corepack pnpm check`: passed.
- `corepack pnpm build`: passed.
- `cargo test --release`: 39 passed, 0 failed, 1 opt-in real-Chrome test ignored.
- `corepack pnpm tauri build --no-bundle`: passed.
- `git diff --check 01e529f..HEAD`: passed.
- Windows GUI acceptance of the white-stripe behavior remains unverified in this combined build.

## Handoff
- Test only this candidate with one Still instance open. Check scrolling and overlapping native app panels, then confirm the r6 minimize/tray behavior remains intact.
- No release acceptance, merge, or app launch was performed.
