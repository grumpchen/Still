use tauri::Webview;

/// Permit privileged commands only from Still's local UI or configured dev server.
pub(crate) fn authorize(caller: &Webview) -> Result<(), String> {
    if caller.label() != "main" { return Err("Only the local workspace can use this command".into()); }
    let url = caller.url().map_err(|error| error.to_string())?;
    let local_asset = url.scheme() == "tauri" || url.host_str() == Some("tauri.localhost");
    let dev_asset = cfg!(debug_assertions) && url.host_str() == Some("127.0.0.1") && url.port() == Some(4318);
    if !local_asset && !dev_asset { return Err("This command requires the trusted app surface".into()); }
    Ok(())
}
