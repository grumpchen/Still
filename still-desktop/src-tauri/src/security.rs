use tauri::Webview;

fn is_trusted_surface(
    scheme: &str,
    host: Option<&str>,
    port: Option<u16>,
    fixture_port: Option<u16>,
    debug: bool,
) -> bool {
    let local_asset = scheme == "tauri" || host == Some("tauri.localhost");
    let dev_asset = debug
        && host == Some("127.0.0.1")
        && (port == Some(4318) || fixture_port.is_some_and(|allowed| port == Some(allowed)));
    local_asset || dev_asset
}

/// Permit privileged commands only from Still's local UI or configured dev server.
pub(crate) fn authorize(caller: &Webview) -> Result<(), String> {
    if caller.label() != "main" {
        return Err("Only the local workspace can use this command".into());
    }
    let url = caller.url().map_err(|error| error.to_string())?;
    let fixture_port = std::env::var("STILL_FIXTURE_TRUSTED_DEV_PORT")
        .ok()
        .and_then(|value| value.parse::<u16>().ok());
    if !is_trusted_surface(
        url.scheme(),
        url.host_str(),
        url.port(),
        fixture_port,
        cfg!(debug_assertions),
    ) {
        return Err("This command requires the trusted app surface".into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::is_trusted_surface;

    #[test]
    fn development_privileges_are_limited_to_known_loopback_origins() {
        assert!(is_trusted_surface("tauri", None, None, None, false));
        assert!(is_trusted_surface(
            "https",
            Some("tauri.localhost"),
            None,
            None,
            false
        ));
        assert!(is_trusted_surface(
            "http",
            Some("127.0.0.1"),
            Some(4318),
            None,
            true
        ));
        assert!(is_trusted_surface(
            "http",
            Some("127.0.0.1"),
            Some(54321),
            Some(54321),
            true
        ));
        assert!(!is_trusted_surface(
            "http",
            Some("127.0.0.1"),
            Some(54322),
            Some(54321),
            true
        ));
        assert!(!is_trusted_surface(
            "http",
            Some("localhost"),
            Some(54321),
            Some(54321),
            true
        ));
        assert!(!is_trusted_surface(
            "http",
            Some("127.0.0.1"),
            Some(54321),
            Some(54321),
            false
        ));
    }
}
