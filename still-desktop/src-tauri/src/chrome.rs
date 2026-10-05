use std::path::PathBuf;
use tauri::Webview;

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
    crate::browser::authorize(&webview)?;
    let destination = website(&url)?;
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        // Only a URL is passed: Chrome selects its normal profile and forwards to its
        // existing process. No profile, private-window or new-window flags are used.
        std::process::Command::new(executable()?).arg(destination).creation_flags(0x08000000)
            .spawn().map_err(|e| format!("Unable to open Chrome: {e}"))?;
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
    #[test] fn accepts_only_website_arguments() {
        assert_eq!(website("https://learn.canterbury.ac.nz/").unwrap(), "https://learn.canterbury.ac.nz/");
        for value in ["--incognito", "javascript:alert(1)", "file:///c:/secret", "http://example.com", "https://u:p@example.com", "https://"] { assert!(website(value).is_err(), "{value}"); }
        assert!(website(&"x".repeat(4097)).is_err());
        assert!(website("https://example.com/?q=%22%20--incognito").is_ok());
    }
}
