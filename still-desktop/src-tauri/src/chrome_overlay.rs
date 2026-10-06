//! A positioned, owned TOP-LEVEL Chrome window. No SetParent, browser automation,
//! remote debugging, injected page scripts, or access to the user's normal profile.
use serde::{Deserialize,Serialize};
use std::{collections::HashMap,sync::{Mutex,OnceLock}};
use tauri::{AppHandle,Emitter,Manager,Webview};
use windows::{core::PCWSTR,Win32::{Foundation::{HWND,LPARAM,POINT,RECT,WPARAM},Graphics::Gdi::*,UI::{WindowsAndMessaging::*,Accessibility::{SetWinEventHook,HWINEVENTHOOK}}}};

#[derive(Clone,Debug,Deserialize)]
pub struct Bounds {pub x:f64,pub y:f64,pub width:f64,pub height:f64}
impl Bounds {
 fn validate(&self)->Result<(),String>{
   if [self.x,self.y,self.width,self.height].iter().any(|v|!v.is_finite())||self.x< -20000.||self.y< -20000.||self.x>20000.||self.y>20000.||self.width<1.||self.height<1.||self.x+self.width>40000.||self.y+self.height>40000. {Err("Invalid Chrome panel bounds".into())}else{Ok(())}
 }
 fn screen(&self,origin:POINT,scale:f64)->(i32,i32,i32,i32){((origin.x as f64+self.x*scale).round() as i32,(origin.y as f64+self.y*scale).round() as i32,(self.width*scale).round().max(1.) as i32,(self.height*scale).round().max(1.) as i32)}
}
type ScreenRect=(i32,i32,i32,i32);
struct Entry {hwnd:usize,pid:u32,bounds:Bounds,clip:Bounds,occlusions:Vec<Bounds>,visible:bool,shown:bool,last:Option<(ScreenRect,ScreenRect,Vec<ScreenRect>,bool)>}
#[derive(Default)]
pub struct ChromeState(Mutex<HashMap<String,Entry>>);
pub(crate) fn managed_windows(app:&AppHandle)->Vec<(usize,u32)>{app.state::<ChromeState>().0.lock().map(|s|s.values().map(|e|(e.hwnd,e.pid)).collect()).unwrap_or_default()}
static APP:OnceLock<AppHandle>=OnceLock::new();
static OWNER:std::sync::atomic::AtomicUsize=std::sync::atomic::AtomicUsize::new(0);
static CHROME_PID:std::sync::atomic::AtomicU32=std::sync::atomic::AtomicU32::new(0);
fn handle(value:usize)->HWND{HWND(value as *mut std::ffi::c_void)}
fn wide(value:&str)->Vec<u16>{value.encode_utf16().chain(Some(0)).collect()}
fn instance(id:&str)->Result<(),String>{if id.is_empty()||id.len()>80||!id.bytes().all(|v|v.is_ascii_alphanumeric()||v==b'-'){Err("Invalid browser instance".into())}else{Ok(())}}
fn property(id:&str,main:HWND)->Vec<u16>{wide(&format!("StillChrome-{}-{}-{id}",std::process::id(),main.0 as usize))}
fn owner(_app:&AppHandle)->Result<HWND,String>{let value=OWNER.load(std::sync::atomic::Ordering::Relaxed);if value==0{Err("Still window is missing".into())}else{Ok(handle(value))}}
fn pid(hwnd:HWND)->u32{let mut id=0;unsafe{GetWindowThreadProcessId(hwnd,Some(&mut id));}id}
pub fn is_managed_foreground(app:&AppHandle,hwnd:HWND)->bool{
 let process=pid(hwnd);
 let _=app;process!=0&&process==CHROME_PID.load(std::sync::atomic::Ordering::Relaxed)
}
fn is_group(app:&AppHandle,items:&HashMap<String,Entry>,main:HWND)->bool{
 let front=unsafe{GetForegroundWindow()};let process=pid(front);
 front==main||process==std::process::id()||items.values().any(|e|e.pid==process)||crate::app_panel::is_managed_foreground(app,front)||front.0.is_null()||app.get_window("main").is_none()
}
fn expanded(hwnd:HWND)->bool{unsafe{
 use windows::Win32::Graphics::Gdi::{MonitorFromWindow,GetMonitorInfoW,MONITORINFO,MONITOR_DEFAULTTONEAREST};
 if IsZoomed(hwnd).as_bool(){return true}
 let mut r=RECT::default();let mut monitor=MONITORINFO{cbSize:std::mem::size_of::<MONITORINFO>() as u32,..Default::default()};
 if GetWindowRect(hwnd,&mut r).is_err()||!GetMonitorInfoW(MonitorFromWindow(hwnd,MONITOR_DEFAULTTONEAREST),&mut monitor).as_bool(){return false}
 let m=monitor.rcMonitor;r.left<=m.left+2&&r.top<=m.top+2&&r.right>=m.right-2&&r.bottom>=m.bottom-2
}}
fn clipped_region(actual:&RECT,clip:ScreenRect,occlusions:&[ScreenRect])->Result<(HRGN,bool),String>{unsafe{
 let left=(clip.0-actual.left).max(0);let top=(clip.1-actual.top).max(0);
 let right=(clip.0+clip.2-actual.left).min(actual.right-actual.left).max(left);
 let bottom=(clip.1+clip.3-actual.top).min(actual.bottom-actual.top).max(top);
 let region=CreateRectRgn(left,top,right,bottom);
 if region.0.is_null(){return Err("Unable to create the Chrome clipping region.".into())}
 for hole in occlusions{
  let hole_left=(hole.0-actual.left).max(left);let hole_top=(hole.1-actual.top).max(top);
  let hole_right=(hole.0+hole.2-actual.left).min(right);let hole_bottom=(hole.1+hole.3-actual.top).min(bottom);
  if hole_left>=hole_right||hole_top>=hole_bottom{continue}
  let cutout=CreateRectRgn(hole_left,hole_top,hole_right,hole_bottom);
  if cutout.0.is_null(){let _=DeleteObject(HGDIOBJ(region.0));return Err("Unable to mask overlapping workspace widgets.".into())}
  if CombineRgn(Some(region),Some(region),Some(cutout),RGN_DIFF)==RGN_ERROR{let _=DeleteObject(HGDIOBJ(cutout.0));let _=DeleteObject(HGDIOBJ(region.0));return Err("Unable to mask overlapping workspace widgets.".into())}
  let _=DeleteObject(HGDIOBJ(cutout.0));
 }
 let mut box_rect=RECT::default();let result=GetRgnBox(region,&mut box_rect);
 if result==NULLREGION{let _=DeleteObject(HGDIOBJ(region.0));return Ok((HRGN(std::ptr::null_mut()),false))}
 if result==RGN_ERROR{let _=DeleteObject(HGDIOBJ(region.0));return Err("Unable to measure the Chrome clipping region.".into())}
 Ok((region,true))
}}
fn place(app:&AppHandle,items:&mut HashMap<String,Entry>){
 let Ok(main)=owner(app) else{return};
 let mut origin=POINT::default();if !unsafe{ClientToScreen(main,&mut origin).as_bool()}{return}
 let scale=unsafe{windows::Win32::UI::HiDpi::GetDpiForWindow(main)}.max(96) as f64/96.;
 let parent_visible=unsafe{IsWindowVisible(main).as_bool()&&!IsIconic(main).as_bool()};
 let group=is_group(app,items,main);
 for (id,item) in items.iter_mut(){
  let hwnd=handle(item.hwnd);if !unsafe{IsWindow(Some(hwnd)).as_bool()}{continue}
  let show=item.visible&&parent_visible&&group;
  if !show {if item.shown{unsafe{let _=ShowWindow(hwnd,SW_HIDE);}item.shown=false;}continue}
  let r=item.bounds.screen(origin,scale);let clip=item.clip.screen(origin,scale);let occlusions=item.occlusions.iter().map(|hole|hole.screen(origin,scale)).collect::<Vec<_>>();
  // Fullscreen/maximized video is Chrome's own mode. Leave it alone until the
  // user returns to the panel; hiding the workspace still hides this window.
  let is_expanded=expanded(hwnd);
  let signature=(r,clip,occlusions.clone(),is_expanded);
  if !is_expanded&&(item.last.as_ref().map(|last|last.0)!=Some(r)||!item.shown){
   let positioned=unsafe{SetWindowPos(hwnd,Some(HWND_TOP),r.0,r.1,r.2,r.3,SWP_NOACTIVATE|SWP_NOOWNERZORDER)};
   let mut actual=RECT::default();let measured=unsafe{GetWindowRect(hwnd,&mut actual)};
    if positioned.is_err()||measured.is_err()||(actual.left,actual.top)!=(r.0,r.1){
     unsafe{let _=ShowWindow(hwnd,SW_HIDE);}item.shown=false;item.last=None;
     let _=app.emit_to("main","chrome-state",serde_json::json!({"id":id,"open":true,"error":"Chrome could not align with its Browser widget."}));continue;
     }
  }
  if item.last.as_ref()!=Some(&signature){
   let mut actual=RECT::default();if unsafe{GetWindowRect(hwnd,&mut actual)}.is_err(){unsafe{let _=ShowWindow(hwnd,SW_HIDE);}item.shown=false;item.last=None;continue}
   let (region,has_region)=if is_expanded{(HRGN(std::ptr::null_mut()),true)}else{match clipped_region(&actual,clip,&occlusions){Ok(value)=>value,Err(_)=>{unsafe{let _=ShowWindow(hwnd,SW_HIDE);}item.shown=false;item.last=None;continue}}};
   if !has_region{unsafe{let _=ShowWindow(hwnd,SW_HIDE);}item.shown=false;item.last=None;continue}
   let applied=unsafe{SetWindowRgn(hwnd,(!region.0.is_null()).then_some(region),true)};
   if applied==0&&!region.0.is_null(){let _=unsafe{DeleteObject(HGDIOBJ(region.0))};unsafe{let _=ShowWindow(hwnd,SW_HIDE);}item.shown=false;item.last=None;continue}
   item.last=Some(signature);
  }
  if !item.shown{unsafe{let _=ShowWindow(hwnd,SW_SHOWNOACTIVATE);}item.shown=true;}
 }
}
pub fn refresh(app:&AppHandle){if let Ok(mut items)=app.state::<ChromeState>().0.try_lock(){place(app,&mut items)}}
unsafe extern "system" fn event(_:HWINEVENTHOOK,event:u32,hwnd:HWND,object:i32,child:i32,_:u32,_:u32){
 let Some(app)=APP.get() else{return};
 if event==EVENT_OBJECT_FOCUS {crate::shortcuts::refresh_editing(app.clone());return}
 if event==EVENT_OBJECT_DESTROY&&object==0&&child==0{
  if let Ok(mut items)=app.state::<ChromeState>().0.try_lock(){
   let closed:Vec<_>=items.iter().filter(|(_,e)|e.hwnd==hwnd.0 as usize).map(|(id,_)|id.clone()).collect();
   for id in closed{items.remove(&id);let _=app.emit_to("main","chrome-state",serde_json::json!({"id":id,"open":false}));}
   if items.is_empty(){CHROME_PID.store(0,std::sync::atomic::Ordering::Relaxed);}
  }
 }
 if event==EVENT_SYSTEM_FOREGROUND {crate::shortcuts::refresh_editing(app.clone());refresh(app);}
 // Parent location changes arrive during the modal Windows move/resize loop,
 // where ordinary Tauri window events can be delayed.
 if event==EVENT_OBJECT_LOCATIONCHANGE&&object==0&&owner(app).ok()==Some(hwnd){refresh(app);}
 if event==EVENT_OBJECT_LOCATIONCHANGE&&object==0&&owner(app).ok()!=Some(hwnd)&&is_managed_foreground(app,hwnd)&&!expanded(hwnd){
  if let Ok(mut items)=app.state::<ChromeState>().0.try_lock(){
   let mut r=RECT::default();if GetWindowRect(hwnd,&mut r).is_err(){return}
   if let Some(e)=items.values_mut().find(|e|e.hwnd==hwnd.0 as usize&&e.shown){
    if let Some((wanted,_,_,_))=e.last.as_ref(){
     // Chrome may enforce a larger minimum; only correct position or undersizing.
     if (r.left,r.top)!=(wanted.0,wanted.1)||r.right-r.left<wanted.2||r.bottom-r.top<wanted.3{e.last=None;place(app,&mut items);}
    }
   }
  }
 }
}
pub fn install(app:&AppHandle)->Result<(),String>{
 let _=APP.set(app.clone());
 let hwnd=app.get_window("main").ok_or("Still window is missing")?.hwnd().map_err(|e|e.to_string())?;
 OWNER.store(hwnd.0 as usize,std::sync::atomic::Ordering::Relaxed);
 unsafe{
  for (from,to) in [(EVENT_SYSTEM_FOREGROUND,EVENT_SYSTEM_FOREGROUND),(EVENT_OBJECT_DESTROY,EVENT_OBJECT_LOCATIONCHANGE)]{
   let hook=SetWinEventHook(from,to,None,Some(event),0,0,WINEVENT_OUTOFCONTEXT);
   if hook.0.is_null(){return Err("Unable to install Chrome window synchronization".into())}
  }
 }Ok(())
}
#[derive(Default)]struct Windows(Vec<(usize,u32)>);
unsafe extern "system" fn enumerate(hwnd:HWND,param:LPARAM)->windows::core::BOOL{
 let mut class=[0u16;100];let n=GetClassNameW(hwnd,&mut class);
 if String::from_utf16_lossy(&class[..n.max(0) as usize])=="Chrome_WidgetWin_1"{
  (*(param.0 as *mut Windows)).0.push((hwnd.0 as usize,pid(hwnd)));
 }windows::core::BOOL(1)
}
fn windows()->Vec<(usize,u32)>{let mut all=Windows::default();unsafe{let _=EnumWindows(Some(enumerate),LPARAM(&mut all as *mut _ as isize));}all.0}
fn profile_process(process:u32,profile:&std::path::Path)->bool{
 use std::os::windows::process::CommandExt;
 // One read-only identity check per candidate. Return a boolean only; never
 // print process command lines. Chrome can forward launches to an existing PID.
 let output=std::process::Command::new("powershell.exe").args(["-NoLogo","-NoProfile","-NonInteractive","-Command",
  "$p=Get-CimInstance Win32_Process -Filter ('ProcessId = '+$env:STILL_CHROME_PID); if($p.CommandLine -and $p.CommandLine.Contains('--user-data-dir='+$env:STILL_CHROME_PROFILE)){[Console]::Write('MATCH')} elseif($p.CommandLine -and $p.CommandLine.Contains('--user-data-dir=\"'+$env:STILL_CHROME_PROFILE+'\"')){[Console]::Write('MATCH')}"])
  .env("STILL_CHROME_PID",process.to_string()).env("STILL_CHROME_PROFILE",profile).creation_flags(0x08000000).output();
 output.map(|o|o.status.success()&&o.stdout==b"MATCH").unwrap_or(false)
}
fn open_window(profile:&std::path::Path,url:&str,id:&str,main:HWND,items:&HashMap<String,Entry>)->Result<(usize,u32),String>{
 use std::os::windows::process::CommandExt;
  let marker=property(id,main);let before=windows();
  let recovered=before.iter().copied().find(|(h,p)|unsafe{!GetPropW(handle(*h),PCWSTR(marker.as_ptr())).0.is_null()}&&profile_process(*p,profile));
  let (hwnd,process)=if let Some(saved)=recovered{saved}else{
   let mut child=std::process::Command::new(crate::chrome::executable()?).arg(format!("--user-data-dir={}",profile.display()))
    .args(["--new-window","--no-first-run","--no-default-browser-check","--force-renderer-accessibility"]).arg(url).creation_flags(0x08000000).spawn().map_err(|e|format!("Unable to launch Chrome: {e}"))?;
   let launched=child.id();let started=std::time::Instant::now();let mut checked=HashMap::new();
   #[cfg(test)]eprintln!("Chrome launch PID {launched}; pre-launch Chrome HWND count {}",before.len());
   loop{
    let candidate=windows().into_iter().filter(|(h,_)|!before.iter().any(|(old,_)|old==h)&&unsafe{GetWindow(handle(*h),GW_OWNER).map(|w|w.0.is_null()).unwrap_or(true)}).find(|(_,p)|
     *p==launched||items.values().any(|e|e.pid==*p)||*checked.entry(*p).or_insert_with(||profile_process(*p,profile)));
    if let Some(found)=candidate{break found}
    let _=child.try_wait();
    if started.elapsed()>std::time::Duration::from_secs(15){
     #[cfg(test)]eprintln!("Chrome discovery: windows {:?}, checked identities {:?}",windows(),checked);
     return Err("Chrome opened but its window could not be identified. Close the new Still-profile window before retrying.".into())
    }
    // Bounded startup discovery only. No ongoing window polling.
    std::thread::sleep(std::time::Duration::from_millis(100));
   }
  };
  unsafe{
   // GWLP_HWNDPARENT sets an OWNER for a top-level window; it does not reparent
   // Chrome, change WS_CHILD, strip Chrome's UI, or make it globally topmost.
   SetWindowLongPtrW(handle(hwnd),GWLP_HWNDPARENT,main.0 as isize);
   if GetWindow(handle(hwnd),GW_OWNER).ok()!=Some(main){return Err("Chrome ownership could not be set. Run Still and Chrome at the same Windows permission level.".into())}
   SetPropW(handle(hwnd),PCWSTR(marker.as_ptr()),Some(windows::Win32::Foundation::HANDLE(1usize as *mut _))).map_err(|e|e.to_string())?;
   let _=ShowWindow(handle(hwnd),SW_HIDE);
  }
 Ok((hwnd,process))
}
#[derive(Serialize)]pub struct Info {hwnd:usize,pid:u32}
#[tauri::command]
pub async fn chrome_panel_open(app:AppHandle,webview:Webview,id:String,url:String,bounds:Bounds)->Result<Info,String>{
 crate::browser::authorize(&webview)?;instance(&id)?;bounds.validate()?;let url=crate::chrome::website(&url)?;
 tauri::async_runtime::spawn_blocking(move||{
  let state=app.state::<ChromeState>();let mut items=state.0.lock().map_err(|_|"Chrome state is unavailable")?;
  if let Some(e)=items.get(&id){if unsafe{IsWindow(Some(handle(e.hwnd))).as_bool()}{return Ok(Info{hwnd:e.hwnd,pid:e.pid})}}
  items.remove(&id);
  let main=owner(&app)?;let profile=app.path().app_data_dir().map_err(|e|e.to_string())?.join("chrome-profile");
  std::fs::create_dir_all(&profile).map_err(|e|e.to_string())?;
  let (hwnd,process)=open_window(&profile,&url,&id,main,&items)?;
  CHROME_PID.store(process,std::sync::atomic::Ordering::Relaxed);
  crate::shortcuts::refresh_editing(app.clone());
   items.insert(id.clone(),Entry{hwnd,pid:process,clip:bounds.clone(),bounds,occlusions:Vec::new(),visible:false,shown:false,last:None});
  let _=app.emit_to("main","chrome-state",serde_json::json!({"id":id,"open":true}));
  Ok(Info{hwnd,pid:process})
 }).await.map_err(|e|e.to_string())?
}
#[tauri::command]
pub async fn chrome_panel_present(app:AppHandle,webview:Webview,id:String,bounds:Bounds,clip:Bounds,occlusions:Vec<Bounds>,visible:bool)->Result<(),String>{
 crate::browser::authorize(&webview)?;instance(&id)?;bounds.validate()?;clip.validate()?;if occlusions.len()>256{return Err("Too many overlapping workspace widgets".into())}for item in &occlusions{item.validate()?}
 let main=owner(&app)?;let state=app.state::<ChromeState>();let mut items=state.0.lock().map_err(|_|"Chrome state unavailable")?;
 let item=items.get_mut(&id).ok_or("Chrome was closed. Use Reopen Chrome.")?;
 if !unsafe{IsWindow(Some(handle(item.hwnd))).as_bool()}{items.remove(&id);if items.is_empty(){CHROME_PID.store(0,std::sync::atomic::Ordering::Relaxed);}return Err("Chrome was closed. Use Reopen Chrome.".into())}
 // Returning focus prevents the next workspace shortcut targeting a hidden view.
 if !visible&&unsafe{GetForegroundWindow()==handle(item.hwnd)}{unsafe{let _=SetForegroundWindow(main);}}
  item.bounds=bounds;item.clip=clip;item.occlusions=occlusions;item.visible=visible;place(&app,&mut items);Ok(())
}
#[tauri::command]
pub async fn chrome_panel_navigate(app:AppHandle,webview:Webview,id:String,url:String)->Result<(),String>{
 crate::browser::authorize(&webview)?;let url=crate::chrome::website(&url)?;
 let state=app.state::<ChromeState>();let items=state.0.lock().map_err(|_|"Chrome state unavailable")?;
 let item=items.get(&id).ok_or("Reopen Chrome first")?;
 if !unsafe{IsWindow(Some(handle(item.hwnd))).as_bool()}{return Err("Reopen Chrome first".into())}
 // Chrome's normal command-line forwarding opens a tab in its active window.
 unsafe{let _=SetForegroundWindow(handle(item.hwnd));}
 use std::os::windows::process::CommandExt;
 let profile=app.path().app_data_dir().map_err(|e|e.to_string())?.join("chrome-profile");
 std::process::Command::new(crate::chrome::executable()?).arg(format!("--user-data-dir={}",profile.display())).arg(url).creation_flags(0x08000000).spawn().map_err(|e|e.to_string())?;Ok(())
}
#[tauri::command]
pub async fn chrome_panel_close(app:AppHandle,webview:Webview,id:String)->Result<(),String>{crate::browser::authorize(&webview)?;close(&app,&id);Ok(())}
fn close(app:&AppHandle,id:&str){if let Ok(mut items)=app.state::<ChromeState>().0.lock(){if let Some(e)=items.remove(id){unsafe{
 SetWindowLongPtrW(handle(e.hwnd),GWLP_HWNDPARENT,0);if let Ok(main)=owner(app){let _=RemovePropW(handle(e.hwnd),PCWSTR(property(id,main).as_ptr()));}
 let _=ShowWindow(handle(e.hwnd),SW_SHOWNOACTIVATE);let _=PostMessageW(Some(handle(e.hwnd)),WM_CLOSE,WPARAM(0),LPARAM(0));
}}if items.is_empty(){CHROME_PID.store(0,std::sync::atomic::Ordering::Relaxed);}}}
pub fn shutdown(app:&AppHandle){let ids=app.state::<ChromeState>().0.lock().map(|s|s.keys().cloned().collect::<Vec<_>>()).unwrap_or_default();for id in ids{close(app,&id)}CHROME_PID.store(0,std::sync::atomic::Ordering::Relaxed);}

// Capture only the registered, visible Chrome region for the widget's existing
// screenshot/export feature. This includes Chrome's GPU-rendered page and tabs.
pub fn capture(app:&AppHandle,id:&str)->Result<Vec<u8>,String>{
 use windows::Win32::Graphics::Gdi::*;
 let state=app.state::<ChromeState>();let items=state.0.lock().map_err(|_|"Chrome state unavailable")?;
 let item=items.get(id).ok_or("Reopen Chrome before capturing")?;
 let main=owner(app)?;
 if !item.shown||!item.visible||!is_group(app,&items,main){return Err("Bring Still and this Chrome panel to the front before capturing".into())}
  let (x,y,w,h)=item.last.as_ref().map(|last|last.0).ok_or("Chrome is not positioned yet")?;
 let mut actual=RECT::default();unsafe{GetWindowRect(handle(item.hwnd),&mut actual).map_err(|e|e.to_string())?;}
 if (actual.left,actual.top,actual.right-actual.left,actual.bottom-actual.top)!=(x,y,w,h){return Err("Exit Chrome fullscreen and bring the browser into its panel before capturing".into())}
 if w<1||h<1||w as i64*h as i64>16000000{return Err("Chrome capture is too large".into())}
 unsafe{
  let desktop=GetDC(None);let memory=CreateCompatibleDC(Some(desktop));let bitmap=CreateCompatibleBitmap(desktop,w,h);
  if desktop.0.is_null()||memory.0.is_null()||bitmap.0.is_null(){if !bitmap.0.is_null(){let _=DeleteObject(HGDIOBJ(bitmap.0));}if !memory.0.is_null(){let _=DeleteDC(memory);}if !desktop.0.is_null(){ReleaseDC(None,desktop);}return Err("Unable to allocate Chrome capture".into())}
  let previous=SelectObject(memory,HGDIOBJ(bitmap.0));
  let copied=BitBlt(memory,0,0,w,h,Some(desktop),x,y,SRCCOPY|CAPTUREBLT);
  SelectObject(memory,previous);
  let mut info=BITMAPINFO::default();info.bmiHeader=BITMAPINFOHEADER{biSize:std::mem::size_of::<BITMAPINFOHEADER>() as u32,biWidth:w,biHeight:-h,biPlanes:1,biBitCount:32,biCompression:BI_RGB.0,..Default::default()};
  let mut bytes=vec![0u8;(w*h*4) as usize];let lines=if copied.is_ok(){GetDIBits(memory,bitmap,0,h as u32,Some(bytes.as_mut_ptr().cast()),&mut info,DIB_RGB_COLORS)}else{0};
  let _=DeleteObject(HGDIOBJ(bitmap.0));let _=DeleteDC(memory);ReleaseDC(None,desktop);
  copied.map_err(|e|e.to_string())?;if lines!=h{return Err("Chrome capture failed".into())}
  for pixel in bytes.chunks_exact_mut(4){pixel.swap(0,2);pixel[3]=255;}
  let image=image::RgbaImage::from_raw(w as u32,h as u32,bytes).ok_or("Invalid Chrome capture")?;
  let mut png=std::io::Cursor::new(Vec::new());image::DynamicImage::ImageRgba8(image).write_to(&mut png,image::ImageFormat::Png).map_err(|e|e.to_string())?;Ok(png.into_inner())
 }
}

#[cfg(test)]mod tests{
 use super::*;
 #[test]fn css_bounds_convert_to_physical_screen_coordinates_including_negative_monitors(){
  let b=Bounds{x:170.,y:210.,width:800.,height:500.};assert_eq!(b.screen(POINT{x:-1920,y:45},1.5),(-1665,360,1200,750));
  let partial=Bounds{x:-30.,y:40.,width:500.,height:300.};assert!(partial.validate().is_ok());assert_eq!(partial.screen(POINT{x:100,y:20},1.5),(55,80,750,450));
  assert!(Bounds{x:f64::NAN,..b.clone()}.validate().is_err());assert!(Bounds{width:0.,..b}.validate().is_err());
 }
 #[test]fn only_valid_instance_ids_can_become_native_properties(){assert!(instance("abc-123").is_ok());assert!(instance("../main").is_err());assert!(instance("").is_err());}
 #[test]fn chrome_region_clips_to_viewport_and_cuts_out_higher_widgets(){unsafe{
  let actual=RECT{left:0,top:0,right:100,bottom:100};
  let (visible,has_visible)=clipped_region(&actual,(0,0,100,100),&[(25,25,50,50)]).unwrap();
  assert!(has_visible);assert!(PtInRegion(visible,10,10).as_bool());assert!(!PtInRegion(visible,40,40).as_bool());let _=DeleteObject(HGDIOBJ(visible.0));
  let (_,fully_occluded)=clipped_region(&actual,(0,0,100,100),&[(0,0,100,100)]).unwrap();assert!(!fully_occluded);
 }}
 #[test]
 #[ignore="Launches real Chrome in an isolated test profile; run explicitly on Windows"]
 fn real_chrome_launch_position_hide_recover_and_reopen(){unsafe{
  use windows::Win32::System::LibraryLoader::GetModuleHandleW;
  use windows::Win32::Foundation::HINSTANCE;
  let title=wide("Still Chrome integration test");let class=wide("STATIC");
  let module=GetModuleHandleW(None).unwrap();
  let main=CreateWindowExW(WINDOW_EX_STYLE(0),PCWSTR(class.as_ptr()),PCWSTR(title.as_ptr()),WS_OVERLAPPEDWINDOW,100,100,1200,800,None,None,Some(HINSTANCE(module.0)),None).unwrap();
  let profile=std::env::temp_dir().join(format!("still-chrome-smoke-{}",std::process::id()));std::fs::create_dir_all(&profile).unwrap();
  let items=HashMap::new();let id=format!("smoke-{}",std::process::id());
  let result=(||->Result<(),String>{
   let (h,process)=open_window(&profile,"https://www.google.com/",&id,main,&items)?;
   let chrome=handle(h);assert_ne!(process,0);assert!(IsWindow(Some(chrome)).as_bool());assert_eq!(GetWindow(chrome,GW_OWNER).unwrap(),main);
   assert_eq!(GetWindowLongPtrW(chrome,GWL_STYLE)&WS_CHILD.0 as isize,0,"Chrome must remain top-level");
   let (again,_)=open_window(&profile,"https://www.google.com/",&id,main,&items)?;assert_eq!(again,h,"Recovery must reuse the same window");
   let b=Bounds{x:170.,y:180.,width:800.,height:500.};let mut origin=POINT::default();assert!(ClientToScreen(main,&mut origin).as_bool());
   let scale=windows::Win32::UI::HiDpi::GetDpiForWindow(main).max(96) as f64/96.;let mut r=b.screen(origin,scale);
   SetWindowPos(chrome,None,r.0,r.1,r.2,r.3,SWP_NOACTIVATE|SWP_NOZORDER).map_err(|e|e.to_string())?;
   let mut actual=RECT::default();GetWindowRect(chrome,&mut actual).map_err(|e|e.to_string())?;assert_eq!((actual.left,actual.top,actual.right-actual.left,actual.bottom-actual.top),r);
   SetWindowPos(main,None,230,160,1300,900,SWP_NOACTIVATE|SWP_NOZORDER).map_err(|e|e.to_string())?;assert!(ClientToScreen(main,&mut origin).as_bool());r=b.screen(origin,scale);
   SetWindowPos(chrome,None,r.0,r.1,r.2,r.3,SWP_NOACTIVATE|SWP_NOZORDER).map_err(|e|e.to_string())?;GetWindowRect(chrome,&mut actual).map_err(|e|e.to_string())?;assert_eq!((actual.left,actual.top), (r.0,r.1));
   let _=ShowWindow(chrome,SW_HIDE);assert!(!IsWindowVisible(chrome).as_bool());
   let _=ShowWindow(main,SW_SHOWNOACTIVATE);let _=ShowWindow(chrome,SW_SHOWNOACTIVATE);assert!(IsWindowVisible(chrome).as_bool());
   let _=ShowWindow(main,SW_MINIMIZE);assert!(IsIconic(main).as_bool());let _=ShowWindow(chrome,SW_HIDE);let _=ShowWindow(main,SW_RESTORE);let _=ShowWindow(chrome,SW_SHOWNOACTIVATE);assert!(IsWindowVisible(chrome).as_bool());
   let other=CreateWindowExW(WINDOW_EX_STYLE(0),PCWSTR(class.as_ptr()),PCWSTR(title.as_ptr()),WS_OVERLAPPEDWINDOW,150,150,1200,800,None,None,Some(HINSTANCE(module.0)),None).unwrap();
   let (separate,_)=open_window(&profile,"https://www.google.com/",&id,other,&items)?;
   if separate==h {close_and_wait(chrome)?;let _=DestroyWindow(other);return Err("Another Still window stole this browser instance".into())}
   assert_eq!(GetWindow(chrome,GW_OWNER).unwrap(),main);assert_eq!(GetWindow(handle(separate),GW_OWNER).unwrap(),other);
   let _=ShowWindow(other,SW_SHOWNOACTIVATE);let _=ShowWindow(handle(separate),SW_SHOWNOACTIVATE);
   close_and_wait(handle(separate))?;let _=DestroyWindow(other);
   fn close_and_wait(window:HWND)->Result<(),String>{unsafe{SetWindowLongPtrW(window,GWLP_HWNDPARENT,0);let _=ShowWindow(window,SW_SHOWNOACTIVATE);PostMessageW(Some(window),WM_CLOSE,WPARAM(0),LPARAM(0)).map_err(|e|e.to_string())?;let start=std::time::Instant::now();while IsWindow(Some(window)).as_bool(){if start.elapsed().as_secs()>8{return Err("Chrome did not close cleanly".into())}let mut message=MSG::default();while PeekMessageW(&mut message,None,0,0,PM_REMOVE).as_bool(){let _=TranslateMessage(&message);DispatchMessageW(&message);}std::thread::sleep(std::time::Duration::from_millis(100));}Ok(())}}
   close_and_wait(chrome)?;
   let (reopened,_)=open_window(&profile,"https://www.google.com/",&id,main,&items)?;assert!(IsWindow(Some(handle(reopened))).as_bool());close_and_wait(handle(reopened))?;
   eprintln!("Chrome smoke passed: launch, HWND/PID, top-level ownership, duplicate recovery, DPI bounds, move/resize, hide/show, minimize/restore, separate owners, close/reopen. Profile: {}",profile.display());Ok(())
  })();let _=DestroyWindow(main);result.unwrap();
 }}
}
