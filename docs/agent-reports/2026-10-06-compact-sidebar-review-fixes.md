# Task: compact-sidebar review fixes (M1, M2, L1, L3)

- Agent: Space Bunny Free via OpenCode
- Time: 2026-10-06T11:30:40+13:00 (Pacific/Auckland, UTC+12:00)

## Done

Applied all four findings from the independent code review to branch
`agent/opencode/compact-sidebar-header` (on top of `0ace1f4`), one commit `5321615`.
No other files, refactors or features were touched.

- **M1 — narrow-width header labels.** `still-desktop/src/canvas.css` line 44
  (`@media(max-width:900px)`) previously hid `.topbar-action-label` inside
  *every* `.topbar-actions` button. `App.tsx:112` renders three buttons, all of
  which carry a `.topbar-action-label` span: `button.search` (`span.search-label`),
  `button.topbar-customize` and `button.primary.topbar-add` ("Add widget").
  Before:
  `.canvas-app .topbar-actions .topbar-action-label{display:none}`
  After:
  `.canvas-app .topbar-customize .topbar-action-label{display:none}`
  So Search (already icon-only via `.search-label` + `kbd` `display:none`) and
  Customize go icon-only, while Add widget keeps its visible label. The tighter
  `.canvas-app .topbar-actions button{padding:6px 8px}` for that breakpoint was
  already present and is retained. All `aria-label`s (`Find an action`,
  `Customize`/`Done`, `Add widget`) were left untouched — no ARIA changes in M1.
- **M2 — shelf action target sizes.** Restored minimums on the three compact
  group-shelf button rules; the 120px `.tray-shelf-area` cap is unchanged and
  still scrolls (`overflow-y:auto`), so taller buttons cannot be clipped.
  `.tray-group-heading button` → added `min-height:22px`, padding `2px 8px`,
  font-size `10px` (was `2px 6px` / `9px`); `.tray-group-entries button` →
  added `min-height:24px`; `.tray-group-remove` → added
  `min-height:24px;display:flex;align-items:center`. Existing `border-radius`,
  `background` and `box-shadow:none` overrides were kept so appearance does not
  regress to the global `button` style.
- **L1 — Liquid Glass active-workspace highlight.** `canvas.css:54`
  `.canvas-app .nav button.active{box-shadow:inset 3px 0 0 var(--accent)}` ties
  with `styles.css:81` `.liquid-glass .nav button.active` (both 0,3,1) and
  canvas.css loads second (`main.tsx` imports `./styles.css` then
  `./canvas.css`), so the accent rail silently replaced the glass shadow. Added
  `.liquid-glass .canvas-app .nav button.active` (0,4,1) combining both, reusing
  the exact shadow values from `styles.css:81`:
  `box-shadow:inset 3px 0 0 var(--accent),inset 0 1px 0 rgb(255 255 255 / .22),0 3px 12px rgb(10 30 15 / .08)`
- **L3 — tray role.** `still-desktop/src/WorkspaceCanvas.tsx:123` tray div gained
  `role="group"` alongside the existing `aria-label="Widget tray"` and
  `aria-describedby="widget-tray-help"`, so the name is no longer placed on a
  `role=generic` element. No class, ref, data attribute or handler changed.
  Verified `trayTarget()` (`WorkspaceCanvas.tsx:26-32`) still queries only
  `[data-tray-type]` and `button,input,select,a`, none of which match the tray
  div itself, so drop-target hit testing is unaffected.

## Files

- `still-desktop/src/canvas.css` (media query at line 44, new Liquid Glass rule
  after line 54, shelf button rules at lines 132/135/139)
- `still-desktop/src/WorkspaceCanvas.tsx` (one attribute on the tray div, line 123)
- `docs/agent-reports/2026-10-06-compact-sidebar-review-fixes.md` (this report)

## Checks

Run from `still-desktop` in the worktree with the WinGet Node LTS on `$env:Path`
(`node v24.19.0`, `corepack pnpm 12.9.1`); `git` from `C:\Program Files\Git\cmd`.

- `corepack pnpm check` (`tsc --noEmit`) — exit 0, no diagnostics.
- `corepack pnpm test` (`node --test tests/*.test.mjs`) — exit 0,
  tests 63 / pass 63 / fail 0 / skipped 0.
- `corepack pnpm build` (`tsc --noEmit && vite build`) — exit 0, 67 modules
  transformed, built in ~223ms.
- `git diff --check` — exit 0, no whitespace errors.
- `git status --short` before committing listed only the two intended source
  files (`dist/` output from the build is gitignored).

## Handoff

Unverified without a live GUI window:

- Liquid Glass rendering of L1 in light and dark: the rule is a pure CSS
  specificity fix with values copied from `styles.css:81`, but the accent inset
  bar over the white-on-glass active pill was not visually inspected at 100% or
  150% scale. Confirm the active workspace still reads clearly in both
  appearances.
- M2 heights are declared values, not measurements. Shelf heights were not
  measured live; conceptually the taller buttons consume more of the
  `.tray-shelf-area` `max-height:120px`, which scrolls rather than clips, keeping
  the plan's `<=164px` total tray budget intact, but the real 120px shelf
  occupancy with multiple groups open should be eyeballed.
- `.tray-group-heading button` is `min-height:22px`, still under the 24x24
  threshold of WCAG 2.2 SC 2.5.8 — the value was specified by the review. It
  likely relies on the SC 2.5.8 *spacing* exception (heading buttons are in a
  flex row with a 5px gap, so their centres are ~27px apart and a 24px circle
  around each should not intersect a neighbour's box). If the reviewer wants a
  literal 24px, that is a one-value follow-up and costs ~2px more shelf height.
- M1 narrow-width behaviour (780px native minimum, web preview) and the
  existing native-panel alignment release gate were not re-tested; that remains
  the integration session's live check.
- Not pushed and not merged.