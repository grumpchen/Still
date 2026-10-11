# Design: transparent Liquid Glass and compact tag-color controls

## Behavior
- Selecting Transparent clears the Liquid Glass wallpaper image and workspace background while leaving the Liquid Glass card material active.
- The status-card tag-color control starts with one switch: “All colors follow global.” Turning it on removes all color overrides and stacked color rows.
- Turning it off reveals an add-color dropdown. Each chosen color becomes a persisted row with Follow global, Automatic, or Manual behavior; selecting any row turns the all-global switch off. Rows summarize custom choices (for example, “Manual: Red, Purple”).

## Boundaries
- Keep tag-color relaunch policy stored in the existing workspace state.
- Store which tag rows appear on a particular status card in that widget’s existing `pluginControls` field.
- Let each plugin status control receive its widget and update callback, so plugin-owned controls can render and persist their own settings. The status card discovers and stacks controls from the plugin registry.
- Keep the transparent wallpaper rule in the existing CSS; no native-window behavior changes are needed.

## Verification
- Exercise transparency settings and wallpaper suppression through the appearance helper and stylesheet rule.
- Exercise the rendered status-card controls: global toggle, adding multiple colors, per-color selection, summary text, clearing, and plugin-provided controls.
- Run focused TypeScript, frontend, and Tauri release builds; live Windows GUI acceptance remains unverified.
