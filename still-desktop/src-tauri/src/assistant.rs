use std::sync::Mutex;
use tauri::{State, Webview};
use crate::assistant_protocol::{self, Reply, Request};
use tauri_plugin_opener::OpenerExt;

// Session-only: never serialize a credential into layouts, frontend storage, or logs.
#[derive(Default)]
pub struct AssistantState { key: Mutex<String> }
impl AssistantState {
    pub fn from_environment() -> Self { Self {key:Mutex::new(std::env::var("GEMINI_API_KEY").unwrap_or_default())} }
}
fn validate_api_key(key:&str)->Result<String,&'static str> {
    let key=key.trim();
    if key.is_empty() { return Ok(String::new()); }
    if key.len()>256 || !key.bytes().all(|b|(0x21..=0x7e).contains(&b)) {
        return Err("The Gemini API key must be at most 256 characters and contain no spaces or control characters.");
    }
    Ok(key.into())
}
async fn verify_api_key(client:&reqwest::Client,key:&str)->Result<(),String> {
    verify_api_key_at(client,"https://generativelanguage.googleapis.com/v1beta/models?pageSize=1",key).await
}
async fn verify_api_key_at(client:&reqwest::Client,endpoint:&str,key:&str)->Result<(),String> {
    let response=client.get(endpoint)
        .header("x-goog-api-key",key).send().await
        .map_err(|_|"Could not reach Google Gemini. Check your connection and try again.".to_string())?;
    if response.status().is_success() { Ok(()) }
    else { Err(crate::assistant_protocol::http_error(response.status().as_u16())) }
}
#[tauri::command]
pub fn assistant_key_setup(app:tauri::AppHandle,webview:Webview) -> Result<(),String> {
    crate::browser::authorize(&webview)?;
    app.opener().open_url("https://aistudio.google.com/apikey",None::<String>)
        .map_err(|_|"Could not open Google AI Studio. Visit aistudio.google.com/apikey in your browser.".into())
}
#[tauri::command]
pub fn assistant_configured(webview:Webview,state:State<AssistantState>) -> Result<bool,String> {
    crate::browser::authorize(&webview)?;
    Ok(!state.key.lock().map_err(|_|"AI settings are unavailable.")?.trim().is_empty())
}
#[tauri::command]
pub async fn assistant_set_key(webview:Webview,state:State<'_,AssistantState>,key:String) -> Result<(),String> {
    crate::browser::authorize(&webview)?;
    let key=validate_api_key(&key)?;
    if !key.is_empty() {
        let client=reqwest::Client::builder().timeout(std::time::Duration::from_secs(15))
            .redirect(reqwest::redirect::Policy::none()).build()
            .map_err(|_|"Could not start the Gemini connection.".to_string())?;
        verify_api_key(&client,&key).await?;
    }
    *state.key.lock().map_err(|_|"AI settings are unavailable.")?=key;
    Ok(())
}
#[tauri::command]
pub async fn assistant_chat(webview:Webview,state:State<'_,AssistantState>,request:Request) -> Result<Reply,String> {
    crate::browser::authorize(&webview)?;
    let key=state.key.lock().map_err(|_|"AI settings are unavailable.")?.clone();
    if key.trim().is_empty() { return Err("Connect a Gemini API key in AI settings first.".into()); }
    let body=assistant_protocol::body(&request)?;
    let client=reqwest::Client::builder().timeout(std::time::Duration::from_secs(45))
        .redirect(reqwest::redirect::Policy::none()).build().map_err(|_|"Could not start the Gemini connection.")?;
    let mut response=client.post(format!("https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent",request.model))
        .header("x-goog-api-key",key).json(&body).send().await
        .map_err(|_|"Gemini could not be reached or the request timed out. Check your connection and try again.")?;
    if !response.status().is_success() { return Err(assistant_protocol::http_error(response.status().as_u16())); }
    let mut bytes=Vec::new();
    while let Some(chunk)=response.chunk().await.map_err(|_|"Gemini's response could not be read.")? {
        if bytes.len()+chunk.len()>256000 { return Err("Gemini's answer is too large. Try a shorter request.".into()); }
        bytes.extend_from_slice(&chunk);
    }
    let value=serde_json::from_slice(&bytes).map_err(|_|"Gemini returned an unreadable response.")?;
    assistant_protocol::parse_response(value)
}

#[cfg(test)]
mod tests {
    use super::{validate_api_key,verify_api_key_at};
    use std::io::{Read,Write};
    use std::net::TcpListener;

    #[test]
    fn accepts_opaque_printable_api_key_values() {
        assert_eq!(validate_api_key("AIzaSyA1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q").unwrap(), "AIzaSyA1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q");
        assert_eq!(validate_api_key("auth.key+value/=with-punctuation_123456").unwrap(), "auth.key+value/=with-punctuation_123456");
    }

    #[test]
    fn allows_clearing_and_rejects_short_oversized_or_unsafe_values() {
        assert_eq!(validate_api_key(" ").unwrap(), "");
        assert_eq!(validate_api_key("short").unwrap(), "short");
        assert!(validate_api_key(&"k".repeat(257)).is_err());
        assert!(validate_api_key("valid-key-with\r\ninjection").is_err());
    }

    #[test]
    fn verifies_api_keys_and_maps_google_auth_failures() {
        let listener=TcpListener::bind("127.0.0.1:0").unwrap();
        let address=listener.local_addr().unwrap();
        let server=std::thread::spawn(move||{
            let (mut stream,_)=listener.accept().unwrap();
            let mut request=[0u8;2048];
            let size=stream.read(&mut request).unwrap();
            assert!(String::from_utf8_lossy(&request[..size]).contains("x-goog-api-key: test-key-auth-123"));
            stream.write_all(b"HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n").unwrap();
        });
        let client=reqwest::Client::new();
        let endpoint=format!("http://{address}/v1beta/models?pageSize=1");
        let error=tauri::async_runtime::block_on(verify_api_key_at(&client,&endpoint,"test-key-auth-123")).unwrap_err();
        server.join().unwrap();
        assert!(error.contains("authorize this key"));
    }
}
