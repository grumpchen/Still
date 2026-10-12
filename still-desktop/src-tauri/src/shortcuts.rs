use serde::Deserialize;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, Webview};

#[derive(Clone, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Shortcut { key: String, ctrl: bool, alt: bool, shift: bool }
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceShortcuts { up: Shortcut, down: Shortcut, #[serde(default="default_overview")] overview:Shortcut, #[serde(default="default_click_through")] click_through:Shortcut, #[serde(default="default_command_palette")] command_palette:Shortcut, #[serde(default="default_undo")] undo:Shortcut, #[serde(default="default_numbered")] numbered:Vec<Shortcut> }
fn default_overview()->Shortcut{Shortcut{key:"M".into(),ctrl:true,alt:false,shift:false}}
fn default_click_through()->Shortcut{Shortcut{key:"P".into(),ctrl:true,alt:false,shift:true}}
fn default_command_palette()->Shortcut{Shortcut{key:"K".into(),ctrl:true,alt:false,shift:false}}
fn default_undo()->Shortcut{Shortcut{key:"Z".into(),ctrl:true,alt:false,shift:false}}
fn default_numbered()->Vec<Shortcut>{(1..=9).map(|number|Shortcut{key:number.to_string(),ctrl:true,alt:false,shift:false}).collect()}
impl Default for WorkspaceShortcuts {
    fn default() -> Self {
        Self {
            up: Shortcut { key: "W".into(), ctrl: false, alt: true, shift: false },
            down: Shortcut { key: "S".into(), ctrl: false, alt: true, shift: false },
            overview:default_overview(),click_through:default_click_through(),command_palette:default_command_palette(),undo:default_undo(),numbered:default_numbered(),
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
fn valid_binding(shortcut:&Shortcut)->bool{
    (!shortcut.alt&&!shortcut.ctrl&&!shortcut.shift)==false&&virtual_key(&shortcut.key).is_some()&&
      !(shortcut.ctrl&&!shortcut.alt&&!shortcut.shift&&"ACF LNPRSTUVWXY".replace(' ',"").contains(&shortcut.key))&&
      !(shortcut.alt&&!shortcut.ctrl&&!shortcut.shift&&["ArrowLeft","ArrowRight","D"].contains(&shortcut.key.as_str()))
}
fn validate(shortcuts: &WorkspaceShortcuts) -> Result<(), String> {
    let all=[&shortcuts.up,&shortcuts.down,&shortcuts.overview,&shortcuts.click_through,&shortcuts.command_palette,&shortcuts.undo].into_iter().chain(shortcuts.numbered.iter()).collect::<Vec<_>>();
    for shortcut in &all {
        if !valid_binding(shortcut) {
            return Err("Include Alt, Ctrl or Shift with a letter, number, or navigation key".into());
        }
    }
    if shortcuts.numbered.len()!=9{return Err("Keep a shortcut for each of the nine workspace slots".into())}
    for (index,left) in all.iter().enumerate(){if all[index+1..].iter().any(|right|*left==*right){return Err("Each action needs a different shortcut".into())}}
    Ok(())
}
fn click_through_blocked(toggle_enabled:bool)->bool{
    !toggle_enabled
}
fn action_allowed_for_context(still_context:bool,click_through_active:bool,action:Option<&str>)->bool{
    still_context||(click_through_active&&action==Some("clickThrough"))
}
impl ShortcutConfig {
    fn action(&self, key: u32, ctrl: bool, alt: bool, shift: bool) -> Option<String> {
        if !self.enabled { return None; }
        for (action, shortcut) in [("up", &self.shortcuts.up), ("down", &self.shortcuts.down),("overview",&self.shortcuts.overview),("clickThrough",&self.shortcuts.click_through),("commandPalette",&self.shortcuts.command_palette),("undo",&self.shortcuts.undo)] {
            if virtual_key(&shortcut.key) == Some(key) && shortcut.ctrl == ctrl && shortcut.alt == alt && shortcut.shift == shift {
                return Some(action.to_string());
            }
        }
        self.shortcuts.numbered.iter().position(|shortcut|virtual_key(&shortcut.key)==Some(key)&&shortcut.ctrl==ctrl&&shortcut.alt==alt&&shortcut.shift==shift).map(|index|format!("workspace:{}",index+1))
    }
}
fn action_for_context(config:&ShortcutConfig,key:u32,ctrl:bool,alt:bool,shift:bool,still_context:bool,click_through_active:bool)->Option<String>{
    let action=config.action(key,ctrl,alt,shift)?;
    action_allowed_for_context(still_context,click_through_active,Some(action.as_str())).then_some(action)
}
#[tauri::command]
pub async fn shortcuts_configure(app: AppHandle, webview: Webview, shortcuts: WorkspaceShortcuts, enabled: bool) -> Result<(), String> {
    crate::security::authorize(&webview)?;
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
                let action = app.state::<ShortcutState>().0.lock().ok().and_then(|config| config.action(key, ctrl, alt, shift));
                if let Some(action) = action {
                    if action == "clickThrough" && !crate::window_input::toggle_enabled() { return Ok(()); }
                    args.SetHandled(true)?;
                    let mut status = COREWEBVIEW2_PHYSICAL_KEY_STATUS::default();
                    args.PhysicalKeyStatus(&mut status)?;
                    if !status.WasKeyDown.as_bool() {
                        // WebView2 recommends async work after consuming the accelerator.
                        let event_app = app.clone();
                        tauri::async_runtime::spawn(async move { match action.as_str(){"up"|"down"=>{let _=event_app.emit_to("main","workspace-shortcut",action);},"overview"=>{let _=event_app.emit_to("main","workspace-overview-toggle",());},"clickThrough"=>crate::window_input::toggle_from_hotkey(event_app),_=>{let _=event_app.emit_to("main","app-shortcut",action);}} });
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
 if process!=std::process::id()&&!crate::app_panel::is_managed_foreground(&app,front){return}
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
 let event=&*(l.0 as *const KBDLLHOOKSTRUCT);
 if event.flags.contains(LLKHF_INJECTED){return CallNextHookEx(None,code,w,l)}
 if (w.0==WM_KEYUP as usize||w.0==WM_SYSKEYUP as usize)&&crate::window_input::take_hotkey_keyup(event.vkCode){return LRESULT(1)}
 let front=GetForegroundWindow();let mut process=0;GetWindowThreadProcessId(front,Some(&mut process));
 let still_context=process==std::process::id()||crate::app_panel::is_managed_foreground(app,front);
 let click_through_active=crate::window_input::active();
 if !still_context&&!click_through_active{if let Ok(mut p)=PRESSED.try_lock(){p.clear()}return CallNextHookEx(None,code,w,l)}
 let Ok(mut pressed)=PRESSED.try_lock() else{return CallNextHookEx(None,code,w,l)};
 if w.0==WM_KEYUP as usize||w.0==WM_SYSKEYUP as usize{
  if let Some(at)=pressed.iter().position(|key|*key==event.vkCode){pressed.remove(at);return LRESULT(1)}return CallNextHookEx(None,code,w,l)
 }
 if w.0!=WM_KEYDOWN as usize&&w.0!=WM_SYSKEYDOWN as usize{return CallNextHookEx(None,code,w,l)}
 let ctrl=GetAsyncKeyState(VK_CONTROL.0 as i32)<0;let alt=GetAsyncKeyState(VK_MENU.0 as i32)<0;let shift=GetAsyncKeyState(VK_SHIFT.0 as i32)<0;
 if GetAsyncKeyState(VK_LWIN.0 as i32)<0||GetAsyncKeyState(VK_RWIN.0 as i32)<0||(ctrl&&alt&&GetAsyncKeyState(VK_RMENU.0 as i32)<0)||(shift&&!ctrl&&!alt&&EDITING.load(Ordering::Relaxed)){return CallNextHookEx(None,code,w,l)}
 let action=app.state::<ShortcutState>().0.try_lock().ok().and_then(|config|action_for_context(&config,event.vkCode,ctrl,alt,shift,still_context,click_through_active));
 if let Some(action)=action{
  if action=="overview"&&EDITING.load(Ordering::Relaxed)||((action=="undo"||action.starts_with("workspace:"))&&EDITING.load(Ordering::Relaxed)){return CallNextHookEx(None,code,w,l)}
  if action=="clickThrough"{
   if click_through_blocked(crate::window_input::toggle_enabled()){return CallNextHookEx(None,code,w,l)}
   if crate::window_input::mark_hotkey_keydown(event.vkCode){let event_app=app.clone();tauri::async_runtime::spawn(async move{crate::window_input::toggle_from_hotkey(event_app)});}
   return LRESULT(1)
  }
  if !pressed.contains(&event.vkCode){pressed.push(event.vkCode);let event_app=app.clone();let payload=action.clone();tauri::async_runtime::spawn(async move{
   match action.as_str(){"up"|"down"=>{let _=event_app.emit_to("main","workspace-shortcut",payload);},"overview"=>{let _=event_app.emit_to("main","workspace-overview-toggle",());},_=>{let _=event_app.emit_to("main","app-shortcut",payload);}}
  });}
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
    #[test] fn shift_only_bindings_are_valid(){
        let shortcuts=WorkspaceShortcuts{up:Shortcut{key:"W".into(),ctrl:false,alt:false,shift:true},down:Shortcut{key:"S".into(),ctrl:false,alt:false,shift:true},..WorkspaceShortcuts::default()};
        assert!(validate(&shortcuts).is_ok());
    }
    #[test] fn native_bindings_dispatch_every_configurable_action_with_exact_modifiers() {
        let mut config = ShortcutConfig { shortcuts: WorkspaceShortcuts::default(), enabled: true };
        assert_eq!(config.action(b'W' as u32, false, true, false).as_deref(), Some("up"));
        assert_eq!(config.action(b'M' as u32, true, false, false).as_deref(), Some("overview"));
        assert_eq!(config.action(b'P' as u32, true, false, true).as_deref(), Some("clickThrough"));
        assert_eq!(config.action(b'W' as u32, false, true, true), None);
        assert_eq!(config.action(b'W' as u32, false, false, false), None);
        assert_eq!(config.action(b'3' as u32, true, false, false).as_deref(), Some("workspace:3"));
        config.shortcuts.down = Shortcut {key:"ArrowDown".into(),ctrl:true,alt:false,shift:true};
        assert_eq!(config.action(0x28, true, false, true).as_deref(), Some("down"));
        config.enabled = false;
        assert_eq!(config.action(0x28, true, false, true), None);
    }
    #[test] fn click_through_shortcut_is_not_blocked_by_a_stale_editing_flag(){
        assert!(!click_through_blocked(true),"the click-through chord remains available even if cached UIA focus says editor");
        assert!(click_through_blocked(false),"the click-through chord remains disabled until the user enables it");
        let mut config=ShortcutConfig{shortcuts:WorkspaceShortcuts::default(),enabled:true};
        config.shortcuts.click_through=Shortcut{key:"A".into(),ctrl:true,alt:false,shift:true};
        assert_eq!(config.action(b'A' as u32,true,false,true).as_deref(),Some("clickThrough"));
    }
    #[test] fn active_click_through_can_be_disabled_after_another_app_gets_focus(){
        let mut config=ShortcutConfig{shortcuts:WorkspaceShortcuts::default(),enabled:true};
        config.shortcuts.click_through=Shortcut{key:"A".into(),ctrl:true,alt:false,shift:true};
        assert_eq!(action_for_context(&config,b'A' as u32,true,false,true,true,false).as_deref(),Some("clickThrough"));
        assert_eq!(action_for_context(&config,b'A' as u32,true,false,true,false,true).as_deref(),Some("clickThrough"));
        assert_eq!(action_for_context(&config,b'A' as u32,true,false,true,false,false),None);
        assert_eq!(action_for_context(&config,b'A' as u32,true,false,false,false,true),None);
        assert_eq!(action_for_context(&config,b'M' as u32,true,false,false,false,true),None);
        config.enabled=false;
        assert_eq!(action_for_context(&config,b'A' as u32,true,false,true,false,true),None);
    }
    #[test] fn native_binding_validation_rejects_duplicate_reserved_or_unmodified_keys() {
        let mut shortcuts = WorkspaceShortcuts::default();assert!(validate(&shortcuts).is_ok());
        shortcuts.down = shortcuts.up.clone();assert!(validate(&shortcuts).is_err());
        shortcuts.numbered[0] = shortcuts.up.clone();assert!(validate(&shortcuts).is_err());
        shortcuts.numbered[0] = Shortcut {key:"C".into(),ctrl:true,alt:false,shift:false};assert!(validate(&shortcuts).is_err());
        shortcuts.down = Shortcut {key:"S".into(),ctrl:false,alt:false,shift:false};assert!(validate(&shortcuts).is_err());
        shortcuts.down = Shortcut {key:"F4".into(),ctrl:false,alt:true,shift:false};assert!(validate(&shortcuts).is_err());
        shortcuts.numbered[0] = Shortcut {key:"1".into(),ctrl:true,alt:false,shift:false};
        shortcuts.down = Shortcut {key:"ArrowDown".into(),ctrl:false,alt:true,shift:false};assert!(validate(&shortcuts).is_ok());
    }
}
