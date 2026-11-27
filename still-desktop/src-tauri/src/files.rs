use serde::{Deserialize, Serialize};
use std::{collections::HashMap, fs, io::{Read, Write}, path::{Component, Path, PathBuf}, sync::Mutex};
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
pub(crate) struct LibrarySearchHit { widget_id:String, entry:FileEntry }
#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub(crate) struct LibrarySearchResponse { results:Vec<LibrarySearchHit>, unavailable_widget_ids:Vec<String>, truncated:bool }
#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub struct FolderListing { root_name: String, location: String, entries: Vec<FileEntry>, truncated: bool }
#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub(crate) struct StillInbox { listing:FolderListing,path:String }
#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub(crate) struct FileMoveResult { source_path:String, destination_path:String }
#[derive(Deserialize)]
#[serde(tag="type",rename_all="camelCase")]
pub(crate) enum ManagedFileAction { Rename{name:String},Move{destination_folder:String},Delete,EditText{text:String,expected_text:String},CreateText{text:String} }
#[derive(Debug,Serialize)]
#[serde(rename_all="camelCase")]
pub(crate) struct ManagedFileResult { action:String,source_path:String,destination_path:String }
#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub(crate) struct ExtractedPdfText { text:String, pages_read:usize, total_pages:usize, truncated:bool }
const MAX_AI_PDF_BYTES:u64=20*1024*1024;
const MAX_AI_PDF_PAGES:usize=30;
const MAX_AI_PDF_CHARS:usize=24_000;
fn extract_pdf_text(path:&Path)->Result<ExtractedPdfText,String>{
    let metadata=fs::metadata(path).map_err(|_|"This PDF is no longer available")?;
    if !metadata.is_file()||path.extension().and_then(|value|value.to_str()).is_none_or(|value|!value.eq_ignore_ascii_case("pdf")){return Err("Choose a PDF inside the selected Files library.".into())}
    if metadata.len()>MAX_AI_PDF_BYTES{return Err("This PDF is larger than the 20 MB text extraction limit.".into())}
    let mut bytes=Vec::with_capacity(metadata.len() as usize);
    fs::File::open(path).map_err(|_|"Could not read this PDF")?.take(MAX_AI_PDF_BYTES+1).read_to_end(&mut bytes).map_err(|_|"Could not read this PDF")?;
    if bytes.len() as u64>MAX_AI_PDF_BYTES{return Err("This PDF is larger than the 20 MB text extraction limit.".into())}
    let document=pdf_extract::Document::load_mem(&bytes).map_err(|_|"Still could not extract text from this PDF. It may be encrypted or damaged.")?;
    let total_pages=document.get_pages().len();
    let pages=document.get_pages().keys().copied().take(MAX_AI_PDF_PAGES).collect::<Vec<_>>();
    let mut text=String::new();let mut truncated=total_pages>pages.len();let mut pages_read=0;
    for page in &pages{
        let chunk=document.extract_text(&[*page]).map_err(|_|"Still could not extract text from this PDF. It may be encrypted or damaged.")?;pages_read+=1;
        let remaining=MAX_AI_PDF_CHARS.saturating_sub(text.chars().count());
        if chunk.chars().count()>remaining{text.extend(chunk.chars().take(remaining));truncated=true;break}
        text.push_str(&chunk);
    }
    Ok(ExtractedPdfText{text,pages_read,total_pages,truncated})
}
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
fn valid_filing_segment(segment:&str)->bool{
    if segment.is_empty()||segment=="."||segment==".."||segment.len()>100||segment.ends_with(' ')||segment.ends_with('.')||segment.chars().any(|value|value.is_control()||matches!(value,'<'|'>'|':'|'"'|'/'|'\\'|'|'|'?'|'*')){return false}
    let device=segment.split('.').next().unwrap_or("").trim_end_matches(|value|value==' '||value=='.').to_ascii_uppercase();
    !matches!(device.as_str(),"CON"|"PRN"|"AUX"|"NUL")&&!(device.strip_prefix("COM").or_else(||device.strip_prefix("LPT")).is_some_and(|number|matches!(number,"1"|"2"|"3"|"4"|"5"|"6"|"7"|"8"|"9")))
}
fn filing_segments(relative:&str)->Result<Vec<&str>,String>{
    if relative.is_empty()||relative.len()>240||relative.contains(':')||relative.contains('\\')||relative.contains('\0'){return Err("Choose a folder inside the selected Files library.".into())}
    let segments=relative.split('/').collect::<Vec<_>>();
    if segments.len()>8||segments.iter().any(|segment|!valid_filing_segment(segment)){return Err("The suggested folder name is not safe for this library.".into())}
    Ok(segments)
}
pub(crate) fn validate_filing_folder(relative:&str)->Result<(),String>{filing_segments(relative).map(|_|())}
fn existing_file_without_links(root:&Path,relative:&str)->Result<PathBuf,String>{
    let root=root.canonicalize().map_err(|_|"The selected folder is unavailable. Choose it again.")?;
    if relative.is_empty()||relative.len()>1000||relative.contains(':')||relative.contains('\\')||relative.contains('\0')||Path::new(relative).components().any(|part|!matches!(part,Component::Normal(_))){return Err("Choose a file within the selected Files library.".into())}
    let mut current=root.clone();
    for part in Path::new(relative).components(){
        let Component::Normal(name)=part else{return Err("Choose a file within the selected Files library.".into())};
        current.push(name);
        let metadata=fs::symlink_metadata(&current).map_err(|_|"This file is no longer available")?;
        if metadata.file_type().is_symlink(){return Err("Still cannot move a linked file from the library.".into())}
        if current!=root&&current!=root.join(relative)&&!metadata.is_dir(){return Err("The selected file path contains a non-folder item.".into())}
    }
    let target=current.canonicalize().map_err(|_|"This file is no longer available")?;
    if !target.starts_with(&root)||!target.is_file()||blocked(&target){return Err("Choose a non-program file inside the selected Files library.".into())}
    Ok(target)
}
fn ensure_filing_folder(root:&Path,relative:&str)->Result<PathBuf,String>{
    let segments=filing_segments(relative)?;
    let root=root.canonicalize().map_err(|_|"The selected folder is unavailable. Choose it again.")?;
    let mut current=root.clone();
    for segment in segments{
        current.push(segment);
        match fs::symlink_metadata(&current){
            Ok(metadata) if metadata.file_type().is_symlink()=>return Err("Still cannot file into a linked folder.".into()),
            Ok(metadata) if metadata.is_dir()=>(),
            Ok(_)=>return Err("A file already uses the suggested folder name.".into()),
            Err(error) if error.kind()==std::io::ErrorKind::NotFound=>fs::create_dir(&current).map_err(|_|"Still could not create the filing folder.")?,
            Err(_)=>return Err("Still could not open the filing folder.".into()),
        }
        current=current.canonicalize().map_err(|_|"Still could not open the filing folder.")?;
        if !current.starts_with(&root){return Err("The suggested folder points outside the selected Files library.".into())}
    }
    Ok(current)
}
fn move_file_within_root(root:&Path,source_relative:&str,destination_folder:&str)->Result<FileMoveResult,String>{
    let segments=filing_segments(destination_folder)?;
    let source=existing_file_without_links(root,source_relative)?;
    let destination_folder=ensure_filing_folder(root,&segments.join("/"))?;
    let name=source.file_name().ok_or("This file has no usable name")?;
    if !valid_filing_segment(&name.to_string_lossy()){return Err("This file name cannot be safely filed.".into())}
    let destination=destination_folder.join(name);
    if destination.exists(){return Err("A file with this name already exists in that folder. Nothing was replaced.".into())}
    fs::hard_link(&source,&destination).map_err(|_|"This drive cannot safely file the document without replacing an existing item.")?;
    if fs::remove_file(&source).is_err(){let _=fs::remove_file(&destination);return Err("The original file could not be removed after filing. It was left in place.".into())}
    let root=root.canonicalize().map_err(|_|"The selected folder is unavailable. Choose it again.")?;
    let destination_path=destination.strip_prefix(root).map_err(|_|"The filed item escaped the selected library.")?.components().map(|part|part.as_os_str().to_string_lossy()).collect::<Vec<_>>().join("/");
    Ok(FileMoveResult{source_path:source_relative.into(),destination_path})
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
fn search_tree_with_limits(root:&Path,directory:&Path,query:&str,results:&mut Vec<FileEntry>,scanned:&mut usize,depth:usize,result_limit:usize,scan_limit:usize,truncated:&mut bool)->Result<(),String>{
    const MAX_SEARCH_DEPTH:usize=20;
    if results.len()>=result_limit||*scanned>=scan_limit||depth>=MAX_SEARCH_DEPTH{*truncated=true;return Ok(())}
    for item in fs::read_dir(directory).map_err(|_|"Could not search this folder")?{
        if results.len()>=result_limit||*scanned>=scan_limit{*truncated=true;break}
        *scanned+=1;let Ok(item)=item else{continue};
        if item.file_type().map(|kind|kind.is_symlink()).unwrap_or(true){continue}
        let target=match item.path().canonicalize(){Ok(value) if value.starts_with(root)=>value,_=>continue};
        let Ok(metadata)=fs::metadata(&target)else{continue};if !metadata.is_file()&&!metadata.is_dir(){continue}
        let name=item.file_name().to_string_lossy().into_owned();
        let relative=target.strip_prefix(root).map_err(|_|"Search result escaped its selected folder")?.components().map(|part|part.as_os_str().to_string_lossy()).collect::<Vec<_>>().join("/");
        if name.to_lowercase().contains(query){results.push(FileEntry{name,path:relative,directory:metadata.is_dir(),size:metadata.len(),blocked:metadata.is_file()&&blocked(&target)})}
        if metadata.is_dir(){search_tree_with_limits(root,&target,query,results,scanned,depth+1,result_limit,scan_limit,truncated)?}
    }
    Ok(())
}
fn search_tree(root:&Path,directory:&Path,query:&str,results:&mut Vec<FileEntry>,scanned:&mut usize,depth:usize)->Result<(),String>{
    let mut truncated=false;search_tree_with_limits(root,directory,query,results,scanned,depth,500,10_000,&mut truncated)
}

const NOTE_LIBRARY_MAX_FILES:usize=500;
const NOTE_LIBRARY_MAX_BYTES:u64=1_000_000;
const NOTE_LIBRARY_MAX_CHARS:usize=256_000;
const NOTE_LIBRARY_MAX_DIRECTORIES:usize=2000;
const NOTE_LIBRARY_MAX_DEPTH:usize=24;
const NOTE_LIBRARY_MAX_SCANNED_ENTRIES:usize=10000;
const NOTE_LIBRARY_SEARCH_MAX_QUERY_CHARS:usize=120;
const NOTE_LIBRARY_SEARCH_MAX_BYTES:u64=20*1024*1024;
const NOTE_LIBRARY_SEARCH_MAX_RESULTS:usize=100;
#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub(crate) struct NoteLibraryEntry { path:String, name:String, size:u64 }
#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub(crate) struct NoteLibrarySearchEntry { path:String, name:String, size:u64, snippet:String }
#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub(crate) struct NoteLibrarySearchResult { results:Vec<NoteLibrarySearchEntry>, truncated:bool }
fn supported_note(path:&Path)->bool{
    matches!(path.extension().and_then(|value|value.to_str()).unwrap_or("").to_ascii_lowercase().as_str(),"md"|"markdown"|"txt")
}
fn previewable_library_file(path:&Path)->bool{
    supported_note(path)||matches!(path.extension().and_then(|value|value.to_str()).unwrap_or("").to_ascii_lowercase().as_str(),"pdf"|"csv"|"log"|"png"|"jpg"|"jpeg"|"gif"|"webp"|"bmp"|"mp4"|"m4v"|"webm"|"mp3"|"wav"|"ogg")
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
        let size_limit=if supported_note(&target){NOTE_LIBRARY_MAX_BYTES}else{20*1024*1024};
        if !metadata.is_file()||!previewable_library_file(&target)||metadata.len()>size_limit{continue}
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
    let root=roots.root(id)?.canonicalize().map_err(|_|"The selected notes folder is unavailable. Choose it again.")?;
    read_note_from_root_limited(&root,relative,NOTE_LIBRARY_MAX_BYTES)
}
fn read_note_from_root_limited(root:&Path,relative:&str,max_bytes:u64)->Result<String,String>{
    let target=resolve(root,relative)?;
    if !supported_note(&target){return Err("Choose a Markdown or text file inside the selected notes folder".into())}
    let metadata=fs::metadata(&target).map_err(|_|"This note is no longer available")?;
    let cap=max_bytes.min(NOTE_LIBRARY_MAX_BYTES);
    if metadata.len()>cap{return Err("This note exceeds the available search read limit.".into())}
    let mut bytes=Vec::with_capacity(metadata.len() as usize);
    fs::File::open(target).map_err(|_|"Could not read this note")?.take(cap+1).read_to_end(&mut bytes).map_err(|_|"Could not read this note")?;
    if bytes.len() as u64>cap{return Err("This note exceeds the available search read limit.".into())}
    let text=String::from_utf8(bytes).map_err(|_|"This note is not valid UTF-8 and cannot be edited here.")?;
    if text.chars().count()>NOTE_LIBRARY_MAX_CHARS{return Err("This note is larger than Still's 256,000-character editing limit.".into())}
    Ok(text)
}
fn note_search_snippet(text:&str,needle:&str)->String{
    let lower=text.to_lowercase();
    let match_byte=lower.find(needle).unwrap_or(0);
    let match_char=lower[..match_byte].chars().count();
    let chars=text.chars().collect::<Vec<_>>();
    let start=match_char.saturating_sub(88).min(chars.len());
    let end=(start+224).min(chars.len());
    let mut snippet=String::new();
    if start>0{snippet.push('…')}
    snippet.extend(chars[start..end].iter());
    if end<chars.len(){snippet.push('…')}
    snippet
}
fn search_notes_in_root(root:&Path,query:&str)->Result<NoteLibrarySearchResult,String>{
    let needle=query.trim().to_lowercase();
    if needle.is_empty(){return Ok(NoteLibrarySearchResult{results:Vec::new(),truncated:false})}
    if needle.chars().count()>NOTE_LIBRARY_SEARCH_MAX_QUERY_CHARS{return Err("Search text is limited to 120 characters.".into())}
    let mut files=Vec::new();let(mut directories,mut scanned)=(0,0);
    collect_note_files(root,root,&mut files,&mut directories,&mut scanned,0)?;
    files.sort_by(|a,b|a.path.to_lowercase().cmp(&b.path.to_lowercase()));
    let mut remaining=NOTE_LIBRARY_SEARCH_MAX_BYTES;let mut results=Vec::new();let mut truncated=false;
    for file in files.iter().filter(|item|supported_note(Path::new(&item.path))){
        if results.len()>=NOTE_LIBRARY_SEARCH_MAX_RESULTS{truncated=true;break}
        if remaining==0{truncated=true;break}
        let text=match read_note_from_root_limited(root,&file.path,remaining){Ok(value)=>value,Err(_)=>{truncated=true;continue}};
        remaining=remaining.saturating_sub(text.len() as u64);
        if text.to_lowercase().contains(&needle){
            let snippet=note_search_snippet(&text,&needle);
            results.push(NoteLibrarySearchEntry{path:file.path.clone(),name:file.name.clone(),size:file.size,snippet});
        }
    }
    if remaining==0{truncated=true}
    Ok(NoteLibrarySearchResult{results,truncated})
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
fn create_note_file(roots:&FolderRoots,id:&str,location:&str,title:&str)->Result<NoteLibraryEntry,String>{
    valid_id(id)?;
    let clean=title.trim();
    if clean.is_empty()||clean.len()>80||clean.chars().any(|c|c.is_control()||matches!(c,'/'|'\\'|':'|'*'|'?'|'"'|'<'|'>'|'|')){
        return Err("Use a note name up to 80 characters without file-path symbols.".into())
    }
    let root=roots.root(id)?.canonicalize().map_err(|_|"The selected notes folder is unavailable. Choose it again.")?;
    let directory=resolve(&root,location)?;
    if !directory.is_dir(){return Err("Choose a folder in the notes library.".into())}
    let target=directory.join(format!("{clean}.md"));
    if target.exists(){return Err("A note with that name already exists in this folder.".into())}
    let relative=target.strip_prefix(&root).map_err(|_|"Choose a folder inside the notes library.")?.components().map(|part|part.as_os_str().to_string_lossy()).collect::<Vec<_>>().join("/");
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
pub async fn notes_library_search(webview:Webview,roots:State<'_,FolderRoots>,id:String,query:String)->Result<NoteLibrarySearchResult,String>{
    crate::security::authorize(&webview)?;valid_id(&id)?;
    if query.chars().count()>NOTE_LIBRARY_SEARCH_MAX_QUERY_CHARS{return Err("Search text is limited to 120 characters.".into())}
    let root=roots.root(&id)?.canonicalize().map_err(|_|"The selected notes folder is unavailable. Choose it again.")?;
    tauri::async_runtime::spawn_blocking(move||search_notes_in_root(&root,&query)).await.map_err(|_|"Could not search this notes library")?
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
pub async fn notes_library_create(webview:Webview,roots:State<'_,FolderRoots>,id:String,location:String,title:String)->Result<NoteLibraryEntry,String>{
    crate::security::authorize(&webview)?;create_note_file(&roots,&id,&location,&title)
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
pub async fn files_still_inbox(app:AppHandle,webview:Webview,roots:State<'_,FolderRoots>,id:String)->Result<StillInbox,String>{
    crate::security::authorize(&webview)?;valid_id(&id)?;
    let documents=app.path().document_dir().map_err(|_|"Could not locate your Documents folder")?;
    let path=documents.join("Still").join("Downloads");
    fs::create_dir_all(&path).map_err(|_|"Could not create the Still Downloads inbox")?;
    let path=path.canonicalize().map_err(|_|"Could not open the Still Downloads inbox")?;
    // Keep an opaque built-in source grant for saved Files shortcuts, then bind
    // this widget instance to the same root. The UI never supplies a path.
    let source="still-downloads-inbox";
    set_root_and_persist(&roots,source,path.clone(),|roots|persist_roots(&app,roots))?;
    set_root_and_persist(&roots,&id,path.clone(),|roots|persist_roots(&app,roots))?;
    let listing=listing(&path,"")?;
    Ok(StillInbox{listing,path:path.to_string_lossy().into_owned()})
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
pub async fn files_search(webview:Webview,roots:State<'_,FolderRoots>,id:String,query:String)->Result<Vec<FileEntry>,String>{
    crate::security::authorize(&webview)?;valid_id(&id)?;
    let query=query.trim().to_lowercase();if query.is_empty()||query.len()>100{return Err("Enter a search term up to 100 characters.".into())}
    let root=roots.root(&id)?.canonicalize().map_err(|_|"The selected folder is unavailable. Choose it again.")?;
    let mut results=Vec::new();let mut scanned=0;search_tree(&root,&root,&query,&mut results,&mut scanned,0)?;
    results.sort_by(|a,b|a.path.to_lowercase().cmp(&b.path.to_lowercase()));Ok(results)
}
#[tauri::command]
pub async fn files_library_search(webview:Webview,roots:State<'_,FolderRoots>,ids:Vec<String>,query:String)->Result<LibrarySearchResponse,String>{
    crate::security::authorize(&webview)?;
    const MAX_LIBRARY_SEARCH_WIDGETS:usize=40;const MAX_LIBRARY_SEARCH_RESULTS:usize=500;const MAX_LIBRARY_SEARCH_ENTRIES:usize=20_000;
    if ids.is_empty()||ids.len()>MAX_LIBRARY_SEARCH_WIDGETS{return Err("Choose between one and 40 Library folders to search.".into())}
    let query=query.trim().to_lowercase();if query.is_empty()||query.len()>100{return Err("Enter a search term up to 100 characters.".into())}
    let mut results=Vec::new();let mut unavailable_widget_ids=Vec::new();let mut scanned=0;let mut truncated=false;let mut seen=Vec::new();
    for id in ids{
        valid_id(&id)?;if seen.contains(&id){continue}seen.push(id.clone());
        if results.len()>=MAX_LIBRARY_SEARCH_RESULTS||scanned>=MAX_LIBRARY_SEARCH_ENTRIES{truncated=true;break}
        let root=match roots.root(&id).and_then(|path|path.canonicalize().map_err(|_|"The selected folder is unavailable. Choose it again.".to_string())){Ok(path)=>path,Err(_)=>{unavailable_widget_ids.push(id);continue}};
        if !root.is_dir(){unavailable_widget_ids.push(id);continue}
        let mut entries=Vec::new();let remaining=MAX_LIBRARY_SEARCH_RESULTS-results.len();
        if search_tree_with_limits(&root,&root,&query,&mut entries,&mut scanned,0,remaining,MAX_LIBRARY_SEARCH_ENTRIES,&mut truncated).is_err(){unavailable_widget_ids.push(id.clone())}
        results.extend(entries.into_iter().map(|entry|LibrarySearchHit{widget_id:id.clone(),entry}));
        if truncated{break}
    }
    results.sort_by(|a,b|a.entry.path.to_lowercase().cmp(&b.entry.path.to_lowercase()));
    Ok(LibrarySearchResponse{results,unavailable_widget_ids,truncated})
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
#[tauri::command]
pub async fn files_extract_pdf_text(webview:Webview,roots:State<'_,FolderRoots>,id:String,path:String)->Result<ExtractedPdfText,String>{
    crate::security::authorize(&webview)?;valid_id(&id)?;
    let target=resolve(&roots.root(&id)?,&path)?;
    if blocked(&target){return Err("Programs and shortcuts cannot be read for AI.".into())}
    tauri::async_runtime::spawn_blocking(move||extract_pdf_text(&target)).await.map_err(|_|"Could not extract text from this PDF")?
}
#[tauri::command]
pub async fn files_move_resource(webview:Webview,roots:State<'_,FolderRoots>,id:String,source_path:String,destination_folder:String)->Result<FileMoveResult,String>{
    crate::security::authorize(&webview)?;valid_id(&id)?;
    let root=roots.root(&id)?;
    tauri::async_runtime::spawn_blocking(move||move_file_within_root(&root,&source_path,&destination_folder)).await.map_err(|_|"Could not file this item")?
}
fn managed_resource(root:&Path,relative:&str)->Result<PathBuf,String>{
    let root=root.canonicalize().map_err(|_|"The selected folder is unavailable. Choose it again.")?;
    if relative.is_empty()||relative.len()>1000||relative.contains(':')||relative.contains('\\')||relative.contains('\0')||relative.split('/').any(|part|!valid_filing_segment(part)){
        return Err("Choose an item within the selected Files folder.".into())
    }
    let mut current=root.clone();
    for (index,part) in relative.split('/').enumerate(){
        current.push(part);
        let metadata=fs::symlink_metadata(&current).map_err(|_|"This file or folder is no longer available")?;
        if metadata.file_type().is_symlink(){return Err("Still cannot change a linked item in the Library.".into())}
        if index+1<relative.split('/').count()&&!metadata.is_dir(){return Err("The selected path contains a non-folder item.".into())}
    }
    let path=current.canonicalize().map_err(|_|"This file or folder is no longer available")?;
    if !path.starts_with(&root)||path==root{return Err("Choose an item inside the selected Files folder.".into())}
    if path.is_file()&&blocked(&path){return Err("Programs and shortcuts cannot be edited in the Library.".into())}
    Ok(path)
}
fn managed_folder(root:&Path,relative:&str)->Result<PathBuf,String>{
    let root=root.canonicalize().map_err(|_|"The selected folder is unavailable. Choose it again.")?;
    if relative.is_empty(){return Ok(root)}
    if relative.len()>1000||relative.contains(':')||relative.contains('\\')||relative.contains('\0')||relative.split('/').any(|part|!valid_filing_segment(part)){return Err("Choose a destination folder in this Files library.".into())}
    let mut current=root.clone();for part in relative.split('/') {current.push(part);let metadata=fs::symlink_metadata(&current).map_err(|_|"Choose an existing destination folder in this Files library")?;if metadata.file_type().is_symlink()||!metadata.is_dir(){return Err("The destination must be an ordinary folder in this Files library.".into())}}
    current=current.canonicalize().map_err(|_|"The destination folder is unavailable")?;if !current.starts_with(&root){return Err("The destination is outside the selected Files folder.".into())}Ok(current)
}
fn create_text_within_root(root:&Path,relative:&str,text:&str)->Result<ManagedFileResult,String>{
    const MAX_CREATE_BYTES:usize=1_000_000;
    if text.len()>MAX_CREATE_BYTES{return Err("New text files are limited to 1 MB.".into())}
    let root=root.canonicalize().map_err(|_|"The selected folder is unavailable. Choose it again.")?;
    if relative.is_empty()||relative.len()>1000||relative.contains(':')||relative.contains('\\')||relative.contains('\0')||relative.split('/').any(|part|!valid_filing_segment(part)){
        return Err("Choose a relative file path inside the selected Files folder.".into())
    }
    let extension=Path::new(relative).extension().and_then(|value|value.to_str()).unwrap_or("");
    if !extension.eq_ignore_ascii_case("txt")&&!extension.eq_ignore_ascii_case("md"){
        return Err("Create supports .txt and .md files only.".into())
    }
    let parent_relative=Path::new(relative).parent().filter(|path|!path.as_os_str().is_empty()).map(|path|path.to_string_lossy().replace('\\',"/" )).unwrap_or_default();
    let parent=managed_folder(&root,&parent_relative)?;
    let name=Path::new(relative).file_name().ok_or("Choose a file name.")?;
    if !valid_filing_segment(&name.to_string_lossy()){return Err("Choose a safe file name.".into())}
    let target=parent.join(name);
    let mut file=fs::OpenOptions::new().write(true).create_new(true).open(&target).map_err(|error|{
        if error.kind()==std::io::ErrorKind::AlreadyExists{"A file with that path already exists. Nothing was replaced."}else{"Could not create this text file in the selected folder."}
    })?;
    if file.write_all(text.as_bytes()).and_then(|_|file.sync_all()).is_err(){drop(file);return match fs::remove_file(&target){Ok(())=>Err("Could not finish writing this text file. No file was saved.".into()),Err(_)=>Err("Could not finish writing this text file; an incomplete file may remain. Check the folder before retrying.".into())}}
    Ok(ManagedFileResult{action:"createText".into(),source_path:relative.into(),destination_path:relative.into()})
}
fn name_collision(parent:&Path,name:&str)->Result<bool,String>{
    for entry in fs::read_dir(parent).map_err(|_|"Could not inspect the destination folder")?{let entry=entry.map_err(|_|"Could not inspect the destination folder")?;if entry.file_name().to_string_lossy().eq_ignore_ascii_case(name){return Ok(true)}}Ok(false)
}
pub(crate) fn manage_resource_within_root(root:&Path,source_relative:&str,action:ManagedFileAction)->Result<ManagedFileResult,String>{
    let action=match action{ManagedFileAction::CreateText{text}=>return create_text_within_root(root,source_relative,&text),other=>other};
    let root=root.canonicalize().map_err(|_|"The selected folder is unavailable. Choose it again.")?;let source=managed_resource(&root,source_relative)?;
    let (action_name,destination_path)=match action{
        ManagedFileAction::Rename{name}=>{
            if !valid_filing_segment(&name)||source.is_file()&&source.file_name().is_some_and(|old|old.to_string_lossy().rsplit_once('.').map(|x|x.1.to_ascii_lowercase())!=name.rsplit_once('.').map(|x|x.1.to_ascii_lowercase())){return Err("Use a safe name and keep the file extension unchanged.".into())}
            let parent=source.parent().ok_or("Choose an item inside the selected Files folder")?;if name_collision(parent,&name)?{return Err("An item with that name already exists in this folder. Nothing was replaced.".into())}
            let target=parent.join(name);fs::rename(&source,&target).map_err(|_|"Could not rename this item. Check that it is not open in another app.")?;
            let relative=target.strip_prefix(&root).map_err(|_|"The renamed item escaped the selected Files folder")?.components().map(|part|part.as_os_str().to_string_lossy()).collect::<Vec<_>>().join("/");("rename",relative)
        },
        ManagedFileAction::Move{destination_folder}=>{
            let folder=managed_folder(&root,&destination_folder)?;if source.is_dir()&&folder.starts_with(&source){return Err("A folder cannot be moved into itself.".into())}
            let name=source.file_name().ok_or("This item has no usable name")?.to_string_lossy().into_owned();if name_collision(&folder,&name)?{return Err("An item with that name already exists in the destination. Nothing was replaced.".into())}
            let target=folder.join(name);fs::rename(&source,&target).map_err(|_|"Could not move this item. Check that it is not open in another app.")?;
            let relative=target.strip_prefix(&root).map_err(|_|"The moved item escaped the selected Files folder")?.components().map(|part|part.as_os_str().to_string_lossy()).collect::<Vec<_>>().join("/");("move",relative)
        },
        ManagedFileAction::Delete=>{
            if source.is_dir(){if fs::read_dir(&source).map_err(|_|"Could not inspect this folder")?.next().is_some(){return Err("Only empty folders can be deleted. Move or delete their contents first.".into())}fs::remove_dir(&source).map_err(|_|"Could not delete this empty folder")?;}else{fs::remove_file(&source).map_err(|_|"Could not delete this file")?;}("delete",String::new())
        },
        ManagedFileAction::EditText{text,expected_text}=>{
            const MAX_EDIT_BYTES:usize=1_000_000;
            let extension=source.extension().and_then(|item|item.to_str()).unwrap_or("").to_ascii_lowercase();if !source.is_file()||!matches!(extension.as_str(),"txt"|"md"|"csv"|"log")||text.len()>MAX_EDIT_BYTES||expected_text.len()>MAX_EDIT_BYTES{return Err("Edit supports text, Markdown, CSV, and log files up to 1 MB.".into())}
            let current=fs::read_to_string(&source).map_err(|_|"This text file is unavailable or is not valid UTF-8")?;if current!=expected_text{return Err("This file changed since it was opened. Reload it before saving.".into())}
            fs::write(&source,text).map_err(|_|"Could not save this text file. Check that it is writable")?;("editText",source_relative.into())
        }
        ManagedFileAction::CreateText{..}=>unreachable!("handled before resolving an existing source"),
    };
    Ok(ManagedFileResult{action:action_name.into(),source_path:source_relative.into(),destination_path})
}
#[tauri::command]
pub async fn files_manage_resource(webview:Webview,roots:State<'_,FolderRoots>,id:String,source_path:String,action:ManagedFileAction)->Result<ManagedFileResult,String>{
    crate::security::authorize(&webview)?;valid_id(&id)?;let root=roots.root(&id)?;
    tauri::async_runtime::spawn_blocking(move||manage_resource_within_root(&root,&source_path,action)).await.map_err(|_|"Could not manage this Library item")?
}
#[cfg(test)]
mod tests {
    use super::*;
    fn temp_root(label:&str)->PathBuf{let root=std::env::temp_dir().join(format!("still-library-{label}-{}",uuid::Uuid::new_v4()));fs::create_dir_all(&root).unwrap();root}
    #[test]
    fn managed_files_rename_move_edit_delete_and_reject_escape(){
        let root=temp_root("managed");fs::write(root.join("draft.md"),"old").unwrap();fs::create_dir(root.join("Course")).unwrap();
        let renamed=manage_resource_within_root(&root,"draft.md",ManagedFileAction::Rename{name:"notes.md".into()}).unwrap();assert_eq!(renamed.destination_path,"notes.md");
        let edited=manage_resource_within_root(&root,"notes.md",ManagedFileAction::EditText{text:"new".into(),expected_text:"stale".into()}).unwrap_err();assert!(edited.contains("changed"));
        // Text writes require the exact current version; the stale edit left it untouched.
        assert_eq!(fs::read_to_string(root.join("notes.md")).unwrap(),"old");
        manage_resource_within_root(&root,"notes.md",ManagedFileAction::EditText{text:"new".into(),expected_text:"old".into()}).unwrap();assert_eq!(fs::read_to_string(root.join("notes.md")).unwrap(),"new");
        let moved=manage_resource_within_root(&root,"notes.md",ManagedFileAction::Move{destination_folder:"Course".into()}).unwrap();assert_eq!(moved.destination_path,"Course/notes.md");
        assert!(manage_resource_within_root(&root,"../outside.txt",ManagedFileAction::Delete).is_err());
        manage_resource_within_root(&root,"Course/notes.md",ManagedFileAction::Delete).unwrap();assert!(root.join("Course").is_dir());
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn managed_delete_only_removes_empty_folders_and_refuses_overwrite(){
        let root=temp_root("delete");fs::create_dir(root.join("Folder")).unwrap();fs::write(root.join("Folder/keep.md"),"keep").unwrap();fs::write(root.join("same.txt"),"one").unwrap();fs::write(root.join("Folder/same.txt"),"two").unwrap();
        assert!(manage_resource_within_root(&root,"Folder",ManagedFileAction::Delete).unwrap_err().contains("empty"));
        assert!(manage_resource_within_root(&root,"same.txt",ManagedFileAction::Move{destination_folder:"Folder".into()}).unwrap_err().contains("already exists"));
        assert!(root.join("same.txt").exists());fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn creates_only_new_markdown_or_text_files_inside_the_granted_root(){
        let fixture=temp_root("create-text");let root=fixture.join("chosen");fs::create_dir_all(root.join("Course")).unwrap();
        let created=manage_resource_within_root(&root,"Course/lecture.md",ManagedFileAction::CreateText{text:"# New notes\n".into()}).unwrap();
        assert_eq!(created.action,"createText");assert_eq!(created.source_path,"Course/lecture.md");assert_eq!(created.destination_path,"Course/lecture.md");assert_eq!(fs::read_to_string(root.join("Course/lecture.md")).unwrap(),"# New notes\n");
        assert!(manage_resource_within_root(&root,"Course/lecture.md",ManagedFileAction::CreateText{text:"replacement".into()}).unwrap_err().contains("already exists"));
        assert_eq!(fs::read_to_string(root.join("Course/lecture.md")).unwrap(),"# New notes\n");
        for path in ["Course/file.csv","../escape.txt","C:/outside.txt","Course/missing/new.txt"]{assert!(manage_resource_within_root(&root,path,ManagedFileAction::CreateText{text:"x".into()}).is_err(),"{path}");}
        assert!(!fixture.join("escape.txt").exists());fs::remove_dir_all(fixture).unwrap();
    }
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
        fs::write(root.join("course/diagram.pdf"),b"%PDF sample").unwrap();
        let mut entries=Vec::new();let(mut directories,mut scanned)=(0,0);collect_note_files(&root,&root,&mut entries,&mut directories,&mut scanned,0).unwrap();assert_eq!(entries.len(),3);assert!(entries.iter().any(|entry|entry.path=="course/week1.MARKDOWN"));assert!(entries.iter().any(|entry|entry.path=="course/diagram.pdf"));
        assert_eq!(read_note_file(&roots,"notes-widget","course/week1.MARKDOWN").unwrap(),"first draft");
        assert!(read_note_file(&roots,"notes-widget","large-chars.md").unwrap_err().contains("256,000-character"));
        write_note_file(&roots,"notes-widget","course/week1.MARKDOWN","saved update","first draft").unwrap();assert_eq!(fs::read_to_string(root.join("course/week1.MARKDOWN")).unwrap(),"saved update");
        fs::write(root.join("course/week1.MARKDOWN"),"edited outside Still").unwrap();
        assert!(write_note_file(&roots,"notes-widget","course/week1.MARKDOWN","stale overwrite","saved update").unwrap_err().contains("changed outside Still"));
        let created=create_note_file(&roots,"notes-widget","course","Week two").unwrap();assert_eq!(created.path,"course/Week two.md");assert_eq!(fs::read_to_string(root.join("course/Week two.md")).unwrap(),"");
        assert!(create_note_file(&roots,"notes-widget","course","Week two").is_err());assert!(create_note_file(&roots,"notes-widget","../outside","Nope").is_err());
        assert!(read_note_file(&roots,"notes-widget","../ignored.html").is_err());assert!(write_note_file(&roots,"notes-widget","ignored.html","no","").is_err());
        assert!(write_note_file(&roots,"notes-widget","course/week1.MARKDOWN",&"x".repeat((NOTE_LIBRARY_MAX_BYTES+1) as usize),"").is_err());
        fs::remove_dir_all(fixture).unwrap();
    }
    #[test]fn files_can_be_filed_only_inside_the_granted_root_without_overwriting(){
        let fixture=std::env::temp_dir().join(format!("still-file-move-{}-{}",std::process::id(),std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
        let root=fixture.join("inbox");fs::create_dir_all(&root).unwrap();fs::write(root.join("lecture.pdf"),b"course material").unwrap();
        let moved=move_file_within_root(&root,"lecture.pdf","Courses/CHEM111").unwrap();
        assert_eq!(moved.source_path,"lecture.pdf");assert_eq!(moved.destination_path,"Courses/CHEM111/lecture.pdf");assert_eq!(fs::read(root.join(&moved.destination_path)).unwrap(),b"course material");assert!(!root.join("lecture.pdf").exists());
        assert!(move_file_within_root(&root,&moved.destination_path,"../../outside").is_err());
        assert!(move_file_within_root(&root,&moved.destination_path,"CON").is_err());
        fs::write(root.join("collision.pdf"),b"new source").unwrap();fs::write(root.join("Courses/CHEM111/collision.pdf"),b"keep target").unwrap();
        assert!(move_file_within_root(&root,"collision.pdf","Courses/CHEM111").is_err());assert_eq!(fs::read(root.join("collision.pdf")).unwrap(),b"new source");assert_eq!(fs::read(root.join("Courses/CHEM111/collision.pdf")).unwrap(),b"keep target");
        fs::write(root.join("setup.exe"),b"program").unwrap();assert!(move_file_within_root(&root,"setup.exe","Courses").is_err());
        fs::remove_dir_all(fixture).unwrap();
    }
}
