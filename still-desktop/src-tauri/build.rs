fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(
            tauri_build::AppManifest::new().commands(&[
                "assistant_configured", "assistant_models", "assistant_set_key", "assistant_chat", "assistant_agent_turn", "assistant_key_setup",
                "chatgpt_plan_status", "chatgpt_plan_connect", "chatgpt_plan_disconnect", "chatgpt_plan_models", "chatgpt_plan_agent_turn",
                "assistant_journal_plan", "assistant_journal_start", "assistant_journal_finish", "assistant_journal_list", "assistant_journal_dismiss",
                "chrome_open", "widget_capture", "widget_export",
                "files_choose", "files_still_inbox", "files_choose_inbox", "files_list", "files_create_folder", "files_move_to_inbox", "files_search", "files_open", "files_open_with", "files_reuse", "files_preview", "files_extract_pdf_text", "files_library_search", "files_move_resource",
                "notes_library_choose", "notes_library_list", "notes_library_search", "notes_library_read", "notes_library_write", "notes_library_create",
                "notes_library_agent_grant", "notes_library_agent_list", "notes_library_agent_search", "notes_library_agent_read", "notes_library_agent_write", "notes_library_agent_create", "notes_library_agent_create_folder",
                "document_open", "document_choose", "document_preview",
                "app_open", "app_choose",
                "app_panel_open", "app_panel_prepare_launch", "app_panel_windows", "app_panel_identity", "app_panel_attach", "app_panel_present", "app_panel_release", "app_panel_suspend", "app_panel_resume", "app_panel_configure_shutdown",
                "app_capture_enable",
                "app_picker_windows", "app_picker_prepare", "app_picker_icon", "app_picker_preview", "app_picker_installed", "app_picker_installed_icon", "app_picker_select_installed",
                "shortcuts_configure",
                "window_input_update_regions", "window_input_configure_toggle", "window_input_set_click_through",
                "startup_status", "startup_set",
            ]),
        ),
    ).expect("Tauri build configuration failed");
}
