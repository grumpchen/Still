use serde::Deserialize;
use tauri::{AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, Webview, WebviewUrl};
use tauri::webview::{NewWindowResponse, PageLoadEvent, WebviewBuilder};
use url::Url;
use std::sync::atomic::{AtomicUsize, Ordering};

static POPUP_COUNTER: AtomicUsize = AtomicUsize::new(0);
#[cfg(target_os = "macos")]
const BROWSER_STORE: [u8; 16] = [83, 116, 105, 108, 108, 45, 66, 114, 111, 119, 115, 101, 114, 48, 48, 49];

#[derive(Clone, Deserialize)]
pub struct Bounds { x: f64, y: f64, width: f64, height: f64 }
impl Bounds {
    fn validate(&self) -> Result<(), String> {
        if [self.x, self.y, self.width, self.height].iter().any(|v| !v.is_finite())
            || self.x < 0.0 || self.y < 0.0 || self.width < 1.0 || self.height < 1.0
            || self.x + self.width > 20000.0 || self.y + self.height > 20000.0 {
            return Err("Invalid browser bounds".into());
        }
        Ok(())
    }
}
pub(crate) fn authorize(caller: &Webview) -> Result<(), String> {
    if caller.label() != "main" { return Err("Only the local workspace can control a browser".into()); }
    let url = caller.url().map_err(|e| e.to_string())?;
    let local_asset = url.scheme() == "tauri" || url.host_str() == Some("tauri.localhost");
    let dev_asset = cfg!(debug_assertions) && url.host_str() == Some("127.0.0.1") && url.port() == Some(4318);
    if !local_asset && !dev_asset { return Err("Browser controls require the trusted app surface".into()); }
    Ok(())
}
fn label(id: &str) -> Result<String, String> {
    if id.is_empty() || id.len() > 80 || !id.bytes().all(|c| c.is_ascii_alphanumeric() || c == b'-') {
        return Err("Invalid browser instance".into());
    }
    Ok(format!("browser-{id}"))
}
fn website(value: &str) -> Result<Url, String> {
    if value.len() > 4096 { return Err("Website address is too long".into()); }
    let url = Url::parse(value).map_err(|_| "Invalid website address")?;
    if url.scheme() != "https" || url.host_str().is_none() || !url.username().is_empty() || url.password().is_some() {
        return Err("Only HTTPS websites without embedded credentials are supported".into());
    }
    Ok(url)
}
pub(crate) fn view(app: &AppHandle, id: &str) -> Result<Webview, String> {
    app.get_webview(&label(id)?).ok_or_else(|| "Browser view is not open".into())
}

// Async creation avoids the documented Windows add_child deadlock in sync commands.
#[tauri::command]
pub async fn browser_open(app: AppHandle, webview: Webview, id: String, url: String, bounds: Bounds) -> Result<(), String> {
    authorize(&webview)?; bounds.validate()?;
    let name = label(&id)?;
    let start = website(&url)?;
    if app.get_webview(&name).is_some() { return Ok(()); }
    let active = app.webviews().keys().filter(|name| name.starts_with("browser-")).count();
    if active >= 12 { return Err("Close an unused browser widget before opening another (12 views maximum)".into()); }
    let window = app.get_window("main").ok_or("Workspace window is missing")?;
    let event_app = app.clone(); let event_id = id.clone();
    let title_app = app.clone(); let title_id = id.clone();
    let popup_app = app.clone();
    let builder = WebviewBuilder::new(&name, WebviewUrl::External(start))
        .on_navigation(|url| website(url.as_str()).is_ok())
        .on_page_load(move |_, payload| {
            let _ = event_app.emit_to("main", "browser-state", serde_json::json!({
                "id":event_id,"url":payload.url().as_str(),"loading":matches!(payload.event(), PageLoadEvent::Started)
            }));
        })
        .on_document_title_changed(move |_, title| {
            let _ = title_app.emit_to("main", "browser-state", serde_json::json!({"id":title_id,"title":title}));
        })
        .on_new_window(move |url, features| {
            if website(url.as_str()).is_err() && url.as_str() != "about:blank" { return NewWindowResponse::Deny; }
            let number = POPUP_COUNTER.fetch_add(1, Ordering::Relaxed);
            // A related native popup preserves SSO's window.opener semantics.
            let builder = tauri::WebviewWindowBuilder::new(&popup_app, format!("site-popup-{number}"), WebviewUrl::External("about:blank".parse().unwrap()))
                .window_features(features).title("Website sign-in / new page")
                .on_navigation(|url| website(url.as_str()).is_ok() || url.as_str() == "about:blank")
                .on_new_window(|_, _| NewWindowResponse::Deny);
            #[cfg(target_os = "windows")]
            let builder = match popup_app.path().app_data_dir() {
                Ok(directory) => builder.data_directory(directory.join("browser-profile")),
                Err(_) => return NewWindowResponse::Deny,
            };
            #[cfg(target_os = "macos")]
            let builder = builder.data_store_identifier(BROWSER_STORE);
            match builder.build() { Ok(window) => NewWindowResponse::Create { window }, Err(_) => NewWindowResponse::Deny }
        });
    #[cfg(target_os = "windows")]
    let builder = {
        let directory = app.path().app_data_dir().map_err(|e| e.to_string())?.join("browser-profile");
        std::fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
        builder.data_directory(directory)
    };
    #[cfg(target_os = "macos")]
    let builder = builder.data_store_identifier(BROWSER_STORE);
    let child = window.add_child(builder, LogicalPosition::new(bounds.x,bounds.y), LogicalSize::new(bounds.width,bounds.height))
        .map_err(|e| e.to_string())?;
    child.hide().map_err(|e| e.to_string())?;
    crate::shortcuts::attach(app.clone(), &child).await?;
    Ok(())
}
#[tauri::command]
pub async fn browser_bounds(app: AppHandle, webview: Webview, id: String, bounds: Bounds) -> Result<(), String> {
    authorize(&webview)?; bounds.validate()?;
    let browser = view(&app,&id)?;
    browser.set_position(LogicalPosition::new(bounds.x,bounds.y)).map_err(|e| e.to_string())?;
    browser.set_size(LogicalSize::new(bounds.width,bounds.height)).map_err(|e| e.to_string())
}
#[tauri::command]
pub async fn browser_visible(app: AppHandle, webview: Webview, id: String, visible: bool) -> Result<(), String> {
    authorize(&webview)?;
    let browser = view(&app,&id)?;
    if visible { browser.show() } else { browser.hide() }.map_err(|e| e.to_string())
}
#[tauri::command]
pub async fn browser_navigate(app: AppHandle, webview: Webview, id: String, url: String) -> Result<(), String> {
    authorize(&webview)?;
    view(&app,&id)?.navigate(website(&url)?).map_err(|e| e.to_string())
}
#[tauri::command]
pub async fn browser_current(app:AppHandle,webview:Webview,id:String)->Result<String,String>{
    authorize(&webview)?;
    let url=view(&app,&id)?.url().map_err(|e|e.to_string())?;
    Ok(website(url.as_str())?.to_string())
}
#[tauri::command]
pub async fn browser_action(app: AppHandle, webview: Webview, id: String, action: String) -> Result<(), String> {
    authorize(&webview)?;
    let script = match action.as_str() {
        "back" => "window.history.back()", "forward" => "window.history.forward()", "reload" => "window.location.reload()",
        _ => return Err("Unknown browser action".into()),
    };
    // Only fixed browser navigation instructions are evaluated, never caller-supplied code.
    view(&app,&id)?.eval(script).map_err(|e| e.to_string())
}
#[tauri::command]
pub async fn browser_close(app: AppHandle, webview: Webview, id: String) -> Result<(), String> {
    authorize(&webview)?;
    if let Some(browser) = app.get_webview(&label(&id)?) { browser.close().map_err(|e| e.to_string())?; }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn navigation_rejects_local_and_active_schemes() {
        assert!(website("https://learn.canterbury.ac.nz/").is_ok());
        for url in ["javascript:alert(1)","file:///c:/private","tauri://localhost/", "http://example.com", "https://user:pass@example.com"] {
            assert!(website(url).is_err());
        }
    }
    #[test] fn ids_and_bounds_are_constrained() {
        assert!(label("abc-123").is_ok()); assert!(label("../main").is_err());
        assert!(Bounds{x:0.0,y:0.0,width:400.0,height:300.0}.validate().is_ok());
        assert!(Bounds{x:f64::NAN,y:0.0,width:400.0,height:300.0}.validate().is_err());
    }
}
