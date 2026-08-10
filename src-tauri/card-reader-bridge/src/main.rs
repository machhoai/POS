use serde::Serialize;
use std::{env, path::PathBuf, process::ExitCode};

const DEFAULT_TIMEOUT_MS: u64 = 15_000;
const POLL_INTERVAL_MS: u64 = 150;
const USB_PORT: i16 = 100;
const SERIAL_BAUD_PLACEHOLDER: i32 = 115_200;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BridgeResponse {
    success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    serial_number: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    serial_number_hex: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    message: Option<String>,
}

impl BridgeResponse {
    fn success(serial_number: u32) -> Self {
        Self {
            success: true,
            serial_number: Some(serial_number.to_string()),
            serial_number_hex: Some(format!("{serial_number:08X}")),
            code: None,
            message: None,
        }
    }

    fn failure(code: &str, message: impl Into<String>) -> Self {
        Self {
            success: false,
            serial_number: None,
            serial_number_hex: None,
            code: Some(code.to_string()),
            message: Some(message.into()),
        }
    }
}

struct Arguments {
    dll_path: PathBuf,
    timeout_ms: u64,
}

fn parse_arguments() -> Result<Arguments, BridgeResponse> {
    let mut dll_path = None;
    let mut timeout_ms = DEFAULT_TIMEOUT_MS;
    let mut args = env::args_os().skip(1);

    while let Some(argument) = args.next() {
        match argument.to_string_lossy().as_ref() {
            "--dll" => {
                dll_path = args.next().map(PathBuf::from);
            }
            "--timeout-ms" => {
                let Some(value) = args.next() else {
                    return Err(BridgeResponse::failure(
                        "INVALID_ARGUMENTS",
                        "Thiếu giá trị cho --timeout-ms.",
                    ));
                };
                timeout_ms = value.to_string_lossy().parse::<u64>().map_err(|_| {
                    BridgeResponse::failure(
                        "INVALID_ARGUMENTS",
                        "Giá trị --timeout-ms không hợp lệ.",
                    )
                })?;
            }
            _ => {
                return Err(BridgeResponse::failure(
                    "INVALID_ARGUMENTS",
                    "Tham số sidecar đọc thẻ không hợp lệ.",
                ));
            }
        }
    }

    let dll_path = dll_path
        .ok_or_else(|| BridgeResponse::failure("INVALID_ARGUMENTS", "Thiếu đường dẫn --dll."))?;

    Ok(Arguments {
        dll_path,
        timeout_ms,
    })
}

#[cfg(windows)]
fn read_card(arguments: &Arguments) -> BridgeResponse {
    use libloading::Library;
    use std::{
        thread,
        time::{Duration, Instant},
    };

    type DeviceHandle = isize;
    type DcInit = unsafe extern "system" fn(i16, i32) -> DeviceHandle;
    type DcExit = unsafe extern "system" fn(DeviceHandle) -> i16;
    type DcCard = unsafe extern "system" fn(DeviceHandle, u8, *mut u32) -> i16;
    type DcBeep = unsafe extern "system" fn(DeviceHandle, u16) -> i16;

    struct DeviceGuard {
        handle: DeviceHandle,
        exit: DcExit,
    }

    impl Drop for DeviceGuard {
        fn drop(&mut self) {
            // SAFETY: the handle and function pointer come from the same loaded
            // vendor library, which outlives this guard.
            unsafe {
                (self.exit)(self.handle);
            }
        }
    }

    if !arguments.dll_path.is_file() {
        return BridgeResponse::failure(
            "SDK_NOT_INSTALLED",
            format!(
                "Không tìm thấy SDK Decard tại {}.",
                arguments.dll_path.display()
            ),
        );
    }

    // SAFETY: the DLL path is supplied by the application from its bundled
    // resource directory. Required symbols are validated before use.
    let library = match unsafe { Library::new(&arguments.dll_path) } {
        Ok(library) => library,
        Err(error) => {
            return BridgeResponse::failure(
                "SDK_LOAD_FAILED",
                format!("Không thể nạp SDK Decard x86: {error}"),
            )
        }
    };

    // SAFETY: signatures match Decard's published dcrf32.h API. This sidecar
    // is intentionally built as x86 to match the vendor DLL.
    let (dc_init, dc_exit, dc_card) = unsafe {
        let dc_init = match library.get::<DcInit>(b"dc_init\0") {
            Ok(symbol) => *symbol,
            Err(error) => {
                return BridgeResponse::failure(
                    "SDK_INVALID",
                    format!("SDK thiếu hàm dc_init: {error}"),
                )
            }
        };
        let dc_exit = match library.get::<DcExit>(b"dc_exit\0") {
            Ok(symbol) => *symbol,
            Err(error) => {
                return BridgeResponse::failure(
                    "SDK_INVALID",
                    format!("SDK thiếu hàm dc_exit: {error}"),
                )
            }
        };
        let dc_card = match library.get::<DcCard>(b"dc_card\0") {
            Ok(symbol) => *symbol,
            Err(error) => {
                return BridgeResponse::failure(
                    "SDK_INVALID",
                    format!("SDK thiếu hàm dc_card: {error}"),
                )
            }
        };
        (dc_init, dc_exit, dc_card)
    };

    // Port 100 is the first logical USB reader in Decard's API.
    let device_handle = unsafe { dc_init(USB_PORT, SERIAL_BAUD_PLACEHOLDER) };
    if device_handle < 0 {
        return BridgeResponse::failure(
            "DEVICE_NOT_FOUND",
            format!("Không mở được đầu đọc Decard D3-U qua USB (dc_init={device_handle})."),
        );
    }
    let _device_guard = DeviceGuard {
        handle: device_handle,
        exit: dc_exit,
    };

    let started_at = Instant::now();
    let timeout = Duration::from_millis(arguments.timeout_ms);
    let mut last_status = 1_i16;

    while started_at.elapsed() < timeout {
        let mut serial_number = 0_u32;
        last_status = unsafe { dc_card(device_handle, 0, &mut serial_number) };
        if last_status == 0 {
            if let Ok(dc_beep) = unsafe { library.get::<DcBeep>(b"dc_beep\0") } {
                unsafe {
                    dc_beep(device_handle, 80);
                }
            }
            return BridgeResponse::success(serial_number);
        }

        thread::sleep(Duration::from_millis(POLL_INTERVAL_MS));
    }

    BridgeResponse::failure(
        "CARD_TIMEOUT",
        format!("Chưa đọc được thẻ trong thời gian chờ (mã SDK: {last_status})."),
    )
}

#[cfg(not(windows))]
fn read_card(_arguments: &Arguments) -> BridgeResponse {
    BridgeResponse::failure(
        "UNSUPPORTED_PLATFORM",
        "Sidecar đọc thẻ Decard chỉ hỗ trợ Windows.",
    )
}

fn main() -> ExitCode {
    let response = match parse_arguments() {
        Ok(arguments) => read_card(&arguments),
        Err(error) => error,
    };

    match serde_json::to_string(&response) {
        Ok(json) => {
            println!("{json}");
            ExitCode::SUCCESS
        }
        Err(error) => {
            println!(
                "{{\"success\":false,\"code\":\"SERIALIZATION_FAILED\",\"message\":\"{}\"}}",
                error.to_string().replace('"', "\\\"")
            );
            ExitCode::FAILURE
        }
    }
}
