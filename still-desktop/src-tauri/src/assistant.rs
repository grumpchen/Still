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
pub fn assistant_set_key(webview:Webview,state:State<AssistantState>,key:String) -> Result<(),String> {
    crate::browser::authorize(&webview)?;
    let key=key.trim();
    if !key.is_empty() && (key.len()<20 || key.len()>256 || !key.bytes().all(|b|b.is_ascii_alphanumeric() || b==b'-' || b==b'_')) {
        return Err("Enter a valid Gemini API key from Google AI Studio.".into());
    }
    *state.key.lock().map_err(|_|"AI settings are unavailable.")?=key.into();
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
