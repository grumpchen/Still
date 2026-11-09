# Task: Diagnose one unreadable PDF preview

- Agent: Codex GPT-6
- Time: 2026-11-09T15:16:04+13:00

## Done
- Confirmed that Tutorial 11 previews while Tutorial 10 does not in the same selected folder.
- Found Windows offline/recall-on-access placeholder attributes on Tutorial 10. A local read did not return its PDF header; Tutorial 11 returned its full 306,855 bytes and a valid `%PDF-` header.
- Root cause is the sync provider not making Tutorial 10 available locally. Still's native preview currently reports the read failure generically. No Still source behavior was changed, per the user's direction.

## Files
- No application source files changed.

## Checks
- Inspected the active development app's matching Files-folder grant and metadata for the two PDFs without printing their full filesystem path or document contents.
- `git diff --check` — passed; working tree had no source edits.
- No build or test was run because no application code changed.

## Handoff
- Make Tutorial 10 available offline in its sync app, then select it again in Still. If it remains unreadable after local hydration, investigate the file itself or provider errors.
