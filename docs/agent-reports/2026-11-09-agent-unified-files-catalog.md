# Unified Files widget in agent creation

## Change

The assistant's fresh widget catalog now exposes the combined Notes/Files widget as `notes` and no longer offers the legacy standalone `files` type. The change is applied consistently in workspace context, direct command resolution, action validation, the add-widget tool registry, and the OpenAI-compatible and Gemini provider schemas. Requests such as “create a workspace with Notes and Files” resolve to one combined widget.

Saved workspaces still retain and render legacy `files` instances; this change only prevents creation of additional standalone Files widgets. Existing file inspection, note documents, and Library operations are unchanged. The UI-visible label is Files, including assistant action receipts. Existing Notes-number references continue to work for compatibility.

## Verification

- `pnpm check` passed.
- Focused assistant and tool tests passed: 70/70.
- `cargo check --offline` passed.
- `git diff --check` passed.
- The focused Rust test invocation was attempted, but Cargo could not replace `src-tauri/target/debug/still-desktop.exe` because the active native preview holds it open. The preview was left running.
- Full suite differential from the preceding PDF increment: baseline had 50 failures out of 487 tests; current had 50 failures out of 491. This supports no increase in the failure count, but the exact failed test names were not exhaustively compared. The full current run was stopped after a later serial test stalled without output.
- This focused catalog change was not separately validated in the native UI. It does not change UI rendering or saved workspace data.

## Remaining

The complete agent robustness effort remains in progress. PDF number selection and calculations still lack native validation with a safe local PDF fixture; scanned-image OCR is not implemented. Full-suite failures need a proper differential audit and resolution where they represent current behavior rather than stale test expectations.
