use serde::{Deserialize,Serialize};
use std::{collections::{HashMap,HashSet},path::{Path,PathBuf},sync::{Mutex,OnceLock}};
use tauri::{AppHandle,Emitter,Manager,Webview};
use windows::{core::{Interface,PCWSTR,PWSTR},Win32::{Foundation::{CloseHandle,HANDLE,HWND,LPARAM,POINT,RECT},Graphics::Gdi::*,System::{Com::*,Threading::*},UI::{Shell::*,WindowsAndMessaging::*,Accessibility::{SetWinEventHook,HWINEVENTHOOK}}}};

#[derive(Clone,Debug,Deserialize)]
pub struct Bounds {pub x:f64,pub y:f64,pub width:f64,pub height:f64}
impl Bounds {
 fn validate(&self)->Result<(),String>{if [self.x,self.y,self.width,self.height].iter().any(|v|!v.is_finite())||self.x.abs()>20000.||self.y.abs()>20000.||self.width<1.||self.height<1.||self.width>20000.||self.height>20000.{Err("Invalid app panel bounds".into())}else{Ok(())}}
 fn screen(&self,origin:POINT,scale:f64)->(i32,i32,i32,i32){((origin.x as f64+self.x*scale).round() as i32,(origin.y as f64+self.y*scale).round() as i32,(self.width*scale).round().max(1.) as i32,(self.height*scale).round().max(1.) as i32)}
}
#[derive(Clone,Serialize)]
pub struct WindowInfo {pub hwnd:usize,pub pid:u32,pub title:String,#[serde(skip)]pub(crate) executable:Option<String>}
#[derive(Clone)]
struct Launch {pid:u32,executable:Option<String>,before:Vec<usize>}
fn same_path(a:&str,b:&str)->bool{a.trim_start_matches("\\\\?\\").eq_ignore_ascii_case(b.trim_start_matches("\\\\?\\"))}
fn select_window<'a>(launch:&Launch,windows:&'a [WindowInfo],claimed:&[usize])->Option<&'a WindowInfo>{
 windows.iter().find(|w|!launch.before.contains(&w.hwnd)&&!claimed.contains(&w.hwnd)&&((launch.pid!=0&&w.pid==launch.pid)||launch.executable.as_ref().zip(w.executable.as_ref()).is_some_and(|(a,b)|same_path(a,b))))
}
fn launch_arguments(executable:&Path,args:&str)->String{
 if executable.file_name().is_some_and(|n|n.to_string_lossy().eq_ignore_ascii_case("winword.exe")){format!("{} /n",args.trim()).trim().to_owned()}else{args.to_owned()}
}
fn handle(value:usize)->HWND{HWND(value as *mut std::ffi::c_void)}
fn wide(value:&str)->Vec<u16>{value.encode_utf16().chain(Some(0)).collect()}
fn os_wide(value:&std::ffi::OsStr)->Vec<u16>{use std::os::windows::ffi::OsStrExt;value.encode_wide().chain(Some(0)).collect()}
fn from_wide(value:&[u16])->String{String::from_utf16_lossy(&value[..value.iter().position(|c|*c==0).unwrap_or(value.len())])}
fn pid(hwnd:HWND)->u32{let mut value=0;unsafe{GetWindowThreadProcessId(hwnd,Some(&mut value));}value}
fn rect(hwnd:HWND)->Result<(i32,i32,i32,i32),String>{let mut r=RECT::default();unsafe{GetWindowRect(hwnd,&mut r).map_err(|e|e.to_string())?;}Ok((r.left,r.top,r.right-r.left,r.bottom-r.top))}
fn instance(id:&str)->Result<(),String>{crate::files::valid_id(id)}
static APP:OnceLock<AppHandle>=OnceLock::new();
static OWNER:std::sync::atomic::AtomicUsize=std::sync::atomic::AtomicUsize::new(0);
fn owner()->Result<HWND,String>{let h=OWNER.load(std::sync::atomic::Ordering::Relaxed);if h==0{Err("Still window is missing".into())}else{Ok(handle(h))}}
fn marker()->Vec<u16>{wide("StillManagedAppPanel")}
type Physical=(i32,i32,i32,i32);
struct Entry {
 hwnd:usize,pid:u32,source_id:String,bounds:Bounds,clip:Bounds,grip:Option<Bounds>,visible:bool,shown:bool,
 original_owner:usize,original_placement:WINDOWPLACEMENT,original_region:usize,original_visible:bool,
 last:Option<(Physical,Physical,Physical,Option<Physical>)>,error:String,
}
impl Drop for Entry{fn drop(&mut self){if self.original_region!=0{unsafe{let _=DeleteObject(HGDIOBJ(self.original_region as *mut _));}}}}
#[derive(Default)]struct Panels {items:HashMap<String,Entry>,pending:HashMap<String,Launch>,running:HashSet<String>,generation:HashMap<String,u64>,closed:bool}
#[derive(Default)]pub struct AppPanelState(Mutex<Panels>);
#[derive(Serialize)]#[serde(rename_all="camelCase")]pub struct Info{hwnd:usize,pid:u32,min_width:f64,min_height:f64}
fn info(entry:&Entry,main:HWND)->Info{
 let scale=unsafe{windows::Win32::UI::HiDpi::GetDpiForWindow(main)}.max(96) as f64/96.;
 let size=rect(handle(entry.hwnd)).unwrap_or((0,0,640,400));
 Info{hwnd:entry.hwnd,pid:entry.pid,min_width:size.2 as f64/scale,min_height:size.3 as f64/scale}
}
pub(crate) fn executable(process:u32)->Option<String>{unsafe{
 let handle=OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION,false,process).ok()?;
 let mut path=vec![0u16;32768];let mut length=path.len() as u32;
 let read=QueryFullProcessImageNameW(handle,PROCESS_NAME_WIN32,PWSTR(path.as_mut_ptr()),&mut length);
 let _=CloseHandle(handle);read.ok()?;Some(String::from_utf16_lossy(&path[..length as usize]))
}}
unsafe extern "system" fn enumerate(hwnd:HWND,param:LPARAM)->windows::core::BOOL{
 if !IsWindowVisible(hwnd).as_bool()||GetWindow(hwnd,GW_OWNER).ok().is_some_and(|h|!h.0.is_null())||GetWindowLongPtrW(hwnd,GWL_EXSTYLE)&WS_EX_TOOLWINDOW.0 as isize!=0||!GetPropW(hwnd,PCWSTR(marker().as_ptr())).0.is_null(){return windows::core::BOOL(1)}
 let process=pid(hwnd);if process==0||process==std::process::id(){return windows::core::BOOL(1)}
 let mut class=[0u16;256];let n=GetClassNameW(hwnd,&mut class);let class=String::from_utf16_lossy(&class[..n.max(0) as usize]);
 if ["Progman","WorkerW","Shell_TrayWnd","#32768"].contains(&class.as_str())||class.to_ascii_lowercase().contains("splash"){return windows::core::BOOL(1)}
 let length=GetWindowTextLengthW(hwnd).max(0) as usize;if length==0{return windows::core::BOOL(1)}
 let mut title=vec![0u16;length.min(4096)+1];GetWindowTextW(hwnd,&mut title);
 (*(param.0 as *mut Vec<WindowInfo>)).push(WindowInfo{hwnd:hwnd.0 as usize,pid:process,title:from_wide(&title),executable:executable(process)});
 windows::core::BOOL(1)
}
pub(crate) fn windows()->Vec<WindowInfo>{let mut items=Vec::new();unsafe{let _=EnumWindows(Some(enumerate),LPARAM(&mut items as *mut _ as isize));}items}
pub(crate) fn managed_windows(app:&AppHandle)->Vec<(usize,u32)>{app.state::<AppPanelState>().0.lock().map(|s|s.items.values().filter(|e|valid_window(e)).map(|e|(e.hwnd,e.pid)).collect()).unwrap_or_default()}
pub(crate) fn expected_executable(path:&Path)->Option<String>{let _com=Com::initialize();if path.extension().is_some_and(|e|e.eq_ignore_ascii_case("lnk")){shortcut_target(path).map(|v|v.0.to_string_lossy().into_owned())}else{Some(path.to_string_lossy().into_owned())}}
pub(crate) fn matches_executable(window:&WindowInfo,expected:&str)->bool{window.executable.as_ref().is_some_and(|exe|same_path(exe,expected))}
fn reuse_candidate<'a>(windows:&'a [WindowInfo],expected:Option<&str>)->Result<Option<&'a WindowInfo>,String>{
 let Some(expected)=expected else{return Ok(None)};
 let mut matches=windows.iter().filter(|window|matches_executable(window,expected));let chosen=matches.next();
 if matches.next().is_some(){return Err("Several windows of this app are open. Use Attach open app to choose the document you want.".into())}
 Ok(chosen)
}
fn window_snapshot()->Vec<usize>{
 unsafe extern "system" fn collect(hwnd:HWND,param:LPARAM)->windows::core::BOOL{(*(param.0 as *mut Vec<usize>)).push(hwnd.0 as usize);windows::core::BOOL(1)}
 let mut items=Vec::new();unsafe{let _=EnumWindows(Some(collect),LPARAM(&mut items as *mut _ as isize));}items
}

struct Com(bool);
impl Com{fn initialize()->Self{Self(unsafe{CoInitializeEx(None,COINIT_APARTMENTTHREADED).is_ok()})}}
impl Drop for Com{fn drop(&mut self){if self.0{unsafe{CoUninitialize();}}}}
fn shortcut_target(path:&Path)->Option<(PathBuf,String,Option<PathBuf>)>{unsafe{
 let link:IShellLinkW=CoCreateInstance(&ShellLink,None,CLSCTX_INPROC_SERVER).ok()?;
 let file:IPersistFile=link.cast().ok()?;let selected=os_wide(path.as_os_str());file.Load(PCWSTR(selected.as_ptr()),STGM_READ).ok()?;
 let mut target=vec![0u16;32768];let mut data=windows::Win32::Storage::FileSystem::WIN32_FIND_DATAW::default();
 link.GetPath(&mut target,&mut data,SLGP_RAWPATH.0 as u32).ok()?;
 use std::os::windows::ffi::OsStringExt;
 let end=target.iter().position(|c|*c==0)?;if end==0{return None}
 let target=PathBuf::from(std::ffi::OsString::from_wide(&target[..end])).canonicalize().ok()?;
 if !target.extension().is_some_and(|v|v.eq_ignore_ascii_case("exe")){return None}
 let mut args=vec![0u16;32768];link.GetArguments(&mut args).ok()?;
 let mut directory=vec![0u16;32768];let _=link.GetWorkingDirectory(&mut directory);
 let end=directory.iter().position(|c|*c==0).unwrap_or(0);
 let directory=(end>0).then(||PathBuf::from(std::ffi::OsString::from_wide(&directory[..end])));
 Some((target,from_wide(&args),directory))
}}
fn launch(path:&Path,before:Vec<usize>)->Result<Launch,String>{
 let _com=Com::initialize();
 let resolved=if path.extension().is_some_and(|e|e.eq_ignore_ascii_case("lnk")){shortcut_target(path)}else{Some((path.to_path_buf(),String::new(),None))};
 let (target,args,directory)=resolved.unwrap_or_else(||(path.to_path_buf(),String::new(),None));
 let args=launch_arguments(&target,&args);let file=os_wide(target.as_os_str());let parameters=wide(&args);let verb=wide("open");
 let directory=directory.map(|p|os_wide(p.as_os_str()));
 let mut execute=SHELLEXECUTEINFOW{cbSize:std::mem::size_of::<SHELLEXECUTEINFOW>() as u32,fMask:SEE_MASK_NOCLOSEPROCESS|SEE_MASK_NOASYNC|SEE_MASK_FLAG_NO_UI,
  lpVerb:PCWSTR(verb.as_ptr()),lpFile:PCWSTR(file.as_ptr()),lpParameters:if args.is_empty(){PCWSTR::null()}else{PCWSTR(parameters.as_ptr())},
  lpDirectory:directory.as_ref().map_or(PCWSTR::null(),|p|PCWSTR(p.as_ptr())),nShow:SW_SHOWNOACTIVATE.0,..Default::default()};
 unsafe{ShellExecuteExW(&mut execute).map_err(|e|format!("Unable to open the app: {e}"))?;}
 let process=if execute.hProcess.0.is_null(){0}else{let p=unsafe{GetProcessId(execute.hProcess)};unsafe{let _=CloseHandle(execute.hProcess);}p};
 let expected=target.extension().is_some_and(|e|e.eq_ignore_ascii_case("exe")).then(||target.to_string_lossy().into_owned());
 Ok(Launch{pid:process,executable:expected,before})
}
fn valid_window(entry:&Entry)->bool{(unsafe{IsWindow(Some(handle(entry.hwnd))).as_bool()})&&pid(handle(entry.hwnd))==entry.pid}
fn belongs(mut window:HWND,hwnd:usize,process:u32)->bool{for _ in 0..12{if window.0 as usize==hwnd&&pid(window)==process{return true}window=unsafe{GetWindow(window,GW_OWNER)}.unwrap_or_default();if window.0.is_null(){break}}false}
fn foreground_in(items:&HashMap<String,Entry>,front:HWND)->bool{
 items.values().any(|e|belongs(front,e.hwnd,e.pid))
}
pub fn is_managed_foreground(app:&AppHandle,hwnd:HWND)->bool{app.state::<AppPanelState>().0.try_lock().map(|s|foreground_in(&s.items,hwnd)).unwrap_or(false)}
fn parent_context(items:&HashMap<String,Entry>,main:HWND,app:&AppHandle)->bool{let front=unsafe{GetForegroundWindow()};front.0.is_null()||pid(front)==std::process::id()||foreground_in(items,front)||crate::chrome_overlay::is_managed_foreground(app,front)||front==main}

fn attach(window:&WindowInfo,source_id:String,bounds:Bounds,clip:Bounds,grip:Option<Bounds>,main:HWND)->Result<Entry,String>{unsafe{
 let hwnd=handle(window.hwnd);
 if !IsWindow(Some(hwnd)).as_bool()||pid(hwnd)!=window.pid||window.pid==std::process::id()||!GetPropW(hwnd,PCWSTR(marker().as_ptr())).0.is_null(){return Err("This window is no longer available for attachment.".into())}
 let original_owner=GetWindowLongPtrW(hwnd,GWLP_HWNDPARENT) as usize;
 let mut original_placement=WINDOWPLACEMENT{length:std::mem::size_of::<WINDOWPLACEMENT>() as u32,..Default::default()};
 GetWindowPlacement(hwnd,&mut original_placement).map_err(|e|e.to_string())?;
 let region=CreateRectRgn(0,0,0,0);let original_region=if GetWindowRgn(hwnd,region)!=RGN_ERROR{region.0 as usize}else{let _=DeleteObject(HGDIOBJ(region.0));0};
 let mut entry=Entry{hwnd:window.hwnd,pid:window.pid,source_id,bounds,clip,grip,visible:false,shown:false,original_owner,original_placement,original_region,original_visible:IsWindowVisible(hwnd).as_bool(),last:None,error:String::new()};
 // Top-level ownership, never SetParent/WS_CHILD. Restore it before Still closes.
 SetWindowLongPtrW(hwnd,GWLP_HWNDPARENT,main.0 as isize);
 if GetWindow(hwnd,GW_OWNER).ok()!=Some(main){SetWindowLongPtrW(hwnd,GWLP_HWNDPARENT,original_owner as isize);return Err("The app could not be attached. Still and the app must run at the same Windows permission level.".into())}
 if let Err(error)=SetPropW(hwnd,PCWSTR(marker().as_ptr()),Some(HANDLE(main.0))){restore(&mut entry);return Err(error.to_string())}
 let _=ShowWindow(hwnd,SW_HIDE);
 Ok(entry)
}}
fn restore(entry:&mut Entry){unsafe{
 let hwnd=handle(entry.hwnd);if !valid_window(entry){return}
 SetWindowLongPtrW(hwnd,GWLP_HWNDPARENT,entry.original_owner as isize);let _=RemovePropW(hwnd,PCWSTR(marker().as_ptr()));
 let saved=(entry.original_region!=0).then(||HRGN(entry.original_region as *mut _));
 if SetWindowRgn(hwnd,saved,true)!=0{entry.original_region=0;}
 let mut placement=entry.original_placement;if !entry.original_visible{placement.showCmd=SW_HIDE.0 as u32;}
 let _=SetWindowPlacement(hwnd,&placement);let _=ShowWindow(hwnd,if entry.original_visible{SW_SHOWNA}else{SW_HIDE});
}}
fn position(entry:&mut Entry,main:HWND,origin:POINT,scale:f64)->Result<(),String>{unsafe{
 let hwnd=handle(entry.hwnd);let wanted=entry.bounds.screen(origin,scale);let clip=entry.clip.screen(origin,scale);let grip=entry.grip.as_ref().map(|bounds|bounds.screen(origin,scale));
 let actual=rect(hwnd)?;
 if entry.shown&&entry.last==Some((wanted,clip,actual,grip)){return Ok(())}
 if IsZoomed(hwnd).as_bool()||IsIconic(hwnd).as_bool(){let _=ShowWindow(hwnd,SW_SHOWNOACTIVATE);}
 SetWindowPos(hwnd,Some(HWND_TOP),wanted.0,wanted.1,wanted.2,wanted.3,SWP_NOACTIVATE|SWP_NOOWNERZORDER).map_err(|e|e.to_string())?;
 let actual=rect(hwnd)?;
 // Apps can enforce their own minimum size. A region keeps excess native UI
 // from covering Still controls, while the frontend grows the card on opening.
 let left=(clip.0-actual.0).max(0);let top=(clip.1-actual.1).max(0);
 let right=(clip.0+clip.2-actual.0).min(actual.2).max(left);let bottom=(clip.1+clip.3-actual.1).min(actual.3).max(top);
 let region=CreateRectRgn(left,top,right,bottom);
 if region.0.is_null(){return Err("Unable to clip the app to its panel.".into())}
 // Native app HWNDs sit above Still's WebView. Cut the resize grip out of
 // the native region so the underlying Still control stays visible/clickable.
 if let Some((x,y,width,height))=grip{
  let grip_left=(x-actual.0).max(left);let grip_top=(y-actual.1).max(top);
  let grip_right=(x+width-actual.0).min(right);let grip_bottom=(y+height-actual.1).min(bottom);
  if grip_left<grip_right&&grip_top<grip_bottom{
   let cutout=CreateRectRgn(grip_left,grip_top,grip_right,grip_bottom);
   if cutout.0.is_null(){let _=DeleteObject(HGDIOBJ(region.0));return Err("Unable to reserve Still's resize grip.".into())}
   if CombineRgn(Some(region),Some(region),Some(cutout),RGN_DIFF)==RGN_ERROR{let _=DeleteObject(HGDIOBJ(cutout.0));let _=DeleteObject(HGDIOBJ(region.0));return Err("Unable to reserve Still's resize grip.".into())}
   let _=DeleteObject(HGDIOBJ(cutout.0));
  }
 }
 if SetWindowRgn(hwnd,Some(region),true)==0{let _=DeleteObject(HGDIOBJ(region.0));return Err("The app cannot fit this panel at its current Windows permission level.".into())}
 entry.last=Some((wanted,clip,actual,grip));let _=main;Ok(())
}}
fn remove_closed(app:&AppHandle,panels:&mut Panels,window:Option<usize>){
 let gone=panels.items.iter().filter(|(_,e)|window.is_none_or(|h|h==e.hwnd)&&!valid_window(e)).map(|(id,_)|id.clone()).collect::<Vec<_>>();
 for id in gone{panels.items.remove(&id);let _=app.emit_to("main","app-panel-state",serde_json::json!({"id":id,"open":false}));}
}
fn place(app:&AppHandle,panels:&mut Panels){
 remove_closed(app,panels,None);
 let Ok(main)=owner()else{return};let mut origin=POINT::default();if !unsafe{ClientToScreen(main,&mut origin).as_bool()}{return}
 let scale=unsafe{windows::Win32::UI::HiDpi::GetDpiForWindow(main)}.max(96) as f64/96.;
 let parent=unsafe{IsWindowVisible(main).as_bool()&&!IsIconic(main).as_bool()}&&parent_context(&panels.items,main,app);
 for (id,entry) in panels.items.iter_mut(){if !valid_window(entry){continue}
  let hwnd=handle(entry.hwnd);if !entry.visible||!parent{if entry.shown{unsafe{let _=ShowWindow(hwnd,SW_HIDE);}entry.shown=false;}continue}
  match position(entry,main,origin,scale){Ok(())=>{if !entry.shown{unsafe{let _=ShowWindow(hwnd,SW_SHOWNOACTIVATE);}entry.shown=true;}if !entry.error.is_empty(){entry.error.clear();let _=app.emit_to("main","app-panel-state",serde_json::json!({"id":id,"open":true,"error":null}));}},Err(error)=>{if entry.error!=error{entry.error=error.clone();let _=app.emit_to("main","app-panel-state",serde_json::json!({"id":id,"open":true,"error":error}));}}}
 }
}
pub fn refresh(app:&AppHandle){if let Ok(mut panels)=app.state::<AppPanelState>().0.try_lock(){place(app,&mut panels)}}
unsafe extern "system" fn event(_:HWINEVENTHOOK,event:u32,hwnd:HWND,object:i32,child:i32,_:u32,_:u32){
 let Some(app)=APP.get()else{return};
 if event==EVENT_OBJECT_DESTROY&&object==0&&child==0{
  let dead=hwnd.0 as usize;
  if let Ok(mut s)=app.state::<AppPanelState>().0.try_lock(){remove_closed(app,&mut s,Some(dead))}
  else{let app=app.clone();tauri::async_runtime::spawn_blocking(move||{let state=app.state::<AppPanelState>();if let Ok(mut s)=state.0.lock(){remove_closed(&app,&mut s,Some(dead));};});}
 }
 if event==EVENT_SYSTEM_FOREGROUND{crate::shortcuts::refresh_editing(app.clone());refresh(app);}
 if event==EVENT_OBJECT_LOCATIONCHANGE&&object==0&&(owner().ok()==Some(hwnd)||is_managed_foreground(app,hwnd)){refresh(app)}
}
pub fn install(app:&AppHandle)->Result<(),String>{
 let _=APP.set(app.clone());let main=app.get_window("main").ok_or("Still window is missing")?.hwnd().map_err(|e|e.to_string())?;
 OWNER.store(main.0 as usize,std::sync::atomic::Ordering::Relaxed);
 unsafe{for (a,b) in [(EVENT_SYSTEM_FOREGROUND,EVENT_SYSTEM_FOREGROUND),(EVENT_OBJECT_DESTROY,EVENT_OBJECT_LOCATIONCHANGE)]{if SetWinEventHook(a,b,None,Some(event),0,0,WINEVENT_OUTOFCONTEXT).0.is_null(){return Err("Unable to synchronize application panels".into())}}}Ok(())
}
fn release(app:&AppHandle,id:&str){if let Ok(mut s)=app.state::<AppPanelState>().0.lock(){*s.generation.entry(id.into()).or_default()+=1;s.pending.remove(id);if let Some(mut entry)=s.items.remove(id){restore(&mut entry);}}}
pub fn shutdown(app:&AppHandle){let state=app.state::<AppPanelState>();if let Ok(mut s)=state.0.lock(){s.closed=true;s.pending.clear();for (_,mut entry) in s.items.drain(){restore(&mut entry);}};}

#[tauri::command]
pub async fn app_panel_open(app:AppHandle,webview:Webview,id:String,source_id:String,bounds:Bounds,clip:Bounds,grip:Option<Bounds>,reuse_existing:Option<bool>)->Result<Info,String>{
 crate::browser::authorize(&webview)?;instance(&id)?;bounds.validate()?;clip.validate()?;if let Some(grip)=&grip{grip.validate()?}
 let path=app.state::<crate::dropped_files::AppGrants>().target(&source_id)?;
 tauri::async_runtime::spawn_blocking(move||{
  let main=owner()?;let state=app.state::<AppPanelState>();
  let (epoch,pending)={let mut s=state.0.lock().map_err(|_|"App panels are unavailable")?;
   if s.closed{return Err("Still is closing".into())}
   if let Some(entry)=s.items.get(&id){if entry.source_id==source_id&&valid_window(entry){return Ok(info(entry,main))}}
   if !s.running.insert(id.clone()){return Err("This app is already opening.".into())}
   (*s.generation.entry(id.clone()).or_default(),s.pending.get(&id).cloned())
  };
  let result=(||{
   let launch=match pending{Some(p)=>p,None=>{
    let before=window_snapshot();let expected=expected_executable(&path);
    let available=if reuse_existing==Some(true){windows()}else{Vec::new()};
    let ticket=if let Some(window)=reuse_candidate(&available,expected.as_deref())?{Launch{pid:window.pid,executable:expected,before:before.into_iter().filter(|h|*h!=window.hwnd).collect()}}else{launch(&path,before)?};
    state.0.lock().map_err(|_|"App panels are unavailable")?.pending.insert(id.clone(),ticket.clone());ticket
   }};
   let started=std::time::Instant::now();
   loop{
    let claimed={let s=state.0.lock().map_err(|_|"App panels are unavailable")?;if s.closed||s.generation.get(&id)!=Some(&epoch){return Err("App attachment was cancelled.".into())}s.items.values().map(|e|e.hwnd).collect::<Vec<_>>()};
    let choices=windows();if let Some(candidate)=select_window(&launch,&choices,&claimed){
      let mut entry=attach(candidate,source_id.clone(),bounds.clone(),clip.clone(),grip.clone(),main)?;
     let mut origin=POINT::default();if !unsafe{ClientToScreen(main,&mut origin).as_bool()}{restore(&mut entry);return Err("Still window is unavailable".into())}
     let scale=unsafe{windows::Win32::UI::HiDpi::GetDpiForWindow(main)}.max(96) as f64/96.;
     if let Err(error)=position(&mut entry,main,origin,scale){restore(&mut entry);return Err(error)}
     let information=info(&entry,main);let mut s=state.0.lock().map_err(|_|"App panels are unavailable")?;
     if s.closed||s.generation.get(&id)!=Some(&epoch){restore(&mut entry);return Err("App attachment was cancelled.".into())}
     if let Some(mut old)=s.items.insert(id.clone(),entry){restore(&mut old)}s.pending.remove(&id);
     let _=app.emit_to("main","app-panel-state",serde_json::json!({"id":id,"open":true}));return Ok(information)
    }
    if started.elapsed()>std::time::Duration::from_secs(12){return Err("The app opened, but its new window could not be identified. Use Attach open app to choose it without launching another copy.".into())}
    std::thread::sleep(std::time::Duration::from_millis(100));
   }
  })();if let Ok(mut s)=state.0.lock(){s.running.remove(&id);}result
 }).await.map_err(|e|e.to_string())?
}
#[tauri::command]
pub async fn app_panel_windows(app:AppHandle,webview:Webview)->Result<Vec<WindowInfo>,String>{crate::browser::authorize(&webview)?;let _=app;tauri::async_runtime::spawn_blocking(windows).await.map_err(|e|e.to_string())}
#[tauri::command]
pub async fn app_panel_attach(app:AppHandle,webview:Webview,id:String,hwnd:usize,pid:u32,bounds:Bounds,clip:Bounds,grip:Option<Bounds>)->Result<Info,String>{
 crate::browser::authorize(&webview)?;instance(&id)?;bounds.validate()?;clip.validate()?;if let Some(grip)=&grip{grip.validate()?}
 tauri::async_runtime::spawn_blocking(move||{
  let main=owner()?;let choices=windows();let candidate=choices.iter().find(|w|w.hwnd==hwnd&&w.pid==pid).ok_or("This window is no longer available. Refresh the app list.")?;
  let mut entry=attach(candidate,String::new(),bounds,clip,grip,main)?;let mut origin=POINT::default();if !unsafe{ClientToScreen(main,&mut origin).as_bool()}{restore(&mut entry);return Err("Still window is unavailable".into())}
  let scale=unsafe{windows::Win32::UI::HiDpi::GetDpiForWindow(main)}.max(96) as f64/96.;if let Err(e)=position(&mut entry,main,origin,scale){restore(&mut entry);return Err(e)}
  let information=info(&entry,main);let state=app.state::<AppPanelState>();let mut s=state.0.lock().map_err(|_|"App panels unavailable")?;
  if s.closed{restore(&mut entry);return Err("Still is closing".into())}*s.generation.entry(id.clone()).or_default()+=1;s.pending.remove(&id);
  if let Some(mut old)=s.items.insert(id.clone(),entry){restore(&mut old)}
  // An explicit picker selection returns focus to Still after releasing any old panel.
  // This also lets the next presentation show the selected app in Still's foreground context.
  drop(s);unsafe{let _=SetForegroundWindow(main);}
  let _=app.emit_to("main","app-panel-state",serde_json::json!({"id":id,"open":true}));Ok(information)
 }).await.map_err(|e|e.to_string())?
}
#[tauri::command]
pub async fn app_panel_present(app:AppHandle,webview:Webview,id:String,bounds:Bounds,clip:Bounds,grip:Option<Bounds>,visible:bool)->Result<(),String>{
 crate::browser::authorize(&webview)?;instance(&id)?;bounds.validate()?;clip.validate()?;if let Some(grip)=&grip{grip.validate()?}
 let state=app.state::<AppPanelState>();let mut s=state.0.lock().map_err(|_|"App panels unavailable")?;
 let entry=s.items.get_mut(&id).ok_or("The app was closed. Reopen it below.")?;
 if !valid_window(entry){s.items.remove(&id);return Err("The app was closed. Reopen it below.".into())}
 if !visible&&belongs(unsafe{GetForegroundWindow()},entry.hwnd,entry.pid){if let Ok(main)=owner(){unsafe{let _=SetForegroundWindow(main);}}}
 entry.bounds=bounds;entry.clip=clip;entry.grip=grip;entry.visible=visible;place(&app,&mut s);Ok(())
}
#[tauri::command]
pub async fn app_panel_release(app:AppHandle,webview:Webview,id:String)->Result<(),String>{crate::browser::authorize(&webview)?;instance(&id)?;release(&app,&id);Ok(())}

pub fn capture(app:&AppHandle,id:&str)->Result<Vec<u8>,String>{
 let state=app.state::<AppPanelState>();let panels=state.0.lock().map_err(|_|"App panels unavailable")?;
 let entry=panels.items.get(id).ok_or("Reopen the app before capturing")?;let main=owner()?;
 if !entry.shown||!entry.visible||!valid_window(entry)||!parent_context(&panels.items,main,app){return Err("Bring Still and this app panel to the front before capturing".into())}
 let (_, (x,y,w,h), _, _)=entry.last.ok_or("The app is not positioned yet")?;
 if w<1||h<1||w as i64*h as i64>16000000{return Err("App capture is too large".into())}
 unsafe{
  SetWindowPos(handle(entry.hwnd),Some(HWND_TOP),0,0,0,0,SWP_NOMOVE|SWP_NOSIZE|SWP_NOACTIVATE|SWP_NOOWNERZORDER).map_err(|e|e.to_string())?;
  let desktop=GetDC(None);let memory=CreateCompatibleDC(Some(desktop));let bitmap=CreateCompatibleBitmap(desktop,w,h);
  if desktop.0.is_null()||memory.0.is_null()||bitmap.0.is_null(){if !bitmap.0.is_null(){let _=DeleteObject(HGDIOBJ(bitmap.0));}if !memory.0.is_null(){let _=DeleteDC(memory);}if !desktop.0.is_null(){ReleaseDC(None,desktop);}return Err("Unable to allocate app capture".into())}
  let previous=SelectObject(memory,HGDIOBJ(bitmap.0));let copied=BitBlt(memory,0,0,w,h,Some(desktop),x,y,SRCCOPY|CAPTUREBLT);SelectObject(memory,previous);
  let mut info=BITMAPINFO::default();info.bmiHeader=BITMAPINFOHEADER{biSize:std::mem::size_of::<BITMAPINFOHEADER>() as u32,biWidth:w,biHeight:-h,biPlanes:1,biBitCount:32,biCompression:BI_RGB.0,..Default::default()};
  let mut bytes=vec![0u8;(w*h*4) as usize];let lines=if copied.is_ok(){GetDIBits(memory,bitmap,0,h as u32,Some(bytes.as_mut_ptr().cast()),&mut info,DIB_RGB_COLORS)}else{0};
  let _=DeleteObject(HGDIOBJ(bitmap.0));let _=DeleteDC(memory);ReleaseDC(None,desktop);
  copied.map_err(|e|e.to_string())?;if lines!=h{return Err("App capture failed".into())}
  for pixel in bytes.chunks_exact_mut(4){pixel.swap(0,2);pixel[3]=255;}
  let image=image::RgbaImage::from_raw(w as u32,h as u32,bytes).ok_or("Invalid app capture")?;
  let mut png=std::io::Cursor::new(Vec::new());image::DynamicImage::ImageRgba8(image).write_to(&mut png,image::ImageFormat::Png).map_err(|e|e.to_string())?;Ok(png.into_inner())
 }
}

#[cfg(test)]mod tests{
 use super::*;
 #[test]fn app_geometry_accepts_scrolled_panel_coordinates_and_applies_dpi_without_losing_monitor_origin(){
  let b=Bounds{x:-20.,y:210.,width:800.,height:500.};assert!(b.validate().is_ok());
  assert_eq!(b.screen(POINT{x:-1920,y:45},1.5),(-1950,360,1200,750));
  assert!(Bounds{width:f64::NAN,..b.clone()}.validate().is_err());
  assert!(Bounds{width:0.,..b}.validate().is_err());
 }
 #[test]fn discovery_never_claims_an_old_document_unrelated_app_or_already_managed_window(){
  let launch=Launch{pid:22,executable:Some("C:\\Office\\WINWORD.EXE".into()),before:vec![101]};
  let window=|hwnd,pid,path:&str|WindowInfo{hwnd,pid,title:"Document".into(),executable:Some(path.into())};
  let choices=vec![window(101,22,"C:\\Office\\WINWORD.EXE"),window(102,90,"C:\\Apps\\other.exe"),window(103,22,"C:\\Office\\WINWORD.EXE"),window(104,33,"c:\\office\\winword.exe")];
  assert_eq!(select_window(&launch,&choices,&[103]).map(|w|w.hwnd),Some(104));
  assert!(select_window(&launch,&choices,&[103,104]).is_none());
 }
 #[test]fn word_uses_a_new_instance_switch_and_preserves_shortcut_arguments_without_shell_composition(){
  assert_eq!(launch_arguments(std::path::Path::new("C:\\Office\\WINWORD.EXE"),"/q"),"/q /n");
  assert_eq!(launch_arguments(std::path::Path::new("C:\\Apps\\Editor.exe"),"--profile \"Study Space\""),"--profile \"Study Space\"");
 }
 #[test]fn saved_app_reuse_requires_one_exact_matching_window(){
  let window=|hwnd,path:&str|WindowInfo{hwnd,pid:22,title:"Document".into(),executable:Some(path.into())};
  let choices=vec![window(101,"C:\\Office\\WINWORD.EXE"),window(102,"C:\\Apps\\Editor.exe")];
  assert_eq!(reuse_candidate(&choices,Some("c:\\office\\winword.exe")).unwrap().map(|w|w.hwnd),Some(101));
  assert!(reuse_candidate(&choices,Some("C:\\Apps\\Other.exe")).unwrap().is_none());
  assert!(reuse_candidate(&choices,None).unwrap().is_none());
  let mut ambiguous=choices.clone();ambiguous.push(window(103,"\\\\?\\C:\\Office\\WINWORD.EXE"));
  assert!(reuse_candidate(&ambiguous,Some("C:\\Office\\WINWORD.EXE")).is_err_and(|error|error.contains("Several windows")));
 }
 struct Fixture(HWND);impl Fixture{fn new(title:&str)->Self{unsafe{let class=wide("STATIC");let title=wide(title);Self(CreateWindowExW(WINDOW_EX_STYLE(0),PCWSTR(class.as_ptr()),PCWSTR(title.as_ptr()),WS_OVERLAPPEDWINDOW,50,60,840,520,None,None,None,None).unwrap())}}}impl Drop for Fixture{fn drop(&mut self){unsafe{let _=DestroyWindow(self.0);}}}
 #[test]fn real_window_fixture_tracks_bounds_clips_native_content_and_releases_without_closing(){unsafe{
  let main=Fixture::new("Still fixture owner");let target=Fixture::new("Still fixture app");let original=rect(target.0).unwrap();
  let mut original_placement=WINDOWPLACEMENT{length:std::mem::size_of::<WINDOWPLACEMENT>() as u32,..Default::default()};GetWindowPlacement(target.0,&mut original_placement).unwrap();
  let bounds=Bounds{x:100.,y:140.,width:800.,height:500.};let clip=Bounds{x:130.,y:160.,width:700.,height:450.};let grip=Bounds{x:798.,y:578.,width:32.,height:32.};
  let mut entry=Entry{hwnd:target.0.0 as usize,pid:std::process::id(),source_id:"test-app".into(),bounds:bounds.clone(),clip:clip.clone(),grip:Some(grip),visible:true,shown:false,original_owner:0,original_placement,original_region:0,original_visible:false,last:None,error:String::new()};
  SetWindowLongPtrW(target.0,GWLP_HWNDPARENT,main.0.0 as isize);SetPropW(target.0,PCWSTR(marker().as_ptr()),Some(HANDLE(main.0.0))).unwrap();
  position(&mut entry,main.0,POINT{x:30,y:20},1.5).unwrap();assert_eq!(rect(target.0).unwrap(),(180,230,1200,750));
  let region=CreateRectRgn(0,0,0,0);assert_ne!(GetWindowRgn(target.0,region),RGN_ERROR);let mut box_rect=RECT::default();GetRgnBox(region,&mut box_rect);assert_eq!((box_rect.left,box_rect.top,box_rect.right,box_rect.bottom),(45,30,1095,705));
  assert!(!PtInRegion(region,1070,680).as_bool(),"The native window must leave Still's resize grip uncovered");assert!(PtInRegion(region,1020,680).as_bool(),"App content outside the resize grip must remain visible");let _=DeleteObject(HGDIOBJ(region.0));
  entry.bounds.x=220.;position(&mut entry,main.0,POINT{x:30,y:20},1.5).unwrap();assert_eq!(rect(target.0).unwrap().0,360);
  restore(&mut entry);assert!(IsWindow(Some(target.0)).as_bool());assert_eq!(GetWindowLongPtrW(target.0,GWLP_HWNDPARENT),0);assert_eq!(rect(target.0).unwrap(),original);assert!(!IsWindowVisible(target.0).as_bool());
  assert!(GetPropW(target.0,PCWSTR(marker().as_ptr())).0.is_null());
  drop(target);assert!(!valid_window(&entry),"A closed app window must be rejected instead of retaining an attached card");
 }}
}
