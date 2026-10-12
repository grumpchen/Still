# Gemini sidebar

The sidebar AI button opens a dedicated Gemini panel alongside the canvas. This is a desktop integration, using Gemini 2.5 Flash by default; Flash-Lite is selectable. Google currently lists free-tier access for both models, subject to project eligibility, regional availability, quotas, and its data-use terms. Still does not enable billing or automatically switch providers/models.

## Use

1. Build and open Still on Windows. Click **AI assistant** in the sidebar (or use the command palette).
2. Open **AI settings**, follow **Google AI Studio**, and create a key for a free-tier project. Enter it in Still's password field and choose **Connect key**. Never put a key in an AI chat message.
3. **Chat** sends your message and up to six recent conversation pairs. By default no widget contents are shared.
4. **Read widget** shares only the selected widget's bounded text/metadata. Notes and timetables have structured content; attached app/browser/calculator/file windows need the optional **Include visible screenshot** to read visible contents. Bring the whole widget into the visible canvas first. Capture failures stop the request rather than silently omitting the image.
5. **Arrange layout** sends names, IDs, geometry, minimum sizes, and canvas dimensions. Review the map, then **Apply layout**. **Undo layout** or Ctrl+Z restores the previous state. Layouts do not add/delete widgets, edit contents, or switch workspaces.

The browser preview exposes the UI and disables live API requests/key entry. The native transport requires the trusted main webview; remote child webviews cannot access AI commands. Keys stay in Rust memory until forgotten or Still exits. A `GEMINI_API_KEY` environment variable can initialize that memory at launch. No frontend bundle, layout, chat history, screenshot, file, or log stores the credential. There is no persistent key vault in this first implementation.

Messages and proposals live only in memory for the current workspace session. Switching workspaces clears them; closing/reopening the panel in the same workspace retains them. Screenshots are prepared only on Send, resized to a maximum 1280px edge, transmitted once as JPEG, and never kept in chat history/storage. Native captures may contain overlapping visible content; review what is visible before sending. Google may use free-tier inputs to improve its products.

## Implementation

- Tauri handles Gemini `generateContent` requests over HTTPS with a header credential, no redirects, a 45-second timeout, bounded input/output, and no automatic retries.
- The backend requests schema-constrained JSON and separates chat/read modes from layout proposals. Provider errors surface as safe messages, including quota/rate limits.
- Widget content is untrusted data. There is no code execution, arbitrary file access, URL opening by model output, or tool loop.
- The frontend validates the entire proposed layout before changing state: exact expanded widget membership, unique IDs, finite integer geometry, native app minima, edge bounds, and no overlap (including minimized cards).
- Applying a proposal verifies its originating workspace, widget geometry/minimum-size fingerprint, and canvas dimensions again. Content edits are preserved; geometry changes require a fresh proposal. A single state transition applies all placements and records undo.
- Opening the panel reduces the available canvas width; existing canvas bounds handling still applies. Dense layouts may not fit the viewport and Gemini can decline rather than overlap or discard widgets.

## Acceptance on Windows

- Run `pnpm test`, `pnpm build`, and `cargo test --manifest-path src-tauri/Cargo.toml`; note the six existing frontend failures documented in the task report.
- Run `pnpm tauri build --no-bundle` and open the built executable; no release executable is created/committed as part of this task.
- Connect a free-tier Gemini key and send one short chat. Verify the reply and use **Forget key**.
- Read a note, then explicitly share a fully visible attached app or Chrome screenshot. Test an off-canvas/minimized widget and a failed screenshot.
- Request a sparse layout, apply it, undo it, and check notes/timers/native attachments survive. Change a widget or resize the app while a proposal is pending and confirm it cannot apply.
- Verify quota errors retain the draft, native screenshot reading stays scoped to the chosen widget, and no requests run on startup/workspace changes. Check a child browser cannot invoke `assistant_set_key` or `assistant_chat`.

API references: https://ai.google.dev/gemini-api/docs/pricing and https://ai.google.dev/gemini-api/docs/structured-output. No live AI requests or credentials were used during cloud verification.
