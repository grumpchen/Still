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
 // PHYSICAL pixel floor storage (C1-C5). declared: from WM_GETMINMAXINFO,
 // replaced on every successful query. measured: from an observed refusal,
 // only after the same refusal is seen on two consecutive position() calls.
 // pending: candidate awaiting that second confirmation.
 declared:Option<(i32,i32)>,measured:Option<(i32,i32)>,pending:Option<(i32,i32)>,minimum_scale:Option<f64>,
 fresh:bool,
 last:Option<(Physical,Physical,Physical,Option<Physical>)>,error:String,
}
impl Drop for Entry{fn drop(&mut self){if self.original_region!=0{unsafe{let _=DeleteObject(HGDIOBJ(self.original_region as *mut _));}}}}
#[derive(Default)]struct Panels {items:HashMap<String,Entry>,pending:HashMap<String,Launch>,running:HashSet<String>,generation:HashMap<String,u64>,closed:bool}
#[derive(Default)]pub struct AppPanelState(Mutex<Panels>);
#[derive(Serialize)]#[serde(rename_all="camelCase")]pub struct Info{hwnd:usize,pid:u32,min_width:f64,min_height:f64,required_width:Option<f64>,required_height:Option<f64>,measured:bool}
fn physical_floor(entry:&Entry)->(i32,i32){let declared=entry.declared.unwrap_or((0,0));let measured=entry.measured.unwrap_or((0,0));(declared.0.max(measured.0),declared.1.max(measured.1))}
fn info(entry:&Entry,main:HWND,measured:bool)->Info{info_at(entry,unsafe{windows::Win32::UI::HiDpi::GetDpiForWindow(main)}.max(96) as f64/96.,measured)}
fn info_at(entry:&Entry,scale:f64,measured:bool)->Info{
 let size=rect(handle(entry.hwnd)).unwrap_or((0,0,640,400));let floor=physical_floor(entry);
 // C5: divide the effective PHYSICAL floor by the CURRENT scale so a monitor
 // or DPI change can never leave a stale capture-time CSS value behind.
 Info{hwnd:entry.hwnd,pid:entry.pid,min_width:size.2 as f64/scale,min_height:size.3 as f64/scale,required_width:(floor.0>0).then_some(floor.0 as f64/scale),required_height:(floor.1>0).then_some(floor.1 as f64/scale),measured}
}
// C6: the observed size answers what Still REQUESTED (wanted plus any floor),
// never the raw wanted size — Still's own floor is not an app refusal.
fn required_size(requested:Physical,actual:Physical)->(bool,bool){(actual.2>requested.2+1,actual.3>requested.3+1)}
fn tracking_minimum(hwnd:HWND)->(Option<i32>,Option<i32>){unsafe{
 // C4: never pre-seed OS track metrics; an app that leaves ptMinTrackSize
 // zero has declared no minimum and must not inherit a fabricated floor.
 let mut minimum=MINMAXINFO::default();
 let delivered=SendMessageTimeoutW(hwnd,WM_GETMINMAXINFO,windows::Win32::Foundation::WPARAM(0),LPARAM(&mut minimum as *mut MINMAXINFO as isize),SMTO_ABORTIFHUNG|SMTO_BLOCK|SMTO_ERRORONEXIT,100,None);
 if delivered.0==0{return (None,None)}
 // C5: keep physical pixels physical; callers divide by the CURRENT scale.
 let dimension=|value:i32|(value>0&&value<=20000).then_some(value);
 (dimension(minimum.ptMinTrackSize.x),dimension(minimum.ptMinTrackSize.y))
}}
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
 let mut entry=Entry{hwnd:window.hwnd,pid:window.pid,source_id,bounds,clip,grip,visible:false,shown:false,original_owner,original_placement,original_region,original_visible:IsWindowVisible(hwnd).as_bool(),declared:None,measured:None,pending:None,minimum_scale:None,fresh:false,last:None,error:String::new()};
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
fn position(entry:&mut Entry,main:HWND,origin:POINT,scale:f64)->Result<bool,String>{unsafe{
 let hwnd=handle(entry.hwnd);let wanted=entry.bounds.screen(origin,scale);let clip=entry.clip.screen(origin,scale);let grip=entry.grip.as_ref().map(|bounds|bounds.screen(origin,scale));
 let actual=rect(hwnd)?;
 // Cache a settled state only. An armed refusal candidate (pending) must force
 // another full pass so the two-pass confirmation can complete.
 if entry.shown&&entry.minimum_scale==Some(scale)&&entry.pending.is_none()&&entry.last==Some((wanted,clip,actual,grip)){return Ok(false)}
 // C1: a maximized window measures its monitor, not its panel. Restore before
 // any sampling so a maximized or hidden first sample can never latch the
 // monitor size as a permanent floor.
 if IsZoomed(hwnd).as_bool(){let _=ShowWindow(hwnd,SW_RESTORE);}else if IsIconic(hwnd).as_bool(){let _=ShowWindow(hwnd,SW_SHOWNOACTIVATE);}
 let floor=physical_floor(entry);
 let wants_smaller=wanted.2<floor.0||wanted.3<floor.1;
 // C2/C3: re-query the declared minimum on the first shown pass, after a DPI
 // or scale change, or when the user drags below the floor (a now-lower app
 // minimum must take effect). A total query failure leaves minimum_scale
 // unstamped so the next pass retries instead of freezing a stale floor.
 if !entry.shown||entry.minimum_scale!=Some(scale)||wants_smaller{
  let (width,height)=tracking_minimum(hwnd);
  if width.is_some()||height.is_some(){entry.declared=Some((width.unwrap_or(0),height.unwrap_or(0)));entry.minimum_scale=Some(scale);}
 }
 let floor=physical_floor(entry);
 let requested:Physical=(wanted.0,wanted.1,wanted.2.max(floor.0),wanted.3.max(floor.1));
 SetWindowPos(hwnd,Some(HWND_TOP),wanted.0,wanted.1,requested.2,requested.3,SWP_NOACTIVATE|SWP_NOOWNERZORDER).map_err(|e|e.to_string())?;
 let actual=rect(hwnd)?;
 // C6: compare against the REQUESTED size (which already contains Still's
 // own floor), never against the raw wanted size.
 let (refused_w,refused_h)=required_size(requested,actual);
 let mut measured_pass=false;
 if refused_w||refused_h{
  let candidate=((if refused_w{actual.2}else{floor.0}),(if refused_h{actual.3}else{floor.1}));
  // Two-pass confirmation: one observation can be a hidden, initializing or
  // maximized transient; only a second identical refusal becomes the floor.
  if entry.pending==Some(candidate){entry.measured=Some(candidate);measured_pass=true}
  entry.pending=Some(candidate);
 }else{
  entry.pending=None;
  // The app accepted the requested size while the user asked for less than
  // the floor: the floor was too high, so it clears and can be re-learned
  // lower (C2 decrease).
  if wants_smaller{entry.measured=None;entry.declared=None;measured_pass=true;}
 }
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
 entry.last=Some((wanted,clip,actual,grip));let _=main;Ok(measured_pass)
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
  let hwnd=handle(entry.hwnd);if !entry.visible||!parent{if entry.shown{unsafe{let _=ShowWindow(hwnd,SW_HIDE);}entry.shown=false;}entry.fresh=false;continue}
  match position(entry,main,origin,scale){Ok(measured)=>{entry.fresh=measured;if !entry.shown{unsafe{let _=ShowWindow(hwnd,SW_SHOWNOACTIVATE);}entry.shown=true;}if !entry.error.is_empty(){entry.error.clear();let _=app.emit_to("main","app-panel-state",serde_json::json!({"id":id,"open":true,"error":null}));}},Err(error)=>{entry.fresh=false;if entry.error!=error{entry.error=error.clone();let _=app.emit_to("main","app-panel-state",serde_json::json!({"id":id,"open":true,"error":error}));}}}
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
   if let Some(entry)=s.items.get(&id){if entry.source_id==source_id&&valid_window(entry){return Ok(info(entry,main,false))}}
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
     let measured=match position(&mut entry,main,origin,scale){Ok(measured)=>measured,Err(error)=>{restore(&mut entry);return Err(error)}};
     let information=info(&entry,main,measured);let mut s=state.0.lock().map_err(|_|"App panels are unavailable")?;
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
  let scale=unsafe{windows::Win32::UI::HiDpi::GetDpiForWindow(main)}.max(96) as f64/96.;let measured=match position(&mut entry,main,origin,scale){Ok(measured)=>measured,Err(e)=>{restore(&mut entry);return Err(e)}};
  let information=info(&entry,main,measured);let state=app.state::<AppPanelState>();let mut s=state.0.lock().map_err(|_|"App panels unavailable")?;
  if s.closed{restore(&mut entry);return Err("Still is closing".into())}*s.generation.entry(id.clone()).or_default()+=1;s.pending.remove(&id);
  if let Some(mut old)=s.items.insert(id.clone(),entry){restore(&mut old)}
  // An explicit picker selection returns focus to Still after releasing any old panel.
  // This also lets the next presentation show the selected app in Still's foreground context.
  drop(s);unsafe{let _=SetForegroundWindow(main);}
  let _=app.emit_to("main","app-panel-state",serde_json::json!({"id":id,"open":true}));Ok(information)
 }).await.map_err(|e|e.to_string())?
}
#[tauri::command]
pub async fn app_panel_present(app:AppHandle,webview:Webview,id:String,bounds:Bounds,clip:Bounds,grip:Option<Bounds>,visible:bool)->Result<Info,String>{
 crate::browser::authorize(&webview)?;instance(&id)?;bounds.validate()?;clip.validate()?;if let Some(grip)=&grip{grip.validate()?}
 let state=app.state::<AppPanelState>();let mut s=state.0.lock().map_err(|_|"App panels unavailable")?;
 let entry=s.items.get_mut(&id).ok_or("The app was closed. Reopen it below.")?;
 if !valid_window(entry){s.items.remove(&id);return Err("The app was closed. Reopen it below.".into())}
 if !visible&&belongs(unsafe{GetForegroundWindow()},entry.hwnd,entry.pid){if let Ok(main)=owner(){unsafe{let _=SetForegroundWindow(main);}}}
 entry.bounds=bounds;entry.clip=clip;entry.grip=grip;entry.visible=visible;place(&app,&mut s);
 let main=owner()?;let entry=s.items.get(&id).ok_or("The app was closed. Reopen it below.")?;Ok(info(entry,main,entry.fresh))
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
  // C6: Still compares the observed size against what it REQUESTED (wanted
  // plus any floor), never against the raw wanted size.
  #[test]fn required_size_compares_the_observed_size_against_the_requested_size_not_the_wanted_size(){
   assert_eq!(required_size((0,0,900,600),(0,0,900,600)),(false,false));
   assert_eq!(required_size((0,0,900,600),(0,0,901,600)),(false,false),"The +1 physical-pixel tolerance still applies");
   assert_eq!(required_size((0,0,900,600),(0,0,902,600)),(true,false));
   assert_eq!(required_size((0,0,900,600),(0,0,900,610)),(false,true));
   // Still's own floor inside the request is not an app refusal (the old
   // code compared against wanted, which is smaller than the request here).
   assert_eq!(required_size((0,0,900,600),(0,0,600,375)),(false,false),"An app smaller than requested is not a refusal");
   assert_eq!(required_size((0,0,600,375),(0,0,900,600)),(true,true),"A genuine clamp above the request is a refusal");
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
 unsafe extern "system" fn minimum_fixture_proc(hwnd:HWND,message:u32,wparam:windows::Win32::Foundation::WPARAM,lparam:LPARAM)->windows::Win32::Foundation::LRESULT{
  if message==WM_GETMINMAXINFO{let minimum=&mut *(lparam.0 as *mut MINMAXINFO);minimum.ptMinTrackSize=POINT{x:900,y:600};return windows::Win32::Foundation::LRESULT(0)}
  DefWindowProcW(hwnd,message,wparam,lparam)
 }
 #[test]fn declared_minimum_is_physical_applied_to_requests_and_cleared_when_smaller_is_accepted(){unsafe{
  let class=wide("StillMinimumSizeFixture");let instance=windows::Win32::Foundation::HINSTANCE(windows::Win32::System::LibraryLoader::GetModuleHandleW(None).unwrap().0);
  let definition=WNDCLASSW{lpfnWndProc:Some(minimum_fixture_proc),hInstance:instance,lpszClassName:PCWSTR(class.as_ptr()),..Default::default()};assert_ne!(RegisterClassW(&definition),0);
  let hwnd=CreateWindowExW(WINDOW_EX_STYLE(0),PCWSTR(class.as_ptr()),PCWSTR(class.as_ptr()),WS_OVERLAPPEDWINDOW,0,0,1600,1000,None,None,Some(instance),None).unwrap();let target=Fixture(hwnd);let main=Fixture::new("Still minimum owner");
  let bounds=Bounds{x:10.,y:20.,width:1000.,height:700.};
  let mut entry=test_entry(hwnd.0 as usize,&bounds);
  position(&mut entry,main.0,POINT{x:0,y:0},1.5).unwrap();
  assert_eq!(entry.declared,Some((900,600)),"Learn the app's declared tracking minimum as PHYSICAL pixels");
  assert_eq!(info_at(&entry,1.5,false).required_width,Some(600.),"Info divides the physical floor by the current scale");
  let size=rect(hwnd).unwrap();assert_eq!((size.2,size.3),(1500,1050),"The panel follows the requested size when it exceeds the minimum");
  entry.bounds.width=200.;entry.bounds.height=100.;position(&mut entry,main.0,POINT{x:0,y:0},1.5).unwrap();
  let size=rect(hwnd).unwrap();assert_eq!((size.2,size.3),(900,600),"The requested size still includes the declared minimum");
  assert_eq!((entry.declared,entry.measured,entry.pending),(None,None,None),"An accepted smaller request clears the stale floor so it can be re-learned (C2)");
  drop(target);assert!(UnregisterClassW(PCWSTR(class.as_ptr()),Some(instance)).is_ok());
 }}
 // A fresh Entry wired to a fixture window, with the PHYSICAL floor storage.
 fn test_entry(hwnd:usize,bounds:&Bounds)->Entry{Entry{hwnd,pid:std::process::id(),source_id:"test-app".into(),bounds:bounds.clone(),clip:bounds.clone(),grip:None,visible:true,shown:false,original_owner:0,original_placement:WINDOWPLACEMENT{length:std::mem::size_of::<WINDOWPLACEMENT>() as u32,..Default::default()},original_region:0,original_visible:false,declared:None,measured:None,pending:None,minimum_scale:None,fresh:false,last:None,error:String::new()}}
 unsafe fn class_window(class:&[u16],proc:unsafe extern "system" fn(HWND,u32,windows::Win32::Foundation::WPARAM,LPARAM)->windows::Win32::Foundation::LRESULT,title:&str)->(HWND,windows::Win32::Foundation::HINSTANCE){
  let instance=windows::Win32::Foundation::HINSTANCE(windows::Win32::System::LibraryLoader::GetModuleHandleW(None).unwrap().0);
  let definition=WNDCLASSW{lpfnWndProc:Some(proc),hInstance:instance,lpszClassName:PCWSTR(class.as_ptr()),..Default::default()};assert_ne!(RegisterClassW(&definition),0);
  let title=wide(title);
  let hwnd=CreateWindowExW(WINDOW_EX_STYLE(0),PCWSTR(class.as_ptr()),PCWSTR(title.as_ptr()),WS_OVERLAPPEDWINDOW,0,0,1600,1000,None,None,Some(instance),None).unwrap();
  (hwnd,instance)
 }
 // Declares 900x600 physical via WM_GETMINMAXINFO and enforces it on WM_WINDOWPOSCHANGING.
 unsafe extern "system" fn declaring_clamping_proc(hwnd:HWND,message:u32,wparam:windows::Win32::Foundation::WPARAM,lparam:LPARAM)->windows::Win32::Foundation::LRESULT{
  if message==WM_GETMINMAXINFO{let minimum=&mut *(lparam.0 as *mut MINMAXINFO);minimum.ptMinTrackSize=POINT{x:900,y:600};return windows::Win32::Foundation::LRESULT(0)}
  if message==WM_WINDOWPOSCHANGING{let position=&mut *(lparam.0 as *mut WINDOWPOS);if position.cx<900{position.cx=900}if position.cy<600{position.cy=600};return windows::Win32::Foundation::LRESULT(0)}
  DefWindowProcW(hwnd,message,wparam,lparam)
 }
 static ACCEPT_SMALLER:std::sync::atomic::AtomicBool=std::sync::atomic::AtomicBool::new(false);
 // Enforces 900x600 only while ACCEPT_SMALLER is false; never declares a minimum.
 unsafe extern "system" fn silent_clamping_proc(hwnd:HWND,message:u32,wparam:windows::Win32::Foundation::WPARAM,lparam:LPARAM)->windows::Win32::Foundation::LRESULT{
  if message==WM_WINDOWPOSCHANGING&&!ACCEPT_SMALLER.load(std::sync::atomic::Ordering::Relaxed){let position=&mut *(lparam.0 as *mut WINDOWPOS);if position.cx<900{position.cx=900}if position.cy<600{position.cy=600};return windows::Win32::Foundation::LRESULT(0)}
  DefWindowProcW(hwnd,message,wparam,lparam)
 }
 static RETRIED:std::sync::atomic::AtomicBool=std::sync::atomic::AtomicBool::new(false);
 // The first WM_GETMINMAXINFO is answered with a zeroed MINMAXINFO; later ones declare 900x600.
 unsafe extern "system" fn retrying_proc(hwnd:HWND,message:u32,wparam:windows::Win32::Foundation::WPARAM,lparam:LPARAM)->windows::Win32::Foundation::LRESULT{
  if message==WM_GETMINMAXINFO{
   if !RETRIED.swap(true,std::sync::atomic::Ordering::Relaxed){return windows::Win32::Foundation::LRESULT(0)}
   let minimum=&mut *(lparam.0 as *mut MINMAXINFO);minimum.ptMinTrackSize=POINT{x:900,y:600};return windows::Win32::Foundation::LRESULT(0)
  }
  DefWindowProcW(hwnd,message,wparam,lparam)
 }
 #[test]fn c1_a_maximized_first_sample_never_becomes_the_floor(){unsafe{
  ACCEPT_SMALLER.store(false,std::sync::atomic::Ordering::Relaxed);
  let class=wide("StillC1MaximizedFixture");let (hwnd,instance)=class_window(&class,declaring_clamping_proc,"Still C1 fixture");
  let target=Fixture(hwnd);let main=Fixture::new("Still C1 owner");
  let _=ShowWindow(hwnd,SW_MAXIMIZE);assert!(IsZoomed(hwnd).as_bool());
  let maximized=rect(hwnd).unwrap();assert!(maximized.2>900&&maximized.3>600,"The fixture must be maximized larger than the app minimum");
  let bounds=Bounds{x:10.,y:20.,width:400.,height:250.};let mut entry=test_entry(hwnd.0 as usize,&bounds);
  let measured=position(&mut entry,main.0,POINT{x:0,y:0},1.5).unwrap();
  assert!(!IsZoomed(hwnd).as_bool(),"position() must restore a maximized window before sampling");
  assert_eq!(entry.declared,Some((900,600)),"The declared minimum stays PHYSICAL pixels");
  let size=rect(hwnd).unwrap();assert_eq!((size.2,size.3),(900,600));
  let reported=info_at(&entry,1.5,measured);
  assert_eq!((reported.required_width,reported.required_height),(Some(600.),Some(400.)),"Info divides the physical floor by the current scale");
  assert_ne!(reported.required_width,Some(maximized.2 as f64/1.5),"The maximized monitor size must never be latched as a minimum");
  drop(target);assert!(UnregisterClassW(PCWSTR(class.as_ptr()),Some(instance)).is_ok());
 }}
 #[test]fn c2_the_stored_floor_clears_once_the_app_accepts_a_smaller_request(){unsafe{
  ACCEPT_SMALLER.store(false,std::sync::atomic::Ordering::Relaxed);
  let class=wide("StillC2DecreaseFixture");let (hwnd,instance)=class_window(&class,silent_clamping_proc,"Still C2 fixture");
  let target=Fixture(hwnd);let main=Fixture::new("Still C2 owner");
  let bounds=Bounds{x:0.,y:0.,width:200.,height:134.};let mut entry=test_entry(hwnd.0 as usize,&bounds);
  position(&mut entry,main.0,POINT{x:0,y:0},1.5).unwrap();
  assert_eq!(entry.pending,Some((900,600)),"A first refusal only arms the two-pass confirmation");
  assert_eq!(entry.measured,None);
  position(&mut entry,main.0,POINT{x:0,y:0},1.5).unwrap();
  assert_eq!(entry.measured,Some((900,600)),"A second identical refusal confirms the physical floor");
  ACCEPT_SMALLER.store(true,std::sync::atomic::Ordering::Relaxed);
  position(&mut entry,main.0,POINT{x:0,y:0},1.5).unwrap();
  assert_eq!((entry.measured,entry.declared,entry.pending),(None,None,None),"An accepted smaller request clears the stale floor (C2 decrease)");
  position(&mut entry,main.0,POINT{x:0,y:0},1.5).unwrap();
  let size=rect(hwnd).unwrap();assert_eq!((size.2,size.3),(300,201),"With the floor cleared the panel follows the requested size");
  drop(target);assert!(UnregisterClassW(PCWSTR(class.as_ptr()),Some(instance)).is_ok());
 }}
 #[test]fn c3_a_failed_minimum_query_is_retried_on_the_next_pass(){unsafe{
  let class=wide("StillC3RetryFixture");let (hwnd,instance)=class_window(&class,retrying_proc,"Still C3 fixture");
  RETRIED.store(false,std::sync::atomic::Ordering::Relaxed);
  let target=Fixture(hwnd);let main=Fixture::new("Still C3 owner");
  let bounds=Bounds{x:0.,y:0.,width:800.,height:500.};let mut entry=test_entry(hwnd.0 as usize,&bounds);
  position(&mut entry,main.0,POINT{x:0,y:0},1.0).unwrap();
  assert_eq!(entry.minimum_scale,None,"A total query failure must not stamp the scale");
  assert_eq!(entry.declared,None);
  entry.shown=true;
  position(&mut entry,main.0,POINT{x:0,y:0},1.0).unwrap();
  assert_eq!((entry.declared,entry.minimum_scale),(Some((900,600)),Some(1.0)),"The next pass retries the query and learns the declared minimum");
  drop(target);assert!(UnregisterClassW(PCWSTR(class.as_ptr()),Some(instance)).is_ok());
 }}
 #[test]fn c4_a_window_that_never_declares_a_minimum_gets_no_fabricated_floor(){
  let main=Fixture::new("Still C4 owner");let target=Fixture::new("Still C4 app");
  assert_eq!(tracking_minimum(target.0),(None,None),"An unanswered WM_GETMINMAXINFO must not inherit OS track metrics");
  let bounds=Bounds{x:0.,y:0.,width:300.,height:200.};let mut entry=test_entry(target.0.0 as usize,&bounds);
  position(&mut entry,main.0,POINT{x:0,y:0},1.0).unwrap();
  assert_eq!((entry.declared,entry.measured,entry.pending),(None,None,None));
  assert_eq!(physical_floor(&entry),(0,0));
  let reported=info_at(&entry,1.0,true);assert_eq!((reported.required_width,reported.required_height),(None,None));
 }
 #[test]fn c5_the_physical_floor_reports_consistently_against_the_current_scale(){unsafe{
  let class=wide("StillC5DpiFixture");let (hwnd,instance)=class_window(&class,declaring_clamping_proc,"Still C5 fixture");
  let target=Fixture(hwnd);let main=Fixture::new("Still C5 owner");
  let bounds=Bounds{x:0.,y:0.,width:400.,height:250.};let mut entry=test_entry(hwnd.0 as usize,&bounds);
  position(&mut entry,main.0,POINT{x:0,y:0},1.0).unwrap();
  assert_eq!(entry.declared,Some((900,600)),"Physical storage is scale-invariant");
  assert_eq!(info_at(&entry,1.0,false).required_width,Some(900.));
  assert_eq!(info_at(&entry,2.0,false).required_width,Some(450.),"The CSS report follows the CURRENT scale, never a stale capture-time value");
  assert_eq!(info_at(&entry,2.0,false).required_height,Some(300.));
  // The same CSS minimum declared as different physical pixels at different
  // scales reports the same CSS value in Info (the C5 stale-by-DPI-ratio defect).
  let mut scaled=test_entry(0,&bounds);scaled.declared=Some((900,600));
  assert_eq!(info_at(&scaled,1.5,false).required_width,Some(600.));
  scaled.declared=Some((1200,800));
  assert_eq!(info_at(&scaled,2.0,false).required_width,Some(600.));
  drop(target);assert!(UnregisterClassW(PCWSTR(class.as_ptr()),Some(instance)).is_ok());
 }}
 #[test]fn real_window_fixture_tracks_bounds_clips_native_content_and_releases_without_closing(){unsafe{
  let main=Fixture::new("Still fixture owner");let target=Fixture::new("Still fixture app");let original=rect(target.0).unwrap();
  let mut original_placement=WINDOWPLACEMENT{length:std::mem::size_of::<WINDOWPLACEMENT>() as u32,..Default::default()};GetWindowPlacement(target.0,&mut original_placement).unwrap();
  let bounds=Bounds{x:100.,y:140.,width:800.,height:500.};let clip=Bounds{x:130.,y:160.,width:700.,height:450.};let grip=Bounds{x:798.,y:578.,width:32.,height:32.};
  let mut entry=Entry{hwnd:target.0.0 as usize,pid:std::process::id(),source_id:"test-app".into(),bounds:bounds.clone(),clip:clip.clone(),grip:Some(grip),visible:true,shown:false,original_owner:0,original_placement,original_region:0,original_visible:false,declared:None,measured:None,pending:None,minimum_scale:None,fresh:false,last:None,error:String::new()};
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
