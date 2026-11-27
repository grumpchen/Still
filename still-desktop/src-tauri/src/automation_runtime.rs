use serde::Serialize;
use std::{collections::VecDeque, sync::Mutex, time::{Duration, SystemTime, UNIX_EPOCH}};
use tauri::{AppHandle, Emitter, Manager, State};
#[cfg(windows)] use tauri::{menu::{Menu, MenuItem}, tray::{TrayIconBuilder, TrayIconEvent}};

pub const TICK_INTERVAL: Duration = Duration::from_secs(15);
const REPLAY_CAPACITY: usize = 256;
const TICK_EVENT: &str = "still:automation-tick";
const WEBVIEW2_BACKGROUND_FLAGS: [&str; 3] = ["--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"];
const WEBVIEW2_DEFAULT_FLAGS: &str = "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection";

fn add_webview2_background_flags(existing: &str) -> String {
    let mut args = existing.to_owned();
    for flag in WEBVIEW2_BACKGROUND_FLAGS {
        if !args.split_whitespace().any(|current| current == flag) {
            if !args.is_empty() { args.push(' '); }
            args.push_str(flag);
        }
    }
    args
}

fn webview2_browser_args(debug_port: Option<u16>) -> String {
    let mut args = add_webview2_background_flags(WEBVIEW2_DEFAULT_FLAGS);
    if let Some(port) = debug_port.filter(|port| *port >= 1024) {
        args.push_str(&format!(" --remote-debugging-port={port}"));
    }
    args
}

fn smoke_cdp_port(github_actions: bool, value: Option<&str>) -> Option<u16> {
    if !github_actions { return None; }
    value?.parse::<u16>().ok().filter(|port| *port >= 1024)
}

/// Wry reads WebView2 switches from the per-window `additional_browser_args`
/// configuration while constructing the environment. An environment variable
/// cannot change those already-constructed WebView2 environment options.
#[cfg(windows)]
pub fn configure_webview2_context(context: &mut tauri::Context<tauri::Wry>) {
    let debug_port = smoke_cdp_port(std::env::var("GITHUB_ACTIONS").as_deref() == Ok("true"), std::env::var("STILL_TEST_CDP_PORT").ok().as_deref());
    let args = webview2_browser_args(debug_port);
    if let Some(window) = context.config_mut().app.windows.iter_mut().find(|window| window.label == "main") {
        window.additional_browser_args = Some(args);
    }
}

/// Args for isolated Browser child webviews. The opt-in debugging port is
/// deliberately restricted to the GitHub smoke harness and a numeric port.
pub fn browser_webview_args() -> String {
    #[cfg(windows)]
    let debug_port = smoke_cdp_port(std::env::var("GITHUB_ACTIONS").as_deref() == Ok("true"), std::env::var("STILL_TEST_CDP_PORT").ok().as_deref());
    #[cfg(not(windows))]
    let debug_port = None;
    webview2_browser_args(debug_port)
}

fn next_tick_deadline(now: tokio::time::Instant) -> tokio::time::Instant { now + TICK_INTERVAL }

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AutomationTick {
    pub runtime_id: String,
    pub sequence: u64,
    pub scheduled_at_unix_ms: u64,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TickBatch {
    pub runtime_id: String,
    pub requested_after_sequence: u64,
    pub oldest_available_sequence: Option<u64>,
    pub latest_sequence: u64,
    pub ticks: Vec<AutomationTick>,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AutomationRuntimeStatus {
    pub runtime_id: String,
    pub tick_interval_ms: u64,
    pub replay_capacity: usize,
    pub latest_sequence: u64,
    pub last_tick_scheduled_at_unix_ms: Option<u64>,
    pub hidden_to_tray: bool,
    pub tray_available: bool,
    pub tray_error: Option<String>,
    pub main_window_visible: Option<bool>,
    pub main_window_minimized: Option<bool>,
}

struct RuntimeState {
    runtime_id: String,
    latest_sequence: u64,
    ticks: VecDeque<AutomationTick>,
    hidden_to_tray: bool,
    tray_available: bool,
    tray_error: Option<String>,
}

pub struct AutomationRuntime(Mutex<RuntimeState>);

impl Default for AutomationRuntime {
    fn default() -> Self {
        Self(Mutex::new(RuntimeState {
            runtime_id: uuid::Uuid::new_v4().to_string(), latest_sequence: 0, ticks: VecDeque::new(), hidden_to_tray: false,
            tray_available: false, tray_error: Some("Tray has not been initialized".into()),
        }))
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum TrayAction { Show, Quit }

fn tray_action_for_id(id: &str) -> Option<TrayAction> {
    match id { "show" => Some(TrayAction::Show), "quit" => Some(TrayAction::Quit), _ => None }
}

impl AutomationRuntime {
    fn record_tick(&self, scheduled_at_unix_ms: u64) -> AutomationTick {
        let mut state = self.0.lock().expect("automation runtime mutex poisoned");
        state.latest_sequence += 1;
        let tick = AutomationTick { runtime_id: state.runtime_id.clone(), sequence: state.latest_sequence, scheduled_at_unix_ms };
        state.ticks.push_back(tick.clone());
        if state.ticks.len() > REPLAY_CAPACITY { state.ticks.pop_front(); }
        tick
    }

    fn ticks_since(&self, runtime_id: Option<&str>, sequence: u64) -> TickBatch {
        let state = self.0.lock().expect("automation runtime mutex poisoned");
        let requested_after_sequence = if runtime_id.is_some_and(|id| id == state.runtime_id) { sequence } else { 0 };
        TickBatch {
            runtime_id: state.runtime_id.clone(),
            requested_after_sequence,
            oldest_available_sequence: state.ticks.front().map(|tick| tick.sequence),
            latest_sequence: state.latest_sequence,
            ticks: state.ticks.iter().filter(|tick| tick.sequence > requested_after_sequence).cloned().collect(),
        }
    }

    fn set_hidden_to_tray(&self, hidden: bool) {
        self.0.lock().expect("automation runtime mutex poisoned").hidden_to_tray = hidden;
    }

    fn set_tray_status(&self, available: bool, error: Option<String>) {
        let mut state = self.0.lock().expect("automation runtime mutex poisoned");
        state.tray_available = available;
        state.tray_error = error;
    }

    fn ensure_tray_available(&self) -> Result<(), String> {
        let state = self.0.lock().map_err(|_| "Automation runtime state is unavailable".to_string())?;
        if state.tray_available { Ok(()) } else { Err(state.tray_error.clone().unwrap_or_else(|| "System tray is unavailable".into())) }
    }

    fn status(&self, main_window_visible: Option<bool>, main_window_minimized: Option<bool>) -> AutomationRuntimeStatus {
        let state = self.0.lock().expect("automation runtime mutex poisoned");
        AutomationRuntimeStatus {
            runtime_id: state.runtime_id.clone(),
            tick_interval_ms: TICK_INTERVAL.as_millis() as u64,
            replay_capacity: REPLAY_CAPACITY,
            latest_sequence: state.latest_sequence,
            last_tick_scheduled_at_unix_ms: state.ticks.back().map(|tick| tick.scheduled_at_unix_ms),
            hidden_to_tray: state.hidden_to_tray,
            tray_available: state.tray_available,
            tray_error: state.tray_error.clone(),
            main_window_visible,
            main_window_minimized,
        }
    }
}

fn unix_time_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis().min(u64::MAX as u128) as u64
}

/// Starts a native wall-clock tick source. Events are a fast path; the bounded
/// sequence ring and `automation_ticks_since` command allow hidden renderers to
/// replay events after their event loop becomes responsive again.
pub fn install(app: &AppHandle) -> tauri::Result<()> {
    app.manage(AutomationRuntime::default());
    #[cfg(windows)] {
        if let Err(error) = install_tray(app) {
            app.state::<AutomationRuntime>().set_tray_status(false, Some(error.to_string()));
            eprintln!("System tray could not be installed: {error}");
        }
    }
    #[cfg(not(windows))]
    app.state::<AutomationRuntime>().set_tray_status(false, Some("Native tray is only supported on Windows".into()));
    let handle = app.clone();
    tauri::async_runtime::spawn(async move {
        let mut interval = tokio::time::interval_at(next_tick_deadline(tokio::time::Instant::now()), TICK_INTERVAL);
        interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        loop {
            interval.tick().await;
            let Some(runtime) = handle.try_state::<AutomationRuntime>() else { continue; };
            let tick = runtime.record_tick(unix_time_ms());
            let _ = handle.emit(TICK_EVENT, tick);
        }
    });
    Ok(())
}

#[cfg(windows)]
fn install_tray(app: &AppHandle) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Show Still", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit Still", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &quit])?;
    let mut builder = TrayIconBuilder::new().menu(&menu).show_menu_on_left_click(true);
    if let Some(icon) = app.default_window_icon() { builder = builder.icon(icon.clone()); }
    let builder = builder
        .on_menu_event(|app, event| match tray_action_for_id(event.id().as_ref()) {
            Some(TrayAction::Show) => {
                if let Some(runtime) = app.try_state::<AutomationRuntime>() { runtime.set_hidden_to_tray(false); }
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.unminimize();
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            Some(TrayAction::Quit) => {
                if let Some(window) = app.get_webview_window("main") {
                    if window.close().is_err() { app.exit(0); }
                } else { app.exit(0); }
            }
            None => {}
        })
        .on_tray_icon_event(|tray, event| {
            if matches!(event, TrayIconEvent::DoubleClick { .. }) {
                let app = tray.app_handle();
                if let Some(runtime) = app.try_state::<AutomationRuntime>() { runtime.set_hidden_to_tray(false); }
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.unminimize();
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        });
    app.manage(builder.build(app)?);
    app.state::<AutomationRuntime>().set_tray_status(true, None);
    Ok(())
}

#[tauri::command]
pub fn automation_ticks_since(webview: tauri::Webview, runtime_id: Option<String>, sequence: u64, runtime: State<'_, AutomationRuntime>) -> Result<TickBatch, String> {
    crate::security::authorize(&webview)?;
    Ok(runtime.ticks_since(runtime_id.as_deref(), sequence))
}

#[tauri::command]
pub fn automation_runtime_status(app: AppHandle, webview: tauri::Webview, runtime: State<'_, AutomationRuntime>) -> Result<AutomationRuntimeStatus, String> {
    crate::security::authorize(&webview)?;
    let window = app.get_webview_window("main");
    let visible = window.as_ref().map(|window| window.is_visible()).transpose().map_err(|error| error.to_string())?;
    let minimized = window.as_ref().map(|window| window.is_minimized()).transpose().map_err(|error| error.to_string())?;
    Ok(runtime.status(visible, minimized))
}

#[tauri::command]
pub fn window_minimize_to_tray(app: AppHandle, webview: tauri::Webview, window: tauri::WebviewWindow, runtime: State<'_, AutomationRuntime>) -> Result<(), String> {
    crate::security::authorize(&webview)?;
    runtime.ensure_tray_available()?;
    window.hide().map_err(|error| error.to_string())?;
    runtime.set_hidden_to_tray(true);
    #[cfg(windows)] crate::native_panels::refresh_all(&app);
    #[cfg(not(windows))] let _ = app;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tick_batch_replays_only_events_after_the_cursor() {
        let runtime = AutomationRuntime::default();
        let first = runtime.record_tick(15_000);
        let second = runtime.record_tick(30_000);
        assert_eq!(first.sequence, 1);
        assert_eq!(second.sequence, 2);
        let runtime_id = Some(first.runtime_id.clone());
        let batch = runtime.ticks_since(runtime_id.as_deref(), 1);
        assert_eq!(batch.requested_after_sequence, 1);
        assert_eq!(batch.oldest_available_sequence, Some(1));
        assert_eq!(batch.latest_sequence, 2);
        assert_eq!(batch.ticks, vec![second]);
    }

    #[test]
    fn ticks_since_a_previous_process_replays_from_current_ring_start() {
        let previous_runtime = AutomationRuntime::default();
        let old_runtime_id = previous_runtime.record_tick(15_000).runtime_id;
        let current_runtime = AutomationRuntime::default();
        let current = current_runtime.record_tick(15_000);
        assert_ne!(old_runtime_id, current.runtime_id);
        let batch = current_runtime.ticks_since(Some(&old_runtime_id), 99);
        assert_eq!(batch.runtime_id, current.runtime_id);
        assert_eq!(batch.requested_after_sequence, 0);
        assert_eq!(batch.ticks, vec![current]);
    }

    #[test]
    fn native_tick_scheduler_uses_a_fifteen_second_period() {
        let now = tokio::time::Instant::now();
        assert_eq!(next_tick_deadline(now) - now, Duration::from_secs(15));
        assert_eq!(TICK_INTERVAL.as_millis(), 15_000);
    }

    #[test]
    fn replay_ring_is_bounded_and_reports_gap() {
        let runtime = AutomationRuntime::default();
        for index in 1..=(REPLAY_CAPACITY as u64 + 2) { runtime.record_tick(index); }
        let batch = runtime.ticks_since(None, 0);
        assert_eq!(batch.oldest_available_sequence, Some(3));
        assert_eq!(batch.latest_sequence, REPLAY_CAPACITY as u64 + 2);
        assert_eq!(batch.ticks.len(), REPLAY_CAPACITY);
    }

    #[test]
    fn tray_visibility_policy_changes_only_on_explicit_actions() {
        let runtime = AutomationRuntime::default();
        assert!(!runtime.status(Some(true), Some(false)).hidden_to_tray);
        runtime.set_hidden_to_tray(true);
        let hidden = runtime.status(Some(false), Some(false));
        assert!(hidden.hidden_to_tray);
        assert_eq!(hidden.main_window_visible, Some(false));
        runtime.set_hidden_to_tray(false);
        assert!(!runtime.status(Some(true), Some(false)).hidden_to_tray);
    }

    #[test]
    fn unavailable_tray_rejects_hide_and_reports_setup_error() {
        let runtime = AutomationRuntime::default();
        assert_eq!(runtime.ensure_tray_available(), Err("Tray has not been initialized".into()));
        runtime.set_tray_status(false, Some("tray startup error".into()));
        assert_eq!(runtime.ensure_tray_available(), Err("tray startup error".into()));
        runtime.set_tray_status(true, None);
        assert_eq!(runtime.ensure_tray_available(), Ok(()));
    }

    #[test]
    fn tray_action_ids_are_explicit_and_unknown_ids_are_ignored() {
        assert_eq!(tray_action_for_id("show"), Some(TrayAction::Show));
        assert_eq!(tray_action_for_id("quit"), Some(TrayAction::Quit));
        assert_eq!(tray_action_for_id("other"), None);
    }

    #[test]
    fn webview2_background_flags_preserve_existing_arguments_without_duplicates() {
        let args = add_webview2_background_flags("--disable-background-timer-throttling --custom-flag");
        assert!(args.starts_with("--disable-background-timer-throttling --custom-flag"));
        assert_eq!(args.matches("--disable-background-timer-throttling").count(), 1);
        assert!(args.contains("--disable-renderer-backgrounding"));
        assert!(args.contains("--disable-backgrounding-occluded-windows"));
    }

    #[test]
    fn webview2_arguments_include_defaults_background_flags_and_only_numeric_debug_port() {
        let args = webview2_browser_args(Some(9222));
        assert!(args.contains("--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection"));
        assert!(args.contains("--disable-background-timer-throttling"));
        assert!(args.contains("--disable-renderer-backgrounding"));
        assert!(args.contains("--disable-backgrounding-occluded-windows"));
        assert!(args.contains("--remote-debugging-port=9222"));
        assert!(!webview2_browser_args(None).contains("--remote-debugging-port"));
        assert!(!webview2_browser_args(Some(80)).contains("--remote-debugging-port"));
    }

    #[test]
    fn smoke_debug_port_is_numeric_high_port_and_github_only() {
        assert_eq!(smoke_cdp_port(true, Some("9222")), Some(9222));
        assert_eq!(smoke_cdp_port(false, Some("9222")), None);
        assert_eq!(smoke_cdp_port(true, Some("80")), None);
        assert_eq!(smoke_cdp_port(true, Some("9222 --no-sandbox")), None);
        assert_eq!(smoke_cdp_port(true, None), None);
    }
}

