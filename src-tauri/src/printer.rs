use serde::Serialize;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PrinterInfo {
    pub name: String,
    pub is_default: bool,
    pub is_available: bool,
    pub status: PrinterStatus,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub(crate) enum PrinterStatus {
    Ready,
    Busy,
    Paused,
    Offline,
    Error,
}

pub(crate) struct PrinterResolution {
    pub requested_name: Option<String>,
    pub effective_name: String,
    pub used_fallback: bool,
}

#[cfg(windows)]
fn get_default_printer_name() -> Option<String> {
    use windows::{core::PWSTR, Win32::Graphics::Printing::GetDefaultPrinterW};

    let mut character_count = 0u32;
    unsafe {
        let _ = GetDefaultPrinterW(None, &mut character_count);
    }
    if character_count <= 1 {
        return None;
    }

    let mut buffer = vec![0u16; character_count as usize];
    let result =
        unsafe { GetDefaultPrinterW(Some(PWSTR(buffer.as_mut_ptr())), &mut character_count) };
    if !result.as_bool() {
        return None;
    }

    let length = buffer
        .iter()
        .position(|value| *value == 0)
        .unwrap_or(buffer.len());
    String::from_utf16(&buffer[..length]).ok()
}

#[cfg(windows)]
fn classify_status(status: u32, attributes: u32) -> (PrinterStatus, bool) {
    use windows::Win32::Graphics::Printing::{
        PRINTER_ATTRIBUTE_WORK_OFFLINE, PRINTER_STATUS_BUSY, PRINTER_STATUS_DOOR_OPEN,
        PRINTER_STATUS_ERROR, PRINTER_STATUS_NOT_AVAILABLE, PRINTER_STATUS_NO_TONER,
        PRINTER_STATUS_OFFLINE, PRINTER_STATUS_OUTPUT_BIN_FULL, PRINTER_STATUS_OUT_OF_MEMORY,
        PRINTER_STATUS_PAGE_PUNT, PRINTER_STATUS_PAPER_JAM, PRINTER_STATUS_PAPER_OUT,
        PRINTER_STATUS_PAPER_PROBLEM, PRINTER_STATUS_PAUSED, PRINTER_STATUS_PENDING_DELETION,
        PRINTER_STATUS_PRINTING, PRINTER_STATUS_PROCESSING, PRINTER_STATUS_SERVER_OFFLINE,
        PRINTER_STATUS_SERVER_UNKNOWN, PRINTER_STATUS_USER_INTERVENTION,
    };

    // A number of USB printer drivers leave Status at zero after the cable is
    // removed and only expose the disconnection through WORK_OFFLINE.
    if attributes & PRINTER_ATTRIBUTE_WORK_OFFLINE != 0 {
        return (PrinterStatus::Offline, false);
    }

    let disconnected = PRINTER_STATUS_OFFLINE
        | PRINTER_STATUS_NOT_AVAILABLE
        | PRINTER_STATUS_PENDING_DELETION
        | PRINTER_STATUS_SERVER_OFFLINE
        | PRINTER_STATUS_SERVER_UNKNOWN;
    if status & disconnected != 0 {
        return (PrinterStatus::Offline, false);
    }
    if status & PRINTER_STATUS_PAUSED != 0 {
        return (PrinterStatus::Paused, true);
    }

    let needs_attention = PRINTER_STATUS_ERROR
        | PRINTER_STATUS_DOOR_OPEN
        | PRINTER_STATUS_NO_TONER
        | PRINTER_STATUS_OUT_OF_MEMORY
        | PRINTER_STATUS_OUTPUT_BIN_FULL
        | PRINTER_STATUS_PAGE_PUNT
        | PRINTER_STATUS_PAPER_JAM
        | PRINTER_STATUS_PAPER_OUT
        | PRINTER_STATUS_PAPER_PROBLEM
        | PRINTER_STATUS_USER_INTERVENTION;
    if status & needs_attention != 0 {
        return (PrinterStatus::Error, true);
    }

    let active = PRINTER_STATUS_BUSY | PRINTER_STATUS_PRINTING | PRINTER_STATUS_PROCESSING;
    if status & active != 0 {
        return (PrinterStatus::Busy, true);
    }

    (PrinterStatus::Ready, true)
}

#[cfg(windows)]
fn enumerate_windows_printers() -> Result<Vec<PrinterInfo>, String> {
    use std::{mem, slice};
    use windows::{
        core::PCWSTR,
        Win32::Graphics::Printing::{
            EnumPrintersW, PRINTER_ENUM_CONNECTIONS, PRINTER_ENUM_LOCAL, PRINTER_INFO_2W,
        },
    };

    let flags = PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS;
    let mut bytes_needed = 0u32;
    let mut printer_count = 0u32;
    let initial_result = unsafe {
        EnumPrintersW(
            flags,
            PCWSTR::null(),
            2,
            None,
            &mut bytes_needed,
            &mut printer_count,
        )
    };
    if bytes_needed == 0 {
        return initial_result
            .map(|_| Vec::new())
            .map_err(|error| format!("Không thể đọc danh sách máy in Windows: {error}"));
    }

    // EnumPrintersW writes structures followed by their strings into one buffer.
    // Back the byte slice with usize values so PRINTER_INFO_2W stays correctly aligned.
    let word_size = mem::size_of::<usize>();
    let word_count = (bytes_needed as usize).div_ceil(word_size);
    let mut aligned_buffer = vec![0usize; word_count];
    let byte_buffer = unsafe {
        slice::from_raw_parts_mut(
            aligned_buffer.as_mut_ptr().cast::<u8>(),
            aligned_buffer.len() * word_size,
        )
    };

    unsafe {
        EnumPrintersW(
            flags,
            PCWSTR::null(),
            2,
            Some(byte_buffer),
            &mut bytes_needed,
            &mut printer_count,
        )
    }
    .map_err(|error| format!("Không thể đọc danh sách máy in Windows: {error}"))?;

    let default_name = get_default_printer_name();
    let raw_printers = unsafe {
        slice::from_raw_parts(
            aligned_buffer.as_ptr().cast::<PRINTER_INFO_2W>(),
            printer_count as usize,
        )
    };

    let mut printers = raw_printers
        .iter()
        .filter_map(|printer| {
            if printer.pPrinterName.is_null() {
                return None;
            }
            let name = unsafe { printer.pPrinterName.to_string() }.ok()?;
            if name.trim().is_empty() {
                return None;
            }
            let (status, is_available) = classify_status(printer.Status, printer.Attributes);
            Some(PrinterInfo {
                is_default: default_name
                    .as_deref()
                    .is_some_and(|default| default.eq_ignore_ascii_case(&name)),
                name,
                is_available,
                status,
            })
        })
        .collect::<Vec<_>>();

    printers.sort_by(|left, right| {
        right
            .is_default
            .cmp(&left.is_default)
            .then_with(|| left.name.to_lowercase().cmp(&right.name.to_lowercase()))
    });
    printers.dedup_by(|left, right| left.name.eq_ignore_ascii_case(&right.name));
    Ok(printers)
}

#[cfg(all(test, windows))]
mod tests {
    use super::{classify_status, PrinterStatus};
    use windows::Win32::Graphics::Printing::{
        PRINTER_ATTRIBUTE_WORK_OFFLINE, PRINTER_STATUS_BUSY, PRINTER_STATUS_PENDING_DELETION,
    };

    #[test]
    fn marks_work_offline_queue_as_unavailable_even_when_status_is_zero() {
        assert_eq!(
            classify_status(0, PRINTER_ATTRIBUTE_WORK_OFFLINE),
            (PrinterStatus::Offline, false),
        );
    }

    #[test]
    fn marks_pending_deletion_queue_as_unavailable() {
        assert_eq!(
            classify_status(PRINTER_STATUS_PENDING_DELETION, 0),
            (PrinterStatus::Offline, false),
        );
    }

    #[test]
    fn preserves_available_statuses() {
        assert_eq!(classify_status(0, 0), (PrinterStatus::Ready, true));
        assert_eq!(
            classify_status(PRINTER_STATUS_BUSY, 0),
            (PrinterStatus::Busy, true),
        );
    }
}

#[cfg(not(windows))]
fn enumerate_windows_printers() -> Result<Vec<PrinterInfo>, String> {
    Err("Cấu hình máy in hiện chỉ hỗ trợ ứng dụng POS trên Windows.".to_string())
}

#[tauri::command]
pub(crate) fn list_printers() -> Result<Vec<PrinterInfo>, String> {
    enumerate_windows_printers()
}

pub(crate) fn resolve_printer(requested_name: Option<String>) -> Result<PrinterResolution, String> {
    let requested_name = requested_name.and_then(|name| {
        let trimmed = name.trim();
        (!trimmed.is_empty()).then(|| trimmed.to_string())
    });
    let printers = enumerate_windows_printers()?;

    if let Some(requested) = requested_name.as_deref() {
        if let Some(printer) = printers
            .iter()
            .find(|printer| printer.is_available && printer.name.eq_ignore_ascii_case(requested))
        {
            return Ok(PrinterResolution {
                requested_name,
                effective_name: printer.name.clone(),
                used_fallback: false,
            });
        }

        if let Some(default_printer) = printers.iter().find(|printer| {
            printer.is_default
                && printer.is_available
                && !printer.name.eq_ignore_ascii_case(requested)
        }) {
            return Ok(PrinterResolution {
                requested_name,
                effective_name: default_printer.name.clone(),
                used_fallback: true,
            });
        }

        return Err(format!(
            "Máy in đã chọn “{requested}” đang mất kết nối và máy in mặc định của Windows không khả dụng."
        ));
    }

    let default_printer = printers
        .iter()
        .find(|printer| printer.is_default && printer.is_available)
        .ok_or_else(|| {
            "Chưa chọn máy in và máy in mặc định của Windows không khả dụng.".to_string()
        })?;

    Ok(PrinterResolution {
        requested_name: None,
        effective_name: default_printer.name.clone(),
        used_fallback: false,
    })
}

pub(crate) fn find_default_fallback(excluded_name: &str) -> Result<Option<String>, String> {
    Ok(enumerate_windows_printers()?
        .into_iter()
        .find(|printer| {
            printer.is_default
                && printer.is_available
                && !printer.name.eq_ignore_ascii_case(excluded_name)
        })
        .map(|printer| printer.name))
}
