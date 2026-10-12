use serde::Serialize;
use tauri::Webview;

#[derive(Clone, Copy, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartupStatus {
    pub supported: bool,
    pub enabled: bool,
}

#[cfg(windows)]
const RUN_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
#[cfg(windows)]
const VALUE_NAME: &str = "Still";

#[cfg(windows)]
fn current_executable() -> Result<std::path::PathBuf, String> {
    std::env::current_exe().map_err(|error| format!("Unable to locate Still: {error}"))
}

#[cfg(windows)]
fn startup_target_matches(command: &str, executable: &std::path::Path) -> bool {
    let value = command.trim();
    let target = if let Some(quoted) = value.strip_prefix('"') {
        quoted.split_once('"').map(|(path, _)| path).unwrap_or(quoted)
    } else {
        value.split_whitespace().next().unwrap_or("")
    };
    !target.is_empty() && target.eq_ignore_ascii_case(&executable.to_string_lossy())
}

#[cfg(windows)]
fn status() -> Result<StartupStatus, String> {
    // A dev build depends on its Vite server, so it must never register itself
    // as a Windows sign-in application.
    if cfg!(debug_assertions) {
        return Ok(StartupStatus { supported: false, enabled: false });
    }
    use winreg::{enums::HKEY_CURRENT_USER, RegKey};
    let current_user = RegKey::predef(HKEY_CURRENT_USER);
    let key = match current_user.open_subkey(RUN_KEY) {
        Ok(key) => key,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Ok(StartupStatus { supported: true, enabled: false });
        }
        Err(error) => return Err(format!("Unable to read Windows startup settings: {error}")),
    };
    let registered: Result<String, _> = key.get_value(VALUE_NAME);
    let enabled = match registered {
        Ok(command) => startup_target_matches(&command, &current_executable()?),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => false,
        Err(error) => return Err(format!("Unable to read Still's startup setting: {error}")),
    };
    Ok(StartupStatus { supported: true, enabled })
}

#[cfg(not(windows))]
fn status() -> Result<StartupStatus, String> {
    Ok(StartupStatus::default())
}

#[tauri::command]
pub fn startup_status(webview: Webview) -> Result<StartupStatus, String> {
    crate::security::authorize(&webview)?;
    status()
}

#[tauri::command]
pub fn startup_set(webview: Webview, enabled: bool) -> Result<StartupStatus, String> {
    crate::security::authorize(&webview)?;
    #[cfg(windows)]
    {
        if cfg!(debug_assertions) {
            return Err("Launch at sign-in is available in the installed Still app.".into());
        }
        use winreg::{enums::{HKEY_CURRENT_USER, KEY_SET_VALUE}, RegKey};
        let current_user = RegKey::predef(HKEY_CURRENT_USER);
        let (key, _) = current_user
            .create_subkey_with_flags(RUN_KEY, KEY_SET_VALUE)
            .map_err(|error| format!("Unable to update Windows startup settings: {error}"))?;
        if enabled {
            let executable = current_executable()?;
            let command = format!("\"{}\"", executable.display());
            key.set_value(VALUE_NAME, &command)
                .map_err(|error| format!("Unable to enable Still at sign-in: {error}"))?;
        } else if let Ok(command) = key.get_value::<String, _>(VALUE_NAME) {
            // Do not remove a startup registration belonging to another Still install.
            if startup_target_matches(&command, &current_executable()?) {
                key.delete_value(VALUE_NAME)
                    .map_err(|error| format!("Unable to disable Still at sign-in: {error}"))?;
            }
        }
    }
    #[cfg(not(windows))]
    if enabled {
        return Err("Launch at sign-in is available on Windows only.".into());
    }
    status()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(windows)]
    #[test]
    fn startup_value_matches_only_the_executable_not_a_neighbor_or_argument() {
        let executable = std::path::Path::new(r"C:\Program Files\Still\Still.exe");
        assert!(startup_target_matches(r#""C:\Program Files\Still\Still.exe" --startup"#, executable));
        assert!(startup_target_matches(r#""c:\program files\still\still.exe""#, executable));
        assert!(!startup_target_matches(r#""C:\Program Files\Still\Still Beta.exe""#, executable));
        assert!(!startup_target_matches(r#""C:\Program Files\Other\Still.exe""#, executable));
    }
}
