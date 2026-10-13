use serde::{Deserialize, Serialize};
use std::{collections::HashMap, fs, path::{Path, PathBuf}, sync::Mutex};
use tauri::{AppHandle, DragDropEvent, Emitter, Manager, State, Webview, Window};
use tauri_plugin_dialog::DialogExt;

/// Exact document grants come only from the OS drop handler or a native picker.
/// Folder grants stay in FolderRoots so existing Files widgets can reuse them.
pub struct DocumentGrants(Mutex<HashMap<String, PathBuf>>);
impl DocumentGrants {
    pub fn load(app: &AppHandle) -> Self {
        let grants = app.path().app_data_dir().ok()
            .and_then(|directory| read_grants(&directory.join("document-shortcuts.json")).ok())
            .unwrap_or_default();
        Self(Mutex::new(grants))
    }
    fn register(&self, id: &str, path: &Path) -> Result<DropEntry, String> {
        crate::files::valid_id(id)?;
        let (path, mut entry) = classify(path)?;
        if !matches!(entry.kind.as_str(), "pdf" | "document") { return Err("Choose a document rather than an app, folder or website shortcut".into()); }
        self.0.lock().map_err(|_| "Document shortcuts are unavailable")?.insert(id.into(), path);
        entry.source_id = Some(id.into());
        Ok(entry)
    }
    fn target(&self, id: &str) -> Result<PathBuf, String> {
        crate::files::valid_id(id)?;
        let selected = self.0.lock().map_err(|_| "Document shortcuts are unavailable")?
            .get(id).cloned().ok_or("Choose the document again to reconnect its shortcut.")?;
        let (current, entry) = classify(&selected)?;
        if current != selected || !matches!(entry.kind.as_str(), "pdf" | "document") {
            return Err("This shortcut has changed. Choose the document again to reconnect it.".into());
        }
        Ok(current)
    }
    fn persist(&self, directory: &Path) -> Result<(), String> {
        let grants = self.0.lock().map_err(|_| "Document shortcuts are unavailable")?;
        fs::create_dir_all(directory).map_err(|error| error.to_string())?;
        fs::write(directory.join("document-shortcuts.json"), serde_json::to_vec(&*grants).map_err(|error| error.to_string())?)
            .map_err(|error| error.to_string())
    }
}

/// App shortcuts have a separate grant registry and can only launch after an
/// explicit Open action. Classification and receiving a drop never execute apps.
pub struct AppGrants(Mutex<HashMap<String, PathBuf>>);
impl AppGrants {
    pub fn load(app: &AppHandle) -> Self {
        let grants = app.path().app_data_dir().ok()
            .and_then(|directory| read_grants(&directory.join("app-shortcuts.json")).ok())
            .unwrap_or_default();
        Self(Mutex::new(grants))
    }
    pub(crate) fn register(&self, id: &str, path: &Path) -> Result<DropEntry, String> {
        crate::files::valid_id(id)?;
        let (path, mut entry) = classify(path)?;
        if entry.kind != "app" { return Err("Choose a Windows .exe app or .lnk app shortcut".into()); }
        self.0.lock().map_err(|_| "App shortcuts are unavailable")?.insert(id.into(), path);
        entry.source_id = Some(id.into());
        Ok(entry)
    }
    pub(crate) fn target(&self, id: &str) -> Result<PathBuf, String> {
        crate::files::valid_id(id)?;
        let selected = self.0.lock().map_err(|_| "App shortcuts are unavailable")?
            .get(id).cloned().ok_or("Choose the app again to reconnect its shortcut.")?;
        let (current, entry) = classify(&selected)?;
        if current != selected || entry.kind != "app" {
            return Err("This app shortcut has changed. Choose the app again to reconnect it.".into());
        }
        Ok(current)
    }
    pub(crate) fn persist(&self, directory: &Path) -> Result<(), String> {
        let grants = self.0.lock().map_err(|_| "App shortcuts are unavailable")?;
        fs::create_dir_all(directory).map_err(|error| error.to_string())?;
        fs::write(directory.join("app-shortcuts.json"), serde_json::to_vec(&*grants).map_err(|error| error.to_string())?)
            .map_err(|error| error.to_string())
    }
}

fn read_grants(path: &Path) -> Result<HashMap<String, PathBuf>, String> {
    let bytes = fs::read(path).map_err(|error| error.to_string())?;
    if bytes.len() > 1_000_000 { return Err("The shortcut registry is too large".into()); }
    let grants: HashMap<String, PathBuf> = serde_json::from_slice(&bytes).map_err(|error| error.to_string())?;
    Ok(grants.into_iter().filter(|(id, path)| crate::files::valid_id(id).is_ok() && path.is_absolute()).collect())
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DropEntry {
    pub source_id: Option<String>,
    pub name: String,
    pub kind: String,
    pub extension: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DropPosition { x: f64, y: f64 }
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DropPayload {
    phase: &'static str,
    position: Option<DropPosition>,
    entries: Vec<DropEntry>,
    errors: Vec<String>,
}

pub(crate) fn classify(path: &Path) -> Result<(PathBuf, DropEntry), String> {
    let name = path.file_name().map(|name| name.to_string_lossy().into_owned()).unwrap_or_else(|| "Dropped item".into());
    let canonical = path.canonicalize().map_err(|_| format!("{name}: this file or folder is no longer available."))?;
    let metadata = fs::metadata(&canonical).map_err(|_| format!("{name}: this file or folder cannot be read."))?;
    // Check file suffixes on both the original path and canonical target.
    // A folder whose name happens to end in .app or .url is still a folder.
    let internet_shortcut = path.extension().and_then(|extension| extension.to_str()).is_some_and(|extension| extension.eq_ignore_ascii_case("url"));
    let app_shortcut = app_suffix(path);
    if metadata.is_file() && crate::files::blocked(path) && !internet_shortcut && !app_shortcut {
        return Err(format!("{name}: scripts and installer files are not supported. Choose a document, folder, .exe app or .lnk shortcut."));
    }
    let extension = canonical.extension().and_then(|value| value.to_str()).unwrap_or("").to_ascii_lowercase();
    if internet_shortcut && metadata.is_file() {
        if !metadata.is_file() || extension != "url" { return Err(format!("{name}: choose a regular Internet Shortcut file.")); }
        let url = internet_shortcut_url(&canonical)?;
        let title = path.file_stem().map(|name| name.to_string_lossy().into_owned()).unwrap_or_else(|| "Website".into());
        return Ok((canonical, DropEntry { source_id: None, name: title, kind: "website".into(), extension, url: Some(url) }));
    }
    if app_shortcut && metadata.is_file() {
        if !app_suffix(&canonical) { return Err(format!("{name}: this app shortcut points to an unsupported file type.")); }
        let title = path.file_stem().map(|name| name.to_string_lossy().into_owned()).unwrap_or_else(|| "App".into());
        return Ok((canonical, DropEntry { source_id: None, name: title, kind: "app".into(), extension, url: None }));
    }
    if metadata.is_file() && crate::files::blocked(&canonical) {
        return Err(format!("{name}: this file type cannot be opened from Still."));
    }
    let kind = if metadata.is_dir() { "folder" } else if metadata.is_file() {
        if extension == "pdf" { "pdf" } else { "document" }
    } else { return Err(format!("{name}: drop a regular file or folder.")); };
    Ok((canonical, DropEntry { source_id: None, name, kind: kind.into(), extension, url: None }))
}

fn app_suffix(path: &Path) -> bool {
    matches!(path.extension().and_then(|extension| extension.to_str()).unwrap_or("").to_ascii_lowercase().as_str(), "exe" | "lnk")
}

fn internet_shortcut_url(path: &Path) -> Result<String, String> {
    use std::io::Read;
    let mut bytes = Vec::new();
    fs::File::open(path).map_err(|_| "The website shortcut cannot be read")?.take(16_385)
        .read_to_end(&mut bytes).map_err(|_| "The website shortcut cannot be read")?;
    if bytes.len() > 16_384 { return Err("The website shortcut is too large".into()); }
    let text = if bytes.starts_with(&[0xff, 0xfe]) {
        if bytes.len() % 2 != 0 { return Err("The website shortcut has invalid text".into()); }
        let words: Vec<u16> = bytes[2..].chunks_exact(2).map(|word| u16::from_le_bytes([word[0], word[1]])).collect();
        String::from_utf16(&words).map_err(|_| "The website shortcut has invalid text")?
    } else {
        String::from_utf8(bytes).map_err(|_| "The website shortcut has invalid text")?.trim_start_matches('\u{feff}').to_owned()
    };
    let mut in_shortcut = false;
    for line in text.lines() {
        let line = line.trim();
        if line.starts_with('[') && line.ends_with(']') { in_shortcut = line.eq_ignore_ascii_case("[InternetShortcut]"); continue; }
        if !in_shortcut { continue; }
        let Some((key, value)) = line.split_once('=') else { continue; };
        if !key.trim().eq_ignore_ascii_case("URL") { continue; }
        let value = value.trim();
        if value.len() > 4096 { return Err("The website address is too long".into()); }
        let url = url::Url::parse(value).map_err(|_| "The website shortcut has an invalid address")?;
        if url.scheme() != "https" || url.host_str().is_none() || !url.username().is_empty() || url.password().is_some() {
            return Err("Save an HTTPS website shortcut without embedded credentials.".into());
        }
        return Ok(url.to_string());
    }
    Err("The Internet Shortcut has no website address.".into())
}

pub(crate) fn source_id() -> Result<String, String> {
    #[cfg(windows)] {
        let guid = unsafe { windows::Win32::System::Com::CoCreateGuid() }.map_err(|error| error.to_string())?;
        Ok(format!("file-{:032x}", guid.to_u128()))
    }
    #[cfg(not(windows))] {
        use std::sync::atomic::{AtomicU64, Ordering};
        static COUNTER: AtomicU64 = AtomicU64::new(0);
        let timestamp = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_err(|error| error.to_string())?.as_nanos();
        Ok(format!("file-{timestamp:x}-{:x}-{:x}", std::process::id(), COUNTER.fetch_add(1, Ordering::Relaxed)))
    }
}

fn entries_for_drop(paths: &[PathBuf], documents: &DocumentGrants, folders: &crate::files::FolderRoots, apps: &AppGrants) -> (Vec<DropEntry>, Vec<String>) {
    let mut entries = Vec::new();
    let mut errors = Vec::new();
    for path in paths.iter().take(100) {
        let result = (|| {
            let (canonical, mut entry) = classify(path)?;
            if entry.kind == "website" { return Ok(entry); }
            let id = source_id()?;
            if entry.kind == "folder" {
                folders.register_drop(&id, &canonical)?;
                entry.source_id = Some(id);
                Ok(entry)
            } else if entry.kind == "app" { apps.register(&id, &canonical) }
            else { documents.register(&id, &canonical) }
        })();
        match result { Ok(entry) => entries.push(entry), Err(error) => errors.push(error) }
    }
    if paths.len() > 100 { errors.push("Drop at most 100 files or folders at a time.".into()); }
    (entries, errors)
}

/// Called only by Tauri's native window event callback, never by a frontend command.
pub fn handle_event(window: &Window, event: &DragDropEvent) {
    if window.label() != "main" { return; }
    let app = window.app_handle();
    let Some(view) = app.get_webview_window("main") else { return; };
    if crate::security::authorize(view.as_ref()).is_err() { return; }
    let scale = window.scale_factor().unwrap_or(1.0);
    let position = |point: &tauri::PhysicalPosition<f64>| Some(DropPosition { x: point.x / scale, y: point.y / scale });
    let payload = match event {
        DragDropEvent::Enter { paths, position: point } => {
            let mut entries = Vec::new(); let mut errors = Vec::new();
            for path in paths.iter().take(100) { match classify(path) { Ok((_, entry)) => entries.push(entry), Err(error) => errors.push(error) } }
            DropPayload { phase: "enter", position: position(point), entries, errors }
        }
        DragDropEvent::Over { position: point } => DropPayload { phase: "over", position: position(point), entries: Vec::new(), errors: Vec::new() },
        DragDropEvent::Drop { paths, position: point } => {
            let documents = app.state::<DocumentGrants>(); let folders = app.state::<crate::files::FolderRoots>(); let apps = app.state::<AppGrants>();
            let (entries, mut errors) = entries_for_drop(paths, &documents, &folders, &apps);
            if !entries.is_empty() {
                let saved = app.path().app_data_dir().map_err(|error| error.to_string()).and_then(|directory| documents.persist(&directory).and_then(|_| apps.persist(&directory)))
                    .and_then(|_| crate::files::persist_roots(app, &folders));
                if saved.is_err() { errors.push("The shortcuts work for this session, but Still could not save their locations for reopening.".into()); }
            }
            DropPayload { phase: "drop", position: position(point), entries, errors }
        }
        DragDropEvent::Leave => DropPayload { phase: "leave", position: None, entries: Vec::new(), errors: Vec::new() },
        _ => return,
    };
    let _ = app.emit_to("main", "still-file-drop", payload);
}

#[tauri::command]
pub async fn document_open(webview: Webview, grants: State<'_, DocumentGrants>, source_id: String) -> Result<(), String> {
    crate::security::authorize(&webview)?;
    let target = grants.target(&source_id)?;
    tauri_plugin_opener::open_path(&target, None::<&str>).map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn document_preview(webview:Webview,grants:State<'_,DocumentGrants>,source_id:String)->Result<crate::files::FilePreview,String>{
    crate::security::authorize(&webview)?;
    let target=grants.target(&source_id)?;
    tauri::async_runtime::spawn_blocking(move||crate::files::read_preview(&target)).await.map_err(|_|"Could not read this file")?
}

#[tauri::command]
pub async fn document_choose(app: AppHandle, webview: Webview, grants: State<'_, DocumentGrants>, source_id: Option<String>) -> Result<Option<DropEntry>, String> {
    crate::security::authorize(&webview)?;
    if let Some(id) = &source_id { crate::files::valid_id(id)?; }
    let handle = app.clone();
    let selected = tauri::async_runtime::spawn_blocking(move || handle.dialog().file().set_title("Choose a document for this shortcut").blocking_pick_file())
        .await.map_err(|error| error.to_string())?;
    let Some(selected) = selected else { return Ok(None); };
    let id = match source_id { Some(id) => id, None => self::source_id()? };
    let entry = grants.register(&id, &selected.into_path().map_err(|error| error.to_string())?)?;
    grants.persist(&app.path().app_data_dir().map_err(|error| error.to_string())?)?;
    Ok(Some(entry))
}

#[tauri::command]
pub async fn app_open(webview: Webview, grants: State<'_, AppGrants>, source_id: String) -> Result<(), String> {
    crate::security::authorize(&webview)?;
    let target = grants.target(&source_id)?;
    if target.extension().and_then(|extension| extension.to_str()).is_some_and(|extension| extension.eq_ignore_ascii_case("lnk")) {
        // Windows resolves an explicitly chosen app shortcut through its normal shell handler.
        return tauri_plugin_opener::open_path(&target, None::<&str>).map_err(|error| error.to_string());
    }
    #[cfg(windows)] {
        // Never assemble command strings or request elevation. A dropped app does
        // not reach this function until the user explicitly clicks Open app.
        let mut command = std::process::Command::new(&target);
        if let Some(directory) = target.parent() { command.current_dir(directory); }
        command.spawn().map(|_| ()).map_err(|error| format!("Cannot open this app: {error}"))
    }
    #[cfg(not(windows))] { Err("App shortcuts currently require Windows.".into()) }
}

#[tauri::command]
pub async fn app_choose(app: AppHandle, webview: Webview, grants: State<'_, AppGrants>) -> Result<Option<DropEntry>, String> {
    crate::security::authorize(&webview)?;
    let handle = app.clone();
    let selected = tauri::async_runtime::spawn_blocking(move || handle.dialog().file().set_title("Choose a Windows app or app shortcut")
        .add_filter("Windows apps and shortcuts", &["exe", "lnk"]).blocking_pick_file())
        .await.map_err(|error| error.to_string())?;
    let Some(selected) = selected else { return Ok(None); };
    let entry = grants.register(&source_id()?, &selected.into_path().map_err(|error| error.to_string())?)?;
    grants.persist(&app.path().app_data_dir().map_err(|error| error.to_string())?)?;
    Ok(Some(entry))
}

#[cfg(test)]
mod tests {
    use super::*;
    struct Fixture(PathBuf);
    impl Fixture {
        fn new() -> Self {
            let path = std::env::temp_dir().join(source_id().unwrap()); fs::create_dir_all(&path).unwrap(); Self(path)
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            assert!(self.0.canonicalize().unwrap().starts_with(std::env::temp_dir().canonicalize().unwrap()));
            fs::remove_dir_all(&self.0).unwrap();
        }
    }
    #[test]
    fn classifies_pdf_document_folder_and_rejects_blocked_and_missing_files() {
        let fixture = Fixture::new();
        for name in ["formula.PDF", "notes.txt", "launch.EXE", "page.url", "app.lnk", "install.msi", "script.ps1", "script.cmd"] { fs::write(fixture.0.join(name), "fixture").unwrap(); }
        fs::create_dir(fixture.0.join("CHEM111")).unwrap();
        fs::create_dir(fixture.0.join("course.url")).unwrap();
        assert_eq!(classify(&fixture.0.join("formula.PDF")).unwrap().1.kind, "pdf");
        assert_eq!(classify(&fixture.0.join("notes.txt")).unwrap().1.kind, "document");
        assert_eq!(classify(&fixture.0.join("CHEM111")).unwrap().1.kind, "folder");
        assert_eq!(classify(&fixture.0.join("course.url")).unwrap().1.kind, "folder");
        assert_eq!(classify(&fixture.0.join("launch.EXE")).unwrap().1.kind, "app");
        assert!(classify(&fixture.0.join("page.url")).is_err());
        assert_eq!(classify(&fixture.0.join("app.lnk")).unwrap().1.kind, "app");
        for name in ["install.msi", "script.ps1", "script.cmd"] { assert!(classify(&fixture.0.join(name)).is_err()); }
        assert!(classify(&fixture.0.join("missing.pdf")).is_err());
    }
    #[test]
    fn internet_shortcuts_parse_only_bounded_https_addresses_without_execution_grants() {
        let fixture = Fixture::new(); let shortcut = fixture.0.join("ChatGPT.url");
        fs::write(&shortcut, "[InternetShortcut]\r\nURL=https://chatgpt.com/\r\nIconFile=C:\\Windows\\bad.exe").unwrap();
        let entry = classify(&shortcut).unwrap().1;
        assert_eq!(entry.kind, "website"); assert_eq!(entry.name, "ChatGPT"); assert_eq!(entry.url.as_deref(), Some("https://chatgpt.com/"));
        let grants = DocumentGrants(Mutex::new(HashMap::new())); assert!(grants.register("website", &shortcut).is_err());
        for address in ["javascript:alert(1)", "file:///C:/Windows/notepad.exe", "https://user:pass@example.com/", "http://example.com/", "not a URL"] {
            fs::write(&shortcut, format!("[InternetShortcut]\nURL={address}")).unwrap(); assert!(classify(&shortcut).is_err());
        }
        fs::write(&shortcut, format!("[InternetShortcut]\nURL=https://example.com/{}", "x".repeat(16_400))).unwrap(); assert!(classify(&shortcut).is_err());
        let utf16: Vec<u8> = std::iter::once(0xfeffu16).chain("[InternetShortcut]\nURL=https://example.com/".encode_utf16()).flat_map(u16::to_le_bytes).collect();
        fs::write(&shortcut, utf16).unwrap(); assert_eq!(classify(&shortcut).unwrap().1.url.as_deref(), Some("https://example.com/"));
    }
    #[test]
    fn exact_document_grants_survive_reload_without_granting_neighbor_files() {
        let fixture = Fixture::new(); let document = fixture.0.join("formula.pdf"); let neighbor = fixture.0.join("private.txt");
        fs::write(&document, "formula").unwrap(); fs::write(&neighbor, "neighbor").unwrap();
        let grants = DocumentGrants(Mutex::new(HashMap::new()));
        let entry = grants.register("saved-pdf", &document).unwrap();
        assert_eq!(entry.source_id.as_deref(), Some("saved-pdf"));
        assert_eq!(grants.target("saved-pdf").unwrap(), document.canonicalize().unwrap());
        assert!(grants.target("private.txt").is_err()); assert!(grants.target("../saved-pdf").is_err());
        grants.persist(&fixture.0.join("registry")).unwrap();
        let restored = DocumentGrants(Mutex::new(read_grants(&fixture.0.join("registry/document-shortcuts.json")).unwrap()));
        assert_eq!(restored.target("saved-pdf").unwrap(), document.canonicalize().unwrap());
        fs::remove_file(&document).unwrap(); assert!(restored.target("saved-pdf").is_err());
        fs::create_dir(&document).unwrap(); assert!(restored.target("saved-pdf").is_err());
    }
    #[test]
    fn native_drop_assigns_independent_document_and_folder_grants_only_to_supported_entries() {
        let fixture = Fixture::new(); let document = fixture.0.join("lecture.pdf"); let folder = fixture.0.join("course"); let program = fixture.0.join("run.cmd");
        fs::write(&document, "lecture").unwrap(); fs::write(&program, "program").unwrap(); fs::create_dir(&folder).unwrap();
        let documents = DocumentGrants(Mutex::new(HashMap::new()));
        let apps = AppGrants(Mutex::new(HashMap::new()));
        let folders = crate::files::FolderRoots::empty_for_tests();
        let (entries, errors) = entries_for_drop(&[document.clone(), folder.clone(), program], &documents, &folders, &apps);
        assert_eq!(entries.len(), 2); assert_eq!(errors.len(), 1);
        let first = entries[0].source_id.as_ref().unwrap(); let second = entries[1].source_id.as_ref().unwrap();
        assert_ne!(first, second); assert_eq!(documents.target(first).unwrap(), document.canonicalize().unwrap());
        assert!(documents.target(second).is_err());
        assert_eq!(folders.root_for_tests(second).unwrap(), folder.canonicalize().unwrap());
        assert!(folders.root_for_tests(first).is_err());
        assert_eq!(documents.0.lock().unwrap().len(), 1);
    }
    #[test]
    fn app_grants_are_separate_exact_paths_persisted_without_executing_dropped_apps() {
        let fixture = Fixture::new(); let app = fixture.0.join("Calculator.exe"); let link = fixture.0.join("Editor.lnk"); let document = fixture.0.join("notes.pdf");
        fs::write(&app, "fixture, deliberately not an executable").unwrap(); fs::write(&link, "fixture, deliberately not a shortcut").unwrap(); fs::write(&document, "document").unwrap();
        let documents = DocumentGrants(Mutex::new(HashMap::new())); let apps = AppGrants(Mutex::new(HashMap::new())); let folders = crate::files::FolderRoots::empty_for_tests();
        let (entries, errors) = entries_for_drop(&[app.clone(), link.clone(), document.clone()], &documents, &folders, &apps);
        assert!(errors.is_empty()); assert_eq!(entries.len(), 3);
        assert_eq!(entries[0].kind, "app"); assert_eq!(entries[1].kind, "app"); assert_eq!(entries[2].kind, "pdf");
        let app_id = entries[0].source_id.as_deref().unwrap(); let link_id = entries[1].source_id.as_deref().unwrap(); let document_id = entries[2].source_id.as_deref().unwrap();
        assert_eq!(apps.target(app_id).unwrap(), app.canonicalize().unwrap()); assert_eq!(apps.target(link_id).unwrap(), link.canonicalize().unwrap());
        assert!(documents.target(app_id).is_err()); assert!(apps.target(document_id).is_err());
        assert!(documents.register("app-as-document", &app).is_err()); assert!(apps.register("document-as-app", &document).is_err());
        apps.persist(&fixture.0.join("registry")).unwrap(); documents.persist(&fixture.0.join("registry")).unwrap();
        let restored_apps = AppGrants(Mutex::new(read_grants(&fixture.0.join("registry/app-shortcuts.json")).unwrap()));
        let restored_documents = DocumentGrants(Mutex::new(read_grants(&fixture.0.join("registry/document-shortcuts.json")).unwrap()));
        assert_eq!(restored_apps.target(app_id).unwrap(), app.canonicalize().unwrap());
        assert!(restored_documents.target(app_id).is_err()); assert!(restored_apps.target(document_id).is_err());
        assert_eq!(fs::read_to_string(&app).unwrap(), "fixture, deliberately not an executable");
        fs::remove_file(&app).unwrap(); assert!(restored_apps.target(app_id).is_err()); fs::create_dir(&app).unwrap(); assert!(restored_apps.target(app_id).is_err());
    }
    #[test]
    fn app_and_document_target_rechecks_reject_wrong_grant_kinds_and_scripts() {
        let fixture = Fixture::new(); let app = fixture.0.join("tool.exe"); let document = fixture.0.join("notes.txt");
        fs::write(&app, "app fixture").unwrap(); fs::write(&document, "document fixture").unwrap();
        let documents = DocumentGrants(Mutex::new(HashMap::from([("wrong-kind".into(), app.canonicalize().unwrap())])));
        let apps = AppGrants(Mutex::new(HashMap::from([("wrong-kind".into(), document.canonicalize().unwrap())])));
        assert!(documents.target("wrong-kind").is_err()); assert!(apps.target("wrong-kind").is_err());
        for extension in ["cmd", "bat", "com", "ps1", "vbs", "msi", "scr", "hta", "reg"] {
            let script = fixture.0.join(format!("run.{extension}")); fs::write(&script, "script fixture").unwrap();
            assert!(apps.register("script", &script).is_err()); assert!(documents.register("script", &script).is_err());
        }
    }
    #[test]
    fn repeated_app_drops_remain_independent_and_app_suffix_folders_stay_folders() {
        let fixture = Fixture::new(); let first_app = fixture.0.join("first.exe"); let changed_app = fixture.0.join("changed.exe");
        let executable_named_folder = fixture.0.join("Archive.exe"); let shortcut_named_folder = fixture.0.join("Course.lnk");
        fs::write(&first_app, "first app fixture").unwrap(); fs::write(&changed_app, "changed app fixture").unwrap();
        fs::create_dir(&executable_named_folder).unwrap(); fs::create_dir(&shortcut_named_folder).unwrap();
        let documents = DocumentGrants(Mutex::new(HashMap::new())); let apps = AppGrants(Mutex::new(HashMap::new())); let folders = crate::files::FolderRoots::empty_for_tests();
        let (entries, errors) = entries_for_drop(&[first_app.clone(), first_app.clone(), executable_named_folder.clone(), shortcut_named_folder.clone()], &documents, &folders, &apps);
        assert!(errors.is_empty()); assert_eq!(entries.iter().map(|entry| entry.kind.as_str()).collect::<Vec<_>>(), ["app", "app", "folder", "folder"]);
        let first_id = entries[0].source_id.as_deref().unwrap(); let second_id = entries[1].source_id.as_deref().unwrap(); assert_ne!(first_id, second_id);
        apps.register(second_id, &changed_app).unwrap();
        assert_eq!(apps.target(first_id).unwrap(), first_app.canonicalize().unwrap()); assert_eq!(apps.target(second_id).unwrap(), changed_app.canonicalize().unwrap());
        assert_eq!(folders.root_for_tests(entries[2].source_id.as_deref().unwrap()).unwrap(), executable_named_folder.canonicalize().unwrap());
        assert_eq!(folders.root_for_tests(entries[3].source_id.as_deref().unwrap()).unwrap(), shortcut_named_folder.canonicalize().unwrap());
        assert_eq!(apps.0.lock().unwrap().len(), 2); assert!(documents.0.lock().unwrap().is_empty());
    }
}
