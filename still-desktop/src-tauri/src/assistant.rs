use std::{collections::HashMap,sync::Mutex};
use tauri::{State, Webview};
use crate::assistant_protocol::{self, Provider, Reply, Request};
use tauri_plugin_opener::OpenerExt;

// Session-only: never serialize a credential into layouts, frontend storage, or logs.
#[derive(Default)]
pub struct AssistantState { keys: Mutex<HashMap<Provider,String>> }
impl AssistantState {
    pub fn from_environment() -> Self {
        let mut keys=HashMap::new();
        if let Ok(key)=std::env::var("GEMINI_API_KEY"){keys.insert(Provider::Gemini,key);}
        if let Ok(key)=std::env::var("OPENAI_API_KEY"){keys.insert(Provider::Openai,key);}
        Self {keys:Mutex::new(keys)}
    }
}
fn validate_api_key(key:&str)->Result<String,&'static str> {
    let key=key.trim();
    if key.is_empty() { return Ok(String::new()); }
    if key.len()>256 || !key.bytes().all(|b|(0x21..=0x7e).contains(&b)) {
        return Err("The API key must be at most 256 characters and contain no spaces or control characters.");
    }
    Ok(key.into())
}
async fn fetch_models(client:&reqwest::Client,key:&str)->Result<Vec<String>,String> {
    fetch_models_at(client,"https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000",key).await
}
async fn fetch_models_at(client:&reqwest::Client,endpoint:&str,key:&str)->Result<Vec<String>,String> {
    let response=client.get(endpoint)
        .header("x-goog-api-key",key).send().await
        .map_err(|_|"Could not reach Google Gemini. Check your connection and try again.".to_string())?;
    if !response.status().is_success() { return Err(crate::assistant_protocol::http_error(response.status().as_u16())); }
    let mut bytes=Vec::new();
    let mut response=response;
    while let Some(chunk)=response.chunk().await.map_err(|_|"Gemini's model list could not be read.".to_string())? {
        if bytes.len()+chunk.len()>512_000 { return Err("Gemini returned an oversized model list.".into()); }
        bytes.extend_from_slice(&chunk);
    }
    let value=serde_json::from_slice(&bytes).map_err(|_|"Gemini returned an unreadable model list.".to_string())?;
    let models=assistant_protocol::available_models(value);
    if models.is_empty() { return Err("This project has no Gemini models available for content generation.".into()); }
    Ok(models)
}
async fn fetch_openai_models(client:&reqwest::Client,key:&str)->Result<Vec<String>,String> {
    fetch_openai_models_at(client,"https://api.openai.com/v1/models",key).await
}
async fn fetch_openai_models_at(client:&reqwest::Client,endpoint:&str,key:&str)->Result<Vec<String>,String> {
    let response=client.get(endpoint).bearer_auth(key).send().await
        .map_err(|_|"Could not reach OpenAI. Check your connection and try again.".to_string())?;
    if !response.status().is_success(){return Err(openai_http_error(response.status().as_u16()));}
    let mut bytes=Vec::new();let mut response=response;
    while let Some(chunk)=response.chunk().await.map_err(|_|"OpenAI's model list could not be read.".to_string())?{
        if bytes.len()+chunk.len()>512_000{return Err("OpenAI returned an oversized model list.".into());}
        bytes.extend_from_slice(&chunk);
    }
    let value=serde_json::from_slice(&bytes).map_err(|_|"OpenAI returned an unreadable model list.".to_string())?;
    let models=assistant_protocol::openai_models(value);
    if models.is_empty(){return Err("No compatible OpenAI chat models are available for this API key.".into());}
    Ok(models)
}
fn openai_http_error(status:u16)->String {
    match status {
        401|403=>"OpenAI could not authorize this key. Check it in your OpenAI API settings and reconnect.",
        404=>"OpenAI's model list is unavailable for this project.",
        429=>"OpenAI's quota or rate limit was reached. Check API billing and try again later.",
        500..=599=>"OpenAI is temporarily unavailable. Try again later.",
        _=>"OpenAI could not complete this request. Check the API project and connection.",
    }.into()
}
async fn list_provider_models(client:&reqwest::Client,provider:Provider,key:&str)->Result<Vec<String>,String>{
    match provider {Provider::Gemini=>fetch_models(client,key).await,Provider::Openai=>fetch_openai_models(client,key).await}
}
#[tauri::command]
pub fn assistant_key_setup(app:tauri::AppHandle,webview:Webview,provider:Provider) -> Result<(),String> {
    crate::security::authorize(&webview)?;
    let (url,error)=match provider {Provider::Gemini=>("https://aistudio.google.com/apikey","Could not open Google AI Studio. Visit aistudio.google.com/apikey in your browser."),Provider::Openai=>("https://platform.openai.com/api-keys","Could not open OpenAI API settings. Visit platform.openai.com/api-keys in your browser.")};
    app.opener().open_url(url,None::<String>).map_err(|_|error.into())
}
#[tauri::command]
pub fn assistant_configured(webview:Webview,state:State<AssistantState>,provider:Provider) -> Result<bool,String> {
    crate::security::authorize(&webview)?;
    Ok(state.keys.lock().map_err(|_|"AI settings are unavailable.")?.get(&provider).is_some_and(|key|!key.trim().is_empty()))
}
#[tauri::command]
pub async fn assistant_models(webview:Webview,state:State<'_,AssistantState>,provider:Provider) -> Result<Vec<String>,String> {
    crate::security::authorize(&webview)?;
    let key=state.keys.lock().map_err(|_|"AI settings are unavailable.")?.get(&provider).cloned().unwrap_or_default();
    if key.trim().is_empty() { return Ok(Vec::new()); }
    let client=reqwest::Client::builder().timeout(std::time::Duration::from_secs(15))
        .redirect(reqwest::redirect::Policy::none()).build()
        .map_err(|_|"Could not start the AI connection.".to_string())?;
    list_provider_models(&client,provider,&key).await
}
#[tauri::command]
pub async fn assistant_set_key(webview:Webview,state:State<'_,AssistantState>,provider:Provider,key:String) -> Result<Vec<String>,String> {
    crate::security::authorize(&webview)?;
    let key=validate_api_key(&key)?;
    let models=if !key.is_empty() {
        let client=reqwest::Client::builder().timeout(std::time::Duration::from_secs(15))
            .redirect(reqwest::redirect::Policy::none()).build()
            .map_err(|_|"Could not start the AI connection.".to_string())?;
        list_provider_models(&client,provider,&key).await?
    } else { Vec::new() };
    let mut keys=state.keys.lock().map_err(|_|"AI settings are unavailable.")?;
    if key.is_empty(){keys.remove(&provider);}else{keys.insert(provider,key);}
    Ok(models)
}
#[tauri::command]
pub async fn assistant_chat(webview:Webview,state:State<'_,AssistantState>,request:Request) -> Result<Reply,String> {
    crate::security::authorize(&webview)?;
    let provider=request.provider;
    let key=state.keys.lock().map_err(|_|"AI settings are unavailable.")?.get(&provider).cloned().unwrap_or_default();
    if key.trim().is_empty() { return Err(format!("Connect an {} API key in AI settings first.",match provider {Provider::Gemini=>"Gemini",Provider::Openai=>"OpenAI"})); }
    let body=match provider {Provider::Gemini=>assistant_protocol::body(&request)?,Provider::Openai=>assistant_protocol::openai_body(&request)?};
    let client=reqwest::Client::builder().timeout(std::time::Duration::from_secs(45))
        .redirect(reqwest::redirect::Policy::none()).build().map_err(|_|"Could not start the AI connection.")?;
    let endpoint=match provider {Provider::Gemini=>format!("https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent",request.model),Provider::Openai=>"https://api.openai.com/v1/chat/completions".into()};
    let builder=client.post(endpoint).json(&body);
    let builder=match provider {Provider::Gemini=>builder.header("x-goog-api-key",key),Provider::Openai=>builder.bearer_auth(key)};
    let mut response=builder.send().await.map_err(|_|match provider {Provider::Gemini=>"Gemini could not be reached or the request timed out. Check your connection and try again.",Provider::Openai=>"OpenAI could not be reached or the request timed out. Check your connection and try again."})?;
    if !response.status().is_success(){return Err(match provider {Provider::Gemini=>assistant_protocol::http_error(response.status().as_u16()),Provider::Openai=>openai_http_error(response.status().as_u16())});}
    let mut bytes=Vec::new();
    while let Some(chunk)=response.chunk().await.map_err(|_|"The AI response could not be read.")? {
        if bytes.len()+chunk.len()>256000 { return Err("The AI answer is too large. Try a shorter message.".into()); }
        bytes.extend_from_slice(&chunk);
    }
    let value=serde_json::from_slice(&bytes).map_err(|_|"The AI returned an unreadable response.")?;
    match provider {
        Provider::Gemini=>assistant_protocol::parse_response(value),
        Provider::Openai=>assistant_protocol::parse_openai_response(value),
    }
}

#[cfg(test)]
mod tests {
    use super::{validate_api_key,fetch_models_at,fetch_openai_models_at};
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
    fn discovers_project_models_and_maps_google_auth_failures() {
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
        let endpoint=format!("http://{address}/v1beta/models?pageSize=1000");
        let error=tauri::async_runtime::block_on(fetch_models_at(&client,&endpoint,"test-key-auth-123")).unwrap_err();
        server.join().unwrap();
        assert!(error.contains("authorize this key"));
    }

    #[test]
    fn fetches_only_models_available_for_generation() {
        let listener=TcpListener::bind("127.0.0.1:0").unwrap();
        let address=listener.local_addr().unwrap();
        let server=std::thread::spawn(move||{
            let (mut stream,_)=listener.accept().unwrap();
            let mut request=[0u8;2048];
            let size=stream.read(&mut request).unwrap();
            let request=String::from_utf8_lossy(&request[..size]);
            assert!(request.contains("/v1beta/models?pageSize=1000"));
            assert!(request.contains("x-goog-api-key: test-key-models-123"));
            let body=r#"{"models":[{"name":"models/gemini-3.8-flash","supportedGenerationMethods":["generateContent"]},{"name":"models/gemini-2.5-flash-lite","supportedGenerationMethods":["embedContent"]}]}"#;
            write!(stream,"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",body.len(),body).unwrap();
        });
        let client=reqwest::Client::new();
        let endpoint=format!("http://{address}/v1beta/models?pageSize=1000");
        let models=tauri::async_runtime::block_on(fetch_models_at(&client,&endpoint,"test-key-models-123")).unwrap();
        server.join().unwrap();
        assert_eq!(models,vec!["gemini-3.8-flash"]);
    }

    #[test]
    fn lists_openai_chat_models_and_omits_non_chat_models() {
        let listener=TcpListener::bind("127.0.0.1:0").unwrap();let address=listener.local_addr().unwrap();
        let server=std::thread::spawn(move||{
            let (mut stream,_)=listener.accept().unwrap();let mut request=[0u8;2048];let size=stream.read(&mut request).unwrap();
            let request=String::from_utf8_lossy(&request[..size]).to_ascii_lowercase();assert!(request.contains("authorization: bearer test-openai-key-123"));
            let body=r#"{"data":[{"id":"gpt-4o-mini"},{"id":"gpt-4o-mini"},{"id":"gpt-4o-transcribe"},{"id":"text-embedding-3-small"},{"id":"gpt-4.1-mini"}]}"#;
            write!(stream,"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",body.len(),body).unwrap();
        });
        let client=reqwest::Client::new();let endpoint=format!("http://{address}/v1/models");
        let models=tauri::async_runtime::block_on(fetch_openai_models_at(&client,&endpoint,"test-openai-key-123")).unwrap();server.join().unwrap();
        assert_eq!(models,vec!["gpt-4.1-mini","gpt-4o-mini"]);
    }
}
