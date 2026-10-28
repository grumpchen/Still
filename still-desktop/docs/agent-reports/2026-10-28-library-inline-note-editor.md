# Library inline note editing and rounded stacks

- Markdown, Markdown-extension, and text files now open as editable textareas in the existing Library preview pane instead of routing the file through another note display.
- Added explicit save and unsaved-state feedback. Edits are saved with the file's expected baseline; a file changed outside Still displays a conflict and offers reload, preserving the external version. Draft text remains cached while switching between files in the open explorer.
- Kept other file previews and the existing external-open action. No PNG/export format was added.
- Increased the visibility and corner radius of collapsed Group stack layers and rounded the Library explorer/editor surfaces.
- Added English and Chinese labels for unsaved edits.
- Verification: `pnpm check` and `git diff --check` passed.
