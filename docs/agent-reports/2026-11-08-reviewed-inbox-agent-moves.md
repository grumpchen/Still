# Task: Reviewed inbox moves in the Still agent

- Agent: Codex, GPT-6.1 Sol
- Time: 2026-11-08T16:50:00+13:00

## Done
- Added a reviewed batch move tool that passes real execution receipts back into the existing provider loop.
- Added native root and source revision checks for reviewed inbox moves. The destination must still exist and the move cannot overwrite another file.
- Made each approval and continuation single use. Kept the existing final-answer proposal route for compatibility.

## Files
- Assistant panel and provider adapter, inbox review domain, native provider protocol and file commands, focused tests.

## Checks
- TypeScript passed. Mocked ChatGPT and OpenAI flows both reviewed a move, received its actual result, and continued to a separate widget review.
- Windows Rust binary test suite: 134 passed, including same-size source edit, wrong root, absent destination, and real file move cases.

## Handoff
- See the separate agent reliability verification report for the integrated Luna changes and live-provider and desktop acceptance status.
