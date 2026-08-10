use serde::Serialize;
use tauri::AppHandle;

const DEFAULT_READ_TIMEOUT_MS: u64 = 15_000;
const MIN_READ_TIMEOUT_MS: u64 = 1_000;
const MAX_READ_TIMEOUT_MS: u64 = 60_000;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CardReadResult {
    serial_number: String,
    serial_number_hex: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CardReaderError {
    code: String,
    message: String,
}

impl CardReaderError {
    fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
        }
    }
}

#[cfg(windows)]
mod windows_reader {
    use super::{CardReadResult, CardReaderError};
    use serde::Deserialize;
    use std::{
        env,
        os::windows::process::CommandExt,
        path::{Path, PathBuf},
        process::{Child, Command, Stdio},
        sync::{
            atomic::{AtomicBool, Ordering},
            Mutex, OnceLock,
        },
        thread,
        time::{Duration, Instant},
    };
    use tauri::{AppHandle, Manager};

    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    const PROCESS_POLL_INTERVAL_MS: u64 = 50;
    const PROCESS_EXIT_GRACE_MS: u64 = 5_000;

    static READER_BUSY: AtomicBool = AtomicBool::new(false);
    static CANCEL_REQUESTED: AtomicBool = AtomicBool::new(false);
    static ACTIVE_CHILD: OnceLock<Mutex<Option<Child>>> = OnceLock::new();

    #[derive(Debug, Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct BridgeResponse {
        success: bool,
        serial_number: Option<String>,
        serial_number_hex: Option<String>,
        code: Option<String>,
        message: Option<String>,
    }

    struct ReaderBusyGuard;

    impl Drop for ReaderBusyGuard {
        fn drop(&mut self) {
            CANCEL_REQUESTED.store(false, Ordering::Release);
            READER_BUSY.store(false, Ordering::Release);
            if let Ok(mut active_child) = active_child().lock() {
                if let Some(child) = active_child.as_mut() {
                    let _ = child.kill();
                    let _ = child.wait();
                }
                *active_child = None;
            }
        }
    }

    fn active_child() -> &'static Mutex<Option<Child>> {
        ACTIVE_CHILD.get_or_init(|| Mutex::new(None))
    }

    fn push_candidate(candidates: &mut Vec<PathBuf>, directory: &Path, filename: &str) {
        candidates.push(directory.join(filename));
    }

    fn application_directories(app: &AppHandle) -> Vec<PathBuf> {
        let mut directories = Vec::new();

        if let Ok(resource_dir) = app.path().resource_dir() {
            directories.push(resource_dir.join("card-reader"));
            directories.push(resource_dir.join("resources").join("card-reader"));
        }

        if let Ok(executable_path) = env::current_exe() {
            if let Some(executable_dir) = executable_path.parent() {
                directories.push(executable_dir.to_path_buf());
                directories.push(executable_dir.join("card-reader"));
            }
        }

        if cfg!(debug_assertions) {
            if let Ok(current_dir) = env::current_dir() {
                directories.push(
                    current_dir
                        .join("src-tauri")
                        .join("resources")
                        .join("card-reader"),
                );
                directories.push(current_dir.join("resources").join("card-reader"));
            }
        }

        directories.dedup();
        directories
    }

    fn bridge_candidates(app: &AppHandle) -> Vec<PathBuf> {
        let mut candidates = Vec::new();
        if let Some(configured_path) = env::var_os("POS_CARD_READER_BRIDGE") {
            candidates.push(PathBuf::from(configured_path));
        }
        for directory in application_directories(app) {
            push_candidate(&mut candidates, &directory, "card-reader-bridge.exe");
        }
        candidates.dedup();
        candidates
    }

    fn dll_candidates(app: &AppHandle) -> Vec<PathBuf> {
        let mut candidates = Vec::new();
        if let Some(configured_path) = env::var_os("POS_CARD_READER_DLL") {
            candidates.push(PathBuf::from(configured_path));
        }
        for directory in application_directories(app) {
            push_candidate(&mut candidates, &directory, "dcrf32.dll");
            push_candidate(&mut candidates, &directory, "DCRF32.dll");
        }
        candidates.dedup();
        candidates
    }

    fn first_existing(
        candidates: Vec<PathBuf>,
        code: &str,
        message: &str,
    ) -> Result<PathBuf, CardReaderError> {
        candidates
            .into_iter()
            .find(|candidate| candidate.is_file())
            .ok_or_else(|| CardReaderError::new(code, message))
    }

    fn read_bridge_output(
        app: &AppHandle,
        timeout: Duration,
    ) -> Result<CardReadResult, CardReaderError> {
        if READER_BUSY
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .is_err()
        {
            return Err(CardReaderError::new(
                "READER_BUSY",
                "Đầu đọc thẻ đang xử lý một yêu cầu khác.",
            ));
        }
        let _busy_guard = ReaderBusyGuard;
        CANCEL_REQUESTED.store(false, Ordering::Release);

        let bridge_path = first_existing(
            bridge_candidates(app),
            "BRIDGE_NOT_INSTALLED",
            "Chưa tìm thấy sidecar x86 đọc thẻ của JPOS.",
        )?;
        let dll_path = first_existing(
            dll_candidates(app),
            "SDK_NOT_INSTALLED",
            "Chưa tìm thấy SDK Decard dcrf32.dll x86 đi kèm ứng dụng.",
        )?;

        let child = Command::new(&bridge_path)
            .arg("--dll")
            .arg(&dll_path)
            .arg("--timeout-ms")
            .arg(timeout.as_millis().to_string())
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|error| {
                CardReaderError::new(
                    "BRIDGE_START_FAILED",
                    format!("Không thể khởi động sidecar đọc thẻ x86: {error}"),
                )
            })?;

        {
            let mut active_child = active_child().lock().map_err(|_| {
                CardReaderError::new(
                    "BRIDGE_STATE_FAILED",
                    "Không thể lưu trạng thái sidecar đọc thẻ.",
                )
            })?;
            *active_child = Some(child);
        }

        let safety_deadline =
            Instant::now() + timeout + Duration::from_millis(PROCESS_EXIT_GRACE_MS);

        loop {
            if CANCEL_REQUESTED.load(Ordering::Acquire) {
                if let Ok(mut active_child) = active_child().lock() {
                    if let Some(child) = active_child.as_mut() {
                        let _ = child.kill();
                    }
                }
                return Err(CardReaderError::new(
                    "READ_CANCELLED",
                    "Đã hủy chờ đọc thẻ.",
                ));
            }

            let has_exited = {
                let mut active_child = active_child().lock().map_err(|_| {
                    CardReaderError::new(
                        "BRIDGE_STATE_FAILED",
                        "Không thể đọc trạng thái sidecar đọc thẻ.",
                    )
                })?;
                let child = active_child.as_mut().ok_or_else(|| {
                    CardReaderError::new("BRIDGE_STOPPED", "Sidecar đọc thẻ đã dừng ngoài dự kiến.")
                })?;
                child
                    .try_wait()
                    .map_err(|error| {
                        CardReaderError::new(
                            "BRIDGE_WAIT_FAILED",
                            format!("Không thể theo dõi sidecar đọc thẻ: {error}"),
                        )
                    })?
                    .is_some()
            };

            if has_exited {
                break;
            }

            if Instant::now() >= safety_deadline {
                if let Ok(mut active_child) = active_child().lock() {
                    if let Some(child) = active_child.as_mut() {
                        let _ = child.kill();
                    }
                }
                return Err(CardReaderError::new(
                    "BRIDGE_TIMEOUT",
                    "Sidecar đọc thẻ không phản hồi.",
                ));
            }

            thread::sleep(Duration::from_millis(PROCESS_POLL_INTERVAL_MS));
        }

        let child = active_child()
            .lock()
            .map_err(|_| {
                CardReaderError::new(
                    "BRIDGE_STATE_FAILED",
                    "Không thể thu kết quả sidecar đọc thẻ.",
                )
            })?
            .take()
            .ok_or_else(|| {
                CardReaderError::new("BRIDGE_STOPPED", "Sidecar đọc thẻ không còn khả dụng.")
            })?;

        let output = child.wait_with_output().map_err(|error| {
            CardReaderError::new(
                "BRIDGE_OUTPUT_FAILED",
                format!("Không thể đọc kết quả sidecar: {error}"),
            )
        })?;

        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        if stdout.is_empty() {
            return Err(CardReaderError::new(
                "BRIDGE_EMPTY_RESPONSE",
                if stderr.is_empty() {
                    format!("Sidecar không trả dữ liệu (exit={}).", output.status)
                } else {
                    format!("Sidecar không trả dữ liệu: {stderr}")
                },
            ));
        }

        let response: BridgeResponse = serde_json::from_str(&stdout).map_err(|error| {
            CardReaderError::new(
                "BRIDGE_INVALID_RESPONSE",
                format!("Sidecar trả dữ liệu không hợp lệ: {error}"),
            )
        })?;

        if !response.success {
            return Err(CardReaderError::new(
                response
                    .code
                    .unwrap_or_else(|| "CARD_READ_FAILED".to_string()),
                response
                    .message
                    .unwrap_or_else(|| "Không thể đọc thẻ thành viên.".to_string()),
            ));
        }

        let serial_number = response.serial_number.ok_or_else(|| {
            CardReaderError::new(
                "BRIDGE_INVALID_RESPONSE",
                "Sidecar không trả số serial của thẻ.",
            )
        })?;
        let serial_number_hex = response.serial_number_hex.ok_or_else(|| {
            CardReaderError::new(
                "BRIDGE_INVALID_RESPONSE",
                "Sidecar không trả serial dạng hex.",
            )
        })?;

        Ok(CardReadResult {
            serial_number,
            serial_number_hex,
        })
    }

    pub async fn read(app: AppHandle, timeout_ms: u64) -> Result<CardReadResult, CardReaderError> {
        tauri::async_runtime::spawn_blocking(move || {
            read_bridge_output(&app, Duration::from_millis(timeout_ms))
        })
        .await
        .map_err(|error| {
            CardReaderError::new(
                "READER_TASK_FAILED",
                format!("Module đọc thẻ dừng bất thường: {error}"),
            )
        })?
    }

    pub fn cancel() -> bool {
        if !READER_BUSY.load(Ordering::Acquire) {
            return false;
        }

        CANCEL_REQUESTED.store(true, Ordering::Release);
        if let Ok(mut active_child) = active_child().lock() {
            if let Some(child) = active_child.as_mut() {
                let _ = child.kill();
            }
        }
        true
    }
}

#[tauri::command]
pub async fn read_member_card(
    app: AppHandle,
    timeout_ms: Option<u64>,
) -> Result<CardReadResult, CardReaderError> {
    let timeout_ms = timeout_ms
        .unwrap_or(DEFAULT_READ_TIMEOUT_MS)
        .clamp(MIN_READ_TIMEOUT_MS, MAX_READ_TIMEOUT_MS);

    #[cfg(windows)]
    {
        windows_reader::read(app, timeout_ms).await
    }

    #[cfg(not(windows))]
    {
        let _ = (app, timeout_ms);
        Err(CardReaderError::new(
            "UNSUPPORTED_PLATFORM",
            "Đầu đọc Decard D3-U hiện chỉ hỗ trợ ứng dụng POS trên Windows.",
        ))
    }
}

#[tauri::command]
pub fn cancel_member_card_read() -> bool {
    #[cfg(windows)]
    {
        windows_reader::cancel()
    }

    #[cfg(not(windows))]
    {
        false
    }
}
