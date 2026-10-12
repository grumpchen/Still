# Layout Occupied-Zone Cascade Implementation Plan

**Goal:** Make Layout highlights white and move widgets out of occupied snap targets without losing visibility or equal zone geometry.

**Architecture:** Keep snap math in `src/domain/snapLayouts.ts` and apply resulting placements through `WorkspaceCanvas`'s existing widget update path. Build the occupied-zone cascade from persisted placements plus in-session assignments, preserving the selected zone and moving blockers into unused zones before placing overflow in free workspace space.

**Tech Stack:** React, TypeScript, Vite, Node test runner.

---

### Task 1: Lock down placement and zone geometry

**Files:** `tests/snap-layouts.test.mjs`, `src/domain/snapLayouts.ts`

1. Add failing pure tests for a selected widget pushing a zone occupant into the next open zone, including recursively occupied destinations and overflow when all template zones are occupied.
2. Assert equal zone dimensions for symmetric layouts and proportional dimensions for Focus-left.
3. Implement a small deterministic cascade helper that returns zone assignments and widget placements without changing workspace state itself.
4. Run `node --test tests/snap-layouts.test.mjs` and confirm the new cases pass.

### Task 2: Connect the cascade to the rendered workspace

**Files:** `src/WorkspaceCanvas.tsx`, `src/SnapLayoutOverlay.tsx`, `tests/workspace-layout.test.mjs`

1. Add a rendered test with a widget already covering the selected zone; verify the dragged widget lands in the selected zone and the blocker moves to an open zone.
2. Apply every placement returned by the domain helper through the existing `update`/`bringToFront` path and retain Snap Assist suggestions for remaining cards.
3. Run `node --test tests/workspace-layout.test.mjs`.

### Task 3: Set white zone highlights and verify

**Files:** `src/canvas.css`, `tests/workspace-layout.test.mjs`

1. Use white border/fill for preview, hover, and filled zones with theme-safe opacity.
2. Run focused layout tests, `pnpm check`, `pnpm test`, `pnpm build`, and `git diff --check`.
3. Record results and the remaining live Windows visual acceptance in the required task report.
