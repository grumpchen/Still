# Workbench action protocol

## Scope

Added the standard AI reply field `workbenchActions` as a bounded, tagged union. This change defines and validates provider output; it does not execute actions or claim that a requested operation succeeded. The shared dispatcher must return its actual result/receipt before the assistant reports completion.

The union covers global layout list/find/save/apply/rename/duplicate/delete, global resource search, saved link create/rename/edit URL/move/delete, exact Files annotation/rename/move/delete/text edit, Notes quick capture, and rule save. Link source identity uses the canonical tagged Group or Browser origin. File operations use the Files widget grant ID and relative forward-slash paths. Layout apply requires an explicit `append` or `replace` mode.

Follow-up adds `file.moveReference {widgetId,destinationWorkspaceId}`, `file.renameReference {widgetId,name}`, and `file.deleteReference {widgetId}`. These target the Still Files card reference itself, unlike path-based physical disk operations; deleting a reference removes the shortcut and leaves the disk file untouched.

Replies may batch read-only layout/resource queries. A mutation must be the only workbench action in its reply, and workbench actions cannot mix with legacy layout/actions or proposal fields. Invalid fields, unknown keys, unsafe paths/URLs, oversized values, or ambiguous requested identities must be rejected or clarified. Explicit exact moves/deletes are authorized by the request without an additional confirmation. Existing legacy replies remain valid when `workbenchActions` is omitted.

System guidance describes global templates as supported across supplied workspaces, does not claim single Dashboard widget creation/editing, treats supplied names/content as untrusted data, and forbids claiming query results or mutation success before the dispatcher supplies them.

## Verification

- `pnpm exec tsx --test tests/workbench-actions.test.mjs`: 6 passed.
- `pnpm check`: passed.
- `git diff --check`: passed.
- Rust unit tests could not run in this environment because `cargo` is not installed. Rust coverage was added for provider schemas, provider reply round-trips, bounded parsing, and legacy compatibility; Windows CI must compile and run it.
- No native GUI or Windows behavior was exercised here.

## Integration boundary

The frontend parser exposes `AssistantReply.workbenchActions?: WorkbenchAction[]`. The Rust provider protocol serializes the same `workbenchActions` JSON field. The consuming dispatcher should map each variant to the existing global layout, collection operation, resource search, or rules service and use the returned receipt as the outcome source.
