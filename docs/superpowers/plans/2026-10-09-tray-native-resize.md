# Widget Tray Cleanup and Native Resize

- Baseline: `1495c503e505bcbfe49d70e181bc9fa62c5e9af8` (Apps cleanup r3 source/report).
- Branch: `codex/tray-native-resize`; worktree: `.worktrees/still-codex-tray-native-resize`.
- Execution: current session/model, no delegation or environment switch.
- Goal: separate reusable Saved copy, original-instance Group collection, and explicit Trash deletion; eliminate competing standard native edge resize while managed.

## Task 1 — Tray UI and interactions
- Owned: WorkspaceCanvas, PresetTray, GroupTray, App, canvas.css; new TrayEditor and trayActions domain module; focused frontend tests.
- Keep permanent tray, existing Group state, shared headers, corner grips, capture pipeline, persistence and native lifecycle.
- One compact horizontal tray: Group create/existing targets, saved shortcuts, Saved +, fixed Edit and Trash. Move management actions into Edit dialog; remove duplicate labels.
- Saved + copies supported configuration through existing presets, deduplicates without raw window identity, leaves original widget/placement intact. Existing open/collected Apps with the same source must not launch duplicates.
- Group targets keep existing collect/restore behavior. Trash alone deletes; no blank/ordinary button deletion. Cancel does nothing. Group confirmation preserves collected contents; existing library deletion remains blocked until collected widgets restored.
- Reuse header Remove plus keyboard-accessible removal list. No scale animation or placement changes to other cards.
- Tests: explicit target routing, persistence, independent state, duplicate saving, Apps reuse guard, exact deletion and retained collection.
- Commit independently after focused checks.

## Task 2 — Native resize restriction
- Owned: app_panel.rs, chrome_overlay.rs, main.rs; small native_resize.rs guard and native fixture tests.
- Evidence: managed windows remain top-level and retain WS_THICKFRAME; native edge gestures alter native geometry independently of DOM. Chrome location handler corrects undersizing/position but permits larger native sizes. Region refresh cannot update DOM dimensions.
- Validate disabling standard edge resize by clearing only WS_THICKFRAME while attached, preserving original bit; notify Windows with FRAMECHANGED without moving, activating, or reordering. Programmatic SetWindowPos (Still corner grip) remains allowed. Restore original resize bit before Detach/close/shutdown placement restoration. Do not redesign clipping/movement.
- Tests: live hidden Win32 fixture at physical sizes corresponding to multiple scales; native edge hit testing no longer yields resize; programmatic size changes still work; release restores original style/hit testing and leaves window alive; originally fixed windows stay fixed.
- Limitation: custom app-managed resize hit testing or apps rewriting their styles needs real app verification; this does not claim to fix all pre-existing compositor residue.
- Commit independently after focused checks.

## Delivery
- Run focused frontend/native regression, TypeScript, production build, diff checks.
- Build one `ver0.21-test-tray-native-resize.exe`, preserve older artifacts. Record SHA-256/source, baseline failures and manual Windows matrix.
- Stop READY TO TEST. No launch, merge, push, release or Phase 2.5/3.
