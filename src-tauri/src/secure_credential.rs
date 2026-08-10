use serde::{Deserialize, Serialize};

const INSTALLATION_TARGET: &str = "JPOS/installation-id";
const DEVICE_TARGET: &str = "JPOS/device-credential";
const AUTH_SESSION_TARGET: &str = "JPOS/auth-session-cache";

#[derive(Clone, Serialize, Deserialize)]
pub struct PosDeviceCredential {
    pub device_id: String,
    pub device_credential: String,
    pub warehouse_id: String,
    #[serde(default)]
    pub last_verified_at: Option<String>,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct PosAuthSessionCache {
    pub user_id: String,
    pub verified_at: String,
    pub session: serde_json::Value,
}

#[cfg(windows)]
fn wide(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(std::iter::once(0)).collect()
}

#[cfg(windows)]
fn write_secret(target: &str, value: &str) -> Result<(), String> {
    use windows::core::PWSTR;
    use windows::Win32::Security::Credentials::{
        CredWriteW, CREDENTIALW, CRED_PERSIST_LOCAL_MACHINE, CRED_TYPE_GENERIC,
    };

    let mut target = wide(target);
    let mut username = wide("JPOS");
    let mut bytes = value.as_bytes().to_vec();
    let credential = CREDENTIALW {
        Type: CRED_TYPE_GENERIC,
        TargetName: PWSTR(target.as_mut_ptr()),
        CredentialBlobSize: bytes.len() as u32,
        CredentialBlob: bytes.as_mut_ptr(),
        Persist: CRED_PERSIST_LOCAL_MACHINE,
        UserName: PWSTR(username.as_mut_ptr()),
        ..Default::default()
    };

    unsafe { CredWriteW(&credential, 0) }
        .map_err(|error| format!("Không thể lưu thông tin thiết bị an toàn: {error}"))
}

#[cfg(windows)]
fn read_secret(target: &str) -> Result<Option<String>, String> {
    use std::{ptr, slice};
    use windows::core::PCWSTR;
    use windows::Win32::Security::Credentials::{
        CredFree, CredReadW, CREDENTIALW, CRED_TYPE_GENERIC,
    };

    let target = wide(target);
    let mut pointer: *mut CREDENTIALW = ptr::null_mut();
    if let Err(error) = unsafe {
        CredReadW(
            PCWSTR(target.as_ptr()),
            CRED_TYPE_GENERIC,
            None,
            &mut pointer,
        )
    } {
        if (error.code().0 as u32 & 0xffff) == 1168 {
            return Ok(None);
        }
        return Err(format!("Không thể đọc thông tin thiết bị an toàn: {error}"));
    }

    let result = unsafe {
        let credential = &*pointer;
        let bytes = slice::from_raw_parts(
            credential.CredentialBlob,
            credential.CredentialBlobSize as usize,
        );
        String::from_utf8(bytes.to_vec())
            .map(Some)
            .map_err(|_| "Thông tin thiết bị đã lưu không hợp lệ.".to_string())
    };
    unsafe { CredFree(pointer.cast()) };
    result
}

#[cfg(windows)]
fn delete_secret(target: &str) -> Result<(), String> {
    use windows::core::PCWSTR;
    use windows::Win32::Security::Credentials::{CredDeleteW, CRED_TYPE_GENERIC};

    let target = wide(target);
    match unsafe { CredDeleteW(PCWSTR(target.as_ptr()), CRED_TYPE_GENERIC, None) } {
        Ok(()) => Ok(()),
        Err(error) if (error.code().0 as u32 & 0xffff) == 1168 => Ok(()),
        Err(error) => Err(format!("Không thể xóa thông tin thiết bị: {error}")),
    }
}

#[cfg(not(windows))]
fn write_secret(_target: &str, _value: &str) -> Result<(), String> {
    Err("Kho khóa thiết bị hiện chỉ hỗ trợ ứng dụng POS trên Windows.".to_string())
}

#[cfg(not(windows))]
fn read_secret(_target: &str) -> Result<Option<String>, String> {
    Ok(None)
}

#[cfg(not(windows))]
fn delete_secret(_target: &str) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub fn get_or_create_pos_installation_id() -> Result<String, String> {
    if let Some(value) = read_secret(INSTALLATION_TARGET)? {
        return Ok(value);
    }
    let value = uuid::Uuid::new_v4().to_string();
    write_secret(INSTALLATION_TARGET, &value)?;
    Ok(value)
}

#[tauri::command]
pub fn save_pos_device_credential(value: PosDeviceCredential) -> Result<(), String> {
    let serialized = serde_json::to_string(&value)
        .map_err(|error| format!("Không thể mã hóa thông tin thiết bị: {error}"))?;
    write_secret(DEVICE_TARGET, &serialized)
}

#[tauri::command]
pub fn load_pos_device_credential() -> Result<Option<PosDeviceCredential>, String> {
    let Some(serialized) = read_secret(DEVICE_TARGET)? else {
        return Ok(None);
    };
    serde_json::from_str(&serialized)
        .map(Some)
        .map_err(|_| "Thông tin thiết bị đã lưu không hợp lệ.".to_string())
}

#[tauri::command]
pub fn clear_pos_device_credential() -> Result<(), String> {
    delete_secret(DEVICE_TARGET)
}

#[tauri::command]
pub fn save_pos_auth_session_cache(value: PosAuthSessionCache) -> Result<(), String> {
    let serialized = serde_json::to_string(&value)
        .map_err(|error| format!("Không thể mã hóa phiên quyền POS: {error}"))?;
    write_secret(AUTH_SESSION_TARGET, &serialized)
}

#[tauri::command]
pub fn load_pos_auth_session_cache() -> Result<Option<PosAuthSessionCache>, String> {
    let Some(serialized) = read_secret(AUTH_SESSION_TARGET)? else {
        return Ok(None);
    };
    serde_json::from_str(&serialized)
        .map(Some)
        .map_err(|_| "Phiên quyền POS đã lưu không hợp lệ.".to_string())
}

#[tauri::command]
pub fn clear_pos_auth_session_cache() -> Result<(), String> {
    delete_secret(AUTH_SESSION_TARGET)
}
