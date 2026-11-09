# Task: Speed up HTML preview transport

- Agent: Codex
- Time: 2026-11-09T16:57:00+13:00

## Done
- HTML and other UTF-8 text previews now travel from Rust to the frontend as text, avoiding Base64 expansion and the frontend's byte-by-byte decode loop. Binary previews retain the existing Base64 path.
- HTML uses the direct text API for both automatic and manual preview. The existing 20 MiB cap, UTF-8 validation, and isolated iframe behavior remain.
- Kept the on-demand/automatic preference behavior and added an assertion that automatic preview clears loading after direct text arrives.

## Files
- `still-desktop/src-tauri/src/files.rs`
- `still-desktop/src/platform/files.ts`
- `still-desktop/src/NotesLibraryExplorer.tsx`
- `still-desktop/tests/notes-library-explorer-folders.test.mjs`

## Checks
- Baseline conversion microbenchmark on synthetic HTML: 1 MiB Base64 decode+Blob 6.0 ms vs direct text Blob 1.0 ms; 5 MiB 17.7 ms vs 4.9 ms; 20 MiB 74.3 ms vs 19.7 ms (median of five local runs; not end-to-end app timing).
- `pnpm check` — passed.
- `pnpm build` — passed; Vite reported the existing large-chunk advisory.
- Files Explorer focused tests — 5 passed.
- Rust `previews_only_allowlisted_types_with_a_bounded_size` — passed.

## Handoff
- The user's original slow report was not captured with an end-to-end file-size/timing trace. The measured Base64 decoding was a confirmed avoidable cost and is removed for text previews; total iframe/render time can still depend on HTML page scripts and resources.
