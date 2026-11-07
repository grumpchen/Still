# Task: Notes widget and Library redesign planning

- Agent: Pip (gpt-6.1-sol)
- Time: 2026-11-05T19:47:10+13:00

## Done
- Read root AGENTS.md, app README, current architecture, NotesWidget, NotesLibraryExplorer and the inline Library editing report.
- Created a scoped redesign plan and acceptance criteria. No application code changed.
- Identified separate Notes autosave and Library explicit-save draft paths as the key unification work.

## Files
- still-desktop/docs/plans/notes-widget-library-redesign.md
- docs/agent-reports/2026-11-05-pip-notes-redesign-plan.md

## Checks
- Git branch readback: agent/codex/notes-library.
- Git status inspected; existing appearance/localization edits and reports left untouched.
- Tests/build not run: planning-only task, no application edits.

## Handoff
- User subsequently confirmed editing Word directly inside Still and excluded additional formats. Plan updated for in-app .docx editing/saving, shared revisions, a proposed formatting subset, native binary safety, and explicit preservation-or-block behavior for unsupported document structures. Legacy .doc excluded. @opencode owns implementation and must prove round-trip fidelity before choosing the DOCX dependency; no implementation or validation performed by Pip.
- Shared-document identity, safe saves and grant boundaries must be preserved; see plan for acceptance criteria.
- Planning documents left uncommitted; no merge, push, restart or implementation performed.
