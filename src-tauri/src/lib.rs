// =============================================================================
// Tauri Backend — Rust Commands & App Initialization
// =============================================================================
// This file defines:
//   1. The `open_customer_display` command — opens the secondary window
//      pointing to the /display route for customer-facing content.
//   2. The app builder with the shell plugin for OS integration.
// =============================================================================

use tauri::{AppHandle, WebviewUrl, WebviewWindowBuilder};

/// Open the customer-facing display window.
///
/// This command creates a new window (if it doesn't already exist) that loads
/// the `/display` route from the Next.js app. It's designed to be shown on a
/// secondary monitor facing the customer.
#[tauri::command]
fn open_customer_display(app: AppHandle) -> Result<(), String> {
    let label = "customer-display";

    // Check if the window already exists
    if app.get_webview_window(label).is_some() {
        // Window already open — bring it to focus
        if let Some(window) = app.get_webview_window(label) {
            window.set_focus().map_err(|e| e.to_string())?;
        }
        return Ok(());
    }

    // Create the customer display window
    WebviewWindowBuilder::new(&app, label, WebviewUrl::App("/display".into()))
        .title("Customer Display")
        .inner_size(1024.0, 768.0)
        .resizable(true)
        .fullscreen(false) // Set to true for production kiosk mode
        .decorations(true) // Set to false for production kiosk mode
        .always_on_top(false)
        .build()
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Main library entry point for Tauri.
///
/// Registers all custom commands and plugins.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![open_customer_display])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
