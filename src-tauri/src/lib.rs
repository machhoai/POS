// =============================================================================
// Tauri Backend — Khởi tạo ứng dụng và quản lý màn hình khách
// =============================================================================

use serde::Serialize;
use tauri::{
    window::Monitor, AppHandle, Emitter, LogicalPosition, Manager, WebviewUrl,
    WebviewWindowBuilder,
};

const MAIN_WINDOW_LABEL: &str = "main";
const CUSTOMER_DISPLAY_LABEL: &str = "customer-display";
const CUSTOMER_DISPLAY_WARNING_EVENT: &str = "customer-display-warning";
const NO_SECONDARY_MONITOR_WARNING: &str =
    "Không tìm thấy màn hình phụ. Màn hình khách chưa được mở để tránh che giao diện thu ngân.";

#[derive(Clone, Copy, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
enum CustomerDisplayOpenStatus {
    Opened,
    AlreadyOpen,
    NoSecondaryMonitor,
}

fn is_same_monitor(left: &Monitor, right: &Monitor) -> bool {
    let left_position = left.position();
    let right_position = right.position();
    let left_size = left.size();
    let right_size = right.size();

    left_position.x == right_position.x
        && left_position.y == right_position.y
        && left_size.width == right_size.width
        && left_size.height == right_size.height
}

fn find_secondary_monitor(app: &AppHandle) -> Result<Option<Monitor>, String> {
    let monitors = app.available_monitors().map_err(|error| error.to_string())?;
    if monitors.len() < 2 {
        return Ok(None);
    }

    let reference_monitor = app
        .primary_monitor()
        .map_err(|error| error.to_string())?
        .or_else(|| {
            app.get_webview_window(MAIN_WINDOW_LABEL)
                .and_then(|window| window.current_monitor().ok().flatten())
        });

    let Some(reference_monitor) = reference_monitor else {
        return Ok(None);
    };

    Ok(monitors
        .into_iter()
        .find(|monitor| !is_same_monitor(monitor, &reference_monitor)))
}

fn monitor_logical_position(monitor: &Monitor) -> LogicalPosition<f64> {
    let position = monitor.position();
    let scale_factor = monitor.scale_factor();

    LogicalPosition::new(
        f64::from(position.x) / scale_factor,
        f64::from(position.y) / scale_factor,
    )
}

fn focus_main_window(app: &AppHandle) -> Result<(), String> {
    if let Some(main_window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        main_window.set_focus().map_err(|error| error.to_string())?;
    }

    Ok(())
}

fn notify_main_window(app: &AppHandle, message: &str) {
    eprintln!("[Màn hình khách] {message}");
    if let Err(error) = app.emit_to(
        MAIN_WINDOW_LABEL,
        CUSTOMER_DISPLAY_WARNING_EVENT,
        message,
    ) {
        eprintln!("[Màn hình khách] Không thể gửi cảnh báo tới cửa sổ chính: {error}");
    }
}

fn position_existing_window(
    window: &tauri::WebviewWindow,
    monitor: &Monitor,
) -> Result<(), String> {
    let current_monitor = window
        .current_monitor()
        .map_err(|error| error.to_string())?;
    let is_on_target = current_monitor
        .as_ref()
        .map(|current| is_same_monitor(current, monitor))
        .unwrap_or(false);
    let is_fullscreen = window
        .is_fullscreen()
        .map_err(|error| error.to_string())?;

    window
        .set_decorations(false)
        .map_err(|error| error.to_string())?;

    if !is_on_target || !is_fullscreen {
        window
            .set_fullscreen(false)
            .map_err(|error| error.to_string())?;
        window
            .set_position(monitor_logical_position(monitor))
            .map_err(|error| error.to_string())?;
        window
            .set_fullscreen(true)
            .map_err(|error| error.to_string())?;
    }

    window.show().map_err(|error| error.to_string())?;
    Ok(())
}

fn ensure_customer_display(app: &AppHandle) -> Result<CustomerDisplayOpenStatus, String> {
    let Some(secondary_monitor) = find_secondary_monitor(app)? else {
        if let Some(window) = app.get_webview_window(CUSTOMER_DISPLAY_LABEL) {
            window.hide().map_err(|error| error.to_string())?;
        }
        focus_main_window(app)?;
        return Ok(CustomerDisplayOpenStatus::NoSecondaryMonitor);
    };

    if let Some(window) = app.get_webview_window(CUSTOMER_DISPLAY_LABEL) {
        position_existing_window(&window, &secondary_monitor)?;
        focus_main_window(app)?;
        return Ok(CustomerDisplayOpenStatus::AlreadyOpen);
    }

    let position = monitor_logical_position(&secondary_monitor);
    let size = secondary_monitor.size();
    let scale_factor = secondary_monitor.scale_factor();
    let window = WebviewWindowBuilder::new(
        app,
        CUSTOMER_DISPLAY_LABEL,
        WebviewUrl::App("/display".into()),
    )
    .title("Màn hình khách hàng")
    .position(position.x, position.y)
    .inner_size(
        f64::from(size.width) / scale_factor,
        f64::from(size.height) / scale_factor,
    )
    .resizable(false)
    .decorations(false)
    .focused(false)
    .always_on_top(false)
    .skip_taskbar(true)
    .visible(false)
    .build()
    .map_err(|error| error.to_string())?;

    window
        .set_fullscreen(true)
        .map_err(|error| error.to_string())?;
    window.show().map_err(|error| error.to_string())?;
    focus_main_window(app)?;

    Ok(CustomerDisplayOpenStatus::Opened)
}

/// Mở hoặc khôi phục màn hình khách trên monitor phụ theo hướng idempotent.
#[tauri::command]
async fn open_customer_display(
    app: AppHandle,
) -> Result<CustomerDisplayOpenStatus, String> {
    let status = ensure_customer_display(&app)?;
    if matches!(status, CustomerDisplayOpenStatus::NoSecondaryMonitor) {
        notify_main_window(&app, NO_SECONDARY_MONITOR_WARNING);
    }
    Ok(status)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            match ensure_customer_display(app.handle()) {
                Ok(CustomerDisplayOpenStatus::NoSecondaryMonitor) => {
                    notify_main_window(app.handle(), NO_SECONDARY_MONITOR_WARNING);
                }
                Ok(_) => {}
                Err(error) => {
                    eprintln!("[Màn hình khách] Không thể mở cửa sổ: {error}");
                    notify_main_window(
                        app.handle(),
                        "Không thể mở màn hình khách. Vui lòng kiểm tra kết nối màn hình và thử lại.",
                    );
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![open_customer_display])
        .run(tauri::generate_context!())
        .expect("Không thể khởi chạy ứng dụng Tauri");
}
