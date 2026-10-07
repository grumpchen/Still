# Task: Bound workspace viewport sizing (r6)

- Agent: Codex coordinator
- Time: 2026-10-07T14:24:00+13:00
- Task: widget-tray-minimize regression fix
- Branch: agent/opencode/widget-tray-minimize
- Baseline: f671d65
- State: READY TO TEST

## Done
- Restored the workspace surface flex sizing and explicit hidden-surface rule removed by c3ebd7c. Only canvas.css behavior changed.
- Measured the regression in the running browser preview before editing: a 1280 x 720 window had a canvas viewport 22,369,610 pixels tall and canvas 22,369,618 pixels tall. The surface was block layout with no flex growth/shrink constraint.
- Missing flex sizing allowed the viewport to grow with its 150% canvas; ResizeObserver then fed the enlarged viewport back into canvas sizing. This is a confirmed runaway geometry loop and a substantial performance regression, not evidence of excessive memory consumption measured directly.
- After restoration, the same window has a 544-pixel viewport and 816-pixel canvas. Existing minimize and tray behavior remains intact.

## Files
- still-desktop/src/canvas.css
- docs/agent-reports/2026-10-07-workspace-sizing-r6.md

## Checks
- Running preview before/after bounded-height assertion: failed before, passed after.
- Sidebar collapsed: viewport 544, canvas 816; bounded.
- Workspace switch: active surface flex/544/816; inactive surface display none/0/0.
- Compact focus: viewport 609, canvas 914; bounded at rounded 150%.
- Minimized and double-click restored Notes; original text retained. Returning to normal layout restored 544/816 geometry without growth.
- Smaller 1000 x 600 viewport: viewport 424, canvas 636; bounded. Temporary browser viewport override reset afterward.
- corepack pnpm test: 105 passed, 0 failed.
- corepack pnpm check: passed.
- corepack pnpm tauri build --no-bundle: passed, including frontend production build.
- Generated permission line-ending churn discarded after verifying no substantive differences. Native Rust source unchanged; Rust tests not rerun for this CSS-only fix.

## Handoff
- Candidate: C:\Users\haoka\Projects\Default Project\.worktrees\still-opencode-widget-tray-minimize\still-desktop\src-tauri\target\release\ver0.21-test-widget-tray-minimize-r6.exe
- SHA256: 78E575F487E4AF29EC27091783CA8889D9D6C5102D3B518CFC80EADF2CC5E921
- Older builds preserved. No native executable launched, merge, push or release acceptance performed.
- User confirmed both lag and white stripe remained with only r5 running, ruling out concurrent Still instances as the sole cause.
- Native Chrome clipping/white-stripe behavior is not verified by the web preview. User Windows acceptance must retry scroll down/across, overlapping widgets, native resizing and minimize/restore with only r6 running. Do not claim the stripe fixed without that evidence.
- NEXT ACTION: Waiting for user.
