# Still Study Platform Upgrade Implementation Plan

**Goal:** Make Still a practical study home with a Dashboard, calendar, resource library, stronger Notes and AI, built-in sidebar tools, multilingual UI, compact visible tags, and cleaner settings.

**Architecture:** Extend the existing React workspace/canvas and Tauri native services instead of creating a second app shell. The Dashboard and Library are typed workspace roles; calendar entries and study data stay in the existing validated workspace state, while file access continues through user-selected native grants. AI receives only selected workspace/library context and proposes edits through existing action handlers.

**Tech Stack:** React 19, TypeScript, Vite, Tauri 2, Rust, existing local workspace persistence, Node test suite, Cargo checks.

## Design decisions

- The Dashboard is a normal workspace with a protected `dashboard` role and ordinary widgets. It opens first for existing users during the one-time state migration, while their existing workspaces and content remain intact.
- The calendar stores typed, date-based events in its Calendar widget. The existing weekly Timetable stays available and is not silently converted.
- The Library is a first-party workspace and navigation destination. It uses approved folder roots and opaque native grants; it does not get unrestricted filesystem access.
- AI capabilities grow through provider adapters and Still's existing action/confirmation layer. Reading uses explicitly selected notes/resources; edits, launches, deletion, and external actions keep user-visible confirmation.
- English and Simplified Chinese are the first complete locale pair. Translation keys must be stable and data remains language-neutral.
- Work is staged so each coherent milestone builds, is recorded, committed, and pushed to `agent/codex/notes-library`. If one feature slice is blocked, continue with the next independent slice and leave a clear handoff.

## Phase 1 — Dashboard home and calendar

1. Add a workspace role and versioned migration that creates a Dashboard once, preserves existing workspace data, and selects it as the initial home.
2. Add a date-based Calendar widget with month navigation, selected-day agenda, event categories, and validated local persistence.
3. Populate the Dashboard with Calendar, Focus, Notes, and Timetable cards; keep every card movable, resizable, taggable, and removable except the Dashboard workspace itself.
4. Add a small Dashboard header with today's date and quick actions to add a calendar event or open the assistant.
5. Run TypeScript and production builds, review migration behavior, write the task report, commit and push.

## Phase 2 — Built-in Library workspace and sidebar

1. Add a persistent Library workspace role and keep it visible in built-in sidebar navigation.
2. Build a searchable resource view around a dedicated Still Downloads inbox, selected course folders, Notes Library files, saved links, and recent study documents.
3. Create the Still Downloads folder and show its exact path with clear steps for setting a browser's Downloads location there. User changes that browser setting explicitly; Still never changes it silently. Only process files that arrive in the chosen inbox.
4. Let AI classify useful downloads by course/topic and suggest destinations. Keep unwanted or uncertain files in the inbox for normal user handling; never auto-delete them.
5. Extend native folder grants only for explicit user-selected roots and return minimal metadata to the frontend. Add resource actions to open, preview, attach to Notes, or send selected context to AI.
6. Verify persistence, grant boundaries, and UI builds; commit and push.

## Phase 3 — Notes for study workflows

1. Add note search, course/topic tags, and a compact library-aware navigation pane.
2. Improve quick capture, markdown structure, task/checklist support, and backlinks to selected resources.
3. Keep multi-document tabs, autosave, explicit save, stale-write detection, and folder-change rollback protections.
4. Add safe AI actions for selected text or notes (summarize, explain, make flashcards, draft a study outline) with previews before replacing content.
5. Verify local persistence and document safety; commit and push.

## Phase 4 — AI study assistance and scoped capabilities

1. Keep provider, credentials, network transport, and secret storage in the native adapter.
2. Add selected-resource retrieval with visible source names and snippets, bounded to granted roots and current selection.
3. Add study actions: explain, summarize, quiz/flashcards, compare sources, plan a study session, and draft calendar events.
4. Route changes through typed action validation, workspace limits, undo where possible, and confirmation for writes or destructive actions.
5. Add provider-independent error handling and verify no credential or private document content is written to logs or persistent chat metadata; commit and push.

## Phase 5 — Languages, settings, and compact tags

1. Introduce locale dictionaries and a language setting; localize navigation, Dashboard, Calendar, Notes, Library, and Settings first, then remaining widgets.
2. Reorganize Settings into short, named sections with consistent controls and descriptive defaults.
3. Reduce tag footprint and retain a legible tag marker on minimized widgets; preserve tag-based plugin behavior.
4. Verify state migration, keyboard navigation, visual build, and every translated surface; commit and push.

## Verification and handoff

- For each phase run `pnpm check` and `pnpm build`; run focused existing checks when specifically requested or required by the phase's acceptance procedure.
- For native changes run `C:\Users\haoka\.cargo\bin\cargo.exe check --manifest-path src-tauri/Cargo.toml`.
- Do not claim Windows acceptance from compile results. Leave third-party app attachment and live folder-grant acceptance for the user when they depend on the Windows desktop session.
- Push each phase to the authorized task branch; do not merge to `main` or create a release.
