# Course-linked Environments Implementation Plan

**Goal:** Let each timetable course point to a Still workspace and let the user open that course's environment directly from the timetable.

**Architecture:** Persist an optional workspace ID on each schedule entry. The timetable editor selects among existing Still workspaces; a row-level action switches to the linked workspace only when it still exists. Deleting a workspace clears its timetable links so saved data cannot retain dangling references. Native app launching and automatic time-based workspace switching are outside this first slice.

**Tech Stack:** React, TypeScript, local workspace schema, Playwright.

---

### Task 1: Persist and validate a course environment link

**Files:** `still-desktop/src/domain/workspaces.ts`, workspace domain tests.

- Add optional `workspaceId` to `ScheduleEntry`.
- Preserve a valid ID in parse/save and in assistant schedule action validation.
- Add a focused migration/round-trip test and malformed-ID test.

### Task 2: Edit and open linked environments in the timetable

**Files:** `still-desktop/src/TimetableWidget.tsx`, `still-desktop/src/widgets.tsx`, `still-desktop/src/WorkspaceCanvas.tsx`, `still-desktop/src/App.tsx`, localization files, timetable tests.

- Pass the current workspace list and a workspace-switch callback into timetable widgets.
- Add a workspace selector to the course edit form, with an unlinked option.
- Show a compact action on linked rows that opens the selected environment.
- Handle a deleted/unavailable workspace as an unlinked course without throwing.

### Task 3: Clean links when removing workspaces

**Files:** `still-desktop/src/App.tsx`, focused workspace deletion tests.

- Clear references to the deleted workspace from every timetable entry in the same state update.
- Preserve the existing confirmation and undo behavior for workspace deletion.

### Task 4: Verify and hand off

- Run typecheck, focused timetable/workspace tests, relevant assistant protocol checks, and the production build.
- Rebuild the Windows executable and verify its path, size, timestamp, and hash.
- Record exact scope and remaining limitations in an agent report; keep unrelated dirty work untouched.
