# Still AI assistant

Still AI is one chat panel available from the sidebar. It supports Gemini and OpenAI API models. The selected model is shown in the composer footer and its provider/model preference is saved locally. API keys stay in Rust memory until Still closes; they are never saved to layouts, frontend storage, chat history, or logs. `GEMINI_API_KEY` and `OPENAI_API_KEY` can initialize their respective providers at launch.

## Use

1. Open **AI assistant** from the sidebar. Open the settings button, choose Gemini or OpenAI, and connect that provider's API key once for the current Still session. Gemini keys come from Google AI Studio. OpenAI API access requires a separate API key and is billed independently of a ChatGPT subscription.
2. Pick an available model in the selector at the bottom of the chat. The choice is remembered locally across workspace changes and restarts.
3. Chat normally to ask questions or request a layout. Still always sends workspace dimensions, widget names, IDs, geometry and minimum sizes so the assistant can propose a layout. The proposal is validated and shown for review; **Apply layout** changes positions and **Undo layout** restores the previous state.
4. Type `@` to open a picker containing all workspace widget names. Select one or **All widgets** to share their supported text/metadata with the current message. Repeated `@` mentions can add several widgets. Content is shared only for widgets explicitly selected. Notes and timetables share bounded text/entries; Focus shares timer state; other widgets provide metadata. Gemini can optionally receive a visible screenshot when one attached app, calculator or Files widget is selected. Screenshot sharing is not yet supported for OpenAI.

The browser preview exposes the UI but does not send AI requests or accept keys. Native transport requires the trusted main webview; remote child webviews cannot access AI commands. Messages and proposals live in memory for the current workspace session. Switching workspaces clears them; closing/reopening the assistant in the same workspace retains them. No AI requests run automatically.

## Safety and limits

- Tauri uses fixed provider HTTPS endpoints, no redirects, bounded requests/responses, and provider-specific errors. It does not accept arbitrary base URLs.
- Widget text, names, images and model replies are untrusted data. The assistant cannot execute code, open files/URLs, create/delete widgets or switch workspaces.
- Layout proposals must include every expanded widget exactly once and pass ID, integer geometry, minimum size, edge, overlap, workspace fingerprint and canvas-size checks before application.
- Only explicitly @-selected widget content is sent. The complete workspace's positional metadata is sent so arrangement prompts work in the same chat. Attached native windows and file contents are not read except a user-selected Gemini screenshot of an eligible visible widget.
- OpenAI model discovery filters the account's available models to chat-capable `gpt-` IDs. OpenAI screenshot support and persistent secure credential storage are not implemented. Keys must be re-entered after Still closes unless supplied through the respective environment variable.

## Verification

Run `pnpm check`, `pnpm test`, and `cargo test --manifest-path src-tauri/Cargo.toml assistant -- --test-threads=1`. Native AI requests require a user-provided provider key and should be tested manually on Windows; automated tests use local mock HTTP servers and never call provider APIs or use real credentials.
