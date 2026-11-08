# Task: Diagnose the bulk file move error in live preview

- Agent: Codex
- Time: 2026-11-08T15:21:28+13:00

## Done
- Traced the error to an old Vite process serving the Notes Library checkout on port 4318. The native preview executable came from the bulk file fix checkout, but its launch override disabled Tauri's frontend startup command, so the app loaded the older frontend.
- Stopped the stale server and relaunched Vite and the native preview from the bulk file fix checkout.

## Files
- This report only. No application code changed.

## Checks
- Before the restart, an HTTP request for the served assistant parser returned the reported error string and the five-proposal limit.
- After the restart, the same request returned the 100-proposal validator. The Vite command line and the Still window's executable path both pointed to the fix checkout.

## Handoff
- The live provider request was not replayed. The check verified the running frontend and native executable.
