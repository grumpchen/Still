# Still Agent Runtime Implementation Plan

**Goal:** Give Still a conversational, tool-using assistant that can remember user-approved context and report real outcomes.

**Architecture:** Keep the model provider separate from a bounded runtime and a registry of typed Still operations. The runtime sends tool results back to the model, validates each call, and stops on errors, cancellation, ambiguity, or budget exhaustion. The existing application owns state mutations and approvals; no native Windows control is implied. User-managed local memory is data, not privileged instructions.

**Tech stack:** React, TypeScript, Tauri/Rust, local storage, Node tests and Playwright.

## Delivery stages

1. **Memory foundation:** Store explicit user-provided memories locally, add controls to inspect and delete them, and include bounded memory in model context. Test persistence, malformed input, limits, privacy, and deletion. Never silently invent memories or store credentials.
2. **Runtime foundation:** Implement and test a bounded model/tool loop with typed tool calls, success and error results, cancellation and maximum steps. It must not claim a failed action succeeded. Keep it separate from UI and provider-specific protocols.
3. **Still tools and integration:** Adapt existing validated workspace actions into tools backed by the same application operations as UI controls. Refresh state between steps, preserve destructive action confirmations and undo, handle ambiguous targets, concurrent changes, and partial failure. Replace duplicate hard-coded paths only after equivalent regression coverage.
4. **Provider adapters and user experience:** Provide a conversational provider interface with streaming/progress and cancellation. Maintain chat history independently of durable memories, enable users to inspect/clear both, and avoid silently sending selected file content or memory to a different provider.
5. **Codex option:** Investigate the official Sign in with ChatGPT open-source flow and Codex app-server transport, eligibility, OAuth registration, token refresh, account selection and authorization; do not extract or reuse credentials from other apps. Only enable after a successful end-to-end integration and user sign-in. Plan/model entitlement must be verified by the provider, not inferred from a saved token or model list.
6. **Acceptance:** Evaluate conversational requests, explicit memory, ambiguity, creating three notes, timetable lookup, multi-step actions, failed tools, changing state mid-turn, destructive actions, cancellation, restarts, and provider failures. Verify in a native desktop instance with disposable test data; record unsupported operations and real outcomes.

## Current scope and boundaries

The memory and loop foundations can be developed independently. The standalone loop is not a functioning agent until a provider adapter and Still tool registry are integrated. The existing assistant continues to operate during incremental migration. All changes preserve existing workspaces, credentials and unrelated uncommitted work.

Official references: https://developers.openai.com/siwc/quickstart and https://developers.openai.com/siwc/token-sharing-open-source/codex-app-server .
