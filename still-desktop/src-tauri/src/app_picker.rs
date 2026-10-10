use serde::Serialize;
use std::{collections::HashMap,path::Path,sync::atomic::{AtomicUsize,Ordering}};
use tauri::{AppHandle,Manager,Webview};
use windows::{core::PCWSTR,Win32::{Foundation::{HWND,LPARAM,RECT,WPARAM},Graphics::Gdi::*,Storage::{FileSystem::*,Xps::{PrintWindow,PRINT_WINDOW_FLAGS}},UI::{Shell::ExtractIconExW,WindowsAndMessaging::*}}};

fn wide(text:&str)->Vec<u16>{text.encode_utf16().chain(Some(0)).collect()}
fn handle(value:usize)->HWND{HWND(value as *mut _)}
fn window_pid(hwnd:HWND)->u32{let mut value=0;unsafe{GetWindowThreadProcessId(hwnd,Some(&mut value));}value}
fn window_matches(hwnd:usize,pid:u32)->bool{pid!=0&&unsafe{IsWindow(Some(handle(hwnd))).as_bool()}&&window_pid(handle(hwnd))==pid}
fn title(hwnd:HWND)->String{unsafe{let mut text=vec![0;GetWindowTextLengthW(hwnd).clamp(0,4096) as usize+1];let length=GetWindowTextW(hwnd,&mut text).max(0) as usize;String::from_utf16_lossy(&text[..length])}}
fn clean_name(text:&str)->String{text.chars().map(|c|if c.is_control()||c=='/'||c=='\\'{' '}else{c}).take(200).collect::<String>().trim().to_owned()}

#[derive(Serialize)]#[serde(rename_all="camelCase")]
pub struct PickerWindow{hwnd:usize,pid:u32,app_name:String,title:String,attached:bool,minimized:bool,icon:Vec<u8>}

fn version_name(path:&str)->Option<String>{unsafe{
 let filename=wide(path);let size=GetFileVersionInfoSizeW(PCWSTR(filename.as_ptr()),None);if size==0||size>1024*1024{return None}
 let mut data=vec![0u8;size as usize];GetFileVersionInfoW(PCWSTR(filename.as_ptr()),None,size,data.as_mut_ptr().cast()).ok()?;
 let mut pointer=std::ptr::null_mut();let mut length=0;let key=wide("\\VarFileInfo\\Translation");let mut languages=Vec::new();
 if VerQueryValueW(data.as_ptr().cast(),PCWSTR(key.as_ptr()),&mut pointer,&mut length).as_bool()&&!pointer.is_null(){for i in 0..(length/4).min(8){let p=pointer.cast::<u16>().add(i as usize*2);languages.push((std::ptr::read_unaligned(p),std::ptr::read_unaligned(p.add(1))));}}
 languages.push((0x0409,0x04b0));
 for (language,page) in languages{for field in ["FileDescription","ProductName"]{let key=wide(&format!("\\StringFileInfo\\{language:04x}{page:04x}\\{field}"));pointer=std::ptr::null_mut();length=0;
  if VerQueryValueW(data.as_ptr().cast(),PCWSTR(key.as_ptr()),&mut pointer,&mut length).as_bool()&&!pointer.is_null()&&length>1{
   let words=(0..length.min(512) as usize).map(|i|std::ptr::read_unaligned(pointer.cast::<u16>().add(i))).take_while(|v|*v!=0).collect::<Vec<_>>();
   let name=clean_name(&String::from_utf16_lossy(&words));if !name.is_empty(){return Some(name)}
  }
 }}None
}}

struct Bitmap{desktop:HDC,memory:HDC,bitmap:HBITMAP,previous:HGDIOBJ,width:i32,height:i32}
impl Bitmap{
 fn new(width:i32,height:i32)->Result<Self,String>{unsafe{
  if width<1||height<1||width as i64*height as i64>16_000_000{return Err("This window is too large to preview.".into())}
  let desktop=GetDC(None);let memory=CreateCompatibleDC(Some(desktop));let bitmap=CreateCompatibleBitmap(desktop,width,height);
  if desktop.0.is_null()||memory.0.is_null()||bitmap.0.is_null(){if !bitmap.0.is_null(){let _=DeleteObject(HGDIOBJ(bitmap.0));}if !memory.0.is_null(){let _=DeleteDC(memory);}if !desktop.0.is_null(){ReleaseDC(None,desktop);}return Err("Preview is unavailable.".into())}
  let previous=SelectObject(memory,HGDIOBJ(bitmap.0));let result=Self{desktop,memory,bitmap,previous,width,height};
  FillRect(memory,&RECT{left:0,top:0,right:width,bottom:height},HBRUSH(GetStockObject(WHITE_BRUSH).0));Ok(result)
 }}
 fn image(&self)->Result<image::RgbaImage,String>{unsafe{
  SelectObject(self.memory,self.previous);let mut info=BITMAPINFO::default();info.bmiHeader=BITMAPINFOHEADER{biSize:std::mem::size_of::<BITMAPINFOHEADER>() as u32,biWidth:self.width,biHeight:-self.height,biPlanes:1,biBitCount:32,biCompression:BI_RGB.0,..Default::default()};
  let mut bytes=vec![0;(self.width*self.height*4) as usize];if GetDIBits(self.memory,self.bitmap,0,self.height as u32,Some(bytes.as_mut_ptr().cast()),&mut info,DIB_RGB_COLORS)!=self.height{return Err("Preview is unavailable.".into())}
  for pixel in bytes.chunks_exact_mut(4){pixel.swap(0,2);pixel[3]=255;}
  image::RgbaImage::from_raw(self.width as u32,self.height as u32,bytes).ok_or("Preview is unavailable.".into())
 }}
}
impl Drop for Bitmap{fn drop(&mut self){unsafe{SelectObject(self.memory,self.previous);let _=DeleteObject(HGDIOBJ(self.bitmap.0));let _=DeleteDC(self.memory);ReleaseDC(None,self.desktop);}}}
fn png(image:image::DynamicImage)->Result<Vec<u8>,String>{let mut bytes=std::io::Cursor::new(Vec::new());image.write_to(&mut bytes,image::ImageFormat::Png).map_err(|e|e.to_string())?;Ok(bytes.into_inner())}
fn icon(hwnd:HWND,path:Option<&str>)->Vec<u8>{unsafe{
 let mut owned=false;let mut image=HICON::default();
 if let Some(path)=path{let filename=wide(path);if ExtractIconExW(PCWSTR(filename.as_ptr()),0,None,Some(&mut image),1)>0{owned=true}}
 if image.0.is_null(){let mut result=0;SendMessageTimeoutW(hwnd,WM_GETICON,WPARAM(ICON_SMALL2 as usize),LPARAM(0),SMTO_ABORTIFHUNG|SMTO_BLOCK,60,Some(&mut result));image=HICON(result as *mut _);}
 if image.0.is_null(){image=HICON(GetClassLongPtrW(hwnd,GCLP_HICONSM) as *mut _)}
 let result=(||{if image.0.is_null(){return Err("No app icon")};let bitmap=Bitmap::new(32,32).map_err(|_|"No app icon")?;DrawIconEx(bitmap.memory,0,0,image,32,32,0,None,DI_NORMAL).map_err(|_|"No app icon")?;png(image::DynamicImage::ImageRgba8(bitmap.image().map_err(|_|"No app icon")?)).map_err(|_|"No app icon")})();
 if owned{let _=DestroyIcon(image);}result.unwrap_or_default()
}}

fn choices(app:&AppHandle,source_id:Option<&str>)->Result<Vec<PickerWindow>,String>{
 let expected=source_id.map(|id|app.state::<crate::dropped_files::AppGrants>().target(id)).transpose()?.and_then(|path|crate::app_panel::expected_executable(&path));
 let mut list=crate::app_panel::windows();let managed=crate::app_panel::managed_windows(app).into_iter().chain(crate::chrome_overlay::managed_windows(app)).collect::<Vec<_>>();
 for (hwnd,pid) in &managed{if window_matches(*hwnd,*pid){list.push(crate::app_panel::WindowInfo{hwnd:*hwnd,pid:*pid,title:title(handle(*hwnd)),executable:crate::app_panel::executable(*pid)});}}
 let mut cache=HashMap::<String,(String,Vec<u8>)>::new();let mut result=Vec::new();
 for window in list.into_iter().take(200){if expected.as_ref().is_some_and(|path|!crate::app_panel::matches_executable(&window,path)){continue}
  let (name,picture)=if let Some(path)=window.executable.as_ref(){cache.entry(path.clone()).or_insert_with(||(version_name(path).unwrap_or_else(||clean_name(&Path::new(path).file_stem().unwrap_or_default().to_string_lossy())),icon(handle(window.hwnd),Some(path)))).clone()}else{("App".into(),icon(handle(window.hwnd),None))};
  result.push(PickerWindow{hwnd:window.hwnd,pid:window.pid,app_name:name,title:window.title,attached:managed.contains(&(window.hwnd,window.pid)),minimized:unsafe{IsIconic(handle(window.hwnd)).as_bool()},icon:picture});
 }Ok(result)
}
fn selected_from(windows:Vec<crate::app_panel::WindowInfo>,hwnd:usize,pid:u32)->Result<crate::app_panel::WindowInfo,String>{
 windows.into_iter().find(|w|w.hwnd==hwnd&&w.pid==pid&&window_matches(hwnd,pid)).ok_or("This window is closed or already attached. Refresh the list.".into())
}
fn selected(hwnd:usize,pid:u32)->Result<crate::app_panel::WindowInfo,String>{
 selected_from(crate::app_panel::windows(),hwnd,pid)
}
fn selected_for_prepare_from(unmanaged:Vec<crate::app_panel::WindowInfo>,managed:Vec<crate::app_panel::WindowInfo>,hwnd:usize,pid:u32)->Result<crate::app_panel::WindowInfo,String>{
 if let Some(window)=managed.into_iter().find(|window|window.hwnd==hwnd&&window.pid==pid&&window_matches(hwnd,pid)){return Ok(window)}
 selected_from(unmanaged,hwnd,pid)
}
fn selected_for_prepare(app:&AppHandle,hwnd:usize,pid:u32)->Result<crate::app_panel::WindowInfo,String>{
 let managed=crate::app_panel::managed_windows(app).into_iter().map(|(hwnd,pid)|crate::app_panel::WindowInfo{hwnd,pid,title:title(handle(hwnd)),executable:crate::app_panel::executable(pid)}).collect();
 selected_for_prepare_from(crate::app_panel::windows(),managed,hwnd,pid)
}
#[tauri::command]
pub async fn app_picker_windows(app:AppHandle,webview:Webview,source_id:Option<String>)->Result<Vec<PickerWindow>,String>{
 crate::browser::authorize(&webview)?;tauri::async_runtime::spawn_blocking(move||choices(&app,source_id.as_deref())).await.map_err(|e|e.to_string())?
}
#[tauri::command]
pub async fn app_picker_prepare(app:AppHandle,webview:Webview,hwnd:usize,pid:u32)->Result<crate::dropped_files::DropEntry,String>{
 crate::browser::authorize(&webview)?;
 tauri::async_runtime::spawn_blocking(move||{let window=selected_for_prepare(&app,hwnd,pid)?;let path=window.executable.ok_or("Windows could not identify this app's executable. It may run at a different permission level.")?;
  let state=app.state::<crate::dropped_files::AppGrants>();let mut entry=state.register(&crate::dropped_files::source_id()?,Path::new(&path))?;
  entry.name=version_name(&path).unwrap_or_else(||clean_name(&Path::new(&path).file_stem().unwrap_or_default().to_string_lossy()));
  state.persist(&app.path().app_data_dir().map_err(|e|e.to_string())?)?;Ok(entry)
 }).await.map_err(|e|e.to_string())?
}

static PREVIEWS:AtomicUsize=AtomicUsize::new(0);
struct PreviewPermit;impl Drop for PreviewPermit{fn drop(&mut self){PREVIEWS.fetch_sub(1,Ordering::Relaxed);}}
fn render_preview(hwnd:usize,pid:u32)->Result<Vec<u8>,String>{unsafe{
 if !window_matches(hwnd,pid)||!IsWindowVisible(handle(hwnd)).as_bool()||IsIconic(handle(hwnd)).as_bool(){return Err("Restore this app window before previewing it.".into())}
 let mut rect=RECT::default();GetWindowRect(handle(hwnd),&mut rect).map_err(|e|e.to_string())?;
 let bitmap=Bitmap::new(rect.right-rect.left,rect.bottom-rect.top)?;
 if !PrintWindow(handle(hwnd),bitmap.memory,PRINT_WINDOW_FLAGS(0)).as_bool(){return Err("This app does not provide a window preview.".into())}
 let frame=bitmap.image()?;if frame.pixels().all(|p|p[0]==0&&p[1]==0&&p[2]==0){return Err("This app does not provide a window preview.".into())}
 png(image::DynamicImage::ImageRgba8(frame).thumbnail(320,180))
}}
fn preview(hwnd:usize,pid:u32)->Result<Vec<u8>,String>{
 selected(hwnd,pid)?;
 PREVIEWS.try_update(Ordering::Relaxed,Ordering::Relaxed,|n|(n<2).then_some(n+1)).map_err(|_|"Other previews are still responding. You can attach without a preview.")?;
 let permit=PreviewPermit;let (sender,receiver)=std::sync::mpsc::channel();
 std::thread::Builder::new().name("still-app-preview".into()).spawn(move||{let _permit=permit;let _=sender.send(render_preview(hwnd,pid));}).map_err(|e|e.to_string())?;
 receiver.recv_timeout(std::time::Duration::from_millis(1500)).map_err(|_|"This app did not provide a preview in time. You can still attach it.".to_string())?
}
#[tauri::command]
pub async fn app_picker_preview(webview:Webview,hwnd:usize,pid:u32)->Result<Vec<u8>,String>{crate::browser::authorize(&webview)?;tauri::async_runtime::spawn_blocking(move||preview(hwnd,pid)).await.map_err(|e|e.to_string())?}

#[cfg(test)]mod tests{
 use super::*;
 use crate::app_panel::WindowInfo;
 #[test]fn names_are_safe_for_saved_app_references(){assert_eq!(clean_name("  Microsoft / Word\n "),"Microsoft   Word");assert!(clean_name(&"a".repeat(500)).len()<=200);}
 #[test]fn bitmap_icon_rendering_encodes_real_pixels_and_rejects_unbounded_dimensions(){unsafe{
  assert!(Bitmap::new(0,20).is_err());assert!(Bitmap::new(20000,20000).is_err());
  let bitmap=Bitmap::new(32,32).unwrap();let image=LoadIconW(None,IDI_APPLICATION).unwrap();DrawIconEx(bitmap.memory,0,0,image,32,32,0,None,DI_NORMAL).unwrap();
  let bytes=png(image::DynamicImage::ImageRgba8(bitmap.image().unwrap())).unwrap();let decoded=image::load_from_memory(&bytes).unwrap();assert_eq!((decoded.width(),decoded.height()),(32,32));
 }}
 #[test]fn stale_process_identity_and_hidden_windows_are_rejected_before_previewing(){unsafe{
  let class=wide("STATIC");let caption=wide("Still app preview fixture");let hwnd=CreateWindowExW(WINDOW_EX_STYLE(0),PCWSTR(class.as_ptr()),PCWSTR(caption.as_ptr()),WS_OVERLAPPEDWINDOW,0,0,640,400,None,None,None,None).unwrap();
  let id=hwnd.0 as usize;let process=std::process::id();assert!(window_matches(id,process));assert!(!window_matches(id,process+1));
  assert!(render_preview(id,process).unwrap_err().contains("Restore"));let _=DestroyWindow(hwnd);assert!(!window_matches(id,process));assert!(render_preview(id,process).is_err());
 }}
 #[test]fn preparation_resolves_the_exact_window_identity_and_rejects_stale_handles(){unsafe{
  let class=wide("STATIC");let caption=wide("Still picker identity fixture");let hwnd=CreateWindowExW(WINDOW_EX_STYLE(0),PCWSTR(class.as_ptr()),PCWSTR(caption.as_ptr()),WS_OVERLAPPEDWINDOW,0,0,640,400,None,None,None,None).unwrap();
  let id=hwnd.0 as usize;let process=std::process::id();let other=WindowInfo{hwnd:id+1,pid:process,title:"Other document".into(),executable:None};
  let stale=WindowInfo{hwnd:id,pid:process+1,title:"Wrong process".into(),executable:None};let exact=WindowInfo{hwnd:id,pid:process,title:"Selected document".into(),executable:None};
  assert_eq!(selected_from(vec![other,stale,exact],id,process).unwrap().title,"Selected document");
  let _=DestroyWindow(hwnd);let gone=WindowInfo{hwnd:id,pid:process,title:"Closed document".into(),executable:None};
  assert!(selected_from(vec![gone],id,process).is_err());
 }}
 #[test]fn preparation_accepts_an_exact_already_managed_window_for_quick_save(){unsafe{
  let class=wide("STATIC");let caption=wide("Still managed picker fixture");let hwnd=CreateWindowExW(WINDOW_EX_STYLE(0),PCWSTR(class.as_ptr()),PCWSTR(caption.as_ptr()),WS_OVERLAPPEDWINDOW,0,0,640,400,None,None,None,None).unwrap();
  let id=hwnd.0 as usize;let process=std::process::id();let other=WindowInfo{hwnd:id+1,pid:process,title:"Other document".into(),executable:Some("other.exe".into())};let managed=WindowInfo{hwnd:id,pid:process,title:"Attached Chrome".into(),executable:Some("chrome.exe".into())};
  let selected=selected_for_prepare_from(vec![],vec![other,managed],id,process).unwrap();assert_eq!(selected.executable.as_deref(),Some("chrome.exe"));
  let _=DestroyWindow(hwnd);assert!(selected_for_prepare_from(vec![],vec![WindowInfo{hwnd:id,pid:process,title:"Closed".into(),executable:Some("chrome.exe".into())}],id,process).is_err());
 }}
}
