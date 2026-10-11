# App attachment and shutdown preferences

## Behavior

- App attachments save a reusable Apps tray shortcut by default. The existing **Save app to tray** checkbox remains available as a one-attachment override. The same preference applies to Attach Open App and Ctrl+Shift capture.
- General settings persist the default shortcut choice and the action to take when Still closes.
- The shutdown choices are **Minimize attached apps**, **Close attached app windows**, and **Leave attached apps open**. Leaving apps open remains the default and preserves the existing restore behavior.

## Lifecycle

Rust continues to own HWND/PID identity and restoration. The frontend sends the saved shutdown preference through an authorized Tauri command; the existing main-window close hook applies it to the exact managed windows. Every path first releases the app window's Still ownership and restores its original placement and region. Minimize then minimizes that window. Close posts the normal Windows `WM_CLOSE` request, allowing the application to ask about unsaved work. Leave open stops after restoration.

Automatic shortcut saving uses the existing app grant and saved preset flow. Ctrl+Shift capture prepares the same reusable grant when the preference is enabled; if preparation fails, attachment still proceeds and Still reports that the shortcut was not saved.

## Verification boundary

Automated settings persistence, picker defaults, native shutdown action, and existing workspace behavior are covered by frontend and Rust tests. These checks do not verify live third-party app prompts or visual behavior after Still closes; those require manual Windows acceptance.
