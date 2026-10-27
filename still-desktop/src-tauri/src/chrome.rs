use std::path::PathBuf;
use tauri::Webview;

fn profile_directory_from_local_state(bytes: &[u8]) -> Option<String> {
    let state: serde_json::Value = serde_json::from_slice(bytes).ok()?;
    let profile = state.get("profile")?;
    let selected = profile.get("last_used")?.as_str()?;
    if selected.is_empty() || selected == "." || selected == ".." || selected.contains('/') || selected.contains('\\') {
        return None;
    }
    profile.get("info_cache")?.get(selected)?;
    Some(selected.to_owned())
}

pub(crate) fn last_used_profile_directory() -> Option<String> {
    let root = PathBuf::from(std::env::var_os("LOCALAPPDATA")?).join(r"Google\Chrome\User Data");
    let bytes = std::fs::read(root.join("Local State")).ok()?;
    let selected = profile_directory_from_local_state(&bytes)?;
    root.join(&selected).is_dir().then_some(selected)
}

pub(crate) fn website(value: &str) -> Result<String, String> {
    if value.len() > 4096 { return Err("Website address is too long".into()); }
    let url = url::Url::parse(value).map_err(|_| "Enter a valid website address")?;
    if url.scheme() != "https" || url.host_str().is_none() || !url.username().is_empty() || url.password().is_some() {
        return Err("Use an HTTPS website without embedded credentials".into());
    }
    Ok(url.to_string())
}

#[cfg(target_os = "windows")]
pub(crate) fn executable() -> Result<PathBuf, String> {
    use winreg::{RegKey, enums::*};
    for hive in [HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE] {
        for flags in [KEY_READ | KEY_WOW64_64KEY, KEY_READ | KEY_WOW64_32KEY] {
            if let Ok(key) = RegKey::predef(hive).open_subkey_with_flags(r"Software\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe", flags) {
                if let Ok(value) = key.get_value::<String, _>("") {
                    let path = PathBuf::from(value.trim().trim_matches('"'));
                    if path.is_file() { return Ok(path); }
                }
            }
        }
    }
    for base in ["LOCALAPPDATA", "PROGRAMFILES", "PROGRAMFILES(X86)"] {
        if let Some(root) = std::env::var_os(base) {
            let path = PathBuf::from(root).join(r"Google\Chrome\Application\chrome.exe");
            if path.is_file() { return Ok(path); }
        }
    }
    Err("Google Chrome was not found. Install Chrome and try again.".into())
}

#[tauri::command]
pub async fn chrome_open(webview: Webview, url: String) -> Result<(), String> {
    crate::security::authorize(&webview)?;
    let destination = website(&url)?;
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let mut command = std::process::Command::new(executable()?);
        if let Some(profile) = last_used_profile_directory() {
            command.arg(format!("--profile-directory={profile}"));
        }
        command.arg("--new-window").arg(destination).creation_flags(0x08000000)
            .spawn().map_err(|e| format!("Unable to open Chrome in the last-used profile: {e}"))?;
        Ok(())
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("/usr/bin/open").args(["-a", "Google Chrome", &destination])
            .spawn().map_err(|e| format!("Unable to open Chrome: {e}"))?;
        Ok(())
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    { let _ = destination; Err("Chrome launching is supported on Windows and macOS.".into()) }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn selects_only_a_profile_directory_present_in_chrome_local_state() {
        let state = br#"{"profile":{"last_used":"Default","info_cache":{"Default":{"name":"grump"},"Profile 3":{"name":"stephen"}}}}"#;
        assert_eq!(profile_directory_from_local_state(state).as_deref(), Some("Default"));
        let missing = br#"{"profile":{"last_used":"Profile 9","info_cache":{"Default":{"name":"grump"}}}}"#;
        assert_eq!(profile_directory_from_local_state(missing), None);
        let traversal = br#"{"profile":{"last_used":"../Default","info_cache":{"../Default":{"name":"unsafe"}}}}"#;
        assert_eq!(profile_directory_from_local_state(traversal), None);
    }
    #[test] fn accepts_only_website_arguments() {
        assert_eq!(website("https://learn.canterbury.ac.nz/").unwrap(), "https://learn.canterbury.ac.nz/");
        for value in ["--incognito", "javascript:alert(1)", "file:///c:/secret", "http://example.com", "https://u:p@example.com", "https://"] { assert!(website(value).is_err(), "{value}"); }
        assert!(website(&"x".repeat(4097)).is_err());
        assert!(website("https://example.com/?q=%22%20--incognito").is_ok());
    }
}
