use serde::Deserialize;
use std::sync::atomic::{AtomicBool,Ordering};
use std::sync::atomic::AtomicU32;
use tauri::{AppHandle,Emitter,Manager,Webview,Window};
use windows::Win32::{Foundation::{POINT,RECT},Graphics::Gdi::{ClientToScreen,CombineRgn,CreateRectRgn,DeleteObject,HGDIOBJ,HRGN,RGN_OR,SetWindowRgn},UI::WindowsAndMessaging::GetWindowRect};

#[derive(Clone,Copy,Debug,Deserialize)]
pub struct HitRegion { pub x:f64,pub y:f64,pub width:f64,pub height:f64 }

static TOGGLE_ENABLED:AtomicBool=AtomicBool::new(false);
static ACTIVE:AtomicBool=AtomicBool::new(false);
static TOGGLE_HOTKEY_KEY:AtomicU32=AtomicU32::new(0);
static TOGGLE_HOTKEY_PRESSED:AtomicBool=AtomicBool::new(false);

pub fn toggle_enabled()->bool{TOGGLE_ENABLED.load(Ordering::Relaxed)}
pub fn active()->bool{ACTIVE.load(Ordering::Relaxed)}
pub fn take_hotkey_keyup(key:u32)->bool{TOGGLE_HOTKEY_KEY.load(Ordering::Relaxed)==key&&TOGGLE_HOTKEY_PRESSED.swap(false,Ordering::Relaxed)}
pub fn mark_hotkey_keydown(key:u32)->bool{TOGGLE_HOTKEY_KEY.store(key,Ordering::Relaxed);!TOGGLE_HOTKEY_PRESSED.swap(true,Ordering::Relaxed)}

fn publish(app:&AppHandle,value:bool){let _=app.emit_to("main","whole-window-click-through-changed",value);}
fn set_active(app:&AppHandle,value:bool)->Result<(),String>{
 let window=app.get_webview_window("main").ok_or("Still window is unavailable")?;
 window.set_ignore_cursor_events(value).map_err(|error|error.to_string())?;
 ACTIVE.store(value,Ordering::Relaxed);publish(app,value);Ok(())
}

pub fn toggle_from_hotkey(app:AppHandle){if !toggle_enabled(){return}let next=!active();if let Err(error)=set_active(&app,next){eprintln!("Unable to toggle whole-window click-through: {error}");}}

#[tauri::command]
pub fn window_input_configure_toggle(webview:Webview,app:AppHandle,enabled:bool)->Result<(),String>{
 crate::security::authorize(&webview)?;
 TOGGLE_ENABLED.store(enabled,Ordering::Relaxed);
 if !enabled&&active(){set_active(&app,false)?;}Ok(())
}

#[tauri::command]
pub fn window_input_set_click_through(webview:Webview,app:AppHandle,active:bool)->Result<(),String>{
 crate::security::authorize(&webview)?;
 if active&&!toggle_enabled(){return Err("Enable the whole-window click-through shortcut first.".into())}
 set_active(&app,active)
}

#[tauri::command]
pub fn window_input_update_regions(webview:Webview,window:Window,enabled:bool,regions:Vec<HitRegion>)->Result<(),String>{
 crate::security::authorize(&webview)?;
 let hwnd=window.hwnd().map_err(|error|error.to_string())?;
 if !enabled||regions.is_empty(){unsafe{SetWindowRgn(hwnd,None,true);}return Ok(())}
 if regions.len()>512{return Err("Too many interactive regions.".into())}
 let scale=window.scale_factor().map_err(|error|error.to_string())?;
 if !scale.is_finite()||scale<=0.0{return Err("Still window scale is invalid.".into())}
 let mut outer=RECT::default();
 let mut client_origin=POINT::default();
 unsafe{GetWindowRect(hwnd,&mut outer).map_err(|error|error.to_string())?;if !ClientToScreen(hwnd,&mut client_origin).as_bool(){return Err("Still window client area is unavailable.".into())}}
 let window_width=outer.right.saturating_sub(outer.left);let window_height=outer.bottom.saturating_sub(outer.top);
 if window_width<=0||window_height<=0{return Ok(())}
 let offset_x=client_origin.x.saturating_sub(outer.left) as f64;
 let offset_y=client_origin.y.saturating_sub(outer.top) as f64;
 let union=unsafe{CreateRectRgn(0,0,0,0)};
 if union.0.is_null(){return Err("Could not create Still's input region.".into())}
 for rect in regions{
  if [rect.x,rect.y,rect.width,rect.height].iter().any(|value|!value.is_finite())||rect.width<=0.0||rect.height<=0.0||rect.x.abs()>100_000.0||rect.y.abs()>100_000.0||rect.width>100_000.0||rect.height>100_000.0{
   unsafe{let _=DeleteObject(HGDIOBJ(union.0));}return Err("Invalid interactive region.".into())
  }
  // Include the glass shadow and a small comfortable hit margin around each control.
  let margin=18.0;
  let left=(offset_x+(rect.x-margin)*scale).floor().clamp(0.0,window_width as f64) as i32;
  let top=(offset_y+(rect.y-margin)*scale).floor().clamp(0.0,window_height as f64) as i32;
  let right=(offset_x+(rect.x+rect.width+margin)*scale).ceil().clamp(0.0,window_width as f64) as i32;
  let bottom=(offset_y+(rect.y+rect.height+margin)*scale).ceil().clamp(0.0,window_height as f64) as i32;
  if left>=right||top>=bottom{continue}
  let part=unsafe{CreateRectRgn(left,top,right,bottom)};
  if part.0.is_null(){unsafe{let _=DeleteObject(HGDIOBJ(union.0));}return Err("Could not add an interactive area.".into())}
  let combined=unsafe{CombineRgn(Some(union),Some(union),Some(part),RGN_OR)};
  unsafe{let _=DeleteObject(HGDIOBJ(part.0));}
  if combined==windows::Win32::Graphics::Gdi::RGN_ERROR{unsafe{let _=DeleteObject(HGDIOBJ(union.0));}return Err("Could not combine Still's interactive areas.".into())}
 }
 if unsafe{SetWindowRgn(hwnd,Some(HRGN(union.0)),true)}==0{unsafe{let _=DeleteObject(HGDIOBJ(union.0));}return Err("Could not apply Still's interactive areas.".into())}
 Ok(())
}

#[cfg(test)]
mod tests{
 use super::*;
 #[test]fn click_through_keyup_is_suppressed_for_the_configured_key(){
  assert!(mark_hotkey_keydown(b'P' as u32));
  assert!(!mark_hotkey_keydown(b'P' as u32));
  assert!(!take_hotkey_keyup(b'O' as u32));
  assert!(take_hotkey_keyup(b'P' as u32));
  assert!(!take_hotkey_keyup(b'P' as u32));
 }
}
