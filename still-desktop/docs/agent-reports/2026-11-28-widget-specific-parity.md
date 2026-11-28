# Widget specific AI parity

## Scope

This branch extends the standard structured `workbenchActions` protocol for explicit widget operations that were available manually but did not have a direct, receipt backed AI path. The existing legacy `actions` protocol already covers timetable scheduling, Notes editing, focus and timer controls, Clock and Lock plugin controls, and other established workspace edits; those contracts were left in place.

Added structured operations:

- `widget.browser.navigate` changes the stored HTTPS URL for one exact Browser widget and causes the embedded native view to navigate when its URL state changes.
- `widget.aiCommand.edit` changes the title and/or stored prompt of one exact AI Command widget; it does not run the prompt.
- `widget.taskStatus.set` updates one regular widget's task status.
- `widget.pin.set` enables/disables the Pin to Front add-on and its pinned state.
- `calendar.add` adds validated event drafts to one Calendar widget; `calendar.delete` removes one exact event ID.

The shared dispatcher requires a matching active widget, matching widget type, and clear request intent before calling the host callback. Browser targets require the named URL host; calendar deletion requires the exact event title; ambiguous targets return `needs_clarification`. The App host performs the actual mutation and returns the receipt summary. Existing rule, collection, and layout actions remain in their current paths.

Rust provider schemas/validation and round-trip tests were extended for all six action variants. TypeScript parser and dispatcher tests cover strict fields, malformed inputs, explicit intent, and callback receipts.

## Verification

- `pnpm check` passed.
- `pnpm exec tsx --test tests/workbench-actions.test.mjs tests/workbench-operations.test.mjs` passed (24 tests).
- `git diff --check` passed.
- Rust tests were not run locally because `cargo` is unavailable in this environment. The Rust test additions are in `assistant_protocol.rs`; Windows CI should compile and run them.

## Limitations

The Browser action changes the current workspace widget's URL and uses the existing embedded view navigation effect. It does not add browser history actions or saved shortcut management. Timer/Notes/Timetable behavior remains on the existing standard assistant protocol rather than being duplicated in `workbenchActions`.
