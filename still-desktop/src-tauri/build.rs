fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(
            tauri_build::AppManifest::new().commands(&[
                "chrome_open", "widget_capture", "widget_export",
                "chrome_panel_open", "chrome_panel_present", "chrome_panel_navigate", "chrome_panel_close", "chrome_panel_release",
                "browser_open", "browser_bounds", "browser_visible", "browser_navigate", "browser_current", "browser_action", "browser_close",
                "files_choose", "files_list", "files_open", "files_reuse",
                "document_open", "document_choose",
                "app_open", "app_choose",
                "app_panel_open", "app_panel_windows", "app_panel_attach", "app_panel_present", "app_panel_release", "app_panel_configure_shutdown",
                "app_capture_enable",
                "app_picker_windows", "app_picker_prepare", "app_picker_preview",
                "shortcuts_configure",
            ]),
        ),
    ).expect("Tauri build configuration failed");
}
