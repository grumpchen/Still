use serde::{Deserialize,Serialize};
use std::{collections::{HashMap,HashSet},path::{Path,PathBuf},sync::{Mutex,OnceLock}};
use tauri::{AppHandle,Emitter,Manager,Webview};
use windows::{core::{Interface,PCWSTR,PWSTR},Win32::{Foundation::{CloseHandle,HANDLE,HWND,LPARAM,POINT,RECT},Graphics::Gdi::*,System::{Com::*,Threading::*},UI::{Shell::*,WindowsAndMessaging::*,Accessibility::{SetWinEventHook,HWINEVENTHOOK}}}};

#[derive(Clone,Debug,Deserialize,PartialEq)]
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
fn collection_marker(id:&str)->Vec<u16>{wide(&format!("StillCollectedAppPanel:{id}"))}
type Physical=(i32,i32,i32,i32);
struct Entry {
 hwnd:usize,pid:u32,source_id:String,bounds:Bounds,clip:Bounds,grip:Option<Bounds>,occlusions:Vec<Bounds>,viewport_right:Option<f64>,visible:bool,shown:bool,edge_hidden:bool,preserve_focus:bool,collection_marker:Option<String>,collection_was_visible:Option<bool>,stacking_rank:i64,revision:u64,
 resize_guard:Option<crate::native_resize::NativeResizeGuard>,original_owner:usize,original_placement:WINDOWPLACEMENT,original_region:usize,original_visible:bool,
 // CSS-pixel minima; measured is a fallback for apps which refuse SetWindowPos
 // without declaring a WM_GETMINMAXINFO minimum. Pending candidates are kept in
 // physical pixels so consecutive samples compare exactly.
 declared_width:Option<f64>,declared_height:Option<f64>,measured_width:Option<f64>,measured_height:Option<f64>,
 pending_width:Option<i32>,pending_height:Option<i32>,probing_width:bool,probing_height:bool,
 minimum_dpi:Option<(u32,u32)>,minimum_query_after:Option<std::time::Instant>,fresh:bool,
 last:Option<(Physical,Physical,Physical,Option<Physical>,Vec<Physical>)>,error:String,
}
impl Drop for Entry{fn drop(&mut self){if self.original_region!=0{unsafe{let _=DeleteObject(HGDIOBJ(self.original_region as *mut _));}}}}
#[derive(Default)]struct Panels {items:HashMap<String,Entry>,pending:HashMap<String,Launch>,running:HashSet<String>,attaching:HashSet<(usize,u32)>,generation:HashMap<String,u64>,closed:bool}
#[derive(Default)]pub struct AppPanelState(Mutex<Panels>);
#[derive(Serialize)]#[serde(rename_all="camelCase")]pub struct Info{hwnd:usize,pid:u32,min_width:f64,min_height:f64,required_width:Option<f64>,required_height:Option<f64>,measured:bool,probing:bool,shown:bool}
#[derive(Serialize)]#[serde(rename_all="camelCase")]pub struct AttachmentIdentity{pub hwnd:usize,pub pid:u32}
fn maximum(a:Option<f64>,b:Option<f64>)->Option<f64>{match(a,b){(Some(a),Some(b))=>Some(a.max(b)),(Some(v),None)|(None,Some(v))=>Some(v),(None,None)=>None}}
fn info(entry:&Entry,main:HWND,measured:bool)->Info{info_at(entry,unsafe{windows::Win32::UI::HiDpi::GetDpiForWindow(main)}.max(96) as f64/96.,measured)}
fn info_at(entry:&Entry,scale:f64,measured:bool)->Info{
 let size=rect(handle(entry.hwnd)).unwrap_or((0,0,640,400));
 let required_width=if entry.probing_width{entry.declared_width}else{maximum(entry.declared_width,entry.measured_width)};
 let required_height=if entry.probing_height{entry.declared_height}else{maximum(entry.declared_height,entry.measured_height)};
 Info{hwnd:entry.hwnd,pid:entry.pid,min_width:size.2 as f64/scale,min_height:size.3 as f64/scale,required_width,required_height,measured,probing:entry.probing_width||entry.probing_height,shown:entry.shown}
}
fn minimum_query_due(entry:&Entry,dpi:(u32,u32),wants_smaller:bool,now:std::time::Instant)->bool{
 entry.minimum_query_after.is_none_or(|after|now>=after)&&(entry.minimum_dpi!=Some(dpi)||wants_smaller)
}
fn record_minimum_query(entry:&mut Entry,dpi:(u32,u32),result:Option<(Option<f64>,Option<f64>)>,now:std::time::Instant)->bool{
 match result{
  Some((width,height))=>{entry.declared_width=width;entry.declared_height=height;entry.minimum_dpi=Some(dpi);entry.minimum_query_after=Some(now+std::time::Duration::from_secs(1));true}
  None=>{entry.minimum_query_after=Some(now+std::time::Duration::from_secs(1));false}
 }
}
// C6: the observed size answers what Still REQUESTED (wanted plus any floor),
// never the raw wanted size — Still's own floor is not an app refusal.
fn required_size(requested:Physical,actual:Physical)->(bool,bool){(actual.2>requested.2+1,actual.3>requested.3+1)}
fn tracking_minimum(hwnd:HWND)->Option<(Option<f64>,Option<f64>)>{unsafe{
 // C4: never pre-seed OS track metrics; an app that leaves ptMinTrackSize
 // zero has declared no minimum and must not inherit a fabricated floor.
 let mut minimum=MINMAXINFO::default();
 let delivered=SendMessageTimeoutW(hwnd,WM_GETMINMAXINFO,windows::Win32::Foundation::WPARAM(0),LPARAM(&mut minimum as *mut MINMAXINFO as isize),SMTO_ABORTIFHUNG|SMTO_BLOCK|SMTO_ERRORONEXIT,100,None);
  if delivered.0==0{return None}
  // WM_GETMINMAXINFO uses the TARGET window's DPI. Store CSS pixels so a
  // monitor move can refresh this value independently of Still's DPI.
  let dpi=windows::Win32::UI::HiDpi::GetDpiForWindow(hwnd).max(96);
  Some((physical_to_css(minimum.ptMinTrackSize.x,dpi),physical_to_css(minimum.ptMinTrackSize.y,dpi)))
 }}
fn physical_to_css(value:i32,dpi:u32)->Option<f64>{(value>0&&value<=20000).then_some(value as f64/(dpi.max(96) as f64/96.))}

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
fn collected_windows(id:&str)->Vec<WindowInfo>{
 unsafe extern "system" fn collect(hwnd:HWND,param:LPARAM)->windows::core::BOOL{
  let (property,items)=&mut *(param.0 as *mut (Vec<u16>,Vec<WindowInfo>));
  if !GetPropW(hwnd,PCWSTR(property.as_ptr())).0.is_null(){let process=pid(hwnd);items.push(WindowInfo{hwnd:hwnd.0 as usize,pid:process,title:window_title(hwnd),executable:executable(process)});}
  windows::core::BOOL(1)
 }
 let mut state=(collection_marker(id),Vec::new());unsafe{let _=EnumWindows(Some(collect),LPARAM(&mut state as *mut _ as isize));}state.1
}
pub(crate) fn managed_windows(app:&AppHandle)->Vec<(usize,u32)>{app.state::<AppPanelState>().0.lock().map(|s|s.items.values().filter(|e|valid_window(e)).map(|e|(e.hwnd,e.pid)).collect()).unwrap_or_default()}
fn window_title(hwnd:HWND)->String{unsafe{let length=GetWindowTextLengthW(hwnd).max(0) as usize;let mut title=vec![0u16;length.min(4096)+1];GetWindowTextW(hwnd,&mut title);from_wide(&title)}}
fn exact_window_identity(expected_hwnd:usize,expected_pid:u32,actual_hwnd:usize,actual_pid:u32)->bool{expected_hwnd!=0&&expected_hwnd==actual_hwnd&&expected_pid!=0&&expected_pid==actual_pid&&actual_pid!=std::process::id()}
fn direct_candidate(hwnd:usize,expected_pid:u32)->Result<WindowInfo,String>{unsafe{
 let target=handle(hwnd);if !IsWindow(Some(target)).as_bool(){return Err("The clicked window closed before it could be attached. Try again.".into())}
 if !exact_window_identity(hwnd,expected_pid,target.0 as usize,pid(target)){return Err("The clicked window changed before attachment. Hold Ctrl+Shift and click it again.".into())}
 if GetAncestor(target,GA_ROOT)!=target{return Err("The clicked app window is no longer a top-level window. Try again.".into())}
 if !GetPropW(target,PCWSTR(marker().as_ptr())).0.is_null(){return Err("This window is already attached in Still.".into())}
 Ok(WindowInfo{hwnd,pid:expected_pid,title:window_title(target),executable:None})
}}
fn target_claimed(panels:&Panels,hwnd:usize,pid:u32)->bool{panels.items.values().any(|entry|entry.hwnd==hwnd&&entry.pid==pid)||panels.attaching.contains(&(hwnd,pid))}
fn reserve_target(panels:&mut Panels,hwnd:usize,pid:u32)->Result<(),String>{if target_claimed(panels,hwnd,pid){Err("This window is already attached or attaching in Still.".into())}else{panels.attaching.insert((hwnd,pid));Ok(())}}
pub(crate) fn capture_candidate(app:&AppHandle,hwnd:usize,expected_pid:u32)->Result<Option<String>,String>{unsafe{
 let target=handle(hwnd);if !IsWindow(Some(target)).as_bool(){return Err("The clicked window closed before it could be attached. Try again.".into())}
 if pid(target)!=expected_pid||expected_pid==0{return Err("The clicked window changed before attachment. Hold Ctrl+Shift and click it again.".into())}
 if expected_pid==std::process::id(){return Ok(None)}
 if GetAncestor(target,GA_ROOT)!=target{return Err("The clicked app window is no longer a top-level window. Try again.".into())}
 if !GetPropW(target,PCWSTR(marker().as_ptr())).0.is_null(){return Ok(None)}
 let mut class=[0u16;256];let class_len=GetClassNameW(target,&mut class).max(0) as usize;let class=String::from_utf16_lossy(&class[..class_len.min(class.len())]);
 if ["Progman","WorkerW","Shell_TrayWnd","#32768"].contains(&class.as_str())||class.to_ascii_lowercase().contains("splash")||GetWindowLongPtrW(target,GWL_EXSTYLE)&WS_EX_TOOLWINDOW.0 as isize!=0{return Ok(None)}
  }
  if crate::chrome_overlay::managed_windows(app).contains(&(hwnd,expected_pid)){return Ok(None)}
 let state=app.state::<AppPanelState>();let panels=state.0.lock().map_err(|_|"App panels are unavailable")?;if target_claimed(&panels,hwnd,expected_pid){return Ok(None)}drop(panels);
 direct_candidate(hwnd,expected_pid).map(|candidate|Some(candidate.title))
}
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
fn attachment_identity(entry:Option<&Entry>)->Option<AttachmentIdentity>{entry.filter(|entry|valid_window(entry)).map(|entry|AttachmentIdentity{hwnd:entry.hwnd,pid:entry.pid})}
fn belongs(mut window:HWND,hwnd:usize,process:u32)->bool{for _ in 0..12{if window.0 as usize==hwnd&&pid(window)==process{return true}window=unsafe{GetWindow(window,GW_OWNER)}.unwrap_or_default();if window.0.is_null(){break}}false}
fn foreground_in(items:&HashMap<String,Entry>,front:HWND)->bool{
 items.values().any(|e|belongs(front,e.hwnd,e.pid))
}
pub fn is_managed_foreground(app:&AppHandle,hwnd:HWND)->bool{app.state::<AppPanelState>().0.try_lock().map(|s|foreground_in(&s.items,hwnd)).unwrap_or(false)}
fn parent_context(items:&HashMap<String,Entry>,main:HWND,app:&AppHandle)->bool{let front=unsafe{GetForegroundWindow()};front.0.is_null()||pid(front)==std::process::id()||foreground_in(items,front)||crate::chrome_overlay::is_managed_foreground(app,front)||front==main}

fn attach(window:&WindowInfo,source_id:String,bounds:Bounds,clip:Bounds,grip:Option<Bounds>,main:HWND,preserve_focus:bool)->Result<Entry,String>{unsafe{
 let hwnd=handle(window.hwnd);
 if !IsWindow(Some(hwnd)).as_bool()||pid(hwnd)!=window.pid||window.pid==std::process::id()||!GetPropW(hwnd,PCWSTR(marker().as_ptr())).0.is_null(){return Err("This window is no longer available for attachment.".into())}
 let original_owner=GetWindowLongPtrW(hwnd,GWLP_HWNDPARENT) as usize;
 let mut original_placement=WINDOWPLACEMENT{length:std::mem::size_of::<WINDOWPLACEMENT>() as u32,..Default::default()};
 GetWindowPlacement(hwnd,&mut original_placement).map_err(|e|e.to_string())?;
 let region=CreateRectRgn(0,0,0,0);let original_region=if GetWindowRgn(hwnd,region)!=RGN_ERROR{region.0 as usize}else{let _=DeleteObject(HGDIOBJ(region.0));0};
  let original_visible=IsWindowVisible(hwnd).as_bool();
  let mut entry=Entry{hwnd:window.hwnd,pid:window.pid,source_id,bounds,clip,grip,occlusions:Vec::new(),viewport_right:None,visible:preserve_focus&&original_visible,shown:preserve_focus&&original_visible,edge_hidden:false,preserve_focus,collection_marker:None,collection_was_visible:None,stacking_rank:0,revision:0,resize_guard:None,original_owner,original_placement,original_region,original_visible,declared_width:None,declared_height:None,measured_width:None,measured_height:None,pending_width:None,pending_height:None,probing_width:false,probing_height:false,minimum_dpi:None,minimum_query_after:None,fresh:false,last:None,error:String::new()};
 // Top-level ownership, never SetParent/WS_CHILD. Restore it before Still closes.
 SetWindowLongPtrW(hwnd,GWLP_HWNDPARENT,main.0 as isize);
 if GetWindow(hwnd,GW_OWNER).ok()!=Some(main){SetWindowLongPtrW(hwnd,GWLP_HWNDPARENT,original_owner as isize);return Err("The app could not be attached. Still and the app must run at the same Windows permission level.".into())}
 if let Err(error)=SetPropW(hwnd,PCWSTR(marker().as_ptr()),Some(HANDLE(main.0))){restore(&mut entry);return Err(error.to_string())}
 entry.resize_guard=match crate::native_resize::NativeResizeGuard::install(hwnd){Ok(guard)=>Some(guard),Err(error)=>{restore(&mut entry);return Err(error)}};
 if !preserve_focus{let _=ShowWindow(hwnd,SW_HIDE);}
 Ok(entry)
}}
fn restore(entry:&mut Entry){unsafe{
 let hwnd=handle(entry.hwnd);if !valid_window(entry){return}
 if let Some(guard)=entry.resize_guard.as_mut(){guard.restore();}
 SetWindowLongPtrW(hwnd,GWLP_HWNDPARENT,entry.original_owner as isize);let _=RemovePropW(hwnd,PCWSTR(marker().as_ptr()));
 let saved=(entry.original_region!=0).then(||HRGN(entry.original_region as *mut _));
 if SetWindowRgn(hwnd,saved,true)!=0{entry.original_region=0;}
 let mut placement=entry.original_placement;if !entry.original_visible{placement.showCmd=SW_HIDE.0 as u32;}
 let _=SetWindowPlacement(hwnd,&placement);let _=ShowWindow(hwnd,if entry.original_visible{SW_SHOWNA}else{SW_HIDE});
}}
fn clear_collection_marker(entry:&mut Entry){if let Some(id)=entry.collection_marker.take(){unsafe{let _=RemovePropW(handle(entry.hwnd),PCWSTR(collection_marker(&id).as_ptr()));}}entry.collection_was_visible=None;}
fn protect_collected_window(entry:&mut Entry)->Result<bool,String>{
 if entry.collection_marker.is_none(){return Ok(false)}
 let hwnd=handle(entry.hwnd);
 if !valid_window(entry){return Err("The collected app window is no longer available. Use Attach open app to reconnect it.".into())}
 unsafe{if IsWindowVisible(hwnd).as_bool(){let _=ShowWindow(hwnd,SW_HIDE);}}
 if unsafe{IsWindowVisible(hwnd).as_bool()}{entry.shown=true;return Err("Windows could not keep the collected app window hidden. The widget remains saved in its Group.".into())}
 entry.visible=false;entry.shown=false;entry.edge_hidden=false;entry.last=None;entry.fresh=false;
 Ok(true)
}
fn mark_collected(entry:&mut Entry,id:&str)->Result<(),String>{
 let hwnd=handle(entry.hwnd);
 if !valid_window(entry){return Err("The attached app window is no longer available. The widget remains on the workspace.".into())}
 if entry.collection_marker.as_deref()!=Some(id){
  unsafe{SetPropW(hwnd,PCWSTR(collection_marker(id).as_ptr()),Some(HANDLE(1usize as *mut _))).map_err(|error|error.to_string())?;}
  entry.collection_marker=Some(id.to_owned());entry.collection_was_visible=Some(entry.visible);
 }
 match protect_collected_window(entry){
  Ok(true)=>Ok(()),
  Ok(false)=>{clear_collection_marker(entry);Err("The app window could not be marked as collected. The widget remains on the workspace.".into())},
  Err(error)=>{clear_collection_marker(entry);entry.shown=unsafe{IsWindowVisible(hwnd).as_bool()};Err(error)}
 }
}
fn prepare_collection_resume(entry:&mut Entry,cancel:bool){
 let restore_visibility=entry.collection_was_visible.unwrap_or(true);
 clear_collection_marker(entry);
 entry.visible=if cancel{restore_visibility}else{false};entry.shown=false;entry.edge_hidden=false;entry.last=None;entry.revision=0;entry.fresh=false;
}
fn position(entry:&mut Entry,main:HWND,origin:POINT,scale:f64)->Result<bool,String>{unsafe{
 let hwnd=handle(entry.hwnd);let main_dpi=windows::Win32::UI::HiDpi::GetDpiForWindow(main).max(96);let target_dpi=windows::Win32::UI::HiDpi::GetDpiForWindow(hwnd).max(96);let dpi=(main_dpi,target_dpi);
 let zoomed=IsZoomed(hwnd).as_bool();let iconic=IsIconic(hwnd).as_bool();
 // Restore a maximized target before sampling its size. If the managed app had
 // focus, return it to Still immediately after restoration.
  if zoomed||iconic{let foreground=GetForegroundWindow();let return_focus=if entry.preserve_focus{HWND::default()}else if foreground==hwnd||belongs(foreground,entry.hwnd,entry.pid){main}else{foreground};if entry.shown&&!entry.preserve_focus{let _=ShowWindow(hwnd,SW_HIDE);entry.shown=false;}let _=ShowWindow(hwnd,if zoomed{SW_RESTORE}else{SW_SHOWNOACTIVATE});if !entry.preserve_focus{let _=ShowWindow(hwnd,SW_HIDE);}if !return_focus.0.is_null(){let _=SetForegroundWindow(return_focus);}}
 let was_shown=entry.shown;
 let wanted=entry.bounds.screen(origin,scale);let clip=entry.clip.screen(origin,scale);let grip=entry.grip.as_ref().map(|bounds|bounds.screen(origin,scale));let occlusions=entry.occlusions.iter().map(|bounds|bounds.screen(origin,scale)).collect::<Vec<_>>();let actual=rect(hwnd)?;
 let desired_css=(wanted.2 as f64/scale,wanted.3 as f64/scale);
 let now=std::time::Instant::now();let scale_changed=entry.minimum_dpi.is_some_and(|previous|previous!=dpi);
 if entry.shown&&scale_changed{
  // Measured sizes are in the old DPI's CSS space; discard them and remeasure.
  entry.measured_width=None;entry.measured_height=None;entry.pending_width=None;entry.pending_height=None;
  entry.probing_width=false;entry.probing_height=false;entry.declared_width=None;entry.declared_height=None;
  entry.minimum_dpi=None;entry.minimum_query_after=None;entry.last=None;
 }
 let wants_smaller=desired_css.0+0.5<entry.declared_width.unwrap_or(0.).max(entry.measured_width.unwrap_or(0.))||desired_css.1+0.5<entry.declared_height.unwrap_or(0.).max(entry.measured_height.unwrap_or(0.));
  let query_due=entry.shown&&minimum_query_due(entry,dpi,wants_smaller,now);
  let mut fresh=false;
  if query_due{fresh=record_minimum_query(entry,dpi,tracking_minimum(hwnd),now);}
 let declared_width=entry.declared_width.unwrap_or(0.);let declared_height=entry.declared_height.unwrap_or(0.);
 let measured_width=entry.measured_width.unwrap_or(0.);let measured_height=entry.measured_height.unwrap_or(0.);
 // Declared minima are authoritative and clamped. A measured fallback is a
 // probe trigger only: send the user's smaller request to the real app and let
 // its response either confirm a new floor or prove the old floor stale.
 let declared_w_px=(declared_width*scale).ceil() as i32;let declared_h_px=(declared_height*scale).ceil() as i32;
 let requested:Physical=(wanted.0,wanted.1,wanted.2.max(declared_w_px),wanted.3.max(declared_h_px));
 let measured_w_px=(measured_width*scale).ceil() as i32;let measured_h_px=(measured_height*scale).ceil() as i32;
 // Probe below an observed fallback floor only when the declared floor permits
 // it. The real HWND response then decides whether that old measurement remains
 // valid. A query/accept at the floor itself is never mistaken for a decrease.
 if !was_shown{entry.probing_width=false;entry.probing_height=false;entry.pending_width=None;entry.pending_height=None;}
 else{
  if measured_w_px>0&&requested.2+1<measured_w_px||entry.pending_width.is_some(){entry.probing_width=true;}else{entry.probing_width=false;entry.pending_width=None;}
  if measured_h_px>0&&requested.3+1<measured_h_px||entry.pending_height.is_some(){entry.probing_height=true;}else{entry.probing_height=false;entry.pending_height=None;}
 }
 let declared_clamped=requested.2>wanted.2||requested.3>wanted.3;fresh|=declared_clamped;
  let same_layout=entry.last==Some((wanted,clip,actual,grip,occlusions.clone()));
  if entry.shown&&!zoomed&&!iconic&&!query_due&&!entry.probing_width&&!entry.probing_height&&entry.pending_width.is_none()&&entry.pending_height.is_none()&&same_layout{return Ok(fresh)}
  if entry.shown&&!entry.preserve_focus&&!same_layout{let _=ShowWindow(hwnd,SW_HIDE);entry.shown=false;}
  let positioned=if entry.shown{SetWindowPos(hwnd,None,wanted.0,wanted.1,requested.2,requested.3,SWP_NOACTIVATE|SWP_NOOWNERZORDER|SWP_NOZORDER)}else{SetWindowPos(hwnd,Some(HWND_TOP),wanted.0,wanted.1,requested.2,requested.3,SWP_NOACTIVATE|SWP_NOOWNERZORDER)};
  positioned.map_err(|e|e.to_string())?;
 let actual=rect(hwnd)?;let (refused_w,refused_h)=required_size(requested,actual);
 let mut floor_changed=fresh;let actual_css=(actual.2 as f64/scale,actual.3 as f64/scale);
 if was_shown{
  if refused_w{
   if entry.pending_width.is_some_and(|candidate|(candidate-actual.2).abs()<=1){entry.measured_width=Some(actual_css.0);entry.pending_width=None;entry.probing_width=false;floor_changed=true}else{entry.pending_width=Some(actual.2);entry.probing_width=true;}
  }else{
   let was_probe=entry.probing_width||entry.pending_width.is_some();entry.pending_width=None;
    if was_probe{if entry.measured_width.is_some_and(|floor|requested.2 as f64/scale+0.5<floor){entry.measured_width=None}floor_changed=true}
   entry.probing_width=false;
  }
  if refused_h{
   if entry.pending_height.is_some_and(|candidate|(candidate-actual.3).abs()<=1){entry.measured_height=Some(actual_css.1);entry.pending_height=None;entry.probing_height=false;floor_changed=true}else{entry.pending_height=Some(actual.3);entry.probing_height=true;}
  }else{
   let was_probe=entry.probing_height||entry.pending_height.is_some();entry.pending_height=None;
    if was_probe{if entry.measured_height.is_some_and(|floor|requested.3 as f64/scale+0.5<floor){entry.measured_height=None}floor_changed=true}
   entry.probing_height=false;
  }
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
 // Other cards with a higher DOM stacking rank cover this native HWND. Cut
 // those rectangles out of the native region so pixels and hit targets agree.
 for (x,y,width,height) in &occlusions{
  let hole_left=(x-actual.0).max(left);let hole_top=(y-actual.1).max(top);
  let hole_right=(x+width-actual.0).min(right);let hole_bottom=(y+height-actual.1).min(bottom);
  if hole_left<hole_right&&hole_top<hole_bottom{
   let cutout=CreateRectRgn(hole_left,hole_top,hole_right,hole_bottom);
   if cutout.0.is_null(){let _=DeleteObject(HGDIOBJ(region.0));return Err("Unable to reserve the overlapping widget area.".into())}
   if CombineRgn(Some(region),Some(region),Some(cutout),RGN_DIFF)==RGN_ERROR{let _=DeleteObject(HGDIOBJ(cutout.0));let _=DeleteObject(HGDIOBJ(region.0));return Err("Unable to reserve the overlapping widget area.".into())}
   let _=DeleteObject(HGDIOBJ(cutout.0));
  }
 }
 if SetWindowRgn(hwnd,Some(region),true)==0{let _=DeleteObject(HGDIOBJ(region.0));return Err("The app cannot fit this panel at its current Windows permission level.".into())}
 if let Some(viewport_right)=entry.viewport_right{
  let unsafe_edge=crate::native_panels::right_edge_is_unsafe(actual.0.saturating_add(actual.2),origin.x,viewport_right,scale);
  if unsafe_edge{if entry.shown{let _=ShowWindow(hwnd,SW_HIDE);}entry.shown=false;entry.edge_hidden=true;}else{entry.edge_hidden=false;}
 }
 entry.last=Some((wanted,clip,actual,grip,occlusions));let _=main;Ok(floor_changed)
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
  match protect_collected_window(entry){
   Ok(true)=>continue,
   Ok(false)=>{},
   Err(error)=>{entry.fresh=false;if entry.error!=error{entry.error=error.clone();let _=app.emit_to("main","app-panel-state",serde_json::json!({"id":id,"open":true,"error":error}));}continue}
  }
  let hwnd=handle(entry.hwnd);
  if !entry.visible||!parent{
   if entry.shown{unsafe{let _=ShowWindow(hwnd,SW_HIDE);}}
   entry.shown=false;entry.fresh=false;entry.declared_width=None;entry.declared_height=None;entry.measured_width=None;entry.measured_height=None;
   entry.pending_width=None;entry.pending_height=None;entry.probing_width=false;entry.probing_height=false;entry.minimum_dpi=None;entry.minimum_query_after=None;entry.last=None;
   continue
  }
  let positioned=(||{let mut fresh=position(entry,main,origin,scale)?;if !entry.shown&&!entry.edge_hidden{unsafe{let _=ShowWindow(hwnd,SW_SHOWNOACTIVATE);}entry.shown=true;fresh|=position(entry,main,origin,scale)?;}Ok::<bool,String>(fresh)})();
  match positioned{
   Ok(fresh)=>{entry.fresh=fresh;if !entry.error.is_empty(){entry.error.clear();let _=app.emit_to("main","app-panel-state",serde_json::json!({"id":id,"open":true,"error":null}));}}
   Err(error)=>{if entry.shown{unsafe{let _=ShowWindow(hwnd,SW_HIDE);}}entry.shown=false;entry.fresh=false;if entry.error!=error{entry.error=error.clone();let _=app.emit_to("main","app-panel-state",serde_json::json!({"id":id,"open":true,"error":error}));}}
  }
 }
}
pub(crate) fn ordered_windows(app:&AppHandle)->Option<Vec<(i64,usize)>>{app.state::<AppPanelState>().0.try_lock().ok().map(|s|s.items.values().filter(|e|e.shown&&valid_window(e)).map(|e|(e.stacking_rank,e.hwnd)).collect())}
pub(crate) fn refresh_state(app:&AppHandle){if let Ok(mut panels)=app.state::<AppPanelState>().0.try_lock(){place(app,&mut panels)}}
fn refresh_clipped_child(app:&AppHandle,child:HWND)->bool{
 let root=unsafe{GetAncestor(child,GA_ROOT)};if root.0.is_null()||root==child{return false}
 let state=app.state::<AppPanelState>();let Ok(mut panels)=state.0.try_lock()else{return false};
 let Some(entry)=panels.items.values_mut().find(|entry|entry.hwnd==root.0 as usize&&entry.pid==pid(root)&&entry.visible)else{return false};
 let Ok(main)=owner()else{return false};let mut origin=POINT::default();if !unsafe{ClientToScreen(main,&mut origin).as_bool()}{return false}
 let scale=unsafe{windows::Win32::UI::HiDpi::GetDpiForWindow(main)}.max(96) as f64/96.;let actual=match rect(root){Ok(r)=>r,Err(_)=>return false};
 let unsafe_edge=entry.viewport_right.is_some_and(|right|crate::native_panels::right_edge_is_unsafe(actual.0.saturating_add(actual.2),origin.x,right,scale));
 if unsafe_edge{if entry.shown{unsafe{let _=ShowWindow(root,SW_HIDE);}}entry.shown=false;entry.edge_hidden=true;entry.last=None;return true}
 let restore_edge=entry.edge_hidden;entry.edge_hidden=false;let shown=entry.shown;drop(panels);
 if restore_edge{crate::native_panels::refresh_all(app);return true}if !shown{return false}
 let _=crate::native_panels::refresh_clipped_child_region(root,child);
 true
}
unsafe extern "system" fn event(_:HWINEVENTHOOK,event:u32,hwnd:HWND,object:i32,child:i32,_:u32,_:u32){
 let Some(app)=APP.get()else{return};
 if event==EVENT_OBJECT_DESTROY&&object==0&&child==0{
  let dead=hwnd.0 as usize;
  if let Ok(mut s)=app.state::<AppPanelState>().0.try_lock(){remove_closed(app,&mut s,Some(dead))}
  else{let app=app.clone();tauri::async_runtime::spawn_blocking(move||{let state=app.state::<AppPanelState>();if let Ok(mut s)=state.0.lock(){remove_closed(&app,&mut s,Some(dead));};});}
 }
 if event==EVENT_SYSTEM_FOREGROUND{crate::shortcuts::refresh_editing(app.clone());crate::native_panels::invalidate_order();crate::native_panels::refresh_all(app);}
 if event==EVENT_OBJECT_LOCATIONCHANGE&&object==0&&child==0{
  if owner().ok()==Some(hwnd){crate::native_panels::refresh_all(app)}else if !refresh_clipped_child(app,hwnd)&&is_managed_foreground(app,hwnd){crate::native_panels::refresh_all(app)}
 }
}
pub fn install(app:&AppHandle)->Result<(),String>{
 let _=APP.set(app.clone());let main=app.get_window("main").ok_or("Still window is missing")?.hwnd().map_err(|e|e.to_string())?;
 OWNER.store(main.0 as usize,std::sync::atomic::Ordering::Relaxed);
 unsafe{for (a,b) in [(EVENT_SYSTEM_FOREGROUND,EVENT_SYSTEM_FOREGROUND),(EVENT_OBJECT_DESTROY,EVENT_OBJECT_LOCATIONCHANGE)]{if SetWinEventHook(a,b,None,Some(event),0,0,WINEVENT_OUTOFCONTEXT).0.is_null(){return Err("Unable to synchronize application panels".into())}}}Ok(())
}
fn release(app:&AppHandle,id:&str){if let Ok(mut s)=app.state::<AppPanelState>().0.lock(){*s.generation.entry(id.into()).or_default()+=1;s.pending.remove(id);if let Some(mut entry)=s.items.remove(id){clear_collection_marker(&mut entry);restore(&mut entry);}}}
pub fn shutdown(app:&AppHandle){let state=app.state::<AppPanelState>();if let Ok(mut s)=state.0.lock(){s.closed=true;s.pending.clear();for (_,mut entry) in s.items.drain(){restore(&mut entry);}};}

#[tauri::command]
pub async fn app_panel_suspend(app:AppHandle,webview:Webview,id:String,for_collection:Option<bool>)->Result<bool,String>{
 crate::browser::authorize(&webview)?;instance(&id)?;
 let state=app.state::<AppPanelState>();let mut panels=state.0.lock().map_err(|_|"App panels are unavailable")?;
 let Some(hwnd)=panels.items.get(&id).filter(|entry|valid_window(entry)).map(|entry|entry.hwnd)else{return Ok(false)};
 *panels.generation.entry(id.clone()).or_default()+=1;panels.pending.remove(&id);
 if unsafe{GetForegroundWindow()==handle(hwnd)}{if let Ok(main)=owner(){unsafe{let _=SetForegroundWindow(main);}}}
  if let Some(entry)=panels.items.get_mut(&id){
  if for_collection==Some(true){mark_collected(entry,&id)?;}
  else{unsafe{let _=ShowWindow(handle(hwnd),SW_HIDE);}entry.visible=false;entry.shown=false;entry.edge_hidden=false;entry.last=None;entry.revision=0;entry.fresh=false;}
 }
 drop(panels);crate::native_panels::apply_order(&app);Ok(true)
}

#[tauri::command]
pub async fn app_panel_resume(app:AppHandle,webview:Webview,id:String,cancel_collection:Option<bool>)->Result<Info,String>{
 crate::browser::authorize(&webview)?;instance(&id)?;let main=owner()?;
 let state=app.state::<AppPanelState>();let mut panels=state.0.lock().map_err(|_|"App panels are unavailable")?;
 if panels.items.get(&id).is_some_and(valid_window){
  if cancel_collection==Some(true){prepare_collection_resume(panels.items.get_mut(&id).unwrap(),true);place(&app,&mut panels);crate::native_panels::apply_order(&app);let entry=panels.items.get(&id).ok_or("The app window is no longer available. Reattach it from Apps.")?;return Ok(info(entry,main,false))}
  prepare_collection_resume(panels.items.get_mut(&id).unwrap(),false);
  let entry=panels.items.get(&id).ok_or("The app window is no longer available. Reattach it from Apps.")?;return Ok(info(entry,main,false))
 }
 if cancel_collection==Some(true){return Err("The collected app window could not be restored to its widget. Reattach it from Apps.".into())}
 panels.items.remove(&id);
 let mut candidates=collected_windows(&id).into_iter().filter(|candidate|{
  let target=handle(candidate.hwnd);
  unsafe{IsWindow(Some(target)).as_bool()&&pid(target)==candidate.pid&&candidate.pid!=std::process::id()&&GetAncestor(target,GA_ROOT)==target}
 }).collect::<Vec<_>>();
 if candidates.len()!=1{return Err(if candidates.is_empty(){"The collected app window is no longer available. It may have closed while Still was stopped. Use Attach open app to reconnect it.".into()}else{"More than one window matches this collected app. Use Attach open app to choose the correct window.".into()})}
 let candidate=candidates.pop().unwrap();let owner_property=unsafe{GetPropW(handle(candidate.hwnd),PCWSTR(marker().as_ptr()))};
 if !owner_property.0.is_null(){let previous_owner=handle(owner_property.0 as usize);if previous_owner!=main&&unsafe{IsWindow(Some(previous_owner)).as_bool()}{return Err("This app window is still managed by another Still window. Close that Still session before restoring it here.".into())}unsafe{let _=RemovePropW(handle(candidate.hwnd),PCWSTR(marker().as_ptr()));}}
 if panels.items.values().any(|entry|entry.hwnd==candidate.hwnd&&entry.pid==candidate.pid){return Err("This app window is already attached to another widget in Still.".into())}
 let initial=Bounds{x:0.,y:0.,width:640.,height:400.};let mut entry=attach(&candidate,String::new(),initial.clone(),initial,None,main,false)?;entry.collection_marker=Some(id.clone());
 let information=info(&entry,main,false);let token=collection_marker(&id);let _=unsafe{RemovePropW(handle(candidate.hwnd),PCWSTR(token.as_ptr()))};entry.collection_marker=None;entry.collection_was_visible=None;
 if let Some(mut replaced)=panels.items.insert(id,entry){restore(&mut replaced)}
 Ok(information)
}

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
      let mut entry=attach(candidate,source_id.clone(),bounds.clone(),clip.clone(),grip.clone(),main,false)?;
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
pub async fn app_panel_identity(app:AppHandle,webview:Webview,id:String)->Result<Option<AttachmentIdentity>,String>{
 crate::browser::authorize(&webview)?;instance(&id)?;
 tauri::async_runtime::spawn_blocking(move||{let state=app.state::<AppPanelState>();let panels=state.0.lock().map_err(|_|"App panels are unavailable")?;
  Ok(attachment_identity(panels.items.get(&id)))
 }).await.map_err(|e|e.to_string())?
}
#[tauri::command]
pub async fn app_panel_attach(app:AppHandle,webview:Webview,id:String,hwnd:usize,pid:u32,bounds:Bounds,clip:Bounds,grip:Option<Bounds>,preserve_focus:Option<bool>)->Result<Info,String>{
 crate::browser::authorize(&webview)?;instance(&id)?;bounds.validate()?;clip.validate()?;if let Some(grip)=&grip{grip.validate()?}
 let preserve_focus=preserve_focus.unwrap_or(false);
 tauri::async_runtime::spawn_blocking(move||{
  let state=app.state::<AppPanelState>();
  {let mut panels=state.0.lock().map_err(|_|"App panels unavailable")?;reserve_target(&mut panels,hwnd,pid)?;}
  let result=(||{
   let main=owner()?;
   let candidate=if preserve_focus{direct_candidate(hwnd,pid)?}else{windows().into_iter().find(|w|w.hwnd==hwnd&&w.pid==pid).ok_or("This window is no longer available. Refresh the app list.")?};
   let mut entry=attach(&candidate,String::new(),bounds,clip,grip,main,preserve_focus)?;
   let mut origin=POINT::default();if !unsafe{ClientToScreen(main,&mut origin).as_bool()}{restore(&mut entry);return Err("Still window is unavailable".into())}
   let scale=unsafe{windows::Win32::UI::HiDpi::GetDpiForWindow(main)}.max(96) as f64/96.;let measured=match position(&mut entry,main,origin,scale){Ok(measured)=>measured,Err(e)=>{restore(&mut entry);return Err(e)}};
   let information=info(&entry,main,measured);let mut panels=state.0.lock().map_err(|_|"App panels unavailable")?;
   if panels.closed{restore(&mut entry);return Err("Still is closing".into())}
   // The reservation also prevents concurrent capture/picker requests from
   // attaching this HWND to two widgets while geometry is being applied.
   if panels.items.values().any(|existing|existing.hwnd==hwnd&&existing.pid==pid){restore(&mut entry);return Err("This window is already attached in Still.".into())}
   *panels.generation.entry(id.clone()).or_default()+=1;panels.pending.remove(&id);
   if let Some(mut old)=panels.items.insert(id.clone(),entry){restore(&mut old)}
   drop(panels);
   if !preserve_focus{unsafe{let _=SetForegroundWindow(main);}}
   let _=app.emit_to("main","app-panel-state",serde_json::json!({"id":id,"open":true}));Ok(information)
  })();
  if let Ok(mut panels)=state.0.lock(){panels.attaching.remove(&(hwnd,pid));}
  if preserve_focus{match &result{Ok(_)=>eprintln!("[capture] stage=attach outcome=attached hwnd={hwnd} pid={pid}"),Err(error)=>eprintln!("[capture] stage=attach outcome=failed hwnd={hwnd} pid={pid}: {error}")}}
  result
 }).await.map_err(|e|e.to_string())?
}
#[tauri::command]
pub async fn app_panel_present(app:AppHandle,webview:Webview,id:String,bounds:Bounds,clip:Bounds,grip:Option<Bounds>,occlusions:Vec<Bounds>,viewport_right:f64,visible:bool,stacking_rank:i64,revision:u64)->Result<Info,String>{
 crate::browser::authorize(&webview)?;instance(&id)?;bounds.validate()?;clip.validate()?;if !viewport_right.is_finite()||!(-20000.0..=40000.0).contains(&viewport_right){return Err("Invalid Apps viewport edge".into())}if let Some(grip)=&grip{grip.validate()?}if occlusions.len()>256{return Err("Too many overlapping workspace widgets".into())}for item in &occlusions{item.validate()?}
 let state=app.state::<AppPanelState>();let mut s=state.0.lock().map_err(|_|"App panels unavailable")?;
  let entry=s.items.get_mut(&id).ok_or("The app was closed. Reopen it below.")?;
  if !valid_window(entry){s.items.remove(&id);return Err("The app was closed. Reopen it below.".into())}
 if protect_collected_window(entry)?{let main=owner()?;return Ok(info(entry,main,false))}
 if crate::native_panels::snapshot_is_stale(entry.revision,revision){let main=owner()?;return Ok(info(entry,main,entry.fresh))}
  if !visible&&!entry.preserve_focus&&belongs(unsafe{GetForegroundWindow()},entry.hwnd,entry.pid){if let Ok(main)=owner(){unsafe{let _=SetForegroundWindow(main);}}}
 let changed=entry.bounds!=bounds||entry.clip!=clip||entry.grip!=grip||entry.occlusions!=occlusions||entry.viewport_right!=Some(viewport_right);
 if changed&&entry.shown&&!entry.preserve_focus{unsafe{let _=ShowWindow(handle(entry.hwnd),SW_HIDE);}entry.shown=false;entry.last=None;}
 entry.bounds=bounds;entry.clip=clip;entry.grip=grip;entry.occlusions=occlusions;entry.viewport_right=Some(viewport_right);entry.visible=visible;entry.stacking_rank=stacking_rank;entry.revision=revision;
 place(&app,&mut s);
 let main=owner()?;let entry=s.items.get(&id).ok_or("The app was closed. Reopen it below.")?;let result=info(entry,main,entry.fresh);drop(s);crate::native_panels::apply_order(&app);Ok(result)
}
#[tauri::command]
pub async fn app_panel_release(app:AppHandle,webview:Webview,id:String)->Result<(),String>{crate::browser::authorize(&webview)?;instance(&id)?;release(&app,&id);crate::native_panels::apply_order(&app);Ok(())}

pub fn capture(app:&AppHandle,id:&str)->Result<Vec<u8>,String>{
 let state=app.state::<AppPanelState>();let panels=state.0.lock().map_err(|_|"App panels unavailable")?;
 let entry=panels.items.get(id).ok_or("Reopen the app before capturing")?;let main=owner()?;
 if !entry.shown||!entry.visible||!valid_window(entry)||!parent_context(&panels.items,main,app){return Err("Bring Still and this app panel to the front before capturing".into())}
 let (_, (x,y,w,h), _, _, _)=entry.last.as_ref().ok_or("The app is not positioned yet")?;let (x,y,w,h)=(*x,*y,*w,*h);
 if w<1||h<1||w as i64*h as i64>16000000{return Err("App capture is too large".into())}
 unsafe{
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
 #[test]fn direct_capture_identity_requires_the_same_live_external_hwnd_and_pid(){
  let current=std::process::id();
  assert!(exact_window_identity(42,7,42,7));
  assert!(!exact_window_identity(42,7,43,7),"A reused or changed HWND must not pass exact-target validation");
  assert!(!exact_window_identity(42,7,42,8),"A reused HWND owned by another process must not pass validation");
  assert!(!exact_window_identity(42,current,42,current),"Still's own process must never be captured");
  assert!(!exact_window_identity(0,7,0,7));
 }
 #[test]fn direct_capture_reserves_an_hwnd_pid_pair_to_prevent_duplicate_widgets(){
  let mut panels=Panels::default();
  reserve_target(&mut panels,42,7).unwrap();
  assert!(target_claimed(&panels,42,7));
  assert!(reserve_target(&mut panels,42,7).is_err());
  assert!(reserve_target(&mut panels,42,8).is_ok(),"A different PID is a different exact window identity");
  panels.attaching.remove(&(42,7));
  assert!(!target_claimed(&panels,42,7));
 }
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
 #[test]fn refreshing_a_window_region_preserves_its_shape(){unsafe{
  let target=Fixture::new("Still fixture region refresh");let original=CreateRectRgn(12,18,90,120);
  assert_ne!(original.0,std::ptr::null_mut());assert_ne!(SetWindowRgn(target.0,Some(original),true),0);
  // The shared coordinator can refresh a clipped region even when no child
  // moved outside it; use a small child to exercise the same native region
  // ownership transfer as the event path.
  let class=wide("STATIC");let title=wide("Still fixture region child");
  let child=CreateWindowExW(WINDOW_EX_STYLE(0),PCWSTR(class.as_ptr()),PCWSTR(title.as_ptr()),WS_CHILD|WS_VISIBLE,30,30,20,20,Some(target.0),None,None,None).unwrap();
  SetWindowPos(child,Some(HWND_TOP),140,30,20,20,SWP_NOACTIVATE).unwrap();
  assert!(crate::native_panels::refresh_clipped_child_region(target.0,child));
  let copied=CreateRectRgn(0,0,0,0);assert_eq!(GetWindowRgn(target.0,copied),SIMPLEREGION);
  let mut bounds=RECT::default();assert!(GetRgnBox(copied,&mut bounds).0>=0);
  assert_eq!((bounds.left,bounds.top,bounds.right,bounds.bottom),(12,18,90,120));let _=DeleteObject(HGDIOBJ(copied.0));
 }}
 #[test]fn child_window_crossing_a_clipped_edge_is_detected_for_region_refresh(){unsafe{
  let parent=Fixture::new("Still fixture clipped parent");let class=wide("STATIC");let title=wide("Still fixture child");
  let child=CreateWindowExW(WINDOW_EX_STYLE(0),PCWSTR(class.as_ptr()),PCWSTR(title.as_ptr()),WS_CHILD|WS_VISIBLE,-30,40,100,90,Some(parent.0),None,None,None).unwrap();
  let region=CreateRectRgn(40,0,820,500);assert_ne!(SetWindowRgn(parent.0,Some(region),true),0);
  assert!(crate::native_panels::refresh_clipped_child_region(parent.0,child));
  SetWindowPos(child,Some(HWND_TOP),100,40,100,90,SWP_NOACTIVATE).unwrap();
  assert!(!crate::native_panels::refresh_clipped_child_region(parent.0,child));let _=DestroyWindow(child);
 }}
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
 #[test]fn app_widget_identity_exposes_only_a_live_attached_hwnd_and_pid(){
  let fixture=Fixture::new("Still app identity fixture");let id=fixture.0.0 as usize;let process=pid(fixture.0);let bounds=Bounds{x:0.,y:0.,width:640.,height:400.};let mut entry=test_entry(id,&bounds);entry.pid=process;
  assert_eq!(attachment_identity(Some(&entry)).map(|identity|(identity.hwnd,identity.pid)),Some((id,process)));
  drop(fixture);assert!(attachment_identity(Some(&entry)).is_none(),"A closed app cannot be turned into a new saved shortcut");
 }
  #[test]fn collected_window_marker_is_scoped_to_widget_and_survives_release_without_saving_hwnd_or_pid(){unsafe{
  let target=Fixture::new("Still collected app recovery fixture");let id="fixture-collected-app";
  let token=collection_marker(id);let other=collection_marker("another-widget");
  SetPropW(target.0,PCWSTR(token.as_ptr()),Some(HANDLE(1usize as *mut _))).unwrap();
  SetPropW(target.0,PCWSTR(marker().as_ptr()),Some(HANDLE(2usize as *mut _))).unwrap();
  let matches=collected_windows(id);assert_eq!(matches.iter().map(|item|item.hwnd).collect::<Vec<_>>(),[target.0.0 as usize]);
  assert!(collected_windows("another-widget").is_empty(),"A sibling widget must not recover this app window");
  assert!(GetPropW(target.0,PCWSTR(other.as_ptr())).0.is_null());
  let mut entry=test_entry(target.0.0 as usize,&Bounds{x:0.,y:0.,width:640.,height:400.});entry.original_visible=true;entry.collection_marker=Some(id.into());
  restore(&mut entry);
  assert!(IsWindowVisible(target.0).as_bool(),"Still shutdown leaves the external process visible on the desktop");
  assert!(GetPropW(target.0,PCWSTR(marker().as_ptr())).0.is_null(),"Release restores ordinary ownership");
  assert!(!GetPropW(target.0,PCWSTR(token.as_ptr())).0.is_null(),"The collected association remains available after Still shuts down");
  clear_collection_marker(&mut entry);
   assert!(GetPropW(target.0,PCWSTR(token.as_ptr())).0.is_null(),"Restoring the Group entry consumes its transient OS association");
  }}
  #[test]fn collected_app_stays_hidden_through_late_present_and_restores_same_window(){unsafe{
   let target=Fixture::new("Still collected app visibility fixture");let id="fixture-collected-visibility";
   let _=ShowWindow(target.0,SW_SHOWNOACTIVATE);assert!(IsWindowVisible(target.0).as_bool());
   let bounds=Bounds{x:0.,y:0.,width:640.,height:400.};let mut entry=test_entry(target.0.0 as usize,&bounds);entry.revision=73;entry.pid=pid(target.0);entry.original_visible=true;
   let expected_hwnd=entry.hwnd;let expected_pid=entry.pid;
   mark_collected(&mut entry,id).unwrap();
   assert!(!IsWindowVisible(target.0).as_bool(),"Collection must hide the exact native window");
   assert!(!GetPropW(target.0,PCWSTR(collection_marker(id).as_ptr())).0.is_null(),"The same per-widget marker remains available for recovery");
   assert_eq!(entry.revision,73,"Collection must not reset the monotonic revision");

   // Simulate a late visible presentation arriving after the collection hide.
   let _=ShowWindow(target.0,SW_SHOWNOACTIVATE);assert!(IsWindowVisible(target.0).as_bool());
   for _revision in [1,73,74]{assert!(protect_collected_window(&mut entry).unwrap(),"Collection rejects stale, equal and newer snapshots");assert!(!IsWindowVisible(target.0).as_bool(),"The late presentation path must actively hide the HWND");assert!(!entry.visible);assert_eq!(entry.revision,73);assert_eq!(entry.bounds,bounds,"A late snapshot must not overwrite collected geometry");let _=ShowWindow(target.0,SW_SHOWNOACTIVATE);}

   // Layout/foreground refresh shares this same native visibility guard.
   let _=ShowWindow(target.0,SW_SHOWNOACTIVATE);assert!(protect_collected_window(&mut entry).unwrap());
   assert!(!IsWindowVisible(target.0).as_bool());

   prepare_collection_resume(&mut entry,false);
   assert!(GetPropW(target.0,PCWSTR(collection_marker(id).as_ptr())).0.is_null(),"Explicit Group reopen releases collection ownership");
   assert!(!IsWindowVisible(target.0).as_bool(),"Restore waits for a fresh visible presentation");
   entry.visible=true;entry.revision=1;
   assert!(IsWindow(Some(target.0)).as_bool());let _=ShowWindow(target.0,SW_SHOWNOACTIVATE);
   assert!(IsWindowVisible(target.0).as_bool());
   assert!(valid_window(&entry));assert_eq!((entry.hwnd,entry.pid),(expected_hwnd,expected_pid),"Restoration keeps the original HWND/PID");
   for _ in 0..2{mark_collected(&mut entry,id).unwrap();assert!(!IsWindowVisible(target.0).as_bool());prepare_collection_resume(&mut entry,false);entry.visible=true;let _=ShowWindow(target.0,SW_SHOWNOACTIVATE);assert!(IsWindowVisible(target.0).as_bool());}
   assert!(IsWindow(Some(target.0)).as_bool(),"Collection and restoration must not close the app window");
  }}
  #[test]fn cancelled_collection_restores_original_visibility_without_losing_the_widget(){unsafe{
   let target=Fixture::new("Still cancelled collection visibility fixture");let _=ShowWindow(target.0,SW_SHOWNOACTIVATE);
   let bounds=Bounds{x:0.,y:0.,width:640.,height:400.};let mut entry=test_entry(target.0.0 as usize,&bounds);entry.pid=pid(target.0);entry.original_visible=true;
   mark_collected(&mut entry,"fixture-cancelled-collection").unwrap();assert!(!IsWindowVisible(target.0).as_bool());
   prepare_collection_resume(&mut entry,true);
   assert!(entry.visible,"Cancellation restores the prior widget visibility");
   let _=ShowWindow(target.0,SW_SHOWNOACTIVATE);assert!(IsWindowVisible(target.0).as_bool());
   assert!(IsWindow(Some(target.0)).as_bool());
  }}
 unsafe extern "system" fn minimum_fixture_proc(hwnd:HWND,message:u32,wparam:windows::Win32::Foundation::WPARAM,lparam:LPARAM)->windows::Win32::Foundation::LRESULT{
   if message==WM_GETMINMAXINFO{let minimum=&mut *(lparam.0 as *mut MINMAXINFO);minimum.ptMinTrackSize=POINT{x:900,y:600};return windows::Win32::Foundation::LRESULT(0)}
   if message==WM_WINDOWPOSCHANGING{let position=&mut *(lparam.0 as *mut WINDOWPOS);if position.cx<900{position.cx=900}if position.cy<600{position.cy=600};return windows::Win32::Foundation::LRESULT(0)}
   DefWindowProcW(hwnd,message,wparam,lparam)
  }
  #[test]fn declared_minimum_is_physical_and_a_floor_equal_to_the_declaration_is_never_cleared(){unsafe{
   let class=wide("StillMinimumSizeFixture");let instance=windows::Win32::Foundation::HINSTANCE(windows::Win32::System::LibraryLoader::GetModuleHandleW(None).unwrap().0);
   let definition=WNDCLASSW{lpfnWndProc:Some(minimum_fixture_proc),hInstance:instance,lpszClassName:PCWSTR(class.as_ptr()),..Default::default()};assert_ne!(RegisterClassW(&definition),0);
   let hwnd=CreateWindowExW(WINDOW_EX_STYLE(0),PCWSTR(class.as_ptr()),PCWSTR(class.as_ptr()),WS_OVERLAPPEDWINDOW,0,0,1600,1000,None,None,Some(instance),None).unwrap();let target=Fixture(hwnd);let main=Fixture::new("Still minimum owner");
   let bounds=Bounds{x:10.,y:20.,width:1000.,height:700.};let mut entry=test_entry(hwnd.0 as usize,&bounds);
   position(&mut entry,main.0,POINT{x:0,y:0},1.0).unwrap();
   assert_eq!((entry.declared_width,entry.declared_height),(Some(900.),Some(600.)));
   assert_eq!((info_at(&entry,1.5,true).required_width,info_at(&entry,1.5,true).required_height),(Some(900.),Some(600.)),"Required minima are CSS values and do not get divided by main scale");
   entry.bounds.width=200.;entry.bounds.height=100.;for _ in 0..5{position(&mut entry,main.0,POINT{x:0,y:0},1.0).unwrap();}
   assert_eq!((entry.declared_width,entry.declared_height),(Some(900.),Some(600.)),"Acceptance at the declared floor must never clear the declared floor");
   assert_eq!((entry.measured_width,entry.measured_height),(None,None));
   let size=rect(hwnd).unwrap();assert_eq!((size.2,size.3),(900,600));
   drop(target);assert!(UnregisterClassW(PCWSTR(class.as_ptr()),Some(instance)).is_ok());
  }}
 // A fresh Entry wired to a fixture window, with the PHYSICAL floor storage.
  fn test_entry(hwnd:usize,bounds:&Bounds)->Entry{Entry{hwnd,pid:std::process::id(),source_id:"test-app".into(),bounds:bounds.clone(),clip:bounds.clone(),grip:None,occlusions:Vec::new(),viewport_right:None,visible:true,shown:true,edge_hidden:false,preserve_focus:false,collection_marker:None,collection_was_visible:None,stacking_rank:0,revision:0,resize_guard:None,original_owner:0,original_placement:WINDOWPLACEMENT{length:std::mem::size_of::<WINDOWPLACEMENT>() as u32,..Default::default()},original_region:0,original_visible:false,declared_width:None,declared_height:None,measured_width:None,measured_height:None,pending_width:None,pending_height:None,probing_width:false,probing_height:false,minimum_dpi:None,minimum_query_after:None,fresh:false,last:None,error:String::new()}}
 unsafe fn class_window(class:&[u16],proc:unsafe extern "system" fn(HWND,u32,windows::Win32::Foundation::WPARAM,LPARAM)->windows::Win32::Foundation::LRESULT,title:&str)->(HWND,windows::Win32::Foundation::HINSTANCE){
  let instance=windows::Win32::Foundation::HINSTANCE(windows::Win32::System::LibraryLoader::GetModuleHandleW(None).unwrap().0);
  let definition=WNDCLASSW{lpfnWndProc:Some(proc),hInstance:instance,lpszClassName:PCWSTR(class.as_ptr()),..Default::default()};assert_ne!(RegisterClassW(&definition),0);
  let title=wide(title);
  let hwnd=CreateWindowExW(WINDOW_EX_STYLE(0),PCWSTR(class.as_ptr()),PCWSTR(title.as_ptr()),WS_OVERLAPPEDWINDOW,0,0,1600,1000,None,None,Some(instance),None).unwrap();
  (hwnd,instance)
 }
  unsafe extern "system" fn no_declared_clamp_proc(hwnd:HWND,message:u32,wparam:windows::Win32::Foundation::WPARAM,lparam:LPARAM)->windows::Win32::Foundation::LRESULT{
   if message==WM_GETMINMAXINFO{return windows::Win32::Foundation::LRESULT(0)}
   if message==WM_WINDOWPOSCHANGING{let position=&mut *(lparam.0 as *mut WINDOWPOS);if position.cx<900{position.cx=900}if position.cy<600{position.cy=600};return windows::Win32::Foundation::LRESULT(0)}
   DefWindowProcW(hwnd,message,wparam,lparam)
  }
  static C2_ACCEPT_SMALLER:std::sync::atomic::AtomicBool=std::sync::atomic::AtomicBool::new(false);
  unsafe extern "system" fn c2_clamping_proc(hwnd:HWND,message:u32,wparam:windows::Win32::Foundation::WPARAM,lparam:LPARAM)->windows::Win32::Foundation::LRESULT{
   if message==WM_GETMINMAXINFO{return windows::Win32::Foundation::LRESULT(0)}
   if message==WM_WINDOWPOSCHANGING&&!C2_ACCEPT_SMALLER.load(std::sync::atomic::Ordering::Relaxed){let position=&mut *(lparam.0 as *mut WINDOWPOS);if position.cx<900{position.cx=900}if position.cy<600{position.cy=600};return windows::Win32::Foundation::LRESULT(0)}
   DefWindowProcW(hwnd,message,wparam,lparam)
  }
  unsafe extern "system" fn no_minimum_proc(hwnd:HWND,message:u32,wparam:windows::Win32::Foundation::WPARAM,lparam:LPARAM)->windows::Win32::Foundation::LRESULT{
   if message==WM_GETMINMAXINFO{windows::Win32::Foundation::LRESULT(0)}else{DefWindowProcW(hwnd,message,wparam,lparam)}
  }
  #[test]fn c1_a_maximized_first_sample_never_becomes_the_floor(){unsafe{
   let class=wide("StillC1MaximizedFixture");let (hwnd,instance)=class_window(&class,no_declared_clamp_proc,"Still C1 fixture");
   let target=Fixture(hwnd);let main=Fixture::new("Still C1 owner");
   let _=ShowWindow(hwnd,SW_MAXIMIZE);assert!(IsZoomed(hwnd).as_bool());
   let maximized=rect(hwnd).unwrap();assert!(maximized.2>900&&maximized.3>600,"The fixture must be maximized larger than the app minimum");
   let bounds=Bounds{x:10.,y:20.,width:400.,height:250.};let mut entry=test_entry(hwnd.0 as usize,&bounds);
   let measured=position(&mut entry,main.0,POINT{x:0,y:0},1.5).unwrap();
   assert!(!IsZoomed(hwnd).as_bool(),"position() must restore a maximized window before sampling");
   assert_eq!(entry.declared_width,None,"This fixture does not declare a WM minimum");
   assert_eq!(entry.measured_width,None,"One post-restore refusal is only a pending sample");
   position(&mut entry,main.0,POINT{x:0,y:0},1.5).unwrap();
   assert_eq!((entry.measured_width,entry.measured_height),(Some(600.),Some(400.)));
   let size=rect(hwnd).unwrap();assert_eq!((size.2,size.3),(900,600));
   let reported=info_at(&entry,1.5,measured);
   assert_eq!((reported.required_width,reported.required_height),(Some(600.),Some(400.)),"The monitor-sized maximized rect must not become the measured floor");
   assert_ne!(reported.required_width,Some(maximized.2 as f64/1.5),"The maximized monitor size must never be latched as a minimum");
   drop(target);assert!(UnregisterClassW(PCWSTR(class.as_ptr()),Some(instance)).is_ok());
  }}
  #[test]fn c1_a_hidden_first_sample_does_not_latch_the_launch_rect(){unsafe{
   let class=wide("StillC1HiddenFixture");let(hwnd,instance)=class_window(&class,no_declared_clamp_proc,"Still C1 hidden fixture");let target=Fixture(hwnd);let main=Fixture::new("Still C1 hidden owner");
   let bounds=Bounds{x:0.,y:0.,width:300.,height:200.};let mut entry=test_entry(hwnd.0 as usize,&bounds);entry.shown=false;let _=ShowWindow(hwnd,SW_HIDE);
   position(&mut entry,main.0,POINT{x:0,y:0},1.0).unwrap();
    assert_eq!((entry.declared_width,entry.measured_width,entry.pending_width),(None,None,None),"Hidden/initializing window geometry must not become a floor");assert!(!IsWindowVisible(hwnd).as_bool());
   let _=ShowWindow(hwnd,SW_SHOWNOACTIVATE);entry.shown=true;
   position(&mut entry,main.0,POINT{x:0,y:0},1.0).unwrap();position(&mut entry,main.0,POINT{x:0,y:0},1.0).unwrap();
   assert_eq!((entry.measured_width,entry.measured_height),(Some(900.),Some(600.)));
    drop(target);assert!(UnregisterClassW(PCWSTR(class.as_ptr()),Some(instance)).is_ok());
  }}
  #[test]fn c2_a_persistently_clamping_app_keeps_its_floor_until_a_real_probe_is_accepted(){unsafe{
   C2_ACCEPT_SMALLER.store(false,std::sync::atomic::Ordering::Relaxed);
   let class=wide("StillC2DecreaseFixture");let (hwnd,instance)=class_window(&class,c2_clamping_proc,"Still C2 fixture");
   let target=Fixture(hwnd);let main=Fixture::new("Still C2 owner");
   let bounds=Bounds{x:0.,y:0.,width:200.,height:134.};let mut entry=test_entry(hwnd.0 as usize,&bounds);
   position(&mut entry,main.0,POINT{x:0,y:0},1.5).unwrap();
   assert_eq!(entry.pending_width,Some(900),"A first refusal only arms the two-pass confirmation");assert_eq!(entry.measured_width,None);
   position(&mut entry,main.0,POINT{x:0,y:0},1.5).unwrap();
   assert_eq!((entry.measured_width,entry.measured_height),(Some(600.),Some(400.)),"A second identical refusal confirms the CSS floor");
   for _ in 0..6{position(&mut entry,main.0,POINT{x:0,y:0},1.5).unwrap();}
   assert_eq!((entry.measured_width,entry.measured_height),(Some(600.),Some(400.)),"A still-enforcing app must not oscillate by clearing its floor when it accepts that same floor");
   C2_ACCEPT_SMALLER.store(true,std::sync::atomic::Ordering::Relaxed);
   position(&mut entry,main.0,POINT{x:0,y:0},1.5).unwrap();
   assert_eq!((entry.measured_width,entry.measured_height),(None,None),"A real probe accepted below the old floor clears the measured fallback");
   let size=rect(hwnd).unwrap();assert_eq!((size.2,size.3),(300,201),"The accepted smaller size is preserved");
   drop(target);assert!(UnregisterClassW(PCWSTR(class.as_ptr()),Some(instance)).is_ok());
  }}
  #[test]fn c3_a_failed_minimum_query_is_not_stamped_and_retries_after_backoff(){
   let bounds=Bounds{x:0.,y:0.,width:800.,height:500.};let mut entry=test_entry(0,&bounds);let dpi=(96,96);let now=std::time::Instant::now();
   assert!(minimum_query_due(&entry,dpi,false,now));assert!(!record_minimum_query(&mut entry,dpi,None,now));
   assert_eq!(entry.minimum_dpi,None,"A timeout must not stamp the DPI");assert!(!minimum_query_due(&entry,dpi,false,now+std::time::Duration::from_millis(500)));
   assert!(minimum_query_due(&entry,dpi,false,now+std::time::Duration::from_secs(1)));
   assert!(record_minimum_query(&mut entry,dpi,Some((Some(600.),Some(400.))),now+std::time::Duration::from_secs(1)));
   assert_eq!(entry.minimum_dpi,Some(dpi));assert_eq!((entry.declared_width,entry.declared_height),(Some(600.),Some(400.)));
  }
  #[test]fn c4_a_window_that_never_declares_a_minimum_gets_no_fabricated_floor(){unsafe{
   let class=wide("StillC4NoMinimumFixture");let(hwnd,instance)=class_window(&class,no_minimum_proc,"Still C4 fixture");let target=Fixture(hwnd);let main=Fixture::new("Still C4 owner");
   assert_eq!(tracking_minimum(hwnd),Some((None,None)),"A delivered all-zero WM_GETMINMAXINFO means no declared minimum");
   let bounds=Bounds{x:0.,y:0.,width:300.,height:200.};let mut entry=test_entry(hwnd.0 as usize,&bounds);
   position(&mut entry,main.0,POINT{x:0,y:0},1.0).unwrap();
   assert_eq!((entry.declared_width,entry.declared_height,entry.measured_width,entry.measured_height),(None,None,None,None));
    drop(target);assert!(UnregisterClassW(PCWSTR(class.as_ptr()),Some(instance)).is_ok());
  }}
  #[test]fn c5_target_physical_tracking_minimum_converts_to_css_using_target_dpi(){
   assert_eq!(physical_to_css(900,144),Some(600.));assert_eq!(physical_to_css(1200,192),Some(600.));assert_eq!(physical_to_css(0,144),None);
   let bounds=Bounds{x:0.,y:0.,width:400.,height:250.};let mut entry=test_entry(0,&bounds);entry.declared_width=Some(600.);entry.declared_height=Some(400.);
   assert_eq!(info_at(&entry,1.0,true).required_width,Some(600.));assert_eq!(info_at(&entry,2.0,true).required_width,Some(600.));
  }
 #[test]fn real_window_fixture_tracks_bounds_clips_native_content_and_releases_without_closing(){unsafe{
  let main=Fixture::new("Still fixture owner");let target=Fixture::new("Still fixture app");let original=rect(target.0).unwrap();let original_style=GetWindowLongPtrW(target.0,GWL_STYLE);
  let mut original_placement=WINDOWPLACEMENT{length:std::mem::size_of::<WINDOWPLACEMENT>() as u32,..Default::default()};GetWindowPlacement(target.0,&mut original_placement).unwrap();
  let bounds=Bounds{x:100.,y:140.,width:800.,height:500.};let clip=Bounds{x:130.,y:160.,width:700.,height:450.};let grip=Bounds{x:798.,y:578.,width:32.,height:32.};
   let mut entry=test_entry(target.0.0 as usize,&bounds);entry.clip=clip.clone();entry.grip=Some(grip);entry.original_placement=original_placement;
  SetWindowLongPtrW(target.0,GWLP_HWNDPARENT,main.0.0 as isize);SetPropW(target.0,PCWSTR(marker().as_ptr()),Some(HANDLE(main.0.0))).unwrap();
  entry.resize_guard=Some(crate::native_resize::NativeResizeGuard::install(target.0).unwrap());assert_eq!(GetWindowLongPtrW(target.0,GWL_STYLE)&WS_THICKFRAME.0 as isize,0);
  position(&mut entry,main.0,POINT{x:30,y:20},1.5).unwrap();assert_eq!(rect(target.0).unwrap(),(180,230,1200,750));
  let region=CreateRectRgn(0,0,0,0);assert_ne!(GetWindowRgn(target.0,region),RGN_ERROR);let mut box_rect=RECT::default();GetRgnBox(region,&mut box_rect);assert_eq!((box_rect.left,box_rect.top,box_rect.right,box_rect.bottom),(45,30,1095,705));
  assert!(!PtInRegion(region,1070,680).as_bool(),"The native window must leave Still's resize grip uncovered");assert!(PtInRegion(region,1020,680).as_bool(),"App content outside the resize grip must remain visible");let _=DeleteObject(HGDIOBJ(region.0));
  entry.bounds.x=220.;position(&mut entry,main.0,POINT{x:30,y:20},1.5).unwrap();assert_eq!(rect(target.0).unwrap().0,360);
  restore(&mut entry);assert_eq!(GetWindowLongPtrW(target.0,GWL_STYLE),original_style);assert!(IsWindow(Some(target.0)).as_bool());assert_eq!(GetWindowLongPtrW(target.0,GWLP_HWNDPARENT),0);assert_eq!(rect(target.0).unwrap(),original);assert!(!IsWindowVisible(target.0).as_bool());
  assert!(GetPropW(target.0,PCWSTR(marker().as_ptr())).0.is_null());
  drop(target);assert!(!valid_window(&entry),"A closed app window must be rejected instead of retaining an attached card");
 }}
}
