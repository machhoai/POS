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
    member_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    card_uuid: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    message: Option<String>,
}

impl BridgeResponse {
    fn serial_success(serial_number: u32, member_code: Option<String>) -> Self {
        Self {
            success: true,
            serial_number: Some(serial_number.to_string()),
            serial_number_hex: Some(format!("{serial_number:08X}")),
            member_code,
            card_uuid: None,
            code: None,
            message: None,
        }
    }

    fn member_success(member_code: String, card_uuid: String) -> Self {
        Self {
            success: true,
            serial_number: None,
            serial_number_hex: None,
            member_code: Some(member_code),
            card_uuid: Some(card_uuid),
            code: None,
            message: None,
        }
    }

    fn failure(code: &str, message: impl Into<String>) -> Self {
        Self {
            success: false,
            serial_number: None,
            serial_number_hex: None,
            member_code: None,
            card_uuid: None,
            code: Some(code.to_string()),
            message: Some(message.into()),
        }
    }
}

struct Arguments {
    dll_path: PathBuf,
    rfid_dll_path: Option<PathBuf>,
    card_key: Option<String>,
    timeout_ms: u64,
}

fn parse_arguments() -> Result<Arguments, BridgeResponse> {
    let mut dll_path = None;
    let mut rfid_dll_path = None;
    let mut card_key = None;
    let mut timeout_ms = DEFAULT_TIMEOUT_MS;
    let mut args = env::args_os().skip(1);

    while let Some(argument) = args.next() {
        match argument.to_string_lossy().as_ref() {
            "--dll" => {
                dll_path = args.next().map(PathBuf::from);
            }
            "--rfid-dll" => {
                rfid_dll_path = args.next().map(PathBuf::from);
            }
            "--card-key" => {
                card_key = args
                    .next()
                    .map(|value| value.to_string_lossy().into_owned());
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
        rfid_dll_path,
        card_key,
        timeout_ms,
    })
}

#[cfg(windows)]
fn read_card(arguments: &Arguments) -> BridgeResponse {
    use libloading::Library;
    use std::{
        ffi::CStr,
        os::raw::c_char,
        thread,
        time::{Duration, Instant},
    };

    type ReadLeaguer =
        unsafe extern "C" fn(*mut c_char, *mut c_char, *mut c_char, *mut c_char) -> i32;

    if let (Some(rfid_dll_path), Some(card_key)) = (&arguments.rfid_dll_path, &arguments.card_key) {
        if rfid_dll_path.is_file() {
            // SAFETY: the optional HK RFID DLL and its C ABI are validated at
            // runtime. Buffers remain alive and writable for the full call.
            if let Ok(rfid_library) = unsafe { Library::new(rfid_dll_path) } {
                if let Ok(read_leaguer) =
                    unsafe { rfid_library.get::<ReadLeaguer>(b"read_leaguer\0") }
                {
                    let started_at = Instant::now();
                    let timeout = Duration::from_millis(arguments.timeout_ms);

                    while started_at.elapsed() < timeout {
                        let mut key_buffer = card_key.as_bytes().to_vec();
                        key_buffer.push(0);
                        let mut member_code_buffer = vec![0_u8; 128];
                        let mut uuid_buffer = vec![0_u8; 128];
                        let mut message_buffer = vec![0_u8; 512];
                        let status = unsafe {
                            read_leaguer(
                                key_buffer.as_mut_ptr().cast(),
                                member_code_buffer.as_mut_ptr().cast(),
                                uuid_buffer.as_mut_ptr().cast(),
                                message_buffer.as_mut_ptr().cast(),
                            )
                        };

                        if status == 0 {
                            let member_code =
                                unsafe { CStr::from_ptr(member_code_buffer.as_ptr().cast()) }
                                    .to_string_lossy()
                                    .trim()
                                    .to_string();
                            let card_uuid = unsafe { CStr::from_ptr(uuid_buffer.as_ptr().cast()) }
                                .to_string_lossy()
                                .trim()
                                .to_string();

                            if !member_code.is_empty() {
                                return BridgeResponse::member_success(member_code, card_uuid);
                            }
                        }

                        thread::sleep(Duration::from_millis(POLL_INTERVAL_MS));
                    }
                }
            }
        }
    }

    type DeviceHandle = isize;
    type DcInit = unsafe extern "system" fn(i16, i32) -> DeviceHandle;
    type DcExit = unsafe extern "system" fn(DeviceHandle) -> i16;
    type DcCard = unsafe extern "system" fn(DeviceHandle, u8, *mut u32) -> i16;
    type DcLoadKey = unsafe extern "system" fn(DeviceHandle, u8, u8, *const u8) -> i16;
    type DcAuthentication = unsafe extern "system" fn(DeviceHandle, u8, u8) -> i16;
    type DcRead = unsafe extern "system" fn(DeviceHandle, u8, *mut u8) -> i16;
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
    let (dc_init, dc_exit, dc_card, dc_load_key, dc_authentication, dc_read) = unsafe {
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
        let dc_load_key = match library.get::<DcLoadKey>(b"dc_load_key\0") {
            Ok(symbol) => *symbol,
            Err(error) => {
                return BridgeResponse::failure(
                    "SDK_INVALID",
                    format!("SDK thiếu hàm dc_load_key: {error}"),
                )
            }
        };
        let dc_authentication = match library.get::<DcAuthentication>(b"dc_authentication\0") {
            Ok(symbol) => *symbol,
            Err(error) => {
                return BridgeResponse::failure(
                    "SDK_INVALID",
                    format!("SDK thiếu hàm dc_authentication: {error}"),
                )
            }
        };
        let dc_read = match library.get::<DcRead>(b"dc_read\0") {
            Ok(symbol) => *symbol,
            Err(error) => {
                return BridgeResponse::failure(
                    "SDK_INVALID",
                    format!("SDK thiếu hàm dc_read: {error}"),
                )
            }
        };
        (
            dc_init,
            dc_exit,
            dc_card,
            dc_load_key,
            dc_authentication,
            dc_read,
        )
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
            let candidate_keys = [
                [0xFF_u8; 6],
                [0x16, 0x81, 0x68, 0x16, 0x81, 0x68],
                [0xA0, 0xB0, 0xC0, 0xD0, 0xE0, 0xF0],
            ];
            let mut member_code = None;

            for sector in 0_u8..16 {
                for key in candidate_keys {
                    if unsafe { dc_load_key(device_handle, 0, sector, key.as_ptr()) } != 0
                        || unsafe { dc_authentication(device_handle, 0, sector) } != 0
                    {
                        continue;
                    }

                    for block_offset in 0_u8..3 {
                        let block_number = sector * 4 + block_offset;
                        let mut block = [0_u8; 16];
                        if unsafe { dc_read(device_handle, block_number, block.as_mut_ptr()) } != 0
                        {
                            continue;
                        }

                        let text = String::from_utf8_lossy(&block)
                            .trim_matches(|character: char| character == '\0' || character == ' ')
                            .to_string();
                        if text.len() >= 8
                            && text.len() <= 32
                            && text.contains("PAY")
                            && text
                                .chars()
                                .all(|character| character.is_ascii_alphanumeric())
                        {
                            member_code = Some(text);
                            break;
                        }
                    }

                    if member_code.is_some() {
                        break;
                    }
                }

                if member_code.is_some() {
                    break;
                }
            }

            if let Ok(dc_beep) = unsafe { library.get::<DcBeep>(b"dc_beep\0") } {
                unsafe {
                    dc_beep(device_handle, 80);
                }
            }
            return BridgeResponse::serial_success(serial_number, member_code);
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
