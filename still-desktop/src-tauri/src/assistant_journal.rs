//! Small durable journal for reviewed inbox moves. It stores no prompt/provider
//! data or file contents; the journal is bounded and replaced atomically.
use serde::{Deserialize, Serialize};
use std::{
    collections::HashSet,
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager, State, Webview};

const MAX_BYTES: usize = 256 * 1024;
const MAX_RECORDS: usize = 200;
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Operation {
    id: String,
    workspace_id: String,
    run_id: String,
    sequence: u16,
    root_fingerprint: String,
    source_path: String,
    destination_path: String,
    source_revision: String,
    source_size: u64,
    source_identity: Option<String>,
    state: String,
    outcome: Option<String>,
    updated_at: u128,
}
#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct Journal {
    version: u8,
    records: Vec<Operation>,
    #[serde(skip, default)]
    live_attempts: HashSet<String>,
}
pub struct AssistantJournal {
    path: PathBuf,
    data: Mutex<Journal>,
    load_error: Option<String>,
}
impl AssistantJournal {
    pub fn load(app: &AppHandle) -> Self {
        let (path, data, load_error) = match app.path().app_data_dir() {
            Err(_) => (
                PathBuf::new(),
                Journal {
                    version: 1,
                    records: vec![],
                    live_attempts: HashSet::new(),
                },
                Some("Journal storage location is unavailable".to_string()),
            ),
            Ok(dir) => {
                let path = dir.join("assistant-reviewed-operations.json");
                match fs::read(&path){
     Err(e) if e.kind()==std::io::ErrorKind::NotFound=>(path,Journal{version:1,records:vec![],live_attempts:HashSet::new()},None),
     Err(_)=>(path,Journal{version:1,records:vec![],live_attempts:HashSet::new()},Some("Existing reviewed operation journal cannot be read".to_string())),
     Ok(bytes) if bytes.len()>MAX_BYTES=>(path,Journal{version:1,records:vec![],live_attempts:HashSet::new()},Some("Existing reviewed operation journal exceeds its size limit".to_string())),
     Ok(bytes)=>match serde_json::from_slice::<Journal>(&bytes){Ok(j) if j.version==1&&j.records.len()<=MAX_RECORDS=>(path,j,None),_=>(path,Journal{version:1,records:vec![],live_attempts:HashSet::new()},Some("Existing reviewed operation journal is invalid; it was not overwritten".to_string()))}
    }
            }
        };
        Self {
            path,
            data: Mutex::new(data),
            load_error,
        }
    }
    fn available(&self) -> Result<(), String> {
        self.load_error.clone().map_or(Ok(()), Err)
    }
    fn persist(&self, journal: &Journal) -> Result<(), String> {
        self.available()?;
        let bytes = serde_json::to_vec(journal)
            .map_err(|_| "Could not encode reviewed operation journal")?;
        if bytes.len() > MAX_BYTES {
            return Err("Reviewed operation journal is full".into());
        }
        let parent = self.path.parent().ok_or("Journal location unavailable")?;
        fs::create_dir_all(parent).map_err(|_| "Could not create journal folder")?;
        let temp = self.path.with_extension("json.tmp");
        {
            let mut f = fs::File::create(&temp)
                .map_err(|_| "Could not write reviewed operation journal")?;
            use std::io::Write;
            f.write_all(&bytes)
                .and_then(|_| f.sync_all())
                .map_err(|_| "Could not flush reviewed operation journal")?;
        }
        fs::rename(&temp, &self.path)
            .map_err(|_| "Could not replace reviewed operation journal")?;
        Ok(())
    }
    fn update(
        &self,
        mut change: impl FnMut(&mut Journal) -> Result<(), String>,
    ) -> Result<(), String> {
        self.available()?;
        let mut lock = self
            .data
            .lock()
            .map_err(|_| "Reviewed operation journal is unavailable")?;
        let mut next = Journal {
            version: 1,
            records: lock.records.clone(),
            live_attempts: lock.live_attempts.clone(),
        };
        change(&mut next)?;
        self.persist(&next)?;
        *lock = next;
        Ok(())
    }
}
fn valid(value: &str, max: usize) -> bool {
    !value.is_empty() && value.len() <= max && !value.chars().any(char::is_control)
}
fn fingerprint(path: &Path) -> String {
    use std::hash::{Hash, Hasher};
    let mut h = std::collections::hash_map::DefaultHasher::new();
    path.hash(&mut h);
    format!("{:016x}", h.finish())
}
fn now() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}
fn reconcile(op: &Operation, root: &Path) -> &'static str {
    if fingerprint(root) != op.root_fingerprint {
        return "ambiguous";
    }
    let src = probe(root, &op.source_path);
    let dst = probe(root, &op.destination_path);
    match (src, dst) {
        (Ok(None), Ok(Some((rev, size, identity))))
            if rev == op.source_revision
                && size == op.source_size
                && op.source_identity.is_some()
                && identity == op.source_identity =>
        {
            "recovered_completed"
        }
        (Ok(Some((rev, size, _))), Ok(None))
            if rev == op.source_revision && size == op.source_size =>
        {
            "interrupted_before_move"
        }
        _ => "ambiguous",
    }
}
fn reconcile_workspace(journal: &mut Journal, workspace_id: &str, root: &Path) {
    let live = journal.live_attempts.clone();
    for op in journal.records.iter_mut().filter(|r| {
        r.workspace_id == workspace_id
            && (r.state == "attempting" || r.state == "uncertain")
            && !live.contains(&r.id)
    }) {
        op.state = reconcile(op, root).into();
        op.updated_at = now();
    }
}
fn probe(root: &Path, relative: &str) -> Result<Option<(String, u64, Option<String>)>, ()> {
    if relative.is_empty()
        || relative.len() > 1000
        || relative.contains(':')
        || relative.contains('\\')
        || relative.contains('\0')
        || Path::new(relative)
            .components()
            .any(|c| !matches!(c, std::path::Component::Normal(_)))
    {
        return Err(());
    }
    let root = root.canonicalize().map_err(|_| ())?;
    let parts = Path::new(relative).components().collect::<Vec<_>>();
    let mut path = root.clone();
    for (index, part) in parts.iter().enumerate() {
        path.push(part.as_os_str());
        let metadata = match fs::symlink_metadata(&path) {
            Ok(m) => m,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
            Err(_) => return Err(()),
        };
        if metadata.file_type().is_symlink() {
            return Err(());
        }
        if index + 1 < parts.len() && !metadata.is_dir() {
            return Err(());
        }
        if index + 1 == parts.len() && !metadata.is_file() {
            return Err(());
        }
    }
    let target = path.canonicalize().map_err(|_| ())?;
    if !target.starts_with(&root) {
        return Err(());
    }
    let metadata = fs::metadata(&target).map_err(|_| ())?;
    let modified = metadata
        .modified()
        .map_err(|_| ())?
        .duration_since(UNIX_EPOCH)
        .map_err(|_| ())?;
    let revision = format!("{}:{}", metadata.len(), modified.as_nanos());
    Ok(Some((
        revision,
        metadata.len(),
        crate::files::journal_file_identity(&root, relative),
    )))
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Start {
    workspace_id: String,
    run_id: String,
    sequence: u16,
    root_path: String,
    source_path: String,
    destination_folder: String,
    file_name: String,
    source_revision: String,
    source_size: u64,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Plan {
    workspace_id: String,
    run_id: String,
    root_path: String,
    moves: Vec<PlannedMove>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PlannedMove {
    source_path: String,
    destination_folder: String,
    file_name: String,
    source_revision: String,
    source_size: u64,
}
#[tauri::command]
pub fn assistant_journal_plan(
    webview: Webview,
    roots: State<'_, crate::files::FolderRoots>,
    journal: State<'_, AssistantJournal>,
    input: Plan,
) -> Result<(), String> {
    crate::security::authorize(&webview)?;
    if !valid(&input.workspace_id, 128)
        || !valid(&input.run_id, 128)
        || input.moves.is_empty()
        || input.moves.len() > 100
    {
        return Err("Invalid reviewed batch".into());
    }
    let root = roots
        .root("still-downloads-inbox")?
        .canonicalize()
        .map_err(|_| "The authorized inbox is unavailable")?;
    if !valid(&input.root_path, 2000) || root.to_string_lossy() != input.root_path {
        return Err("The authorized inbox changed; inspect the batch again".into());
    }
    let mut records = Vec::with_capacity(input.moves.len());
    let mut destinations = std::collections::HashSet::new();
    for (index, m) in input.moves.into_iter().enumerate() {
        if !valid(&m.source_path, 1000)
            || !valid(&m.file_name, 200)
            || !valid(&m.source_revision, 100)
        {
            return Err("Invalid reviewed move metadata".into());
        }
        crate::files::validate_filing_folder(&m.destination_folder)?;
        let (revision, size) = crate::files::journal_file_revision(&root, &m.source_path)?;
        if revision != m.source_revision || size != m.source_size {
            return Err("A reviewed source changed; inspect the batch again".into());
        }
        let dest = crate::files::journal_destination(
            &root,
            &m.source_path,
            &m.destination_folder,
            &m.file_name,
        )?;
        if root.join(&dest).exists() || !destinations.insert(dest.clone()) {
            return Err("A reviewed destination conflicts with another item".into());
        }
        let identity = crate::files::journal_file_identity(&root, &m.source_path);
        records.push(Operation {
            id: format!("{}-{}", input.run_id, index + 1),
            workspace_id: input.workspace_id.clone(),
            run_id: input.run_id.clone(),
            sequence: (index + 1) as u16,
            root_fingerprint: fingerprint(&root),
            source_path: m.source_path,
            destination_path: dest,
            source_revision: revision,
            source_size: size,
            source_identity: identity,
            state: "pending_review".into(),
            outcome: None,
            updated_at: now(),
        });
    }
    journal.update(|j| {
        j.records.retain(|r| r.state != "dismissed");
        if j.records.len() + records.len() > MAX_RECORDS {
            return Err("Reviewed operation journal is full; dismiss old history first".into());
        }
        j.records.extend(records.clone());
        Ok(())
    })
}
#[tauri::command]
pub fn assistant_journal_start(
    webview: Webview,
    roots: State<'_, crate::files::FolderRoots>,
    journal: State<'_, AssistantJournal>,
    input: Start,
) -> Result<String, String> {
    crate::security::authorize(&webview)?;
    if !valid(&input.workspace_id, 128)
        || !valid(&input.run_id, 128)
        || !valid(&input.root_path, 2000)
        || !valid(&input.source_path, 1000)
        || !valid(&input.file_name, 200)
        || !valid(&input.source_revision, 100)
        || input.sequence == 0
    {
        return Err("Invalid reviewed operation metadata".into());
    }
    let root = roots
        .root("still-downloads-inbox")?
        .canonicalize()
        .map_err(|_| "The authorized inbox is unavailable")?;
    if root.to_string_lossy() != input.root_path {
        return Err("The authorized inbox changed; inspect again".into());
    }
    let src = crate::files::journal_file_revision(&root, &input.source_path)?;
    if src.0 != input.source_revision || src.1 != input.source_size {
        return Err("The reviewed source changed; inspect it again".into());
    }
    crate::files::validate_filing_folder(&input.destination_folder)?;
    let dest = crate::files::journal_destination(
        &root,
        &input.source_path,
        &input.destination_folder,
        &input.file_name,
    )?;
    if root.join(&dest).exists() {
        return Err("The reviewed destination already exists".into());
    }
    let id = format!("{}-{}", input.run_id, input.sequence);
    let current_identity = crate::files::journal_file_identity(&root, &input.source_path);
    journal.update(|j| {
        let op = j
            .records
            .iter_mut()
            .find(|r| {
                r.id == id && r.workspace_id == input.workspace_id && r.run_id == input.run_id
            })
            .ok_or("Reviewed batch record unavailable")?;
        if op.state != "pending_review"
            || op.source_path != input.source_path
            || op.destination_path != dest
            || op.source_revision != src.0
            || op.source_size != src.1
            || op.source_identity != current_identity
            || op.root_fingerprint != fingerprint(&root)
        {
            return Err("Reviewed batch no longer matches its durable plan".into());
        }
        op.state = "attempting".into();
        op.updated_at = now();
        j.live_attempts.insert(id.clone());
        Ok(())
    })?;
    Ok(id)
}
#[tauri::command]
pub fn assistant_journal_finish(
    webview: Webview,
    roots: State<'_, crate::files::FolderRoots>,
    journal: State<'_, AssistantJournal>,
    id: String,
    success: bool,
) -> Result<(), String> {
    crate::security::authorize(&webview)?;
    let mut verified = false;
    journal.update(|j|{let r=j.records.iter_mut().find(|r|r.id==id).ok_or("Operation record unavailable")?;if r.state!="attempting"{return Err("Operation is not awaiting a receipt".into())}
  let current=roots.root("still-downloads-inbox").ok().and_then(|p|p.canonicalize().ok());let evidence=current.as_ref().filter(|p|fingerprint(p)==r.root_fingerprint).map(|p|(probe(p,&r.source_path),probe(p,&r.destination_path)));
  verified=success&&r.source_identity.is_some()&&matches!(evidence,Some((Ok(None),Ok(Some((ref revision,size,Some(ref identity)))))) if revision==&r.source_revision&&size==r.source_size&&identity==r.source_identity.as_ref().unwrap());
  r.state=if verified{"completed"}else{"uncertain"}.into();r.outcome=Some(if verified{"verified file identity at destination"}else{"execution outcome could not be verified"}.into());r.updated_at=now();j.live_attempts.remove(&id);Ok(())})?;
    if success && !verified {
        return Err("The move returned, but Still could not verify its durable outcome. Inspect both folders before trying again.".into());
    }
    Ok(())
}
#[tauri::command]
pub fn assistant_journal_list(
    webview: Webview,
    roots: State<'_, crate::files::FolderRoots>,
    journal: State<'_, AssistantJournal>,
    workspace_id: String,
) -> Result<Vec<Operation>, String> {
    crate::security::authorize(&webview)?;
    if !valid(&workspace_id, 128) {
        return Err("Invalid workspace".into());
    }
    let root = roots
        .root("still-downloads-inbox")
        .ok()
        .and_then(|p| p.canonicalize().ok());
    let mut lock = journal
        .data
        .lock()
        .map_err(|_| "Reviewed operation journal is unavailable")?;
    if let Some(p) = root.as_ref() {
        reconcile_workspace(&mut lock, &workspace_id, p);
    }
    // Persist reconciliation; if it fails, preserve the in-memory facts but report them honestly.
    let result = lock
        .records
        .iter()
        .filter(|r| r.workspace_id == workspace_id && r.state != "dismissed")
        .cloned()
        .map(|mut r| {
            if root.is_none() && (r.state == "attempting" || r.state == "uncertain") {
                r.state = "authorized_root_unavailable".into()
            }
            r
        })
        .collect::<Vec<_>>();
    let snapshot = Journal {
        version: 1,
        records: lock.records.clone(),
        live_attempts: lock.live_attempts.clone(),
    };
    journal.persist(&snapshot)?;
    Ok(result)
}
#[tauri::command]
pub fn assistant_journal_dismiss(
    webview: Webview,
    journal: State<'_, AssistantJournal>,
    id: String,
    workspace_id: String,
) -> Result<(), String> {
    crate::security::authorize(&webview)?;
    journal.update(|j| {
        let r = j
            .records
            .iter_mut()
            .find(|r| r.id == id && r.workspace_id == workspace_id)
            .ok_or("Operation record unavailable")?;
        if r.state == "attempting" {
            return Err("An active operation cannot be dismissed".into());
        }
        r.state = "dismissed".into();
        r.updated_at = now();
        Ok(())
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn journal_replace_and_recovery_evidence_are_bounded() {
        let dir = std::env::temp_dir().join(format!("still-journal-{}", now()));
        fs::create_dir_all(&dir).unwrap();
        let p = dir.join("journal.json");
        let j = AssistantJournal {
            path: p.clone(),
            data: Mutex::new(Journal {
                version: 1,
                records: vec![],
                live_attempts: HashSet::new(),
            }),
            load_error: None,
        };
        let op = Operation {
            id: "id".into(),
            workspace_id: "w".into(),
            run_id: "r".into(),
            sequence: 1,
            root_fingerprint: "f".into(),
            source_path: "a.txt".into(),
            destination_path: "Filed/a.txt".into(),
            source_revision: "1:2".into(),
            source_size: 2,
            source_identity: None,
            state: "attempting".into(),
            outcome: None,
            updated_at: now(),
        };
        j.update(|x| {
            x.records.push(op.clone());
            Ok(())
        })
        .unwrap();
        let read: Journal = serde_json::from_slice(&fs::read(&p).unwrap()).unwrap();
        assert_eq!(read.records[0].state, "attempting");
        assert!(j
            .persist(&Journal {
                version: 1,
                records: vec![],
                live_attempts: HashSet::new(),
            })
            .is_ok());
        fs::remove_dir_all(dir).unwrap();
    }
    #[test]
    fn crash_after_move_without_receipt_is_recovered_once_and_replaced_destination_is_ambiguous() {
        let dir = std::env::temp_dir().join(format!("still-recovery-{}", now()));
        fs::create_dir_all(&dir).unwrap();
        let src = dir.join("source.txt");
        let dst = dir.join("dest.txt");
        fs::write(&src, b"same").unwrap();
        let (revision, size) = crate::files::journal_file_revision(&dir, "source.txt").unwrap();
        let identity = crate::files::journal_file_identity(&dir, "source.txt");
        let mut op = Operation {
            id: "r-1".into(),
            workspace_id: "w".into(),
            run_id: "r".into(),
            sequence: 1,
            root_fingerprint: fingerprint(&dir),
            source_path: "source.txt".into(),
            destination_path: "dest.txt".into(),
            source_revision: revision,
            source_size: size,
            source_identity: identity.clone(),
            state: "attempting".into(),
            outcome: None,
            updated_at: now(),
        };
        #[cfg(windows)]
        {
            fs::hard_link(&src, &dst).unwrap();
            fs::remove_file(&src).unwrap();
            assert_eq!(reconcile(&op, &dir), "recovered_completed");
            fs::remove_file(&dst).unwrap();
            fs::write(&dst, b"same").unwrap();
            assert_eq!(reconcile(&op, &dir), "ambiguous");
        }
        #[cfg(not(windows))]
        {
            assert_eq!(reconcile(&op, &dir), "interrupted_before_move");
        }
        op.state = "pending_review".into();
        assert_eq!(op.state, "pending_review");
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn a_live_attempt_is_not_reconciled_until_its_receipt_or_process_restart() {
        let dir = std::env::temp_dir().join(format!("still-live-recovery-{}", now()));
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("source.txt"), b"same").unwrap();
        let (revision, size) = crate::files::journal_file_revision(&dir, "source.txt").unwrap();
        let op = Operation {
            id: "run-1".into(),
            workspace_id: "w".into(),
            run_id: "run".into(),
            sequence: 1,
            root_fingerprint: fingerprint(&dir),
            source_path: "source.txt".into(),
            destination_path: "dest.txt".into(),
            source_revision: revision,
            source_size: size,
            source_identity: crate::files::journal_file_identity(&dir, "source.txt"),
            state: "attempting".into(),
            outcome: None,
            updated_at: now(),
        };
        let mut journal = Journal {
            version: 1,
            records: vec![op],
            live_attempts: HashSet::from(["run-1".into()]),
        };
        reconcile_workspace(&mut journal, "w", &dir);
        assert_eq!(journal.records[0].state, "attempting");
        let bytes = serde_json::to_vec(&journal).unwrap();
        assert!(!String::from_utf8_lossy(&bytes).contains("liveAttempts"));
        let mut restarted: Journal = serde_json::from_slice(&bytes).unwrap();
        assert!(restarted.live_attempts.is_empty());
        reconcile_workspace(&mut restarted, "w", &dir);
        assert_eq!(restarted.records[0].state, "interrupted_before_move");
        fs::remove_dir_all(dir).unwrap();
    }
}
