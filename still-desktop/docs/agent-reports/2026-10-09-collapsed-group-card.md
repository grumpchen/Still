# Collapsed Group card

Task branch: `agent/codex/group-improvements`

Baseline: `d7be5fa9f54e6d801b7b9265cde8f00a91074fed`

This change follows the Group header naming and collected-widget commits. `main` and `origin/main` were both still at the baseline when checked.

## Behavior

- Canvas Group cards have a right-side arrow that collapses the card to a wide 420 px by 104 px presentation, or the maximum safe size in a smaller workspace.
- The collapsed card keeps the Group icon, inline-editable name, collected-widget count, valid drop target, and drag behavior. Stacked glass layers and an accent border distinguish it from ordinary widgets.
- Collapsing stores the expanded dimensions. Dragging while collapsed updates its location; expanding restores the dimensions at that new location and clamps the result to workspace bounds.
- The state survives workspace persistence and global widget minimize/restore. The Group button in the top tray is unchanged.

## Verification

- `node --test tests/group-tray.test.mjs`: 17 passed.
- `corepack pnpm check`: passed.
- Windows production build: succeeded.
- `git diff --check`: passed.
- Full frontend suite: 111 passed, 6 failed. The failures are the existing app-icon byte-limit expectation, canvas-height bound expectation, and four tray implementation expectations. The relevant app-picker, layout, WidgetTray, and PresetTray sources were not changed for this task.
- Rust tests: 46 passed, 1 ignored, 2 failed in the unrelated App panel minimum-size tests `c1_a_maximized_first_sample_never_becomes_the_floor` and `c2_a_persistently_clamping_app_keeps_its_floor_until_a_real_probe_is_accepted`. `cargo check` passed; no Rust test or app-panel minimum-size logic was changed by the collapsed-card feature.

The test executable was built from these application sources and is provided separately for manual Windows acceptance. Native Browser/Apps collection and restore still require live Windows verification.
