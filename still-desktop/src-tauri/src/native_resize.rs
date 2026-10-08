//! Managed surfaces have one size owner: the Still widget, not an independent
//! Windows non-client resize loop. Programmatic SetWindowPos remains available.
use windows::Win32::{Foundation::HWND,UI::WindowsAndMessaging::*};

pub struct NativeResizeGuard {hwnd:usize,pid:u32,original_resize:bool,active:bool}
impl NativeResizeGuard {
 pub fn install(hwnd:HWND)->Result<Self,String>{
  unsafe{
   if !IsWindow(Some(hwnd)).as_bool(){return Err("The app closed before resize controls could be attached.".into())}
   let mut pid=0;GetWindowThreadProcessId(hwnd,Some(&mut pid));
   let style=GetWindowLongPtrW(hwnd,GWL_STYLE);
   let mut guard=Self{hwnd:hwnd.0 as usize,pid,original_resize:style&WS_THICKFRAME.0 as isize!=0,active:true};
   if guard.original_resize{
    SetWindowLongPtrW(hwnd,GWL_STYLE,style&!(WS_THICKFRAME.0 as isize));
    if GetWindowLongPtrW(hwnd,GWL_STYLE)&WS_THICKFRAME.0 as isize!=0{guard.restore();return Err("Windows could not disable the app's independent resize border. Run both apps at the same permission level.".into())}
    if let Err(error)=frame_changed(hwnd){guard.restore();return Err(format!("The app's managed resize border could not be applied: {error}"))}
   }
   Ok(guard)
  }
 }
 pub fn restore(&mut self){unsafe{
  if !self.active{return}self.active=false;
  let hwnd=HWND(self.hwnd as *mut _);let mut pid=0;GetWindowThreadProcessId(hwnd,Some(&mut pid));
  if !IsWindow(Some(hwnd)).as_bool()||pid!=self.pid{return}
  let style=GetWindowLongPtrW(hwnd,GWL_STYLE);
  let restored=if self.original_resize{style|WS_THICKFRAME.0 as isize}else{style&!(WS_THICKFRAME.0 as isize)};
  if restored!=style{SetWindowLongPtrW(hwnd,GWL_STYLE,restored);let _=frame_changed(hwnd);}
 }}
}
impl Drop for NativeResizeGuard{fn drop(&mut self){self.restore()}}
unsafe fn frame_changed(hwnd:HWND)->windows::core::Result<()>{
 SetWindowPos(hwnd,None,0,0,0,0,SWP_FRAMECHANGED|SWP_NOMOVE|SWP_NOSIZE|SWP_NOZORDER|SWP_NOOWNERZORDER|SWP_NOACTIVATE)
}

#[cfg(test)]mod tests{
 use super::*;
 use windows::{core::PCWSTR,Win32::{Foundation::{HINSTANCE,LPARAM,LRESULT,RECT,WPARAM},System::LibraryLoader::GetModuleHandleW}};
 fn wide(value:&str)->Vec<u16>{value.encode_utf16().chain(Some(0)).collect()}
 unsafe extern "system" fn fixture_proc(hwnd:HWND,message:u32,wparam:WPARAM,lparam:LPARAM)->LRESULT{DefWindowProcW(hwnd,message,wparam,lparam)}
 #[test]fn managed_resize_blocks_edge_hit_testing_but_allows_still_sizes_and_restores_on_release(){unsafe{
  let name=wide("StillManagedResizeFixture");let module=GetModuleHandleW(None).unwrap();let instance=HINSTANCE(module.0);
  let class=WNDCLASSW{lpfnWndProc:Some(fixture_proc),hInstance:instance,lpszClassName:PCWSTR(name.as_ptr()),..Default::default()};assert_ne!(RegisterClassW(&class),0);
  let window=CreateWindowExW(WINDOW_EX_STYLE(0),PCWSTR(name.as_ptr()),PCWSTR(name.as_ptr()),WS_OVERLAPPEDWINDOW,100,100,800,600,None,None,Some(instance),None).unwrap();
  let original=GetWindowLongPtrW(window,GWL_STYLE);let front=GetForegroundWindow();
  fn right_hit(window:HWND)->isize{unsafe{let mut r=RECT::default();GetWindowRect(window,&mut r).unwrap();let x=r.right-2;let y=(r.top+r.bottom)/2;SendMessageW(window,WM_NCHITTEST,Some(WPARAM(0)),Some(LPARAM(((y as u32&0xffff)<<16|(x as u32&0xffff)) as isize))).0}}
  assert_eq!(right_hit(window),HTRIGHT as isize);
  let mut guard=NativeResizeGuard::install(window).unwrap();assert_eq!(GetWindowLongPtrW(window,GWL_STYLE)&WS_THICKFRAME.0 as isize,0);assert_ne!(right_hit(window),HTRIGHT as isize);assert_eq!(GetForegroundWindow(),front);
  for scale in [1.,1.25,1.5,2.]{
   let width=(640.*scale) as i32;let height=(420.*scale) as i32;
   SetWindowPos(window,None,100,100,width,height,SWP_NOACTIVATE|SWP_NOZORDER).unwrap();
   let mut rect=RECT::default();GetWindowRect(window,&mut rect).unwrap();assert_eq!((rect.right-rect.left,rect.bottom-rect.top),(width,height));
   assert_ne!(right_hit(window),HTRIGHT as isize);
  }
  guard.restore();assert_eq!(GetWindowLongPtrW(window,GWL_STYLE),original);assert_eq!(right_hit(window),HTRIGHT as isize);assert!(IsWindow(Some(window)).as_bool());
  // Already fixed-size apps must not acquire a new resize capability on detach.
  SetWindowLongPtrW(window,GWL_STYLE,original&!(WS_THICKFRAME.0 as isize));frame_changed(window).unwrap();let fixed=GetWindowLongPtrW(window,GWL_STYLE);
  drop(NativeResizeGuard::install(window).unwrap());assert_eq!(GetWindowLongPtrW(window,GWL_STYLE),fixed);
  DestroyWindow(window).unwrap();UnregisterClassW(PCWSTR(name.as_ptr()),Some(instance)).unwrap();
 }}
}
