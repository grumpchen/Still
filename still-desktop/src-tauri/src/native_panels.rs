//! Keeps managed top-level app windows in the same z-order as their workspace cards.
use tauri::AppHandle;
use std::sync::{Mutex, OnceLock};
use windows::Win32::{Foundation::{HWND, RECT}, Graphics::Gdi::{CreateRectRgn, DeleteObject, GetWindowRgn, PtInRegion, SetWindowRgn, HGDIOBJ, RGN_ERROR}, UI::WindowsAndMessaging::{GetWindowRect, IsWindow, SetWindowPos, HWND_TOP, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SWP_NOOWNERZORDER}};

fn handle(value: usize) -> HWND { HWND(value as *mut std::ffi::c_void) }

/// Convert the WebView's logical viewport edge into the same physical screen
/// coordinate space used by GetWindowRect and SetWindowPos.
pub(crate) fn viewport_right_screen(origin_x: i32, logical_right: f64, scale: f64) -> Option<i32> {
    if !logical_right.is_finite() || logical_right < 0.0 || !scale.is_finite() || scale <= 0.0 {
        return None;
    }
    let screen = origin_x as f64 + logical_right * scale;
    (screen.is_finite() && screen >= i32::MIN as f64 && screen <= i32::MAX as f64)
        .then(|| screen.round() as i32)
}

/// Treat one physical pixel of rounding variance as touching the safe edge.
pub(crate) fn right_edge_is_unsafe(actual_right: i32, origin_x: i32, logical_right: f64, scale: f64) -> bool {
    viewport_right_screen(origin_x, logical_right, scale)
        .is_none_or(|edge| actual_right > edge.saturating_add(1))
}

/// Older queued snapshots can never replace a newer native panel state.
pub(crate) fn snapshot_is_stale(current_revision: u64, incoming_revision: u64) -> bool {
    incoming_revision < current_revision
}

/// Child surfaces such as Chrome's renderer can paint outside a clipped top-level
/// panel after scrolling. Reapplying the panel's current region clears that
/// compositor residue without moving or resizing the native window.
pub(crate) fn refresh_clipped_child_region(parent: HWND, child: HWND) -> bool { unsafe {
    let region = CreateRectRgn(0, 0, 0, 0);
    if region.0.is_null() { return false; }
    if GetWindowRgn(parent, region) == RGN_ERROR { let _ = DeleteObject(HGDIOBJ(region.0)); return false; }
    let mut parent_rect = RECT::default();
    let mut child_rect = RECT::default();
    if GetWindowRect(parent, &mut parent_rect).is_err() || GetWindowRect(child, &mut child_rect).is_err() {
        let _ = DeleteObject(HGDIOBJ(region.0));
        return false;
    }
    let width = child_rect.right - child_rect.left;
    let height = child_rect.bottom - child_rect.top;
    let outside = width > 0 && height > 0 && [
        (child_rect.left, child_rect.top),
        (child_rect.right - 1, child_rect.top),
        (child_rect.left, child_rect.bottom - 1),
        (child_rect.right - 1, child_rect.bottom - 1),
        (child_rect.left + width / 2, child_rect.top + height / 2),
    ].iter().any(|(x, y)| !PtInRegion(region, x - parent_rect.left, y - parent_rect.top).as_bool());
    if !outside { let _ = DeleteObject(HGDIOBJ(region.0)); return false; }
    if SetWindowRgn(parent, Some(region), true) == 0 {
        let _ = DeleteObject(HGDIOBJ(region.0));
        return false;
    }
    true
} }
static LAST_ORDER: OnceLock<Mutex<Option<Vec<(i64, usize)>>>> = OnceLock::new();
static APPLY_LOCK: Mutex<()> = Mutex::new(());

pub(crate) fn invalidate_order() {
    if let Ok(mut last) = LAST_ORDER.get_or_init(|| Mutex::new(None)).lock() { *last = None; }
}

/// Process shared window, focus, DPI and foreground notifications for Apps panels.
pub(crate) fn refresh_all(app: &AppHandle) {
    crate::app_panel::refresh_state(app);
    apply_order(app);
}

/// Native panels are independent top-level windows, so the DOM's card order
/// must be reapplied after native app panels move or show a window.
pub(crate) fn apply_order(app: &AppHandle) {
    let Some(apps) = crate::app_panel::ordered_windows(app) else { return };
    let mut windows = apps;
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

#[cfg(test)]
mod edge_tests {
    use super::*;

    #[test]
    fn right_edge_guard_uses_physical_pixels_at_common_dpi_scales() {
        for scale in [1.0, 1.25, 1.5, 1.75, 2.0, 3.0] {
            let origin = 137;
            let logical_right = 1000.0;
            let edge = viewport_right_screen(origin, logical_right, scale).unwrap();
            assert!(!right_edge_is_unsafe(edge, origin, logical_right, scale));
            assert!(!right_edge_is_unsafe(edge + 1, origin, logical_right, scale));
            assert!(right_edge_is_unsafe(edge + 2, origin, logical_right, scale));
        }
    }

    #[test]
    fn unknown_or_invalid_viewport_edge_fails_closed() {
        assert!(right_edge_is_unsafe(100, 0, f64::NAN, 1.0));
        assert!(right_edge_is_unsafe(100, 0, 100.0, 0.0));
        assert!(right_edge_is_unsafe(100, 0, -1.0, 1.0));
    }

    #[test]
    fn an_older_show_snapshot_cannot_replace_a_newer_hidden_snapshot() {
        assert!(snapshot_is_stale(12, 11));
        assert!(!snapshot_is_stale(12, 12), "repeated current snapshots remain idempotent");
        assert!(!snapshot_is_stale(12, 13));
    }
}
