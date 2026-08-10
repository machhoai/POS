$ErrorActionPreference = "Stop"

$workspaceRoot = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $workspaceRoot "src-tauri\card-reader-bridge\Cargo.toml"
$targetTriple = "i686-pc-windows-msvc"
$sourceBinary = Join-Path $workspaceRoot "src-tauri\card-reader-bridge\target\$targetTriple\release\card-reader-bridge.exe"
$resourceDirectory = Join-Path $workspaceRoot "src-tauri\resources\card-reader"
$resourceBinary = Join-Path $resourceDirectory "card-reader-bridge.exe"
$vendorDll = Join-Path $resourceDirectory "dcrf32.dll"

if (-not $IsWindows -and $PSVersionTable.PSEdition -eq "Core") {
    throw "Sidecar Decard x86 chỉ có thể build trên Windows."
}

if (-not (Get-Command rustup -ErrorAction SilentlyContinue)) {
    throw "Không tìm thấy rustup. Hãy cài Rust MSVC trước khi build JPOS."
}

if (-not (Test-Path -LiteralPath $vendorDll)) {
    throw "Thiếu SDK Decard tại $vendorDll"
}

$installedTargets = rustup target list --installed
if ($installedTargets -notcontains $targetTriple) {
    rustup target add $targetTriple
    if ($LASTEXITCODE -ne 0) {
        throw "Không thể cài Rust target $targetTriple"
    }
}

cargo build `
    --manifest-path $manifestPath `
    --bin card-reader-bridge `
    --target $targetTriple `
    --release

if ($LASTEXITCODE -ne 0) {
    throw "Build sidecar đọc thẻ x86 thất bại."
}

New-Item -ItemType Directory -Path $resourceDirectory -Force | Out-Null
Copy-Item -LiteralPath $sourceBinary -Destination $resourceBinary -Force

$bytes = [System.IO.File]::ReadAllBytes($resourceBinary)
$peOffset = [BitConverter]::ToInt32($bytes, 0x3C)
$machine = [BitConverter]::ToUInt16($bytes, $peOffset + 4)
if ($machine -ne 0x014C) {
    throw "Sidecar phải là x86 (PE machine 0x014C), nhận được 0x$($machine.ToString('X4'))."
}

Write-Host "Đã build sidecar Decard x86: $resourceBinary"
