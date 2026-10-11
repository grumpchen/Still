#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod browser;
mod files;
mod dropped_files;
mod shortcuts;
mod app_capture;
mod chrome;
mod capture;
mod assistant;
mod assistant_protocol;
#[cfg(windows)] mod chrome_overlay;
#[cfg(windows)] mod app_panel;
#[cfg(windows)] mod native_panels;
#[cfg(windows)] mod app_picker;
use tauri::Manager;
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::DragDrop(event) = event { dropped_files::handle_event(window, event); }
        })
        .setup(|app| {
            app.manage(assistant::AssistantState::from_environment());
            app.manage(files::FolderRoots::load(app.handle())); app.manage(shortcuts::ShortcutState::default());
            app.manage(dropped_files::DocumentGrants::load(app.handle()));
            app.manage(dropped_files::AppGrants::load(app.handle()));
            #[cfg(windows)] {
                app.manage(chrome_overlay::ChromeState::default());
                app.manage(app_panel::AppPanelState::default());
                shortcuts::install(app.handle())?;
                chrome_overlay::install(app.handle())?;
                app_panel::install(app.handle())?;
                if let Some(window)=app.get_window("main") {let handle=app.handle().clone();window.on_window_event(move |event|{
                    match event {tauri::WindowEvent::Moved(_)|tauri::WindowEvent::Resized(_)|tauri::WindowEvent::ScaleFactorChanged{..}|tauri::WindowEvent::Focused(_)=>{native_panels::refresh_all(&handle)},
                    tauri::WindowEvent::CloseRequested{..}=>{app_capture::shutdown();app_panel::shutdown(&handle);chrome_overlay::shutdown(&handle)},_=>{}}
                });}
                if let Err(error)=app_capture::install(app.handle()) { eprintln!("Global app capture could not start: {error}"); }
            }
            if let Some(view)=app.get_webview("main") {let handle=app.handle().clone();tauri::async_runtime::spawn(async move {if let Err(error)=shortcuts::attach(handle,&view).await {eprintln!("Workspace shortcut adapter: {error}");}});}
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            assistant::assistant_configured, assistant::assistant_set_key, assistant::assistant_chat, assistant::assistant_key_setup,
            chrome::chrome_open, capture::widget_capture, capture::widget_export,
            chrome_overlay::chrome_panel_open,chrome_overlay::chrome_panel_present,chrome_overlay::chrome_panel_navigate,chrome_overlay::chrome_panel_close,
            browser::browser_open, browser::browser_bounds, browser::browser_visible,
            browser::browser_navigate, browser::browser_current, browser::browser_action, browser::browser_close,
            files::files_choose, files::files_list, files::files_open,files::files_reuse,
            dropped_files::document_open, dropped_files::document_choose,
            dropped_files::app_open, dropped_files::app_choose,
            app_panel::app_panel_open,app_panel::app_panel_windows,app_panel::app_panel_attach,app_panel::app_panel_present,app_panel::app_panel_release,
            app_capture::app_capture_enable,
            app_picker::app_picker_windows,app_picker::app_picker_prepare,app_picker::app_picker_preview,
            shortcuts::shortcuts_configure,
        ])
        .run(tauri::generate_context!())
        .expect("Unable to start Still");
}
