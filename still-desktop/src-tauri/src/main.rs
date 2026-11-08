#![recursion_limit = "256"]
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod security;
mod files;
mod dropped_files;
mod shortcuts;
mod app_capture;
mod chrome;
mod capture;
mod assistant;
mod assistant_protocol;
mod assistant_agent_protocol;
mod assistant_journal;
mod chatgpt_auth;
mod chatgpt_plan;
mod chatgpt_responses;
mod credential_store;
mod startup;
#[cfg(windows)] mod app_panel;
#[cfg(windows)] mod native_panels;
#[cfg(windows)] mod native_resize;
#[cfg(windows)] mod app_picker;
#[cfg(windows)] mod window_input;
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
            app.manage(assistant_journal::AssistantJournal::load(app.handle()));
            app.manage(files::FolderRoots::load(app.handle())); app.manage(shortcuts::ShortcutState::default());
            app.manage(dropped_files::DocumentGrants::load(app.handle()));
            app.manage(dropped_files::AppGrants::load(app.handle()));
            #[cfg(windows)] {
                app.manage(app_panel::AppPanelState::default());
                app.manage(app_picker::InstalledAppCatalog::default());
                shortcuts::install(app.handle())?;
                app_panel::install(app.handle())?;
                if let Some(window)=app.get_webview_window("main") {let handle=app.handle().clone();window.on_window_event(move |event|{
                    match event {tauri::WindowEvent::Moved(_)|tauri::WindowEvent::Resized(_)|tauri::WindowEvent::ScaleFactorChanged{..}|tauri::WindowEvent::Focused(_)=>{native_panels::refresh_all(&handle)},
                    tauri::WindowEvent::CloseRequested{..}=>{app_capture::shutdown();app_panel::shutdown(&handle)},_=>{}}
                });}
                if let Err(error)=app_capture::install(app.handle()) { eprintln!("Global app capture could not start: {error}"); }
            }
            if let Some(view)=app.get_webview_window("main") {let handle=app.handle().clone();tauri::async_runtime::spawn(async move {if let Err(error)=shortcuts::attach(handle,view.as_ref()).await {eprintln!("Workspace shortcut adapter: {error}");}});}
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            assistant::assistant_configured, assistant::assistant_models, assistant::assistant_set_key, assistant::assistant_chat, assistant::assistant_agent_turn, assistant::assistant_key_setup,
            chatgpt_plan::chatgpt_plan_status, chatgpt_plan::chatgpt_plan_connect, chatgpt_plan::chatgpt_plan_disconnect, chatgpt_plan::chatgpt_plan_models, chatgpt_plan::chatgpt_plan_agent_turn,
            chrome::chrome_open, capture::widget_capture, capture::widget_export,
            files::files_choose,files::files_still_inbox,files::files_choose_inbox, files::files_list,files::files_create_folder,files::files_move_to_inbox,files::files_search,files::files_library_search, files::files_open,files::files_reuse,files::files_preview,files::files_extract_pdf_text,files::files_move_resource,
            files::notes_library_choose,files::notes_library_list,files::notes_library_search,files::notes_library_read,files::notes_library_write,files::notes_library_create,
            assistant_journal::assistant_journal_plan,assistant_journal::assistant_journal_start,assistant_journal::assistant_journal_finish,assistant_journal::assistant_journal_list,assistant_journal::assistant_journal_dismiss,
            dropped_files::document_open, dropped_files::document_choose,dropped_files::document_preview,
            dropped_files::app_open, dropped_files::app_choose,
            app_panel::app_panel_open,app_panel::app_panel_prepare_launch,app_panel::app_panel_windows,app_panel::app_panel_identity,app_panel::app_panel_attach,app_panel::app_panel_present,app_panel::app_panel_release,app_panel::app_panel_suspend,app_panel::app_panel_resume,app_panel::app_panel_configure_shutdown,
            app_capture::app_capture_enable,
            app_picker::app_picker_windows,app_picker::app_picker_prepare,app_picker::app_picker_icon,app_picker::app_picker_preview,
            app_picker::app_picker_installed,app_picker::app_picker_installed_icon,app_picker::app_picker_select_installed,
            shortcuts::shortcuts_configure,
            window_input::window_input_update_regions,window_input::window_input_configure_toggle,window_input::window_input_set_click_through,
            startup::startup_status,startup::startup_set,
        ])
        .run(tauri::generate_context!())
        .expect("Unable to start Still");
}
