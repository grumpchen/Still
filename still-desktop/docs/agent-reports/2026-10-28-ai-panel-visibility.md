# AI assistant visibility repair

- The assistant panel state and provider were healthy: the Still UI showed OpenCode Go connected and DeepSeek V4.1 Flash selected.
- Root cause: the page-like canvas rule forced `.canvas-app` to one grid column with `!important`. This overrode the assistant-open grid rules, placing the assistant panel outside the visible window.
- Added an assistant-open grid override with a 360 px side panel (310 px below 1000 px viewport width), while keeping the canvas full-width with its overlay sidebar.
- Corrected the topbar sidebar label to reflect the actual peek state.
- Verification: `pnpm check` passed. In the live desktop preview, removed attached note context, sent the generic prompt `Connectivity check: reply exactly OK.`, and observed Still AI reply `OK`.
