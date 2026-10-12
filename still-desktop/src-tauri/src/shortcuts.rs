use serde::Deserialize;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, Webview};

#[derive(Clone, Debug, Deserialize, PartialEq)]
pub struct Shortcut { key: String, ctrl: bool, alt: bool, shift: bool }
#[derive(Clone, Debug, Deserialize)]
pub struct WorkspaceShortcuts { up: Shortcut, down: Shortcut }
impl Default for WorkspaceShortcuts {
    fn default() -> Self {
        Self {
            up: Shortcut { key: "W".into(), ctrl: false, alt: true, shift: false },
            down: Shortcut { key: "S".into(), ctrl: false, alt: true, shift: false },
        }
    }
}
#[derive(Default)]
struct ShortcutConfig { shortcuts: WorkspaceShortcuts, enabled: bool }
#[derive(Default)]
pub struct ShortcutState(Mutex<ShortcutConfig>);

fn virtual_key(key: &str) -> Option<u32> {
    if key.len() == 1 && key.bytes().all(|c| c.is_ascii_uppercase() || c.is_ascii_digit()) {
        return Some(key.as_bytes()[0] as u32);
    }
    match key {
        "ArrowUp" => Some(0x26), "ArrowDown" => Some(0x28),
        "ArrowLeft" => Some(0x25), "ArrowRight" => Some(0x27),
        "Home" => Some(0x24), "End" => Some(0x23),
        "PageUp" => Some(0x21), "PageDown" => Some(0x22), _ => None,
    }
}
fn validate(shortcuts: &WorkspaceShortcuts) -> Result<(), String> {
    for shortcut in [&shortcuts.up, &shortcuts.down] {
        if (!shortcut.alt && !shortcut.ctrl && !shortcut.shift) || virtual_key(&shortcut.key).is_none() {
            return Err("Include Alt, Ctrl or Shift with a letter, number, or navigation key".into());
        }
        if shortcut.ctrl && !shortcut.alt && !shortcut.shift
            && ((shortcut.key.len() == 1 && "123456789ACFKLNPRSTVWXYZ".contains(&shortcut.key))) {
            return Err("That shortcut is reserved for editing, browsing, or workspace actions".into());
        }
        if shortcut.alt && !shortcut.ctrl && !shortcut.shift
            && ["ArrowLeft", "ArrowRight", "D"].contains(&shortcut.key.as_str()) {
            return Err("That shortcut is reserved for browser navigation".into());
        }
    }
    if shortcuts.up == shortcuts.down { return Err("Use different shortcuts for moving up and down".into()); }
    Ok(())
}
fn overview_toggle(key:u32,ctrl:bool,alt:bool,shift:bool,editing:bool)->bool{
    key==b'M' as u32&&ctrl&&!alt&&!shift&&!editing
}
impl ShortcutConfig {
    fn direction(&self, key: u32, ctrl: bool, alt: bool, shift: bool) -> Option<&'static str> {
        if !self.enabled { return None; }
        for (direction, shortcut) in [("up", &self.shortcuts.up), ("down", &self.shortcuts.down)] {
            if virtual_key(&shortcut.key) == Some(key) && shortcut.ctrl == ctrl && shortcut.alt == alt && shortcut.shift == shift {
                return Some(direction);
            }
        }
        None
    }
}
#[tauri::command]
pub async fn shortcuts_configure(app: AppHandle, webview: Webview, shortcuts: WorkspaceShortcuts, enabled: bool) -> Result<(), String> {
    crate::browser::authorize(&webview)?;
    validate(&shortcuts)?;
    *app.state::<ShortcutState>().0.lock().map_err(|_| "Shortcut settings are unavailable")? = ShortcutConfig { shortcuts, enabled };
    Ok(())
}

// Register on the native child controller, where website keyboard focus lives.
// This consumes only validated workspace bindings; it never registers OS-wide hotkeys.
#[cfg(target_os = "windows")]
pub async fn attach(app: AppHandle, webview: &Webview) -> Result<(), String> {
    if HOOK_ACTIVE.load(std::sync::atomic::Ordering::Relaxed) { return Ok(()); }
    use tauri::Emitter;
    use webview2_com::{AcceleratorKeyPressedEventHandler, Microsoft::Web::WebView2::Win32::*};
    use windows::Win32::UI::Input::KeyboardAndMouse::{GetKeyState, VK_CONTROL, VK_MENU, VK_SHIFT, VK_LWIN, VK_RWIN, VK_RMENU};
    let (sender, receiver) = std::sync::mpsc::channel();
    webview.with_webview(move |platform| {
        let handler = AcceleratorKeyPressedEventHandler::create(Box::new(move |_, args| {
            let Some(args) = args else { return Ok(()); };
            unsafe {
                let mut kind = COREWEBVIEW2_KEY_EVENT_KIND_KEY_DOWN;
                args.KeyEventKind(&mut kind)?;
                if kind != COREWEBVIEW2_KEY_EVENT_KIND_KEY_DOWN && kind != COREWEBVIEW2_KEY_EVENT_KIND_SYSTEM_KEY_DOWN { return Ok(()); }
                let mut key = 0; args.VirtualKey(&mut key)?;
                let ctrl = GetKeyState(VK_CONTROL.0 as i32) < 0;
                let alt = GetKeyState(VK_MENU.0 as i32) < 0;
                let shift = GetKeyState(VK_SHIFT.0 as i32) < 0;
                // Right Alt with Ctrl is AltGr on international keyboards, used for typing.
                if GetKeyState(VK_LWIN.0 as i32) < 0 || GetKeyState(VK_RWIN.0 as i32) < 0 || (ctrl && alt && GetKeyState(VK_RMENU.0 as i32) < 0) { return Ok(()); }
                let direction = app.state::<ShortcutState>().0.lock().ok().and_then(|config| config.direction(key, ctrl, alt, shift));
                if let Some(direction) = direction {
                    args.SetHandled(true)?;
                    let mut status = COREWEBVIEW2_PHYSICAL_KEY_STATUS::default();
                    args.PhysicalKeyStatus(&mut status)?;
                    if !status.WasKeyDown.as_bool() {
                        // WebView2 recommends async work after consuming the accelerator.
                        let event_app = app.clone();
                        tauri::async_runtime::spawn(async move { let _ = event_app.emit_to("main", "workspace-shortcut", direction); });
                    }
                }
            }
            Ok(())
        }));
        let mut token = 0;
        let result = unsafe { platform.controller().add_AcceleratorKeyPressed(&handler, &mut token) }.map_err(|e| e.to_string());
        // The controller owns the handler until the child closes; no controller is captured.
        let _ = sender.send(result);
    }).map_err(|e| e.to_string())?;
    tauri::async_runtime::spawn_blocking(move || receiver.recv().map_err(|_| "Unable to attach browser shortcut handling".to_string())?)
        .await.map_err(|e| e.to_string())?
}
#[cfg(not(target_os = "windows"))]
pub async fn attach(_app: AppHandle, _webview: &Webview) -> Result<(), String> { Ok(()) }

// WebView2 accelerators omit Shift+letters and lose routing when a focused
// controller is hidden. A physical-key hook filters to Still and its managed
// Chrome process BEFORE matching bindings. No OS-wide RegisterHotKey bindings.
#[cfg(windows)]
static HOOK_APP:std::sync::OnceLock<AppHandle>=std::sync::OnceLock::new();
#[cfg(windows)]
static HOOK_ACTIVE:std::sync::atomic::AtomicBool=std::sync::atomic::AtomicBool::new(false);
#[cfg(windows)]
static EDITING:std::sync::atomic::AtomicBool=std::sync::atomic::AtomicBool::new(true);
#[cfg(windows)]
static FOCUS_GENERATION:std::sync::atomic::AtomicUsize=std::sync::atomic::AtomicUsize::new(0);
#[cfg(windows)]
static PRESSED:Mutex<Vec<u32>>=Mutex::new(Vec::new());
#[cfg(windows)]
pub fn refresh_editing(app:AppHandle){
 use std::sync::atomic::Ordering;
 use windows::Win32::{UI::{WindowsAndMessaging::{GetForegroundWindow,GetWindowThreadProcessId},Accessibility::*},System::Com::*};
 let front=unsafe{GetForegroundWindow()};let mut process=0;unsafe{GetWindowThreadProcessId(front,Some(&mut process));}
 if process!=std::process::id()&&!crate::chrome_overlay::is_managed_foreground(&app,front)&&!crate::app_panel::is_managed_foreground(&app,front){return}
 EDITING.store(true,Ordering::Relaxed);let generation=FOCUS_GENERATION.fetch_add(1,Ordering::Relaxed)+1;
 let foreground=front.0 as usize;
 tauri::async_runtime::spawn_blocking(move||unsafe{
  let initialized=CoInitializeEx(None,COINIT_MULTITHREADED).is_ok();
  let editing=(||->windows::core::Result<bool>{
   let automation:IUIAutomation=CoCreateInstance(&CUIAutomation,None,CLSCTX_INPROC_SERVER)?;
   let element=automation.GetFocusedElement()?;let kind=element.CurrentControlType()?;
   Ok(kind==UIA_EditControlTypeId||kind==UIA_ComboBoxControlTypeId||element.CurrentIsPassword()?.as_bool())
  })().unwrap_or(true);
  if generation==FOCUS_GENERATION.load(Ordering::Relaxed)&&GetForegroundWindow().0 as usize==foreground{EDITING.store(editing,Ordering::Relaxed);}
  if initialized{CoUninitialize();}
 });
}
#[cfg(windows)]
unsafe extern "system" fn keyboard(code:i32,w:windows::Win32::Foundation::WPARAM,l:windows::Win32::Foundation::LPARAM)->windows::Win32::Foundation::LRESULT{
 use windows::Win32::{Foundation::LRESULT,UI::{WindowsAndMessaging::*,Input::KeyboardAndMouse::*}};
 use std::sync::atomic::Ordering;
 use tauri::Emitter;
 if code<0{return CallNextHookEx(None,code,w,l)}
 let Some(app)=HOOK_APP.get() else{return CallNextHookEx(None,code,w,l)};
 let front=GetForegroundWindow();let mut process=0;GetWindowThreadProcessId(front,Some(&mut process));
 if process!=std::process::id()&&!crate::chrome_overlay::is_managed_foreground(app,front)&&!crate::app_panel::is_managed_foreground(app,front){if let Ok(mut p)=PRESSED.try_lock(){p.clear()}return CallNextHookEx(None,code,w,l)}
 let event=&*(l.0 as *const KBDLLHOOKSTRUCT);
 if event.flags.contains(LLKHF_INJECTED){return CallNextHookEx(None,code,w,l)}
 let Ok(mut pressed)=PRESSED.try_lock() else{return CallNextHookEx(None,code,w,l)};
 if w.0==WM_KEYUP as usize||w.0==WM_SYSKEYUP as usize{
  if let Some(at)=pressed.iter().position(|key|*key==event.vkCode){pressed.remove(at);return LRESULT(1)}return CallNextHookEx(None,code,w,l)
 }
 if w.0!=WM_KEYDOWN as usize&&w.0!=WM_SYSKEYDOWN as usize{return CallNextHookEx(None,code,w,l)}
 let ctrl=GetAsyncKeyState(VK_CONTROL.0 as i32)<0;let alt=GetAsyncKeyState(VK_MENU.0 as i32)<0;let shift=GetAsyncKeyState(VK_SHIFT.0 as i32)<0;
 if GetAsyncKeyState(VK_LWIN.0 as i32)<0||GetAsyncKeyState(VK_RWIN.0 as i32)<0||(ctrl&&alt&&GetAsyncKeyState(VK_RMENU.0 as i32)<0)||(shift&&!ctrl&&!alt&&EDITING.load(Ordering::Relaxed)){return CallNextHookEx(None,code,w,l)}
 if overview_toggle(event.vkCode,ctrl,alt,shift,EDITING.load(Ordering::Relaxed)){
  if !pressed.contains(&event.vkCode){pressed.push(event.vkCode);let app=app.clone();tauri::async_runtime::spawn(async move{let _=app.emit_to("main","workspace-overview-toggle",());});}
  return LRESULT(1)
 }
 let direction=app.state::<ShortcutState>().0.try_lock().ok().and_then(|s|s.direction(event.vkCode,ctrl,alt,shift));
 if let Some(direction)=direction{
  if !pressed.contains(&event.vkCode){pressed.push(event.vkCode);let app=app.clone();tauri::async_runtime::spawn(async move{let _=app.emit_to("main","workspace-shortcut",direction);});}
  return LRESULT(1)
 }CallNextHookEx(None,code,w,l)
}
#[cfg(windows)]
pub fn install(app:&AppHandle)->Result<(),String>{
 use windows::Win32::{Foundation::HINSTANCE,System::LibraryLoader::GetModuleHandleW,UI::WindowsAndMessaging::*};
 let _=HOOK_APP.set(app.clone());
 unsafe{let module=GetModuleHandleW(None).map_err(|e|e.to_string())?;let _hook=SetWindowsHookExW(WH_KEYBOARD_LL,Some(keyboard),Some(HINSTANCE(module.0)),0).map_err(|e|e.to_string())?;}
 HOOK_ACTIVE.store(true,std::sync::atomic::Ordering::Relaxed);refresh_editing(app.clone());Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn overview_toggle_requires_ctrl_m_outside_editing(){
        assert!(overview_toggle(b'M' as u32,true,false,false,false));
        assert!(!overview_toggle(b'M' as u32,true,false,false,true));
        assert!(!overview_toggle(b'M' as u32,true,true,false,false));
        assert!(!overview_toggle(b'M' as u32,true,false,true,false));
        assert!(!overview_toggle(b'N' as u32,true,false,false,false));
    }
    #[test] fn shift_only_bindings_are_valid(){
        let shortcuts=WorkspaceShortcuts{up:Shortcut{key:"W".into(),ctrl:false,alt:false,shift:true},down:Shortcut{key:"S".into(),ctrl:false,alt:false,shift:true}};
        assert!(validate(&shortcuts).is_ok());
    }
    #[test] fn native_bindings_match_exact_modifiers_and_pause_in_dialogs() {
        let mut config = ShortcutConfig { shortcuts: WorkspaceShortcuts::default(), enabled: true };
        assert_eq!(config.direction(b'W' as u32, false, true, false), Some("up"));
        assert_eq!(config.direction(b'S' as u32, false, true, false), Some("down"));
        assert_eq!(config.direction(b'W' as u32, false, true, true), None);
        assert_eq!(config.direction(b'W' as u32, false, false, false), None);
        config.shortcuts.down = Shortcut {key:"ArrowDown".into(),ctrl:true,alt:false,shift:true};
        assert_eq!(config.direction(0x28, true, false, true), Some("down"));
        config.enabled = false;
        assert_eq!(config.direction(0x28, true, false, true), None);
    }
    #[test] fn native_binding_validation_rejects_duplicate_reserved_or_unmodified_keys() {
        let mut shortcuts = WorkspaceShortcuts::default();assert!(validate(&shortcuts).is_ok());
        shortcuts.down = shortcuts.up.clone();assert!(validate(&shortcuts).is_err());
        shortcuts.down = Shortcut {key:"W".into(),ctrl:true,alt:false,shift:false};assert!(validate(&shortcuts).is_err());
        shortcuts.down = Shortcut {key:"S".into(),ctrl:false,alt:false,shift:false};assert!(validate(&shortcuts).is_err());
        shortcuts.down = Shortcut {key:"F4".into(),ctrl:false,alt:true,shift:false};assert!(validate(&shortcuts).is_err());
        shortcuts.down = Shortcut {key:"ArrowDown".into(),ctrl:false,alt:true,shift:false};assert!(validate(&shortcuts).is_ok());
    }
}
