//! Keeps managed top-level app windows in the same z-order as their workspace cards.
use tauri::AppHandle;
use std::sync::{Mutex, OnceLock};
use windows::Win32::{Foundation::HWND, UI::WindowsAndMessaging::{IsWindow, SetWindowPos, HWND_TOP, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SWP_NOOWNERZORDER}};

fn handle(value: usize) -> HWND { HWND(value as *mut std::ffi::c_void) }
static LAST_ORDER: OnceLock<Mutex<Option<Vec<(i64, usize)>>>> = OnceLock::new();
static APPLY_LOCK: Mutex<()> = Mutex::new(());

pub(crate) fn invalidate_order() {
    if let Ok(mut last) = LAST_ORDER.get_or_init(|| Mutex::new(None)).lock() { *last = None; }
}

/// Process shared window, focus, DPI and foreground notifications through the
/// same Browser → Apps → z-order pass instead of letting each subsystem win
/// the race independently.
pub(crate) fn refresh_all(app: &AppHandle) {
    crate::chrome_overlay::refresh_state(app);
    crate::app_panel::refresh_state(app);
    apply_order(app);
}

/// Native panels are independent top-level windows, so the DOM's card order
/// must be reapplied after either native subsystem moves or shows a window.
pub(crate) fn apply_order(app: &AppHandle) {
    let mut windows = Vec::new();
    let Some(chrome) = crate::chrome_overlay::ordered_windows(app) else { return };
    let Some(apps) = crate::app_panel::ordered_windows(app) else { return };
    windows.extend(chrome);
    windows.extend(apps);
    windows.sort_by_key(|(rank, hwnd)| (*rank, *hwnd));
    let _apply = match APPLY_LOCK.try_lock() { Ok(lock) => lock, Err(_) => return };
    let last_order = LAST_ORDER.get_or_init(|| Mutex::new(None));
    let mut last = match last_order.lock() { Ok(last) => last, Err(_) => return };
    if last.as_ref() == Some(&windows) { return; }
    *last = Some(windows.clone());
    drop(last);
    let mut applied = true;
    for (_, raw) in &windows {
        let hwnd = handle(*raw);
        unsafe {
            if IsWindow(Some(hwnd)).as_bool() {
                if SetWindowPos(hwnd, Some(HWND_TOP), 0, 0, 0, 0,
                    SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_NOOWNERZORDER).is_err() { applied = false; }
            } else { applied = false; }
        }
    }
    if !applied { invalidate_order(); }
}
