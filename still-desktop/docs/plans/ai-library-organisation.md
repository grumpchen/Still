# AI Library organisation — scoped implementation plan

Status: planning only. Pip owns architecture review/planning; OC continues UI work. This document does not assign immediate AI implementation to OC.

## Confirmed scope
The assistant can propose organising Library files within the folder explicitly assigned to Still: move files into subfolders, rename files/folders, and create folders. The assigned native folder grant, not the repository directory or a hardcoded Documents/Still path, defines the boundary. A request targets one explicit Library root; no cross-root or outside-folder operations. No deletion, shell execution, file-content rewriting, or extension changes in the initial scope.

## Current architecture reviewed
- src/AssistantPanel.tsx receives provider replies and binds existing fileProposals to selected resources with fileActionAllowed. It also supports calendar-addition proposals.
- src/domain/assistant.ts and src-tauri/src/assistant_protocol.rs parse typed replies and reject mixed action categories.
- src/App.tsx moveAssistantFile calls localFiles.moveResource, migrates fileNotes metadata, and emits still-files-resource-moved. Calendar proposals currently add events through addAssistantCalendarEvents; editing existing events is separate follow-up work.
- src/platform/files.ts and src-tauri/src/files.rs form the native file boundary. files_move_resource resolves an existing widget root grant. The helper checks paths, refuses collisions and creates destination folders while filing. It is not a general rename or standalone create-folder protocol.
- Existing native helpers inspect symlinks and canonical containment. This review does not establish race-free Windows reparse-point protection; new write paths must address that explicitly.

## Proposed user flow
1. User targets the assigned Library folder or a selection. Show the active root name and scope in chat. If several roots are possible, ask which; never infer OS-wide access.
2. Assistant can inspect a bounded tree of relative names/types inside that root. File contents are not automatically uploaded: request scoped content access only when needed and disclose provider sharing. Treat names and document content as untrusted data, not instructions.
3. Return a typed organisation proposal, not executable code. Each item shows operation, original and proposed relative location/name, and reason. Display new folders and affected descendants for folder renames.
4. User reviews/selects operations and clicks Apply. Planning alone makes no changes. Ambiguous targets or conflicts require clarification.
5. Revalidate all identities and permissions at apply time, run a dependency-ordered bounded queue, read back exact results, refresh Library, and report per-item success/failure. Never say all done on partial success.

## Implementation design
- Extend existing proposal flow with a versioned Library operation union: create_folder(parentId,name), rename(entryId,newName), move(entryId,destinationFolderId). Use root/grant identity plus stable entry identity and expected source state. Model output cannot create or switch grants or supply absolute paths. New folders receive proposal-local IDs so later moves can depend on them.
- Validate schemas in both TypeScript and Rust, then authorize and validate again at native execution. Enforce explicit operation/depth/path limits before calling the provider and before applying. Proposed first batch ceiling: 20 operations, subject to UI usability testing; do not silently alter current protocol limits.
- Resolve all existing ancestors beneath the authorized canonical root; reject traversal, absolute/UNC/device paths, alternate streams, unsafe names, reserved Windows names and all escaping symlinks/junctions/reparse points. Root itself cannot be renamed/moved. Validate filesystem identity at execution; minimize check/use races using native handle-based checks where feasible. Reject unsupported unsafe cases instead of relying on a prompt-level restriction.
- No overwrite or folder merging on collisions, including case-insensitive names. Support or explicitly reject case-only renames. Keep file extensions unchanged initially. Preserve original data on errors; maintain current restrictions on programs/shortcuts.
- Plan dependencies: create destination folders before moves; resolve descendant mappings when folders are renamed. Reject cycles and conflicting operations. Folder rename must enumerate impact and refuse if references or open drafts cannot be safely migrated.
- Update Notes source references/shared editor sessions, fileNotes, open previews, Library selection/search and saved shortcuts that are path-backed. Flush or block dirty file sessions before moving/renaming; never leave an editor writing to the old path.
- Persist a local operation journal without file contents or secrets. Offer safe Undo for moves/renames only if identities still match and the previous destination is free; remove created folders only when empty and unchanged. Do not promise transactional multi-file rollback. On failure stop dependent operations, preserve completed receipts, and offer recovery.

## Acceptance/evidence
- Natural-language requests can produce reviewed rename, standalone folder-create and file-move proposals within the chosen root.
- Before Apply the filesystem is unchanged. Cancel changes nothing. Reapplying the same proposal cannot duplicate operations.
- Native integration fixtures prove outside paths, root replacement, junction/symlink escape, malformed names and stale grants are refused without changing outside sentinel files.
- Collision, locked source, dirty note, stale proposal, case-only rename and partial-failure fixtures retain data and give accurate status.
- After success, exact native readback confirms names/locations and file contents are unchanged; Library and affected Notes references refresh correctly; persistence survives reopen.
- Test create-folder then move dependencies, folder-rename descendant mappings, repeated Apply and safe Undo collisions.
- Browser tests cover proposal review/selection/error UX only. Native fixture tests prove real filesystem boundaries and operations. Run relevant focused tests, pnpm check, pnpm build, serial pnpm test and relevant Rust tests when implementation is authorized; record existing failures separately.

## Follow-up calendar scope
Earlier request for editing calendar remains a separate feature: stable event-ID updates/reschedules/deletes, expected-revision checks, before/after review, timezone/date validation, persistence and Undo. Reuse current add-event flow; do not mix calendar changes into a Library execution batch. No external calendar integration implied.

## Delivery order
First implement/verify safe native rename and standalone folder-create primitives, then typed provider proposals/review UI, then reference migration/journal/recovery and end-to-end acceptance. Keep unrelated UI/Notes edits untouched. No application code, key settings, running processes or user files changed during planning.
