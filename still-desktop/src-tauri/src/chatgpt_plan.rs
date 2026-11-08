//! Native ChatGPT plan account lifecycle. Only account labels reach the webview.

use serde::{Deserialize, Serialize};
use std::{
    fs::{self, File, OpenOptions},
    io::{Read, Write},
    path::{Path, PathBuf},
    time::Duration,
};
use tauri::{AppHandle, Manager, Webview};
use tauri_plugin_opener::OpenerExt;
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::{TcpListener, TcpStream},
    time::timeout,
};

use crate::{
    chatgpt_auth::{
        self, AuthorizationAttempt, AuthorizationCode, VerifiedIdentity, VerifiedSession,
    },
    chatgpt_responses::{self, PlanModel},
};

const MAX_RECORD: usize = 128 * 1024;
const REVOKE_ENDPOINT: &str = "https://auth.openai.com/oauth/revoke";

#[derive(Serialize, Deserialize)]
struct Registration {
    client_id: String,
    identity: VerifiedIdentity,
}

#[derive(Serialize, Deserialize)]
struct PlanRecord {
    registration: Option<Registration>,
    session: Option<VerifiedSession>,
}

#[derive(Serialize)]
pub struct PlanStatus {
    connected: bool,
    email: Option<String>,
}

impl PlanRecord {
    fn status(&self) -> PlanStatus {
        PlanStatus {
            connected: self.session.is_some(),
            email: self
                .registration
                .as_ref()
                .and_then(|item| item.identity.email.clone()),
        }
    }
}

fn validate_reauthorization_identity(
    registration: Option<&Registration>,
    identity: &VerifiedIdentity,
) -> Result<(), &'static str> {
    if let Some(previous) = registration.map(|registration| &registration.identity) {
        if let Some(previous_account_id) = previous.account_id.as_deref() {
            if identity.account_id.as_deref() != Some(previous_account_id) {
                return Err("ChatGPT account identity changed during reauthorization.");
            }
        } else if let Some(previous_email) = previous.email.as_deref() {
            if !identity
                .email
                .as_deref()
                .is_some_and(|email| email.eq_ignore_ascii_case(previous_email))
            {
                return Err("ChatGPT account identity changed during reauthorization.");
            }
        } else if identity.subject != previous.subject {
            return Err("ChatGPT account identity changed during reauthorization.");
        }
    }
    Ok(())
}

// Lock separately from the atomically replaced record. Keep the file open
// across OAuth/refresh so two instances cannot rotate the same refresh token.
fn open_record(app: &AppHandle) -> Result<(PathBuf, File, PlanRecord), String> {
    let directory = app
        .path()
        .app_local_data_dir()
        .map_err(|_| "Could not locate Still's local credential folder.")?;
    fs::create_dir_all(&directory)
        .map_err(|_| "Could not create Still's local credential folder.")?;
    let lock = OpenOptions::new()
        .read(true)
        .write(true)
        .create(true)
        .truncate(false)
        .open(directory.join("chatgpt-plan.lock"))
        .map_err(|_| "Could not open Still's ChatGPT plan lock.")?;
    lock.try_lock()
        .map_err(|_| "A ChatGPT plan operation is already running. Wait for it to finish.")?;
    let path = directory.join("chatgpt-plan.dpapi");
    let record = match File::open(&path) {
        Ok(file) => {
            let mut encrypted = Vec::new();
            file.take((MAX_RECORD + 1) as u64)
                .read_to_end(&mut encrypted)
                .map_err(|_| "Could not read the ChatGPT plan connection.")?;
            if encrypted.len() > MAX_RECORD {
                return Err("The local ChatGPT plan connection is too large.".into());
            }
            let mut clear = protect(&encrypted, false)?;
            let decoded = serde_json::from_slice(&clear);
            clear.fill(0);
            decoded.map_err(|_| "The local ChatGPT plan connection is invalid.")?
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => PlanRecord {
            registration: None,
            session: None,
        },
        Err(_) => return Err("Could not open the ChatGPT plan connection.".into()),
    };
    Ok((path, lock, record))
}

fn save_record(path: &Path, record: &PlanRecord) -> Result<(), String> {
    let mut clear =
        serde_json::to_vec(record).map_err(|_| "Could not encode the ChatGPT plan connection.")?;
    let encrypted = protect(&clear, true);
    clear.fill(0);
    let encrypted = encrypted?;
    if encrypted.len() > MAX_RECORD {
        return Err("The local ChatGPT plan connection is too large.".into());
    }
    let pending = path.with_extension("pending");
    let result = (|| -> std::io::Result<()> {
        let mut file = File::create(&pending)?;
        file.write_all(&encrypted)?;
        file.sync_all()?;
        drop(file);
        fs::rename(&pending, path)
    })();
    if result.is_err() {
        let _ = fs::remove_file(&pending);
        return Err("Could not save the ChatGPT plan connection securely.".into());
    }
    Ok(())
}

#[cfg(windows)]
fn protect(bytes: &[u8], encrypt: bool) -> Result<Vec<u8>, String> {
    use windows::{
        core::PCWSTR,
        Win32::{
            Foundation::{LocalFree, HLOCAL},
            Security::Cryptography::{
                CryptProtectData, CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
            },
        },
    };
    let input = CRYPT_INTEGER_BLOB {
        cbData: bytes.len() as u32,
        pbData: bytes.as_ptr().cast_mut(),
    };
    let mut output = CRYPT_INTEGER_BLOB::default();
    // DPAPI treats the input as read-only and allocates the output with LocalAlloc.
    unsafe {
        let result = if encrypt {
            CryptProtectData(
                &input,
                PCWSTR::null(),
                None,
                None,
                None,
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut output,
            )
        } else {
            CryptUnprotectData(
                &input,
                None,
                None,
                None,
                None,
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut output,
            )
        };
        result.map_err(|_| "Windows could not protect or unlock the ChatGPT plan credentials.")?;
        if output.pbData.is_null() {
            return Err("Windows returned an empty ChatGPT credential record.".into());
        }
        let data = std::slice::from_raw_parts_mut(output.pbData, output.cbData as usize);
        let copy = data.to_vec();
        if !encrypt {
            data.fill(0);
        }
        let _ = LocalFree(Some(HLOCAL(output.pbData.cast())));
        Ok(copy)
    }
}

#[cfg(not(windows))]
fn protect(_: &[u8], _: bool) -> Result<Vec<u8>, String> {
    Err("ChatGPT plan credential storage is available on Windows.".into())
}

async fn browser_callback(
    listener: &TcpListener,
    origin: &str,
    attempt: &mut AuthorizationAttempt,
) -> Result<(AuthorizationCode, TcpStream), String> {
    loop {
        let (mut socket, _) = listener
            .accept()
            .await
            .map_err(|_| "The sign-in listener was interrupted.")?;
        let request = timeout(
            Duration::from_secs(3),
            callback_request(&mut socket, origin),
        )
        .await;
        let Ok(Some(callback)) = request else {
            continue;
        };
        match attempt.validate_callback(&callback) {
            Ok(code) => return Ok((code, socket)),
            Err(error) => {
                send_browser_page(&mut socket, false).await;
                if attempt.callback_consumed() {
                    return Err(error.into());
                }
            }
        }
    }
}

async fn callback_request(socket: &mut TcpStream, origin: &str) -> Option<String> {
    let mut bytes = Vec::new();
    while !bytes.windows(4).any(|part| part == b"\r\n\r\n") {
        let mut chunk = [0; 1024];
        let count = socket.read(&mut chunk).await.ok()?;
        if count == 0 || bytes.len() + count > 16_384 {
            return None;
        }
        bytes.extend_from_slice(&chunk[..count]);
    }
    let header = std::str::from_utf8(&bytes).ok()?.split("\r\n\r\n").next()?;
    let mut lines = header.split("\r\n");
    let mut request = lines.next()?.split_ascii_whitespace();
    if request.next()? != "GET" {
        return None;
    }
    let target = request.next()?;
    if !target.starts_with("/auth/callback?")
        || request.next()? != "HTTP/1.1"
        || request.next().is_some()
    {
        return None;
    }
    let mut hosts = lines.filter_map(|line| {
        let (name, value) = line.split_once(':')?;
        name.eq_ignore_ascii_case("host").then_some(value.trim())
    });
    let authority = origin.strip_prefix("http://")?;
    let host = hosts.next()?;
    let ipv4_authority = authority.strip_prefix("localhost")
        .map(|port| format!("127.0.0.1{port}"));
    if (host != authority && ipv4_authority.as_deref() != Some(host)) || hosts.next().is_some() {
        return None;
    }
    Some(format!("http://{host}{target}"))
}

async fn send_browser_page(socket: &mut TcpStream, success: bool) {
    let (status, body) = if success {
        (
            "200 OK",
            "ChatGPT is connected. You can return to Still and close this tab.",
        )
    } else {
        (
            "400 Bad Request",
            "Still could not complete this ChatGPT sign-in. Return to Still for details.",
        )
    };
    let reply = format!(
        "HTTP/1.1 {status}\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: {}\r\nCache-Control: no-store\r\nReferrer-Policy: no-referrer\r\nX-Content-Type-Options: nosniff\r\nConnection: close\r\n\r\n{body}", body.len()
    );
    let _ = timeout(Duration::from_secs(2), socket.write_all(reply.as_bytes())).await;
}

#[tauri::command]
pub fn chatgpt_plan_status(app: AppHandle, webview: Webview) -> Result<PlanStatus, String> {
    crate::security::authorize(&webview)?;
    let (_, _lock, record) = open_record(&app)?;
    Ok(record.status())
}

#[tauri::command]
pub async fn chatgpt_plan_connect(app: AppHandle, webview: Webview) -> Result<PlanStatus, String> {
    crate::security::authorize(&webview)?;
    let (path, _lock, mut record) = open_record(&app)?;
    // Persist the credential record before opening a browser session.
    if !path.exists() {
        save_record(&path, &record)?;
    }
    let (listener, port) = match TcpListener::bind(("127.0.0.1", 1455)).await {
        Ok(listener) => (listener, 1455),
        Err(_) => (
            TcpListener::bind(("127.0.0.1", 1457))
                .await
                .map_err(|_| "Could not start the local Codex sign-in listener.")?,
            1457,
        ),
    };
    let origin = format!("http://localhost:{port}");
    let redirect_uri = format!("{origin}/auth/callback");
    let mut attempt = AuthorizationAttempt::new(&redirect_uri)?;
    let client = chatgpt_auth::bounded_openai_http_client()?;
    let url = attempt.authorization_url()?;
    app.opener()
        .open_url(url.as_str(), None::<String>)
        .map_err(|_| "Could not open ChatGPT sign-in in your browser.")?;
    let (code, mut socket) = timeout(
        Duration::from_secs(180),
        browser_callback(&listener, &origin, &mut attempt),
    )
    .await
    .map_err(|_| "ChatGPT sign-in timed out. Select Continue with ChatGPT to try again.")??;
    drop(listener);
    let result = async {
        let jwks = chatgpt_auth::fetch_openai_jwks(&client).await?;
        let session =
            chatgpt_auth::exchange_and_validate(&client, attempt, code, &jwks, None).await?;
        validate_reauthorization_identity(record.registration.as_ref(), &session.identity)?;
        record.registration = Some(Registration {
            client_id: session.client_id.clone(),
            identity: VerifiedIdentity {
                subject: session.identity.subject.clone(),
                email: session.identity.email.clone(),
                account_id: session.identity.account_id.clone(),
            },
        });
        record.session = Some(session);
        save_record(&path, &record)?;
        Ok::<_, String>(record.status())
    }
    .await;
    send_browser_page(&mut socket, result.is_ok()).await;
    result
}

#[tauri::command]
pub async fn chatgpt_plan_disconnect(app: AppHandle, webview: Webview) -> Result<bool, String> {
    crate::security::authorize(&webview)?;
    let (path, _lock, mut record) = open_record(&app)?;
    let Some(session) = record.session.take() else {
        return Ok(true);
    };
    let client = chatgpt_auth::bounded_openai_http_client()?;
    let result = client
        .post(REVOKE_ENDPOINT)
        .timeout(Duration::from_secs(10))
        .json(&serde_json::json!({
            "token": session.refresh_token,
            "token_type_hint": "refresh_token",
            "client_id": session.client_id,
        }))
        .send()
        .await;
    save_record(&path, &record)?;
    Ok(result.is_ok_and(|response| response.status().is_success()))
}

async fn access_credentials(
    app: &AppHandle,
    client: &reqwest::Client,
) -> Result<(String, String), String> {
    let (path, _lock, mut record) = open_record(app)?;
    let Some(mut session) = record.session.clone() else {
        return Err("Continue with ChatGPT in AI settings first.".into());
    };
    if session.client_id != chatgpt_auth::CLIENT_ID {
        return Err("This saved sign-in uses an older connection. Select Continue with ChatGPT in AI settings to reconnect.".into());
    }
    let needs_refresh = session.needs_refresh();
    if needs_refresh || session.identity.account_id.is_none() {
        let jwks = chatgpt_auth::fetch_openai_jwks(client).await?;
        if needs_refresh {
            session = chatgpt_auth::refresh_verified_session(client, &jwks, &session)
                .await
                .map_err(|_| "Codex could not renew this connection. Reconnect in AI settings.")?;
        }
        let account_id = match session.identity.account_id.as_deref() {
            Some(value) => Ok(value.to_owned()),
            None => chatgpt_auth::verified_account_id(&session, &jwks).map_err(str::to_owned),
        };
        let account_id = match account_id {
            Ok(account_id) => account_id,
            Err(error) => {
                if needs_refresh {
                    // Token rotation may invalidate the previous refresh token.
                    // Persist the renewed session even when this older login
                    // still needs a fresh authorization for its account ID.
                    record.session = Some(session);
                    save_record(&path, &record)?;
                }
                return Err(error);
            }
        };
        session.identity.account_id = Some(account_id.clone());
        record.session = Some(session.clone());
        save_record(&path, &record)?;
        return Ok((session.access_token.clone(), account_id));
    }
    Ok((
        session.access_token,
        session.identity.account_id.expect("checked above"),
    ))
}

#[tauri::command]
pub async fn chatgpt_plan_models(
    app: AppHandle,
    webview: Webview,
) -> Result<Vec<PlanModel>, String> {
    crate::security::authorize(&webview)?;
    let client = chatgpt_auth::bounded_openai_http_client()?;
    let (token, account_id) = access_credentials(&app, &client).await?;
    chatgpt_responses::models(&client, &token, &account_id).await
}

#[tauri::command]
pub async fn chatgpt_plan_agent_turn(
    app: AppHandle,
    webview: Webview,
    request: serde_json::Value,
) -> Result<serde_json::Value, String> {
    crate::security::authorize(&webview)?;
    let (request, body) = chatgpt_responses::body(request)?;
    let client = chatgpt_auth::bounded_openai_http_client()?;
    let (token, account_id) = access_credentials(&app, &client).await?;
    chatgpt_responses::turn(&client, &token, &account_id, &request, body).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reauthorization_does_not_use_pairwise_subject_as_account_identity() {
        let legacy_registration = Registration {
            client_id: "oaiapp_issued".into(),
            identity: VerifiedIdentity {
                subject: "legacy-pairwise-subject".into(),
                email: Some("test@example.invalid".into()),
                account_id: None,
            },
        };
        let next_identity = VerifiedIdentity {
            subject: "new-pairwise-subject".into(),
            email: Some("test@example.invalid".into()),
            account_id: None,
        };
        assert_eq!(
            validate_reauthorization_identity(Some(&legacy_registration), &next_identity),
            Ok(())
        );
        let other_email = VerifiedIdentity {
            email: Some("other@example.invalid".into()),
            ..next_identity
        };
        assert_eq!(
            validate_reauthorization_identity(Some(&legacy_registration), &other_email),
            Err("ChatGPT account identity changed during reauthorization.")
        );
    }

    #[test]
    fn reauthorization_uses_account_id_when_legacy_client_subject_changes() {
        let legacy_registration = Registration {
            client_id: "oaiapp_issued".into(),
            identity: VerifiedIdentity {
                subject: "legacy-pairwise-subject".into(),
                email: Some("test@example.invalid".into()),
                account_id: Some("acct-previous".into()),
            },
        };
        let same_account = VerifiedIdentity {
            subject: "changed-subject-after-workspace-selection".into(),
            email: Some("test@example.invalid".into()),
            account_id: Some("acct-previous".into()),
        };
        assert_eq!(
            validate_reauthorization_identity(Some(&legacy_registration), &same_account),
            Ok(())
        );

        let different_account = VerifiedIdentity {
            account_id: Some("acct-different".into()),
            ..same_account
        };
        assert_eq!(
            validate_reauthorization_identity(Some(&legacy_registration), &different_account),
            Err("ChatGPT account identity changed during reauthorization.")
        );
    }

    #[cfg(windows)]
    #[test]
    fn windows_protects_credentials_and_rejects_tampering() {
        let record = br#"{"refresh_token":"synthetic-test-value"}"#;
        let mut encrypted = protect(record, true).unwrap();
        assert_ne!(encrypted, record);
        assert_eq!(protect(&encrypted, false).unwrap(), record);
        let last = encrypted.last_mut().unwrap();
        *last ^= 0x80;
        assert!(protect(&encrypted, false).is_err());
    }

    #[test]
    fn loopback_only_accepts_the_matching_host_and_state() {
        tauri::async_runtime::block_on(async {
            let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
            let address = listener.local_addr().unwrap();
            let origin = format!("http://localhost:{}", address.port());
            let mut attempt = AuthorizationAttempt::new(&format!("{origin}/auth/callback")).unwrap();
            let state = attempt
                .authorization_url()
                .unwrap()
                .query_pairs()
                .find(|(key, _)| key == "state")
                .unwrap()
                .1
                .into_owned();
            let client = tauri::async_runtime::spawn(async move {
                for (host, state) in [
                    (format!("localhost:{}", address.port()), state.clone()),
                    (address.to_string(), "invalid".into()),
                    (address.to_string(), state),
                ] {
                    let mut socket = TcpStream::connect(address).await.unwrap();
                    let request = format!("GET /auth/callback?code=test&state={state}&client_id={} HTTP/1.1\r\nHost: {host}\r\n\r\n", chatgpt_auth::CLIENT_ID);
                    socket.write_all(request.as_bytes()).await.unwrap();
                }
            });
            let (_, mut socket) = timeout(
                Duration::from_secs(3),
                browser_callback(&listener, &origin, &mut attempt),
            )
            .await
            .unwrap()
            .unwrap();
            assert!(attempt.callback_consumed());
            send_browser_page(&mut socket, true).await;
            client.await.unwrap();
        });
    }
}
