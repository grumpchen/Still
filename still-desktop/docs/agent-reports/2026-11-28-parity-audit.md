# Manual UI and assistant action parity audit

## Scope

Audited the source contracts and representative tests at base `291682f` and the current branch. This is a code and test inventory, not an exhaustive interactive audit of every screen or native Windows integration. The Notes Home path received an additional browser E2E run (Chromium). Existing workbench tests exercise the real collection reducer, Notes history reducer, and the service host.

## Inventory

| Area | Manual UI capability/evidence | Assistant/workbench coverage | Assessment |
|---|---|---|---|
| Workspace lifecycle | Workspace UI in `src/App.tsx`; state operations in `src/domain/workspaces.ts` | Legacy `AssistantAction` catalog in `src/domain/assistant.ts` includes workspace operations | Covered at action level; native/UI edge cases outside this audit. |
| Dashboard layouts | Layout controls and apply flows in `src/App.tsx`; persisted templates in `src/domain/workspaces.ts` | `layout.list/find/save/apply/rename/duplicate/delete`, dispatched by `src/platform/workbenchOperations.ts` | Covered. Apply mode is explicit (`append` or `replace`). |
| Widget canvas | `WorkspaceCanvas.tsx` supports drag, resize, stack, minimize/restore and per-widget controls | Assistant actions include widget operations and layout proposals; workbench has no equivalent for arbitrary drag/resize. | Partial by design: geometry manipulation remains a direct UI operation. |
| Browser navigation and saved links | Live URL navigation in `WebWidget.tsx`; saved Group/Browser shortcuts in `App.tsx` | Workbench `link.*` manages saved shortcut metadata; `resource.find` searches saved links and metadata | Saved shortcut management covered; changing the active Browser URL is not represented by workbench actions. |
| Saved Groups | Group collection/restore/delete in `App.tsx` and `domain/workspaces.ts` | No Group collection action in the workbench contract at audit base | Gap assigned to `root/luna_rules`, who confirmed they own group actions with rules/dashboard work. |
| Notes widget and Notes Home | Notes editor in `NotesWidget.tsx`; shared index and modal in `NotesHome.tsx`; durable history in `domain/noteHistory.ts` | Legacy assistant can create/open/close/edit note widgets; prior workbench only had `note.quickCapture` | Closed-note search and cross-workspace Notes Home management were missing. Implemented below. |
| Files | Folder browsing/opening and preview in Files UI; typed file operations in `src/platform/collectionOperations.ts` | `resource.find`, physical file operations, annotations, and Files reference operations | Metadata/operations covered; assistant does not receive file contents by this contract. |
| Calendar | Manual event create/edit/remove controls in `App.tsx` / calendar widget | Assistant has calendar proposal and add flow | Update/delete parity is not present in the assistant action contract; candidate follow-up gap. |
| Automation rules | Manual enable/disable/delete in `AutomationPanel.tsx` | Workbench supports `rule.save`; scheduled execution uses automation operation service | Administration parity was absent at audit base. `/root/luna_rules` owns rule administration now. |
| Native Apps | Attach/detach/relaunch UI in `App.tsx` and native lifecycle domain | Assistant supports saved app/workspace operations with confirmation, but no HWND attach/detach API | No native window-management action is available; preserve current authorization boundary. |

Assistant action definitions are in `src/domain/assistant.ts`; workbench action variants and batch rules are in `src/domain/workbenchActions.ts`; prompt guidance and provider schemas are in `src-tauri/src/assistant_protocol.rs`. `AssistantPanel.tsx` applies explicit confirmation to legacy destructive operations; the workbench contract executes only the explicit typed request and returns a receipt.

## Notes Home/history implementation

- `note.find` searches both open Notes widgets and durable closed-note history. Results are capped at 12 and carry a short snippet, exact identity, and SHA-256 revision token.
- `note.rename`, `note.edit`, and `note.delete` require the returned identity and unchanged revision. Identity includes `documentId`, `workspaceId`, and `widgetId`; duplicate document IDs across workspaces remain independent.
- Linked Markdown edits use the existing revision-checked `notesLibrary.write` path. Renaming a title controlled by a linked filename requests file rename through Files. Deleting the Still note leaves its Markdown file untouched.
- App deletion prunes both persisted state and the undo snapshot so a deleted note cannot be resurrected by undo. Independent copies in saved layouts and presets are retained; a matching widget ID alone is not proof that a template copy should be erased.
- Provider Rust schema and validation accept the same actions, enforce revision token shape and identity fields, and classify `note.find` as read-only for batching.

## Verification

- `pnpm exec tsc --noEmit`: passed.
- Focused `workbench-actions`, `workbench-operations`, and `note-history` tests: 27 passed.
- Notes Home E2E at checkpoint `b2a3713`: `STILL_PLAYWRIGHT_EXECUTABLE_PATH=/usr/bin/chromium pnpm exec playwright test tests/e2e/notes-home.spec.ts` passed (1 test). The default configured Edge path was unavailable in this environment; Chromium is installed and passed the same E2E.
- `cargo test assistant_protocol::tests --lib` could not run because `cargo` is not installed in this environment. Rust changes are covered by source validation/schema assertions but need CI Rust compilation.
- Full `pnpm test` is running at report generation; final count will be appended before commit.

## Boundaries and follow-ups

This audit does not claim complete UI parity or native Windows verification. Suggested follow-ups: assistant calendar event update/remove; live Browser URL navigation if that workflow should be assistant-addressable; complete interactive parity for geometry controls only if explicitly desired. Group management and rule administration are owned by `/root/luna_rules`; workspace duplicate/stack/preset lifecycle/reset appearance/relaunch and preview workbench discovery are owned by root per coordination.
