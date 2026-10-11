# Widget relaunch and plugin settings build

Implemented configurable startup relaunch for workspace widgets. The change adds global Automatic/Manual behavior, optional Apply to All, per-tag-color policies, per-widget overrides, and precedence rules. Widgets remain persisted in their workspaces; manual mode defers mounting their renderer until Relaunch is selected. The Apps widget's external native application lifecycle is unchanged.

Settings now separate Sidebar Plugins from Widget Plugins. Widget Relaunch is enabled by default and can be disabled, removed, or restored; disabling/removing it forces manual startup without deleting saved settings. The optional Tag Color Status widget uses saved composable control IDs, and removing that widget does not erase the underlying settings.

## Verification

- `pnpm --config.verifyDepsBeforeRun=false check` — passed.
- `pnpm --config.verifyDepsBeforeRun=false test` — passed, 183 tests.
- `pnpm --config.verifyDepsBeforeRun=false build` — passed.
- `pnpm --config.verifyDepsBeforeRun=false tauri build --no-bundle` — passed; Windows release executable produced.
- No Rust source changed, so no Rust tests were needed.
- The executable was copied to `C:\Users\haoka\Projects\Default Project\Still-Widget-Relaunch-2026-10-11.exe` and was not launched.
- Windows GUI behavior and native Apps integration were not accepted or verified in this task; those remain for the integration session.
- No push, merge, or GitHub release was performed.
