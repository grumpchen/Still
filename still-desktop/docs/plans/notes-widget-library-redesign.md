# Notes widget and Library redesign

Status: planning complete; user confirmed in-app Word editing. Implementation and validation not performed by Pip.
Owner: Pip (planning); @opencode (implementation).

## Requested outcome
- Remove the horizontal open-note tab bar from Notes.
- Preserve Open Library and existing folder/file features.
- Make the same note editable in Notes and Library, with edits reflected immediately in either view.
- Preserve title/heading, font family, text size, heading insertion, bold, lists, checklists and existing note capabilities.
- Edit and save Word .docx files directly inside Still in both Notes and Library. Other formats and legacy .doc are out of scope.

## Inspected baseline
- NotesWidget.tsx owns local/open document state, Markdown actions, font settings, library autosave and conflict checks.
- NotesLibraryExplorer.tsx has separate draft/baseline maps and explicit Save for md/markdown/txt. These are independent editing paths, not a unified live document session.
- README documents md/markdown/txt editing, bounded folder scanning, native folder grants and browser write limitations. Word editing is not established by these files.

## Proposed UX
- Replace the tab strip with a compact current-note selector and New note action; keep Open Library separately visible, not inside the removed tab strip.
- Keep all existing notes accessible through the selector/search. Remove tabs, not note data or multi-note capability.
- Use the same editor component and formatting toolbar in both Notes and the Library editing pane.
- Preserve Library browsing/search, subfolders, create/refresh/change-folder, previews and Open externally.

## Implementation scope for @opencode
1. Trace all Notes/Library render and persistence paths before edits, including any standalone Library entry point. Inspect existing tests and data migrations.
2. Introduce a shared document session/store. File-backed identity must include native library/root identity plus relative path; local notes retain stable IDs. Do not match documents by filename alone or incorrectly merge different folder grants.
3. Both surfaces subscribe to and mutate the same in-memory document revision. Preserve cursor/selection and avoid remounting the editor on each update.
4. Use one serialized save pipeline per document, with debouncing and expected-baseline conflict checks. Advance save baseline only on successful writes. Show dirty/saving/saved/error consistently; retain dirty drafts on errors.
5. Prevent pending edits from disappearing when switching views/files, closing widgets or changing folders. Never silently overwrite external file changes. Preserve existing grant boundaries and safe folder-switch behavior.
6. Share existing formatting/editor controls rather than maintaining separate feature sets. Keep Markdown/text representations intact; plain text must not acquire hidden rich-text content. Existing font controls are display settings unless persistence scope is explicitly extended.
7. Remove tab-strip UI, add replacement navigation, preserve existing note data and saved workspace compatibility.
8. Implement Word through a separate binary DOCX adapter and structured rich-text document model, sharing the document session across both views. Never write text/HTML/Markdown bytes to a docx file. DOCX font and size controls change document formatting, unlike Markdown/plain-text display preferences. Extend native grant-checked listing/read/write paths without bypassing existing security or simply raising all text-file limits; define binary/archive size limits and reject malformed or unsafe packages.
9. Before committing to a DOCX editor dependency, demonstrate an actual open/edit/save/reopen round trip on representative fixtures. Proposed editable subset: paragraphs, headings, bold/italic, font family/size, and basic ordered/unordered lists. This subset is a minimum proposal, not permission to discard other content. Inventory tables, images, links, headers/footers, comments, tracked changes, fields and embedded objects. Preserve unsupported structures unchanged if proven safe; otherwise block in-place editing/saving with an explicit explanation. Optional lossy conversion must be a separately named copy with informed user approval, never an automatic replacement of the original.

## Acceptance criteria
- No horizontal open-note tab bar. Open Library, New note and access to existing notes remain available.
- Typing in Notes updates the matching Library editor without reopening/refreshing; typing in Library updates Notes. Unrelated notes/libraries remain independent.
- Existing heading/font/size/bold/list/checklist controls work in both surfaces. Tags, links, search and AI actions are preserved where currently supported.
- Rapid edits/switches do not revert newer text or mark unsaved content saved; failed saves retain content and show an error.
- Native file saves persist after reopen; external-edit conflicts do not overwrite either version silently.
- Folder changes, grant boundaries, local-note migration and tray-copy isolation remain safe.
- Browser tests can validate shared editor behavior, not actual native file persistence or Word integration.
- A supported .docx opens and edits inside Still, and edits appear in both Notes and Library immediately. Save produces a valid DOCX package; reopen in Still and independently in Word or a compatible reader confirms content and supported formatting persist.
- Representative fixtures verify headings, bold/italic, font family/size and basic lists survive edits. Unsupported structures are proven preserved or editing/saving is blocked before any original file is modified; no silent flattening or conversion.
- Native DOCX writes use baseline conflict detection and atomic replacement where supported. Save errors or external changes leave the original and local draft intact. Malformed or oversized documents report an actionable error.
- Legacy .doc and additional formats are not included. Do not describe this as full Microsoft Word compatibility.

## Validation when implementation is authorized
Run relevant regression tests plus pnpm check, pnpm test (serially), pnpm build and pnpm test:e2e. Add focused tests for shared revisions, rapid saves, conflicts, folder identity and replacement navigation. Manually verify native file save/reopen and any agreed Word workflow. Preserve unrelated edits; remain on agent/codex/notes-library; no merge or push without approval.
