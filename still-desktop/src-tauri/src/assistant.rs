use std::{collections::HashMap,sync::Mutex};
use tauri::{State, Webview};
use crate::assistant_protocol::{self, Provider, Reply, Request};
use crate::assistant_agent_protocol;
use tauri_plugin_opener::OpenerExt;

// Keys live only in memory here; Windows Credential Manager owns persisted copies.
#[derive(Default)]
pub struct AssistantState { keys: Mutex<HashMap<Provider,String>> }
impl AssistantState {
    pub fn from_environment() -> Self {
        let mut keys=HashMap::new();
        for (provider,environment) in [(Provider::Gemini,"GEMINI_API_KEY"),(Provider::Openai,"OPENAI_API_KEY"),(Provider::Opencode,"OPENCODE_API_KEY"),(Provider::Deepseek,"DEEPSEEK_API_KEY")] {
            let environment_key=std::env::var(environment).ok();
            let key=initial_key(environment_key.clone(),None).or_else(||{
                match crate::credential_store::load(provider){
                    Ok(saved)=>initial_key(None,saved),
                    Err(_)=>{eprintln!("Still AI could not load a saved key from Windows Credential Manager.");None}
                }
            });
            if let Some(key)=key {keys.insert(provider,key);}
        }
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
fn initial_key(environment:Option<String>,saved:Option<String>)->Option<String>{
    environment.into_iter().chain(saved).filter_map(|key|validate_api_key(&key).ok()).find(|key|!key.is_empty())
}
async fn fetch_models(client:&reqwest::Client,key:&str)->Result<Vec<String>,String> {
    fetch_models_at(client,"https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000",key).await
}
async fn read_error_body(mut response:reqwest::Response)->String {
    let mut bytes=Vec::new();
    while bytes.len()<8192 {
        match response.chunk().await {
            Ok(Some(chunk))=>{
                let count=(8192-bytes.len()).min(chunk.len());
                bytes.extend_from_slice(&chunk[..count]);
                if count<chunk.len(){break;}
            }
            _=>break,
        }
    }
    String::from_utf8_lossy(&bytes).into_owned()
}
async fn fetch_models_at(client:&reqwest::Client,endpoint:&str,key:&str)->Result<Vec<String>,String> {
    let response=client.get(endpoint)
        .header("x-goog-api-key",key).send().await
        .map_err(|_|"Could not reach Google Gemini. Check your connection and try again.".to_string())?;
    if !response.status().is_success() {
        let status=response.status().as_u16();
        let detail=read_error_body(response).await;
        return Err(crate::assistant_protocol::http_error_with_details(status,&detail,key));
    }
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
async fn fetch_deepseek_models(client:&reqwest::Client,key:&str)->Result<Vec<String>,String>{
    fetch_deepseek_models_at(client,"https://api.deepseek.com/models",key).await
}
async fn fetch_deepseek_models_at(client:&reqwest::Client,endpoint:&str,key:&str)->Result<Vec<String>,String>{
    let response=client.get(endpoint).bearer_auth(key).send().await.map_err(|_|"Could not reach DeepSeek. Check your connection and try again.".to_string())?;
    if !response.status().is_success(){return Err(match response.status().as_u16(){401|403=>"DeepSeek could not authorize this key. Check your DeepSeek API settings and reconnect.",429=>"DeepSeek rate limit or balance limit reached. Check your DeepSeek account before retrying.",_=>"DeepSeek could not list models. Check your key and connection."}.into());}
    let value=response.json::<serde_json::Value>().await.map_err(|_|"DeepSeek returned an unreadable model list.".to_string())?;
    let models=assistant_protocol::deepseek_models(value);if models.is_empty(){return Err("No DeepSeek chat models are available for this key.".into());}Ok(models)
}
async fn fetch_opencode_models(client:&reqwest::Client,key:&str)->Result<Vec<String>,String> {
    fetch_opencode_models_at(client,"https://opencode.ai/zen/go/v1/models",key).await
}
async fn fetch_opencode_models_at(client:&reqwest::Client,endpoint:&str,key:&str)->Result<Vec<String>,String> {
    let response=client.get(endpoint).bearer_auth(key).send().await
        .map_err(|_|"Could not reach OpenCode Go. Check your connection and try again.".to_string())?;
    if !response.status().is_success(){return Err(opencode_http_error(response.status().as_u16()));}
    let mut bytes=Vec::new();let mut response=response;
    while let Some(chunk)=response.chunk().await.map_err(|_|"OpenCode Go's model list could not be read.".to_string())?{
        if bytes.len()+chunk.len()>512_000{return Err("OpenCode Go returned an oversized model list.".into());}
        bytes.extend_from_slice(&chunk);
    }
    let value=serde_json::from_slice(&bytes).map_err(|_|"OpenCode Go returned an unreadable model list.".to_string())?;
    let models=assistant_protocol::opencode_models(value);
    if models.is_empty(){return Err("No OpenCode Go models supported by Still are available for this API key.".into());}
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
fn opencode_http_error(status:u16)->String {
    match status {
        401|403=>"OpenCode Go could not authorize this key. Check your OpenCode account and reconnect.",
        404=>"The OpenCode Go model list is unavailable.",
        429=>"OpenCode Go is busy or its request limit was reached. Wait a little and try again.",
        500..=599=>"OpenCode Go is temporarily unavailable. Try again later.",
        _=>"OpenCode Go could not complete this request. Check your API key and connection.",
    }.into()
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
    match provider {Provider::Gemini=>fetch_models(client,key).await,Provider::Openai=>fetch_openai_models(client,key).await,Provider::Opencode=>fetch_opencode_models(client,key).await,Provider::Deepseek=>fetch_deepseek_models(client,key).await}
}
#[tauri::command]
pub fn assistant_key_setup(app:tauri::AppHandle,webview:Webview,provider:Provider) -> Result<(),String> {
    crate::security::authorize(&webview)?;
    let (url,error)=match provider {Provider::Gemini=>("https://aistudio.google.com/apikey","Could not open Google AI Studio. Visit aistudio.google.com/apikey in your browser."),Provider::Openai=>("https://platform.openai.com/api-keys","Could not open OpenAI API settings. Visit platform.openai.com/api-keys in your browser."),Provider::Opencode=>("https://opencode.ai/auth","Could not open OpenCode Go. Visit opencode.ai/auth in your browser."),Provider::Deepseek=>("https://platform.deepseek.com/api_keys","Could not open DeepSeek API settings. Visit platform.deepseek.com/api_keys in your browser.")};
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
    if key.is_empty(){crate::credential_store::delete(provider)?;}else{crate::credential_store::save(provider,&key)?;}
    let mut keys=state.keys.lock().map_err(|_|"AI settings are unavailable.")?;
    if key.is_empty(){keys.remove(&provider);}else{keys.insert(provider,key);}
    Ok(models)
}
#[tauri::command]
pub async fn assistant_chat(webview:Webview,state:State<'_,AssistantState>,request:Request) -> Result<Reply,String> {
    crate::security::authorize(&webview)?;
    let provider=request.provider;
    let key=state.keys.lock().map_err(|_|"AI settings are unavailable.")?.get(&provider).cloned().unwrap_or_default();
    if key.trim().is_empty() { return Err(format!("Connect an {} API key in AI settings first.",match provider {Provider::Gemini=>"Gemini",Provider::Openai=>"OpenAI",Provider::Opencode=>"OpenCode Go",Provider::Deepseek=>"DeepSeek"})); }
    let body=match provider {Provider::Gemini=>assistant_protocol::body(&request)?,Provider::Openai=>assistant_protocol::openai_body(&request)?,Provider::Opencode=>assistant_protocol::opencode_body(&request)?,Provider::Deepseek=>assistant_protocol::deepseek_body(&request)?};
    let client=reqwest::Client::builder().timeout(std::time::Duration::from_secs(45))
        .redirect(reqwest::redirect::Policy::none()).build().map_err(|_|"Could not start the AI connection.")?;
    let endpoint=match provider {Provider::Gemini=>format!("https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent",request.model),Provider::Openai=>"https://api.openai.com/v1/chat/completions".into(),Provider::Opencode=>"https://opencode.ai/zen/go/v1/chat/completions".into(),Provider::Deepseek=>"https://api.deepseek.com/chat/completions".into()};
    let builder=client.post(endpoint).json(&body);
    let builder=match provider {
        Provider::Gemini=>builder.header("x-goog-api-key",&key),
        Provider::Openai=>builder.bearer_auth(&key),
        Provider::Deepseek=>builder.bearer_auth(&key),
        Provider::Opencode=>{
            let session_id=request.session_id.as_deref().filter(|id|!id.is_empty()&&id.len()<=128&&id.bytes().all(|byte|byte.is_ascii_alphanumeric()||matches!(byte,b'-'|b'_')))
                .ok_or("OpenCode Go needs a valid workspace session ID. Restart Still and try again.")?;
            builder.bearer_auth(&key).header("user-agent","Still-Desktop").header("x-opencode-session",session_id)
        }
    };
    let mut response=builder.send().await.map_err(|_|match provider {Provider::Gemini=>"Gemini could not be reached or the request timed out. Check your connection and try again.",Provider::Openai=>"OpenAI could not be reached or the request timed out. Check your connection and try again.",Provider::Opencode=>"OpenCode Go could not be reached or the request timed out. Check your connection and try again.",Provider::Deepseek=>"DeepSeek could not be reached or the request timed out. Check your connection and try again."})?;
    if !response.status().is_success(){
        let status=response.status().as_u16();
        return Err(match provider {
            Provider::Gemini=>{let detail=read_error_body(response).await;assistant_protocol::http_error_with_details(status,&detail,&key)}
            Provider::Openai=>openai_http_error(status),Provider::Opencode=>opencode_http_error(status),Provider::Deepseek=>match status{401|403=>"DeepSeek could not authorize this key. Check your API key.",402|429=>"DeepSeek balance or rate limit reached. Check your DeepSeek account before retrying.",500..=599=>"DeepSeek is temporarily unavailable.",_=>"DeepSeek could not complete the request."}.into(),
        });
    }
    let mut bytes=Vec::new();
    while let Some(chunk)=response.chunk().await.map_err(|_|"The AI response could not be read.")? {
        if bytes.len()+chunk.len()>256000 { return Err("The AI answer is too large. Try a shorter message.".into()); }
        bytes.extend_from_slice(&chunk);
    }
    let value=serde_json::from_slice(&bytes).map_err(|_|"The AI returned an unreadable response.")?;
    match provider {
        Provider::Gemini=>assistant_protocol::parse_response(value),
        Provider::Openai=>assistant_protocol::parse_openai_response(value),Provider::Opencode=>assistant_protocol::parse_opencode_response(value),Provider::Deepseek=>assistant_protocol::parse_deepseek_response(value),
    }
}

/// One native tool-calling provider turn. The webview's bounded agent loop
/// executes only allowlisted calls and sends their exact receipts on the next
/// invocation; existing assistant_chat behavior remains unchanged.
#[tauri::command]
pub async fn assistant_agent_turn(webview:Webview,state:State<'_,AssistantState>,request:assistant_agent_protocol::AgentRequest) -> Result<assistant_agent_protocol::AgentTurn,String> {
    crate::security::authorize(&webview)?;
    let provider=request.provider;
    let key=state.keys.lock().map_err(|_|"AI settings are unavailable.")?.get(&provider).cloned().unwrap_or_default();
    if key.trim().is_empty() {
        return Err(format!("Connect an {} API key in AI settings first.",match provider {Provider::Gemini=>"Gemini",Provider::Openai=>"OpenAI",Provider::Opencode=>"OpenCode Go",Provider::Deepseek=>"DeepSeek"}));
    }
    let body=match provider {
        Provider::Gemini=>assistant_agent_protocol::gemini_agent_body(&request)?,
        Provider::Openai=>assistant_agent_protocol::openai_agent_body(&request)?,
        Provider::Opencode=>assistant_agent_protocol::opencode_agent_body(&request)?,
        Provider::Deepseek=>assistant_agent_protocol::deepseek_agent_body(&request)?,
    };
    let client=reqwest::Client::builder().timeout(std::time::Duration::from_secs(45))
        .redirect(reqwest::redirect::Policy::none()).build()
        .map_err(|_|"Could not start the AI connection.")?;
    let endpoint=match provider {
        Provider::Gemini=>format!("https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent",request.model),
        Provider::Openai=>"https://api.openai.com/v1/chat/completions".into(),
        Provider::Opencode=>"https://opencode.ai/zen/go/v1/chat/completions".into(),
        Provider::Deepseek=>"https://api.deepseek.com/chat/completions".into(),
    };
    let builder=client.post(endpoint).json(&body);
    let builder=match provider {
        Provider::Gemini=>builder.header("x-goog-api-key",&key),
        Provider::Openai=>builder.bearer_auth(&key),
        Provider::Deepseek=>builder.bearer_auth(&key),
        Provider::Opencode=>{
            let session_id=request.session_id.as_deref().expect("OpenCode session validated by agent request body");
            builder.bearer_auth(&key).header("user-agent","Still-Desktop").header("x-opencode-session",session_id)
        }
    };
    let mut response=builder.send().await.map_err(|_|match provider {
        Provider::Gemini=>"Gemini could not be reached or the request timed out. Check your connection and try again.",
        Provider::Openai=>"OpenAI could not be reached or the request timed out. Check your connection and try again.",
        Provider::Opencode=>"OpenCode Go could not be reached or the request timed out. Check your connection and try again.",
        Provider::Deepseek=>"DeepSeek could not be reached or the request timed out. Check your connection and try again.",
    })?;
    if !response.status().is_success() {
        let status=response.status().as_u16();
        return Err(match provider {Provider::Gemini=>assistant_protocol::http_error(status),Provider::Openai=>openai_http_error(status),Provider::Opencode=>opencode_http_error(status),Provider::Deepseek=>match status{401|403=>"DeepSeek could not authorize this key.",402|429=>"DeepSeek balance or rate limit reached.",_=>"DeepSeek request failed."}.into()});
    }
    let mut bytes=Vec::new();
    while let Some(chunk)=response.chunk().await.map_err(|_|"The AI response could not be read.")? {
        if bytes.len()+chunk.len()>256_000 { return Err("The AI response is too large. Try a shorter message.".into()); }
        bytes.extend_from_slice(&chunk);
    }
    let value=serde_json::from_slice(&bytes).map_err(|_|"The AI returned an unreadable response.")?;
    match provider {
        Provider::Gemini=>assistant_agent_protocol::parse_gemini_agent_response(value,&format!("gemini-local-{}",request.messages.len()),request.enable_add_widget_tool,request.enable_safe_workspace_action_tool,request.enable_assistant_memory_tool),
        Provider::Openai=>assistant_agent_protocol::parse_openai_agent_response_with_all_tools(value,request.enable_add_widget_tool,request.enable_safe_workspace_action_tool,request.enable_assistant_memory_tool),
        Provider::Opencode=>assistant_agent_protocol::parse_opencode_agent_response_with_all_tools(value,request.enable_add_widget_tool,request.enable_safe_workspace_action_tool,request.enable_assistant_memory_tool),
        Provider::Deepseek=>assistant_agent_protocol::parse_deepseek_agent_response_with_all_tools(value,request.enable_add_widget_tool,request.enable_safe_workspace_action_tool,request.enable_assistant_memory_tool),
    }
}

#[cfg(test)]
mod tests {
    use super::{initial_key,validate_api_key,fetch_models_at,fetch_openai_models_at,fetch_opencode_models_at};
    use std::io::{Read,Write};
    use std::net::TcpListener;

    #[test]
    fn accepts_opaque_printable_api_key_values() {
        assert_eq!(validate_api_key("AIzaSyA1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q").unwrap(), "AIzaSyA1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q");
        assert_eq!(validate_api_key("auth.key+value/=with-punctuation_123456").unwrap(), "auth.key+value/=with-punctuation_123456");
    }

    #[test]
    fn discovers_opencode_go_models_with_the_saved_key() {
        let listener=TcpListener::bind("127.0.0.1:0").unwrap();let address=listener.local_addr().unwrap();
        let server=std::thread::spawn(move||{
            let (mut stream,_)=listener.accept().unwrap();let mut request=[0u8;2048];let size=stream.read(&mut request).unwrap();
            let request=String::from_utf8_lossy(&request[..size]).to_ascii_lowercase();
            assert!(request.contains("authorization: bearer test-opencode-key-123"));
            assert!(request.contains("/zen/go/v1/models"));
            let body=r#"{"data":[{"id":"mimo-v2.6-flash"},{"id":"mimo-v2.6-pro"},{"id":"gpt-6-luna"},{"id":"qwen3.8-max"}]}"#;
            write!(stream,"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",body.len(),body).unwrap();
        });
        let client=reqwest::Client::new();let endpoint=format!("http://{address}/zen/go/v1/models");
        let models=tauri::async_runtime::block_on(fetch_opencode_models_at(&client,&endpoint,"test-opencode-key-123")).unwrap();server.join().unwrap();
        assert_eq!(models,vec!["mimo-v2.6-flash","mimo-v2.6-pro"]);
    }
    #[test]
    fn allows_clearing_and_rejects_short_oversized_or_unsafe_values() {
        assert_eq!(validate_api_key(" ").unwrap(), "");
        assert_eq!(validate_api_key("short").unwrap(), "short");
        assert!(validate_api_key(&"k".repeat(257)).is_err());
        assert!(validate_api_key("valid-key-with\r\ninjection").is_err());
    }

    #[test]
    fn startup_uses_saved_credentials_when_no_environment_key_is_set() {
        assert_eq!(initial_key(None,Some("saved-key-123".into())).as_deref(),Some("saved-key-123"));
        assert_eq!(initial_key(Some("environment-key-123".into()),Some("saved-key-123".into())).as_deref(),Some("environment-key-123"));
        assert_eq!(initial_key(Some(String::new()),Some("saved-key-123".into())).as_deref(),Some("saved-key-123"));
        assert_eq!(initial_key(None,Some("unsafe\nkey".into())),None);
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
