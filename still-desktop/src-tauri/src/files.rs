use serde::Serialize;
use std::{collections::HashMap, fs, io::Read, path::{Component, Path, PathBuf}, sync::Mutex};
use tauri::{AppHandle, Manager, State, Webview};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;
use base64::{engine::general_purpose::STANDARD, Engine as _};

pub struct FolderRoots(Mutex<HashMap<String, PathBuf>>);
impl FolderRoots {
    pub fn load(app: &AppHandle) -> Self {
        let roots = app.path().app_data_dir().ok().and_then(|dir| fs::read(dir.join("file-folders.json")).ok())
            .filter(|bytes| bytes.len() <= 1_000_000).and_then(|bytes| serde_json::from_slice(&bytes).ok()).unwrap_or_default();
        Self(Mutex::new(roots))
    }
    fn root(&self, id: &str) -> Result<PathBuf, String> {
        self.0.lock().map_err(|_| "Folder state is unavailable")?.get(id).cloned().ok_or_else(|| "Choose a folder to get started.".into())
    }
    pub(crate) fn register_drop(&self, id: &str, path: &Path) -> Result<(), String> {
        valid_id(id)?;
        let path = path.canonicalize().map_err(|_| "This folder is no longer available")?;
        if !path.is_dir() { return Err("Drop a folder to save a folder shortcut".into()); }
        self.0.lock().map_err(|_| "Folder state is unavailable")?.insert(id.into(), path);
        Ok(())
    }
    #[cfg(test)] pub(crate) fn empty_for_tests() -> Self { Self(Mutex::new(HashMap::new())) }
    #[cfg(test)] pub(crate) fn root_for_tests(&self, id: &str) -> Result<PathBuf, String> { self.root(id) }
}
fn set_root_and_persist(
    roots: &FolderRoots,
    id: &str,
    path: PathBuf,
    persist: impl FnOnce(&FolderRoots) -> Result<(), String>,
) -> Result<(), String> {
    let previous = roots
        .0
        .lock()
        .map_err(|_| "Folder state is unavailable")?
        .insert(id.to_owned(), path.clone());
    if let Err(error) = persist(roots) {
        // Keep the in-memory grant aligned with the persisted grant. Avoid
        // overwriting a newer selection if another command changed it while
        // persistence was in progress.
        if let Ok(mut folders) = roots.0.lock() {
            if folders.get(id) == Some(&path) {
                match previous {
                    Some(previous) => { folders.insert(id.to_owned(), previous); }
                    None => { folders.remove(id); }
                }
            }
        }
        return Err(error);
    }
    Ok(())
}
#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub struct FileEntry { name: String, path: String, directory: bool, size: u64, blocked: bool }
#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub(crate) struct FilePreview { mime_type: String, base64: String }
#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub struct FolderListing { root_name: String, location: String, entries: Vec<FileEntry>, truncated: bool }
pub(crate) fn valid_id(id: &str) -> Result<(), String> {
    if id.is_empty() || id.len()>80 || !id.bytes().all(|c| c.is_ascii_alphanumeric()||c==b'-') { return Err("Invalid Files widget".into()); }
    Ok(())
}
fn resolve(root: &Path, relative: &str) -> Result<PathBuf, String> {
    if relative.contains(':') || relative.contains('\0') || Path::new(relative).components().any(|part| !matches!(part,Component::Normal(_))) {
        return Err("Use a file within the selected folder".into());
    }
    let root=root.canonicalize().map_err(|_| "The selected folder is unavailable. Choose it again.")?;
    let target=root.join(relative).canonicalize().map_err(|_| "This file or folder is no longer available")?;
    if !target.starts_with(&root) { return Err("This shortcut points outside the selected folder".into()); }
    Ok(target)
}
pub(crate) fn blocked(path: &Path) -> bool {
    matches!(path.extension().and_then(|e| e.to_str()).unwrap_or("").to_ascii_lowercase().as_str(),
        "exe"|"com"|"bat"|"cmd"|"msi"|"ps1"|"psm1"|"vbs"|"vbe"|"js"|"jse"|"wsf"|"wsh"|"scr"|"lnk"|"url"|"reg"|"hta"|"sh"|"app"|"desktop")
}
pub(crate) fn read_preview(path:&Path)->Result<FilePreview,String>{
    const MAX_PREVIEW_BYTES:u64=20*1024*1024;
    let extension=path.extension().and_then(|value|value.to_str()).unwrap_or("").to_ascii_lowercase();
    let mime_type=match extension.as_str(){
        "pdf"=>"application/pdf","txt"|"md"|"csv"|"log"=>"text/plain",
        "png"=>"image/png","jpg"|"jpeg"=>"image/jpeg","gif"=>"image/gif","webp"=>"image/webp","bmp"=>"image/bmp",
        "mp4"|"m4v"=>"video/mp4","webm"=>"video/webm","mp3"=>"audio/mpeg","wav"=>"audio/wav","ogg"=>"audio/ogg",
        _=>return Err("Preview supports PDF, text, common image and audio/video files.".into()),
    };
    let metadata=fs::metadata(path).map_err(|_|"This file is no longer available")?;
    if !metadata.is_file(){return Err("Choose a file to preview.".into())}
    if metadata.len()>MAX_PREVIEW_BYTES{return Err("This file is larger than the 20 MB preview limit. Open it in your default app instead.".into())}
    // The file can grow after the metadata check. Keep the actual read bounded too.
    let mut bytes=Vec::with_capacity(metadata.len() as usize);
    fs::File::open(path).map_err(|_|"Could not read this file")?.take(MAX_PREVIEW_BYTES+1)
        .read_to_end(&mut bytes).map_err(|_|"Could not read this file")?;
    if bytes.len() as u64>MAX_PREVIEW_BYTES{return Err("This file is larger than the 20 MB preview limit. Open it in your default app instead.".into())}
    if mime_type=="text/plain"&&std::str::from_utf8(&bytes).is_err(){return Err("This text file is not valid UTF-8, so it cannot be previewed.".into())}
    Ok(FilePreview{mime_type:mime_type.into(),base64:STANDARD.encode(bytes)})
}
fn listing(root: &Path, location: &str) -> Result<FolderListing,String> {
    let directory=resolve(root,location)?;
    if !directory.is_dir() { return Err("Select a folder".into()); }
    let mut entries=Vec::new(); let mut truncated=false;
    for (index,item) in fs::read_dir(directory).map_err(|e| format!("Cannot read this folder: {e}"))?.enumerate() {
        if index>=1000 { truncated=true;break; }
        let Ok(item)=item else { continue };
        let name=item.file_name().to_string_lossy().into_owned();
        let path=if location.is_empty(){name.clone()}else{format!("{location}/{name}")};
        let Ok(target)=resolve(root,&path) else { continue };
        let Ok(meta)=fs::metadata(&target) else { continue };
        if !meta.is_file() && !meta.is_dir(){continue}
        entries.push(FileEntry{name,path,directory:meta.is_dir(),size:meta.len(),blocked:meta.is_file()&&blocked(&target)});
    }
    entries.sort_by(|a,b| b.directory.cmp(&a.directory).then(a.name.to_lowercase().cmp(&b.name.to_lowercase())));
    Ok(FolderListing{root_name:root.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_else(|| "Selected folder".into()),location:location.into(),entries,truncated})
}

const NOTE_LIBRARY_MAX_FILES:usize=500;
const NOTE_LIBRARY_MAX_BYTES:u64=1_000_000;
const NOTE_LIBRARY_MAX_CHARS:usize=256_000;
const NOTE_LIBRARY_MAX_DIRECTORIES:usize=2000;
const NOTE_LIBRARY_MAX_DEPTH:usize=24;
const NOTE_LIBRARY_MAX_SCANNED_ENTRIES:usize=10000;
#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub(crate) struct NoteLibraryEntry { path:String, name:String, size:u64 }
fn supported_note(path:&Path)->bool{
    matches!(path.extension().and_then(|value|value.to_str()).unwrap_or("").to_ascii_lowercase().as_str(),"md"|"markdown"|"txt")
}
fn collect_note_files(root:&Path,dir:&Path,files:&mut Vec<NoteLibraryEntry>,directories:&mut usize,scanned:&mut usize,depth:usize)->Result<(),String>{
    if files.len()>=NOTE_LIBRARY_MAX_FILES||*directories>=NOTE_LIBRARY_MAX_DIRECTORIES||*scanned>=NOTE_LIBRARY_MAX_SCANNED_ENTRIES||depth>=NOTE_LIBRARY_MAX_DEPTH{return Ok(())}
    *directories+=1;
    for item in fs::read_dir(dir).map_err(|e|format!("Cannot read this folder: {e}"))?{
        if files.len()>=NOTE_LIBRARY_MAX_FILES||*directories>=NOTE_LIBRARY_MAX_DIRECTORIES||*scanned>=NOTE_LIBRARY_MAX_SCANNED_ENTRIES{break}
        *scanned+=1;
        let item=item.map_err(|_|"Could not read this folder")?;
        if item.file_type().map(|kind|kind.is_symlink()).unwrap_or(true){continue}
        let path=item.path();
        let target=match path.canonicalize(){Ok(value) if value.starts_with(root)=>value,_=>continue};
        let metadata=match fs::metadata(&target){Ok(value)=>value,Err(_)=>continue};
        if metadata.is_dir(){collect_note_files(root,&target,files,directories,scanned,depth+1)?;continue}
        if !metadata.is_file()||!supported_note(&target)||metadata.len()>NOTE_LIBRARY_MAX_BYTES{continue}
        let relative=target.strip_prefix(root).map_err(|_|"Use files inside the selected notes folder")?;
        let path=relative.components().map(|part|part.as_os_str().to_string_lossy()).collect::<Vec<_>>().join("/");
        let name=target.file_name().map(|value|value.to_string_lossy().into_owned()).unwrap_or_default();
        files.push(NoteLibraryEntry{path,name,size:metadata.len()});
    }
    Ok(())
}
fn note_target(roots:&FolderRoots,id:&str,relative:&str)->Result<PathBuf,String>{
    valid_id(id)?;
    let root=roots.root(id)?.canonicalize().map_err(|_|"The selected notes folder is unavailable. Choose it again.")?;
    let target=resolve(&root,relative)?;
    if !target.is_file()||!supported_note(&target){return Err("Choose a Markdown or text file inside the selected notes folder".into())}
    Ok(target)
}
fn read_note_file(roots:&FolderRoots,id:&str,relative:&str)->Result<String,String>{
    let target=note_target(roots,id,relative)?;
    let metadata=fs::metadata(&target).map_err(|_|"This note is no longer available")?;
    if metadata.len()>NOTE_LIBRARY_MAX_BYTES{return Err("This note exceeds the 1 MB editing limit.".into())}
    let text=String::from_utf8(fs::read(target).map_err(|_|"Could not read this note")?).map_err(|_|"This note is not valid UTF-8 and cannot be edited here.")?;
    if text.chars().count()>NOTE_LIBRARY_MAX_CHARS{return Err("This note is larger than Still's 256,000-character editing limit.".into())}
    Ok(text)
}
fn write_note_file(roots:&FolderRoots,id:&str,relative:&str,text:&str,expected:&str)->Result<(),String>{
    if text.len() as u64>NOTE_LIBRARY_MAX_BYTES{return Err("This note exceeds the 1 MB editing limit.".into())}
    if text.chars().count()>NOTE_LIBRARY_MAX_CHARS{return Err("This note is larger than Still's 256,000-character editing limit.".into())}
    let target=note_target(roots,id,relative)?;
    let current=read_note_file(roots,id,relative)?;
    if current!=expected{return Err("This file changed outside Still. Reload it from the library before saving.".into())}
    let parent=target.parent().ok_or("This note has no parent folder")?;
    let stamp=std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_err(|_|"System clock is unavailable")?.as_nanos();
    let temp=parent.join(format!(".still-note-{}-{stamp}.tmp",std::process::id()));
    let result=(||{
        use std::io::Write;
        let mut file=std::fs::OpenOptions::new().write(true).create_new(true).open(&temp).map_err(|_|"Could not prepare a safe note save")?;
        file.write_all(text.as_bytes()).map_err(|_|"Could not write this note")?;
        file.sync_all().map_err(|_|"Could not finish saving this note")?;
        fs::rename(&temp,&target).map_err(|_|"Could not replace this note. Check that the file is writable and try again")?;
        Ok(())
    })();
    if result.is_err(){let _=fs::remove_file(temp);}
    result
}
fn create_note_file(roots:&FolderRoots,id:&str,title:&str)->Result<NoteLibraryEntry,String>{
    valid_id(id)?;
    let clean=title.trim();
    if clean.is_empty()||clean.len()>80||clean.chars().any(|c|c.is_control()||matches!(c,'/'|'\\'|':'|'*'|'?'|'"'|'<'|'>'|'|')){
        return Err("Use a note name up to 80 characters without file-path symbols.".into())
    }
    let root=roots.root(id)?.canonicalize().map_err(|_|"The selected notes folder is unavailable. Choose it again.")?;
    let target=root.join(format!("{clean}.md"));
    if target.exists(){return Err("A note with that name already exists in this folder.".into())}
    let relative=target.file_name().ok_or("Invalid note name")?.to_string_lossy().into_owned();
    let mut file=std::fs::OpenOptions::new().write(true).create_new(true).open(&target).map_err(|_|"Could not create this note. Check that the folder is writable and try again")?;
    use std::io::Write;
    file.write_all(b"").map_err(|_|"Could not finish creating this note")?;
    file.sync_all().map_err(|_|"Could not finish creating this note")?;
    Ok(NoteLibraryEntry{path:relative,name:format!("{clean}.md"),size:0})
}

#[tauri::command]
pub async fn notes_library_choose(app:AppHandle,webview:Webview,roots:State<'_,FolderRoots>,id:String)->Result<Option<String>,String>{
    crate::security::authorize(&webview)?;valid_id(&id)?;
    let handle=app.clone();
    let selected=tauri::async_runtime::spawn_blocking(move||handle.dialog().file().set_title("Choose a folder for your Notes library").blocking_pick_folder()).await.map_err(|e|e.to_string())?;
    let Some(selected)=selected else{return Ok(None)};
    let path=selected.into_path().map_err(|e|e.to_string())?.canonicalize().map_err(|e|e.to_string())?;
    if !path.is_dir(){return Err("Choose a folder for your Notes library".into())}
    let name=path.file_name().map(|value|value.to_string_lossy().into_owned()).unwrap_or_else(||"Notes library".into());
    set_root_and_persist(&roots, &id, path, |roots| persist_roots(&app, roots))?;
    Ok(Some(name))
}
#[tauri::command]
pub async fn notes_library_list(webview:Webview,roots:State<'_,FolderRoots>,id:String)->Result<Vec<NoteLibraryEntry>,String>{
    crate::security::authorize(&webview)?;valid_id(&id)?;
    let root=roots.root(&id)?.canonicalize().map_err(|_|"The selected notes folder is unavailable. Choose it again.")?;
    let mut files=Vec::new();let(mut directories,mut scanned)=(0,0);collect_note_files(&root,&root,&mut files,&mut directories,&mut scanned,0)?;
    files.sort_by(|a,b|a.path.to_lowercase().cmp(&b.path.to_lowercase()));Ok(files)
}
#[tauri::command]
pub async fn notes_library_read(webview:Webview,roots:State<'_,FolderRoots>,id:String,path:String)->Result<String,String>{
    crate::security::authorize(&webview)?;read_note_file(&roots,&id,&path)
}
#[tauri::command]
pub async fn notes_library_write(webview:Webview,roots:State<'_,FolderRoots>,id:String,path:String,text:String,expected:String)->Result<(),String>{
    crate::security::authorize(&webview)?;write_note_file(&roots,&id,&path,&text,&expected)
}
#[tauri::command]
pub async fn notes_library_create(webview:Webview,roots:State<'_,FolderRoots>,id:String,title:String)->Result<NoteLibraryEntry,String>{
    crate::security::authorize(&webview)?;create_note_file(&roots,&id,&title)
}
fn reuse_folder(roots:&FolderRoots,id:&str,source_id:&str)->Result<FolderListing,String>{
    valid_id(id)?;valid_id(source_id)?;
    let mut folders=roots.0.lock().map_err(|_| "Folder state is unavailable")?;
    // Only reuse a previously selected root. Never accept a path from the UI.
    // Existing instance selections take precedence over the saved preset.
    let path=folders.get(id).or_else(||folders.get(source_id)).cloned().ok_or("Choose the saved folder again to reconnect it.")?;
    let result=listing(&path,"")?;folders.entry(id.into()).or_insert(path);Ok(result)
}
pub(crate) fn persist_roots(app:&AppHandle,roots:&FolderRoots)->Result<(),String>{
    let folders=roots.0.lock().map_err(|_| "Folder state is unavailable")?;
    let directory=app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
    fs::write(directory.join("file-folders.json"),serde_json::to_vec(&*folders).map_err(|e| e.to_string())?).map_err(|e| e.to_string())
}
#[tauri::command]
pub async fn files_choose(app: AppHandle, webview: Webview, roots: State<'_,FolderRoots>, id:String) -> Result<Option<FolderListing>,String> {
    crate::security::authorize(&webview)?;valid_id(&id)?;
    let handle=app.clone();
    let selected=tauri::async_runtime::spawn_blocking(move || handle.dialog().file().set_title("Choose a folder for this Files widget").blocking_pick_folder()).await.map_err(|e| e.to_string())?;
    let Some(selected)=selected else {return Ok(None)};
    let path=selected.into_path().map_err(|e| e.to_string())?.canonicalize().map_err(|e| e.to_string())?;
    let result=listing(&path,"")?;
    let mut folders=roots.0.lock().map_err(|_| "Folder state is unavailable")?;
    folders.insert(id,path);
    drop(folders);persist_roots(&app,&roots)?;
    Ok(Some(result))
}
#[tauri::command]
pub async fn files_reuse(app:AppHandle,webview:Webview,roots:State<'_,FolderRoots>,id:String,source_id:String)->Result<FolderListing,String>{
    crate::security::authorize(&webview)?;
    let result=reuse_folder(&roots,&id,&source_id)?;persist_roots(&app,&roots)?;Ok(result)
}
#[tauri::command]
pub async fn files_list(webview: Webview, roots: State<'_,FolderRoots>, id:String, location:String) -> Result<FolderListing,String> {
    crate::security::authorize(&webview)?;valid_id(&id)?;
    listing(&roots.root(&id)?,&location)
}
#[tauri::command]
pub async fn files_open(app: AppHandle, webview: Webview, roots: State<'_,FolderRoots>, id:String, path:String) -> Result<(),String> {
    crate::security::authorize(&webview)?;valid_id(&id)?;
    let target=resolve(&roots.root(&id)?,&path)?;
    if !target.is_file() || blocked(&target) { return Err("Choose a document, image or media file to open".into()); }
    app.opener().open_path(target.to_string_lossy(),None::<&str>).map_err(|e| e.to_string())
}
#[tauri::command]
pub async fn files_preview(webview:Webview,roots:State<'_,FolderRoots>,id:String,path:String)->Result<FilePreview,String>{
    crate::security::authorize(&webview)?;valid_id(&id)?;
    let target=resolve(&roots.root(&id)?,&path)?;
    if blocked(&target){return Err("Programs and shortcuts cannot be previewed.".into())}
    tauri::async_runtime::spawn_blocking(move||read_preview(&target)).await.map_err(|_|"Could not read this file")?
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn failed_notes_library_grant_persistence_restores_previous_root() {
        let old = PathBuf::from("old-library");
        let roots = FolderRoots(Mutex::new(HashMap::from([("notes-widget".into(), old.clone())])));
        let result = set_root_and_persist(&roots, "notes-widget", PathBuf::from("new-library"), |_| {
            Err("simulated persistence failure".into())
        });
        assert!(result.is_err());
        assert_eq!(roots.root("notes-widget").unwrap(), old);
    }
    #[test] fn lists_nested_files_and_rejects_escape_and_programs() {
        let fixture=std::env::temp_dir().join(format!("still-files-test-{}-{}",std::process::id(),std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
        let root=fixture.join("chosen");fs::create_dir_all(root.join("lectures")).unwrap();
        fs::write(root.join("notes.txt"),"lecture notes").unwrap();fs::write(root.join("launch.CMD"),"test").unwrap();
        fs::write(root.join("lectures/week1.txt"),"week one").unwrap();fs::write(fixture.join("outside.txt"),"outside").unwrap();
        let result=listing(&root,"").unwrap();assert_eq!(result.entries[0].name,"lectures");
        assert_eq!(listing(&root,"lectures").unwrap().entries[0].name,"week1.txt");
        assert!(result.entries.iter().find(|f|f.name=="launch.CMD").unwrap().blocked);
        assert!(resolve(&root,"../outside.txt").is_err());assert!(resolve(&root,fixture.join("outside.txt").to_str().unwrap()).is_err());
        assert!(resolve(&root,"notes.txt:stream").is_err());assert!(valid_id("../main").is_err());
        fs::remove_dir_all(fixture).unwrap();
    }
    #[test] fn previews_only_allowlisted_types_with_a_bounded_size(){
        let fixture=std::env::temp_dir().join(format!("still-preview-test-{}-{}",std::process::id(),std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
        fs::create_dir_all(&fixture).unwrap();
        let text=fixture.join("lecture.MD");fs::write(&text,"local lecture notes").unwrap();
        let preview=read_preview(&text).unwrap();assert_eq!(preview.mime_type,"text/plain");assert_eq!(base64::engine::general_purpose::STANDARD.decode(preview.base64).unwrap(),b"local lecture notes");
        let html=fixture.join("active.html");fs::write(&html,"<script>alert(1)</script>").unwrap();assert!(read_preview(&html).is_err());
        let binary=fixture.join("broken.txt");fs::write(&binary,[0xff,0xfe]).unwrap();assert!(read_preview(&binary).is_err());
        fs::remove_dir_all(fixture).unwrap();
    }
    #[test]fn reuses_only_selected_folders_and_keeps_instance_changes_independent(){
        let fixture=std::env::temp_dir().join(format!("still-preset-files-{}-{}",std::process::id(),std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
        let course=fixture.join("CHEM111");let personal=fixture.join("Personal");fs::create_dir_all(&course).unwrap();fs::create_dir_all(&personal).unwrap();
        fs::write(course.join("formula.txt"),"course").unwrap();fs::write(personal.join("notes.txt"),"personal").unwrap();
        let roots=FolderRoots(Mutex::new(HashMap::from([("saved-course".into(),course.clone())])));
        assert!(reuse_folder(&roots,"missing-instance","unselected").is_err());assert!(reuse_folder(&roots,"invalid","../folder").is_err());
        assert_eq!(reuse_folder(&roots,"first","saved-course").unwrap().entries[0].name,"formula.txt");
        assert_eq!(reuse_folder(&roots,"second","saved-course").unwrap().root_name,"CHEM111");
        roots.0.lock().unwrap().insert("first".into(),personal);
        assert_eq!(reuse_folder(&roots,"first","saved-course").unwrap().root_name,"Personal");
        assert_eq!(reuse_folder(&roots,"second","saved-course").unwrap().entries[0].name,"formula.txt");
        let serialized=serde_json::to_vec(&*roots.0.lock().unwrap()).unwrap();let restored=FolderRoots(Mutex::new(serde_json::from_slice(&serialized).unwrap()));
        assert_eq!(reuse_folder(&restored,"third","saved-course").unwrap().root_name,"CHEM111");
        assert!(fixture.canonicalize().unwrap().starts_with(std::env::temp_dir().canonicalize().unwrap()));fs::remove_dir_all(fixture).unwrap();
    }
    #[test]fn notes_library_lists_reads_creates_and_safely_replaces_supported_files(){
        let fixture=std::env::temp_dir().join(format!("still-notes-library-{}-{}",std::process::id(),std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
        let root=fixture.join("library");fs::create_dir_all(root.join("course")).unwrap();
        fs::write(root.join("course/week1.MARKDOWN"),"first draft").unwrap();fs::write(root.join("ignored.html"),"no").unwrap();fs::write(root.join("large.txt"),vec![b'x';(NOTE_LIBRARY_MAX_BYTES+1) as usize]).unwrap();fs::write(root.join("large-chars.md"),"x".repeat(NOTE_LIBRARY_MAX_CHARS+1)).unwrap();
        let root=root.canonicalize().unwrap();
        let roots=FolderRoots(Mutex::new(HashMap::from([("notes-widget".into(),root.clone())])));
        let mut entries=Vec::new();let(mut directories,mut scanned)=(0,0);collect_note_files(&root,&root,&mut entries,&mut directories,&mut scanned,0).unwrap();assert_eq!(entries.len(),2);assert!(entries.iter().any(|entry|entry.path=="course/week1.MARKDOWN"));
        assert_eq!(read_note_file(&roots,"notes-widget","course/week1.MARKDOWN").unwrap(),"first draft");
        assert!(read_note_file(&roots,"notes-widget","large-chars.md").unwrap_err().contains("256,000-character"));
        write_note_file(&roots,"notes-widget","course/week1.MARKDOWN","saved update","first draft").unwrap();assert_eq!(fs::read_to_string(root.join("course/week1.MARKDOWN")).unwrap(),"saved update");
        fs::write(root.join("course/week1.MARKDOWN"),"edited outside Still").unwrap();
        assert!(write_note_file(&roots,"notes-widget","course/week1.MARKDOWN","stale overwrite","saved update").unwrap_err().contains("changed outside Still"));
        let created=create_note_file(&roots,"notes-widget","New idea").unwrap();assert_eq!(created.path,"New idea.md");assert_eq!(fs::read_to_string(root.join("New idea.md")).unwrap(),"");
        assert!(create_note_file(&roots,"notes-widget","New idea").is_err());assert!(create_note_file(&roots,"notes-widget","../outside").is_err());
        assert!(read_note_file(&roots,"notes-widget","../ignored.html").is_err());assert!(write_note_file(&roots,"notes-widget","ignored.html","no","").is_err());
        assert!(write_note_file(&roots,"notes-widget","course/week1.MARKDOWN",&"x".repeat((NOTE_LIBRARY_MAX_BYTES+1) as usize),"").is_err());
        fs::remove_dir_all(fixture).unwrap();
    }
}
