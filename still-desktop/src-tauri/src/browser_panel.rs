//! Isolated, untrusted remote web surfaces owned by Browser widgets.
//!
//! These are child webviews of Still's main window, and receive no Still IPC
//! capabilities. Every entry point is authorized against the local main view.
use serde::Serialize;
use std::collections::HashSet;
use std::sync::{Mutex, OnceLock};
use tauri::{AppHandle, Emitter, Manager, Webview, WebviewUrl};
use tauri::webview::WebviewBuilder;
use tauri::{LogicalPosition, LogicalSize};

#[derive(Default)]
pub struct BrowserPanelState { labels: Mutex<HashSet<String>> }

#[derive(Clone, Copy, serde::Deserialize)]
#[serde(rename_all="camelCase")]
pub struct Bounds { x:f64, y:f64, width:f64, height:f64 }
impl Bounds {
 fn validate(self)->Result<Self,String>{
  if ![self.x,self.y,self.width,self.height].iter().all(|v|v.is_finite()) || !(-20_000.0..=40_000.0).contains(&self.x) || !(-20_000.0..=40_000.0).contains(&self.y) || !(2.0..=10_000.0).contains(&self.width) || !(2.0..=10_000.0).contains(&self.height) {return Err("Invalid embedded browser bounds".into())}
  Ok(self)
 }
}
#[derive(Clone,Serialize)]#[serde(rename_all="camelCase")]struct BrowserLocation{widget_id:String,url:String}
fn label(widget_id:&str)->Result<String,String>{
 if widget_id.len()<1||widget_id.len()>80||!widget_id.bytes().all(|b|b.is_ascii_alphanumeric()||b==b'-'){return Err("Invalid Browser widget id".into())}
 Ok(format!("still_browser_{widget_id}"))
}
fn secure_url(value:&str)->Result<url::Url,String>{
 if value.is_empty()||value.len()>4096{return Err("Enter a website address".into())}
 let url=url::Url::parse(value).map_err(|_|"Enter a valid HTTPS address")?;
 if url.scheme()!="https"||url.host_str().is_none()||!url.username().is_empty()||url.password().is_some(){return Err("Use an HTTPS address without embedded credentials".into())}
 Ok(url)
}
static CREATE_LOCK:OnceLock<Mutex<()>>=OnceLock::new();
fn ensure_view(app:AppHandle,id:String,url:url::Url)->Result<(),String>{
 let label=label(&id)?;
 if app.get_webview(&label).is_some(){return Ok(())}
 let window=app.get_window("main").ok_or("Still window is unavailable")?;
 let app_for_navigation=app.clone();let event_id=id.clone();
 let builder=WebviewBuilder::new(label.clone(),WebviewUrl::External(url.clone()))
  .additional_browser_args(&crate::automation_runtime::browser_webview_args())
  .on_navigation(move|target|{
   if target.scheme()!="https"||target.host_str().is_none()||!target.username().is_empty()||target.password().is_some(){return false}
   let payload=BrowserLocation{widget_id:event_id.clone(),url:target.as_str().to_string()};
   let _=app_for_navigation.emit_to("main","still-browser-url",payload);
   true
  })
  .on_new_window(|_,_|tauri::webview::NewWindowResponse::Deny);
 // Tauri's add_child is synchronous and deadlocks when invoked on the webview/UI
 // thread. Callers execute this helper on a blocking worker via spawn_blocking.
 let view=window.add_child(builder,LogicalPosition::new(0.0,0.0),LogicalSize::new(2.0,2.0)).map_err(|e|e.to_string())?;
 let state=app.state::<BrowserPanelState>();state.labels.lock().map_err(|_|"Browser lifecycle state unavailable")?.insert(label);
 view.hide().map_err(|e|e.to_string())?;
 Ok(())
}
fn panel(app:&AppHandle,id:&str)->Result<Webview,String>{let name=label(id)?;app.get_webview(&name).ok_or_else(||"Embedded Browser is not open".into())}
#[tauri::command]
pub async fn browser_panel_present(app:AppHandle,webview:Webview,widget_id:String,url:String,bounds:Bounds,visible:bool)->Result<(),String>{
 crate::security::authorize(&webview)?;let id=widget_id.clone();let app_copy=app.clone();
 if !visible {if let Some(view)=app.get_webview(&label(&widget_id)?){view.hide().map_err(|e|e.to_string())?}return Ok(())}
 let bounds=bounds.validate()?;let url=secure_url(&url)?;
 tauri::async_runtime::spawn_blocking(move||{
  let lock=CREATE_LOCK.get_or_init(||Mutex::new(()));let _guard=lock.lock().map_err(|_|"Browser lifecycle lock failed")?;
  ensure_view(app_copy.clone(),id.clone(),url)?;
  let view=panel(&app_copy,&id)?;view.set_position(LogicalPosition::new(bounds.x,bounds.y)).map_err(|e|e.to_string())?;view.set_size(LogicalSize::new(bounds.width,bounds.height)).map_err(|e|e.to_string())?;view.show().map_err(|e|e.to_string())
 }).await.map_err(|e|e.to_string())?
}
#[tauri::command]
pub fn browser_panel_navigate(app:AppHandle,webview:Webview,widget_id:String,url:String)->Result<(),String>{
 crate::security::authorize(&webview)?;let url=secure_url(&url)?;panel(&app,&widget_id)?.navigate(url).map_err(|e|e.to_string())
}
#[tauri::command]
pub fn browser_panel_go_back(app:AppHandle,webview:Webview,widget_id:String)->Result<(),String>{crate::security::authorize(&webview)?;panel(&app,&widget_id)?.eval("history.back()").map_err(|e|e.to_string())}
#[tauri::command]
pub fn browser_panel_go_forward(app:AppHandle,webview:Webview,widget_id:String)->Result<(),String>{crate::security::authorize(&webview)?;panel(&app,&widget_id)?.eval("history.forward()").map_err(|e|e.to_string())}
#[tauri::command]
pub fn browser_panel_reload(app:AppHandle,webview:Webview,widget_id:String)->Result<(),String>{crate::security::authorize(&webview)?;panel(&app,&widget_id)?.reload().map_err(|e|e.to_string())}
#[tauri::command]
pub async fn browser_panel_close(app:AppHandle,webview:Webview,widget_id:String)->Result<(),String>{
 crate::security::authorize(&webview)?;let name=label(&widget_id)?;let worker_app=app.clone();
 tauri::async_runtime::spawn_blocking(move||{
  let lock=CREATE_LOCK.get_or_init(||Mutex::new(()));let _guard=lock.lock().map_err(|_|"Browser lifecycle lock failed")?;
  if let Some(view)=worker_app.get_webview(&name){view.close().map_err(|e|e.to_string())?}
  if let Ok(mut labels)=worker_app.state::<BrowserPanelState>().labels.lock(){labels.remove(&name);}Ok(())
 }).await.map_err(|e|e.to_string())?
}
pub fn shutdown(app:&AppHandle){
 let Some(state)=app.try_state::<BrowserPanelState>() else{return};let Ok(mut labels)=state.labels.lock() else{return};
 for name in labels.drain(){if let Some(view)=app.get_webview(&name){let _=view.close();}}
}

#[cfg(test)]mod tests{
 use super::*;
 #[test]fn browser_ids_become_private_child_labels(){assert_eq!(label("a1b2-c3").unwrap(),"still_browser_a1b2-c3");for invalid in ["../main","a b","",&"x".repeat(81)]{assert!(label(invalid).is_err())}}
 #[test]fn only_safe_https_addresses_are_accepted(){assert_eq!(secure_url("https://example.com/path").unwrap().as_str(),"https://example.com/path");for invalid in ["http://example.com","file:///c:/secret","javascript:alert(1)","https://user:pass@example.com","https://"]{assert!(secure_url(invalid).is_err(),"accepted {invalid}")}}
 #[test]fn browser_bounds_are_finite_and_bounded(){assert!(Bounds{x:0.,y:0.,width:300.,height:180.}.validate().is_ok());assert!(Bounds{x:f64::NAN,y:0.,width:300.,height:180.}.validate().is_err());assert!(Bounds{x:0.,y:0.,width:1.,height:180.}.validate().is_err())}
}
