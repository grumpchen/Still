fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(
            tauri_build::AppManifest::new().commands(&[
                "assistant_configured", "assistant_models", "assistant_set_key", "assistant_chat", "assistant_key_setup",
                "chrome_open", "widget_capture", "widget_export",
                "files_choose", "files_list", "files_open", "files_reuse", "files_preview",
                "notes_library_choose", "notes_library_list", "notes_library_read", "notes_library_write", "notes_library_create",
                "document_open", "document_choose", "document_preview",
                "app_open", "app_choose",
                "app_panel_open", "app_panel_windows", "app_panel_attach", "app_panel_present", "app_panel_release", "app_panel_configure_shutdown",
                "app_capture_enable",
                "app_picker_windows", "app_picker_prepare", "app_picker_preview", "app_picker_installed", "app_picker_installed_icon", "app_picker_select_installed",
                "shortcuts_configure",
                "window_input_update_regions", "window_input_configure_toggle", "window_input_set_click_through",
                "startup_status", "startup_set",
            ]),
        ),
    ).expect("Tauri build configuration failed");
}
