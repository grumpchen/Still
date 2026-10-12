# Focus and Clock Timer UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restyle Focus with a clock-dial duration picker, add Clock as an optional per-widget add-on opened in an anchored floating panel, and show a workspace red status dot after a timer completes.

**Architecture:** Keep countdown state in the existing persisted `WidgetInstance.remaining` and `WidgetInstance.end` fields. Persist Clock add-on selection as a boolean on each widget, render its header control beside the existing `+`, and reuse the existing anchored portal positioning used by color/plugin menus. Share one React timer surface between Focus and the Clock add-on. Derive each workspace's finished indicator from its widgets.

**Tech Stack:** React 19, TypeScript, existing widget catalog and domain state, CSS, Node test runner with jsdom.

---

### Task 1: Add domain behavior for Clock add-on and finished workspace timers

**Files:**
- Modify: `src/domain/workspaces.ts`
- Modify: `src/domain/presets.ts`
- Test: `tests/timer-status.test.mjs`

Persist Clock add-on selection with each widget without changing the workspace schema, preserve it in saved tray presets, and expose a pure predicate for finished Focus or Clock add-on timers.

### Task 2: Build the shared Focus/Clock dial UI

**Files:**
- Create: `src/TimerWidget.tsx`
- Modify: `src/widgets.tsx`
- Modify: `src/styles.css`
- Modify: `src/canvas.css`
- Test: `tests/timer-widget.test.mjs`

Use an accessible Hour/Min segmented control, a clickable 12-position dial, a range input, a duration readout, and Cancel/Set Time actions. The existing Start/Pause/Reset countdown continues to use `remaining` and `end`. Open Clock from its header icon in a floating portal that follows its card. Use Still theme variables with a dark dial surface and restrained transitions.

### Task 3: Add timer completion status to workspace navigation

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Test: `tests/timer-status.test.mjs`

Render a small status indicator beside each workspace. It stays visually quiet before completion and turns red when any Focus or Clock timer in that workspace finishes.

### Task 4: Verify and record

Run the timer tests, the frontend test suite, type checking, and production build. Record completed work and actual checks in the required dated task report. Do not claim live Windows GUI acceptance unless performed.
