use serde::Serialize;
use std::sync::{Mutex, OnceLock};
use tauri::{AppHandle, Webview};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
struct CaptureTarget {
    hwnd: usize,
    pid: u32,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum CaptureIntent {
    Target(CaptureTarget),
    MissingTarget,
}

#[derive(Default)]
struct CaptureGesture {
    pending: Option<CaptureIntent>,
}

impl CaptureGesture {
    fn left_down(&mut self, chord_held: bool, target: Option<CaptureTarget>) {
        self.pending = if chord_held {
            Some(target.map_or(CaptureIntent::MissingTarget, CaptureIntent::Target))
        } else {
            None
        };
    }

    fn left_up(&mut self) -> Option<CaptureIntent> {
        self.pending.take()
    }
}

#[derive(Clone, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
enum CaptureResult {
    Target { hwnd: usize, pid: u32, title: String },
    Failure { stage: &'static str, message: String },
}

static GESTURE: Mutex<CaptureGesture> = Mutex::new(CaptureGesture { pending: None });
static INSTALL_ERROR: OnceLock<String> = OnceLock::new();

#[cfg(windows)]
static APP: OnceLock<AppHandle> = OnceLock::new();
#[cfg(windows)]
static HOOK: std::sync::atomic::AtomicIsize = std::sync::atomic::AtomicIsize::new(0);
#[cfg(windows)]
static READY: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

#[cfg(windows)]
pub fn install(app: &AppHandle) -> Result<(), String> {
    use windows::Win32::{
        Foundation::HINSTANCE,
        System::LibraryLoader::GetModuleHandleW,
        UI::WindowsAndMessaging::{SetWindowsHookExW, WH_MOUSE_LL},
    };

    if HOOK.load(std::sync::atomic::Ordering::Acquire) != 0 {
        return Ok(());
    }
    let _ = APP.set(app.clone());
    let result = unsafe {
        let module = GetModuleHandleW(None).map_err(|error| error.to_string());
        module.and_then(|module| {
            SetWindowsHookExW(WH_MOUSE_LL, Some(mouse_hook), Some(HINSTANCE(module.0)), 0)
                .map_err(|error| error.to_string())
        })
    };
    match result {
        Ok(hook) => {
            HOOK.store(hook.0 as isize, std::sync::atomic::Ordering::Release);
            eprintln!("[capture] stage=hook-install outcome=ready");
            Ok(())
        }
        Err(error) => {
            let message = format!("Global mouse capture could not start: {error}");
            let _ = INSTALL_ERROR.set(message.clone());
            eprintln!("[capture] stage=hook-install outcome=failed: {error}");
            Err(message)
        }
    }
}

#[cfg(windows)]
pub fn shutdown() {
    use windows::Win32::UI::WindowsAndMessaging::{UnhookWindowsHookEx, HHOOK};
    READY.store(false, std::sync::atomic::Ordering::Release);
    let hook = HOOK.swap(0, std::sync::atomic::Ordering::AcqRel);
    if hook != 0 {
        unsafe {
            let _ = UnhookWindowsHookEx(HHOOK(hook as *mut std::ffi::c_void));
        }
    }
}

#[tauri::command]
pub async fn app_capture_enable(app: AppHandle, webview: Webview) -> Result<(), String> {
    crate::browser::authorize(&webview)?;
    #[cfg(windows)]
    {
        if HOOK.load(std::sync::atomic::Ordering::Acquire) == 0 {
            return Err(INSTALL_ERROR
                .get()
                .cloned()
                .unwrap_or_else(|| "Global mouse capture is unavailable. Restart Still to try again.".into()));
        }
        let _ = app;
        READY.store(true, std::sync::atomic::Ordering::Release);
        return Ok(());
    }
    #[cfg(not(windows))]
    {
        let _ = app;
        Err("Ctrl+Shift-click capture is available in the Windows app.".into())
    }
}

#[cfg(windows)]
fn capture_target(point: windows::Win32::Foundation::POINT) -> Option<CaptureTarget> {
    use windows::Win32::UI::WindowsAndMessaging::{GetAncestor, GetWindowThreadProcessId, WindowFromPoint, GA_ROOT};
    let hit = unsafe { WindowFromPoint(point) };
    if hit.0.is_null() {
        return None;
    }
    let root = unsafe { GetAncestor(hit, GA_ROOT) };
    if root.0.is_null() {
        return None;
    }
    let mut pid = 0;
    unsafe { GetWindowThreadProcessId(root, Some(&mut pid)); }
    (pid != 0).then_some(CaptureTarget { hwnd: root.0 as usize, pid })
}

#[cfg(windows)]
unsafe extern "system" fn mouse_hook(
    code: i32,
    wparam: windows::Win32::Foundation::WPARAM,
    lparam: windows::Win32::Foundation::LPARAM,
) -> windows::Win32::Foundation::LRESULT {
    use windows::Win32::{
        Foundation::WPARAM,
        UI::{
            Input::KeyboardAndMouse::{GetAsyncKeyState, VK_CONTROL, VK_SHIFT},
            WindowsAndMessaging::{CallNextHookEx, MSLLHOOKSTRUCT, WM_LBUTTONDOWN, WM_LBUTTONUP, LLMHF_INJECTED},
        },
    };

    if code >= 0 && READY.load(std::sync::atomic::Ordering::Acquire) {
        let event = &*(lparam.0 as *const MSLLHOOKSTRUCT);
        if event.flags & LLMHF_INJECTED == 0 {
            match wparam.0 {
                value if value == WM_LBUTTONDOWN as usize => {
                    let chord = GetAsyncKeyState(VK_CONTROL.0 as i32) < 0
                        && GetAsyncKeyState(VK_SHIFT.0 as i32) < 0;
                    let target = chord.then(|| capture_target(event.pt)).flatten();
                    if let Ok(mut gesture) = GESTURE.try_lock() {
                        gesture.left_down(chord, target);
                    } else {
                        eprintln!("[capture] stage=mouse-down outcome=state-unavailable");
                    }
                    if chord {
                        eprintln!("[capture] stage=mouse-down outcome=intent-recorded");
                    }
                }
                value if value == WM_LBUTTONUP as usize => {
                    let intent = match GESTURE.try_lock() {
                        Ok(mut gesture) => gesture.left_up(),
                        Err(_) => {
                            eprintln!("[capture] stage=mouse-up outcome=state-unavailable");
                            None
                        }
                    };
                    if let Some(intent) = intent {
                        if let Some(app) = APP.get().cloned() {
                            tauri::async_runtime::spawn_blocking(move || complete_capture(app, intent));
                        } else {
                            eprintln!("[capture] stage=dispatch outcome=app-unavailable");
                        }
                    }
                }
                _ => {}
            }
        }
    }
    CallNextHookEx(None, code, WPARAM(wparam.0), lparam)
}

#[cfg(windows)]
fn complete_capture(app: AppHandle, intent: CaptureIntent) {
    use tauri::Emitter;
    let result = match intent {
        CaptureIntent::MissingTarget => CaptureResult::Failure {
            stage: "capture",
            message: "No app window was found at the click point. Hold Ctrl+Shift and click the app again.".into(),
        },
        CaptureIntent::Target(target) => match crate::app_panel::capture_candidate(&app, target.hwnd, target.pid) {
            Ok(Some(title)) => {
                eprintln!("[capture] stage=revalidate outcome=passed");
                CaptureResult::Target { hwnd: target.hwnd, pid: target.pid, title }
            }
            Ok(None) => {
                eprintln!("[capture] stage=revalidate outcome=ignored");
                return;
            }
            Err(message) => CaptureResult::Failure { stage: "revalidate", message },
        },
    };
    if let CaptureResult::Failure { stage, .. } = &result {
        eprintln!("[capture] stage={stage} outcome=failed");
    }
    if let Err(error) = app.emit_to("main", "app-capture-result", result) {
        eprintln!("[capture] stage=delivery outcome=failed: {error}");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn capture_intent_is_sampled_on_button_down_and_survives_modifier_release() {
        let target = CaptureTarget { hwnd: 42, pid: 7 };
        let mut gesture = CaptureGesture::default();
        gesture.left_down(true, Some(target));

        assert_eq!(gesture.left_up(), Some(CaptureIntent::Target(target)));
        assert_eq!(gesture.left_up(), None);
    }

    #[test]
    fn capture_requires_modifiers_at_button_down_and_normal_click_clears_stale_intent() {
        let target = CaptureTarget { hwnd: 42, pid: 7 };
        let mut gesture = CaptureGesture::default();
        gesture.left_down(false, Some(target));
        assert_eq!(gesture.left_up(), None);

        gesture.left_down(true, Some(target));
        gesture.left_down(false, Some(CaptureTarget { hwnd: 43, pid: 8 }));
        assert_eq!(gesture.left_up(), None);
    }

    #[test]
    fn capture_intent_surfaces_missing_click_target_after_button_up() {
        let mut gesture = CaptureGesture::default();
        gesture.left_down(true, None);
        assert_eq!(gesture.left_up(), Some(CaptureIntent::MissingTarget));
    }
}
