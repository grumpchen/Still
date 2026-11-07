# Still ChatGPT Plan Implementation Plan

**Goal** Let Still's Windows assistant use an eligible ChatGPT subscription after explicit browser sign-in.

**Architecture** Use the existing OAuth validation scaffold and a loopback listener in Tauri. Store one selected registration in a Windows DPAPI-protected record. Translate Still's bounded agent protocol to namespaced Responses tools and reuse its workspace validators and approval UI.

**Tech stack** Rust, Tauri, Tokio, Windows DPAPI, React, and the public OpenAI Responses API.

1. Finish the native sign-in, refresh, and sign-out lifecycle. Keep OAuth tokens entirely in the Rust process and its encrypted store. Verify callback matching and account identity.
2. Add the ChatGPT plan model list and Responses transport. Replay local tool receipts by call ID and accept only a completed stream. Check request fields and response parsing with synthetic fixtures.
3. Add ChatGPT plan to assistant settings and wire it to the existing agent loop. Verify command permissions, provider routing, type checking, and production build.
4. Launch the Windows preview for browser consent and one synthetic inference. Record which checks require a signed-in eligible account.
